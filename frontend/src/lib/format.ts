import type { CampoPersonalizado, Papel, Situacao, StatusProcessamento } from "./tipos";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const numero = new Intl.NumberFormat("pt-BR");

/** "2026-10-05" → "05/10/2026" (sem passar por fuso horário). */
export function formatarData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : "—";
}

export function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function formatarMoeda(valor: unknown): string {
  const n = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(n) ? moeda.format(n) : "—";
}

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/** Valor de um campo personalizado formatado conforme o tipo. */
export function formatarCampo(campo: Pick<CampoPersonalizado, "tipo">, valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  switch (campo.tipo) {
    case "moeda":
      return formatarMoeda(valor);
    case "numero":
      return typeof valor === "number" ? numero.format(valor) : String(valor);
    case "data":
      return formatarData(String(valor));
    case "booleano":
      return valor === true ? "Sim" : "Não";
    default:
      return String(valor);
  }
}

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  vigente: "Vigente",
  a_vencer: "A vencer",
  vencido: "Vencido",
  sem_validade: "Sem validade",
  arquivado: "Arquivado",
  cancelado: "Cancelado",
};

export const ROTULO_PAPEL: Record<Papel, string> = {
  admin: "Administrador",
  gestor: "Gestor",
  editor: "Editor",
  leitor: "Leitor",
};

export const DESCRICAO_PAPEL: Record<Papel, string> = {
  admin: "Acesso total, cadastros e usuários",
  gestor: "Cadastra, altera, move e exclui nas categorias liberadas",
  editor: "Cadastra, altera e substitui arquivos nas categorias liberadas",
  leitor: "Consulta, visualiza e baixa nas categorias liberadas",
};

export const ROTULO_PROCESSAMENTO: Record<StatusProcessamento, string> = {
  pendente: "Na fila",
  processando: "Processando",
  concluido: "Indexado",
  sem_texto: "Sem texto",
  erro: "Falha na indexação",
};

/** Texto curto do prazo: "vence em 10 dias", "venceu há 3 dias", "vence hoje". */
export function textoPrazo(dias: number | null | undefined): string | null {
  if (dias === null || dias === undefined) return null;
  if (dias === 0) return "vence hoje";
  if (dias === 1) return "vence amanhã";
  if (dias > 1) return `vence em ${dias} dias`;
  if (dias === -1) return "venceu ontem";
  return `venceu há ${Math.abs(dias)} dias`;
}

/** "agora", "há 5 min", "há 2 h", "ontem", "há 3 dias" ou a data. */
export function tempoRelativo(iso: string | null | undefined, agora = new Date()): string {
  if (!iso) return "—";
  const segundos = Math.round((agora.getTime() - new Date(iso).getTime()) / 1000);
  if (segundos < 60) return "agora";
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  return formatarData(iso.slice(0, 10));
}

/** Dia e mês abreviado para os blocos de data ("15", "out"). */
export function diaMes(iso: string | null | undefined): { dia: string; mes: string } {
  if (!iso) return { dia: "—", mes: "" };
  const [ano, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  const nome = new Date(ano!, mes! - 1, dia!).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return { dia: String(dia).padStart(2, "0"), mes: nome };
}

export function saudacao(agora = new Date()): string {
  const hora = agora.getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

export function hojeIso(deslocamentoDias = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + deslocamentoDias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
