import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Botao } from "../components/ui/Botao";
import { CabecalhoPagina, Carregando, EstadoVazio, MensagemErro } from "../components/ui/Basicos";
import { Modal } from "../components/ui/Modal";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { chaves } from "../lib/consultas";
import { formatarDataHora } from "../lib/format";

interface ItemLixeira {
  id: string;
  titulo: string;
  nome_arquivo: string;
  excluido_em: string;
  tipos_documento: { nome: string } | null;
  categorias: { nome: string } | null;
}

export default function LixeiraPage() {
  const { ehAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [apagar, setApagar] = useState<ItemLixeira | null>(null);

  const lixeira = useQuery({ queryKey: ["lixeira"], queryFn: () => api<{ itens: ItemLixeira[] }>("/documentos/lixeira").then((r) => r.itens) });

  const recarregar = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["lixeira"] }),
      queryClient.invalidateQueries({ queryKey: chaves.documentos }),
      queryClient.invalidateQueries({ queryKey: chaves.painel }),
      queryClient.invalidateQueries({ queryKey: chaves.categorias }),
    ]);

  const restaurar = useMutation({
    mutationFn: (id: string) => api(`/documentos/${id}/restaurar`, { method: "POST" }),
    onSuccess: async () => {
      toast.success("Documento restaurado.");
      await recarregar();
    },
    onError: (err) => toast.error(err.message),
  });

  const excluirDefinitivo = useMutation({
    mutationFn: (id: string) => api(`/documentos/${id}/definitivo`, { method: "DELETE" }),
    onSuccess: async () => {
      toast.success("Documento e arquivos excluídos definitivamente.");
      setApagar(null);
      await recarregar();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div>
      <CabecalhoPagina titulo="Lixeira" descricao="Documentos excluídos das categorias que você gerencia. Restaure ou, se for administrador, apague de vez." />
      <div className="cartao overflow-hidden">
        {lixeira.isLoading && <Carregando />}
        {lixeira.error && (
          <div className="p-4">
            <MensagemErro erro={lixeira.error} />
          </div>
        )}
        {lixeira.data?.length === 0 && <EstadoVazio icone={Trash2} titulo="A lixeira está vazia" />}
        {lixeira.data && lixeira.data.length > 0 && (
          <ul className="divide-y divide-line-soft">
            {lixeira.data.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{item.titulo}</span>
                  <span className="block truncate text-xs text-ink-muted">
                    {item.tipos_documento?.nome} · {item.categorias?.nome} · excluído em {formatarDataHora(item.excluido_em)}
                  </span>
                </span>
                <Botao variante="secundario" tamanho="sm" icone={RotateCcw} carregando={restaurar.isPending && restaurar.variables === item.id} onClick={() => restaurar.mutate(item.id)}>
                  Restaurar
                </Botao>
                {ehAdmin && (
                  <Botao variante="fantasma" tamanho="sm" icone={Trash2} onClick={() => setApagar(item)}>
                    Apagar de vez
                  </Botao>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        aberto={apagar !== null}
        aoFechar={() => setApagar(null)}
        titulo="Excluir definitivamente?"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setApagar(null)}>
              Cancelar
            </Botao>
            <Botao variante="perigo" carregando={excluirDefinitivo.isPending} onClick={() => apagar && excluirDefinitivo.mutate(apagar.id)}>
              Excluir para sempre
            </Botao>
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          O documento <strong className="text-ink">{apagar?.titulo}</strong>, todas as versões do arquivo e o texto indexado serão apagados do banco e do
          armazenamento. Esta ação não pode ser desfeita (o registro da exclusão permanece no histórico).
        </p>
      </Modal>
    </div>
  );
}
