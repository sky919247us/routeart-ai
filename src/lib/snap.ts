import { distanceMeters, type LatLng } from "./geo";

/**
 * 彈性錨點吸附 (Elastic Snapping) 的最小版本：
 * 在容忍半徑內找最近的道路節點就吸附；超過容忍度則保留原始點
 * （視為「空中畫線」段，使用者跑步時可暫停 GPS / 折返）。
 */
export type SnapResult = {
  point: LatLng;
  snapped: boolean; // false = 空中畫線段
};

export function snapToRoad(
  clicked: LatLng,
  roadNodes: LatLng[],
  toleranceMeters: number
): SnapResult {
  if (roadNodes.length === 0) {
    return { point: clicked, snapped: false };
  }

  let best: LatLng = roadNodes[0];
  let bestDist = Infinity;
  for (const node of roadNodes) {
    const d = distanceMeters(clicked, node);
    if (d < bestDist) {
      bestDist = d;
      best = node;
    }
  }

  if (bestDist <= toleranceMeters) {
    return { point: best, snapped: true };
  }
  // 超過容忍度：不硬拉，保留原座標，標成空中畫線。
  return { point: clicked, snapped: false };
}
