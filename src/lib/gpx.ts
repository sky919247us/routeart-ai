import type { LatLng } from "./geo";

/** 把路線點序列轉成標準 GPX (track) 字串，相容 Garmin / Strava / Apple Watch。 */
export function toGpx(points: LatLng[], name = "RouteArt AI"): string {
  const trkpts = points
    .map((p) => `      <trkpt lat="${p.lat}" lon="${p.lng}"></trkpt>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RouteArt AI" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(name)}</name>
  </metadata>
  <trk>
    <name>${escapeXml(name)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
}

/** 觸發瀏覽器下載 GPX 檔。 */
export function downloadGpx(points: LatLng[], filename = "routeart.gpx"): void {
  const blob = new Blob([toGpx(points)], { type: "application/gpx+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]!)
  );
}
