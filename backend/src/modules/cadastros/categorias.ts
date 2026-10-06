import { Router } from "express";
import { z } from "zod";
import { ctx, exigirPapel } from "../../middleware/auth.js";
import { erroDoBanco, HttpError } from "../../lib/errors.js";
import { idParam, textoOpcional, uuidOpcional } from "../../lib/http.js";

export const categoriasRouter = Router();

interface LinhaCategoria {
  id: string;
  parent_id: string | null;
  raiz_id: string;
  nivel: number;
  nome: string;
  descricao: string | null;
  icone: string | null;
  cor: string | null;
  ordem: number;
  ativo: boolean;
}

export interface NoCategoria extends LinhaCategoria {
  total: number;
  filhos: NoCategoria[];
}

/** Monta a árvore a partir da lista plana (ordenada por ordem/nome). */
export function montarArvore(linhas: LinhaCategoria[], totais: Map<string, number>): NoCategoria[] {
  const nos = new Map<string, NoCategoria>(linhas.map((l) => [l.id, { ...l, total: totais.get(l.id) ?? 0, filhos: [] }]));
  const raizes: NoCategoria[] = [];
  for (const no of nos.values()) {
    const pai = no.parent_id ? nos.get(no.parent_id) : undefined;
    if (pai) pai.filhos.push(no);
    else raizes.push(no);
  }
  return raizes;
}

/** Árvore de categorias visíveis ao usuário, com a quantidade de documentos em cada uma. */
categoriasRouter.get("/", async (req, res) => {
  const { db } = ctx(req);
  const incluirInativas = req.query.inativas === "1";

  let consulta = db
    .from("categorias")
    .select("id, parent_id, raiz_id, nivel, nome, descricao, icone, cor, ordem, ativo")
    .order("nivel")
    .order("ordem")
    .order("nome");
  if (!incluirInativas) consulta = consulta.eq("ativo", true);

  const [categorias, contagem] = await Promise.all([consulta, db.rpc("contagem_por_categoria")]);
  if (categorias.error) throw erroDoBanco(categorias.error, "categoria");
  if (contagem.error) throw erroDoBanco(contagem.error, "categoria");

  const totais = new Map<string, number>(
    ((contagem.data ?? []) as { categoria_id: string; total: number }[]).map((c) => [c.categoria_id, Number(c.total)]),
  );
  res.json(montarArvore((categorias.data ?? []) as LinhaCategoria[], totais));
});

const categoriaSchema = z.object({
  nome: z.string().trim().min(2, { error: "Informe o nome." }).max(80),
  parent_id: uuidOpcional,
  descricao: textoOpcional,
  icone: z.string().trim().max(40).nullish(),
  cor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, { error: "Cor no formato #RRGGBB." })
    .nullish(),
  ordem: z.coerce.number().int().min(0).max(9999).optional(),
  ativo: z.boolean().optional(),
});

categoriasRouter.post("/", exigirPapel("admin"), async (req, res) => {
  const { db } = ctx(req);
  const dados = categoriaSchema.parse(req.body);
  const { data, error } = await db.from("categorias").insert(dados).select().single();
  if (error) throw erroDoBanco(error, "categoria com este nome neste nível");
  res.status(201).json(data);
});

categoriasRouter.patch("/:id", exigirPapel("admin"), async (req, res) => {
  const { db } = ctx(req);
  const { id } = idParam.parse(req.params);
  const dados = categoriaSchema.partial().parse(req.body);
  const { data, error } = await db.from("categorias").update(dados).eq("id", id).select().single();
  if (error) throw erroDoBanco(error, "categoria");
  res.json(data);
});

categoriasRouter.delete("/:id", exigirPapel("admin"), async (req, res) => {
  const { db } = ctx(req);
  const { id } = idParam.parse(req.params);

  const [{ count: filhas }, { count: documentos }] = await Promise.all([
    db.from("categorias").select("id", { count: "exact", head: true }).eq("parent_id", id),
    db.from("documentos").select("id", { count: "exact", head: true }).eq("categoria_id", id),
  ]);
  if (filhas || documentos) {
    throw new HttpError(409, "A categoria tem subcategorias ou documentos (inclusive na lixeira). Mova-os ou desative a categoria.");
  }

  const { error } = await db.from("categorias").delete().eq("id", id);
  if (error) throw erroDoBanco(error, "categoria");
  res.status(204).end();
});
