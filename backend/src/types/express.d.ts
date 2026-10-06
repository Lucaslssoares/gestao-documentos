import type { SupabaseClient } from "@supabase/supabase-js";
import type { Perfil } from "./dominio.js";

export interface ContextoAuth {
  userId: string;
  email: string;
  token: string;
  perfil: Perfil;
  /** Cliente Supabase com o JWT do usuário — sujeito à RLS. */
  db: SupabaseClient;
}

declare global {
  namespace Express {
    interface Request {
      auth?: ContextoAuth;
    }
  }
}
