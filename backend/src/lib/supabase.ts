import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

const semSessao = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const;

/**
 * Cliente com a service role: IGNORA a RLS.
 * Uso restrito a: validar tokens, pipeline de processamento (trechos/embeddings),
 * administração de usuários e registro de auditoria.
 */
export const supabaseAdmin: SupabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: semSessao,
});

/**
 * Cliente "como o usuário": envia o JWT dele ao PostgREST, então toda consulta
 * passa pela RLS (áreas e papéis) — inclusive as feitas pelo chatbot.
 */
export function clienteDoUsuario(token: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: semSessao,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}
