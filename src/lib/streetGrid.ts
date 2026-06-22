import { bboxAreaKm2, MAX_AREA_KM2 } from "./overpass";

export type Way = Array<{ lat: number; lng: number }>;

/**
 * 抓取 bbox 內道路「線段（含幾何）」，供渲染線稿用。
 * 與 fetchRoadNodes 不同：這裡要保留每條 way 的點順序才能畫出線條。
 */
export async function fetchWays(
  bbox: [number, number, number, number],
  signal?: AbortSignal
): Promise<Way[]> {
  const [s, w, n, e] = bbox;
  const query = `
    [out:json][timeout:25];
    (
      way["highway"]
        ["highway"!~"motorway|motorway_link|trunk|trunk_link|construction|proposed|raceway"]
        ["area"!="yes"]
        (${s},${w},${n},${e});
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
    .filter((el) => el.type === "way" && el.geometry)
    .map((el) => el.geometry!.map((g) => ({ lat: g.lat, lng: g.lon })));
}

/**
 * 把道路線段渲染成高對比黑白線稿（白底黑線）的 PNG dataURL。
 * 線稿越乾淨，vision 模型越容易「看出」隱藏圖案。
 */
export function renderLineArt(
  ways: Way[],
  bbox: [number, number, number, number],
  size = 1024
): string {
  const [s, w, n, e] = bbox;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // 經緯度 → 畫布座標（緯度往上為正，需翻轉 y）
  const toXY = (lat: number, lng: number): [number, number] => {
    const x = ((lng - w) / (e - w)) * size;
    const y = ((n - lat) / (n - s)) * size;
    return [x, y];
  };

  for (const way of ways) {
    if (way.length < 2) continue;
    ctx.beginPath();
    way.forEach((p, i) => {
      const [x, y] = toXY(p.lat, p.lng);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  return canvas.toDataURL("image/png");
}

/** 統一的面積守門：太大就丟出可讀錯誤。 */
export function assertAreaOk(bbox: [number, number, number, number]): void {
  const area = bboxAreaKm2(bbox);
  if (area > MAX_AREA_KM2) {
    throw new Error(
      `範圍約 ${area.toFixed(1)} km² 太大（上限 ${MAX_AREA_KM2}），請放大地圖再試。`
    );
  }
}
