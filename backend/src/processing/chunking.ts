import type { PaginaExtraida } from "./extrair.js";

export interface Trecho {
  ordem: number;
  pagina: number | null;
  conteudo: string;
}

export interface OpcoesChunking {
  /** Tamanho alvo em caracteres. ~1.000 cabe nos 512 tokens do gte-small. */
  tamanho: number;
  /** Caracteres repetidos do fim do trecho anterior, para não cortar o contexto. */
  sobreposicao: number;
}

const PADRAO: OpcoesChunking = { tamanho: 1000, sobreposicao: 150 };

/**
 * Etapa 2 do pipeline: divide o texto em trechos respeitando parágrafos e frases.
 * Os trechos nunca atravessam páginas, para a fonte citar a página certa.
 */
export function dividirEmTrechos(paginas: PaginaExtraida[], opcoes: Partial<OpcoesChunking> = {}): Trecho[] {
  const { tamanho, sobreposicao } = { ...PADRAO, ...opcoes };
  const trechos: Omit<Trecho, "ordem">[] = [];

  for (const pagina of paginas) {
    const partes = pagina.texto
      .split(/\n{2,}/)
      .flatMap((paragrafo) => quebrarLongo(paragrafo.replace(/\n/g, " ").trim(), tamanho))
      .filter(Boolean);

    let atual = "";
    for (const parte of partes) {
      const candidato = atual ? `${atual}\n\n${parte}` : parte;
      if (candidato.length <= tamanho || !atual) {
        atual = candidato;
        continue;
      }
      trechos.push({ pagina: pagina.numero, conteudo: atual });
      const cauda = finalDe(atual, sobreposicao);
      atual = cauda && cauda.length + parte.length + 2 <= tamanho ? `${cauda}\n\n${parte}` : parte;
    }
    if (atual.trim()) trechos.push({ pagina: pagina.numero, conteudo: atual });
  }

  return trechos.map((t, ordem) => ({ ordem, ...t }));
}

/** Parágrafos maiores que o limite são quebrados em frases; frases enormes, por palavras. */
function quebrarLongo(texto: string, tamanho: number): string[] {
  if (texto.length <= tamanho) return [texto];

  const frases = texto.split(/(?<=[.;:!?])\s+/);
  const saida: string[] = [];
  let atual = "";
  for (const frase of frases) {
    for (const pedaco of frase.length > tamanho ? cortarPorPalavras(frase, tamanho) : [frase]) {
      if (!atual) atual = pedaco;
      else if (atual.length + 1 + pedaco.length <= tamanho) atual = `${atual} ${pedaco}`;
      else {
        saida.push(atual);
        atual = pedaco;
      }
    }
  }
  if (atual) saida.push(atual);
  return saida;
}

function cortarPorPalavras(texto: string, tamanho: number): string[] {
  const saida: string[] = [];
  let restante = texto;
  while (restante.length > tamanho) {
    let corte = restante.lastIndexOf(" ", tamanho);
    if (corte <= tamanho * 0.5) corte = tamanho;
    saida.push(restante.slice(0, corte).trim());
    restante = restante.slice(corte).trim();
  }
  if (restante) saida.push(restante);
  return saida;
}

/** Últimos `n` caracteres, começando numa palavra inteira. */
function finalDe(texto: string, n: number): string {
  if (n <= 0 || texto.length <= n) return n <= 0 ? "" : texto;
  const fatia = texto.slice(-n);
  const espaco = fatia.indexOf(" ");
  return (espaco >= 0 ? fatia.slice(espaco + 1) : fatia).trim();
}
