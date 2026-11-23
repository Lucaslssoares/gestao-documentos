import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { chaves } from "../../lib/consultas";

/** Conclui uma pendência e atualiza a central, o painel e o documento. */
export function useConcluirPendencia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, concluida }: { id: string; concluida: boolean; documentoId: string }) =>
      api(`/pendencias/${id}`, { method: "PATCH", json: { concluida } }),
    onSuccess: (_r, { concluida, documentoId }) => {
      toast.success(concluida ? "Pendência concluída." : "Pendência reaberta.");
      void queryClient.invalidateQueries({ queryKey: chaves.pendencias });
      void queryClient.invalidateQueries({ queryKey: chaves.painel });
      void queryClient.invalidateQueries({ queryKey: chaves.documento(documentoId) });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Não foi possível atualizar a pendência."),
  });
}
