import { XMLParser } from "fast-xml-parser";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

/** Texto extraído, por página quando o formato tem páginas (PDF). */
export interface PaginaExtraida {
  numero: number | null;
  texto: string;
}

export interface ResultadoExtracao {
  paginas: PaginaExtraida[];
  totalPaginas: number | null;
}

/** Etapa 1 do pipeline: extração de texto (PDF, DOCX, XML, TXT). Imagens não têm texto (OCR fica para a fase 2). */
export async function extrairTexto(conteudo: Buffer, mime: string): Promise<ResultadoExtracao> {
  switch (mime) {
    case "application/pdf":
      return extrairPdf(conteudo);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      const { value } = await mammoth.extractRawText({ buffer: conteudo });
      return { paginas: [{ numero: null, texto: limparTexto(value) }], totalPaginas: null };
    }
    case "application/xml":
    case "text/xml":
      return { paginas: [{ numero: null, texto: xmlParaTexto(conteudo.toString("utf8")) }], totalPaginas: null };
    case "text/plain":
      return { paginas: [{ numero: null, texto: limparTexto(conteudo.toString("utf8")) }], totalPaginas: null };
    default:
      return { paginas: [], totalPaginas: null };
  }
}

async function extrairPdf(conteudo: Buffer): Promise<ResultadoExtracao> {
  const pdf = await getDocumentProxy(new Uint8Array(conteudo));
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  const paginas = text.map((t, i) => ({ numero: i + 1, texto: limparTexto(t) }));
  return { paginas, totalPaginas: totalPages };
}

/**
 * Converte XML (ex.: NF-e) em linhas "campo: valor" legíveis para a busca e para o LLM.
 * Usa os dois últimos níveis do caminho (ex.: "emit.xNome: ARCON ENGENHARIA").
 */
export function xmlParaTexto(xml: string): string {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@",
    removeNSPrefix: true,
    parseTagValue: false,
    trimValues: true,
  });
  const objeto: unknown = parser.parse(xml);
  const linhas: string[] = [];

  const visitar = (valor: unknown, caminho: string[]) => {
    if (valor === null || valor === undefined || valor === "") return;
    if (Array.isArray(valor)) {
      valor.forEach((item) => visitar(item, caminho));
      return;
    }
    if (typeof valor === "object") {
      for (const [chave, filho] of Object.entries(valor as Record<string, unknown>)) {
        if (chave.startsWith("?xml") || chave === "Signature") continue; // cabeçalho e assinatura digital não interessam
        visitar(filho, [...caminho, chave.replace(/^@/, "")]);
      }
      return;
    }
    const rotulo = caminho.slice(-2).join(".") || "valor";
    linhas.push(`${rotulo}: ${String(valor)}`);
  };

  visitar(objeto, []);
  return limparTexto(linhas.join("\n"));
}

/** Normaliza quebras e espaços e remove caracteres que o Postgres não aceita em text (\u0000). */
export function limparTexto(texto: string): string {
  return texto
    .replaceAll(String.fromCharCode(0), "")
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ {2,}/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function temTextoUtil(resultado: ResultadoExtracao): boolean {
  const total = resultado.paginas.reduce((soma, p) => soma + p.texto.replace(/\s/g, "").length, 0);
  return total >= 20;
}
