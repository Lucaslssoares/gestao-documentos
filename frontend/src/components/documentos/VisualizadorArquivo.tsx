import { useQuery } from "@tanstack/react-query";
import { Download, FileQuestion } from "lucide-react";
import { useEffect, useMemo } from "react";
import { baixarArquivo, salvarArquivo } from "../../lib/api";
import { formatarXml } from "../../lib/textos";
import { Botao } from "../ui/Botao";
import { Carregando, EstadoVazio, MensagemErro } from "../ui/Basicos";

/** Pré-visualização do arquivo (PDF, imagem, XML/TXT). O backend registra cada visualização no histórico. */
export function VisualizadorArquivo({ documentoId, nomeArquivo, mime, versao }: { documentoId: string; nomeArquivo: string; mime: string; versao: number }) {
  const ehTexto = mime.includes("xml") || mime === "text/plain";
  const visualizavel = mime === "application/pdf" || mime.startsWith("image/") || ehTexto;

  const arquivo = useQuery({
    queryKey: ["arquivo", documentoId, versao],
    queryFn: () => baixarArquivo(documentoId),
    enabled: visualizavel,
    staleTime: Infinity,
    gcTime: 60_000,
  });

  const url = useMemo(() => (arquivo.data && !ehTexto ? URL.createObjectURL(arquivo.data) : null), [arquivo.data, ehTexto]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  const texto = useQuery({
    queryKey: ["arquivo-texto", documentoId, versao],
    queryFn: async () => formatarXml(await arquivo.data!.text()),
    enabled: ehTexto && Boolean(arquivo.data),
    staleTime: Infinity,
  });

  if (!visualizavel) {
    return (
      <EstadoVazio
        icone={FileQuestion}
        titulo="Pré-visualização indisponível para este formato"
        descricao={nomeArquivo}
        acao={
          <Botao variante="secundario" icone={Download} onClick={() => salvarArquivo(documentoId, nomeArquivo)}>
            Baixar arquivo
          </Botao>
        }
      />
    );
  }
  if (arquivo.isLoading || texto.isLoading) return <Carregando texto="Abrindo o arquivo..." />;
  if (arquivo.error) return <MensagemErro erro={arquivo.error} />;

  if (ehTexto) {
    return (
      <pre className="rolagem-fina max-h-[70dvh] overflow-auto rounded-xl bg-ink p-4 text-xs leading-relaxed text-surface">
        <code>{texto.data}</code>
      </pre>
    );
  }
  if (mime.startsWith("image/")) {
    return <img src={url ?? undefined} alt={nomeArquivo} className="mx-auto max-h-[75dvh] rounded-xl object-contain" />;
  }
  return <iframe src={url ?? undefined} title={nomeArquivo} className="h-[75dvh] w-full rounded-xl border border-line-soft bg-white" />;
}
