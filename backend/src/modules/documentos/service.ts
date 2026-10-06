import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { garantirEdicao } from "../../middleware/auth.js";
import { erroDoBanco, HttpError } from "../../lib/errors.js";
import { dataOpcional, textoOpcional, uuidOpcional } from "../../lib/http.js";
import { logger } from "../../lib/logger.js";
import { enviarArquivo, removerArquivo } from "../../lib/s3.js";
import { supabaseAdmin } from "../../lib/supabase.js";
import { filaProcessamento } from "../../processing/fila.js";
import { STATUS_DOCUMENTO, type CampoPersonalizado } from "../../types/dominio.js";
import type { ContextoAuth } from "../../types/express.js";
import { gerarStorageKey, nomeOriginal, resolverMime, sha256 } from "./arquivos.js";
import { validarMetadados } from "./metadados.js";

/** Campos JSON enviados como texto no multipart (metadados, tags). */
const jsonEmTexto = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => {
    if (typeof v !== "string") return v;
    if (v.trim() === "") return undefined;
    try {
      return JSON.parse(v);
    } catch {
      return v; // deixa o schema acusar o erro
    }
  }, schema);

export const dadosDocumentoSchema = z.object({
  titulo: z.string().trim().max(300).optional(),
  descricao: textoOpcional,
  tipo_id: z.uuid({ error: "Selecione o tipo de documento." }),
  categoria_id: z.uuid({ error: "Selecione a categoria." }),
  empresa_id: uuidOpcional,
  filial_id: uuidOpcional,
  setor_id: uuidOpcional,
  contraparte_id: uuidOpcional,
  responsavel_id: uuidOpcional,
  data_documento: dataOpcional,
  data_validade: dataOpcional,
  status: z.enum(STATUS_DOCUMENTO).optional(),
  metadados: jsonEmTexto(z.record(z.string(), z.unknown())).optional(),
  tags: jsonEmTexto(z.array(z.uuid()).max(20)).optional(),
});

export type DadosDocumento = z.infer<typeof dadosDocumentoSchema>;

interface TipoComCampos {
  id: string;
  nome: string;
  campos: CampoPersonalizado[];
  exige_validade: boolean;
  ativo: boolean;
}

interface CategoriaDestino {
  id: string;
  nome: string;
  raiz_id: string;
  raiz_nome: string;
}

export async function carregarTipo(db: SupabaseClient, id: string): Promise<TipoComCampos> {
  const { data, error } = await db.from("tipos_documento").select("id, nome, campos, exige_validade, ativo").eq("id", id).maybeSingle();
  if (error) throw erroDoBanco(error, "tipo de documento");
  if (!data) throw new HttpError(400, "Tipo de documento inválido.");
  return data as TipoComCampos;
}

/** Categoria de destino (a RLS só devolve categorias das árvores liberadas ao usuário). */
export async function carregarCategoria(db: SupabaseClient, id: string): Promise<CategoriaDestino> {
  const { data, error } = await db.from("categorias").select("id, nome, raiz_id, ativo").eq("id", id).maybeSingle();
  if (error) throw erroDoBanco(error, "categoria");
  if (!data) throw new HttpError(400, "Categoria não encontrada ou sem acesso.");
  if (!data.ativo) throw new HttpError(400, "Esta categoria está desativada.");

  // Nome da raiz (para a pasta no MinIO e mensagens). O embed da tabela com ela mesma
  // não é resolvido pelo PostgREST, então são duas consultas simples.
  let raizNome = data.nome as string;
  if (data.raiz_id !== data.id) {
    const { data: raiz, error: erroRaiz } = await db.from("categorias").select("nome").eq("id", data.raiz_id as string).maybeSingle();
    if (erroRaiz) throw erroDoBanco(erroRaiz, "categoria");
    raizNome = (raiz?.nome as string | undefined) ?? raizNome;
  }
  return { id: data.id as string, nome: data.nome as string, raiz_id: data.raiz_id as string, raiz_nome: raizNome };
}

export const CAMPOS_DOCUMENTO =
  "id, titulo, descricao, tipo_id, categoria_id, raiz_id, empresa_id, filial_id, setor_id, contraparte_id, responsavel_id, data_documento, data_validade, status, metadados, versao_atual, nome_arquivo, mime_type, tamanho_bytes, status_processamento, criado_em";

/**
 * Upload (fluxo da arquitetura):
 *   valida classificação e campos do tipo → grava o arquivo no MinIO → grava metadados +
 *   storage_key no Supabase (versão 1 + tags) → enfileira o processamento (texto, chunks, embeddings).
 */
