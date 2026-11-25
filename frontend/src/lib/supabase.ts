import { createClient } from "@supabase/supabase-js";

const urlConfig = import.meta.env.VITE_SUPABASE_URL as string | undefined;
// Aceita caminho relativo (ex.: "/supabase"): o nginx do front repassa o Auth ao Supabase,
// assim o sistema funciona em qualquer domínio (túnel, DNS interno) sem recompilar.
const url = urlConfig?.startsWith("/") ? new URL(urlConfig, window.location.origin).toString().replace(/\/$/, "") : urlConfig;
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !chave) {
  console.error("Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env da raiz do projeto.");
}

/**
 * O front-end usa o Supabase apenas para LOGIN e SESSÃO (Auth).
 * Todos os dados passam pela API Node.js (regras de negócio, auditoria, MinIO).
 */
export const supabase = createClient(url ?? "http://localhost:54321", chave ?? "chave-ausente", {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
