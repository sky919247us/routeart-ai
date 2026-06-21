import { useEffect, useRef, useState } from "react";
import { fetchWays, renderLineArt, assertAreaOk } from "../lib/streetGrid";
import { findPatterns, type PatternSuggestion } from "../lib/patternEngine";
import { hasApiKey } from "../lib/openrouter";
import { fetchRoadNodes } from "../lib/overpass";
import { snapToRoad } from "../lib/snap";
import type { RoutePoint } from "../store";

type Props = {
  bbox: [number, number, number, number] | null;
  snapTolerance: number;
  onApply: (points: RoutePoint[]) => void;
  onClose: () => void;
};

type Phase = "idle" | "fetching" | "rendering" | "analyzing" | "done" | "error";

const CANVAS = 360;

export default function PatternPanel({ bbox, snapTolerance, onApply, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [lineArt, setLineArt] = useState<string>("");
  const [suggestions, setSuggestions] = useState<PatternSuggestion[]>([]);
  const [selected, setSelected] = useState<number>(-1);
  const [usedModel, setUsedModel] = useState("");
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    run();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 線稿載入後畫到 canvas
  useEffect(() => {
    if (!lineArt) return;
    const img = new Image();
    img.onload = () => {
      bgRef.current = img;
      draw(selected);
    };
    img.src = lineArt;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineArt]);

  useEffect(() => {
    draw(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, suggestions]);

  function draw(sel: number) {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, CANVAS, CANVAS);
    if (bgRef.current) ctx.drawImage(bgRef.current, 0, 0, CANVAS, CANVAS);

    const s = suggestions[sel];
    if (!s || s.points.length < 2) return;
    // 高亮選取圖案輪廓
    ctx.strokeStyle = "#e63946";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.beginPath();
    s.points.forEach((p, i) => {
      const x = p.x * CANVAS;
      const y = p.y * CANVAS;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    // 節點
    ctx.fillStyle = "#e63946";
    s.points.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x * CANVAS, p.y * CANVAS, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const alive = () => !ctrl.signal.aborted;

    setError("");
    setSuggestions([]);
    setSelected(-1);
    try {
      if (!bbox) throw new Error("請先移動地圖到想分析的區域。");
      if (!hasApiKey()) throw new Error("尚未設定 OpenRouter API Key，請先點右上「⚙️ 設定」貼上。");
      assertAreaOk(bbox);

      if (alive()) setPhase("fetching");
      const ways = await fetchWays(bbox, ctrl.signal);
      if (!alive()) return;
      if (ways.length === 0) throw new Error("這個範圍沒抓到道路，換個區域再試。");

      setPhase("rendering");
      const art = renderLineArt(ways, bbox);
      setLineArt(art);

      setPhase("analyzing");
      const { suggestions, model } = await findPatterns(art, ctrl.signal);
      if (!alive()) return;
      setSuggestions(suggestions);
      setUsedModel(model);
      setPhase("done");
    } catch (e) {
      if (!alive() || (e as Error).name === "AbortError") return;
      setError((e as Error).message);
      setPhase("error");
    }
  }

  /** 把選取圖案的正規化座標 → 地圖經緯度（用分析時的同一個 bbox），對齊道路後導入。 */
  async function importToMap() {
    const s = suggestions[selected];
    if (!bbox || !s || s.points.length < 2) return;
    setImporting(true);
    setError("");
    try {
      const [south, west, north, east] = bbox;
      const mapped = s.points.map((p) => ({
        lat: north - p.y * (north - south),
        lng: west + p.x * (east - west),
      }));
      let route: RoutePoint[];
      try {
        const nodes = await fetchRoadNodes(bbox);
        route = mapped.map((pt) => {
          const r = snapToRoad(pt, nodes, snapTolerance);
          return { ...r.point, snapped: r.snapped };
        });
      } catch {
        // 抓道路失敗就直接用原始輪廓（空中畫線）
        route = mapped.map((pt) => ({ ...pt, snapped: false }));
      }
      onApply(route);
      onClose();
    } catch (e) {
      setError("導入失敗：" + (e as Error).message);
    } finally {
      setImporting(false);
    }
  }

  const phaseLabel: Record<Phase, string> = {
    idle: "",
    fetching: "抓取街道資料中…",
    rendering: "繪製線稿中…",
    analyzing: "AI 分析隱藏圖案中…（免費模型可能稍慢）",
    done: "",
    error: "",
  };
  const busy = phase === "fetching" || phase === "rendering" || phase === "analyzing";
  const canImport = selected >= 0 && (suggestions[selected]?.points.length ?? 0) >= 2;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h2>🔍 AI 反推圖案</h2>

        <div className="pattern-body">
          <div className="pattern-art">
            <canvas ref={canvasRef} width={CANVAS} height={CANVAS} className="trace-preview" />
            <small>
              {selected >= 0
                ? `已標出「${suggestions[selected]?.name}」（紅線）`
                : "點選右側圖案即可在圖上標出位置"}
            </small>
          </div>

          <div className="pattern-results">
            {busy && <p className="busy">⏳ {phaseLabel[phase]}</p>}
            {phase === "error" && <p className="err-msg">⚠️ {error}</p>}

            {phase === "done" && suggestions.length === 0 && (
              <p>這個區域 AI 沒找到明顯圖案，換個街區再試試。</p>
            )}

            {suggestions.map((s, i) => (
              <div
                key={i}
                className={`suggestion clickable ${selected === i ? "active" : ""}`}
                onClick={() => setSelected(i)}
              >
                <div className="suggestion-head">
                  <strong>
                    {selected === i ? "📍 " : ""}
                    {s.name}
                  </strong>
                  {s.confidence > 0 && <span className="conf">{s.confidence}%</span>}
                </div>
                <p>{s.description}</p>
                {s.points.length > 0 && (
                  <small className="pts">輪廓 {s.points.length} 點</small>
                )}
              </div>
            ))}

            {usedModel && <small className="model-tag">模型：{usedModel}</small>}
          </div>
        </div>

        <div className="modal-actions">
          {(phase === "done" || phase === "error") && (
            <button className="secondary" onClick={run} disabled={busy}>
              重新分析
            </button>
          )}
          {phase === "done" && (
            <button onClick={importToMap} disabled={!canImport || importing}>
              {importing ? "導入中…" : "📥 導入到地圖"}
            </button>
          )}
          <button className="secondary" onClick={onClose}>
            關閉
          </button>
        </div>
      </div>
    </div>
  );
}
