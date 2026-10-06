import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import {
  ArrowRight,
  CalendarClock,
  CornerDownLeft,
  FilePlus2,
  Folder,
  LoaderCircle,
  Search,
  Settings,
  Sparkles,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../contexts/AuthContext";
import { api, qs } from "../../lib/api";
import { achatarCategorias, useCategorias } from "../../lib/consultas";
import type { ResultadoPesquisa } from "../../lib/tipos";
import { IconeArquivo, SituacaoBadge } from "../documentos/Indicadores";

interface Item {
  id: string;
  grupo: "Documentos" | "Pastas" | "Ações";
  titulo: string;
  detalhe?: string;
  destino: string;
  icone?: LucideIcon;
  mime?: string;
  situacao?: Parameters<typeof SituacaoBadge>[0]["situacao"];
}

const normalizar = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

/** Busca global (Ctrl+K): documentos em tempo real, pastas e ações rápidas. */
export function PaletaComandos({ aberta, aoFechar, termoInicial }: { aberta: boolean; aoFechar: () => void; termoInicial: string }) {
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
      aria-label="Pesquisar no sistema"
      className="mx-auto mt-[10vh] w-[calc(100%-1.5rem)] max-w-2xl rounded-2xl border border-line-soft bg-paper p-0 text-ink shadow-[var(--shadow-elevated)]"
    >
      {aberta && <ConteudoPaleta aoFechar={aoFechar} termoInicial={termoInicial} />}
    </dialog>
  );
}

