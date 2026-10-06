import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Download, Pencil, RefreshCw, Trash2, Upload } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { AreaUpload } from "../components/documentos/AreaUpload";
import { IconeArquivo, SituacaoBadge, StatusProcessamentoTexto } from "../components/documentos/Indicadores";
import { LinhaDoTempo } from "../components/documentos/LinhaDoTempo";
import { VisualizadorArquivo } from "../components/documentos/VisualizadorArquivo";
import { Botao } from "../components/ui/Botao";
import { Abas, Campo, Carregando, MensagemErro, Selo } from "../components/ui/Basicos";
import { Modal } from "../components/ui/Modal";
import { api, salvarArquivo } from "../lib/api";
import { chaves } from "../lib/consultas";
import { formatarCampo, formatarData, formatarDataHora, formatarTamanho, tempoRelativo, textoPrazo } from "../lib/format";
import type { DocumentoDetalhe, EventoHistorico } from "../lib/tipos";

type Aba = "arquivo" | "versoes" | "historico";

export default function DocumentoPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [aba, setAba] = useState<Aba>("arquivo");
  const [substituir, setSubstituir] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);

  const documento = useQuery({
    queryKey: chaves.documento(id),
    queryFn: () => api<DocumentoDetalhe>(`/documentos/${id}`),
    // Enquanto indexa, atualiza o status sozinho.
    refetchInterval: (q) => (["pendente", "processando"].includes(q.state.data?.status_processamento ?? "") ? 4000 : false),
  });
  const historico = useQuery({
    queryKey: chaves.historico(id),
    queryFn: () => api<{ itens: EventoHistorico[] }>(`/historico?documento=${id}&limite=100`).then((r) => r.itens),
    enabled: aba === "historico",
  });

  const atualizarListas = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: chaves.documentos }),
      queryClient.invalidateQueries({ queryKey: chaves.painel }),
      queryClient.invalidateQueries({ queryKey: chaves.categorias }),
    ]);

  const excluir = useMutation({
    mutationFn: () => api(`/documentos/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      toast.success("Documento enviado para a lixeira.");
      await atualizarListas();
      navigate("/documentos", { replace: true });
    },
    onError: (err) => toast.error(err.message),
  });

  const reprocessar = useMutation({
    mutationFn: () => api(`/documentos/${id}/reprocessar`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Documento enviado para nova indexação.");
      void queryClient.invalidateQueries({ queryKey: chaves.documento(id) });
    },
    onError: (err) => toast.error(err.message),
  });

  if (documento.isLoading) return <Carregando />;
  if (documento.error) return <MensagemErro erro={documento.error} />;
  const d = documento.data;
  if (!d) return null;

  const prazo = d.situacao === "a_vencer" || d.situacao === "vencido" ? textoPrazo(d.dias_para_vencer) : null;

  return (
    <div>
      <nav aria-label="Caminho" className="mb-3 flex flex-wrap items-center gap-1 text-sm text-ink-muted">
        <Link to="/documentos" className="hover:text-primary-dark hover:underline">
          Documentos
        </Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <Link to={`/documentos?categoria=${d.categoria_id}`} className="hover:text-primary-dark hover:underline">
          {d.categoria_caminho}
        </Link>
      </nav>

      <div className="cartao mb-5 flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-4">
          <span
            className="flex size-14 shrink-0 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${d.raiz_cor ?? "#C67139"}1f`, color: d.raiz_cor ?? "#8C491A" }}
          >
            <IconeArquivo mime={d.mime_type} className="size-7" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold break-words">{d.titulo}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <SituacaoBadge situacao={d.situacao} dias={d.dias_para_vencer} detalhado />
              <Selo>{d.tipo_nome}</Selo>
              {d.tags.map((t) => (
                <Selo key={t.id} cor={t.cor}>
                  {t.nome}
                </Selo>
              ))}
            </div>
            <p className="mt-2 text-sm text-ink-muted">
              Versão {d.versao_atual} · {formatarTamanho(d.tamanho_bytes)} · enviado por {d.criado_por_nome ?? "Sistema"} {tempoRelativo(d.criado_em)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Botao variante="secundario" icone={Download} onClick={() => salvarArquivo(d.id, d.nome_arquivo).catch((e: Error) => toast.error(e.message))}>
            Baixar
          </Botao>
          {d.permissoes.editar && (
            <>
              <Botao variante="secundario" icone={Upload} onClick={() => setSubstituir(true)}>
                Nova versão
              </Botao>
              <Botao icone={Pencil} onClick={() => navigate(`/documentos/${d.id}/editar`)}>
                Editar
              </Botao>
            </>
          )}
          {d.permissoes.excluir && (
            <Botao variante="fantasma" icone={Trash2} onClick={() => setConfirmarExclusao(true)} aria-label="Excluir documento">
              <span className="sr-only">Excluir</span>
            </Botao>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <aside className="space-y-4 lg:order-last">
          <section className="cartao p-4">
            <h2 className="mb-3 font-semibold">Informações</h2>
            <dl className="grid gap-2.5 text-sm">
              <Info rotulo="Categoria">{d.categoria_caminho}</Info>
              <Info rotulo="Empresa">{[d.empresa_nome, d.filial_nome].filter(Boolean).join(" · ") || "—"}</Info>
              <Info rotulo="Contraparte">{d.contraparte_nome ?? "—"}</Info>
              <Info rotulo="Setor responsável">{d.setor_nome ?? "—"}</Info>
              <Info rotulo="Responsável">{d.responsavel_nome ?? "—"}</Info>
              <Info rotulo="Data do documento">{formatarData(d.data_documento)}</Info>
              <Info rotulo="Validade">
                {formatarData(d.data_validade)}
                {prazo && <span className={d.situacao === "vencido" ? "text-danger" : "text-warning-ink"}> · {prazo}</span>}
              </Info>
              <Info rotulo="Enviado por">
                {d.criado_por_nome ?? "Sistema"} em {formatarDataHora(d.criado_em)}
              </Info>
            </dl>
            {d.descricao && <p className="mt-3 border-t border-line-soft pt-3 text-sm whitespace-pre-line text-ink-muted">{d.descricao}</p>}
          </section>

          {d.tipo.campos.length > 0 && (
            <section className="cartao p-4">
              <h2 className="mb-3 font-semibold">Dados do {d.tipo.nome.toLowerCase()}</h2>
              <dl className="grid gap-2.5 text-sm">
                {d.tipo.campos.map((campo) => (
                  <Info key={campo.chave} rotulo={campo.rotulo}>
                    {formatarCampo(campo, d.metadados[campo.chave])}
                  </Info>
                ))}
              </dl>
            </section>
          )}

          <section className="cartao p-4 text-sm">
            <h2 className="mb-2 font-semibold">Arquivo</h2>
            <p className="break-all">{d.nome_arquivo}</p>
            <p className="mt-1 text-ink-muted">
              {formatarTamanho(d.tamanho_bytes)} · versão {d.versao_atual}
              {d.paginas ? ` · ${d.paginas} página(s)` : ""}
            </p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span>
                Pesquisa no conteúdo: <StatusProcessamentoTexto status={d.status_processamento} />
              </span>
              {d.permissoes.editar && (d.status_processamento === "erro" || d.status_processamento === "sem_texto") && (
                <Botao variante="fantasma" tamanho="sm" icone={RefreshCw} carregando={reprocessar.isPending} onClick={() => reprocessar.mutate()}>
                  Reprocessar
                </Botao>
              )}
            </div>
            {d.erro_processamento && <p className="mt-2 text-xs text-ink-muted">{d.erro_processamento}</p>}
          </section>
        </aside>

        <section className="cartao min-w-0 p-3 sm:p-4">
          <Abas<Aba>
            ativa={aba}
            aoTrocar={setAba}
            abas={[
              { id: "arquivo", rotulo: "Visualizar" },
              { id: "versoes", rotulo: "Versões", contador: d.versoes.length },
              { id: "historico", rotulo: "Histórico" },
            ]}
          />
          <div className="pt-4">
            {aba === "arquivo" && <VisualizadorArquivo documentoId={d.id} nomeArquivo={d.nome_arquivo} mime={d.mime_type} versao={d.versao_atual} />}
            {aba === "versoes" && (
              <ul className="divide-y divide-line-soft">
                {d.versoes.map((v) => (
                  <li key={v.id} className="flex items-center gap-3 py-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-sm font-semibold text-primary-dark">
                      v{v.versao}
                    </span>
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="block truncate font-medium">{v.nome_arquivo}</span>
                      <span className="block text-xs text-ink-muted">
                        {formatarDataHora(v.enviado_em)} · {formatarTamanho(v.tamanho_bytes)}
                        {v.versao === d.versao_atual && " · atual"}
                        {v.comentario && ` · ${v.comentario}`}
                      </span>
                    </span>
                    <Botao
                      variante="fantasma"
                      tamanho="sm"
                      icone={Download}
                      onClick={() => salvarArquivo(d.id, v.nome_arquivo, v.versao).catch((e: Error) => toast.error(e.message))}
                      aria-label={`Baixar versão ${v.versao}`}
                    />
                  </li>
                ))}
              </ul>
            )}
            {aba === "historico" && (historico.isLoading ? <Carregando /> : historico.error ? <MensagemErro erro={historico.error} /> : <LinhaDoTempo eventos={historico.data ?? []} />)}
          </div>
        </section>
      </div>

      <SubstituirArquivoModal
        aberto={substituir}
        documentoId={d.id}
        aoFechar={() => setSubstituir(false)}
        aoConcluir={async () => {
          setSubstituir(false);
          setAba("versoes");
          await Promise.all([queryClient.invalidateQueries({ queryKey: chaves.documento(id) }), atualizarListas()]);
        }}
      />

      <Modal
        aberto={confirmarExclusao}
        aoFechar={() => setConfirmarExclusao(false)}
        titulo="Excluir documento?"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setConfirmarExclusao(false)}>
              Cancelar
            </Botao>
            <Botao variante="perigo" carregando={excluir.isPending} onClick={() => excluir.mutate()}>
              Enviar para a lixeira
            </Botao>
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          <strong className="text-ink">{d.titulo}</strong> vai para a lixeira e pode ser restaurado por um gestor ou administrador. A exclusão fica registrada no
          histórico.
        </p>
      </Modal>
    </div>
  );
}

function Info({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[148px_1fr] gap-2">
      <dt className="text-ink-muted">{rotulo}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function SubstituirArquivoModal({
  aberto,
  documentoId,
  aoFechar,
  aoConcluir,
}: {
  aberto: boolean;
  documentoId: string;
  aoFechar: () => void;
  aoConcluir: () => Promise<void>;
}) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [comentario, setComentario] = useState("");
  const enviar = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append("arquivo", arquivo!);
      if (comentario.trim()) form.append("comentario", comentario.trim());
      return api(`/documentos/${documentoId}/versoes`, { method: "POST", body: form });
    },
    onSuccess: async () => {
      toast.success("Nova versão enviada. A anterior continua disponível no histórico de versões.");
      setArquivo(null);
      setComentario("");
      await aoConcluir();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Enviar nova versão do arquivo"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao disabled={!arquivo} carregando={enviar.isPending} onClick={() => enviar.mutate()}>
            Enviar versão
          </Botao>
        </>
      }
    >
      <div className="grid gap-4">
        <AreaUpload arquivo={arquivo} aoEscolher={setArquivo} />
        <Campo rotulo="O que mudou? (opcional)" htmlFor="comentario-versao">
          <input id="comentario-versao" maxLength={500} className="campo" value={comentario} onChange={(e) => setComentario(e.target.value)} />
        </Campo>
      </div>
    </Modal>
  );
}
