/**
 * Planejamento da busca do assistente local.
 *
 * Modelos pequenos (3B) erram ao escolher ferramentas sozinhos, então no modo local quem
 * decide o que consultar é este código: a partir da pergunta, monta as buscas (filtros de
 * documentos, busca no conteúdo e pendências). O modelo só redige a resposta com as fontes.
 */

export interface FiltroDocumentos {
  termo?: string;
  tipo?: string;
  situacao?: "vencido" | "a_vencer";
  validade_de?: string;
  validade_ate?: string;
  ordem?: "validade" | "recentes" | "relevancia";
  limite: number;
}

export interface PlanoBusca {
  /** Pesquisas de documentos (filtros e/ou palavras-chave). */
  documentos: FiltroDocumentos[];
  /** Busca no conteúdo dos arquivos (trechos). Null quando a pergunta é só de listagem. */
  conteudo: string | null;
  /** Consultar a central de pendências do usuário. */
  pendencias: boolean;
  /** Saudação/conversa sem pergunta sobre documentos. */
  saudacao: boolean;
}

const TIPOS: [RegExp, string][] = [
  [/\baditivos?\b/, "aditivo"],
  [/\bcontratos?\b/, "contrato"],
  [/\bnotas? fisca(l|is)\b|\bnfc?-?e\b|\bdanfe\b/, "nota_fiscal"],
  [/\bcertid(ao|oes)\b/, "certidao"],
  [/\bguias?\b|\bdarf\b|\bdas\b/, "guia_imposto"],
  [/\bprocurac(ao|oes)\b/, "procuracao"],
  [/\blicencas?\b/, "licenca_ambiental"],
  [/\bapolices?\b|\bseguros?\b/, "apolice_seguro"],
  [/\blaudos?\b/, "laudo_tecnico"],
  [/\bpareceres?\b|\bparecer\b/, "parecer"],
  [/\bpropostas?\b/, "proposta"],
  [/\bpedidos? de compra\b/, "pedido_compra"],
  [/\batestados?\b/, "atestado"],
  [/\boficios?\b/, "oficio"],
  [/\bmemorandos?\b/, "memorando"],
  [/\bordens? de servico\b/, "ordem_servico"],
  [/\bcomprovantes?\b/, "comprovante"],
  [/\bnotificac(ao|oes)\b/, "notificacao"],
];

/** Palavras que não ajudam a achar documentos (perguntas, verbos genéricos, tipos já filtrados). */
const VAZIAS = new Set(
  (
    "a o as os um uma uns umas de da do das dos em na no nas nos para pra por com sem sobre que qual quais quem quanto quantos " +
    "quantas como onde quando e ou se me eu meu minha meus minhas nosso nossa seu sua ha tem tenho temos ter existe existem " +
    "esta este estao isso isto aquele aquela ao aos ja mais menos muito pouco todos todas tudo algum alguma " +
    "documento documentos arquivo arquivos sistema favor poderia pode podes consegue mostre mostrar liste listar listagem " +
    "encontre encontrar busque buscar procure procurar quero queria preciso gostaria diga dizer fale falar informe " +
    "resuma resumir resumo explique explicar detalhe detalhes valor valores " +
    "vence vencem vencer vencendo vencimento vencimentos vencido vencidos vencida vencidas proximo proximos proxima proximas " +
    "dias dia semana semanas mes meses ano hoje relacionado relacionados relacionada relacionadas " +
    "sao ser foi era estao estou pendencia pendencias tarefa tarefas prazo prazos aprovacao aprovacoes aprovar fazer revisao revisoes"
  ).split(" "),
);

export const semAcento = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

function somarDias(hoje: string, dias: number): string {
  const d = new Date(`${hoje}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Palavras-chave da pergunta (com acento original), sem palavras vazias nem as que viraram filtro. */
export function palavrasChave(pergunta: string, ignorar: RegExp[] = []): string {
  const palavras = pergunta
    .split(/[^\p{L}\p{N}\-/.]+/u)
    .map((p) => p.replace(/^[.\-/]+|[.\-/]+$/g, ""))
    .filter(Boolean);
  // Palavras cobertas por um filtro (ex.: "notas fiscais" quando o tipo já é nota_fiscal).
  const normalizado = palavras.map(semAcento).join(" ");
  const cobertas = new Set(ignorar.flatMap((r) => [...normalizado.matchAll(new RegExp(r.source, "g"))].flatMap((m) => m[0].split(" "))));
  return palavras
    // Números curtos ("60 dias") são prazo, não identificador.
    .filter((p) => p.length >= 2 && !/^\d{1,3}$/.test(p) && !VAZIAS.has(semAcento(p)) && !cobertas.has(semAcento(p)))
    .slice(0, 8)
    .join(" ");
}

/** Decide o que consultar para responder à pergunta. `hoje` em AAAA-MM-DD. */
export function planejarBusca(pergunta: string, hoje: string): PlanoBusca {
  const p = semAcento(pergunta);

  const saudacao = /^\s*(oi|ola|bom dia|boa tarde|boa noite|e ai|obrigad[oa]|valeu|tudo bem)[\s!.,?]*$/.test(p);
  if (saudacao) return { documentos: [], conteudo: null, pendencias: false, saudacao: true };

  const tipoEncontrado = TIPOS.find(([r]) => r.test(p));
  const tipo = tipoEncontrado?.[1];

  const pendencias = /\bpendenc|\btarefa|\bprazos?\b|\baprova|\brevis(ao|oes|ar)\b|o que (eu )?(tenho|preciso) (que |para |pra )?fazer|\bcondicionante/.test(p);

  // Vencimentos: "vencidos", "a vencer", "vencem nos próximos 60 dias", "vence este mês".
  const filtro: FiltroDocumentos = { limite: 10 };
  if (tipo) filtro.tipo = tipo;
  if (/\bvencid[oa]s?\b|\bexpirad|\batrasad/.test(p)) {
    filtro.situacao = "vencido";
    filtro.ordem = "validade";
  } else if (/\bvenc(e|em|er|endo|imento|imentos)\b|\ba vencer\b|\bexpira/.test(p)) {
    const dias = Number(/(\d{1,3})\s*dias/.exec(p)?.[1] ?? (/\bmes\b/.test(p) ? 30 : /\bsemana\b/.test(p) ? 7 : 30));
    filtro.validade_de = hoje;
    filtro.validade_ate = somarDias(hoje, Math.min(dias, 365));
    filtro.ordem = "validade";
  }
  const termo = palavrasChave(pergunta, tipoEncontrado ? [tipoEncontrado[0]] : []);
  // Só o tipo ("contrato da Norte Log") não vira listagem: a busca por palavras já filtra pelo tipo.
  const temFiltro = Boolean(filtro.situacao || filtro.validade_ate || (filtro.tipo && !termo));

  const documentos: FiltroDocumentos[] = [];
  // Palavras específicas (nome de fornecedor, número de contrato...) primeiro: são as mais relevantes.
  if (termo) documentos.push({ termo, tipo, ordem: "relevancia", limite: 6 });
  if (temFiltro) documentos.push(filtro);
  if (!temFiltro && !termo && !pendencias) documentos.push({ ordem: "recentes", limite: 6 });

  // Perguntas de listagem pura ("quais contratos vencem...") não precisam de trechos.
  const sobreConteudo = !temFiltro || Boolean(termo) || /\bclausul|\bmulta|\bobriga|\bresum|\bprazo de|\bcondic|\bdiz\b|\bfala\b/.test(p);
  return { documentos, conteudo: sobreConteudo && !(pendencias && !termo) ? pergunta : null, pendencias, saudacao: false };
}
