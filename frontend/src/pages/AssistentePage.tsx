import { useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { FileText, LoaderCircle, MessageSquare, Plus, Send, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { TextoResposta } from "../components/assistente/TextoResposta";
import { BotaoIcone } from "../components/ui/Botao";
import { Carregando, MensagemErro } from "../components/ui/Basicos";
import { api, postSse } from "../lib/api";
import { formatarDataHora } from "../lib/format";
import type { Fonte, MensagemChat } from "../lib/tipos";

const SUGESTOES = [
  "Quais contratos vencem nos próximos 30 dias?",
  "Encontre documentos relacionados ao fornecedor Norte Log.",
  "Qual é o valor do contrato C-2026-014?",
  "Resuma o aditivo do contrato C-2026-014.",
  "Quais certidões de fornecedores estão vencidas?",
];

interface Conversa {
  id: string;
  titulo: string;
  atualizado_em: string;
}

export default function AssistentePage() {
  const [params, setParams] = useSearchParams();
  const conversaId = params.get("c");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [mensagens, setMensagens] = useState<MensagemChat[]>([]);
  // Pergunta vinda da busca global ou do painel (?q=...)
  const [pergunta, setPergunta] = useState(() => params.get("q") ?? "");
  const perguntaInicialEnviada = useRef(false);
  const [status, setStatus] = useState<string | null>(null);
  const [respondendo, setRespondendo] = useState(false);
  const [conversaCarregada, setConversaCarregada] = useState<string | null>(null);
  const fim = useRef<HTMLDivElement>(null);
  const controle = useRef<AbortController | null>(null);

  const disponivel = useQuery({ queryKey: ["chat-status"], queryFn: () => api<{ disponivel: boolean }>("/chat/status"), staleTime: 60_000 });
  const conversas = useQuery({ queryKey: ["conversas"], queryFn: () => api<{ itens: Conversa[] }>("/chat/conversas").then((r) => r.itens) });

  // Abre uma conversa salva (ao trocar pela lista ou pelo link).
  const historico = useQuery({
    queryKey: ["conversa", conversaId],
    queryFn: () => api<{ mensagens: MensagemChat[] }>(`/chat/conversas/${conversaId}`).then((r) => r.mensagens),
    enabled: Boolean(conversaId) && conversaId !== conversaCarregada && !respondendo,
  });
  if (historico.data && conversaId && conversaId !== conversaCarregada && !respondendo) {
    setConversaCarregada(conversaId);
    setMensagens(historico.data);
  }
  if (!conversaId && conversaCarregada !== null && !respondendo) {
    setConversaCarregada(null);
    setMensagens([]);
  }

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensagens, status]);

  useEffect(() => () => controle.current?.abort(), []);

  // Envia automaticamente a pergunta recebida pela URL quando o assistente está disponível.
  useEffect(() => {
    const q = params.get("q");
    if (!q || perguntaInicialEnviada.current || !disponivel.data?.disponivel) return;
    perguntaInicialEnviada.current = true;
    void enviar(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disponivel.data?.disponivel]);

  async function enviar(texto: string) {
    const conteudo = texto.trim();
    if (!conteudo || respondendo) return;
    setPergunta("");
    setRespondendo(true);
    setStatus("Pensando");
    setMensagens((m) => [...m, { papel: "user", conteudo, fontes: [] }, { papel: "assistant", conteudo: "", fontes: [] }]);

    const atualizarUltima = (fn: (m: MensagemChat) => MensagemChat) =>
      setMensagens((lista) => [...lista.slice(0, -1), fn(lista[lista.length - 1]!)]);

    controle.current = new AbortController();
    try {
      await postSse(
        "/chat",
        { conversa_id: conversaId ?? undefined, mensagem: conteudo },
        (evento, dados) => {
          const d = dados as Record<string, unknown>;
          if (evento === "conversa" && typeof d.id === "string" && d.id !== conversaId) {
            setConversaCarregada(d.id);
            setParams({ c: d.id }, { replace: true });
          } else if (evento === "status") setStatus(String(d.texto));
          else if (evento === "texto") {
            setStatus(null);
            atualizarUltima((m) => ({ ...m, conteudo: m.conteudo + String(d.delta) }));
          } else if (evento === "fontes") atualizarUltima((m) => ({ ...m, fontes: d.fontes as Fonte[] }));
          else if (evento === "erro") atualizarUltima((m) => ({ ...m, conteudo: `⚠️ ${String(d.mensagem)}` }));
        },
        controle.current.signal,
      );
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        atualizarUltima((m) => ({ ...m, conteudo: `⚠️ ${err instanceof Error ? err.message : "Falha na conversa."}` }));
      }
    } finally {
      setRespondendo(false);
      setStatus(null);
      void queryClient.invalidateQueries({ queryKey: ["conversas"] });
    }
  }

  async function apagarConversa(id: string) {
    try {
      await api(`/chat/conversas/${id}`, { method: "DELETE" });
      if (id === conversaId) setParams({}, { replace: true });
      await queryClient.invalidateQueries({ queryKey: ["conversas"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível apagar.");
    }
  }

  function abrirFonte(fonte: Fonte) {
    navigate(`/documentos/${fonte.documento_id}`);
  }

  function aoEnviar(e: FormEvent) {
    e.preventDefault();
    void enviar(pergunta);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
      <aside className="hidden lg:block">
        <button
          type="button"
          onClick={() => setParams({}, { replace: true })}
          className="mb-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-line bg-paper text-sm font-semibold hover:bg-surface-2/60"
        >
          <Plus className="size-4" aria-hidden /> Nova conversa
        </button>
        <nav aria-label="Conversas anteriores" className="rolagem-fina max-h-[70dvh] space-y-0.5 overflow-y-auto">
          {conversas.data?.map((c) => (
            <div key={c.id} className={clsx("group flex items-center rounded-lg", c.id === conversaId ? "bg-warning-soft" : "hover:bg-surface-2/60")}>
              <button type="button" onClick={() => setParams({ c: c.id })} className="min-w-0 flex-1 px-3 py-2 text-left">
                <span className="block truncate text-sm font-medium">{c.titulo}</span>
                <span className="block text-xs text-ink-muted">{formatarDataHora(c.atualizado_em)}</span>
              </button>
              <BotaoIcone icone={Trash2} rotulo="Apagar conversa" className="opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => apagarConversa(c.id)} />
            </div>
          ))}
        </nav>
      </aside>

      <section className="cartao flex min-h-[calc(100dvh-11rem)] flex-col lg:min-h-[calc(100dvh-6rem)]">
        <header className="flex items-center gap-3 border-b border-line-soft px-4 py-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-warning-soft text-primary-dark">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="font-semibold">
              Assistente IA <span className="ml-1 rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold text-ink-muted">Beta</span>
            </h1>
            <p className="truncate text-xs text-ink-muted">Responde com base nos documentos que você pode acessar, sempre citando as fontes.</p>
          </div>
          {conversaId && (
            <BotaoIcone icone={Plus} rotulo="Nova conversa" className="lg:hidden" onClick={() => setParams({}, { replace: true })} />
          )}
        </header>

        <div className="rolagem-fina flex-1 space-y-5 overflow-y-auto px-4 py-5" aria-live="polite">
          {disponivel.data?.disponivel === false && (
            <MensagemErro erro={new Error("O assistente não está configurado no servidor (falta a chave ANTHROPIC_API_KEY).")} />
          )}
          {historico.isLoading && <Carregando />}

          {mensagens.length === 0 && !historico.isLoading && (
            <div className="mx-auto max-w-lg py-6 text-center">
              <MessageSquare className="mx-auto size-10 text-primary" aria-hidden />
              <p className="mt-3 font-semibold">Pergunte, e o sistema responde com seus documentos.</p>
              <p className="mt-1 text-sm text-ink-muted">Experimente:</p>
              <div className="mt-4 flex flex-col gap-2">
                {SUGESTOES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => enviar(s)}
                    className="rounded-xl border border-line-soft bg-surface/60 px-4 py-2.5 text-left text-sm hover:border-primary/50 hover:bg-warning-soft/50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mensagens.map((m, i) =>
            m.papel === "user" ? (
              <div key={i} className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary-dark px-4 py-2.5 text-[15px] whitespace-pre-line text-white">{m.conteudo}</p>
              </div>
            ) : (
              <div key={i} className="max-w-[92%]">
                <div className="rounded-2xl rounded-bl-md bg-surface/70 px-4 py-3">
                  {m.conteudo ? (
                    <TextoResposta texto={m.conteudo} fontes={m.fontes} aoClicarFonte={abrirFonte} />
                  ) : (
                    <span className="inline-flex items-center gap-2 text-sm text-ink-muted">
                      <LoaderCircle className="size-4 animate-spin text-primary" aria-hidden />
                      {status ?? "Pensando"}...
                    </span>
                  )}
                </div>
                {m.fontes.length > 0 && (
                  <div className="mt-2">
                    <p className="mb-1 text-xs font-semibold text-ink-muted">Fontes</p>
                    <ul className="grid gap-1.5 sm:grid-cols-2">
                      {m.fontes.map((f) => (
                        <li key={f.id}>
                          <button
                            type="button"
                            onClick={() => abrirFonte(f)}
                            className="flex w-full items-start gap-2 rounded-xl border border-line-soft bg-paper px-3 py-2 text-left hover:border-primary/50"
                            title={f.trecho}
                          >
                            <span className="mt-0.5 rounded-md bg-warning-soft px-1.5 text-[11px] font-semibold text-primary-dark">{f.id.slice(1)}</span>
                            <span className="min-w-0">
                              <span className="flex items-center gap-1 truncate text-sm font-medium">
                                <FileText className="size-3.5 shrink-0" aria-hidden />
                                <span className="truncate">{f.titulo}</span>
                              </span>
                              {f.detalhe && <span className="block truncate text-xs text-ink-muted">{f.detalhe}</span>}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ),
          )}
          {status && mensagens.at(-1)?.conteudo && (
            <p className="inline-flex items-center gap-2 text-sm text-ink-muted">
              <LoaderCircle className="size-4 animate-spin text-primary" aria-hidden /> {status}...
            </p>
          )}
          <div ref={fim} />
        </div>

        <form onSubmit={aoEnviar} className="flex items-end gap-2 border-t border-line-soft p-3">
          <textarea
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void enviar(pergunta);
              }
            }}
            rows={1}
            maxLength={4000}
            placeholder="Digite sua pergunta..."
            aria-label="Sua pergunta"
            className="campo max-h-40 min-h-11 resize-none"
          />
          <button
            type="submit"
            disabled={!pergunta.trim() || respondendo || disponivel.data?.disponivel === false}
            aria-label="Enviar pergunta"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-dark text-white hover:bg-primary-deeper disabled:opacity-50"
          >
            <Send className="size-5" aria-hidden />
          </button>
        </form>
      </section>
    </div>
  );
}
