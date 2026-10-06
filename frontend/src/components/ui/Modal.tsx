import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { BotaoIcone } from "./Botao";

/** Modal acessível com <dialog> nativo (foco preso, Esc fecha). */
export function Modal({
  aberto,
  aoFechar,
  titulo,
  children,
  rodape,
  largura = "max-w-lg",
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  children: ReactNode;
  rodape?: ReactNode;
  largura?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (aberto && !dialogo.open) dialogo.showModal();
    if (!aberto && dialogo.open) dialogo.close();
  }, [aberto]);

  return (
    <dialog
      ref={ref}
      onClose={aoFechar}
      onClick={(e) => {
        if (e.target === ref.current) aoFechar(); // clique no fundo
      }}
      className={`m-auto w-[calc(100%-2rem)] ${largura} rounded-2xl border border-line-soft bg-paper p-0 text-ink shadow-xl backdrop:bg-ink/40`}
    >
      {aberto && (
        <div className="flex max-h-[85dvh] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-line-soft px-5 py-3">
            <h2 className="text-lg font-semibold">{titulo}</h2>
            <BotaoIcone icone={X} rotulo="Fechar" onClick={aoFechar} />
          </div>
          <div className="rolagem-fina overflow-y-auto px-5 py-4">{children}</div>
          {rodape && <div className="flex justify-end gap-2 border-t border-line-soft px-5 py-3">{rodape}</div>}
        </div>
      )}
    </dialog>
  );
}
