import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base 必須等於 "/<repo 名稱>/"，否則 GitHub Pages 上資源會 404。
// repo 名稱：routeart-ai
export default defineConfig({
  plugins: [react()],
  base: "/routeart-ai/",
  // 固定埠號：localStorage(含 API Key)依 origin 隔離，埠號漂移會讓設定遺失
  server: { port: 5174, strictPort: true },
});
