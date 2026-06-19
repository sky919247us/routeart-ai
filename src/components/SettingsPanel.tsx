import { useState, useEffect } from "react";
import {
  getApiKey,
  setApiKey,
  getModelOverride,
  setModelOverride,
} from "../lib/openrouter";
import { MODEL_PREFS, listFreeModels } from "../config/models";

type Props = { onClose: () => void };

export default function SettingsPanel({ onClose }: Props) {
  const [key, setKey] = useState(getApiKey());
  const [override, setOverride] = useState(getModelOverride());
  const [freeModels, setFreeModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  // 預設下拉選項：偏好清單；可按鈕動態抓 OpenRouter 全部免費模型
  const presetModels = [...MODEL_PREFS.vision, ...MODEL_PREFS.text];
  const options = freeModels.length > 0 ? freeModels : presetModels;

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  function save() {
    setApiKey(key);
    setModelOverride(override);
    onClose();
  }

  async function refreshModels() {
    setLoadingModels(true);
    try {
      const { vision, text } = await listFreeModels();
      setFreeModels([...vision, ...text]);
    } catch (e) {
      alert("抓取免費模型清單失敗：" + (e as Error).message);
    } finally {
      setLoadingModels(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>⚙️ OpenRouter 設定</h2>

        <label className="field">
          <span>API Key</span>
          <input
            type="password"
            placeholder="sk-or-v1-..."
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoComplete="off"
          />
          <small>
            只存在你瀏覽器的 localStorage，不會上傳到任何伺服器。申請：
            <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">
              openrouter.ai/keys
            </a>
          </small>
        </label>

        <label className="field">
          <span>指定模型（選填，留空＝自動依任務挑選 + fallback）</span>
          <div className="row">
            <select value={override} onChange={(e) => setOverride(e.target.value)}>
              <option value="">自動（推薦）</option>
              {options.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <button className="secondary" onClick={refreshModels} disabled={loadingModels}>
              {loadingModels ? "抓取中…" : "抓取最新免費清單"}
            </button>
          </div>
          <small>
            指定後一律用該模型；自動模式 vision 任務優先用 gemma-4-31b，撞限流自動換下一個。
          </small>
        </label>

        <div className="modal-actions">
          <button className="secondary" onClick={onClose}>
            取消
          </button>
          <button onClick={save}>儲存</button>
        </div>
      </div>
    </div>
  );
}
