import clsx from "clsx";
import {
  AlarmClock,
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  FilePlus2,
  Files,
  FolderOpen,
  ListChecks,
  Search,
  Settings,
  Sparkles,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router";
import { IconeArquivo } from "../components/documentos/Indicadores";
import { DocumentosPorPasta } from "../components/graficos/DocumentosPorPasta";
import { ListaCentral } from "../components/pendencias/ListaCentral";
import { MensagemErro } from "../components/ui/Basicos";
import { Contador, Elevar, Entrada, EsqueletoLista, Escalonado, ItemEscalonado } from "../components/ui/Movimento";
import { useAuth } from "../contexts/AuthContext";
import { usePaleta } from "../contexts/PaletaContext";
import { useChatDisponivel, usePainel, usePendencias } from "../lib/consultas";
import { saudacao, tempoRelativo } from "../lib/format";

/**
 * Hub do Hub-and-Spoke: daqui a pessoa vai a cada módulo e volta para cá.
 * Números do dia, caminho para cada módulo e o que pede ação.
 */
export default function DashboardPage() {
  const { perfil, podeCadastrar, ehGestorOuAdmin, ehAdmin } = useAuth();
  const { abrirPaleta } = usePaleta();
  const painel = usePainel();
  const pendencias = usePendencias("minhas");
  const chat = useChatDisponivel();

  const hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const primeiroNome = perfil?.nome.split(" ")[0] ?? "";
  const resumo = painel.data?.resumo;
  const itens = pendencias.data ?? [];
  const atrasadas = itens.filter((i) => i.estado === "atrasado").length;
  const proximas = itens.filter((i) => i.estado === "proximo").length;
  const aprovacoes = itens.filter((i) => i.tipo === "aprovacao").length;

  const numeros: { rotulo: string; valor?: number; detalhe: string; icone: LucideIcon; tom: string; para: string }[] = [
    { rotulo: "Documentos", valor: resumo?.documentos, detalhe: `${resumo?.enviados_ultimos_30d ?? 0} nos últimos 30 dias`, icone: Files, tom: "bg-success-soft text-primary-dark", para: "/documentos" },
    { rotulo: "Atrasadas", valor: pendencias.data ? atrasadas : undefined, detalhe: "pendências suas", icone: AlarmClock, tom: "bg-danger-soft text-danger", para: "/pendencias" },
    { rotulo: "Próximas", valor: pendencias.data ? proximas : undefined, detalhe: "dentro do prazo de aviso", icone: CalendarClock, tom: "bg-warning-soft text-warning-ink", para: "/pendencias" },
    { rotulo: "Para aprovar", valor: pendencias.data ? aprovacoes : undefined, detalhe: "aguardando você", icone: BadgeCheck, tom: "bg-surface-2 text-ink", para: "/pendencias?tipo=aprovacao" },
  ];

  const modulos: Modulo[] = [
    { para: "/documentos", titulo: "Documentos", descricao: "Pastas, busca e filtros", icone: FolderOpen },
    ...(podeCadastrar ? [{ para: "/documentos/novo", titulo: "Novo documento", descricao: "Enviar e classificar um arquivo", icone: FilePlus2, destaque: true }] : []),
    { para: "/pendencias", titulo: "Pendências", descricao: "Prazos, renovações, revisões e aprovações", icone: ListChecks, alerta: atrasadas > 0 },
    ...(chat.data ? [{ para: "/assistente", titulo: "Assistente IA", descricao: "Pergunte aos seus documentos", icone: Sparkles }] : []),
    ...(ehGestorOuAdmin ? [{ para: "/lixeira", titulo: "Lixeira", descricao: "Restaurar documentos excluídos", icone: Trash2 }] : []),
    ...(ehGestorOuAdmin
      ? [{ para: "/configuracoes", titulo: ehAdmin ? "Configurações" : "Cadastros", descricao: ehAdmin ? "Pastas, tipos, empresas e usuários" : "Empresas e tags", icone: Settings }]
      : []),
  ];

  return (
    <div className="space-y-6">
      {/* Destaque: gradiente em movimento lento + manchas de luz */}
      <section className="relative overflow-hidden rounded-3xl bg-linear-120 from-primary-deeper via-primary-dark to-primary bg-[length:220%_220%] p-6 text-white shadow-[var(--shadow-elevated)] animate-gradiente sm:p-9">
        <div className="textura-pontos absolute inset-0" aria-hidden />
        <motion.div
          className="absolute -top-28 -right-20 size-80 rounded-full bg-white/15 blur-3xl"
          animate={{ x: [0, -30, 0], y: [0, 20, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden
        />
        <motion.div
          className="absolute -bottom-32 left-1/3 size-72 rounded-full bg-[#c9e38f]/20 blur-3xl"
          animate={{ x: [0, 40, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden
        />
        <div className="relative">
          <Entrada>
            <p className="text-sm text-white/75 first-letter:uppercase">{hoje}</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
              {saudacao()}, {primeiroNome}
            </h1>
            <p className="mt-1.5 text-white/80">
              {pendencias.data
                ? atrasadas
                  ? `Você tem ${atrasadas} pendência(s) atrasada(s) — veja abaixo.`
                  : proximas
                    ? `${proximas} pendência(s) chegando no prazo de aviso.`
                    : "Tudo em dia por aqui."
                : "Encontre, organize e acompanhe os documentos da empresa."}
            </p>
          </Entrada>
          <Entrada atraso={0.08}>
            <motion.button
              type="button"
              onClick={() => abrirPaleta()}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="mt-6 flex h-14 w-full max-w-2xl items-center gap-3 rounded-2xl bg-white/95 px-5 text-left text-ink shadow-lg ring-1 ring-white/40 backdrop-blur transition-shadow hover:shadow-2xl"
            >
              <Search className="size-5 text-primary-dark" aria-hidden />
              <span className="flex-1 text-[15px] text-ink-muted">Pesquisar documentos — ex.: contrato fornecedor agrícola</span>
              <kbd className="tecla hidden text-ink-muted sm:inline-flex">Ctrl K</kbd>
            </motion.button>
          </Entrada>
        </div>
      </section>

      {/* Números do dia */}
      <Escalonado as="section" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {numeros.map((n) => (
          <ItemEscalonado key={n.rotulo}>
            <Elevar>
              <Link to={n.para} className="cartao group flex items-center gap-3.5 p-4 transition-colors hover:border-primary/40 sm:p-5">
                <span className={clsx("flex size-11 shrink-0 items-center justify-center rounded-2xl", n.tom)}>
                  <n.icone className="size-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-2xl leading-none font-bold tracking-tight">
                    {n.valor === undefined ? <span className="esqueleto inline-block h-6 w-10 align-middle" /> : <Contador valor={n.valor} />}
                  </span>
                  <span className="mt-1 block text-sm font-medium">{n.rotulo}</span>
                  <span className="block truncate text-xs text-ink-muted">{n.detalhe}</span>
                </span>
              </Link>
            </Elevar>
          </ItemEscalonado>
        ))}
      </Escalonado>

      {/* Módulos (spokes) */}
      <section aria-labelledby="titulo-modulos">
        <h2 id="titulo-modulos" className="sr-only">
          Módulos
        </h2>
        <Escalonado className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" passo={0.05}>
          {modulos.map((m) => (
            <ItemEscalonado key={m.para}>
              <CartaoModulo {...m} />
            </ItemEscalonado>
          ))}
        </Escalonado>
      </section>

      {painel.error && <MensagemErro erro={painel.error} />}

      <div className="grid items-start gap-5 lg:grid-cols-5">
        <Entrada atraso={0.15} className="cartao overflow-hidden lg:col-span-3">
          <CabecalhoSecao titulo="Minhas pendências" para="/pendencias" contador={itens.length || undefined} />
          {pendencias.isLoading && <EsqueletoLista linhas={4} />}
          {pendencias.error && (
            <div className="p-4">
              <MensagemErro erro={pendencias.error} />
            </div>
          )}
          {pendencias.data && itens.length === 0 && (
            <div className="flex flex-col items-center px-5 py-12 text-center">
              <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-success-soft text-primary-dark">
                <BadgeCheck className="size-6" aria-hidden />
              </span>
              <p className="font-semibold">Tudo em dia!</p>
              <p className="text-sm text-ink-muted">Nada pendente com você agora.</p>
            </div>
          )}
          {itens.length > 0 && <ListaCentral itens={itens.slice(0, 6)} />}
        </Entrada>

        <div className="space-y-5 lg:col-span-2">
          <Entrada atraso={0.2} className="cartao p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-semibold">Documentos por pasta</h2>
              <Link to="/documentos" className="text-sm font-medium text-primary-dark hover:underline">
                Abrir
              </Link>
            </div>
            {painel.isLoading && (
              <div className="space-y-3">
                {[80, 60, 45, 30].map((l) => (
                  <span key={l} className="esqueleto block h-4" style={{ width: `${l}%` }} />
                ))}
              </div>
            )}
            {painel.data && <DocumentosPorPasta pastas={painel.data.categorias} />}
          </Entrada>

          <Entrada atraso={0.25} className="cartao overflow-hidden">
            <CabecalhoSecao titulo="Enviados recentemente" para="/documentos?ordem=recentes" />
            {painel.isLoading && <EsqueletoLista linhas={3} />}
            <ul className="divide-y divide-line-soft">
              {painel.data?.recentes.slice(0, 4).map((d) => (
                <li key={d.id}>
                  <Link to={`/documentos/${d.id}`} className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-success-faint/60">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-primary-dark transition-transform group-hover:scale-105">
                      <IconeArquivo mime={d.mime_type} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold group-hover:text-primary-dark">{d.titulo}</span>
                      <span className="block truncate text-xs text-ink-muted">
                        {d.tipo_nome} · {tempoRelativo(d.criado_em)}
                      </span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 -translate-x-1 text-ink-muted opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </Entrada>
        </div>
      </div>
    </div>
  );
}

interface Modulo {
  para: string;
  titulo: string;
  descricao: string;
  icone: LucideIcon;
  alerta?: boolean;
  destaque?: boolean;
}

function CartaoModulo({ para, titulo, descricao, icone: Icone, alerta, destaque }: Modulo) {
  return (
    <Elevar className="h-full">
      <Link
        to={para}
        className={clsx(
          "group relative flex h-full items-center gap-4 overflow-hidden rounded-[var(--radius-card)] border p-4 shadow-[var(--shadow-card)] transition-[box-shadow,border-color] duration-200 hover:shadow-[var(--shadow-elevated)] sm:p-5",
          destaque ? "border-primary-dark bg-linear-to-br from-primary-dark to-primary-deeper text-white" : "border-line-soft bg-paper hover:border-primary/40",
        )}
      >
        {destaque && <span className="absolute -top-10 -right-10 size-32 rounded-full bg-white/10 blur-2xl transition-transform duration-500 group-hover:scale-150" aria-hidden />}
        <span
          className={clsx(
            "relative flex size-12 shrink-0 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6",
            destaque ? "bg-white/15 text-white" : alerta ? "bg-danger-soft text-danger" : "bg-success-soft text-primary-dark",
          )}
        >
          <Icone className="size-6" aria-hidden />
          {alerta && <span className="absolute -top-0.5 -right-0.5 size-3 animate-ping rounded-full bg-accent/70" aria-hidden />}
          {alerta && <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-accent ring-2 ring-paper" aria-hidden />}
        </span>
        <span className="relative min-w-0 flex-1">
          <span className="block font-semibold">{titulo}</span>
          <span className={clsx("block truncate text-sm", destaque ? "text-white/80" : "text-ink-muted")}>{descricao}</span>
        </span>
        <ArrowRight className={clsx("relative size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1", destaque ? "text-white/80" : "text-ink-muted")} aria-hidden />
      </Link>
    </Elevar>
  );
}

function CabecalhoSecao({ titulo, para, contador }: { titulo: string; para: string; contador?: number }) {
  return (
    <div className="flex items-center justify-between border-b border-line-soft px-5 py-3.5">
      <h2 className="flex items-center gap-2 font-semibold">
        {titulo}
        {contador !== undefined && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-ink-muted tabular-nums">{contador}</span>}
      </h2>
      <Link to={para} className="group inline-flex items-center gap-1 text-sm font-medium text-primary-dark">
        Ver todas <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </div>
  );
}
