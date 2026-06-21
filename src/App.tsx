import { useState } from "react";
import MapCanvas from "./components/MapCanvas";
import SettingsPanel from "./components/SettingsPanel";
import PatternPanel from "./components/PatternPanel";
import ImagePanel from "./components/ImagePanel";
import { hasApiKey } from "./lib/openrouter";
import { useRoute } from "./store";
import { fetchRoadNodes, bboxAreaKm2, MAX_AREA_KM2 } from "./lib/overpass";
import { snapToRoad } from "./lib/snap";
import { fetchGreenspaces, inAnyGreenspace, type Polygon } from "./lib/greenspace";
import { pathLength, type LatLng } from "./lib/geo";
import { downloadGpx } from "./lib/gpx";

const TOLERANCE_METERS = 40; // 吸附容忍半徑；超過則視為空中畫線

export default function App() {
  const { points, addPoint, undo, clear, replace } = useRoute();
  const [roadNodes, setRoadNodes] = useState<LatLng[]>([]);
  const [greenPolys, setGreenPolys] = useState<Polygon[]>([]);
  const [snapOn, setSnapOn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [bbox, setBbox] = useState<[number, number, number, number] | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showPattern, setShowPattern] = useState(false);
  const [showImage, setShowImage] = useState(false);

  const lengthKm = (pathLength(points) / 1000).toFixed(2);

  async function loadRoads() {
    if (!bbox) return;
    const area = bboxAreaKm2(bbox);
    if (area > MAX_AREA_KM2) {
      alert(
        `目前範圍約 ${area.toFixed(1)} km²，太大了（上限 ${MAX_AREA_KM2} km²）。\n請放大地圖到想規劃的街區再載入道路。`
      );
      return;
    }
    setLoading(true);
    try {
      // 道路與綠地一起抓（綠地失敗不影響道路）
      const [nodes, greens] = await Promise.all([
        fetchRoadNodes(bbox),
        fetchGreenspaces(bbox).catch(() => [] as Polygon[]),
      ]);
      setRoadNodes(nodes);
      setGreenPolys(greens);
      if (nodes.length === 0) {
        alert("這個範圍沒抓到道路，換個區域或放大地圖再試。");
      }
    } catch (e) {
      alert("抓取道路失敗：" + (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleClick(latlng: LatLng) {
    // 痛點4：點落在公園/草地/廣場等綠地多邊形內 → 解除道路吸附，自由連線
    const inGreen = greenPolys.length > 0 && inAnyGreenspace(latlng, greenPolys);
    if (snapOn && !inGreen && roadNodes.length > 0) {
      const r = snapToRoad(latlng, roadNodes, TOLERANCE_METERS);
      addPoint({ ...r.point, snapped: r.snapped });
    } else {
      // 自由繪圖（手動關閉吸附，或落在綠地內）
      addPoint({ ...latlng, snapped: false });
    }
  }

  return (
    <div className="app">
      <div className="toolbar">
        <h1>🦕 RouteArt AI</h1>

        <button onClick={loadRoads} disabled={loading || !bbox}>
          {loading ? "抓取中…" : "載入道路＋綠地"}
        </button>

        <button
          className={`toggle ${snapOn ? "on" : ""}`}
          onClick={() => setSnapOn((v) => !v)}
        >
          道路吸附：{snapOn ? "開" : "關（自由繪圖）"}
        </button>

        <button className="secondary" onClick={undo} disabled={points.length === 0}>
          復原
        </button>
        <button className="secondary" onClick={clear} disabled={points.length === 0}>
          清除
        </button>
        <button
          onClick={() => downloadGpx(points)}
          disabled={points.length < 2}
        >
          匯出 GPX
        </button>

        <button onClick={() => setShowImage(true)}>🖼️ 圖片轉路線</button>

        <button onClick={() => setShowPattern(true)}>🔍 AI 找圖案</button>

        <button className="secondary" onClick={() => setShowSettings(true)}>
          ⚙️ 設定{hasApiKey() ? "" : " ⚠️"}
        </button>

        <span className="stat">
          {points.length} 點 · {lengthKm} km
          {roadNodes.length > 0 && (
            <span className="hint">
              　已載入 {roadNodes.length} 道路節點
              {greenPolys.length > 0 && ` · ${greenPolys.length} 綠地`}
            </span>
          )}
        </span>
      </div>

      <MapCanvas
        points={points}
        greenPolys={greenPolys}
        onMapClick={handleClick}
        onBoundsChange={setBbox}
      />

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      {showPattern && (
        <PatternPanel
          bbox={bbox}
          snapTolerance={TOLERANCE_METERS}
          onApply={replace}
          onClose={() => setShowPattern(false)}
        />
      )}
      {showImage && (
        <ImagePanel
          bbox={bbox}
          snapTolerance={TOLERANCE_METERS}
          onApply={replace}
          onClose={() => setShowImage(false)}
        />
      )}
    </div>
  );
}
