import { CircleCheckBig } from "lucide-react";
import { useSearchParams } from "react-router";
import { ListaCentral } from "../components/pendencias/ListaCentral";
import { Abas, CabecalhoPagina, EstadoVazio, MensagemErro } from "../components/ui/Basicos";
import { Segmentado } from "../components/ui/Segmentado";
import { useAuth } from "../contexts/AuthContext";
import { usePendencias } from "../lib/consultas";
import { ROTULO_TIPO_ITEM } from "../lib/format";
import { EsqueletoLista } from "../components/ui/Movimento";
import type { ItemCentral, TipoItemCentral } from "../lib/tipos";

type Escopo = "minhas" | "todas";
type Filtro = "todos" | TipoItemCentral;

const GRUPOS: { estado: ItemCentral["estado"]; titulo: string }[] = [
  { estado: "atrasado", titulo: "Atrasadas" },
  { estado: "proximo", titulo: "Próximas" },
  { estado: "futuro", titulo: "Depois" },
];

/** Central de pendências: prazos e condicionantes, validades, revisões e aprovações. */
export default function PendenciasPage() {
  const { ehGestorOuAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const escopo: Escopo = ehGestorOuAdmin && params.get("escopo") === "todas" ? "todas" : "minhas";
  const filtro = (params.get("tipo") as Filtro | null) ?? "todos";
  const lista = usePendencias(escopo);

  const definir = (chave: string, valor: string | null) => {
    const novos = new URLSearchParams(params);
    if (valor) novos.set(chave, valor);
    else novos.delete(chave);
    setParams(novos, { replace: true });
  };
  const itens = (lista.data ?? []).filter((i) => filtro === "todos" || i.tipo === filtro);

  return (
    <div>
      <CabecalhoPagina titulo="Pendências" descricao="Tudo o que pede ação: prazos e condicionantes, documentos a vencer, revisões e aprovações." />

      <div className="cartao overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-3 pt-2 pb-2 sm:pb-0">
          {ehGestorOuAdmin ? (
            <Abas<Escopo>
              ativa={escopo}
              aoTrocar={(id) => definir("escopo", id === "todas" ? "todas" : null)}
              abas={[
                { id: "minhas", rotulo: "Minhas" },
                { id: "todas", rotulo: "Toda a equipe" },
              ]}
            />
          ) : (
            <span className="px-2 py-2 text-sm font-semibold">Minhas pendências</span>
          )}
          <div className="rolagem-fina -mx-3 max-w-[calc(100%+1.5rem)] overflow-x-auto px-3 pb-2 sm:mx-0 sm:max-w-full sm:px-0">
            <Segmentado
              rotulo="Tipo"
              valor={filtro}
              aoMudar={(v) => definir("tipo", v === "todos" ? null : v)}
              opcoes={[
                { valor: "todos", rotulo: "Todas" },
                ...(["acao", "validade", "revisao", "aprovacao"] as const).map((t) => ({ valor: t, rotulo: ROTULO_TIPO_ITEM[t] })),
              ]}
            />
          </div>
        </div>

        {lista.isLoading && <EsqueletoLista linhas={5} />}
        {lista.error && (
          <div className="p-4">
            <MensagemErro erro={lista.error} />
          </div>
        )}
        {lista.data && itens.length === 0 && (
          <EstadoVazio icone={CircleCheckBig} titulo="Nada pendente" descricao="Quando houver prazos, revisões ou aprovações, eles aparecem aqui." />
        )}
        {GRUPOS.map(({ estado, titulo }) => {
          const doGrupo = itens.filter((i) => i.estado === estado);
          if (doGrupo.length === 0) return null;
          return (
            <section key={estado} aria-label={titulo}>
              <h2 className="bg-surface/70 px-5 py-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
                {titulo} <span className="ml-1 tabular-nums">({doGrupo.length})</span>
              </h2>
              <ListaCentral itens={doGrupo} mostrarResponsavel={escopo === "todas"} />
            </section>
          );
        })}
      </div>
    </div>
  );
}
