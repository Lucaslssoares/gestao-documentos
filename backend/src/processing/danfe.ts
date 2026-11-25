/** Dados de uma nota fiscal lidos do texto de um PDF (DANFE ou DANFSe). Mesmo formato que o front-end usa para o XML. */
export interface DadosNfePdf {
  chave: string;
  modelo: string;
  numero: string;
  serie: string;
  natureza: string;
  emissao: string | null;
  valor_total: number | null;
  valor_impostos: number | null;
  cnpj_emitente: string;
  nome_emitente: string;
}

const MODELOS: Record<string, string> = { "55": "NF-e (55)", "65": "NFC-e (65)" };

/** Dígito verificador da chave de acesso (módulo 11, pesos 2 a 9 da direita para a esquerda): 44 dígitos (NF-e) ou 50 (NFS-e). */
export function chaveNfeValida(chave: string): boolean {
  if (!/^(\d{44}|\d{50})$/.test(chave)) return false;
  let soma = 0;
  let peso = 2;
  for (let i = chave.length - 2; i >= 0; i--) {
    soma += Number(chave[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dv = resto < 2 ? 0 : 11 - resto;
  return dv === Number(chave[chave.length - 1]);
}

/** Procura uma chave de acesso (impressa em grupos de 4 ou corrida) com o tamanho pedido e o dígito verificador certo. */
function acharChaveComTamanho(texto: string, grupos: 10 | 12): string | null {
  const resto = grupos === 10 ? "\\d{4}" : "\\d{2}";
  const padrao = new RegExp(`(?:\\d{4}[^\\S\\r\\n]?){${grupos}}${resto}`, "g");
  for (const candidato of texto.match(padrao) ?? []) {
    const digitos = candidato.replace(/\D/g, "");
    if (digitos.length === (grupos === 10 ? 44 : 50) && chaveNfeValida(digitos)) return digitos;
  }
  return null;
}

function dinheiro(texto: string): number | null {
  const m = /(\d{1,3}(?:\.\d{3})*,\d{2})/.exec(texto);
  return m ? Number(m[1]!.replaceAll(".", "").replace(",", ".")) : null;
}

/**
 * Lê um DANFE (PDF de NF-e/NFC-e) a partir do texto extraído. A chave de acesso traz número, série, modelo
 * e CNPJ do emitente; valor total, data de emissão e nome do emitente saem do corpo do documento.
 * Devolve null quando não há uma chave válida (o arquivo provavelmente não é uma nota fiscal).
 */
export function lerDanfe(texto: string): DadosNfePdf | null {
  const chave = acharChaveComTamanho(texto, 10);
  if (!chave) return null;
  const modelo = MODELOS[chave.slice(20, 22)];
  if (!modelo) return null;

  const plano = texto.replace(/\s+/g, " ");
  const totalBruto = /VALOR\s+TOTAL\s+DA\s+(?:NOTA|NF-?E)\s*(.{0,60})/i.exec(plano)?.[1] ?? "";
  const emissaoBruta = /DATA\s+(?:DA\s+)?EMISS[ÃA]O\s*(.{0,40})/i.exec(plano)?.[1] ?? "";
  const data = /(\d{2})\/(\d{2})\/(\d{4})/.exec(emissaoBruta);
  const nome = /RECEBEMOS\s+DE\s+(.+?)\s+OS\s+PRODUTOS/i.exec(plano)?.[1]?.trim() ?? "";

  return {
    chave,
    modelo,
    numero: String(Number(chave.slice(25, 34))),
    serie: String(Number(chave.slice(22, 25))),
    natureza: "",
    emissao: data ? `${data[3]}-${data[2]}-${data[1]}` : null,
    valor_total: dinheiro(totalBruto),
    valor_impostos: null,
    cnpj_emitente: chave.slice(6, 20),
    nome_emitente: nome,
  };
}

/**
 * Lê um DANFSe (PDF da NFS-e nacional, nota de serviço). A chave de 50 dígitos traz o município, o CNPJ do prestador
 * e o número da nota; valor, data, nome do prestador e descrição saem do corpo do documento.
 */
export function lerDanfse(texto: string): DadosNfePdf | null {
  const chave = acharChaveComTamanho(texto, 12);
  if (!chave) return null;
  // cLocEmi(7) tpAmb(1) tipoInscrição(1) inscrição(14) nNFSe(13) AAMM(4) código(9) DV(1)
  const cnpj = chave[8] === "2" ? chave.slice(9, 23) : "";

  const plano = texto.replace(/\s+/g, " ");
  const totalBruto = /VALOR\s+TOTAL\s+DA\s+NFS-?E\s*(.{0,80})/i.exec(plano)?.[1] ?? "";
  const emissaoBruta = /DATA\s+E\s+HORA\s+DA\s+EMISS[ÃA]O\s+DA\s+NFS-?E\s*(.{0,30})/i.exec(plano)?.[1] ?? "";
  const data = /(\d{2})\/(\d{2})\/(\d{4})/.exec(emissaoBruta);
  const nome = /PRESTADOR\s*\/\s*FORNECEDOR.*?Nome\s*\/\s*Nome\s+Empresarial\s+(.+?)\s+Munic[íi]pio/i.exec(plano)?.[1]?.trim() ?? "";
  const servico = /Descri[çc][ãa]o\s+do\s+Servi[çc]o\s+(.+?)\s+TRIBUTA[ÇC][ÃA]O\s+MUNICIPAL/i.exec(plano)?.[1]?.trim() ?? "";

  return {
    chave,
    modelo: "NFS-e",
    numero: String(Number(chave.slice(23, 36))),
    serie: "",
    natureza: servico.slice(0, 200),
    emissao: data ? `${data[3]}-${data[2]}-${data[1]}` : null,
    valor_total: dinheiro(totalBruto),
    valor_impostos: null,
    cnpj_emitente: cnpj,
    nome_emitente: nome,
  };
}

/** PDF de nota fiscal: tenta o DANFE (NF-e/NFC-e) e depois o DANFSe (NFS-e). */
export function lerNotaFiscalPdf(texto: string): DadosNfePdf | null {
  return lerDanfe(texto) ?? lerDanfse(texto);
}