export async function criarDocumento(
  auth: ContextoAuth,
  arquivo: Express.Multer.File | undefined,
  dados: DadosDocumento,
): Promise<Record<string, unknown>> {
  if (!arquivo || arquivo.size === 0) throw new HttpError(400, "Selecione um arquivo para enviar.");
  const { db, perfil } = auth;

  const [tipo, categoria] = await Promise.all([carregarTipo(db, dados.tipo_id), carregarCategoria(db, dados.categoria_id)]);
  garantirEdicao(perfil, categoria.raiz_id, `"${categoria.raiz_nome}"`);
  if (!tipo.ativo) throw new HttpError(400, `O tipo "${tipo.nome}" está desativado.`);
  if (tipo.exige_validade && !dados.data_validade) throw new HttpError(400, `Informe a data de validade (${tipo.nome}).`);
  const metadados = validarMetadados(tipo.campos, dados.metadados);

  const nomeArquivo = nomeOriginal(arquivo.originalname);
  const mime = resolverMime(nomeArquivo, arquivo.mimetype);
  const hash = sha256(arquivo.buffer);
  await garantirArquivoInedito(db, categoria.raiz_id, hash);

  const storageKey = gerarStorageKey(categoria.raiz_nome, nomeArquivo);
  await enviarArquivo(storageKey, arquivo.buffer, mime, hash);

  let documentoId: string | null = null;
  try {
    const { data, error } = await db
      .from("documentos")
      .insert({
        titulo: dados.titulo || nomeArquivo.replace(/\.[^.]+$/, ""),
        descricao: dados.descricao ?? null,
        tipo_id: tipo.id,
        categoria_id: categoria.id,
        empresa_id: dados.empresa_id ?? null,
        filial_id: dados.filial_id ?? null,
        setor_id: dados.setor_id ?? null,
        contraparte_id: dados.contraparte_id ?? null,
        responsavel_id: dados.responsavel_id ?? auth.userId,
        data_documento: dados.data_documento ?? null,
        data_validade: dados.data_validade ?? null,
        status: dados.status ?? "ativo",
        metadados,
        versao_atual: 1,
        storage_key: storageKey,
        nome_arquivo: nomeArquivo,
        mime_type: mime,
        tamanho_bytes: arquivo.size,
        sha256: hash,
      })
      .select(CAMPOS_DOCUMENTO)
      .single();
    if (error) throw erroDoBanco(error, "documento");
    documentoId = data.id as string;

    const { error: erroVersao } = await db.from("documento_versoes").insert({
      documento_id: documentoId,
      versao: 1,
      storage_key: storageKey,
      nome_arquivo: nomeArquivo,
      mime_type: mime,
      tamanho_bytes: arquivo.size,
      sha256: hash,
    });
    if (erroVersao) throw erroDoBanco(erroVersao, "versão do documento");

    if (dados.tags?.length) await definirTags(db, documentoId, dados.tags);

    filaProcessamento.adicionar(documentoId);
    return data;
  } catch (err) {
    // Não deixa registro pela metade nem arquivo órfão no MinIO.
    if (documentoId) await supabaseAdmin.from("documentos").delete().eq("id", documentoId);
    await removerArquivo(storageKey).catch((e) => logger.warn({ err: e, storageKey }, "falha ao remover arquivo órfão"));
    throw err;
  }
}

/** Alteração de metadados, tags e movimentação entre categorias. */
export async function atualizarDocumento(auth: ContextoAuth, id: string, dados: Partial<DadosDocumento>): Promise<Record<string, unknown>> {
  const { db, perfil } = auth;
  const atual = await carregarDocumento(db, id);
  garantirEdicao(perfil, atual.raiz_id);

  const alteracoes: Record<string, unknown> = {};
  for (const campo of ["titulo", "descricao", "empresa_id", "filial_id", "setor_id", "contraparte_id", "responsavel_id", "data_documento", "data_validade", "status"] as const) {
    if (dados[campo] !== undefined) alteracoes[campo] = dados[campo];
  }
  if (alteracoes.titulo === "") delete alteracoes.titulo;

  // Mover para outra categoria exige poder editar também no destino.
  if (dados.categoria_id && dados.categoria_id !== atual.categoria_id) {
    const destino = await carregarCategoria(db, dados.categoria_id);
    garantirEdicao(perfil, destino.raiz_id, `"${destino.raiz_nome}"`);
    alteracoes.categoria_id = destino.id;
  }

  // Tipo e campos personalizados são validados juntos.
  const tipoId = dados.tipo_id ?? atual.tipo_id;
  if (dados.tipo_id !== undefined || dados.metadados !== undefined || dados.data_validade !== undefined) {
    const tipo = await carregarTipo(db, tipoId);
    const validade = dados.data_validade !== undefined ? dados.data_validade : atual.data_validade;
    if (tipo.exige_validade && !validade) throw new HttpError(400, `Informe a data de validade (${tipo.nome}).`);
    if (dados.tipo_id !== undefined || dados.metadados !== undefined) {
      alteracoes.tipo_id = tipo.id;
      alteracoes.metadados = validarMetadados(tipo.campos, dados.metadados ?? atual.metadados);
    }
  }

  if (Object.keys(alteracoes).length > 0) {
    const { error } = await db.from("documentos").update(alteracoes).eq("id", id);
    if (error) throw erroDoBanco(error, "documento");
  }
  if (dados.tags !== undefined) await definirTags(db, id, dados.tags ?? []);

  const { data, error } = await db.from("documentos").select(CAMPOS_DOCUMENTO).eq("id", id).single();
  if (error) throw erroDoBanco(error, "documento");
  return data;
}

