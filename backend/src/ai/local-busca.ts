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
  /** Chave de acesso de nota (44 ou 50 dígitos) citada na pergunta: busca exata, sem modelo. */
  chave?: string;
  /**
   * Pergunta sobre um dado de UM documento ("valor do contrato da AgroPará", "quando vence o
   * contrato da Norte Log"): responde com a ficha do documento mais relevante, sem modelo.
   */
  ficha?: Atributo;
}

export type Atributo = "valor" | "validade" | "responsavel" | "contraparte" | "numero" | "geral";

/** Ordem importa: o primeiro que casar define o destaque da resposta. */
const ATRIBUTOS: [Atributo, RegExp][] = [
  ["valor", /\bvalor|\bquanto (custa|custou|foi|e|vale)\b|\bpreco\b/],
  ["validade", /\bvenc|\bvalidade\b|\bvigencia\b|\bate quando\b|\bexpira/],
  ["responsavel", /\brespons[aá]ve/],
  ["contraparte", /\bfornecedor\b|\bcontraparte\b|\bemitente\b|\bprestador\b|\bquem (emitiu|forneceu|presta)/],
  ["numero", /\bnumero\b|\bn[o.º°] d[oa]\b/],
  ["geral", /\b(me )?(informe|fale|fala|diga|conte) (sobre|d[oa]s?)\b|\binformac(ao|oes)\b|\bdetalhes\b|\bdados d[oa]s?\b|\bficha\b/],
];

/** Perguntas sobre o TEXTO do arquivo: estas vão para o modelo. */
const SOBRE_TEXTO = /\bclausul|\bmulta|\bobrigac|\bresum|\bcondic|\bdiz\b|\bpenalid|\brescis|\bprevist|\bexplic|\bdo que (se )?trata/;

/** Chave de acesso de NF-e/NFC-e/CT-e (44) ou NFS-e nacional (50) na pergunta, aceitando espaços e prefixo (NFS, NFe). */
export function extrairChave(pergunta: string): string | null {
  const compacta = pergunta.replace(/(?<=\d)[\s.\-/]+(?=\d)/g, "");
  return /(?<!\d)(\d{50}|\d{44})(?!\d)/.exec(compacta)?.[1] ?? null;
}

export interface DadosChave {
  modelo: string;
  numero: string;
  cnpj: string;
  competencia: string;
  municipio_ou_uf: string;
  serie?: string;
}

const UF: Record<string, string> = {
  "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO", "21": "MA", "22": "PI", "23": "CE", "24": "RN",
  "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA", "31": "MG", "32": "ES", "33": "RJ", "35": "SP", "41": "PR", "42": "SC",
  "43": "RS", "50": "MS", "51": "MT", "52": "GO", "53": "DF",
};
const MODELOS: Record<string, string> = { "55": "NF-e", "65": "NFC-e", "57": "CT-e", "58": "MDF-e" };

/** O que a própria chave informa (sem consultar a SEFAZ). */
export function decodificarChaveAcesso(chave: string): DadosChave | null {
  if (chave.length === 44) {
    return {
      modelo: MODELOS[chave.slice(20, 22)] ?? `modelo ${chave.slice(20, 22)}`,
      municipio_ou_uf: UF[chave.slice(0, 2)] ?? chave.slice(0, 2),
      competencia: `${chave.slice(4, 6)}/20${chave.slice(2, 4)}`,
      cnpj: chave.slice(6, 20),
      serie: String(Number(chave.slice(22, 25))),
      numero: String(Number(chave.slice(25, 34))),
    };
  }
  if (chave.length === 50) {
    // NFS-e nacional: município (7) · ambiente (1) · tipo de inscrição (1) · CNPJ/CPF (14) · número (13) · AAMM (4) · código (9) · DV (1)
    return {
      modelo: "NFS-e",
      municipio_ou_uf: chave.slice(0, 7) === "1501402" ? "Belém/PA" : `município IBGE ${chave.slice(0, 7)}`,
      cnpj: chave.slice(9, 23),
      numero: String(Number(chave.slice(23, 36))),
      competencia: `${chave.slice(38, 40)}/20${chave.slice(36, 38)}`,
    };
  }
  return null;
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

  const atributo = ATRIBUTOS.find(([, r]) => r.test(p))?.[0];

  const chave = extrairChave(pergunta);
  if (chave) return { documentos: [], conteudo: null, pendencias: false, saudacao: false, chave, ficha: atributo ?? "geral" };

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

  // Um dado de um documento identificado por nome/número: ficha direto dos dados.
  if (atributo && termo && !SOBRE_TEXTO.test(p) && !pendencias) {
    return { documentos: [{ termo, tipo, ordem: "relevancia", limite: 4 }], conteudo: null, pendencias: false, saudacao: false, ficha: atributo };
  }

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
