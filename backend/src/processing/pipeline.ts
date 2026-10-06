import { logger } from "../lib/logger.js";
import { lerArquivo } from "../lib/s3.js";
import { supabaseAdmin } from "../lib/supabase.js";
import type { DocumentoArquivo } from "../types/dominio.js";
import { dividirEmTrechos } from "./chunking.js";
import { provedorEmbeddings, type ProvedorEmbeddings } from "./embeddings.js";
import { extrairTexto, temTextoUtil } from "./extrair.js";

const LOTE_INSERCAO = 100;

/**
 * Processamento de documentos (arquitetura):
 *   1. extração de texto (PDF/DOCX/XML) → 2. chunking → 3. embeddings → 4. armazenamento no pgvector
 *
 * Roda com a service role (fora do contexto de um usuário). Se os embeddings falharem,
 * os trechos são gravados mesmo assim (a busca textual continua funcionando) e o
 * documento fica com status "erro" para ser reprocessado.
 */
export async function processarDocumento(id: string, embeddings: ProvedorEmbeddings = provedorEmbeddings): Promise<void> {
  const log = logger.child({ documento: id });

  const { data: doc, error } = await supabaseAdmin
    .from("documentos")
    .select("id, raiz_id, storage_key, mime_type, nome_arquivo, versao_atual")
    .eq("id", id)
    .maybeSingle<DocumentoArquivo>();
  if (error) throw error;
  if (!doc) {
    log.warn("documento não existe mais; processamento ignorado");
    return;
  }

  await atualizar(id, { status_processamento: "processando", erro_processamento: null });

  try {
    const arquivo = await lerArquivo(doc.storage_key);
    const extracao = await extrairTexto(arquivo, doc.mime_type);

    await supabaseAdmin.from("documento_chunks").delete().eq("documento_id", id);

    if (!temTextoUtil(extracao)) {
      await atualizar(id, {
        status_processamento: "sem_texto",
        paginas: extracao.totalPaginas,
        processado_em: new Date().toISOString(),
        erro_processamento: doc.mime_type.startsWith("image/")
          ? "Imagem armazenada; leitura de texto (OCR) ainda não disponível."
          : "Nenhum texto extraível (arquivo escaneado?). O arquivo fica disponível, mas não entra na busca do chat.",
      });
      log.info("documento sem texto extraível");
      return;
    }

    const trechos = dividirEmTrechos(extracao.paginas);

    let vetores: number[][] | null = null;
    let erroEmbeddings: string | null = null;
    try {
      vetores = await embeddings.gerar(trechos.map((t) => t.conteudo));
    } catch (err) {
      erroEmbeddings = err instanceof Error ? err.message : String(err);
      log.error({ err }, "falha ao gerar embeddings; gravando trechos só com busca textual");
    }

    const linhas = trechos.map((t, i) => ({
      documento_id: id,
      raiz_id: doc.raiz_id,
      ordem: t.ordem,
      pagina: t.pagina,
      conteudo: t.conteudo,
      embedding: vetores ? JSON.stringify(vetores[i]) : null,
      embedding_modelo: embeddings.modelo,
    }));
    for (let i = 0; i < linhas.length; i += LOTE_INSERCAO) {
      const { error: erroInsercao } = await supabaseAdmin.from("documento_chunks").insert(linhas.slice(i, i + LOTE_INSERCAO));
      if (erroInsercao) throw new Error(`Falha ao gravar trechos: ${erroInsercao.message}`);
    }

    await atualizar(id, {
      status_processamento: erroEmbeddings ? "erro" : "concluido",
      erro_processamento: erroEmbeddings
        ? `Texto indexado só para busca textual — embeddings indisponíveis (${erroEmbeddings.slice(0, 300)}). Use "Reprocessar".`
        : null,
      paginas: extracao.totalPaginas,
      processado_em: new Date().toISOString(),
    });
    log.info({ trechos: trechos.length, semEmbeddings: Boolean(erroEmbeddings) }, "documento processado");
  } catch (err) {
    log.error({ err }, "falha no processamento do documento");
    await atualizar(id, {
      status_processamento: "erro",
      erro_processamento: `Falha ao processar: ${(err instanceof Error ? err.message : String(err)).slice(0, 400)}`,
      processado_em: new Date().toISOString(),
    });
  }
}

async function atualizar(id: string, campos: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseAdmin.from("documentos").update(campos).eq("id", id);
  if (error) logger.error({ err: error, documento: id }, "falha ao atualizar status do documento");
}
