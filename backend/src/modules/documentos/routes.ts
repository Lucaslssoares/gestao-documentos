import { Router } from "express";
import { pipeline } from "node:stream/promises";
import { z } from "zod";
import { ctx, exigirPapel, garantirEdicao, garantirExclusao, podeEditar, podeExcluir } from "../../middleware/auth.js";
import { erroDoBanco, HttpError } from "../../lib/errors.js";
import { dataIso, idParam, paginacaoSchema } from "../../lib/http.js";
import { logger } from "../../lib/logger.js";
import { abrirArquivo, removerArquivo } from "../../lib/s3.js";
import { filaProcessamento } from "../../processing/fila.js";
import { SITUACOES_DOCUMENTO } from "../../types/dominio.js";
import { hojeLocal } from "../../alertas/agendador.js";
import { sugerirClassificacao } from "../../ai/sugerir.js";
import { registrarEvento } from "../historico/service.js";
import { CAMPOS_PENDENCIA, criarPendencia, formatarPendencia } from "../pendencias/routes.js";
import { receberArquivo } from "./arquivos.js";
import { pontosDeAtencao, type DocumentoParaAtencao } from "./atencao.js";
import { gerarCsvListaMestra, type LinhaListaMestra } from "./lista-mestra.js";
import {
  atualizarDocumento,
  carregarDocumento,
  criarDocumento,
  dadosDocumentoSchema,
  decidirAprovacao,
  registrarRevisao,
  substituirArquivo,
} from "./service.js";

export const documentosRouter = Router();

const listaDeIds = z
  .string()
  .transform((v) => v.split(",").filter(Boolean))
  .pipe(z.array(z.uuid()).max(20));

const filtros = paginacaoSchema.extend({
  q: z.string().max(200).optional(),
  categoria: z.uuid().optional(),
  tipo: z.uuid().optional(),
  empresa: z.uuid().optional(),
  contraparte: z.uuid().optional(),
  filial: z.uuid().optional(),
  setor: z.uuid().optional(),
  responsavel: z.uuid().optional(),
  tags: listaDeIds.optional(),
  situacao: z.enum(SITUACOES_DOCUMENTO).optional(),
  data_de: dataIso.optional(),
  data_ate: dataIso.optional(),
  validade_de: dataIso.optional(),
  validade_ate: dataIso.optional(),
  ordem: z.enum(["relevancia", "recentes", "validade", "nome"]).optional(),
});

/** Filtros da tela → parâmetros de pesquisar_documentos (sem paginação). */
function parametrosPesquisa(f: z.infer<typeof filtros>) {
  return {
    p_termo: f.q ?? null,
    p_categoria: f.categoria ?? null,
    p_tipo: f.tipo ?? null,
    // "empresa" na tela = empresa do grupo OU contraparte (fornecedor/cliente) do documento.
    p_empresa_ou_contraparte: f.empresa ?? null,
    p_contraparte: f.contraparte ?? null,
    p_filial: f.filial ?? null,
    p_setor: f.setor ?? null,
    p_responsavel: f.responsavel ?? null,
    p_tags: f.tags?.length ? f.tags : null,
    p_situacao: f.situacao ?? null,
    p_data_de: f.data_de ?? null,
    p_data_ate: f.data_ate ?? null,
    p_validade_de: f.validade_de ?? null,
    p_validade_ate: f.validade_ate ?? null,
    p_ordem: f.ordem ?? null,
  };
}

/** Pesquisa: palavras (metadados + conteúdo do arquivo) e filtros. */
documentosRouter.get("/", async (req, res) => {
  const { db } = ctx(req);
  const f = filtros.parse(req.query);
  const { data, error } = await db.rpc("pesquisar_documentos", {
    ...parametrosPesquisa(f),
    p_limite: f.por_pagina,
    p_deslocamento: (f.pagina - 1) * f.por_pagina,
  });
  if (error) throw erroDoBanco(error, "documento");
  res.json(data);
});

