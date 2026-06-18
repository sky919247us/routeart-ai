import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base 必須等於 "/<repo 名稱>/"，否則 GitHub Pages 上資源會 404。
// repo 名稱：routeart-ai
export default defineConfig({
  plugins: [react()],
  base: "/routeart-ai/",
});
