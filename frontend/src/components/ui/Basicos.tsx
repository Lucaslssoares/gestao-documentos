import clsx from "clsx";
import { Inbox, LoaderCircle, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function Carregando({ texto = "Carregando...", className }: { texto?: string; className?: string }) {
  return (
    <div role="status" className={clsx("flex items-center justify-center gap-2 py-10 text-sm text-ink-muted", className)}>
      <LoaderCircle className="size-5 animate-spin text-primary" aria-hidden />
      {texto}
    </div>
  );
}

export function EstadoVazio({
  icone: Icone = Inbox,
  titulo,
  descricao,
  acao,
}: {
  icone?: LucideIcon;
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-surface-2 text-primary-dark">
        <Icone className="size-6" aria-hidden />
      </span>
      <p className="font-semibold text-ink">{titulo}</p>
      {descricao && <p className="mt-1 max-w-sm text-sm text-ink-muted">{descricao}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}

export function MensagemErro({ erro }: { erro: unknown }) {
  const texto = erro instanceof Error ? erro.message : "Algo deu errado. Tente novamente.";
  return (
    <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
      {texto}
    </div>
  );
}

export function CabecalhoPagina({ titulo, descricao, acoes }: { titulo: string; descricao?: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">{titulo}</h1>
        {descricao && <p className="mt-1 text-sm text-ink-muted">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  );
}

/** Rótulo + campo + mensagem de ajuda. */
export function Campo({
  rotulo,
  htmlFor,
  obrigatorio,
  ajuda,
  children,
  className,
}: {
  rotulo: string;
  htmlFor?: string;
  obrigatorio?: boolean;
  ajuda?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="rotulo">
        {rotulo}
        {obrigatorio && <span className="ml-0.5 text-primary-dark" aria-hidden>*</span>}
      </label>
      {children}
      {ajuda && <p className="mt-1 text-xs text-ink-muted">{ajuda}</p>}
    </div>
  );
}

export function Selo({ children, className, cor }: { children: ReactNode; className?: string; cor?: string | null }) {
  return (
    <span
      className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", !cor && "bg-surface-2 text-ink", className)}
      style={cor ? { backgroundColor: `${cor}1f`, color: cor, boxShadow: `inset 0 0 0 1px ${cor}40` } : undefined}
    >
      {children}
    </span>
  );
}

export function Abas<T extends string>({
  abas,
  ativa,
  aoTrocar,
}: {
  abas: { id: T; rotulo: string; contador?: number }[];
  ativa: T;
  aoTrocar: (id: T) => void;
}) {
  return (
    <div role="tablist" className="rolagem-fina -mx-1 flex gap-1 overflow-x-auto border-b border-line-soft px-1">
      {abas.map((aba) => (
        <button
          key={aba.id}
          role="tab"
          type="button"
          aria-selected={aba.id === ativa}
          onClick={() => aoTrocar(aba.id)}
          className={clsx(
            "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            aba.id === ativa ? "border-primary text-primary-dark" : "border-transparent text-ink-muted hover:text-ink",
          )}
        >
          {aba.rotulo}
          {aba.contador !== undefined && <span className="ml-1.5 rounded-full bg-surface-2 px-1.5 text-xs">{aba.contador}</span>}
        </button>
      ))}
    </div>
  );
}
