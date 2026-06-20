import type { LatLng } from "./geo";

export type Polygon = LatLng[];

/**
 * 抓取 bbox 內可自由繪圖的綠地/開放空間多邊形：
 * 公園、花園、草地、運動場、廣場等。畫筆進入這些範圍時解除道路吸附。
 */
export async function fetchGreenspaces(
  bbox: [number, number, number, number],
  signal?: AbortSignal
): Promise<Polygon[]> {
  const [s, w, n, e] = bbox;
  const query = `
    [out:json][timeout:25];
    (
      way["leisure"~"^(park|garden|pitch|playground|recreation_ground|track)$"](${s},${w},${n},${e});
      way["landuse"~"^(grass|recreation_ground|meadow|village_green)$"](${s},${w},${n},${e});
      way["place"="square"](${s},${w},${n},${e});
    );
    out geom;
  `;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: query,
    signal,
  });
  if (!res.ok) throw new Error(`Overpass 回應錯誤：${res.status}`);

  const data = (await res.json()) as {
    elements: Array<{
      type: string;
      geometry?: Array<{ lat: number; lon: number }>;
    }>;
  };
  return data.elements
    .filter((el) => el.type === "way" && el.geometry && el.geometry.length >= 3)
    .map((el) => el.geometry!.map((g) => ({ lat: g.lat, lng: g.lon })));
}

/** 射線法：判斷點是否在單一多邊形內。 */
export function pointInPolygon(pt: LatLng, poly: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].lng,
      yi = poly[i].lat;
    const xj = poly[j].lng,
      yj = poly[j].lat;
    const intersect =
      yi > pt.lat !== yj > pt.lat &&
      pt.lng < ((xj - xi) * (pt.lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** 是否落在任一綠地多邊形內。 */
export function inAnyGreenspace(pt: LatLng, polys: Polygon[]): boolean {
  return polys.some((poly) => pointInPolygon(pt, poly));
}
