// OpenRouter 模型偏好清單。
// 原則：一律先用免費 (:free) 模型；依序 fallback。
// 此清單於 2026-06-19 對照 OpenRouter /models API 實際可用、且確認 input_modalities
// 含 "image" 的免費多模態模型挑選而來。模型可能改名/下架，故 listFreeModels()
// 提供動態抓取，UI 可讓使用者覆寫。

export const MODEL_PREFS = {
  /** 視覺任務：痛點1 圖片理解、痛點3 看地圖反推圖案。必須是多模態 (吃 image)。 */
  vision: [
    "google/gemma-4-31b-it:free", // 主力：圖像輪廓理解最穩，262k context
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", // 備援：omni + reasoning，適合找隱藏圖案
    "nvidia/nemotron-nano-12b-v2-vl:free", // 輕量降級：快、較不易撞限流
    "google/gemma-4-26b-a4b-it:free",
    "nex-agi/nex-n2-pro:free",
  ],
  /** 純文字：圖案命名、路線描述、提示詞邏輯。 */
  text: [
    "meta-llama/llama-3.3-70b-instruct:free", // 主力
    "qwen/qwen3-next-80b-a3b-instruct:free", // 備援，262k context
    "openai/gpt-oss-120b:free",
  ],
  /** 全部撞限流時的最後保底：免費自動路由。 */
  fallbackRouter: "openrouter/free",
} as const;

export type ModelTask = keyof Pick<typeof MODEL_PREFS, "vision" | "text">;

/**
 * 動態抓取 OpenRouter 目前所有「免費」模型，回傳能吃圖片的 id 清單。
 * 用於防止寫死的模型改名/下架——可在設定頁顯示供使用者挑選。
 * 列出模型不需要 API Key。
 */
export async function listFreeModels(): Promise<{
  vision: string[];
  text: string[];
}> {
  const res = await fetch("https://openrouter.ai/api/v1/models");
  if (!res.ok) throw new Error(`OpenRouter /models 失敗：${res.status}`);
  const json = (await res.json()) as {
    data: Array<{
      id: string;
      pricing?: { prompt?: string; completion?: string };
      architecture?: { input_modalities?: string[] };
    }>;
  };

  const isFree = (m: (typeof json.data)[number]) =>
    Number(m.pricing?.prompt ?? 1) === 0 &&
    Number(m.pricing?.completion ?? 1) === 0;

  const vision: string[] = [];
  const text: string[] = [];
  for (const m of json.data) {
    if (!isFree(m)) continue;
    const mods = m.architecture?.input_modalities ?? [];
    (mods.includes("image") ? vision : text).push(m.id);
  }
  return { vision, text };
}
