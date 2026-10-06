import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { ctx, exigirPapel } from "../../middleware/auth.js";
import { erroDoBanco, HttpError } from "../../lib/errors.js";
import { idParam, uuidOpcional } from "../../lib/http.js";
import { supabaseAdmin } from "../../lib/supabase.js";
import { PAPEIS } from "../../types/dominio.js";
import { registrarEvento } from "../historico/service.js";

/** Rotas do próprio usuário. */
export const meRouter = Router();

meRouter.get("/", (req, res) => {
  const { perfil } = ctx(req);
  res.json(perfil);
});

meRouter.patch("/", async (req, res) => {
  const { userId, perfil } = ctx(req);
  const { nome } = z.object({ nome: z.string().trim().min(2).max(120) }).parse(req.body);
  // Perfis só são alterados pelo admin via RLS; o próprio nome é liberado aqui, pela service role.
  const { error } = await supabaseAdmin.from("perfis").update({ nome }).eq("id", userId);
  if (error) throw erroDoBanco(error, "perfil");
  res.json({ ...perfil, nome });
});

/** Lista enxuta da equipe (id e nome dos usuários ativos) — para o campo "Responsável". */
export const equipeRouter = Router();

equipeRouter.get("/", async (req, res) => {
  const { db } = ctx(req);
  const { data, error } = await db.from("perfis").select("id, nome").eq("ativo", true).order("nome");
  if (error) throw erroDoBanco(error, "usuário");
  res.json(data);
});

/** Administração de usuários (somente admin). */
export const usuariosRouter = Router();
usuariosRouter.use(exigirPapel("admin"));

const CAMPOS = "id, nome, email, papel, setor_id, ativo, criado_em, usuario_categorias(categoria_id)";

function formatar(linha: Record<string, unknown>) {
  const { usuario_categorias, ...resto } = linha as { usuario_categorias?: { categoria_id: string }[] };
  return { ...resto, categorias: (usuario_categorias ?? []).map((u) => u.categoria_id) };
}

usuariosRouter.get("/", async (req, res) => {
  const { db } = ctx(req);
  const { data, error } = await db.from("perfis").select(CAMPOS).order("nome");
  if (error) throw erroDoBanco(error, "usuário");
  res.json({ itens: (data ?? []).map(formatar) });
});

const acessoSchema = z.object({
  papel: z.enum(PAPEIS),
  setor_id: uuidOpcional,
  categorias: z.array(z.uuid()).max(50).default([]),
});

const conviteSchema = acessoSchema.extend({
  email: z.email({ error: "E-mail inválido." }).transform((v) => v.toLowerCase()),
  nome: z.string().trim().min(2, { error: "Informe o nome." }).max(120),
});

usuariosRouter.post("/convite", async (req, res) => {
  const { db, userId } = ctx(req);
  const dados = conviteSchema.parse(req.body);
  if (dados.papel !== "admin" && dados.categorias.length === 0) {
    throw new HttpError(400, "Selecione ao menos uma categoria para o usuário acessar.");
  }

  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(dados.email, {
    data: { nome: dados.nome },
    redirectTo: `${env.APP_URL}/definir-senha`,
  });
  if (error || !data.user) {
    const jaExiste = error?.code === "email_exists" || /already/i.test(error?.message ?? "");
    throw new HttpError(jaExiste ? 409 : 502, jaExiste ? "Já existe um usuário com este e-mail." : "Não foi possível enviar o convite.");
  }

  // O trigger criou o perfil como "leitor"; o admin (via RLS) aplica papel, setor e categorias.
  const novoId = data.user.id;
  const { error: erroPerfil } = await db
    .from("perfis")
    .update({ nome: dados.nome, papel: dados.papel, setor_id: dados.setor_id ?? null })
    .eq("id", novoId);
  if (erroPerfil) throw erroDoBanco(erroPerfil, "usuário");
  await definirCategorias(db, novoId, dados.categorias);

  await registrarEvento({
    atorId: userId,
    acao: "convidar",
    entidade: "usuario",
    entidadeId: novoId,
    detalhes: { email: dados.email, papel: dados.papel, categorias: dados.categorias.length },
  });

  const { data: criado, error: erroLeitura } = await db.from("perfis").select(CAMPOS).eq("id", novoId).single();
  if (erroLeitura) throw erroDoBanco(erroLeitura, "usuário");
  res.status(201).json(formatar(criado));
});

const alteracaoSchema = acessoSchema.partial().extend({
  nome: z.string().trim().min(2).max(120).optional(),
  ativo: z.boolean().optional(),
});

usuariosRouter.patch("/:id", async (req, res) => {
  const { db, userId } = ctx(req);
  const { id } = idParam.parse(req.params);
  const { categorias, ...dados } = alteracaoSchema.parse(req.body);
  if (id === userId && (dados.ativo === false || (dados.papel && dados.papel !== "admin"))) {
    throw new HttpError(400, "Você não pode remover o próprio acesso de administrador.");
  }

  if (Object.keys(dados).length > 0) {
    const { error } = await db.from("perfis").update(dados).eq("id", id);
    if (error) throw erroDoBanco(error, "usuário");
  }
  if (categorias) await definirCategorias(db, id, categorias);

  await registrarEvento({ atorId: userId, acao: "atualizar", entidade: "usuario", entidadeId: id, detalhes: { ...dados, categorias } });

  const { data, error } = await db.from("perfis").select(CAMPOS).eq("id", id).single();
  if (error) throw erroDoBanco(error, "usuário");
  res.json(formatar(data));
});

/** Ajusta as categorias raiz liberadas ao usuário (só grava o que mudou — o histórico fica limpo). */
async function definirCategorias(db: ReturnType<typeof ctx>["db"], usuarioId: string, categorias: string[]): Promise<void> {
  const { data: atuais, error: erroLeitura } = await db.from("usuario_categorias").select("categoria_id").eq("usuario_id", usuarioId);
  if (erroLeitura) throw erroDoBanco(erroLeitura, "acesso");
  const existentes = new Set((atuais ?? []).map((a) => a.categoria_id as string));
  const desejadas = new Set(categorias);

  const remover = [...existentes].filter((c) => !desejadas.has(c));
  const incluir = [...desejadas].filter((c) => !existentes.has(c));
  if (remover.length) {
    const { error } = await db.from("usuario_categorias").delete().eq("usuario_id", usuarioId).in("categoria_id", remover);
    if (error) throw erroDoBanco(error, "acesso");
  }
  if (incluir.length) {
    const { error } = await db.from("usuario_categorias").insert(incluir.map((categoria_id) => ({ usuario_id: usuarioId, categoria_id })));
    if (error) throw erroDoBanco(error, "acesso (use apenas categorias raiz)");
  }
}