/** Lista mestra (CSV) com os mesmos filtros da pesquisa, até 5.000 documentos. */
documentosRouter.get("/lista-mestra", async (req, res) => {
  const { db, userId } = ctx(req);
  const f = filtros.parse(req.query);
  const linhas: LinhaListaMestra[] = [];
  for (let deslocamento = 0; deslocamento < 5000; deslocamento += 100) {
    const { data, error } = await db.rpc("pesquisar_documentos", {
      ...parametrosPesquisa(f),
      p_ordem: f.ordem ?? "nome",
      p_limite: 100,
      p_deslocamento: deslocamento,
    });
    if (error) throw erroDoBanco(error, "documento");
    const pagina = (data as { itens: LinhaListaMestra[] }).itens;
    linhas.push(...pagina);
    if (pagina.length < 100) break;
  }

  void registrarEvento({ atorId: userId, acao: "exportar_lista_mestra", entidade: "documento", detalhes: { quantidade: linhas.length, filtros: req.query } });
  const nome = `lista-mestra-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${nome}"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.send(gerarCsvListaMestra(linhas));
});

/** Lixeira: documentos excluídos que o usuário pode restaurar (gestor/admin). */
documentosRouter.get("/lixeira", exigirPapel("admin", "gestor"), async (req, res) => {
  const { db, perfil } = ctx(req);
  const { data, error } = await db
    .from("documentos")
    .select("id, titulo, nome_arquivo, raiz_id, excluido_em, excluido_por, tipos_documento(nome), categorias!documentos_categoria_id_fkey(nome)")
    .not("excluido_em", "is", null)
    .order("excluido_em", { ascending: false })
    .limit(200);
  if (error) throw erroDoBanco(error, "documento");
  res.json({ itens: (data ?? []).filter((d) => podeExcluir(perfil, d.raiz_id as string)) });
});

documentosRouter.get("/:id", async (req, res) => {
  const { db, perfil, userId } = ctx(req);
  const { id } = idParam.parse(req.params);

  const [documento, versoes, pendencias] = await Promise.all([
    db.from("v_documentos").select("*").eq("id", id).maybeSingle(),
    db
      .from("documento_versoes")
      .select("id, versao, nome_arquivo, mime_type, tamanho_bytes, comentario, enviado_por, enviado_em")
      .eq("documento_id", id)
      .order("versao", { ascending: false }),
    db
      .from("documento_pendencias")
      .select(CAMPOS_PENDENCIA)
      .eq("documento_id", id)
      .order("concluida_em", { ascending: false, nullsFirst: true })
      .order("prazo", { ascending: true, nullsFirst: false }),
  ]);
  if (documento.error) throw erroDoBanco(documento.error, "documento");
  if (!documento.data) throw new HttpError(404, "Documento não encontrado.");
  if (versoes.error) throw erroDoBanco(versoes.error, "versão");
  if (pendencias.error) throw erroDoBanco(pendencias.error, "pendência");

  const { data: tipo, error: erroTipo } = await db
    .from("tipos_documento")
    .select("id, nome, campos, exige_validade, exige_aprovacao, revisao_meses, config")
    .eq("id", documento.data.tipo_id as string)
    .single();
  if (erroTipo) throw erroDoBanco(erroTipo, "tipo de documento");

  const raiz = documento.data.raiz_id as string;
  const listaPendencias = (pendencias.data ?? []).map(formatarPendencia);
  const doc = documento.data as unknown as DocumentoParaAtencao & { aprovador_id: string | null };
  res.json({
    ...documento.data,
    tipo,
    versoes: versoes.data,
    pendencias: listaPendencias,
    atencao: pontosDeAtencao({ ...doc, tipo: tipo as DocumentoParaAtencao["tipo"], pendencias: listaPendencias as unknown as DocumentoParaAtencao["pendencias"] }, hojeLocal()),
    permissoes: {
      editar: podeEditar(perfil, raiz),
      excluir: podeExcluir(perfil, raiz),
      aprovar: doc.aprovacao === "pendente" && (doc.aprovador_id === userId || perfil.papel === "admin"),
    },
  });
});

/** Nova pendência (prazo, condicionante, entrega...) no documento. */
documentosRouter.post("/:id/pendencias", async (req, res) => {
  const auth = ctx(req);
  const { id } = idParam.parse(req.params);
  res.status(201).json(await criarPendencia(auth, id, req.body));
});

/** Decisão de aprovação: {decisao: "aprovar" | "reprovar", comentario}. */
documentosRouter.post("/:id/aprovar", async (req, res) => {
  const auth = ctx(req);
  const { id } = idParam.parse(req.params);
  const { decisao, comentario } = z
    .object({ decisao: z.enum(["aprovar", "reprovar"]), comentario: z.string().trim().max(1000).optional() })
    .parse(req.body);
  res.json(await decidirAprovacao(auth, id, decisao, comentario || null));
});

/** Registra a revisão periódica feita hoje. */
documentosRouter.post("/:id/revisar", async (req, res) => {
  const auth = ctx(req);
  const { id } = idParam.parse(req.params);
  res.json(await registrarRevisao(auth, id));
});

/** "Preencher com IA": lê o arquivo (ainda não salvo) e sugere a classificação para o usuário conferir. */
documentosRouter.post("/sugerir", receberArquivo, async (req, res) => {
  res.json(await sugerirClassificacao(ctx(req), req.file));
});

/** Upload: multipart/form-data com o campo "arquivo" + classificação do documento. */
documentosRouter.post("/", receberArquivo, async (req, res) => {
  const auth = ctx(req);
  const dados = dadosDocumentoSchema.parse(req.body ?? {});
  const documento = await criarDocumento(auth, req.file, dados);
  res.status(201).json(documento);
});

documentosRouter.patch("/:id", async (req, res) => {
  const auth = ctx(req);
  const { id } = idParam.parse(req.params);
  const dados = dadosDocumentoSchema.partial().parse(req.body);
  res.json(await atualizarDocumento(auth, id, dados));
});

/** Substituição do arquivo (nova versão; as anteriores continuam disponíveis). */
documentosRouter.post("/:id/versoes", receberArquivo, async (req, res) => {
  const auth = ctx(req);
  const { id } = idParam.parse(req.params);
  const { comentario } = z.object({ comentario: z.string().trim().max(500).optional() }).parse(req.body ?? {});
  res.status(201).json(await substituirArquivo(auth, id, req.file, comentario || null));
});

/**
 * Visualização/download do arquivo (versão atual ou ?versao=N). O backend confere a
 * permissão (RLS), registra o acesso no histórico e faz o streaming a partir do MinIO —
 * o storage não fica exposto na internet.
 */
documentosRouter.get("/:id/arquivo", async (req, res) => {
  const { db, userId } = ctx(req);
  const { id } = idParam.parse(req.params);
  const { versao, download } = z
    .object({ versao: z.coerce.number().int().min(1).optional(), download: z.enum(["0", "1"]).optional() })
    .parse(req.query);
  const baixar = download === "1";

  const { data: doc, error } = await db
    .from("documentos")
    .select("id, raiz_id, titulo, storage_key, nome_arquivo, mime_type, versao_atual")
    .eq("id", id)
    .is("excluido_em", null)
    .maybeSingle();
  if (error) throw erroDoBanco(error, "documento");
  if (!doc) throw new HttpError(404, "Documento não encontrado.");

  let arquivo = { storage_key: doc.storage_key as string, nome_arquivo: doc.nome_arquivo as string, mime_type: doc.mime_type as string };
  if (versao && versao !== doc.versao_atual) {
    const { data: v, error: erroVersao } = await db
      .from("documento_versoes")
      .select("storage_key, nome_arquivo, mime_type")
      .eq("documento_id", id)
      .eq("versao", versao)
      .maybeSingle();
    if (erroVersao) throw erroDoBanco(erroVersao, "versão");
    if (!v) throw new HttpError(404, "Versão não encontrada.");
    arquivo = v as typeof arquivo;
  }

  const { stream, tamanho } = await abrirArquivo(arquivo.storage_key);
  res.setHeader("Content-Type", arquivo.mime_type);
  if (tamanho) res.setHeader("Content-Length", String(tamanho));
  res.setHeader(
    "Content-Disposition",
    `${baixar ? "attachment" : "inline"}; filename="${arquivo.nome_arquivo.replace(/[^\x20-\x7e]|"/g, "_")}"; filename*=UTF-8''${encodeURIComponent(arquivo.nome_arquivo)}`,
  );
  res.setHeader("Cache-Control", "private, no-store");

  void registrarEvento({
    atorId: userId,
    acao: baixar ? "baixar" : "visualizar",
    entidade: "documento",
    entidadeId: id,
    documentoId: id,
    raizId: doc.raiz_id as string,
    detalhes: { arquivo: arquivo.nome_arquivo, versao: versao ?? doc.versao_atual },
  });

  await pipeline(stream, res);
});

