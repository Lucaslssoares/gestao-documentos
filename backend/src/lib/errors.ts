/** Erro com status HTTP e mensagem segura para mostrar ao usuário. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly detalhes?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

interface ErroPostgrest {
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
}

/**
 * Traduz erros do PostgREST/Postgres em respostas HTTP compreensíveis.
 * As mensagens internas do banco não são repassadas ao cliente.
 */
export function erroDoBanco(error: ErroPostgrest, contexto = "registro"): HttpError {
  switch (error.code) {
    case "PGRST116":
      return new HttpError(404, `${capitalizar(contexto)} não encontrado.`);
    case "42501":
      return new HttpError(
        403,
        /^(new row|permission denied)/i.test(error.message)
          ? "Você não tem permissão para esta operação nesta categoria."
          : error.message, // mensagens próprias dos triggers (ex.: regra da lixeira)
      );
    case "23505":
      return new HttpError(409, `Já existe um ${contexto} com esses dados.`, { constraint: error.details ?? undefined });
    case "23503":
      return new HttpError(400, "Referência inválida: o registro relacionado não existe ou ainda está em uso.");
    case "23514":
      // Regras de negócio do banco (ex.: limite de níveis de categoria) já vêm com mensagem amigável.
      return new HttpError(400, error.message.startsWith("new row") ? "Dados inválidos para o cadastro." : error.message);
    case "23502":
    case "22P02":
    case "22007":
    case "22008":
      return new HttpError(400, "Dados inválidos para o cadastro.");
    default:
      return new HttpError(500, "Erro ao acessar o banco de dados.", { code: error.code, message: error.message });
  }
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
