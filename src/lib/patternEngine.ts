import { chat } from "./openrouter";

export type PatternSuggestion = {
  name: string; // 圖案名稱，例如「雷龍」
  confidence: number; // 0-100
  description: string; // 它在街道網格中的位置/輪廓描述
};

const SYSTEM_PROMPT = `你是一個專門在城市街道地圖中尋找「隱藏圖案」的視覺辨識專家（類似在雲朵中看出形狀的空想性錯視）。
使用者會給你一張白底黑線的街道線稿圖。請仔細觀察線條的整體走向與圍出的形狀，找出 3 個最像「具體物體、動物或幾何圖形」的輪廓。
規則：
- 優先找有趣、適合跑步路線打卡的圖案（動物、恐龍、愛心、星星等）。
- 只回傳 JSON，不要多餘文字。格式：
{"suggestions":[{"name":"圖案名稱","confidence":0-100的整數,"description":"用繁體中文一句話描述它在圖中的位置與由哪些線條構成"}]}`;

/** 把街道線稿送進 vision 模型，回傳候選圖案。 */
export async function findPatterns(
  lineArtDataUrl: string,
  signal?: AbortSignal
): Promise<{ suggestions: PatternSuggestion[]; model: string }> {
  const { text, model } = await chat({
    task: "vision",
    temperature: 0.8,
    maxTokens: 700,
    signal,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "這是一張街道線稿，請找出隱藏的圖案並依指定 JSON 格式回覆。" },
          { type: "image_url", image_url: { url: lineArtDataUrl } },
        ],
      },
    ],
  });

  return { suggestions: parseSuggestions(text), model };
}

/** 寬鬆解析模型輸出：容忍 ```json 圍欄、前後雜訊。 */
function parseSuggestions(raw: string): PatternSuggestion[] {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) s = s.slice(start, end + 1);

  try {
    const obj = JSON.parse(s);
    const arr = Array.isArray(obj) ? obj : obj.suggestions;
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x: Record<string, unknown>) => ({
        name: String(x.name ?? "未命名"),
        confidence: Math.max(0, Math.min(100, Number(x.confidence) || 0)),
        description: String(x.description ?? ""),
      }))
      .slice(0, 5);
  } catch {
    // 解析失敗：至少把原文當一條建議回傳，避免完全空白。
    return raw.trim()
      ? [{ name: "AI 觀察", confidence: 0, description: raw.trim().slice(0, 200) }]
      : [];
  }
}
