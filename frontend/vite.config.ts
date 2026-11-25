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
      // Mesmo caminho do nginx em produção (VITE_SUPABASE_URL=/supabase).
      "/supabase/auth/v1": { target: "http://127.0.0.1:54321", changeOrigin: true, rewrite: (p) => p.replace(/^\/supabase/, "") },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    css: false,
  },
});
