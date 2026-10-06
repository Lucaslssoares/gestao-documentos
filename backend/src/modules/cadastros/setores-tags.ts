import { Router } from "express";
import { z } from "zod";
import { ctx, exigirPapel } from "../../middleware/auth.js";
import { erroDoBanco } from "../../lib/errors.js";
import { idParam, textoOpcional } from "../../lib/http.js";

// ---- Setores (áreas responsáveis) ----
export const setoresRouter = Router();

const setorSchema = z.object({
  nome: z.string().trim().min(2, { error: "Informe o nome do setor." }).max(120),
  sigla: textoOpcional,
  ativo: z.boolean().optional(),
});

setoresRouter.get("/", async (req, res) => {
  const { db } = ctx(req);
  let consulta = db.from("setores").select("id, nome, sigla, ativo").order("nome");
  if (req.query.inativos !== "1") consulta = consulta.eq("ativo", true);
  const { data, error } = await consulta;
  if (error) throw erroDoBanco(error, "setor");
  res.json(data);
});

setoresRouter.post("/", exigirPapel("admin"), async (req, res) => {
  const { db } = ctx(req);
  const { data, error } = await db.from("setores").insert(setorSchema.parse(req.body)).select().single();
  if (error) throw erroDoBanco(error, "setor com este nome");
  res.status(201).json(data);
});

setoresRouter.patch("/:id", exigirPapel("admin"), async (req, res) => {
  const { db } = ctx(req);
  const { id } = idParam.parse(req.params);
  const { data, error } = await db.from("setores").update(setorSchema.partial().parse(req.body)).eq("id", id).select().single();
  if (error) throw erroDoBanco(error, "setor");
  res.json(data);
});

// ---- Tags ----
export const tagsRouter = Router();

const tagSchema = z.object({
  nome: z.string().trim().min(1, { error: "Informe o nome da tag." }).max(40),
  cor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, { error: "Cor no formato #RRGGBB." })
    .nullish(),
});

tagsRouter.get("/", async (req, res) => {
  const { db } = ctx(req);
  const { data, error } = await db.from("tags").select("id, nome, cor").order("nome");
  if (error) throw erroDoBanco(error, "tag");
  res.json(data);
});

/** Cria a tag ou devolve a existente com o mesmo nome (sem diferenciar maiúsculas). */
tagsRouter.post("/", exigirPapel("admin", "gestor", "editor"), async (req, res) => {
  const { db } = ctx(req);
  const dados = tagSchema.parse(req.body);
  const { data: existente } = await db.from("tags").select("id, nome, cor").ilike("nome", dados.nome.replace(/[%_\\]/g, "\\$&")).maybeSingle();
  if (existente) {
    res.json(existente);
    return;
  }
  const { data, error } = await db.from("tags").insert(dados).select("id, nome, cor").single();
  if (error) throw erroDoBanco(error, "tag");
  res.status(201).json(data);
});

tagsRouter.patch("/:id", exigirPapel("admin", "gestor"), async (req, res) => {
  const { db } = ctx(req);
  const { id } = idParam.parse(req.params);
  const { data, error } = await db.from("tags").update(tagSchema.partial().parse(req.body)).eq("id", id).select("id, nome, cor").single();
  if (error) throw erroDoBanco(error, "tag com este nome");
  res.json(data);
});

tagsRouter.delete("/:id", exigirPapel("admin", "gestor"), async (req, res) => {
  const { db } = ctx(req);
  const { id } = idParam.parse(req.params);
  const { error } = await db.from("tags").delete().eq("id", id);
  if (error) throw erroDoBanco(error, "tag");
  res.status(204).end();
});