function ConteudoPaleta({ aoFechar, termoInicial }: { aoFechar: () => void; termoInicial: string }) {
  const navigate = useNavigate();
  const { podeCadastrar, ehGestorOuAdmin } = useAuth();
  const categorias = useCategorias();
  const [termo, setTermo] = useState(termoInicial);
  const [termoBusca, setTermoBusca] = useState(termoInicial.trim());
  const [ativo, setAtivo] = useState(0);
  const lista = useRef<HTMLDivElement>(null);

  // Aguarda uma pausa na digitação antes de consultar a API.
  useEffect(() => {
    const t = setTimeout(() => setTermoBusca(termo.trim()), 200);
    return () => clearTimeout(t);
  }, [termo]);

  const documentos = useQuery({
    queryKey: ["paleta", termoBusca],
    queryFn: () => api<ResultadoPesquisa>(`/documentos${qs({ q: termoBusca, por_pagina: 6 })}`),
    enabled: termoBusca.length >= 2,
    staleTime: 30_000,
  });

  const itens = useMemo<Item[]>(() => {
    const t = normalizar(termo.trim());
    const docs: Item[] =
      t.length >= 2
        ? (documentos.data?.itens ?? []).map((d) => ({
            id: `doc-${d.id}`,
            grupo: "Documentos",
            titulo: d.titulo,
            detalhe: `${d.tipo_nome} · ${d.categoria_caminho}`,
            destino: `/documentos/${d.id}`,
            mime: d.mime_type,
            situacao: d.situacao,
          }))
        : [];

    const pastas: Item[] = achatarCategorias(categorias.data ?? [])
      .filter((c) => (t ? normalizar(c.caminho).includes(t) : c.nivel === 1))
      .slice(0, t ? 5 : 8)
      .map((c) => ({
        id: `pasta-${c.id}`,
        grupo: "Pastas",
        titulo: c.nome,
        detalhe: c.nivel > 1 ? c.caminho : `${c.total} documento(s)`,
        destino: `/documentos?categoria=${c.id}`,
        icone: Folder,
      }));

    const acoes: Item[] = [
      ...(t
        ? [
            { id: "todos", grupo: "Ações" as const, titulo: `Ver todos os resultados para “${termo.trim()}”`, destino: `/documentos?q=${encodeURIComponent(termo.trim())}`, icone: Search },
            { id: "ia", grupo: "Ações" as const, titulo: `Perguntar ao assistente: “${termo.trim()}”`, destino: `/assistente?q=${encodeURIComponent(termo.trim())}`, icone: Sparkles },
          ]
        : []),
      ...(podeCadastrar ? [{ id: "novo", grupo: "Ações" as const, titulo: "Enviar novo documento", destino: "/documentos/novo", icone: FilePlus2 }] : []),
      { id: "venc", grupo: "Ações" as const, titulo: "Ver vencimentos", destino: "/vencimentos", icone: CalendarClock },
      ...(ehGestorOuAdmin
        ? [
            { id: "lixeira", grupo: "Ações" as const, titulo: "Abrir a lixeira", destino: "/lixeira", icone: Trash2 },
            { id: "config", grupo: "Ações" as const, titulo: "Configurações e cadastros", destino: "/configuracoes", icone: Settings },
          ]
        : []),
    ].filter((a) => !t || a.id === "todos" || a.id === "ia" || normalizar(a.titulo).includes(t));

    return [...docs, ...pastas, ...acoes];
  }, [termo, documentos.data, categorias.data, podeCadastrar, ehGestorOuAdmin]);

  const indice = Math.min(ativo, Math.max(itens.length - 1, 0));

  function abrir(item: Item | undefined) {
    if (!item) return;
    aoFechar();
    navigate(item.destino);
  }

  function aoTeclar(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAtivo((i) => Math.min(i + 1, itens.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      abrir(itens[indice]);
    }
  }

  useEffect(() => {
    lista.current?.querySelector(`[data-indice="${indice}"]`)?.scrollIntoView({ block: "nearest" });
  }, [indice]);

  const grupos = ["Documentos", "Pastas", "Ações"] as const;
  const buscando = termoBusca.length >= 2 && documentos.isFetching;

  return (
    <div className="flex max-h-[70dvh] flex-col">
      <div className="flex items-center gap-3 border-b border-line-soft px-4">
        {buscando ? <LoaderCircle className="size-5 animate-spin text-primary" aria-hidden /> : <Search className="size-5 text-ink-muted" aria-hidden />}
        <input
          autoFocus
          value={termo}
          onChange={(e) => {
            setTermo(e.target.value);
            setAtivo(0);
          }}
          onKeyDown={aoTeclar}
          placeholder="Pesquisar documentos, pastas ou ações..."
          aria-label="Pesquisar"
          role="combobox"
          aria-expanded="true"
          aria-controls="paleta-resultados"
          aria-activedescendant={itens[indice] ? `paleta-${itens[indice]!.id}` : undefined}
          className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-ink-muted/70"
        />
        <kbd className="tecla text-ink-muted">Esc</kbd>
      </div>

      <div ref={lista} id="paleta-resultados" role="listbox" className="rolagem-fina overflow-y-auto p-2">
        {termoBusca.length >= 2 && !documentos.isFetching && documentos.data?.total === 0 && (
          <p className="px-3 py-2 text-sm text-ink-muted">Nenhum documento encontrado para “{termoBusca}”.</p>
        )}
        {grupos.map((grupo) => {
          const doGrupo = itens.map((item, i) => ({ item, i })).filter(({ item }) => item.grupo === grupo);
          if (doGrupo.length === 0) return null;
          return (
            <div key={grupo} className="mb-1">
              <p className="px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-ink-muted uppercase">{grupo}</p>
              {doGrupo.map(({ item, i }) => (
                <button
                  key={item.id}
                  id={`paleta-${item.id}`}
                  type="button"
                  role="option"
                  aria-selected={i === indice}
                  data-indice={i}
                  onMouseMove={() => setAtivo(i)}
                  onClick={() => abrir(item)}
                  className={clsx(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                    i === indice ? "bg-warning-soft" : "hover:bg-surface-2/50",
                  )}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-primary-dark">
                    {item.mime ? <IconeArquivo mime={item.mime} /> : item.icone ? <item.icone className="size-[18px]" aria-hidden /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{item.titulo}</span>
                    {item.detalhe && <span className="block truncate text-xs text-ink-muted">{item.detalhe}</span>}
                  </span>
                  {item.situacao && <SituacaoBadge situacao={item.situacao} />}
                  {i === indice ? <CornerDownLeft className="size-4 text-primary-dark" aria-hidden /> : <ArrowRight className="size-4 text-transparent" aria-hidden />}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 border-t border-line-soft px-4 py-2 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-1">
          <kbd className="tecla">↑</kbd>
          <kbd className="tecla">↓</kbd> navegar
        </span>
        <span className="inline-flex items-center gap-1">
          <kbd className="tecla">Enter</kbd> abrir
        </span>
        <span className="ml-auto">Pesquisa no nome, nos campos e no conteúdo dos arquivos</span>
      </div>
    </div>
  );
}
