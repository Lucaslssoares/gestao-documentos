import { z } from "zod";
import { HttpError } from "../../lib/errors.js";
import { TIPOS_CAMPO, type CampoPersonalizado } from "../../types/dominio.js";

/** Esquema da definição de campos de um tipo de documento (cadastro de tipos pelo admin). */
export const camposSchema = z
  .array(
    z.object({
      chave: z
        .string()
        .trim()
        .regex(/^[a-z][a-z0-9_]{0,39}$/, { error: "Chave do campo: letras minúsculas, números e _ (ex.: valor_total)." }),
      rotulo: z.string().trim().min(1).max(80),
      tipo: z.enum(TIPOS_CAMPO),
      obrigatorio: z.boolean().default(false),
      opcoes: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
    }),
  )
  .max(30)
  .superRefine((campos, ctx) => {
    const chaves = new Set<string>();
    campos.forEach((campo, i) => {
      if (chaves.has(campo.chave)) ctx.addIssue({ code: "custom", message: `Chave repetida: ${campo.chave}`, path: [i, "chave"] });
      chaves.add(campo.chave);
      if (campo.tipo === "selecao" && !campo.opcoes?.length) {
        ctx.addIssue({ code: "custom", message: `O campo "${campo.rotulo}" precisa de opções.`, path: [i, "opcoes"] });
      }
    });
  });

/**
 * Valida e normaliza os campos personalizados de um documento conforme o tipo.
 * Chaves que o tipo não define são descartadas.
 */
export function validarMetadados(campos: CampoPersonalizado[], entrada: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const valores = entrada ?? {};
  const saida: Record<string, unknown> = {};
  const erros: string[] = [];

  for (const campo of campos) {
    const bruto = valores[campo.chave];
    if (bruto === undefined || bruto === null || (typeof bruto === "string" && bruto.trim() === "")) {
      if (campo.obrigatorio) erros.push(`Preencha "${campo.rotulo}".`);
      continue;
    }

    switch (campo.tipo) {
      case "texto":
      case "texto_longo": {
        const texto = String(bruto).trim();
        const limite = campo.tipo === "texto" ? 300 : 5000;
        if (texto.length > limite) erros.push(`"${campo.rotulo}" passa de ${limite} caracteres.`);
        else saida[campo.chave] = texto;
        break;
      }
      case "numero":
      case "moeda": {
        const numero = typeof bruto === "number" ? bruto : Number(String(bruto).replace(/\s/g, "").replace(",", "."));
        if (!Number.isFinite(numero)) erros.push(`"${campo.rotulo}" deve ser um número.`);
        else if (campo.tipo === "moeda" && numero < 0) erros.push(`"${campo.rotulo}" não pode ser negativo.`);
        else saida[campo.chave] = campo.tipo === "moeda" ? Math.round(numero * 100) / 100 : numero;
        break;
      }
      case "data": {
        const texto = String(bruto);
        const data = new Date(`${texto}T00:00:00Z`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(texto) || Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== texto) {
          erros.push(`"${campo.rotulo}" deve ser uma data válida.`);
        } else saida[campo.chave] = texto;
        break;
      }
      case "booleano": {
        if (bruto === true || bruto === "true") saida[campo.chave] = true;
        else if (bruto === false || bruto === "false") saida[campo.chave] = false;
        else erros.push(`"${campo.rotulo}" deve ser sim ou não.`);
        break;
      }
      case "selecao": {
        const texto = String(bruto).trim();
        if (!campo.opcoes?.includes(texto)) erros.push(`"${campo.rotulo}": escolha uma das opções.`);
        else saida[campo.chave] = texto;
        break;
      }
    }
  }

  if (erros.length > 0) throw new HttpError(400, erros.join(" "));
  return saida;
}
