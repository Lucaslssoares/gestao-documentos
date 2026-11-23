import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { useId } from "react";

/** Controle segmentado (ex.: lista/grade, atalhos de situação). */
export function Segmentado<T extends string>({
  opcoes,
  valor,
  aoMudar,
  rotulo,
  compacto,
}: {
  opcoes: { valor: T; rotulo: string; icone?: LucideIcon; contador?: number }[];
  valor: T;
  aoMudar: (valor: T) => void;
  rotulo: string;
  compacto?: boolean;
}) {
  // A pílula da opção ativa desliza entre as opções (layoutId do motion).
  const id = useId();
  return (
    <div role="radiogroup" aria-label={rotulo} className="inline-flex shrink-0 rounded-xl border border-line-soft bg-surface-2/50 p-1">
      {opcoes.map(({ valor: v, rotulo: r, icone: Icone, contador }) => {
        const ativo = v === valor;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={ativo}
            aria-label={compacto ? r : undefined}
            title={compacto ? r : undefined}
            onClick={() => aoMudar(v)}
            className={clsx(
              "relative inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
              ativo ? "text-ink" : "text-ink-muted hover:text-ink",
            )}
          >
            {ativo && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 -z-0 rounded-lg bg-paper shadow-sm" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            {Icone && <Icone className="relative size-4" aria-hidden />}
            {!compacto && <span className="relative">{r}</span>}
            {contador !== undefined && contador > 0 && (
              <span className={clsx("rounded-full px-1.5 text-xs tabular-nums", ativo ? "bg-warning-soft text-primary-dark" : "bg-surface-2")}>
                {contador}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
