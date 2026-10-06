import clsx from "clsx";
import { FileCode, FileImage, FileText, Folder } from "lucide-react";
import { ICONES_CATEGORIA } from "../../lib/icones";
import { ROTULO_PROCESSAMENTO, ROTULO_SITUACAO, textoPrazo } from "../../lib/format";
import type { Situacao, StatusProcessamento } from "../../lib/tipos";

export function IconeCategoria({ icone, cor, className }: { icone: string | null; cor?: string | null; className?: string }) {
  const Icone = (icone && ICONES_CATEGORIA[icone]) || Folder;
  return <Icone className={clsx("size-5", className)} style={cor ? { color: cor } : undefined} aria-hidden />;
}

export function IconeArquivo({ mime, className }: { mime: string; className?: string }) {
  const Icone = mime.startsWith("image/") ? FileImage : mime.includes("xml") ? FileCode : FileText;
  return <Icone className={clsx("size-5", className)} aria-hidden />;
}

const ESTILO_SITUACAO: Record<Situacao, string> = {
  vigente: "bg-success-soft text-success",
  a_vencer: "bg-warning-soft text-warning-ink",
  vencido: "bg-danger-soft text-danger",
  sem_validade: "bg-surface-2 text-ink-muted",
  arquivado: "bg-surface-2 text-ink-muted",
  cancelado: "bg-surface-2 text-ink-muted line-through",
};

export function SituacaoBadge({ situacao, dias, detalhado }: { situacao: Situacao; dias?: number | null; detalhado?: boolean }) {
  const prazo = detalhado && (situacao === "a_vencer" || situacao === "vencido") ? textoPrazo(dias) : null;
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", ESTILO_SITUACAO[situacao])}>
      {ROTULO_SITUACAO[situacao]}
      {prazo && <span className="ml-1 font-normal">· {prazo}</span>}
    </span>
  );
}

const ESTILO_PROCESSAMENTO: Record<StatusProcessamento, string> = {
  pendente: "text-ink-muted",
  processando: "text-primary-dark",
  concluido: "text-success",
  sem_texto: "text-ink-muted",
  erro: "text-danger",
};

export function StatusProcessamentoTexto({ status }: { status: StatusProcessamento }) {
  return <span className={clsx("text-xs font-medium", ESTILO_PROCESSAMENTO[status])}>{ROTULO_PROCESSAMENTO[status]}</span>;
}
