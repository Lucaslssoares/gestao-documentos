import { logger } from "../../lib/logger.js";
import { supabaseAdmin } from "../../lib/supabase.js";

export interface EventoHistorico {
  atorId: string;
  acao: string;
  entidade: string;
  entidadeId?: string | null;
  documentoId?: string | null;
  raizId?: string | null;
  detalhes?: Record<string, unknown>;
}

/**
 * Registra eventos que não passam pelos triggers do banco (visualização, download,
 * convite, uso do assistente). Falha ao auditar não derruba a operação, mas fica no log.
 */
export async function registrarEvento(evento: EventoHistorico): Promise<void> {
  const { error } = await supabaseAdmin.from("historico").insert({
    ator_id: evento.atorId,
    acao: evento.acao,
    entidade: evento.entidade,
    entidade_id: evento.entidadeId ?? null,
    documento_id: evento.documentoId ?? null,
    raiz_id: evento.raizId ?? null,
    detalhes: evento.detalhes ?? {},
  });
  if (error) logger.error({ err: error, evento }, "falha ao registrar histórico");
}
