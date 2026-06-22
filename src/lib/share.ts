import type { RoutePoint } from "../store";
import type { LatLng } from "./geo";

// 把路線編碼進網址 hash，達成「分享 / 存檔（加書籤）」。
// 格式：扁平陣列 [lat,lng,snapped, ...]（座標取 5 位小數）→ JSON → base64url。

export function encodeRoute(points: RoutePoint[]): string {
  const flat = points.flatMap((p) => [
    Math.round(p.lat * 1e5) / 1e5,
    Math.round(p.lng * 1e5) / 1e5,
    p.snapped ? 1 : 0,
  ]);
  const json = JSON.stringify(flat);
  return btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function decodeRoute(s: string): RoutePoint[] {
  let b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  b64 += "=".repeat((4 - (b64.length % 4)) % 4); // 補回 base64 padding，否則 atob 會截斷
  const json = decodeURIComponent(escape(atob(b64)));
  const flat = JSON.parse(json) as number[];
  const pts: RoutePoint[] = [];
  for (let i = 0; i + 2 < flat.length + 1; i += 3) {
    if (flat[i] == null || flat[i + 1] == null) break;
    pts.push({ lat: flat[i], lng: flat[i + 1], snapped: !!flat[i + 2] });
  }
  return pts;
}

/** 從 location.hash 讀取路線（#r=...）；無或解析失敗回傳 null。 */
export function readRouteFromHash(): RoutePoint[] | null {
  const m = location.hash.match(/[#&]r=([^&]+)/);
  if (!m) return null;
  try {
    const pts = decodeRoute(m[1]);
    return pts.length >= 1 ? pts : null;
  } catch {
    return null;
  }
}

/** 產生可分享的完整網址。 */
export function buildShareUrl(points: RoutePoint[]): string {
  const base = location.href.split("#")[0];
  return `${base}#r=${encodeRoute(points)}`;
}

/** 路線中心點，供載入分享連結時把地圖移到該位置。 */
export function routeCenter(points: RoutePoint[]): LatLng | null {
  if (points.length === 0) return null;
  const lat = points.reduce((a, p) => a + p.lat, 0) / points.length;
  const lng = points.reduce((a, p) => a + p.lng, 0) / points.length;
  return { lat, lng };
}
