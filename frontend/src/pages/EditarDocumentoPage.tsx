import { useQuery } from "@tanstack/react-query";
import { Navigate, useParams } from "react-router";
import { FormularioDocumento } from "../components/documentos/FormularioDocumento";
import { CabecalhoPagina, Carregando, MensagemErro } from "../components/ui/Basicos";
import { api } from "../lib/api";
import { chaves } from "../lib/consultas";
import type { DocumentoDetalhe } from "../lib/tipos";

export default function EditarDocumentoPage() {
  const { id = "" } = useParams();
  const documento = useQuery({ queryKey: chaves.documento(id), queryFn: () => api<DocumentoDetalhe>(`/documentos/${id}`) });

  if (documento.isLoading) return <Carregando />;
  if (documento.error) return <MensagemErro erro={documento.error} />;
  if (!documento.data) return null;
  if (!documento.data.permissoes.editar) return <Navigate to={`/documentos/${id}`} replace />;

  return (
    <div className="mx-auto max-w-3xl">
      <CabecalhoPagina titulo="Editar documento" descricao={documento.data.titulo} />
      <FormularioDocumento documento={documento.data} />
    </div>
  );
}