/** Exclusão lógica: vai para a lixeira (gestor/admin da categoria). */
documentosRouter.delete("/:id", async (req, res) => {
  const { db, perfil } = ctx(req);
  const { id } = idParam.parse(req.params);
  const doc = await carregarDocumento(db, id);
  garantirExclusao(perfil, doc.raiz_id);
  const { error } = await db.from("documentos").update({ excluido_em: new Date().toISOString() }).eq("id", id);
  if (error) throw erroDoBanco(error, "documento");
  res.status(204).end();
});

documentosRouter.post("/:id/restaurar", async (req, res) => {
  const { db, perfil } = ctx(req);
  const { id } = idParam.parse(req.params);
  const doc = await carregarDocumento(db, id, true);
  garantirExclusao(perfil, doc.raiz_id);
  const { error } = await db.from("documentos").update({ excluido_em: null }).eq("id", id);
  if (error) {
    // Ao restaurar, outro documento ativo pode ter o mesmo arquivo.
    if (error.code === "23505") throw new HttpError(409, "Já existe um documento ativo com o mesmo arquivo nesta categoria.");
    throw erroDoBanco(error, "documento");
  }
  res.json({ id, restaurado: true });
});

/** Exclusão definitiva (somente admin): apaga o registro, todas as versões e os arquivos no MinIO. */
documentosRouter.delete("/:id/definitivo", exigirPapel("admin"), async (req, res) => {
  const { db } = ctx(req);
  const { id } = idParam.parse(req.params);
  const { data: versoes, error: erroVersoes } = await db.from("documento_versoes").select("storage_key").eq("documento_id", id);
  if (erroVersoes) throw erroDoBanco(erroVersoes, "documento");

  const { error, count } = await db.from("documentos").delete({ count: "exact" }).eq("id", id);
  if (error) throw erroDoBanco(error, "documento");
  if (!count) throw new HttpError(404, "Documento não encontrado.");

  for (const { storage_key } of versoes ?? []) {
    await removerArquivo(storage_key as string).catch((err) => logger.warn({ err, id }, "arquivo não removido do storage"));
  }
  res.status(204).end();
});

/** Reenvia o documento ao pipeline (ex.: após falha nos embeddings). */
documentosRouter.post("/:id/reprocessar", async (req, res) => {
  const { db, perfil } = ctx(req);
  const { id } = idParam.parse(req.params);
  const doc = await carregarDocumento(db, id);
  garantirEdicao(perfil, doc.raiz_id);

  const { error } = await db.from("documentos").update({ status_processamento: "pendente", erro_processamento: null }).eq("id", id);
  if (error) throw erroDoBanco(error, "documento");
  filaProcessamento.adicionar(id);
  res.status(202).json({ id, status_processamento: "pendente" });
});
