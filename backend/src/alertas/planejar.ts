// Regras dos alertas por e-mail (puras, sem banco): quem recebe o quê e quando.
//
//   * entrou na janela de antecedência  → 1 aviso (a chave inclui a data: mudou o prazo, avisa de novo)
//   * vence hoje                         → 1 aviso
//   * atrasado                           → lembrete semanal até alguém concluir
//   * aprovação pendente                 → a cada 3 dias até o aprovador decidir

export type TipoItem = "acao" | "validade" | "revisao" | "aprovacao";
export type EstadoItem = "atrasado" | "proximo" | "futuro";

/** Linha da função central_pendencias() do banco. */
export interface ItemCentral {
  tipo: TipoItem;
  chave: string;
  documento_id: string;
  documento_titulo: string;
  titulo: string;
  data: string | null;
  dias: number | null;
  estado: EstadoItem;
  responsavel_id: string | null;
}

export type Motivo = "aviso" | "hoje" | "atrasado" | "aprovacao";

export interface Aviso {
  chave: string;
  responsavelId: string;
  motivo: Motivo;
  item: ItemCentral;
}

const DIA_MS = 86_400_000;

/** Semana ISO no formato 2026-W48. */
export function semanaIso(dataIso: string): string {
  const d = new Date(`${dataIso}T00:00:00Z`);
  const diaSemana = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - diaSemana);
  const inicioAno = Date.UTC(d.getUTCFullYear(), 0, 1);
  const semana = Math.ceil(((d.getTime() - inicioAno) / DIA_MS + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(semana).padStart(2, "0")}`;
}

/** Janela de 3 dias (mesmo valor durante 3 dias seguidos). */
export function janelaTresDias(dataIso: string): number {
  return Math.floor(Date.parse(`${dataIso}T00:00:00Z`) / DIA_MS / 3);
}

export function chaveAprovacao(documentoId: string, hojeIso: string): string {
  return `aprovacao:${documentoId}:${janelaTresDias(hojeIso)}`;
}

export function planejarAvisos(itens: ItemCentral[], hojeIso: string): Aviso[] {
  const avisos: Aviso[] = [];
  for (const item of itens) {
    if (!item.responsavel_id) continue;
    const base = { responsavelId: item.responsavel_id, item };

    if (item.tipo === "aprovacao") {
      avisos.push({ ...base, motivo: "aprovacao", chave: chaveAprovacao(item.documento_id, hojeIso) });
    } else if (item.data === null || item.dias === null) {
      continue; // ação sem prazo: aparece na central, mas não gera e-mail
    } else if (item.estado === "atrasado") {
      avisos.push({ ...base, motivo: "atrasado", chave: `${item.chave}:atrasado:${semanaIso(hojeIso)}` });
    } else if (item.dias === 0) {
      avisos.push({ ...base, motivo: "hoje", chave: `${item.chave}:hoje:${item.data}` });
    } else if (item.estado === "proximo") {
      avisos.push({ ...base, motivo: "aviso", chave: `${item.chave}:aviso:${item.data}` });
    }
  }
  return avisos;
}

/** Um e-mail por pessoa com todos os avisos dela. */
export function agruparPorResponsavel(avisos: Aviso[]): Map<string, Aviso[]> {
  const grupos = new Map<string, Aviso[]>();
  for (const a of avisos) grupos.set(a.responsavelId, [...(grupos.get(a.responsavelId) ?? []), a]);
  return grupos;
}

const ROTULO_MOTIVO: Record<Motivo, string> = {
  atrasado: "Atrasado",
  hoje: "Vence hoje",
  aviso: "Próximo",
  aprovacao: "Aguardando sua aprovação",
};

const formatarData = (iso: string) => iso.split("-").reverse().join("/");

/** Linha do e-mail: "[Atrasado] Protocolar renovação — Licença de operação (01/12/2026)". */
export function descreverAviso(aviso: Aviso): string {
  const { item } = aviso;
  const data = item.data ? ` (${formatarData(item.data)})` : "";
  const titulo = item.tipo === "acao" ? `${item.titulo} — ${item.documento_titulo}` : `${item.titulo}: ${item.documento_titulo}`;
  return `[${ROTULO_MOTIVO[aviso.motivo]}] ${titulo}${data}`;
}
