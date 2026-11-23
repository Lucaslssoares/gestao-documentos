import clsx from "clsx";
import { ArrowLeft, FolderOpen, ListChecks, LogOut, Search, Settings, Sparkles, Trash2, UserRound, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { PaletaProvider, usePaleta } from "../../contexts/PaletaContext";
import { useAuth } from "../../contexts/AuthContext";
import { ROTULO_PAPEL } from "../../lib/format";

/**
 * Navegação Hub-and-Spoke: o Início é o hub (busca, pendências e um cartão por módulo).
 * Cada módulo (spoke) abre em tela cheia com "← Início" no topo; para trocar de módulo,
 * a pessoa volta ao hub. Não há menu lateral.
 */
const MODULOS: { prefixo: string; titulo: string; icone: LucideIcon }[] = [
  { prefixo: "/documentos", titulo: "Documentos", icone: FolderOpen },
  { prefixo: "/pendencias", titulo: "Pendências", icone: ListChecks },
  { prefixo: "/assistente", titulo: "Assistente IA", icone: Sparkles },
  { prefixo: "/lixeira", titulo: "Lixeira", icone: Trash2 },
  { prefixo: "/configuracoes", titulo: "Configurações", icone: Settings },
  { prefixo: "/perfil", titulo: "Meu perfil", icone: UserRound },
];

export function AppLayout() {
  return (
    <PaletaProvider>
      <Estrutura />
    </PaletaProvider>
  );
}

function Estrutura() {
  const local = useLocation();
  const modulo = MODULOS.find((m) => local.pathname.startsWith(m.prefixo)) ?? null;

  return (
    <div className="min-h-dvh">
      <BarraSuperior modulo={modulo} />
      <main className="mx-auto w-full max-w-7xl px-4 pt-5 pb-14 sm:px-6 lg:px-8 lg:pt-7">
        <Outlet />
      </main>
    </div>
  );
}

export function Avatar({ nome, grande }: { nome: string; grande?: boolean }) {
  const iniciais = nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <span
      className={clsx(
        "flex shrink-0 items-center justify-center rounded-full bg-primary-dark font-semibold text-white",
        grande ? "size-14 text-lg" : "size-8 text-xs",
      )}
    >
      {iniciais || "?"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Barra superior: marca no hub; "← Início" + nome do módulo nos spokes
// ---------------------------------------------------------------------------
function BarraSuperior({ modulo }: { modulo: (typeof MODULOS)[number] | null }) {
  const { abrirPaleta } = usePaleta();
  const ehMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <header className="sticky top-0 z-30 border-b border-line-soft bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        {modulo ? (
          <>
            <Link
              to="/"
              className="flex h-9 items-center gap-1.5 rounded-lg border border-line-soft bg-paper pr-3 pl-2 text-sm font-medium text-ink-muted shadow-xs transition-colors hover:border-primary/40 hover:bg-success-faint hover:text-primary-dark"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Início
            </Link>
            <span className="h-5 w-px bg-line-soft" aria-hidden />
            <span className="flex min-w-0 items-center gap-2 font-semibold">
              <modulo.icone className="size-[18px] shrink-0 text-primary-dark" aria-hidden />
              <span className="truncate">{modulo.titulo}</span>
            </span>
          </>
        ) : (
          <Link to="/" className="flex items-center gap-2.5" aria-label="Gestão de Documentos — início">
            <img src="/favicon.svg" alt="" className="size-9 rounded-xl" />
            <span className="hidden leading-tight sm:block">
              <span className="block text-[15px] font-bold">Gestão de</span>
              <span className="block text-[15px] font-bold text-primary-dark">Documentos</span>
            </span>
          </Link>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => abrirPaleta()}
            className="flex h-9 items-center gap-2.5 rounded-lg border border-line-soft bg-surface px-2.5 text-ink-muted transition-colors hover:border-primary/40 hover:bg-paper sm:w-64 sm:px-3"
            aria-label="Pesquisar (Ctrl+K)"
          >
            <Search className="size-4 shrink-0" aria-hidden />
            <span className="hidden flex-1 text-left text-sm sm:block">Pesquisar...</span>
            <span className="hidden items-center gap-1 sm:flex">
              <kbd className="tecla">{ehMac ? "⌘" : "Ctrl"}</kbd>
              <kbd className="tecla">K</kbd>
            </span>
          </button>
          <MenuUsuario />
        </div>
      </div>
    </header>
  );
}

function MenuUsuario() {
  const { perfil, sair, ehAdmin, ehGestorOuAdmin } = useAuth();
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const fechar = () => setAberto(false);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setAberto(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  const opcao = "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink hover:bg-surface-2";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        className="flex items-center gap-2 rounded-lg border border-line-soft bg-paper py-0.5 pr-1 pl-0.5 shadow-xs transition-colors hover:border-primary/40 hover:bg-success-faint sm:pl-2.5"
      >
        <span className="hidden min-w-0 flex-col items-end text-right leading-tight sm:flex">
          <span className="max-w-40 truncate text-[13px] font-medium text-ink">{perfil?.nome}</span>
          <span className="text-[11px] text-ink-muted">{perfil ? ROTULO_PAPEL[perfil.papel] : ""}</span>
        </span>
        <Avatar nome={perfil?.nome ?? ""} />
      </button>

      {aberto && (
        <div role="menu" className="absolute top-full right-0 z-40 mt-2 w-60 animate-surgir rounded-xl border border-line-soft bg-paper p-1.5 shadow-[var(--shadow-elevated)]">
          <div className="flex items-center gap-3 px-3 py-2.5">
            <Avatar nome={perfil?.nome ?? ""} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{perfil?.nome}</span>
              <span className="block truncate text-xs text-ink-muted">{perfil?.email}</span>
            </span>
          </div>
          <div className="my-1 h-px bg-line-soft" />
          <Link to="/perfil" role="menuitem" onClick={fechar} className={opcao}>
            <UserRound className="size-4 text-ink-muted" aria-hidden /> Meu perfil
          </Link>
          {ehGestorOuAdmin && (
            <Link to="/configuracoes" role="menuitem" onClick={fechar} className={opcao}>
              <Settings className="size-4 text-ink-muted" aria-hidden /> {ehAdmin ? "Configurações" : "Cadastros"}
            </Link>
          )}
          <div className="my-1 h-px bg-line-soft" />
          <button type="button" role="menuitem" onClick={sair} className={clsx(opcao, "text-danger hover:bg-danger-soft")}>
            <LogOut className="size-4" aria-hidden /> Sair
          </button>
        </div>
      )}
    </div>
  );
}
