import { AlertTriangle, ArrowRight, CalendarClock, FilePlus2, Files, LoaderCircle, Search, Sparkles, type LucideIcon } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { IconeArquivo, IconeCategoria, SituacaoBadge } from "../components/documentos/Indicadores";
import { Carregando, EstadoVazio, MensagemErro } from "../components/ui/Basicos";
import { useAuth } from "../contexts/AuthContext";
import { usePaleta } from "../contexts/PaletaContext";
import { usePainel } from "../lib/consultas";
import { diaMes, saudacao, tempoRelativo, textoPrazo } from "../lib/format";
import type { Painel } from "../lib/tipos";

const numero = new Intl.NumberFormat("pt-BR");

const PERGUNTAS = ["Quais contratos vencem nos próximos 30 dias?", "Quais certidões estão vencidas?", "Qual é o valor do contrato C-2026-014?"];

export default function DashboardPage() {
  const { perfil, podeCadastrar } = useAuth();
  const { abrirPaleta } = usePaleta();
  const navigate = useNavigate();
  const painel = usePainel();

  const hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const primeiroNome = perfil?.nome.split(" ")[0] ?? "";

  return (
    <div className="space-y-7">
      {/* Destaque */}
      <section className="relative overflow-hidden rounded-[1.5rem] bg-linear-to-br from-primary-deeper via-primary-dark to-primary p-6 text-white shadow-[var(--shadow-elevated)] sm:p-8">
        <div className="textura-pontos absolute inset-0" aria-hidden />
        <div className="absolute -top-24 -right-16 size-72 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="relative">
          <p className="text-sm text-white/75 first-letter:uppercase">{hoje}</p>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">
            {saudacao()}, {primeiroNome}
          </h1>
          <p className="mt-2 max-w-xl text-white/80">Encontre, organize e acompanhe os documentos da empresa em um só lugar.</p>

          <button
            type="button"
            onClick={() => abrirPaleta()}
            className="mt-6 flex h-14 w-full max-w-2xl items-center gap-3 rounded-2xl bg-white px-5 text-left text-ink shadow-lg transition hover:shadow-xl"
          >
            <Search className="size-5 text-primary-dark" aria-hidden />
            <span className="flex-1 text-[15px] text-ink-muted">Pesquisar — ex.: contrato fornecedor agrícola</span>
            <kbd className="tecla hidden text-ink-muted sm:inline-flex">Ctrl K</kbd>
          </button>

          <div className="mt-4 flex flex-wrap gap-2">
            {podeCadastrar && <AcaoRapida para="/documentos/novo" icone={FilePlus2} rotulo="Enviar documento" />}
            <AcaoRapida para="/vencimentos" icone={CalendarClock} rotulo="Ver vencimentos" />
            <AcaoRapida para="/assistente" icone={Sparkles} rotulo="Perguntar ao assistente" />
          </div>
        </div>
      </section>

      {painel.isLoading && <Carregando />}
      {painel.error && <MensagemErro erro={painel.error} />}
      {painel.data && <Conteudo painel={painel.data} aoPerguntar={(q) => navigate(`/assistente?q=${encodeURIComponent(q)}`)} />}
    </div>
  );
}

function AcaoRapida({ para, icone: Icone, rotulo }: { para: string; icone: LucideIcon; rotulo: string }) {
  return (
    <Link
      to={para}
      className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/25"
    >
      <Icone className="size-4" aria-hidden />
      {rotulo}
    </Link>
  );
}

