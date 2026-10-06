import { Router } from "express";
import { z } from "zod";
import { ctx } from "../../middleware/auth.js";
import { erroDoBanco } from "../../lib/errors.js";

export const historicoRouter = Router();

const filtros = z.object({
  documento: z.uuid().optional(),
  entidade: z.string().max(40).optional(),
  acao: z.string().max(40).optional(),
  limite: z.coerce.number().int().min(1).max(200).default(50),
});

interface LinhaHistorico {
  id: number;
  ator_id: string | null;
  acao: string;
  entidade: string;
  entidade_id: string | null;
  documento_id: string | null;
  detalhes: Record<string, unknown>;
  criado_em: string;
}

/** Linha do tempo (de um documento ou geral). A RLS limita às categorias do usuário. */
historicoRouter.get("/", async (req, res) => {
  const { db } = ctx(req);
  const f = filtros.parse(req.query);

  let consulta = db
    .from("historico")
    .select("id, ator_id, acao, entidade, entidade_id, documento_id, detalhes, criado_em")
    .order("criado_em", { ascending: false })
    .limit(f.limite);
  if (f.documento) consulta = consulta.eq("documento_id", f.documento);
  if (f.entidade) consulta = consulta.eq("entidade", f.entidade);
  if (f.acao) consulta = consulta.eq("acao", f.acao);

  const { data: linhas, error } = await consulta;
  if (error) throw erroDoBanco(error, "histórico");
  const itens = (linhas ?? []) as LinhaHistorico[];

  // Nome de quem fez cada ação (historico.ator_id aponta para auth.users).
  const atores = [...new Set(itens.map((h) => h.ator_id).filter((id): id is string => Boolean(id)))];
  const nomes = new Map<string, string>();
  if (atores.length > 0) {
    const { data: perfis } = await db.from("perfis").select("id, nome").in("id", atores);
    for (const p of perfis ?? []) nomes.set(p.id as string, p.nome as string);
  }

  res.json({
    itens: itens.map((h) => ({ ...h, ator_nome: h.ator_id ? (nomes.get(h.ator_id) ?? "Usuário removido") : "Sistema" })),
  });
});
