import { FileSearch } from "lucide-react";
import { Link } from "react-router";
import { formatarData, formatarTamanho, tempoRelativo, textoPrazo } from "../../lib/format";
import type { DocumentoResumo } from "../../lib/tipos";
import { Selo } from "../ui/Basicos";
import { IconeArquivo, SituacaoBadge } from "./Indicadores";

function extensao(nome: string): string {
  return nome.split(".").pop()?.toUpperCase().slice(0, 4) ?? "";
}

function IconeDocumento({ d, grande }: { d: DocumentoResumo; grande?: boolean }) {
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center rounded-xl bg-surface-2 text-primary-dark ${grande ? "size-12" : "size-10"}`}
      style={d.raiz_cor ? { backgroundColor: `${d.raiz_cor}1a`, color: d.raiz_cor } : undefined}
    >
      <IconeArquivo mime={d.mime_type} className={grande ? "size-6" : undefined} />
      <span className="absolute -right-1 -bottom-1 rounded-md bg-paper px-1 text-[9px] font-bold text-ink-muted ring-1 ring-line-soft">{extensao(d.nome_arquivo)}</span>
    </span>
  );
}

function Validade({ d }: { d: DocumentoResumo }) {
  if (!d.data_validade) return <span className="text-ink-muted">—</span>;
  const prazo = d.situacao === "a_vencer" || d.situacao === "vencido" ? textoPrazo(d.dias_para_vencer) : null;
  return (
    <span>
      {formatarData(d.data_validade)}
      {prazo && <span className={`block text-xs ${d.situacao === "vencido" ? "text-danger" : "text-warning-ink"}`}>{prazo}</span>}
    </span>
  );
}

/** Lista em formato de tabela (desktop) e cartões empilhados (celular). */
export function ListaDocumentos({ documentos, ocultarPasta }: { documentos: DocumentoResumo[]; ocultarPasta?: boolean }) {
  return (
    <div>
      <div
        className="hidden grid-cols-[minmax(0,2.4fr)_minmax(0,1.2fr)_minmax(0,1.1fr)_7.5rem_7rem] gap-4 border-b border-line-soft px-5 py-2.5 text-xs font-semibold tracking-wide text-ink-muted uppercase lg:grid"
        aria-hidden
      >
        <span>Nome</span>
        <span>{ocultarPasta ? "Tipo" : "Pasta"}</span>
        <span>Empresa</span>
        <span>Validade</span>
        <span>Situação</span>
      </div>
      <ul className="divide-y divide-line-soft">
        {documentos.map((d) => (
          <li key={d.id}>
            <Link
              to={`/documentos/${d.id}`}
              className="grid gap-x-4 gap-y-1 px-4 py-3.5 transition-colors hover:bg-surface/60 sm:px-5 lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1.2fr)_minmax(0,1.1fr)_7.5rem_7rem] lg:items-center"
            >
              <span className="flex min-w-0 items-center gap-3">
                <IconeDocumento d={d} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-ink">{d.titulo}</span>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
                    <span>{d.tipo_nome}</span>
                    <span aria-hidden>·</span>
                    <span>{tempoRelativo(d.criado_em)}</span>
                    {d.encontrado_no_conteudo && (
                      <span className="inline-flex items-center gap-1 font-medium text-success">
                        <FileSearch className="size-3.5" aria-hidden /> no conteúdo
                      </span>
                    )}
                    {d.tags.slice(0, 3).map((t) => (
                      <Selo key={t.id} cor={t.cor}>
                        {t.nome}
                      </Selo>
                    ))}
                  </span>
                </span>
              </span>
              <span className="hidden truncate text-sm text-ink-muted lg:block">{ocultarPasta ? d.tipo_nome : d.categoria_caminho}</span>
              <span className="hidden truncate text-sm lg:block">{d.contraparte_nome ?? d.empresa_nome ?? <span className="text-ink-muted">—</span>}</span>
              <span className="hidden text-sm lg:block">
                <Validade d={d} />
              </span>
              <span className="flex flex-wrap items-center gap-2 pl-[3.25rem] lg:pl-0">
                <SituacaoBadge situacao={d.situacao} />
                <span className="text-xs text-ink-muted lg:hidden">{d.contraparte_nome ?? d.empresa_nome ?? d.categoria_caminho}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Grade de cartões — boa para navegar visualmente pelas pastas. */
export function GradeDocumentos({ documentos }: { documentos: DocumentoResumo[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-3">
      {documentos.map((d) => (
        <li key={d.id}>
          <Link to={`/documentos/${d.id}`} className="cartao-interativo flex h-full flex-col p-4">
            <div className="flex items-start justify-between gap-3">
              <IconeDocumento d={d} grande />
              <SituacaoBadge situacao={d.situacao} dias={d.dias_para_vencer} detalhado />
            </div>
            <p className="mt-3 line-clamp-2 font-semibold">{d.titulo}</p>
            <p className="mt-0.5 truncate text-xs text-ink-muted">
              {d.tipo_nome} · {d.categoria_caminho}
            </p>
            {d.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {d.tags.slice(0, 3).map((t) => (
                  <Selo key={t.id} cor={t.cor}>
                    {t.nome}
                  </Selo>
                ))}
              </div>
            )}
            <div className="mt-auto flex items-center justify-between gap-2 border-t border-line-soft pt-3 text-xs text-ink-muted">
              <span className="truncate">{d.contraparte_nome ?? d.empresa_nome ?? "—"}</span>
              <span className="shrink-0">{formatarTamanho(d.tamanho_bytes)}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
