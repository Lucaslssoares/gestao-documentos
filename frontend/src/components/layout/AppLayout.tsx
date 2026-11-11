import clsx from "clsx";
import {
  Bell,
  CalendarClock,
  ChevronDown,
  FolderOpen,
  House,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  Sparkles,
  Trash2,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useSearchParams } from "react-router";
import { PaletaProvider, usePaleta } from "../../contexts/PaletaContext";
import { useAuth } from "../../contexts/AuthContext";
import { achatarCategorias, useCategorias, usePainel } from "../../lib/consultas";
import { ROTULO_PAPEL } from "../../lib/format";
import { usePreferencia } from "../../lib/preferencias";
import { IconeCategoria } from "../documentos/Indicadores";
import { Gaveta } from "../ui/Gaveta";

export function AppLayout() {
  return (
    <PaletaProvider>
      <Estrutura />
    </PaletaProvider>
  );
}

function Estrutura() {
  const [recolhida, setRecolhida] = usePreferencia("barra-recolhida", false);
  const [menuAberto, setMenuAberto] = useState(false);

  return (
    <div className="min-h-dvh lg:flex">
      <aside
        className={clsx(
          "sticky top-0 hidden h-dvh shrink-0 border-r border-sidebar-line/70 bg-sidebar text-sidebar-text transition-[width] duration-200 lg:block",
          recolhida ? "w-[76px]" : "w-[264px]",
        )}
      >
        <BarraLateral recolhida={recolhida} />
      </aside>

      <Gaveta aberta={menuAberto} aoFechar={() => setMenuAberto(false)} lado="esquerda" className="bg-sidebar text-sidebar-text">
        <BarraLateral aoNavegar={() => setMenuAberto(false)} />
      </Gaveta>

      <div className="min-w-0 flex-1">
        <BarraSuperior recolhida={recolhida} aoAlternarBarra={() => setRecolhida(!recolhida)} aoAbrirMenu={() => setMenuAberto(true)} />
        <main className="mx-auto w-full max-w-7xl px-4 pt-5 pb-28 sm:px-6 lg:px-8 lg:pt-6 lg:pb-14">
          <Outlet />
        </main>
      </div>

      <NavegacaoInferior />
    </div>
  );
}

/** Pasta aberta na tela de documentos (para destacar no menu e cadastrar já nela). */
function usePastaAtual() {
  const categorias = useCategorias();
  const [params] = useSearchParams();
  const local = useLocation();
  return useMemo(() => {
    if (!local.pathname.startsWith("/documentos")) return null;
    const id = params.get("categoria");
    return achatarCategorias(categorias.data ?? []).find((c) => c.id === id) ?? null;
  }, [categorias.data, params, local.pathname]);
}

