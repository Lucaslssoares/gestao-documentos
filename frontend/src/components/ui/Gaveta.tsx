import clsx from "clsx";
import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { BotaoIcone } from "./Botao";

/** Painel lateral (filtros, menu no celular) com <dialog> nativo: foco preso e Esc fecha. */
export function Gaveta({
  aberta,
  aoFechar,
  titulo,
  lado = "direita",
  children,
  rodape,
  className,
}: {
  aberta: boolean;
  aoFechar: () => void;
  titulo?: string;
  lado?: "direita" | "esquerda";
  children: ReactNode;
  rodape?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (aberta && !dialogo.open) dialogo.showModal();
    if (!aberta && dialogo.open) dialogo.close();
  }, [aberta]);

  return (
    <dialog
      ref={ref}
      onClose={aoFechar}
      onClick={(e) => {
        if (e.target === ref.current) aoFechar();
      }}
      className={clsx(
        "fixed inset-y-0 m-0 h-dvh max-h-dvh w-[min(92vw,380px)] max-w-none border-0 p-0 shadow-[var(--shadow-elevated)]",
        lado === "direita" ? "right-0 left-auto" : "left-0",
        className ?? "bg-paper text-ink",
      )}
    >
      {aberta && (
        <div className={clsx("flex h-full flex-col", lado === "direita" && "animate-deslizar")}>
          {titulo && (
            <div className="flex items-center justify-between border-b border-line-soft px-5 py-4">
              <h2 className="text-lg font-semibold">{titulo}</h2>
              <BotaoIcone icone={X} rotulo="Fechar" onClick={aoFechar} />
            </div>
          )}
          <div className="rolagem-fina flex-1 overflow-y-auto">{children}</div>
          {rodape && <div className="flex justify-end gap-2 border-t border-line-soft px-5 py-3">{rodape}</div>}
        </div>
      )}
    </dialog>
  );
}
