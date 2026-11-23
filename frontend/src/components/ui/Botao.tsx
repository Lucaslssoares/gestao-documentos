import clsx from "clsx";
import { LoaderCircle, type LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Dica } from "./Dica";

type Variante = "primario" | "secundario" | "fantasma" | "perigo";
type Tamanho = "sm" | "md";

const VARIANTES: Record<Variante, string> = {
  // Botão principal no verde escuro da marca: contraste AA com texto branco.
  primario: "bg-primary-dark text-white shadow-[0_6px_16px_-6px_rgb(78_122_28/0.55)] hover:bg-primary-deeper",
  secundario: "border border-line-soft bg-paper text-ink shadow-sm hover:border-line hover:bg-white",
  fantasma: "text-ink-muted hover:bg-surface-2/70 hover:text-ink",
  perigo: "bg-danger text-white hover:bg-danger/90",
};

const TAMANHOS: Record<Tamanho, string> = {
  sm: "h-8 gap-1.5 rounded-lg px-2.5 text-sm",
  md: "h-10 gap-2 rounded-xl px-4 text-[15px]",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamanho?: Tamanho;
  icone?: LucideIcon;
  carregando?: boolean;
  children?: ReactNode;
}

export function Botao({ variante = "primario", tamanho = "md", icone: Icone, carregando, disabled, className, children, ...props }: Props) {
  return (
    <button
      type="button"
      disabled={disabled || carregando}
      className={clsx(
        "inline-flex shrink-0 items-center justify-center font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100",
        VARIANTES[variante],
        TAMANHOS[tamanho],
        className,
      )}
      {...props}
    >
      {carregando ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : Icone ? <Icone className="size-4" aria-hidden /> : null}
      {children}
    </button>
  );
}

interface PropsIcone extends ButtonHTMLAttributes<HTMLButtonElement> {
  icone: LucideIcon;
  rotulo: string;
}

/** Botão só com ícone — o rótulo vira aria-label e dica (tooltip animada do Radix). */
export function BotaoIcone({ icone: Icone, rotulo, className, ...props }: PropsIcone) {
  return (
    <Dica texto={rotulo}>
    <button
      type="button"
      aria-label={rotulo}
      className={clsx(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-[color,background-color,transform] duration-150 hover:bg-surface-2/70 hover:text-ink active:scale-90 disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <Icone className="size-[18px]" aria-hidden />
    </button>
    </Dica>
  );
}
