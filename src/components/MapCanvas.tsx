import {
  MapContainer,
  TileLayer,
  Polyline,
  Polygon,
  Marker,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import type { LatLng } from "../lib/geo";
import type { RoutePoint } from "../store";
import type { Polygon as GreenPolygon } from "../lib/greenspace";

type Props = {
  points: RoutePoint[];
  greenPolys: GreenPolygon[];
  onMapClick: (latlng: LatLng) => void;
  onBoundsChange: (bbox: [number, number, number, number]) => void;
  onPointDrag: (index: number, latlng: LatLng) => void;
};

// 可拖曳的小圓點圖示（吸附=藍、自由/空中畫線=橘）
const dotIcon = (snapped: boolean) =>
  L.divIcon({
    className: "route-dot-wrap",
    html: `<div class="route-dot ${snapped ? "snapped" : "free"}"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

function MapEvents({ onMapClick, onBoundsChange }: Pick<Props, "onMapClick" | "onBoundsChange">) {
  const map = useMapEvents({
    click(e) {
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
    moveend() {
      const b = map.getBounds();
      onBoundsChange([b.getSouth(), b.getWest(), b.getNorth(), b.getEast()]);
    },
  });
  return null;
}

export default function MapCanvas({
  points,
  greenPolys,
  onMapClick,
  onBoundsChange,
  onPointDrag,
}: Props) {

  return (
    <MapContainer center={[25.0375, 121.5637]} zoom={16} className="map" preferCanvas>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapEvents onMapClick={onMapClick} onBoundsChange={onBoundsChange} />

      {/* 綠地：可自由繪圖區（畫筆進入解除道路吸附） */}
      {greenPolys.map((poly, i) => (
        <Polygon
          key={`g${i}`}
          positions={poly.map((p) => [p.lat, p.lng] as [number, number])}
          pathOptions={{
            color: "#2a9d8f",
            weight: 1,
            fillColor: "#52e0c4",
            fillOpacity: 0.35,
          }}
        />
      ))}

      {/* 路線：已吸附段實線，空中畫線段虛線 */}
      {points.length > 1 &&
        points.slice(1).map((p, i) => (
          <Polyline
            key={i}
            positions={[
              [points[i].lat, points[i].lng],
              [p.lat, p.lng],
            ]}
            pathOptions={{
              color: p.snapped ? "#4361ee" : "#e76f51",
              weight: 4,
              dashArray: p.snapped ? undefined : "6 8",
            }}
          />
        ))}

      {/* 可拖曳節點：拖動即微調路線 */}
      {points.map((p, i) => (
        <Marker
          key={i}
          position={[p.lat, p.lng]}
          icon={dotIcon(p.snapped)}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const ll = e.target.getLatLng();
              onPointDrag(i, { lat: ll.lat, lng: ll.lng });
            },
          }}
        />
      ))}
    </MapContainer>
  );
}
