import { keepPreviousData, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { ChevronRight, Folder, LayoutGrid, List, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { IconeCategoria } from "../components/documentos/Indicadores";
import { GradeDocumentos, ListaDocumentos } from "../components/documentos/ListaDocumentos";
import { Botao } from "../components/ui/Botao";
import { Campo, Carregando, EstadoVazio, MensagemErro, Selo } from "../components/ui/Basicos";
import { Gaveta } from "../components/ui/Gaveta";
import { Segmentado } from "../components/ui/Segmentado";
import { useAuth } from "../contexts/AuthContext";
import { api, qs } from "../lib/api";
import { achatarCategorias, chaves, useCategorias, useEmpresas, useSetores, useTags, useTipos } from "../lib/consultas";
import { formatarData } from "../lib/format";
import { usePreferencia } from "../lib/preferencias";
import type { Categoria, ResultadoPesquisa, Situacao } from "../lib/tipos";

const POR_PAGINA = 24;
const FILTROS_GAVETA = ["tipo", "empresa", "setor", "tags", "data_de", "data_ate", "validade_ate"] as const;
type FiltroGaveta = (typeof FILTROS_GAVETA)[number];

const ATALHOS_SITUACAO: { valor: "" | Situacao; rotulo: string }[] = [
  { valor: "", rotulo: "Todos" },
  { valor: "vigente", rotulo: "Vigentes" },
  { valor: "a_vencer", rotulo: "A vencer" },
  { valor: "vencido", rotulo: "Vencidos" },
  { valor: "sem_validade", rotulo: "Sem validade" },
];

export default function DocumentosPage() {
  const { podeCadastrar } = useAuth();
  const [params, setParams] = useSearchParams();
  const [termo, setTermo] = useState(params.get("q") ?? "");
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [modo, setModo] = usePreferencia<"lista" | "grade">("modo-documentos", "lista");

  const categorias = useCategorias();
  const tipos = useTipos();
  const empresas = useEmpresas();
  const setores = useSetores();
  const tags = useTags();

  // Pesquisa com atraso curto enquanto digita.
  useEffect(() => {
    if (termo.trim() === (params.get("q") ?? "")) return;
    const t = setTimeout(() => atualizar({ q: termo.trim() || null }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termo]);

  function atualizar(mudancas: Record<string, string | null>, manterPagina = false) {
    const novos = new URLSearchParams(params);
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor) novos.set(chave, valor);
      else novos.delete(chave);
    }
    if (!manterPagina) novos.delete("pagina");
    setParams(novos, { replace: true });
  }

  const pagina = Number(params.get("pagina") ?? "1");
  const consulta = {
    q: params.get("q") ?? undefined,
    categoria: params.get("categoria") ?? undefined,
    situacao: params.get("situacao") ?? undefined,
    ordem: params.get("ordem") ?? undefined,
    ...Object.fromEntries(FILTROS_GAVETA.map((f) => [f, params.get(f) ?? undefined])),
    pagina,
    por_pagina: POR_PAGINA,
  };
  const resultado = useQuery({
    queryKey: [...chaves.documentos, consulta],
    queryFn: () => api<ResultadoPesquisa>(`/documentos${qs(consulta)}`),
    placeholderData: keepPreviousData,
  });

  // Pasta atual, caminho e subpastas
  const lista = useMemo(() => achatarCategorias(categorias.data ?? []), [categorias.data]);
  const atual = lista.find((c) => c.id === params.get("categoria"));
  const caminho = useMemo(() => {
    const trilha: Categoria[] = [];
    let no = atual;
    while (no) {
      trilha.unshift(no);
      no = lista.find((c) => c.id === no!.parent_id);
    }
    return trilha;
  }, [atual, lista]);
  const subpastas = atual ? atual.filhos : (categorias.data ?? []);
  const mostrarPastas = !params.get("q") && pagina === 1 && subpastas.length > 0;

  const totalPaginas = Math.max(1, Math.ceil((resultado.data?.total ?? 0) / POR_PAGINA));
  const ativos = FILTROS_GAVETA.filter((f) => params.get(f));
  const nomeFiltro: Record<FiltroGaveta, (v: string) => string> = {
    tipo: (v) => tipos.data?.find((t) => t.id === v)?.nome ?? "Tipo",
    empresa: (v) => {
      const e = empresas.data?.find((x) => x.id === v);
      return e?.nome_fantasia ?? e?.razao_social ?? "Empresa";
    },
    setor: (v) => setores.data?.find((s) => s.id === v)?.nome ?? "Setor",
    tags: (v) =>
      v
        .split(",")
        .map((id) => tags.data?.find((t) => t.id === id)?.nome ?? "tag")
        .join(", "),
    data_de: (v) => `a partir de ${formatarData(v)}`,
    data_ate: (v) => `até ${formatarData(v)}`,
    validade_ate: (v) => `validade até ${formatarData(v)}`,
  };

  return (
    <div className="space-y-5">
      {/* Caminho + título */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <nav aria-label="Caminho" className="mb-1 flex flex-wrap items-center gap-1 text-sm text-ink-muted">
            <button type="button" onClick={() => atualizar({ categoria: null })} className="hover:text-primary-dark hover:underline">
              Documentos
            </button>
            {caminho.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1">
                <ChevronRight className="size-3.5" aria-hidden />
                <button type="button" onClick={() => atualizar({ categoria: c.id })} className="hover:text-primary-dark hover:underline">
                  {c.nome}
                </button>
              </span>
            ))}
          </nav>
          <h1 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
            {atual && (
              <span className="flex size-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${lista.find((c) => c.id === atual.raiz_id)?.cor ?? "#C67139"}1f` }}>
                {atual.nivel === 1 ? <IconeCategoria icone={atual.icone} cor={atual.cor} /> : <Folder className="size-5 text-primary-dark" aria-hidden />}
              </span>
            )}
            {atual ? atual.nome : "Todos os documentos"}
          </h1>
          {atual?.descricao && <p className="mt-1 text-sm text-ink-muted">{atual.descricao}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Segmentado
            rotulo="Modo de exibição"
            compacto
            valor={modo}
            aoMudar={setModo}
            opcoes={[
              { valor: "lista", rotulo: "Lista", icone: List },
              { valor: "grade", rotulo: "Grade", icone: LayoutGrid },
            ]}
          />
          {podeCadastrar && (
            <Link
              to={`/documentos/novo${atual ? `?categoria=${atual.id}` : ""}`}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary-dark px-4 text-[15px] font-semibold text-white shadow-sm hover:bg-primary-deeper"
            >
              <Plus className="size-4" aria-hidden /> <span className="hidden sm:inline">Novo documento</span>
            </Link>
          )}
        </div>
      </div>

      {/* Pesquisa e filtros */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-ink-muted" aria-hidden />
            <input
              type="search"
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              placeholder={atual ? `Pesquisar em ${atual.nome}...` : "Pesquisar por nome, tipo, empresa, tags ou conteúdo..."}
              aria-label="Pesquisar documentos"
              className="campo h-11 bg-paper pl-10"
            />
          </div>
          <select
            aria-label="Ordenar"
            className="campo hidden h-11 w-auto bg-paper sm:block"
            value={params.get("ordem") ?? ""}
            onChange={(e) => atualizar({ ordem: e.target.value || null })}
          >
            <option value="">Mais relevantes</option>
            <option value="recentes">Mais recentes</option>
            <option value="validade">Validade mais próxima</option>
            <option value="nome">Nome (A–Z)</option>
          </select>
          <Botao variante="secundario" icone={SlidersHorizontal} onClick={() => setFiltrosAbertos(true)} className="h-11">
            <span className="hidden sm:inline">Filtros</span>
            {ativos.length > 0 && <span className="rounded-full bg-primary-dark px-1.5 text-xs text-white">{ativos.length}</span>}
          </Botao>
        </div>

        <div className="rolagem-fina -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
          {ATALHOS_SITUACAO.map(({ valor, rotulo }) => {
            const ativo = (params.get("situacao") ?? "") === valor;
            return (
              <button
                key={rotulo}
                type="button"
                aria-pressed={ativo}
                onClick={() => atualizar({ situacao: valor || null })}
                className={clsx(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                  ativo ? "border-ink bg-ink text-white" : "border-line-soft bg-paper text-ink-muted hover:border-line hover:text-ink",
                )}
              >
                {rotulo}
              </button>
            );
          })}
          {ativos.map((f) => (
            <button key={f} type="button" onClick={() => atualizar({ [f]: null })} className="inline-flex shrink-0" aria-label={`Remover filtro: ${nomeFiltro[f](params.get(f)!)}`}>
              <Selo className="bg-warning-soft px-3 py-1.5 text-sm text-primary-dark">
                {nomeFiltro[f](params.get(f)!)}
                <X className="size-3.5" aria-hidden />
              </Selo>
            </button>
          ))}
        </div>
      </div>

      {/* Subpastas */}
      {mostrarPastas && (
        <section aria-label="Pastas">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {subpastas.map((pasta) => (
              <button key={pasta.id} type="button" onClick={() => atualizar({ categoria: pasta.id })} className="cartao-interativo flex items-center gap-3 p-3.5 text-left">
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${pasta.cor ?? lista.find((c) => c.id === pasta.raiz_id)?.cor ?? "#C67139"}1f` }}
                >
                  {pasta.nivel === 1 ? <IconeCategoria icone={pasta.icone} cor={pasta.cor} /> : <Folder className="size-5 text-primary-dark" aria-hidden />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{pasta.nome}</span>
                  <span className="block text-xs text-ink-muted tabular-nums">{pasta.total} doc.</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Resultados */}
      <section className="cartao overflow-hidden" aria-label="Documentos">
        <div className="flex items-center justify-between border-b border-line-soft px-5 py-3 text-sm">
          <span aria-live="polite" className="font-medium">
            {resultado.data ? `${resultado.data.total} documento(s)` : "Pesquisando..."}
            {resultado.isFetching && resultado.data && <span className="ml-2 font-normal text-ink-muted">atualizando...</span>}
          </span>
          {atual && !params.get("q") && <span className="text-ink-muted">incluindo subpastas</span>}
        </div>
        {resultado.isLoading && <Carregando />}
        {resultado.error && (
          <div className="p-4">
            <MensagemErro erro={resultado.error} />
          </div>
        )}
        {resultado.data && resultado.data.itens.length === 0 && (
          <EstadoVazio
            titulo="Nenhum documento encontrado"
            descricao={params.get("q") || ativos.length || params.get("situacao") ? "Tente outros termos ou remova alguns filtros." : "Esta pasta ainda está vazia."}
            acao={
              podeCadastrar && !params.get("q") ? (
                <Link to={`/documentos/novo${atual ? `?categoria=${atual.id}` : ""}`} className="text-sm font-semibold text-primary-dark hover:underline">
                  Enviar o primeiro documento
                </Link>
              ) : undefined
            }
          />
        )}
        {resultado.data && resultado.data.itens.length > 0 &&
          (modo === "grade" ? <GradeDocumentos documentos={resultado.data.itens} /> : <ListaDocumentos documentos={resultado.data.itens} />)}
      </section>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <Botao variante="secundario" tamanho="sm" disabled={pagina <= 1} onClick={() => atualizar({ pagina: String(pagina - 1) }, true)}>
            Anterior
          </Botao>
          <span className="text-ink-muted">
            Página {pagina} de {totalPaginas}
          </span>
          <Botao variante="secundario" tamanho="sm" disabled={pagina >= totalPaginas} onClick={() => atualizar({ pagina: String(pagina + 1) }, true)}>
            Próxima
          </Botao>
        </div>
      )}

      <Gaveta
        aberta={filtrosAbertos}
        aoFechar={() => setFiltrosAbertos(false)}
        titulo="Filtros"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => atualizar(Object.fromEntries(FILTROS_GAVETA.map((f) => [f, null])))}>
              Limpar
            </Botao>
            <Botao onClick={() => setFiltrosAbertos(false)}>Ver {resultado.data?.total ?? ""} resultado(s)</Botao>
          </>
        }
      >
        <div className="grid gap-4 p-5">
          <Campo rotulo="Tipo de documento" htmlFor="f-tipo">
            <select id="f-tipo" className="campo" value={params.get("tipo") ?? ""} onChange={(e) => atualizar({ tipo: e.target.value || null })}>
              <option value="">Todos</option>
              {tipos.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Empresa / fornecedor" htmlFor="f-empresa">
            <select id="f-empresa" className="campo" value={params.get("empresa") ?? ""} onChange={(e) => atualizar({ empresa: e.target.value || null })}>
              <option value="">Todas</option>
              {empresas.data?.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome_fantasia ?? e.razao_social}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Setor responsável" htmlFor="f-setor">
            <select id="f-setor" className="campo" value={params.get("setor") ?? ""} onChange={(e) => atualizar({ setor: e.target.value || null })}>
              <option value="">Todos</option>
              {setores.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Data — de" htmlFor="f-de">
              <input id="f-de" type="date" className="campo" value={params.get("data_de") ?? ""} onChange={(e) => atualizar({ data_de: e.target.value || null })} />
            </Campo>
            <Campo rotulo="Data — até" htmlFor="f-ate">
              <input id="f-ate" type="date" className="campo" value={params.get("data_ate") ?? ""} onChange={(e) => atualizar({ data_ate: e.target.value || null })} />
            </Campo>
          </div>
          <Campo rotulo="Validade até" htmlFor="f-validade">
            <input id="f-validade" type="date" className="campo" value={params.get("validade_ate") ?? ""} onChange={(e) => atualizar({ validade_ate: e.target.value || null })} />
          </Campo>
          <Campo rotulo="Ordenar por" htmlFor="f-ordem" className="sm:hidden">
            <select id="f-ordem" className="campo" value={params.get("ordem") ?? ""} onChange={(e) => atualizar({ ordem: e.target.value || null })}>
              <option value="">Mais relevantes</option>
              <option value="recentes">Mais recentes</option>
              <option value="validade">Validade mais próxima</option>
              <option value="nome">Nome (A–Z)</option>
            </select>
          </Campo>
          <div>
            <span className="rotulo">Tags</span>
            <div className="flex flex-wrap gap-1.5">
              {tags.data?.map((t) => {
                const selecionadas = (params.get("tags") ?? "").split(",").filter(Boolean);
                const ativa = selecionadas.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={ativa}
                    onClick={() => atualizar({ tags: (ativa ? selecionadas.filter((id) => id !== t.id) : [...selecionadas, t.id]).join(",") || null })}
                    className={clsx(
                      "rounded-full border px-3 py-1 text-sm transition-colors",
                      ativa ? "border-primary-dark bg-primary-dark text-white" : "border-line-soft bg-paper hover:bg-surface-2",
                    )}
                  >
                    {t.nome}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Gaveta>
    </div>
  );
}
