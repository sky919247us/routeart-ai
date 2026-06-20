import { useEffect, useRef, useState } from "react";
import { fetchWays, renderLineArt, assertAreaOk } from "../lib/streetGrid";
import { findPatterns, type PatternSuggestion } from "../lib/patternEngine";
import { hasApiKey } from "../lib/openrouter";

type Props = {
  bbox: [number, number, number, number] | null;
  onClose: () => void;
};

type Phase = "idle" | "fetching" | "rendering" | "analyzing" | "done" | "error";

export default function PatternPanel({ bbox, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [lineArt, setLineArt] = useState<string>("");
  const [suggestions, setSuggestions] = useState<PatternSuggestion[]>([]);
  const [usedModel, setUsedModel] = useState("");
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    run();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run() {
    // 取消前一條尚在執行的管線，確保同時只有一條在寫狀態
    // （也涵蓋 React StrictMode 在 dev 下重複觸發 effect 的情況）。
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const alive = () => !ctrl.signal.aborted;

    setError("");
    setSuggestions([]);
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

  const phaseLabel: Record<Phase, string> = {
    idle: "",
    fetching: "抓取街道資料中…",
    rendering: "繪製線稿中…",
    analyzing: "AI 分析隱藏圖案中…（免費模型可能稍慢）",
    done: "",
    error: "",
  };

  const busy = phase === "fetching" || phase === "rendering" || phase === "analyzing";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h2>🔍 AI 反推圖案</h2>

        <div className="pattern-body">
          <div className="pattern-art">
            {lineArt ? (
              <img src={lineArt} alt="街道線稿" />
            ) : (
              <div className="placeholder">線稿產生後顯示於此</div>
            )}
            <small>AI 看到的街道線稿（白底黑線）</small>
          </div>

          <div className="pattern-results">
            {busy && <p className="busy">⏳ {phaseLabel[phase]}</p>}
            {phase === "error" && <p className="err-msg">⚠️ {error}</p>}

            {phase === "done" && suggestions.length === 0 && (
              <p>這個區域 AI 沒找到明顯圖案，換個街區再試試。</p>
            )}

            {suggestions.map((s, i) => (
              <div key={i} className="suggestion">
                <div className="suggestion-head">
                  <strong>{s.name}</strong>
                  {s.confidence > 0 && <span className="conf">{s.confidence}%</span>}
                </div>
                <p>{s.description}</p>
              </div>
            ))}

            {usedModel && <small className="model-tag">模型：{usedModel}</small>}
          </div>
        </div>

        <div className="modal-actions">
          {phase === "error" && (
            <button className="secondary" onClick={run}>
              重試
            </button>
          )}
          {phase === "done" && (
            <button className="secondary" onClick={run}>
              重新分析
            </button>
          )}
          <button onClick={onClose}>關閉</button>
        </div>
      </div>
    </div>
  );
}
