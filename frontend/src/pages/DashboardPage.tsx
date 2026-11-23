import clsx from "clsx";
import { ArrowRight, FilePlus2, FolderOpen, ListChecks, Search, Settings, Sparkles, Trash2, type LucideIcon } from "lucide-react";
import { Link } from "react-router";
import { IconeArquivo } from "../components/documentos/Indicadores";
import { ListaCentral } from "../components/pendencias/ListaCentral";
import { Carregando, MensagemErro } from "../components/ui/Basicos";
import { useAuth } from "../contexts/AuthContext";
import { usePaleta } from "../contexts/PaletaContext";
import { useChatDisponivel, usePainel, usePendencias } from "../lib/consultas";
import { saudacao, tempoRelativo } from "../lib/format";

const numero = new Intl.NumberFormat("pt-BR");

/**
 * Hub do Hub-and-Spoke: daqui a pessoa vai a cada módulo e volta para cá.
 * Mostra só o que pede ação (minhas pendências) e o caminho para cada módulo.
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

  const modulos: Modulo[] = [
    {
      para: "/documentos",
      titulo: "Documentos",
      descricao: "Pastas, busca e filtros",
      icone: FolderOpen,
      metrica: resumo ? `${numero.format(resumo.documentos)} documentos em ${painel.data?.categorias.length ?? 0} pastas` : undefined,
    },
    ...(podeCadastrar
      ? [{ para: "/documentos/novo", titulo: "Novo documento", descricao: "Enviar e classificar um arquivo", icone: FilePlus2, destaque: true }]
      : []),
    {
      para: "/pendencias",
      titulo: "Pendências",
      descricao: "Prazos, renovações, revisões e aprovações",
      icone: ListChecks,
      metrica: pendencias.data ? (atrasadas || proximas ? `${atrasadas} atrasada(s) · ${proximas} próxima(s)` : "Tudo em dia") : undefined,
      alerta: atrasadas > 0,
    },
    ...(chat.data ? [{ para: "/assistente", titulo: "Assistente IA", descricao: "Pergunte aos seus documentos", icone: Sparkles }] : []),
    ...(ehGestorOuAdmin ? [{ para: "/lixeira", titulo: "Lixeira", descricao: "Restaurar documentos excluídos", icone: Trash2 }] : []),
    ...(ehGestorOuAdmin
      ? [{ para: "/configuracoes", titulo: ehAdmin ? "Configurações" : "Cadastros", descricao: ehAdmin ? "Pastas, tipos, empresas e usuários" : "Empresas e tags", icone: Settings }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl bg-linear-to-br from-primary-deeper via-primary-dark to-primary p-6 text-white shadow-[var(--shadow-elevated)] sm:p-8">
        <div className="textura-pontos absolute inset-0" aria-hidden />
        <div className="absolute -top-24 -right-16 size-72 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="relative">
          <p className="text-sm text-white/75 first-letter:uppercase">{hoje}</p>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">
            {saudacao()}, {primeiroNome}
          </h1>
          <button
            type="button"
            onClick={() => abrirPaleta()}
            className="mt-5 flex h-13 w-full max-w-2xl items-center gap-3 rounded-xl bg-white px-5 text-left text-ink shadow-lg transition hover:shadow-xl"
          >
            <Search className="size-5 text-primary-dark" aria-hidden />
            <span className="flex-1 text-[15px] text-ink-muted">Pesquisar documentos — ex.: contrato fornecedor agrícola</span>
            <kbd className="tecla hidden text-ink-muted sm:inline-flex">Ctrl K</kbd>
          </button>
        </div>
      </section>

      <section aria-label="Módulos" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {modulos.map((m) => (
          <CartaoModulo key={m.para} {...m} />
        ))}
      </section>

      {painel.error && <MensagemErro erro={painel.error} />}

      <div className="grid gap-5 lg:grid-cols-5">
        <section className="cartao overflow-hidden lg:col-span-3" aria-labelledby="titulo-minhas">
          <CabecalhoSecao id="titulo-minhas" titulo="Minhas pendências" para="/pendencias" />
          {pendencias.isLoading && <Carregando />}
          {pendencias.error && (
            <div className="p-4">
              <MensagemErro erro={pendencias.error} />
            </div>
          )}
          {pendencias.data && itens.length === 0 && <p className="px-5 py-10 text-center text-sm text-ink-muted">Nada pendente com você. Tudo em dia!</p>}
          {itens.length > 0 && <ListaCentral itens={itens.slice(0, 6)} />}
        </section>

        <section className="cartao overflow-hidden lg:col-span-2" aria-labelledby="titulo-recentes">
          <CabecalhoSecao id="titulo-recentes" titulo="Enviados recentemente" para="/documentos?ordem=recentes" />
          {painel.isLoading && <Carregando />}
          {painel.data && painel.data.recentes.length === 0 && <p className="px-5 py-10 text-center text-sm text-ink-muted">Nenhum documento enviado ainda.</p>}
          <ul className="divide-y divide-line-soft">
            {painel.data?.recentes.map((d) => (
              <li key={d.id}>
                <Link to={`/documentos/${d.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface/60">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-primary-dark">
                    <IconeArquivo mime={d.mime_type} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{d.titulo}</span>
                    <span className="block truncate text-xs text-ink-muted">
                      {d.tipo_nome} · {tempoRelativo(d.criado_em)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

interface Modulo {
  para: string;
  titulo: string;
  descricao: string;
  icone: LucideIcon;
  metrica?: string;
  alerta?: boolean;
  destaque?: boolean;
}

function CartaoModulo({ para, titulo, descricao, icone: Icone, metrica, alerta, destaque }: Modulo) {
  return (
    <Link
      to={para}
      className={clsx(
        "group flex items-center gap-4 rounded-[var(--radius-card)] border p-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)] sm:p-5",
        destaque ? "border-primary-dark bg-primary-dark text-white" : "border-line-soft bg-paper hover:border-primary/40",
      )}
    >
      <span
        className={clsx(
          "flex size-12 shrink-0 items-center justify-center rounded-xl",
          destaque ? "bg-white/15 text-white" : alerta ? "bg-danger-soft text-danger" : "bg-success-soft text-primary-dark",
        )}
      >
        <Icone className="size-6" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{titulo}</span>
        <span className={clsx("block truncate text-sm", destaque ? "text-white/80" : "text-ink-muted")}>{descricao}</span>
        {metrica && <span className={clsx("mt-1 block text-xs font-semibold", alerta ? "text-danger" : destaque ? "text-white" : "text-primary-dark")}>{metrica}</span>}
      </span>
      <ArrowRight className={clsx("size-4 shrink-0 transition group-hover:translate-x-0.5", destaque ? "text-white/80" : "text-ink-muted")} aria-hidden />
    </Link>
  );
}

function CabecalhoSecao({ id, titulo, para }: { id: string; titulo: string; para: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line-soft px-5 py-3.5">
      <h2 id={id} className="font-semibold">
        {titulo}
      </h2>
      <Link to={para} className="inline-flex items-center gap-1 text-sm font-medium text-primary-dark hover:underline">
        Ver todas <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </div>
  );
}
