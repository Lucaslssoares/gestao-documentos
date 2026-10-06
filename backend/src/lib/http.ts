import { z } from "zod";

/** Parâmetro de rota :id validado como UUID. */
export const idParam = z.object({ id: z.uuid({ error: "Identificador inválido." }) });

/** Datas no formato AAAA-MM-DD. */
export const dataIso = z.iso.date({ error: "Use o formato AAAA-MM-DD." });

/** Campos opcionais de formulário: string vazia vira null. */
export const textoOpcional = z
  .string()
  .trim()
  .max(5000)
  .transform((v) => (v === "" ? null : v))
  .nullish();

export const dataOpcional = z
  .union([dataIso, z.literal("")])
  .transform((v) => (v === "" ? null : v))
  .nullish();

export const uuidOpcional = z
  .union([z.uuid(), z.literal("")])
  .transform((v) => (v === "" ? null : v))
  .nullish();

export const paginacaoSchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  por_pagina: z.coerce.number().int().min(1).max(100).default(20),
});

export function intervalo({ pagina, por_pagina }: { pagina: number; por_pagina: number }): [number, number] {
  const inicio = (pagina - 1) * por_pagina;
  return [inicio, inicio + por_pagina - 1];
}

/**
 * Prepara um termo de busca para filtros do PostgREST:
 * remove caracteres com significado na sintaxe de filtro (vírgula, parênteses, aspas, curingas).
 */
export function termoSeguro(termo: string): string {
  return termo
    .replace(/[,()"'\\%*_:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}
