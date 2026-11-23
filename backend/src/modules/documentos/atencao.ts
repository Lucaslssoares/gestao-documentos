import type { CampoPersonalizado } from "../../types/dominio.js";

/**
 * "O que falta" num documento: regras simples (sem IA) que apontam o que deixa o
 * documento incompleto ou em risco. Mostrado na tela do documento e usado pelo assistente.
 */
export interface PontoAtencao {
  codigo: string;
  nivel: "alerta" | "info";
  texto: string;
}

export interface DocumentoParaAtencao {
  data_validade: string | null;
  situacao: string;
  dias_para_vencer: number | null;
  responsavel_id: string | null;
  proxima_revisao: string | null;
  aprovacao: string;
  aprovacao_solicitada_em: string | null;
  comentario_aprovacao: string | null;
  status_processamento: string;
  metadados: Record<string, unknown>;
  tipo: { nome: string; exige_validade: boolean; campos: CampoPersonalizado[] };
  pendencias: { prazo: string | null; concluida_em: string | null }[];
}

const formatarData = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const vazio = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

export function pontosDeAtencao(doc: DocumentoParaAtencao, hojeIso: string): PontoAtencao[] {
  const pontos: PontoAtencao[] = [];
  const abertas = doc.pendencias.filter((p) => !p.concluida_em);

  if (doc.aprovacao === "reprovado") {
    pontos.push({
      codigo: "reprovado",
      nivel: "alerta",
      texto: `Documento reprovado${doc.comentario_aprovacao ? `: "${doc.comentario_aprovacao}"` : ""}. Envie uma nova versão corrigida.`,
    });
  }
  if (doc.aprovacao === "pendente" && doc.aprovacao_solicitada_em) {
    const dias = Math.floor((Date.parse(`${hojeIso}T12:00:00Z`) - Date.parse(doc.aprovacao_solicitada_em)) / 86_400_000);
    if (dias > 7) pontos.push({ codigo: "aprovacao_parada", nivel: "alerta", texto: `Aguardando aprovação há ${dias} dias.` });
  }

  if (doc.tipo.exige_validade && !doc.data_validade) {
    pontos.push({ codigo: "sem_validade", nivel: "alerta", texto: `Informe a data de validade: o tipo "${doc.tipo.nome}" exige.` });
  }
  if ((doc.situacao === "vencido" || doc.situacao === "a_vencer") && !abertas.some((p) => p.prazo)) {
    const quando =
      doc.situacao === "vencido" ? `Venceu em ${formatarData(doc.data_validade!)}` : `Vence em ${formatarData(doc.data_validade!)}`;
    pontos.push({ codigo: "sem_plano_renovacao", nivel: "alerta", texto: `${quando} e não há prazo de renovação. Crie um prazo para não perder a data.` });
  }

  const atrasadas = abertas.filter((p) => p.prazo && p.prazo < hojeIso).length;
  if (atrasadas > 0) pontos.push({ codigo: "pendencias_atrasadas", nivel: "alerta", texto: `${atrasadas} pendência(s) atrasada(s).` });

  if (doc.proxima_revisao && doc.proxima_revisao < hojeIso) {
    pontos.push({ codigo: "revisao_atrasada", nivel: "alerta", texto: `Revisão periódica atrasada desde ${formatarData(doc.proxima_revisao)}.` });
  }

  const faltando = doc.tipo.campos.filter((c) => c.obrigatorio && vazio(doc.metadados[c.chave])).map((c) => c.rotulo);
  if (faltando.length) pontos.push({ codigo: "campos_obrigatorios", nivel: "alerta", texto: `Preencha: ${faltando.join(", ")}.` });

  if (!doc.responsavel_id) {
    pontos.push({ codigo: "sem_responsavel", nivel: "info", texto: "Defina um responsável para que alguém receba os avisos de prazo." });
  }
  if (doc.status_processamento === "erro") {
    pontos.push({ codigo: "erro_indexacao", nivel: "info", texto: "Não foi possível ler o texto do arquivo: a busca pelo conteúdo não encontra este documento." });
  } else if (doc.status_processamento === "sem_texto") {
    pontos.push({ codigo: "sem_texto", nivel: "info", texto: "O arquivo não tem texto pesquisável (ex.: imagem escaneada). Busque pelo nome ou pelos campos." });
  }
  return pontos;
}
