export type LatLng = { lat: number; lng: number };

const R = 6371000; // 地球半徑 (公尺)

/** 兩點間 haversine 距離，單位公尺 */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** 一條路線的總長度 (公尺) */
export function pathLength(points: LatLng[]): number {
  let sum = 0;
  for (let i = 1; i < points.length; i++) {
    sum += distanceMeters(points[i - 1], points[i]);
  }
  return sum;
}
