import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { supabaseAdmin } from "../lib/supabase.js";

type Processador = (id: string) => Promise<void>;

/**
 * Fila em memória com concorrência limitada. Suficiente para o MVP (uma instância do backend);
 * na inicialização, documentos que ficaram "pendente"/"processando" são retomados.
 * Para várias réplicas, troque por uma fila externa (ex.: pgmq do Supabase).
 */
export class FilaProcessamento {
  private readonly pendentes: string[] = [];
  private readonly emProcessamento = new Set<string>();
  /** Documentos alterados (ex.: arquivo substituído) enquanto eram processados: rodam de novo ao terminar. */
  private readonly repetir = new Set<string>();
  private processador: Processador | null = null;

  constructor(private readonly concorrencia: number) {}

  /** Liga a fila ao processador (feito no server.ts). */
  iniciar(processador: Processador): void {
    this.processador = processador;
    this.drenar();
  }

  adicionar(id: string): void {
    if (this.emProcessamento.has(id)) {
      this.repetir.add(id);
      return;
    }
    if (this.pendentes.includes(id)) return;
    this.pendentes.push(id);
    this.drenar();
  }

  get tamanho(): number {
    return this.pendentes.length + this.emProcessamento.size;
  }

  async retomarPendentes(): Promise<number> {
    const { data, error } = await supabaseAdmin
      .from("documentos")
      .select("id")
      .in("status_processamento", ["pendente", "processando"])
      .is("excluido_em", null)
      .order("criado_em");
    if (error) {
      logger.error({ err: error }, "não foi possível buscar documentos pendentes");
      return 0;
    }
    for (const { id } of data ?? []) this.adicionar(id as string);
    return data?.length ?? 0;
  }

  private drenar(): void {
    const processar = this.processador;
    if (!processar) return;
    while (this.emProcessamento.size < this.concorrencia && this.pendentes.length > 0) {
      const id = this.pendentes.shift() as string;
      this.emProcessamento.add(id);
      processar(id)
        .catch((err) => logger.error({ err, documento: id }, "erro inesperado na fila de processamento"))
        .finally(() => {
          this.emProcessamento.delete(id);
          if (this.repetir.delete(id)) this.pendentes.push(id);
          this.drenar();
        });
    }
  }
}

export const filaProcessamento = new FilaProcessamento(env.PROCESSAMENTO_CONCORRENCIA);
