import type { NextFunction, Request, RequestHandler, Response } from "express";
import { HttpError } from "../lib/errors.js";
import { clienteDoUsuario, supabaseAdmin } from "../lib/supabase.js";
import type { ContextoAuth } from "../types/express.js";
import type { Papel, Perfil } from "../types/dominio.js";

/** Valida o Bearer token do Supabase Auth e carrega perfil (papel) e categorias liberadas. */
export const autenticar: RequestHandler = async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new HttpError(401, "Faça login para continuar.");

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Sessão inválida ou expirada. Faça login novamente.");

  const db = clienteDoUsuario(token);
  const [perfil, acessos] = await Promise.all([
    db.from("perfis").select("id, nome, email, papel, setor_id, ativo").eq("id", data.user.id).maybeSingle(),
    db.from("usuario_categorias").select("categoria_id").eq("usuario_id", data.user.id),
  ]);

  if (perfil.error || acessos.error) throw new HttpError(500, "Não foi possível carregar o perfil do usuário.");
  if (!perfil.data) throw new HttpError(403, "Usuário sem perfil cadastrado. Procure o administrador.");
  if (!perfil.data.ativo) throw new HttpError(403, "Usuário desativado. Procure o administrador.");

  req.auth = {
    userId: data.user.id,
    email: data.user.email ?? (perfil.data.email as string),
    token,
    perfil: { ...(perfil.data as Omit<Perfil, "categorias">), categorias: acessos.data.map((a) => a.categoria_id as string) },
    db,
  };
  next();
};

/** Contexto de autenticação (só use em rotas atrás de `autenticar`). */
export function ctx(req: Request): ContextoAuth {
  if (!req.auth) throw new HttpError(401, "Faça login para continuar.");
  return req.auth;
}

/** Restringe a rota a determinados papéis. */
export function exigirPapel(...papeis: Papel[]): RequestHandler {
  return (req, _res, next) => {
    const { perfil } = ctx(req);
    if (!papeis.includes(perfil.papel)) {
      throw new HttpError(403, "Seu perfil não tem permissão para esta ação.");
    }
    next();
  };
}

// Regras espelhadas da RLS — usadas para dar mensagens claras antes de tocar o banco/storage.
// A palavra final é sempre do banco.

export function temAcesso(perfil: Perfil, raizId: string): boolean {
  return perfil.papel === "admin" || perfil.categorias.includes(raizId);
}

export function podeEditar(perfil: Perfil, raizId: string): boolean {
  return perfil.papel === "admin" || ((perfil.papel === "gestor" || perfil.papel === "editor") && perfil.categorias.includes(raizId));
}

export function podeExcluir(perfil: Perfil, raizId: string): boolean {
  return perfil.papel === "admin" || (perfil.papel === "gestor" && perfil.categorias.includes(raizId));
}

export function garantirEdicao(perfil: Perfil, raizId: string, nomeCategoria = "esta categoria"): void {
  if (!podeEditar(perfil, raizId)) {
    throw new HttpError(403, `Você não tem permissão para cadastrar ou alterar documentos em ${nomeCategoria}.`);
  }
}

export function garantirExclusao(perfil: Perfil, raizId: string): void {
  if (!podeExcluir(perfil, raizId)) {
    throw new HttpError(403, "Somente gestores ou administradores da categoria podem excluir ou restaurar documentos.");
  }
}
