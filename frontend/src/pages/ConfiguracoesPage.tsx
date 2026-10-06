import { useSearchParams } from "react-router";
import { Abas, CabecalhoPagina } from "../components/ui/Basicos";
import { useAuth } from "../contexts/AuthContext";
import { AbaCategorias } from "./configuracoes/AbaCategorias";
import { AbaEmpresas } from "./configuracoes/AbaEmpresas";
import { AbaSetores, AbaTags } from "./configuracoes/AbaSetoresTags";
import { AbaTipos } from "./configuracoes/AbaTipos";
import { AbaUsuarios } from "./configuracoes/AbaUsuarios";

type Aba = "categorias" | "tipos" | "empresas" | "setores" | "tags" | "usuarios";

export default function ConfiguracoesPage() {
  const { ehAdmin } = useAuth();
  const [params, setParams] = useSearchParams();

  // Gestores cuidam de empresas e tags; o restante é do administrador.
  const abas: { id: Aba; rotulo: string }[] = ehAdmin
    ? [
        { id: "categorias", rotulo: "Categorias" },
        { id: "tipos", rotulo: "Tipos de documento" },
        { id: "empresas", rotulo: "Empresas" },
        { id: "setores", rotulo: "Setores" },
        { id: "tags", rotulo: "Tags" },
        { id: "usuarios", rotulo: "Usuários" },
      ]
    : [
        { id: "empresas", rotulo: "Empresas" },
        { id: "tags", rotulo: "Tags" },
      ];
  const pedida = params.get("aba") as Aba | null;
  const aba = abas.some((a) => a.id === pedida) ? pedida! : abas[0]!.id;

  return (
    <div>
      <CabecalhoPagina
        titulo={ehAdmin ? "Configurações" : "Cadastros"}
        descricao="Estrutura de organização dos documentos e controle de acesso."
      />
      <div className="mb-5">
        <Abas<Aba> abas={abas} ativa={aba} aoTrocar={(id) => setParams({ aba: id }, { replace: true })} />
      </div>
      {aba === "categorias" && <AbaCategorias />}
      {aba === "tipos" && <AbaTipos />}
      {aba === "empresas" && <AbaEmpresas />}
      {aba === "setores" && <AbaSetores />}
      {aba === "tags" && <AbaTags />}
      {aba === "usuarios" && <AbaUsuarios />}
    </div>
  );
}
