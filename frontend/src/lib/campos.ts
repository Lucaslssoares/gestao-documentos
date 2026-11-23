import type { FormatoCampo } from "./tipos";

/**
 * Formatos de campos (máscara na digitação, validação e leitura de NF-e).
 * O backend valida de novo (backend/src/modules/documentos/metadados.ts).
 */

const digitos = (v: string) => v.replace(/\D/g, "");

export function mascarar(formato: FormatoCampo, valor: string): string {
  const d = digitos(valor);
  switch (formato) {
    case "cnpj":
      return d
        .slice(0, 14)
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    case "chave_nfe":
      return d.slice(0, 44).replace(/(\d{4})(?=\d)/g, "$1 ");
    case "competencia":
      return d.slice(0, 6).replace(/^(\d{2})(\d)/, "$1/$2");
  }
}

export function cnpjValido(valor: string): boolean {
  const d = digitos(valor);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const dv = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const resto = [...base].reduce((soma, c, i) => soma + Number(c) * pesos[i]!, 0) % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = dv(d.slice(0, 12));
  return d.endsWith(`${d1}${dv(d.slice(0, 12) + d1)}`);
}

export function chaveNfeValida(valor: string): boolean {
  const d = digitos(valor);
  if (d.length !== 44) return false;
  let soma = 0;
  let peso = 2;
  for (let i = 42; i >= 0; i--) {
    soma += Number(d[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return Number(d[43]) === (resto < 2 ? 0 : 11 - resto);
}

export function competenciaValida(valor: string): boolean {
  const m = /^(\d{2})\/(\d{4})$/.exec(valor);
  return Boolean(m && Number(m[1]) >= 1 && Number(m[1]) <= 12);
}

/** Mensagem de erro do formato, ou null quando o valor está vazio ou válido. */
export function erroDoFormato(formato: FormatoCampo, valor: string): string | null {
  if (!valor) return null;
  if (formato === "cnpj") return cnpjValido(valor) ? null : "CNPJ inválido (confira os dígitos).";
  if (formato === "chave_nfe") return chaveNfeValida(valor) ? null : "A chave tem 44 dígitos e o último não confere.";
  return competenciaValida(valor) ? null : "Use MM/AAAA.";
}

/** Valor gravado (só dígitos para CNPJ e chave) → valor exibido. */
export function exibirFormato(formato: FormatoCampo, valor: string): string {
  return mascarar(formato, valor);
}

const MODELOS: Record<string, string> = { "55": "NF-e (55)", "65": "NFC-e (65)", "57": "CT-e (57)" };

/** O que a chave de acesso já diz: número, série, modelo, CNPJ do emitente e mês de emissão. */
export function decodificarChave(valor: string): { numero: string; serie: string; modelo?: string; cnpj_emitente: string; emissao_ano_mes: string } | null {
  const d = digitos(valor);
  if (!chaveNfeValida(d)) return null;
  return {
    emissao_ano_mes: `20${d.slice(2, 4)}-${d.slice(4, 6)}`,
    cnpj_emitente: d.slice(6, 20),
    modelo: MODELOS[d.slice(20, 22)],
    serie: String(Number(d.slice(22, 25))),
    numero: String(Number(d.slice(25, 34))),
  };
}

export interface DadosNfeXml {
  chave: string;
  modelo?: string;
  numero: string;
  serie: string;
  natureza: string;
  emissao: string | null;
  valor_total: number | null;
  valor_impostos: number | null;
  cnpj_emitente: string;
  nome_emitente: string;
}

/** Lê um XML de NF-e/NFC-e (procNFe ou NFe). Devolve null se o arquivo não for uma nota. */
export function lerXmlNfe(xml: string): DadosNfeXml | null {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) return null;
  const tag = (nome: string, raiz: Document | Element = doc) => raiz.getElementsByTagNameNS("*", nome)[0]?.textContent?.trim() ?? "";
  const inf = doc.getElementsByTagNameNS("*", "infNFe")[0];
  if (!inf) return null;
  const emit = doc.getElementsByTagNameNS("*", "emit")[0];
  const total = doc.getElementsByTagNameNS("*", "ICMSTot")[0];
  const numero = (s: string) => (s && Number.isFinite(Number(s)) ? Number(s) : null);
  const chave = digitos(inf.getAttribute("Id") ?? "") || digitos(tag("chNFe"));
  return {
    chave,
    modelo: MODELOS[tag("mod")],
    numero: tag("nNF"),
    serie: tag("serie"),
    natureza: tag("natOp"),
    emissao: (tag("dhEmi") || tag("dEmi")).slice(0, 10) || null,
    valor_total: numero(total ? tag("vNF", total) : tag("vNF")),
    valor_impostos: numero(total ? tag("vTotTrib", total) : ""),
    cnpj_emitente: emit ? digitos(tag("CNPJ", emit)) : "",
    nome_emitente: emit ? tag("xFant", emit) || tag("xNome", emit) : "",
  };
}
