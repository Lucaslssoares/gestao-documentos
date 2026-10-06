import { Router } from "express";
import { z } from "zod";
import { ctx, exigirPapel } from "../../middleware/auth.js";
import { erroDoBanco } from "../../lib/errors.js";
import { idParam, textoOpcional, uuidOpcional } from "../../lib/http.js";
import { camposSchema } from "../documentos/metadados.js";
import { slug } from "../documentos/arquivos.js";

export const tiposRouter = Router();

const CAMPOS = "id, codigo, nome, descricao, categoria_padrao_id, campos, exige_validade, ativo, ordem";

tiposRouter.get("/", async (req, res) => {
  const { db } = ctx(req);
  let consulta = db.from("tipos_documento").select(CAMPOS).order("ordem").order("nome");
  if (req.query.inativos !== "1") consulta = consulta.eq("ativo", true);
  const { data, error } = await consulta;
  if (error) throw erroDoBanco(error, "tipo de documento");
  res.json(data);
});

const tipoSchema = z.object({
  nome: z.string().trim().min(2, { error: "Informe o nome do tipo." }).max(80),
  codigo: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]{2,40}$/, { error: "Código: letras minúsculas, números e _." })
    .optional(),
  descricao: textoOpcional,
  categoria_padrao_id: uuidOpcional,
  campos: camposSchema.default([]),
  exige_validade: z.boolean().default(false),
  ativo: z.boolean().optional(),
  ordem: z.coerce.number().int().min(0).max(9999).optional(),
});

tiposRouter.post("/", exigirPapel("admin"), async (req, res) => {
  const { db } = ctx(req);
  const dados = tipoSchema.parse(req.body);
  const codigo = dados.codigo ?? slug(dados.nome, 40).replace(/-/g, "_");
  const { data, error } = await db.from("tipos_documento").insert({ ...dados, codigo }).select(CAMPOS).single();
  if (error) throw erroDoBanco(error, "tipo de documento com este código");
  res.status(201).json(data);
});

tiposRouter.patch("/:id", exigirPapel("admin"), async (req, res) => {
  const { db } = ctx(req);
  const { id } = idParam.parse(req.params);
  // O código não muda depois de criado (é usado por integrações e pelo assistente).
  const dados = tipoSchema.omit({ codigo: true }).partial().parse(req.body);
  const { data, error } = await db.from("tipos_documento").update(dados).eq("id", id).select(CAMPOS).single();
  if (error) throw erroDoBanco(error, "tipo de documento");
  res.json(data);
});