/** Substitui o arquivo: guarda a versão anterior e reprocessa o texto. */
export async function substituirArquivo(
  auth: ContextoAuth,
  id: string,
  arquivo: Express.Multer.File | undefined,
  comentario: string | null,
): Promise<Record<string, unknown>> {
  if (!arquivo || arquivo.size === 0) throw new HttpError(400, "Selecione o novo arquivo.");
  const { db, perfil } = auth;
  const atual = await carregarDocumento(db, id);
  garantirEdicao(perfil, atual.raiz_id);

  const nomeArquivo = nomeOriginal(arquivo.originalname);
  const mime = resolverMime(nomeArquivo, arquivo.mimetype);
  const hash = sha256(arquivo.buffer);
  if (hash === atual.sha256) throw new HttpError(409, "O arquivo enviado é idêntico à versão atual.");
  await garantirArquivoInedito(db, atual.raiz_id, hash, id);

  const categoria = await carregarCategoria(db, atual.categoria_id);
  const storageKey = gerarStorageKey(categoria.raiz_nome, nomeArquivo);
  await enviarArquivo(storageKey, arquivo.buffer, mime, hash);

  const versao = atual.versao_atual + 1;
  const { error: erroVersao } = await db.from("documento_versoes").insert({
    documento_id: id,
    versao,
    storage_key: storageKey,
    nome_arquivo: nomeArquivo,
    mime_type: mime,
    tamanho_bytes: arquivo.size,
    sha256: hash,
    comentario,
  });
  if (erroVersao) {
    await removerArquivo(storageKey).catch(() => undefined);
    throw erroDoBanco(erroVersao, "versão do documento");
  }

  const { data, error } = await db
    .from("documentos")
    .update({
      versao_atual: versao,
      storage_key: storageKey,
      nome_arquivo: nomeArquivo,
      mime_type: mime,
      tamanho_bytes: arquivo.size,
      sha256: hash,
      status_processamento: "pendente",
      erro_processamento: null,
    })
    .eq("id", id)
    .select(CAMPOS_DOCUMENTO)
    .single();
  if (error) throw erroDoBanco(error, "documento");

  filaProcessamento.adicionar(id);
  return data;
}

interface DocumentoAtual {
  id: string;
  raiz_id: string;
  categoria_id: string;
  tipo_id: string;
  data_validade: string | null;
  metadados: Record<string, unknown>;
  versao_atual: number;
  sha256: string;
}

export async function carregarDocumento(db: SupabaseClient, id: string, incluirLixeira = false): Promise<DocumentoAtual> {
  let consulta = db
    .from("documentos")
    .select("id, raiz_id, categoria_id, tipo_id, data_validade, metadados, versao_atual, sha256")
    .eq("id", id);
  if (!incluirLixeira) consulta = consulta.is("excluido_em", null);
  const { data, error } = await consulta.maybeSingle();
  if (error) throw erroDoBanco(error, "documento");
  if (!data) throw new HttpError(404, "Documento não encontrado.");
  return data as DocumentoAtual;
}

/** Substitui o conjunto de tags do documento (o histórico registra cada inclusão/remoção). */
async function definirTags(db: SupabaseClient, documentoId: string, tags: string[]): Promise<void> {
  const { data: atuais, error } = await db.from("documento_tags").select("tag_id").eq("documento_id", documentoId);
  if (error) throw erroDoBanco(error, "tags");
  const existentes = new Set((atuais ?? []).map((t) => t.tag_id as string));
  const desejadas = new Set(tags);

  const remover = [...existentes].filter((t) => !desejadas.has(t));
  const incluir = [...desejadas].filter((t) => !existentes.has(t));
  if (remover.length) {
    const { error: e } = await db.from("documento_tags").delete().eq("documento_id", documentoId).in("tag_id", remover);
    if (e) throw erroDoBanco(e, "tags");
  }
  if (incluir.length) {
    const { error: e } = await db.from("documento_tags").insert(incluir.map((tag_id) => ({ documento_id: documentoId, tag_id })));
    if (e) throw erroDoBanco(e, "tag");
  }
}

async function garantirArquivoInedito(db: SupabaseClient, raizId: string, hash: string, ignorarId?: string): Promise<void> {
  let consulta = db.from("documentos").select("id, titulo").eq("raiz_id", raizId).eq("sha256", hash).is("excluido_em", null);
  if (ignorarId) consulta = consulta.neq("id", ignorarId);
  const { data } = await consulta.limit(1).maybeSingle();
  if (data) throw new HttpError(409, `Este arquivo já está cadastrado como "${data.titulo as string}".`);
}
