import { MapContainer, TileLayer, Polyline, CircleMarker, useMapEvents } from "react-leaflet";
import type { LatLng } from "../lib/geo";
import type { RoutePoint } from "../store";

type Props = {
  points: RoutePoint[];
  onMapClick: (latlng: LatLng) => void;
  onBoundsChange: (bbox: [number, number, number, number]) => void;
};

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

export default function MapCanvas({ points, onMapClick, onBoundsChange }: Props) {
  const positions = points.map((p) => [p.lat, p.lng] as [number, number]);

  return (
    <MapContainer center={[25.0375, 121.5637]} zoom={16} className="map" preferCanvas>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapEvents onMapClick={onMapClick} onBoundsChange={onBoundsChange} />

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

      {/* 節點 */}
      {positions.map((pos, i) => (
        <CircleMarker
          key={i}
          center={pos}
          radius={4}
          pathOptions={{
            color: points[i].snapped ? "#4361ee" : "#e76f51",
            fillColor: "#fff",
            fillOpacity: 1,
          }}
        />
      ))}
    </MapContainer>
  );
}
