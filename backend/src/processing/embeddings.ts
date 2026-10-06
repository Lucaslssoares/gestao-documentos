import { env } from "../config/env.js";

/**
 * Etapa 3 do pipeline: embeddings. A interface permite trocar o modelo no futuro
 * (ex.: um modelo multilíngue) — basta reprocessar os documentos; a coluna
 * documento_chunks.embedding_modelo registra qual modelo gerou cada vetor.
 */
export interface ProvedorEmbeddings {
  readonly modelo: string;
  readonly dimensoes: number;
  gerar(textos: string[]): Promise<number[][]>;
}

/** gte-small nativo do Supabase Edge Runtime (Edge Function "embed") — gratuito, 384 dimensões. */
export class EmbeddingsSupabaseGteSmall implements ProvedorEmbeddings {
  readonly modelo = "gte-small";
  readonly dimensoes = 384;

  constructor(
    private readonly url: string,
    private readonly chave: string,
    private readonly tamanhoLote: number,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async gerar(textos: string[]): Promise<number[][]> {
    const vetores: number[][] = [];
    for (let i = 0; i < textos.length; i += this.tamanhoLote) {
      const lote = textos.slice(i, i + this.tamanhoLote);
      const resposta = await this.fetchFn(this.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.chave}`,
          apikey: this.chave,
        },
        body: JSON.stringify({ inputs: lote }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!resposta.ok) {
        const corpo = await resposta.text().catch(() => "");
        throw new Error(`Função de embeddings respondeu ${resposta.status}: ${corpo.slice(0, 200)}`);
      }
      const { embeddings } = (await resposta.json()) as { embeddings?: number[][] };
      if (!Array.isArray(embeddings) || embeddings.length !== lote.length) {
        throw new Error("Função de embeddings devolveu uma quantidade inesperada de vetores.");
      }
      for (const vetor of embeddings) {
        if (!Array.isArray(vetor) || vetor.length !== this.dimensoes) {
          throw new Error(`Vetor com ${Array.isArray(vetor) ? vetor.length : "?"} dimensões (esperado ${this.dimensoes}).`);
        }
        vetores.push(vetor);
      }
    }
    return vetores;
  }
}

export const provedorEmbeddings: ProvedorEmbeddings = new EmbeddingsSupabaseGteSmall(
  env.EMBEDDINGS_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  env.EMBEDDINGS_LOTE,
);
