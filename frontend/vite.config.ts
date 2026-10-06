import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Um único .env na raiz do monorepo (só variáveis VITE_* chegam ao navegador).
  envDir: "..",
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:3333", changeOrigin: true },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    css: false,
  },
});
