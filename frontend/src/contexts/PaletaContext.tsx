import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { PaletaComandos } from "../components/layout/PaletaComandos";

interface ContextoPaleta {
  abrirPaleta: (termo?: string) => void;
}

const Contexto = createContext<ContextoPaleta | null>(null);

function digitandoEmCampo(alvo: EventTarget | null): boolean {
  const el = alvo as HTMLElement | null;
  return Boolean(el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)));
}

/** Disponibiliza a busca global e os atalhos Ctrl+K / "/" em toda a área logada. */
export function PaletaProvider({ children }: { children: ReactNode }) {
  const [aberta, setAberta] = useState(false);
  const [termoInicial, setTermoInicial] = useState("");

  const abrirPaleta = useCallback((termo = "") => {
    setTermoInicial(termo);
    setAberta(true);
  }, []);

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        abrirPaleta();
      } else if (e.key === "/" && !digitandoEmCampo(e.target)) {
        e.preventDefault();
        abrirPaleta();
      }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [abrirPaleta]);

  const valor = useMemo(() => ({ abrirPaleta }), [abrirPaleta]);

  return (
    <Contexto value={valor}>
      {children}
      <PaletaComandos aberta={aberta} aoFechar={() => setAberta(false)} termoInicial={termoInicial} />
    </Contexto>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePaleta(): ContextoPaleta {
  const contexto = use(Contexto);
  if (!contexto) throw new Error("usePaleta precisa estar dentro de <PaletaProvider>.");
  return contexto;
}
