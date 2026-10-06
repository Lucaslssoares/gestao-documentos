import clsx from "clsx";
import { FileUp, X } from "lucide-react";
import { useRef, useState } from "react";
import { formatarTamanho } from "../../lib/format";
import { IconeArquivo } from "./Indicadores";

export const EXTENSOES_ACEITAS = ".pdf,.xml,.docx,.png,.jpg,.jpeg,.txt";
const LIMITE_MB = 25;

/** Área de arrastar-e-soltar (ou clicar) para escolher o arquivo. */
export function AreaUpload({ arquivo, aoEscolher }: { arquivo: File | null; aoEscolher: (arquivo: File | null) => void }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function escolher(lista: FileList | null) {
    const escolhido = lista?.[0];
    if (!escolhido) return;
    const extensao = `.${escolhido.name.split(".").pop()?.toLowerCase()}`;
    if (!EXTENSOES_ACEITAS.split(",").includes(extensao)) {
      setErro("Formato não aceito. Envie PDF, XML, DOCX, PNG, JPG ou TXT.");
      return;
    }
    if (escolhido.size > LIMITE_MB * 1024 * 1024) {
      setErro(`Arquivo maior que ${LIMITE_MB} MB.`);
      return;
    }
    setErro(null);
    aoEscolher(escolhido);
  }

  if (arquivo) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-line bg-paper p-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-surface-2 text-primary-dark">
          <IconeArquivo mime={arquivo.type} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{arquivo.name}</span>
          <span className="block text-xs text-ink-muted">{formatarTamanho(arquivo.size)}</span>
        </span>
        <button type="button" onClick={() => aoEscolher(null)} className="rounded-lg p-2 text-ink-muted hover:bg-surface-2" aria-label="Remover arquivo">
          <X className="size-4" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => entrada.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          escolher(e.dataTransfer.files);
        }}
        className={clsx(
          "flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors",
          arrastando ? "border-primary bg-warning-soft/60" : "border-line bg-paper hover:border-primary/60",
        )}
      >
        <FileUp className="size-8 text-primary" aria-hidden />
        <span className="font-semibold">Arraste o arquivo aqui ou clique para escolher</span>
        <span className="text-sm text-ink-muted">PDF, XML, DOCX, PNG, JPG ou TXT · até {LIMITE_MB} MB</span>
      </button>
      <input ref={entrada} type="file" accept={EXTENSOES_ACEITAS} className="hidden" onChange={(e) => escolher(e.target.files)} />
      {erro && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {erro}
        </p>
      )}
    </div>
  );
}
