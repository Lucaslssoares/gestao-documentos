import { Router } from "express";
import { z } from "zod";
import { ctx } from "../../middleware/auth.js";
import { erroDoBanco, HttpError } from "../../lib/errors.js";
import { dataOpcional, idParam, textoOpcional, uuidOpcional } from "../../lib/http.js";
import type { ContextoAuth } from "../../types/express.js";

/**
 * Pendências: ações ligadas a um documento (condicionante, prazo de renovação, entrega...),
 * com responsável e prazo opcional. A central junta ações, validades, revisões e aprovações.
 */
export const pendenciasRouter = Router();

export const CAMPOS_PENDENCIA =
  "id, documento_id, titulo, descricao, prazo, aviso_dias, responsavel_id, concluida_em, criado_em, responsavel:perfis!documento_pendencias_responsavel_id_fkey(nome)";

const pendenciaSchema = z.object({
  titulo: z.string().trim().min(2, { error: "Descreva a pendência." }).max(300),
  descricao: textoOpcional,
  prazo: dataOpcional,
  aviso_dias: z.coerce.number().int().min(0).max(365).optional(),
  responsavel_id: uuidOpcional,
});

/** Formato devolvido ao front-end: nome do responsável achatado. */
export function formatarPendencia(linha: Record<string, unknown>) {
  const { responsavel, ...resto } = linha as { responsavel?: { nome: string } | null };
  return { ...resto, responsavel_nome: responsavel?.nome ?? null };
}

export async function criarPendencia(auth: ContextoAuth, documentoId: string, corpo: unknown) {
  const dados = pendenciaSchema.parse(corpo);
  const { data, error } = await auth.db
    .from("documento_pendencias")
    .insert({ ...dados, aviso_dias: dados.aviso_dias ?? 7, documento_id: documentoId, responsavel_id: dados.responsavel_id ?? auth.userId })
    .select(CAMPOS_PENDENCIA)
    .single();
  if (error) throw erroDoBanco(error, "pendência");
  return formatarPendencia(data);
}

const TIPOS = ["acao", "validade", "revisao", "aprovacao"] as const;

/** Central: ?escopo=minhas (padrão) ou todas (gestor/admin), ?tipo= para filtrar. */
pendenciasRouter.get("/", async (req, res) => {
  const { db, perfil } = ctx(req);
  const { escopo, tipo } = z
    .object({ escopo: z.enum(["minhas", "todas"]).default("minhas"), tipo: z.enum(TIPOS).optional() })
    .parse(req.query);
  if (escopo === "todas" && perfil.papel !== "admin" && perfil.papel !== "gestor") {
    throw new HttpError(403, "Só gestores e administradores veem as pendências de toda a equipe.");
  }
  const { data, error } = await db.rpc("central_pendencias", { p_escopo: escopo });
  if (error) throw erroDoBanco(error, "pendência");
  const itens = (data ?? []) as { tipo: string }[];
  res.json({ itens: tipo ? itens.filter((i) => i.tipo === tipo) : itens });
});

/** Edita, conclui ({concluida: true}) ou reabre ({concluida: false}). O responsável pode concluir mesmo sem editar o documento. */
pendenciasRouter.patch("/:id", async (req, res) => {
  const { db } = ctx(req);
  const { id } = idParam.parse(req.params);
  const { concluida, ...campos } = pendenciaSchema.partial().extend({ concluida: z.boolean().optional() }).parse(req.body);
  const alteracoes: Record<string, unknown> = Object.fromEntries(Object.entries(campos).filter(([, v]) => v !== undefined));
  if (concluida !== undefined) alteracoes.concluida_em = concluida ? new Date().toISOString() : null;
  if (Object.keys(alteracoes).length === 0) throw new HttpError(400, "Nada para alterar.");

  const { data, error } = await db.from("documento_pendencias").update(alteracoes).eq("id", id).select(CAMPOS_PENDENCIA).maybeSingle();
  if (error) throw erroDoBanco(error, "pendência");
  if (!data) throw new HttpError(404, "Pendência não encontrada ou sem permissão.");
  res.json(formatarPendencia(data));
});

pendenciasRouter.delete("/:id", async (req, res) => {
  const { db } = ctx(req);
  const { id } = idParam.parse(req.params);
  const { error, count } = await db.from("documento_pendencias").delete({ count: "exact" }).eq("id", id);
  if (error) throw erroDoBanco(error, "pendência");
  if (!count) throw new HttpError(404, "Pendência não encontrada ou sem permissão.");
  res.status(204).end();
});
