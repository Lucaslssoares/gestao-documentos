import type { Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, use, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";
import type { Perfil } from "../lib/tipos";

interface ContextoAuth {
  sessao: Session | null;
  carregando: boolean;
  perfil: Perfil | undefined;
  erroPerfil: Error | null;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
  /** Pode cadastrar/alterar documentos em ao menos uma categoria. */
  podeCadastrar: boolean;
  podeEditarRaiz: (raizId: string) => boolean;
  ehAdmin: boolean;
  ehGestorOuAdmin: boolean;
}

const Contexto = createContext<ContextoAuth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [carregando, setCarregando] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session);
      setCarregando(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_evento, novaSessao) => {
      setSessao(novaSessao);
      if (!novaSessao) queryClient.clear();
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  const usuarioId = sessao?.user.id;
  const consultaPerfil = useQuery({
    queryKey: ["me", usuarioId],
    queryFn: () => api<Perfil>("/me"),
    enabled: Boolean(usuarioId),
    staleTime: 60_000,
    retry: 1,
  });

  const valor = useMemo<ContextoAuth>(() => {
    const perfil = consultaPerfil.data;
    const papel = perfil?.papel;
    const podeEditarRaiz = (raizId: string) =>
      papel === "admin" || ((papel === "gestor" || papel === "editor") && Boolean(perfil?.categorias.includes(raizId)));
    return {
      sessao,
      carregando: carregando || (Boolean(usuarioId) && consultaPerfil.isLoading),
      perfil,
      erroPerfil: consultaPerfil.error,
      entrar: async (email, senha) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) {
          throw new Error(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
        }
      },
      sair: async () => {
        await supabase.auth.signOut();
      },
      podeCadastrar: papel === "admin" || ((papel === "gestor" || papel === "editor") && (perfil?.categorias.length ?? 0) > 0),
      podeEditarRaiz,
      ehAdmin: papel === "admin",
      ehGestorOuAdmin: papel === "admin" || papel === "gestor",
    };
  }, [sessao, carregando, usuarioId, consultaPerfil.data, consultaPerfil.isLoading, consultaPerfil.error]);

  return <Contexto value={valor}>{children}</Contexto>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): ContextoAuth {
  const contexto = use(Contexto);
  if (!contexto) throw new Error("useAuth precisa estar dentro de <AuthProvider>.");
  return contexto;
}
