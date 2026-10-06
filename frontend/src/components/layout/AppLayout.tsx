import clsx from "clsx";
import {
  Bell,
  CalendarClock,
  ChevronsLeft,
  ChevronsRight,
  FolderOpen,
  House,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  Sparkles,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
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
          "sticky top-0 hidden h-dvh shrink-0 bg-sidebar text-sidebar-text transition-[width] duration-200 lg:block",
          recolhida ? "w-[76px]" : "w-[268px]",
        )}
      >
        <BarraLateral recolhida={recolhida} aoAlternar={() => setRecolhida(!recolhida)} />
      </aside>

      <Gaveta aberta={menuAberto} aoFechar={() => setMenuAberto(false)} lado="esquerda" className="bg-sidebar text-sidebar-text">
        <BarraLateral aoNavegar={() => setMenuAberto(false)} />
      </Gaveta>

      <div className="min-w-0 flex-1">
        <BarraSuperior aoAbrirMenu={() => setMenuAberto(true)} />
        <main className="mx-auto w-full max-w-7xl px-4 pt-5 pb-28 sm:px-6 lg:px-10 lg:pt-7 lg:pb-14">
          <Outlet />
        </main>
      </div>

      <NavegacaoInferior />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Barra lateral
// ---------------------------------------------------------------------------
function BarraLateral({ recolhida = false, aoAlternar, aoNavegar }: { recolhida?: boolean; aoAlternar?: () => void; aoNavegar?: () => void }) {
  const { perfil, sair, podeCadastrar, ehAdmin, ehGestorOuAdmin } = useAuth();
  const painel = usePainel();
  const categorias = useCategorias();
  const [params] = useSearchParams();
  const local = useLocation();

  // Pasta raiz ativa (a categoria aberta pode ser uma subpasta).
  const raizAtiva = useMemo(() => {
    if (!local.pathname.startsWith("/documentos")) return null;
    const id = params.get("categoria");
    return achatarCategorias(categorias.data ?? []).find((c) => c.id === id)?.raiz_id ?? null;
  }, [categorias.data, params, local.pathname]);

  const alertas = (painel.data?.resumo.vencendo ?? 0) + (painel.data?.resumo.vencidos ?? 0);
  const principais: { para: string; rotulo: string; icone: LucideIcon; fim?: boolean; selo?: string | number; ativo?: boolean }[] = [
    { para: "/", rotulo: "Início", icone: House, fim: true },
    // Com uma pasta aberta, o destaque fica na pasta (abaixo), não em "Documentos".
    { para: "/documentos", rotulo: "Documentos", icone: FolderOpen, ativo: local.pathname.startsWith("/documentos") && !raizAtiva },
    { para: "/vencimentos", rotulo: "Vencimentos", icone: CalendarClock, selo: alertas || undefined },
    { para: "/assistente", rotulo: "Assistente IA", icone: Sparkles, selo: "IA" },
  ];

  const item = (ativo: boolean) =>
    clsx(
      "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] font-medium transition-colors",
      recolhida && "justify-center px-0",
      ativo ? "bg-sidebar-2 text-white" : "text-sidebar-muted hover:bg-sidebar-2/70 hover:text-sidebar-text",
    );
  const marcador = (ativo: boolean) =>
    ativo && <span className="absolute top-2 bottom-2 left-0 w-1 rounded-r-full bg-primary" aria-hidden />;

  return (
    <div className="flex h-full flex-col">
      <div className={clsx("flex items-center gap-2 px-4 pt-5 pb-4", recolhida && "justify-center px-0")}>
        <Link to="/" onClick={aoNavegar} className="flex min-w-0 items-center gap-2.5" aria-label="Gestão de Documentos — início">
          <img src="/favicon.svg" alt="" className="size-9 shrink-0 rounded-xl" />
          {!recolhida && (
            <span className="leading-tight">
              <span className="block text-[15px] font-bold text-white">Gestão de</span>
              <span className="block text-[15px] font-bold text-primary">Documentos</span>
            </span>
          )}
        </Link>
        {aoAlternar && !recolhida && (
          <button
            type="button"
            onClick={aoAlternar}
            className="ml-auto rounded-lg p-1.5 text-sidebar-muted hover:bg-sidebar-2 hover:text-white"
            aria-label="Recolher menu"
            title="Recolher menu"
          >
            <ChevronsLeft className="size-4" aria-hidden />
          </button>
        )}
      </div>

      {podeCadastrar && (
        <div className={clsx("px-4 pb-3", recolhida && "px-3")}>
          <Link
            to="/documentos/novo"
            onClick={aoNavegar}
            title="Novo documento"
            className={clsx(
              "flex h-11 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-ink shadow-[0_8px_20px_-8px_rgb(198_113_57/0.7)] transition hover:brightness-105",
            )}
          >
            <Plus className="size-5" aria-hidden />
            {!recolhida && "Novo documento"}
          </Link>
        </div>
      )}

      <nav className="rolagem-escura flex-1 overflow-y-auto px-3" aria-label="Menu principal">
        <ul className="space-y-0.5">
          {principais.map(({ para, rotulo, icone: Icone, fim, selo, ativo }) => (
            <li key={para}>
              <NavLink to={para} end={fim} onClick={aoNavegar} title={recolhida ? rotulo : undefined} className={({ isActive }) => item(ativo ?? isActive)}>
                {({ isActive }) => (
                  <>
                    {marcador(ativo ?? isActive)}
                    <Icone className="size-5 shrink-0" aria-hidden />
                    {!recolhida && <span className="flex-1">{rotulo}</span>}
                    {!recolhida && selo !== undefined && (
                      <span
                        className={clsx(
                          "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          typeof selo === "number" ? "bg-primary text-ink" : "bg-sidebar-line text-sidebar-text",
                        )}
                      >
                        {selo}
                      </span>
                    )}
                    {recolhida && typeof selo === "number" && <span className="absolute top-1.5 right-3 size-2 rounded-full bg-primary" aria-hidden />}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>

        <p className={clsx("mt-6 mb-2 px-3 text-[11px] font-semibold tracking-[0.12em] text-sidebar-muted/80 uppercase", recolhida && "sr-only")}>Pastas</p>
        <ul className="space-y-0.5">
          {(painel.data?.categorias ?? []).map((c) => {
            const ativo = raizAtiva === c.id;
            return (
              <li key={c.id}>
                <Link
                  to={`/documentos?categoria=${c.id}`}
                  onClick={aoNavegar}
                  title={recolhida ? `${c.nome} (${c.total})` : undefined}
                  className={item(ativo)}
                  aria-current={ativo ? "page" : undefined}
                >
                  {marcador(ativo)}
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: c.cor ? `${c.cor}40` : undefined }}>
                    <IconeCategoria icone={c.icone} className="size-4 text-sidebar-text" />
                  </span>
                  {!recolhida && (
                    <>
                      <span className="flex-1 truncate">{c.nome}</span>
                      <span className="text-xs text-sidebar-muted tabular-nums">{c.total}</span>
                    </>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="space-y-0.5 border-t border-sidebar-line px-3 pt-3 pb-4">
        {ehGestorOuAdmin && (
          <>
            <NavLink to="/lixeira" onClick={aoNavegar} title={recolhida ? "Lixeira" : undefined} className={({ isActive }) => item(isActive)}>
              <Trash2 className="size-5 shrink-0" aria-hidden />
              {!recolhida && "Lixeira"}
            </NavLink>
            <NavLink to="/configuracoes" onClick={aoNavegar} title={recolhida ? "Configurações" : undefined} className={({ isActive }) => item(isActive)}>
              <Settings className="size-5 shrink-0" aria-hidden />
              {!recolhida && (ehAdmin ? "Configurações" : "Cadastros")}
            </NavLink>
          </>
        )}

        <div className={clsx("mt-2 flex items-center gap-2.5 rounded-xl bg-sidebar-2 p-2", recolhida && "flex-col")}>
          <Link to="/perfil" onClick={aoNavegar} className="flex min-w-0 flex-1 items-center gap-2.5" title="Meu perfil">
            <Avatar nome={perfil?.nome ?? ""} />
            {!recolhida && (
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-white">{perfil?.nome}</span>
                <span className="block truncate text-xs text-sidebar-muted">{perfil ? ROTULO_PAPEL[perfil.papel] : ""}</span>
              </span>
            )}
          </Link>
          <button type="button" onClick={sair} className="rounded-lg p-2 text-sidebar-muted hover:bg-sidebar-line hover:text-white" aria-label="Sair" title="Sair">
            <LogOut className="size-[18px]" aria-hidden />
          </button>
        </div>

        {aoAlternar && recolhida && (
          <button
            type="button"
            onClick={aoAlternar}
            className="mt-2 flex w-full justify-center rounded-lg p-2 text-sidebar-muted hover:bg-sidebar-2 hover:text-white"
            aria-label="Expandir menu"
            title="Expandir menu"
          >
            <ChevronsRight className="size-4" aria-hidden />
          </button>
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
        "flex shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary-dark font-semibold text-white",
        grande ? "size-14 text-lg" : "size-9 text-sm",
      )}
    >
      {iniciais || "?"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Barra superior (busca global e alertas)
// ---------------------------------------------------------------------------
function BarraSuperior({ aoAbrirMenu }: { aoAbrirMenu: () => void }) {
  const { abrirPaleta } = usePaleta();
  const { perfil } = useAuth();
  const painel = usePainel();
  const alertas = (painel.data?.resumo.vencendo ?? 0) + (painel.data?.resumo.vencidos ?? 0);
  const ehMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <header className="sticky top-0 z-30 border-b border-line-soft/80 bg-surface/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-10">
        <button type="button" onClick={aoAbrirMenu} className="rounded-xl p-2 text-ink hover:bg-surface-2 lg:hidden" aria-label="Abrir menu">
          <Menu className="size-5" aria-hidden />
        </button>
        <Link to="/" className="lg:hidden" aria-label="Início">
          <img src="/favicon.svg" alt="" className="size-8 rounded-lg" />
        </Link>

        <button
          type="button"
          onClick={() => abrirPaleta()}
          className="group ml-auto flex h-10 w-10 items-center justify-center gap-3 rounded-xl text-ink-muted transition-colors hover:bg-surface-2 sm:ml-0 sm:w-full sm:max-w-md sm:justify-start sm:border sm:border-line-soft sm:bg-paper sm:px-3 sm:hover:border-primary/40 sm:hover:bg-paper"
          aria-label="Pesquisar (Ctrl+K)"
        >
          <Search className="size-[18px] shrink-0" aria-hidden />
          <span className="hidden flex-1 text-left text-sm sm:block">Pesquisar documentos, pastas, ações...</span>
          <span className="hidden items-center gap-1 sm:flex">
            <kbd className="tecla">{ehMac ? "⌘" : "Ctrl"}</kbd>
            <kbd className="tecla">K</kbd>
          </span>
        </button>

        <div className="flex items-center gap-1 sm:ml-auto">
          <Link
            to="/vencimentos"
            className="relative rounded-xl p-2.5 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label={alertas ? `${alertas} documento(s) vencendo ou vencidos` : "Vencimentos"}
            title="Vencimentos"
          >
            <Bell className="size-5" aria-hidden />
            {alertas > 0 && (
              <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-ink">
                {alertas > 99 ? "99+" : alertas}
              </span>
            )}
          </Link>
          <Link to="/perfil" className="rounded-full p-0.5 transition hover:ring-2 hover:ring-primary/30" aria-label="Meu perfil">
            <Avatar nome={perfil?.nome ?? ""} />
          </Link>
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Navegação inferior (celular)
// ---------------------------------------------------------------------------
function NavegacaoInferior() {
  const { podeCadastrar } = useAuth();
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
            to="/documentos/novo"
            aria-label="Novo documento"
            className="-mt-7 flex size-14 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-primary-dark text-white shadow-lg ring-4 ring-surface"
          >
            <Plus className="size-6" aria-hidden />
          </Link>
        )}
      </div>
      {itens.slice(2).map(link)}
    </nav>
  );
}
