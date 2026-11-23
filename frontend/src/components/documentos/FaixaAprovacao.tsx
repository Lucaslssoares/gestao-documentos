import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, BadgeX, Hourglass } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { chaves } from "../../lib/consultas";
import { formatarDataHora } from "../../lib/format";
import type { DocumentoDetalhe } from "../../lib/tipos";
import { Campo } from "../ui/Basicos";
import { Botao } from "../ui/Botao";
import { Modal } from "../ui/Modal";

/** Faixa no topo do documento: aguardando aprovação (com a decisão para o aprovador) ou reprovado. */
export function FaixaAprovacao({ documento: d }: { documento: DocumentoDetalhe }) {
  const queryClient = useQueryClient();
  const [reprovando, setReprovando] = useState(false);
  const [comentario, setComentario] = useState("");

  const decidir = useMutation({
    mutationFn: (decisao: "aprovar" | "reprovar") =>
      api(`/documentos/${d.id}/aprovar`, { method: "POST", json: { decisao, comentario: comentario.trim() || undefined } }),
    onSuccess: (_r, decisao) => {
      toast.success(decisao === "aprovar" ? "Documento aprovado." : "Documento reprovado. Quem enviou será avisado.");
      setReprovando(false);
      setComentario("");
      for (const chave of [chaves.documento(d.id), chaves.pendencias, chaves.painel, chaves.documentos]) {
        void queryClient.invalidateQueries({ queryKey: chave });
      }
    },
    onError: (err) => toast.error(err.message),
  });

  if (d.aprovacao === "reprovado") {
    return (
      <div role="status" className="mb-5 flex items-start gap-3 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
        <BadgeX className="mt-0.5 size-5 shrink-0" aria-hidden />
        <p>
          <span className="font-semibold">Reprovado</span>
          {d.aprovador_nome && ` por ${d.aprovador_nome}`}
          {d.aprovado_em && ` em ${formatarDataHora(d.aprovado_em)}`}.{d.comentario_aprovacao && <> Motivo: “{d.comentario_aprovacao}”.</>} Envie uma nova versão
          corrigida para voltar à aprovação.
        </p>
      </div>
    );
  }
  if (d.aprovacao !== "pendente") return null;

  return (
    <div className="mb-5 flex flex-col gap-3 rounded-xl border border-warning-ink/25 bg-warning-soft px-4 py-3 sm:flex-row sm:items-center">
      <Hourglass className="size-5 shrink-0 text-warning-ink" aria-hidden />
      <p className="flex-1 text-sm text-warning-ink">
        <span className="font-semibold">Aguardando aprovação</span>
        {d.aprovador_nome && ` de ${d.aprovador_nome}`}
        {d.aprovacao_solicitada_em && ` desde ${formatarDataHora(d.aprovacao_solicitada_em)}`}.
        {d.permissoes.aprovar && " Confira o arquivo e decida."}
      </p>
      {d.permissoes.aprovar && (
        <div className="flex gap-2">
          <Botao variante="secundario" icone={BadgeX} onClick={() => setReprovando(true)}>
            Reprovar
          </Botao>
          <Botao icone={BadgeCheck} carregando={decidir.isPending && !reprovando} onClick={() => decidir.mutate("aprovar")}>
            Aprovar
          </Botao>
        </div>
      )}

      <Modal aberto={reprovando} aoFechar={() => setReprovando(false)} titulo="Reprovar documento">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            decidir.mutate("reprovar");
          }}
          className="grid gap-4"
        >
          <Campo rotulo="O que precisa ser corrigido?" htmlFor="motivo" obrigatorio ajuda="Quem enviou recebe este comentário por e-mail.">
            <textarea id="motivo" required rows={3} maxLength={1000} className="campo" value={comentario} onChange={(e) => setComentario(e.target.value)} />
          </Campo>
          <div className="flex justify-end gap-2">
            <Botao variante="secundario" onClick={() => setReprovando(false)}>
              Cancelar
            </Botao>
            <Botao type="submit" variante="perigo" carregando={decidir.isPending}>
              Reprovar
            </Botao>
          </div>
        </form>
      </Modal>
    </div>
  );
}
