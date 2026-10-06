import { Router } from "express";
import { ctx } from "../../middleware/auth.js";
import { erroDoBanco } from "../../lib/errors.js";

export const dashboardRouter = Router();

const CAMPOS_LISTA =
  "id, titulo, tipo_nome, categoria_caminho, raiz_nome, raiz_icone, raiz_cor, data_documento, data_validade, situacao, dias_para_vencer, mime_type, tamanho_bytes, status_processamento, criado_em, criado_por_nome";

/** Painel: contadores, categorias raiz com totais, documentos recentes e próximos vencimentos. */
dashboardRouter.get("/", async (req, res) => {
  const { db } = ctx(req);

  const [resumo, categorias, contagem, recentes, vencimentos] = await Promise.all([
    db.rpc("resumo_painel"),
    db.from("categorias").select("id, nome, icone, cor, ordem").is("parent_id", null).eq("ativo", true).order("ordem"),
    db.rpc("contagem_por_categoria"),
    db.from("v_documentos").select(CAMPOS_LISTA).order("criado_em", { ascending: false }).limit(6),
    db
      .from("v_documentos")
      .select(CAMPOS_LISTA)
      .in("situacao", ["a_vencer", "vencido"])
      .order("data_validade")
      .limit(6),
  ]);

  for (const r of [resumo, categorias, contagem, recentes, vencimentos]) {
    if (r.error) throw erroDoBanco(r.error, "painel");
  }

  const totais = new Map(((contagem.data ?? []) as { categoria_id: string; total: number }[]).map((c) => [c.categoria_id, Number(c.total)]));
  res.json({
    resumo: resumo.data,
    categorias: (categorias.data ?? []).map((c) => ({ ...c, total: totais.get(c.id as string) ?? 0 })),
    recentes: recentes.data,
    vencimentos: vencimentos.data,
  });
});
