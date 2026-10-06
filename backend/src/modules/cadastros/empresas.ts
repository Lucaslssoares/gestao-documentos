import { Router } from "express";
import { z } from "zod";
import { ctx, exigirPapel } from "../../middleware/auth.js";
import { erroDoBanco, HttpError } from "../../lib/errors.js";
import { idParam, intervalo, paginacaoSchema, somenteDigitos, termoSeguro, textoOpcional } from "../../lib/http.js";
import { TIPOS_EMPRESA } from "../../types/dominio.js";

export const empresasRouter = Router();

const cnpj = z
  .string()
  .transform(somenteDigitos)
  .refine((v) => v === "" || v.length === 14, { error: "CNPJ deve ter 14 dígitos." })
  .refine((v) => v === "" || cnpjValido(v), { error: "CNPJ inválido (dígitos verificadores não conferem)." })
  .transform((v) => (v === "" ? null : v))
  .nullish();

const empresaSchema = z.object({
  razao_social: z.string().trim().min(2, { error: "Informe a razão social." }).max(200),
  nome_fantasia: textoOpcional,
  cnpj,
  tipo: z.enum(TIPOS_EMPRESA).default("fornecedor"),
  email: z
    .union([z.email({ error: "E-mail inválido." }), z.literal("")])
    .transform((v) => (v === "" ? null : v))
    .nullish(),
  telefone: textoOpcional,
  ativo: z.boolean().optional(),
});

const filtros = paginacaoSchema.extend({
  q: z.string().optional(),
  tipo: z.enum(TIPOS_EMPRESA).optional(),
  por_pagina: z.coerce.number().int().min(1).max(500).default(100),
});

const CAMPOS = "id, razao_social, nome_fantasia, cnpj, tipo, email, telefone, ativo, filiais(id, nome, codigo, cidade, uf, ativo)";

empresasRouter.get("/", async (req, res) => {
  const { db } = ctx(req);
  const f = filtros.parse(req.query);
  const [de, ate] = intervalo(f);

  let consulta = db.from("empresas").select(CAMPOS, { count: "exact" }).order("razao_social").range(de, ate);
  if (f.tipo) consulta = consulta.eq("tipo", f.tipo);
  if (f.q) {
    const termo = termoSeguro(f.q);
    const digitos = somenteDigitos(f.q);
    const condicoes = [`razao_social.ilike.*${termo}*`, `nome_fantasia.ilike.*${termo}*`];
    if (digitos.length >= 4) condicoes.push(`cnpj.like.*${digitos}*`);
    if (termo) consulta = consulta.or(condicoes.join(","));
  }

  const { data, error, count } = await consulta;
  if (error) throw erroDoBanco(error, "empresa");
  res.json({ itens: data, total: count ?? 0 });
});

empresasRouter.post("/", exigirPapel("admin", "gestor", "editor"), async (req, res) => {
  const { db } = ctx(req);
  const dados = empresaSchema.parse(req.body);
  const { data, error } = await db.from("empresas").insert(dados).select(CAMPOS).single();
  if (error) throw erroDoBanco(error, "empresa com este CNPJ");
  res.status(201).json(data);
});

empresasRouter.patch("/:id", exigirPapel("admin", "gestor", "editor"), async (req, res) => {
  const { db } = ctx(req);
  const { id } = idParam.parse(req.params);
  const dados = empresaSchema.partial().parse(req.body);
  const { data, error } = await db.from("empresas").update(dados).eq("id", id).select(CAMPOS).single();
  if (error) throw erroDoBanco(error, "empresa");
  res.json(data);
});

empresasRouter.delete("/:id", exigirPapel("admin"), async (req, res) => {
  const { db } = ctx(req);
  const { id } = idParam.parse(req.params);
  const { error, count } = await db.from("empresas").delete({ count: "exact" }).eq("id", id);
  if (error) throw erroDoBanco(error, "empresa");
  if (!count) throw new HttpError(404, "Empresa não encontrada.");
  res.status(204).end();
});

// ---- Filiais (somente admin) ----
const filialSchema = z.object({
  nome: z.string().trim().min(2, { error: "Informe o nome da filial." }).max(120),
  codigo: textoOpcional,
  cidade: textoOpcional,
  uf: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, { error: "UF com 2 letras." })
    .nullish()
    .or(z.literal("").transform(() => null)),
  ativo: z.boolean().optional(),
});

empresasRouter.post("/:id/filiais", exigirPapel("admin"), async (req, res) => {
  const { db } = ctx(req);
  const { id } = idParam.parse(req.params);
  const dados = filialSchema.parse(req.body);
  const { data, error } = await db.from("filiais").insert({ ...dados, empresa_id: id }).select().single();
  if (error) throw erroDoBanco(error, "filial com este nome");
  res.status(201).json(data);
});

empresasRouter.patch("/:id/filiais/:filialId", exigirPapel("admin"), async (req, res) => {
  const { db } = ctx(req);
  const { id, filialId } = z.object({ id: z.uuid(), filialId: z.uuid() }).parse(req.params);
  const dados = filialSchema.partial().parse(req.body);
  const { data, error } = await db.from("filiais").update(dados).eq("id", filialId).eq("empresa_id", id).select().single();
  if (error) throw erroDoBanco(error, "filial");
  res.json(data);
});

/** Valida os dígitos verificadores do CNPJ. */
export function cnpjValido(valor: string): boolean {
  const d = somenteDigitos(valor);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (base: string, pesos: number[]) => {
    const soma = pesos.reduce((acc, peso, i) => acc + Number(base[i]) * peso, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const dv1 = calc(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const dv2 = calc(d.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return dv1 === Number(d[12]) && dv2 === Number(d[13]);
}