// ---------------------------------------------------------------------------
// Barra lateral (mesmo desenho do portal BBB: verde-floresta, item ativo em verde)
// ---------------------------------------------------------------------------
function BarraLateral({ recolhida = false, aoNavegar }: { recolhida?: boolean; aoNavegar?: () => void }) {
  const { ehAdmin, ehGestorOuAdmin } = useAuth();
  const painel = usePainel();
  const local = useLocation();
  const pasta = usePastaAtual();
  const [pastasAbertas, setPastasAbertas] = usePreferencia("menu-pastas-aberto", true);

  const raizAtiva = pasta?.raiz_id ?? null;
  const emDocumentos = local.pathname.startsWith("/documentos");
  const alertas = (painel.data?.resumo.vencendo ?? 0) + (painel.data?.resumo.vencidos ?? 0);

  const item = (ativo: boolean) =>
    clsx(
      "group relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
      recolhida && "justify-center px-0",
      ativo ? "bg-primary text-white shadow-sm" : "text-sidebar-text/75 hover:bg-sidebar-2/80 hover:text-sidebar-text",
    );

  const contador = (valor: number) => (
    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-white tabular-nums">{valor > 99 ? "99+" : valor}</span>
  );

  return (
    <div className="flex h-full flex-col">
      <Link
        to="/"
        onClick={aoNavegar}
        className={clsx("flex items-center gap-3 px-4 pt-4 pb-5", recolhida && "justify-center px-0")}
        aria-label="Gestão de Documentos — início"
      >
        <img src="/favicon.svg" alt="" className="size-10 shrink-0 rounded-xl shadow-sm" />
        {!recolhida && (
          <span className="min-w-0 leading-tight">
            <span className="block text-[15px] font-bold text-white">Gestão de</span>
            <span className="block text-[15px] font-bold text-primary">Documentos</span>
          </span>
        )}
      </Link>

      <nav className="rolagem-escura flex-1 overflow-y-auto px-3" aria-label="Menu principal">
        <ul className="space-y-1">
          <li>
            <NavLink to="/" end onClick={aoNavegar} title={recolhida ? "Início" : undefined} className={({ isActive }) => item(isActive)}>
              <House className="size-[18px] shrink-0" aria-hidden />
              {!recolhida && "Início"}
            </NavLink>
          </li>

          {/* Documentos com as pastas logo abaixo, como no menu em árvore do portal. */}
          <li>
            <div className="flex items-center gap-1">
              <Link
                to="/documentos"
                onClick={aoNavegar}
                title={recolhida ? "Documentos" : undefined}
                className={clsx(item(emDocumentos && !raizAtiva), "flex-1")}
                aria-current={emDocumentos && !raizAtiva ? "page" : undefined}
              >
                <FolderOpen className="size-[18px] shrink-0" aria-hidden />
                {!recolhida && "Documentos"}
              </Link>
              {!recolhida && (
                <button
                  type="button"
                  onClick={() => setPastasAbertas(!pastasAbertas)}
                  className="flex size-8 items-center justify-center rounded-lg text-sidebar-muted hover:bg-sidebar-2/80 hover:text-white"
                  aria-expanded={pastasAbertas}
                  aria-label={pastasAbertas ? "Esconder pastas" : "Mostrar pastas"}
                >
                  <ChevronDown className={clsx("size-4 transition-transform", !pastasAbertas && "-rotate-90")} aria-hidden />
                </button>
              )}
            </div>
            {!recolhida && pastasAbertas && (
              <ul className="mt-1 ml-5 space-y-0.5 border-l border-sidebar-line pl-2.5">
                {(painel.data?.categorias ?? []).map((c) => {
                  const ativo = raizAtiva === c.id;
                  return (
                    <li key={c.id}>
                      <Link
                        to={`/documentos?categoria=${c.id}`}
                        onClick={aoNavegar}
                        aria-current={ativo ? "page" : undefined}
                        className={clsx(
                          "flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors",
                          ativo ? "bg-sidebar-2 font-semibold text-white" : "text-sidebar-text/65 hover:bg-sidebar-2/60 hover:text-sidebar-text",
                        )}
                      >
                        <IconeCategoria icone={c.icone} className={clsx("size-4", ativo ? "text-primary" : "text-sidebar-muted")} />
                        <span className="flex-1 truncate">{c.nome}</span>
                        <span className="text-[11px] text-sidebar-muted tabular-nums">{c.total}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>

          <li>
            <NavLink to="/vencimentos" onClick={aoNavegar} title={recolhida ? "Vencimentos" : undefined} className={({ isActive }) => item(isActive)}>
              <CalendarClock className="size-[18px] shrink-0" aria-hidden />
              {!recolhida && <span className="flex-1">Vencimentos</span>}
              {!recolhida && alertas > 0 && contador(alertas)}
              {recolhida && alertas > 0 && <span className="absolute top-1.5 right-3 size-2 rounded-full bg-accent" aria-hidden />}
            </NavLink>
          </li>
          <li>
            <NavLink to="/assistente" onClick={aoNavegar} title={recolhida ? "Assistente IA" : undefined} className={({ isActive }) => item(isActive)}>
              <Sparkles className="size-[18px] shrink-0" aria-hidden />
              {!recolhida && "Assistente IA"}
            </NavLink>
          </li>
        </ul>
      </nav>

      <div className="space-y-1 border-t border-sidebar-line px-3 pt-3 pb-3">
        {ehGestorOuAdmin && (
          <>
            <NavLink to="/lixeira" onClick={aoNavegar} title={recolhida ? "Lixeira" : undefined} className={({ isActive }) => item(isActive)}>
              <Trash2 className="size-[18px] shrink-0" aria-hidden />
              {!recolhida && "Lixeira"}
            </NavLink>
            <NavLink to="/configuracoes" onClick={aoNavegar} title={recolhida ? "Configurações" : undefined} className={({ isActive }) => item(isActive)}>
              <Settings className="size-[18px] shrink-0" aria-hidden />
              {!recolhida && (ehAdmin ? "Configurações" : "Cadastros")}
            </NavLink>
          </>
        )}
      </div>
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
// Barra superior: recolher menu, busca global, novo documento, alertas e conta
// ---------------------------------------------------------------------------
function BarraSuperior({ recolhida, aoAlternarBarra, aoAbrirMenu }: { recolhida: boolean; aoAlternarBarra: () => void; aoAbrirMenu: () => void }) {
  const { abrirPaleta } = usePaleta();
  const { podeCadastrar } = useAuth();
  const painel = usePainel();
  const pasta = usePastaAtual();
  const alertas = (painel.data?.resumo.vencendo ?? 0) + (painel.data?.resumo.vencidos ?? 0);
  const ehMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  const botaoBorda =
    "flex size-9 items-center justify-center rounded-lg border border-line-soft bg-paper text-ink-muted shadow-xs transition-colors hover:border-primary/40 hover:bg-success-faint hover:text-primary-dark";

  return (
    <header className="sticky top-0 z-30 border-b border-line-soft bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-2.5 px-4 sm:px-6 lg:px-8">
        <button type="button" onClick={aoAbrirMenu} className={clsx(botaoBorda, "lg:hidden")} aria-label="Abrir menu">
          <Menu className="size-[18px]" aria-hidden />
        </button>
        <button
          type="button"
          onClick={aoAlternarBarra}
          className={clsx(botaoBorda, "hidden lg:flex")}
          aria-label={recolhida ? "Expandir menu" : "Recolher menu"}
          title={recolhida ? "Expandir menu" : "Recolher menu"}
        >
          {recolhida ? <PanelLeftOpen className="size-[18px]" aria-hidden /> : <PanelLeftClose className="size-[18px]" aria-hidden />}
        </button>
        <Link to="/" className="lg:hidden" aria-label="Início">
          <img src="/favicon.svg" alt="" className="size-8 rounded-lg" />
        </Link>

        <button
          type="button"
          onClick={() => abrirPaleta()}
          className="group ml-auto flex h-9 w-9 items-center justify-center gap-2.5 rounded-lg text-ink-muted transition-colors hover:bg-surface-2 sm:ml-1 sm:w-full sm:max-w-sm sm:justify-start sm:border sm:border-line-soft sm:bg-surface sm:px-3 sm:hover:border-primary/40 sm:hover:bg-paper"
          aria-label="Pesquisar (Ctrl+K)"
        >
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="hidden flex-1 text-left text-sm sm:block">Pesquisar documentos...</span>
          <span className="hidden items-center gap-1 sm:flex">
            <kbd className="tecla">{ehMac ? "⌘" : "Ctrl"}</kbd>
            <kbd className="tecla">K</kbd>
          </span>
        </button>

        <div className="flex items-center gap-1.5 sm:ml-auto">
          {podeCadastrar && (
            <Link
              to={`/documentos/novo${pasta ? `?categoria=${pasta.id}` : ""}`}
              className="hidden h-9 items-center gap-2 rounded-lg bg-primary-dark px-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-deeper sm:inline-flex"
              title={pasta ? `Novo documento em ${pasta.nome}` : "Novo documento"}
            >
              <Plus className="size-4" aria-hidden />
              Novo documento
            </Link>
          )}
          <Link
            to="/vencimentos"
            className={clsx(botaoBorda, "relative")}
            aria-label={alertas ? `${alertas} documento(s) vencendo ou vencidos` : "Vencimentos"}
            title="Vencimentos"
          >
            <Bell className="size-[18px]" aria-hidden />
            {alertas > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white ring-2 ring-paper">
                {alertas > 99 ? "99+" : alertas}
              </span>
            )}
          </Link>
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

// ---------------------------------------------------------------------------
// Navegação inferior (celular)
// ---------------------------------------------------------------------------
function NavegacaoInferior() {
  const { podeCadastrar } = useAuth();
  const pasta = usePastaAtual();
  const itens: { para: string; rotulo: string; icone: LucideIcon; fim?: boolean }[] = [
    { para: "/", rotulo: "Início", icone: House, fim: true },
    { para: "/documentos", rotulo: "Documentos", icone: FolderOpen },
    { para: "/vencimentos", rotulo: "Prazos", icone: CalendarClock },
    { para: "/assistente", rotulo: "Assistente", icone: Sparkles },
  ];
  const link = ({ para, rotulo, icone: Icone, fim }: (typeof itens)[number]) => (
    <NavLink
      key={para}
      to={para}
      end={fim}
      className={({ isActive }) => clsx("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", isActive ? "text-primary-dark" : "text-ink-muted")}
    >
      <Icone className="size-[22px]" aria-hidden />
      {rotulo}
    </NavLink>
  );

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line-soft bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      aria-label="Menu principal"
    >
      {itens.slice(0, 2).map(link)}
      <div className="flex items-center justify-center">
        {podeCadastrar && (
          <Link
            to={`/documentos/novo${pasta ? `?categoria=${pasta.id}` : ""}`}
            aria-label="Novo documento"
            className="-mt-7 flex size-14 items-center justify-center rounded-2xl bg-primary-dark text-white shadow-lg ring-4 ring-surface"
          >
            <Plus className="size-6" aria-hidden />
          </Link>
        )}
      </div>
      {itens.slice(2).map(link)}
    </nav>
  );
}
