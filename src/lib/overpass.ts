import type { LatLng } from "./geo";

/**
 * 透過 Overpass API 抓取指定 bounding box 內的「可步行/可跑」道路節點。
 * 回傳一串道路上的座標點，供吸附 (snap) 使用。
 *
 * bbox 格式：[south, west, north, east]
 */
export async function fetchRoadNodes(
  bbox: [number, number, number, number]
): Promise<LatLng[]> {
  const [s, w, n, e] = bbox;
  // 只取對行人/跑者有意義的道路類型，排除高速公路。
  const query = `
    [out:json][timeout:25];
    (
      way["highway"]
        ["highway"!~"motorway|motorway_link|trunk|trunk_link|construction|proposed"]
        ["foot"!~"no"]
        (${s},${w},${n},${e});
    );
    node(w);
    out skel qt;
  `;

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: query,
  });

  if (!res.ok) {
    throw new Error(`Overpass 回應錯誤：${res.status}`);
  }

  const data = (await res.json()) as {
    elements: Array<{ type: string; lat?: number; lon?: number }>;
  };

  return data.elements
    .filter((el) => el.type === "node" && el.lat != null && el.lon != null)
    .map((el) => ({ lat: el.lat!, lng: el.lon! }));
}
