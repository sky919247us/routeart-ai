import { useState, useCallback } from "react";
import type { LatLng } from "./lib/geo";

export type RoutePoint = LatLng & { snapped: boolean };

/** 極簡的路線狀態管理（不引入額外套件，Phase 1 夠用）。 */
export function useRoute() {
  const [points, setPoints] = useState<RoutePoint[]>([]);

  const addPoint = useCallback((p: RoutePoint) => {
    setPoints((prev) => [...prev, p]);
  }, []);

  const undo = useCallback(() => {
    setPoints((prev) => prev.slice(0, -1));
  }, []);

  const clear = useCallback(() => setPoints([]), []);

  const replace = useCallback((pts: RoutePoint[]) => setPoints(pts), []);

  const updatePoint = useCallback((index: number, latlng: LatLng) => {
    setPoints((prev) =>
      prev.map((p, i) => (i === index ? { ...p, ...latlng, snapped: true } : p))
    );
  }, []);

  return { points, addPoint, undo, clear, replace, updatePoint };
}
