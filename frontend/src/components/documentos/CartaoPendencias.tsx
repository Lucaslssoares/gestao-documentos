import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { CalendarPlus, Check, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../lib/api";
import { chaves, useEquipe } from "../../lib/consultas";
import { formatarData, hojeIso, textoDias } from "../../lib/format";
import type { DocumentoDetalhe, Pendencia } from "../../lib/tipos";
import { useConcluirPendencia } from "../pendencias/useConcluirPendencia";
import { Campo } from "../ui/Basicos";
import { Botao, BotaoIcone } from "../ui/Botao";

const diasAte = (iso: string) => Math.round((Date.parse(`${iso}T00:00:00`) - Date.parse(`${hojeIso()}T00:00:00`)) / 86_400_000);

/** Subtrai dias de uma data AAAA-MM-DD. */
function antes(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Prazos e pendências do documento (condicionantes, renovação, entregas): checklist com
 * responsável e prazo. Quem pode editar o documento cria e remove; o responsável conclui.
 */
export function CartaoPendencias({ documento: d }: { documento: DocumentoDetalhe }) {
  const { perfil } = useAuth();
  const queryClient = useQueryClient();
  const equipe = useEquipe();
  const concluir = useConcluirPendencia();
  const [formulario, setFormulario] = useState<{ titulo: string; prazo: string; responsavel_id: string; aviso_dias: number } | null>(null);

  const atualizar = () => {
    for (const chave of [chaves.documento(d.id), chaves.pendencias, chaves.painel]) void queryClient.invalidateQueries({ queryKey: chave });
  };
  const criar = useMutation({
    mutationFn: (dados: NonNullable<typeof formulario>) => api(`/documentos/${d.id}/pendencias`, { method: "POST", json: dados }),
    onSuccess: () => {
      toast.success("Pendência criada. O responsável será avisado antes do prazo.");
      setFormulario(null);
      atualizar();
    },
    onError: (err) => toast.error(err.message),
  });
  const remover = useMutation({
    mutationFn: (id: string) => api(`/pendencias/${id}`, { method: "DELETE" }),
    onSuccess: atualizar,
    onError: (err) => toast.error(err.message),
  });

  const abertas = d.pendencias.filter((p) => !p.concluida_em);
  const concluidas = d.pendencias.filter((p) => p.concluida_em);
  const temRenovacao = abertas.some((p) => p.prazo);
  const podeConcluir = (p: Pendencia) => d.permissoes.editar || p.responsavel_id === perfil?.id;

  function novaRenovacao() {
    // Prazo para iniciar a renovação: antes do vencimento, respeitando a antecedência do aviso.
    const prazo = d.data_validade ? antes(d.data_validade, Math.min(d.aviso_dias, 30)) : "";
    setFormulario({ titulo: `Renovar ${d.tipo_nome.toLowerCase()}`, prazo: prazo < hojeIso() ? hojeIso() : prazo, responsavel_id: d.responsavel_id ?? perfil?.id ?? "", aviso_dias: 7 });
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (formulario) criar.mutate(formulario);
  }

  return (
    <section className="cartao p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">Prazos e pendências</h2>
        {d.permissoes.editar && !formulario && (
          <BotaoIcone
            icone={Plus}
            rotulo="Adicionar pendência"
            onClick={() => setFormulario({ titulo: "", prazo: "", responsavel_id: d.responsavel_id ?? perfil?.id ?? "", aviso_dias: 7 })}
          />
        )}
      </div>

      {abertas.length === 0 && !formulario && <p className="text-sm text-ink-muted">Nenhuma pendência aberta.</p>}
      <ul className="space-y-1">
        {abertas.map((p) => {
          const dias = p.prazo ? diasAte(p.prazo) : null;
          return (
            <li key={p.id} className="group flex items-start gap-2.5 rounded-lg py-1.5">
              <button
                type="button"
                disabled={!podeConcluir(p) || concluir.isPending}
                onClick={() => concluir.mutate({ id: p.id, concluida: true, documentoId: d.id })}
                className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border-2 border-line text-transparent transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`Concluir: ${p.titulo}`}
                title="Concluir"
              >
                <Check className="size-3.5" aria-hidden />
              </button>
              <span className="min-w-0 flex-1 text-sm">
                <span className="block">{p.titulo}</span>
                <span className="block text-xs text-ink-muted">
                  {p.prazo ? (
                    <span className={clsx(dias! < 0 ? "font-semibold text-danger" : dias! <= p.aviso_dias && "font-semibold text-warning-ink")}>
                      {formatarData(p.prazo)} ({textoDias(dias)})
                    </span>
                  ) : (
                    "sem prazo"
                  )}
                  {p.responsavel_nome && ` · ${p.responsavel_nome}`}
                </span>
              </span>
              {d.permissoes.editar && (
                <BotaoIcone icone={Trash2} rotulo="Remover pendência" className="size-7 opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => remover.mutate(p.id)} />
              )}
            </li>
          );
        })}
      </ul>

      {d.permissoes.editar && !formulario && d.data_validade && !temRenovacao && (
        <button type="button" onClick={novaRenovacao} className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary-dark hover:underline">
          <CalendarPlus className="size-4" aria-hidden /> Criar prazo de renovação
        </button>
      )}

      {formulario && (
        <form onSubmit={enviar} className="mt-3 grid gap-3 border-t border-line-soft pt-3">
          <Campo rotulo="O que precisa ser feito" htmlFor="pend-titulo" obrigatorio>
            <input
              id="pend-titulo"
              required
              autoFocus
              maxLength={300}
              className="campo"
              placeholder="Ex.: Protocolar renovação na SEMAS"
              value={formulario.titulo}
              onChange={(e) => setFormulario({ ...formulario, titulo: e.target.value })}
            />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Prazo" htmlFor="pend-prazo">
              <input id="pend-prazo" type="date" className="campo" value={formulario.prazo} onChange={(e) => setFormulario({ ...formulario, prazo: e.target.value })} />
            </Campo>
            <Campo rotulo="Avisar (dias antes)" htmlFor="pend-aviso">
              <input
                id="pend-aviso"
                type="number"
                min={0}
                max={365}
                className="campo"
                value={formulario.aviso_dias}
                onChange={(e) => setFormulario({ ...formulario, aviso_dias: Number(e.target.value) })}
              />
            </Campo>
          </div>
          <Campo rotulo="Responsável" htmlFor="pend-resp">
            <select id="pend-resp" className="campo" value={formulario.responsavel_id} onChange={(e) => setFormulario({ ...formulario, responsavel_id: e.target.value })}>
              {equipe.data?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          </Campo>
          <div className="flex justify-end gap-2">
            <Botao variante="secundario" tamanho="sm" onClick={() => setFormulario(null)}>
              Cancelar
            </Botao>
            <Botao type="submit" tamanho="sm" carregando={criar.isPending}>
              Adicionar
            </Botao>
          </div>
        </form>
      )}

      {concluidas.length > 0 && (
        <details className="mt-3 border-t border-line-soft pt-2 text-sm">
          <summary className="cursor-pointer text-ink-muted">Concluídas ({concluidas.length})</summary>
          <ul className="mt-1 space-y-1">
            {concluidas.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-ink-muted">
                <Check className="size-4 shrink-0 text-success" aria-hidden />
                <span className="flex-1 line-through">{p.titulo}</span>
                {podeConcluir(p) && (
                  <BotaoIcone icone={RotateCcw} rotulo="Reabrir" className="size-7" onClick={() => concluir.mutate({ id: p.id, concluida: false, documentoId: d.id })} />
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
