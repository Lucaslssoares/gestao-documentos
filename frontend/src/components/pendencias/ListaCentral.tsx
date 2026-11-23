import clsx from "clsx";
import { BadgeCheck, CalendarClock, Check, ListChecks, RefreshCcw, type LucideIcon } from "lucide-react";
import { Link } from "react-router";
import { formatarData, ROTULO_TIPO_ITEM, textoDias } from "../../lib/format";
import type { ItemCentral, TipoItemCentral } from "../../lib/tipos";
import { useConcluirPendencia } from "./useConcluirPendencia";

const ICONE: Record<TipoItemCentral, LucideIcon> = {
  acao: ListChecks,
  validade: CalendarClock,
  revisao: RefreshCcw,
  aprovacao: BadgeCheck,
};

const ESTILO_ESTADO = {
  atrasado: "bg-danger-soft text-danger",
  proximo: "bg-warning-soft text-warning-ink",
  futuro: "bg-surface-2 text-ink-muted",
} as const;

/** Lista da central de pendências (ações, validades, revisões e aprovações). */
export function ListaCentral({ itens, mostrarResponsavel }: { itens: ItemCentral[]; mostrarResponsavel?: boolean }) {
  const concluir = useConcluirPendencia();

  return (
    <ul className="divide-y divide-line-soft">
      {itens.map((item) => {
        const Icone = ICONE[item.tipo];
        const prazo = item.tipo === "aprovacao" ? "aguardando" : (textoDias(item.dias) ?? "sem prazo");
        return (
          <li key={item.chave} className="flex items-center gap-3 px-4 py-3 sm:px-5">
            <span className={clsx("flex size-9 shrink-0 items-center justify-center rounded-xl", ESTILO_ESTADO[item.estado])}>
              <Icone className="size-[18px]" aria-hidden />
            </span>
            <Link to={`/documentos/${item.documento_id}`} className="group min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold group-hover:text-primary-dark">{item.titulo}</span>
              <span className="block truncate text-xs text-ink-muted">
                {ROTULO_TIPO_ITEM[item.tipo]} · {item.documento_titulo}
                {mostrarResponsavel && item.responsavel_nome && ` · ${item.responsavel_nome}`}
              </span>
              <span className={clsx("block text-xs font-semibold sm:hidden", item.estado === "atrasado" ? "text-danger" : item.estado === "proximo" ? "text-warning-ink" : "text-ink-muted")}>
                {prazo}
                {item.data && ` · ${formatarData(item.data)}`}
              </span>
            </Link>
            <span className="hidden shrink-0 text-right text-xs sm:block">
              <span className={clsx("block font-semibold", item.estado === "atrasado" ? "text-danger" : item.estado === "proximo" ? "text-warning-ink" : "text-ink-muted")}>
                {prazo}
              </span>
              {item.data && <span className="block text-ink-muted">{formatarData(item.data)}</span>}
            </span>
            {item.tipo === "acao" && item.pendencia_id && (
              <button
                type="button"
                onClick={() => concluir.mutate({ id: item.pendencia_id!, concluida: true, documentoId: item.documento_id })}
                disabled={concluir.isPending}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line-soft text-ink-muted transition-colors hover:border-primary hover:bg-success-faint hover:text-primary-dark disabled:opacity-50"
                aria-label={`Concluir: ${item.titulo}`}
                title="Concluir"
              >
                <Check className="size-4" aria-hidden />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