function Conteudo({ painel, aoPerguntar }: { painel: Painel; aoPerguntar: (pergunta: string) => void }) {
  const { resumo } = painel;
  const totalGeral = Math.max(resumo.documentos, 1);

  const indicadores: { rotulo: string; valor: number; detalhe: string; icone: LucideIcon; para: string; tom: string }[] = [
    { rotulo: "Documentos", valor: resumo.documentos, detalhe: `${resumo.enviados_ultimos_30d} enviados nos últimos 30 dias`, icone: Files, para: "/documentos", tom: "bg-surface-2 text-primary-dark" },
    { rotulo: "Vencendo", valor: resumo.vencendo, detalhe: "nos próximos 30 dias", icone: CalendarClock, para: "/vencimentos", tom: "bg-warning-soft text-warning-ink" },
    { rotulo: "Vencidos", valor: resumo.vencidos, detalhe: "precisam de renovação", icone: AlertTriangle, para: "/vencimentos?aba=vencidos", tom: "bg-danger-soft text-danger" },
    {
      rotulo: "Em indexação",
      valor: resumo.em_processamento,
      detalhe: resumo.erros_processamento ? `${resumo.erros_processamento} com falha` : "texto sendo preparado para a busca",
      icone: LoaderCircle,
      para: "/documentos?ordem=recentes",
      tom: "bg-success-soft text-success",
    },
  ];

  return (
    <>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Indicadores">
        {indicadores.map((ind) => (
          <Link key={ind.rotulo} to={ind.para} className="cartao-interativo group flex flex-col gap-3 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className={`flex size-10 items-center justify-center rounded-xl ${ind.tom}`}>
                <ind.icone className="size-5" aria-hidden />
              </span>
              <ArrowRight className="size-4 text-ink-muted opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" aria-hidden />
            </div>
            <div>
              <p className="text-3xl font-bold tracking-tight tabular-nums">{numero.format(ind.valor)}</p>
              <p className="text-sm font-medium">{ind.rotulo}</p>
              <p className="mt-0.5 text-xs text-ink-muted">{ind.detalhe}</p>
            </div>
          </Link>
        ))}
      </section>

      <section aria-labelledby="titulo-pastas">
        <div className="mb-3 flex items-end justify-between">
          <h2 id="titulo-pastas" className="text-lg font-semibold">
            Pastas
          </h2>
          <Link to="/documentos" className="text-sm font-medium text-primary-dark hover:underline">
            Abrir explorador
          </Link>
        </div>
        {painel.categorias.length === 0 ? (
          <div className="cartao">
            <EstadoVazio titulo="Nenhuma pasta liberada" descricao="Peça ao administrador acesso às categorias da sua área." />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {painel.categorias.map((c) => (
              <Link key={c.id} to={`/documentos?categoria=${c.id}`} className="cartao-interativo group p-4">
                <div className="flex items-start justify-between">
                  <span className="flex size-11 items-center justify-center rounded-2xl" style={{ backgroundColor: c.cor ? `${c.cor}1f` : undefined }}>
                    <IconeCategoria icone={c.icone} cor={c.cor} className="size-[22px]" />
                  </span>
                  <span className="text-2xl font-bold tabular-nums">{numero.format(c.total)}</span>
                </div>
                <p className="mt-3 font-semibold group-hover:text-primary-dark">{c.nome}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                  <div className="h-full rounded-full" style={{ width: `${Math.max((c.total / totalGeral) * 100, c.total ? 4 : 0)}%`, backgroundColor: c.cor ?? undefined }} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-5">
        <section className="cartao overflow-hidden lg:col-span-3" aria-labelledby="titulo-recentes">
          <CabecalhoSecao id="titulo-recentes" titulo="Enviados recentemente" para="/documentos?ordem=recentes" />
          {painel.recentes.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-muted">Nenhum documento enviado ainda.</p>
          ) : (
            <ul className="divide-y divide-line-soft">
              {painel.recentes.map((d) => (
                <li key={d.id}>
                  <Link to={`/documentos/${d.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface/60">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-primary-dark">
                      <IconeArquivo mime={d.mime_type} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{d.titulo}</span>
                      <span className="block truncate text-xs text-ink-muted">
                        {d.tipo_nome} · {d.categoria_caminho}
                      </span>
                    </span>
                    <span className="hidden text-right text-xs text-ink-muted sm:block">
                      <span className="block">{tempoRelativo(d.criado_em)}</span>
                      {d.criado_por_nome && <span className="block truncate">{d.criado_por_nome.split(" ")[0]}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="cartao overflow-hidden lg:col-span-2" aria-labelledby="titulo-prazos">
          <CabecalhoSecao id="titulo-prazos" titulo="Próximos vencimentos" para="/vencimentos" />
          {painel.vencimentos.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-muted">Nenhum documento vencendo nos próximos 30 dias.</p>
          ) : (
            <ul className="divide-y divide-line-soft">
              {painel.vencimentos.map((d) => {
                const { dia, mes } = diaMes(d.data_validade);
                const vencido = d.situacao === "vencido";
                return (
                  <li key={d.id}>
                    <Link to={`/documentos/${d.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface/60">
                      <span
                        className={`flex size-11 shrink-0 flex-col items-center justify-center rounded-xl leading-none ${vencido ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning-ink"}`}
                      >
                        <span className="text-base font-bold">{dia}</span>
                        <span className="text-[10px] font-semibold uppercase">{mes}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{d.titulo}</span>
                        <span className={`block text-xs ${vencido ? "text-danger" : "text-warning-ink"}`}>{textoPrazo(d.dias_para_vencer)}</span>
                      </span>
                      <SituacaoBadge situacao={d.situacao} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="cartao p-5">
        <div className="flex items-center gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-primary-dark text-white">
          <Sparkles className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Pergunte aos seus documentos</p>
          <p className="text-sm text-ink-muted">O assistente responde com base nos arquivos que você pode acessar e mostra as fontes.</p>
        </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {PERGUNTAS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => aoPerguntar(p)}
              className="rounded-full border border-line-soft bg-surface/60 px-3 py-1.5 text-sm transition hover:border-primary/50 hover:bg-warning-soft/60"
            >
              {p}
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function CabecalhoSecao({ id, titulo, para }: { id: string; titulo: string; para: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line-soft px-5 py-3.5">
      <h2 id={id} className="font-semibold">
        {titulo}
      </h2>
      <Link to={para} className="inline-flex items-center gap-1 text-sm font-medium text-primary-dark hover:underline">
        Ver todos <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </div>
  );
}
