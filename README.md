# 🦕 RouteArt AI

GPS 軌跡藝術智能規劃平台 — 在地圖上畫圖、道路吸附、匯出 GPX。

> 純前端、零後端、可完全免費部署在 GitHub Pages。
> 完整規劃見上層的《RouteArt-AI-規劃書.md》。

## ✨ Phase 1 已實作功能

- 🗺️ Leaflet + OpenStreetMap 互動地圖
- 🖱️ 點擊地圖逐點繪製路線
- 🛣️ **道路吸附**：透過 Overpass API 抓取範圍內道路，點擊自動吸附到最近道路節點
- 🪢 **彈性錨點**：超過容忍半徑 (40m) 的點不硬拉，標成「空中畫線段」（虛線橘色）
- 🆓 **自由繪圖模式**：可關閉吸附，任意點擊（之後給公園綠地用）
- 💾 一鍵匯出標準 **GPX**（相容 Garmin / Strava / Apple Watch）
- ↩️ 復原 / 清除、即時里程統計

## 🚀 本機開發

```bash
npm install
npm run dev
```

開啟終端顯示的 `http://localhost:5173/routeart-ai/`。

### 使用方式
1. 把地圖移動到想規劃的區域 → 按「**載入此範圍道路**」。
2. 在地圖上逐點點擊畫出圖案，路線會自動吸附到馬路上。
3. 想在公園草地自由發揮 → 按「**道路吸附：關**」切成自由繪圖。
4. 完成後按「**匯出 GPX**」下載，匯入手錶即可開跑。

## 📦 部署到 GitHub Pages

1. 建一個名為 **`routeart-ai`** 的 public repo。
2. push 到 `main` 分支。
3. Repo → **Settings → Pages → Source 選「GitHub Actions」**。
4. 推送後 `.github/workflows/deploy.yml` 會自動 build 並部署。
5. 網址：`https://sky919247us.github.io/routeart-ai/`

> ⚠️ repo 名稱若不是 `routeart-ai`，記得同步改 `vite.config.ts` 的 `base`。

## 🗺️ Roadmap（接下來）

- Phase 2：上傳圖片自動轉路線、AI 反向「看地圖找圖案」(OpenRouter 免費模型)
- Phase 3：公園多邊形自動偵測、補給站避讓、3D 軌跡預覽、URL 分享

## 授權

MIT
