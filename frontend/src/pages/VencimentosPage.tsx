import { useQuery } from "@tanstack/react-query";
import { CalendarCheck } from "lucide-react";
import { useSearchParams } from "react-router";
import { ListaDocumentos } from "../components/documentos/ListaDocumentos";
import { Abas, CabecalhoPagina, Carregando, EstadoVazio, MensagemErro } from "../components/ui/Basicos";
import { api, qs } from "../lib/api";
import { chaves } from "../lib/consultas";
import { hojeIso } from "../lib/format";
import type { ResultadoPesquisa } from "../lib/tipos";

type Aba = "proximos" | "vencidos" | "trimestre";

const FILTROS: Record<Aba, Record<string, string>> = {
  proximos: { situacao: "a_vencer", ordem: "validade" },
  vencidos: { situacao: "vencido", ordem: "validade" },
  trimestre: { validade_de: hojeIso(31), validade_ate: hojeIso(90), ordem: "validade" },
};

/** Controle de documentos com validade ou prazo. */
export default function VencimentosPage() {
  const [params, setParams] = useSearchParams();
  const aba = (params.get("aba") as Aba) in FILTROS ? (params.get("aba") as Aba) : "proximos";
  const filtros = { ...FILTROS[aba], por_pagina: 100 };

  const lista = useQuery({
    queryKey: [...chaves.documentos, "vencimentos", aba],
    queryFn: () => api<ResultadoPesquisa>(`/documentos${qs(filtros)}`),
  });

  return (
    <div>
      <CabecalhoPagina titulo="Vencimentos" descricao="Contratos, certidões, procurações, guias e demais documentos com prazo." />
      <div className="cartao overflow-hidden">
        <div className="px-3 pt-2">
          <Abas<Aba>
            ativa={aba}
            aoTrocar={(id) => setParams({ aba: id }, { replace: true })}
            abas={[
              { id: "proximos", rotulo: "Próximos 30 dias" },
              { id: "vencidos", rotulo: "Vencidos" },
              { id: "trimestre", rotulo: "31 a 90 dias" },
            ]}
          />
        </div>
        {lista.isLoading && <Carregando />}
        {lista.error && (
          <div className="p-4">
            <MensagemErro erro={lista.error} />
          </div>
        )}
        {lista.data && lista.data.itens.length === 0 && (
          <EstadoVazio icone={CalendarCheck} titulo="Nada por aqui" descricao="Nenhum documento nesta faixa de vencimento." />
        )}
        {lista.data && lista.data.itens.length > 0 && <ListaDocumentos documentos={lista.data.itens} />}
      </div>
    </div>
  );
}
