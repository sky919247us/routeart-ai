// 圖庫搜尋：用 Openverse(免金鑰、CC 授權、支援 CORS) 搜剪影圖，
// 載入時透過 images.weserv.nl 代理避開 CORS，讓 canvas 能讀像素描邊。

export type ImageResult = {
  id: string;
  title: string;
  thumb: string; // 縮圖（直接顯示）
  url: string; // 原圖網址
};

/** 搜尋剪影圖。自動補上 "silhouette" 提高描邊品質。 */
export async function searchImages(query: string): Promise<ImageResult[]> {
  const q = /silhouette|剪影|輪廓/i.test(query) ? query : `${query} silhouette`;
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(
    q
  )}&page_size=20&extension=png`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`圖庫搜尋失敗：${res.status}`);
  const data = (await res.json()) as {
    results?: Array<{ id: string; title?: string; url: string; thumbnail?: string }>;
  };
  return (data.results ?? [])
    .filter((r) => r.url)
    .map((r) => ({
      id: r.id,
      title: r.title ?? "未命名",
      thumb: r.thumbnail ?? r.url,
      url: r.url,
    }));
}

/** 把任意圖片網址轉成 CORS 安全、可被 canvas 讀像素的代理網址。 */
export function proxyImageUrl(rawUrl: string, width = 512): string {
  const stripped = rawUrl.replace(/^https?:\/\//, "");
  return `https://images.weserv.nl/?url=ssl:${stripped}&output=png&w=${width}`;
}
