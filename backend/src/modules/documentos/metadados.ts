import { z } from "zod";
import { HttpError } from "../../lib/errors.js";
import { FORMATOS_CAMPO, TIPOS_CAMPO, type CampoPersonalizado, type FormatoCampo } from "../../types/dominio.js";

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
      grupo: z.string().trim().max(40).optional(),
      formato: z.enum(FORMATOS_CAMPO).optional(),
      ajuda: z.string().trim().max(200).optional(),
      placeholder: z.string().trim().max(80).optional(),
      sufixo: z.string().trim().max(10).optional(),
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
        if (campo.tipo === "texto" && campo.formato) {
          const normalizado = normalizarFormato(campo.formato, texto);
          if (normalizado === null) erros.push(MENSAGEM_FORMATO[campo.formato](campo.rotulo));
          else saida[campo.chave] = normalizado;
          break;
        }
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

const MENSAGEM_FORMATO: Record<FormatoCampo, (rotulo: string) => string> = {
  cnpj: (r) => `"${r}": CNPJ inválido.`,
  chave_nfe: (r) => `"${r}": a chave de acesso tem 44 dígitos (NF-e) ou 50 (NFS-e) e o dígito verificador precisa conferir.`,
  competencia: (r) => `"${r}": use o formato MM/AAAA.`,
};

/** Dígitos de um CNPJ válido (os dois dígitos verificadores conferem), ou null. */
export function validarCnpj(valor: string): string | null {
  const d = valor.replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return null;
  const dv = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const resto = [...base].reduce((soma, c, i) => soma + Number(c) * pesos[i]!, 0) % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = dv(d.slice(0, 12));
  const d2 = dv(d.slice(0, 12) + d1);
  return d.endsWith(`${d1}${d2}`) ? d : null;
}

/** Chave de acesso de NF-e/NFC-e/CT-e (44 dígitos) ou NFS-e nacional (50), com DV módulo 11 (pesos 2 a 9), ou null. */
export function validarChaveNfe(valor: string): string | null {
  const d = valor.replace(/\D/g, "");
  if (d.length !== 44 && d.length !== 50) return null;
  let soma = 0;
  let peso = 2;
  for (let i = d.length - 2; i >= 0; i--) {
    soma += Number(d[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return Number(d[d.length - 1]) === (resto < 2 ? 0 : 11 - resto) ? d : null;
}

/** Competência MM/AAAA (aceita MMAAAA), ou null. */
export function validarCompetencia(valor: string): string | null {
  const m = /^(\d{2})\/?(\d{4})$/.exec(valor.replace(/\s/g, ""));
  return m && Number(m[1]) >= 1 && Number(m[1]) <= 12 ? `${m[1]}/${m[2]}` : null;
}

function normalizarFormato(formato: FormatoCampo, texto: string): string | null {
  if (formato === "cnpj") return validarCnpj(texto);
  if (formato === "chave_nfe") return validarChaveNfe(texto);
  return validarCompetencia(texto);
}
