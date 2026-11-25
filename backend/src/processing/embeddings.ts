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

/** Worker da Edge Function sem recursos para o lote (dá para tentar de novo com menos). */
class LimiteDoWorker extends Error {}

/** gte-small nativo do Supabase Edge Runtime (Edge Function "embed") — gratuito, 384 dimensões. */
export class EmbeddingsSupabaseGteSmall implements ProvedorEmbeddings {
  readonly modelo = "gte-small";
  readonly dimensoes = 384;

  constructor(
    private readonly url: string,
    private readonly chave: string,
    private readonly tamanhoLote: number,
    private readonly fetchFn: typeof fetch = fetch,
    private readonly esperar: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {}

  async gerar(textos: string[]): Promise<number[][]> {
    const vetores: number[][] = [];
    for (let i = 0; i < textos.length; i += this.tamanhoLote) {
      vetores.push(...(await this.gerarLote(textos.slice(i, i + this.tamanhoLote))));
    }
    return vetores;
  }

  /**
   * A Edge Function tem limite de CPU por requisição (546 WORKER_LIMIT). Em máquina lenta
   * um lote grande estoura: divide ao meio e tenta de novo; um trecho sozinho ganha mais
   * duas tentativas com pausa (o worker pode estar disputando CPU com outro processo).
   */
  private async gerarLote(lote: string[], tentativa = 0): Promise<number[][]> {
    try {
      return await this.enviar(lote);
    } catch (err) {
      if (!(err instanceof LimiteDoWorker)) throw err;
      if (lote.length > 1) {
        const meio = Math.ceil(lote.length / 2);
        return [...(await this.gerarLote(lote.slice(0, meio))), ...(await this.gerarLote(lote.slice(meio)))];
      }
      if (tentativa >= 2) throw err;
      await this.esperar(2_000 * (tentativa + 1));
      return this.gerarLote(lote, tentativa + 1);
    }
  }

  private async enviar(lote: string[]): Promise<number[][]> {
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
      const mensagem = `Função de embeddings respondeu ${resposta.status}: ${corpo.slice(0, 200)}`;
      // 546 = WORKER_LIMIT (CPU/memória do worker); 503/504 = worker ocupado ou cancelado.
      if ([503, 504, 546].includes(resposta.status) || corpo.includes("WORKER_LIMIT")) throw new LimiteDoWorker(mensagem);
      throw new Error(mensagem);
    }
    const { embeddings } = (await resposta.json()) as { embeddings?: number[][] };
    if (!Array.isArray(embeddings) || embeddings.length !== lote.length) {
      throw new Error("Função de embeddings devolveu uma quantidade inesperada de vetores.");
    }
    for (const vetor of embeddings) {
      if (!Array.isArray(vetor) || vetor.length !== this.dimensoes) {
        throw new Error(`Vetor com ${Array.isArray(vetor) ? vetor.length : "?"} dimensões (esperado ${this.dimensoes}).`);
      }
    }
    return embeddings;
  }
}

export const provedorEmbeddings: ProvedorEmbeddings = new EmbeddingsSupabaseGteSmall(
  env.EMBEDDINGS_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  env.EMBEDDINGS_LOTE,
);
