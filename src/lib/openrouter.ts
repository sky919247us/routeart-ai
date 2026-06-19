import { MODEL_PREFS, type ModelTask } from "../config/models";

const KEY_STORAGE = "routeart.openrouter.key";
const MODEL_OVERRIDE = "routeart.openrouter.model"; // 使用者手動指定（可選）

export function getApiKey(): string {
  return localStorage.getItem(KEY_STORAGE) ?? "";
}
export function setApiKey(key: string): void {
  localStorage.setItem(KEY_STORAGE, key.trim());
}
export function hasApiKey(): boolean {
  return getApiKey().length > 0;
}

export function getModelOverride(): string {
  return localStorage.getItem(MODEL_OVERRIDE) ?? "";
}
export function setModelOverride(model: string): void {
  if (model) localStorage.setItem(MODEL_OVERRIDE, model);
  else localStorage.removeItem(MODEL_OVERRIDE);
}

/** OpenRouter 訊息內容：純文字或圖文混合（vision）。 */
export type Content =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

export type ChatMessage = { role: "system" | "user" | "assistant"; content: Content };

export type ChatOptions = {
  task: ModelTask; // "vision" | "text"，決定挑哪一串模型
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
};

/**
 * 呼叫 OpenRouter chat completion。
 * 依 MODEL_PREFS[task] 逐一嘗試免費模型，遇到限流(429)/不可用就換下一個，
 * 全部失敗才退到 fallbackRouter。回傳模型輸出的純文字。
 */
export async function chat(opts: ChatOptions): Promise<{ text: string; model: string }> {
  const key = getApiKey();
  if (!key) throw new Error("尚未設定 OpenRouter API Key，請先到設定頁貼上。");

  const override = getModelOverride();
  const candidates = override
    ? [override]
    : [...MODEL_PREFS[opts.task], MODEL_PREFS.fallbackRouter];

  let lastErr: Error | null = null;
  for (const model of candidates) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          // OpenRouter 建議帶上，利於免費額度與排名統計
          "HTTP-Referer": location.origin,
          "X-Title": "RouteArt AI",
        },
        body: JSON.stringify({
          model,
          messages: opts.messages,
          temperature: opts.temperature ?? 0.7,
          max_tokens: opts.maxTokens ?? 1024,
        }),
        signal: opts.signal,
      });

      if (res.status === 429) {
        lastErr = new Error(`模型 ${model} 限流 (429)，換下一個`);
        continue;
      }
      if (!res.ok) {
        const body = await res.text();
        lastErr = new Error(`模型 ${model} 失敗 (${res.status})：${body.slice(0, 160)}`);
        continue;
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        error?: { message?: string };
      };
      const text = data.choices?.[0]?.message?.content;
      if (text == null) {
        lastErr = new Error(`模型 ${model} 回傳空內容${data.error ? "：" + data.error.message : ""}`);
        continue;
      }
      return { text, model };
    } catch (e) {
      if ((e as Error).name === "AbortError") throw e;
      lastErr = e as Error;
    }
  }
  throw lastErr ?? new Error("所有免費模型都無法呼叫，請稍後再試。");
}
