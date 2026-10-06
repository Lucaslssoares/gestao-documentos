import { Navigate, useSearchParams } from "react-router";
import { FormularioDocumento } from "../components/documentos/FormularioDocumento";
import { CabecalhoPagina } from "../components/ui/Basicos";
import { useAuth } from "../contexts/AuthContext";

export default function NovoDocumentoPage() {
  const { podeCadastrar } = useAuth();
  const [params] = useSearchParams();
  if (!podeCadastrar) return <Navigate to="/documentos" replace />;

  return (
    <div className="mx-auto max-w-3xl">
      <CabecalhoPagina titulo="Novo documento" descricao="Envie o arquivo e classifique-o para que todos encontrem depois." />
      <FormularioDocumento categoriaInicial={params.get("categoria")} />
    </div>
  );
}
