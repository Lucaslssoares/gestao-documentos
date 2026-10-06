import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Botao, BotaoIcone } from "../../components/ui/Botao";
import { Carregando, MensagemErro, Selo } from "../../components/ui/Basicos";
import { api } from "../../lib/api";
import { chaves, useTags } from "../../lib/consultas";
import type { Setor } from "../../lib/tipos";

/** Lista simples com inclusão e renomeação em linha. */
function ListaEditavel<T extends { id: string; nome: string }>({
  itens,
  carregando,
  erro,
  rotuloNovo,
  aoCriar,
  aoRenomear,
  aoExcluir,
  extra,
}: {
  itens: T[] | undefined;
  carregando: boolean;
  erro: unknown;
  rotuloNovo: string;
  aoCriar: (nome: string) => Promise<void>;
  aoRenomear: (item: T, nome: string) => Promise<void>;
  aoExcluir?: (item: T) => Promise<void>;
  extra?: (item: T) => ReactNode;
}) {
  const [novo, setNovo] = useState("");
  const [editando, setEditando] = useState<{ id: string; nome: string } | null>(null);

  const executar = async (acao: () => Promise<void>) => {
    try {
      await acao();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha na operação.");
    }
  };

  return (
    <div className="cartao">
      <form
        className="flex gap-2 border-b border-line-soft px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (novo.trim()) void executar(async () => {
            await aoCriar(novo.trim());
            setNovo("");
          });
        }}
      >
        <input aria-label={rotuloNovo} placeholder={rotuloNovo} className="campo h-9 py-1" value={novo} onChange={(e) => setNovo(e.target.value)} />
        <Botao type="submit" tamanho="sm" icone={Plus} className="h-9">
          Adicionar
        </Botao>
      </form>
      {carregando && <Carregando />}
      {erro !== null && erro !== undefined && <MensagemErro erro={erro} />}
      <ul className="divide-y divide-line-soft">
        {itens?.map((item) => (
          <li key={item.id} className="flex items-center gap-2 px-4 py-2">
            {editando?.id === item.id ? (
              <>
                <input
                  aria-label="Novo nome"
                  className="campo h-9 flex-1 py-1"
                  value={editando.nome}
                  autoFocus
                  onChange={(e) => setEditando({ id: item.id, nome: e.target.value })}
                />
                <BotaoIcone
                  icone={Check}
                  rotulo="Salvar"
                  onClick={() =>
                    executar(async () => {
                      await aoRenomear(item, editando.nome.trim());
                      setEditando(null);
                    })
                  }
                />
                <BotaoIcone icone={X} rotulo="Cancelar" onClick={() => setEditando(null)} />
              </>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate">{item.nome}</span>
                {extra?.(item)}
                <BotaoIcone icone={Pencil} rotulo={`Renomear ${item.nome}`} onClick={() => setEditando({ id: item.id, nome: item.nome })} />
                {aoExcluir && <BotaoIcone icone={Trash2} rotulo={`Excluir ${item.nome}`} onClick={() => window.confirm(`Excluir "${item.nome}"?`) && executar(() => aoExcluir(item))} />}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AbaSetores() {
  const queryClient = useQueryClient();
  const setores = useQuery({ queryKey: [...chaves.setores, "todos"], queryFn: () => api<Setor[]>("/setores?inativos=1") });
  const recarregar = () => queryClient.invalidateQueries({ queryKey: chaves.setores });

  return (
    <ListaEditavel<Setor>
      itens={setores.data}
      carregando={setores.isLoading}
      erro={setores.error}
      rotuloNovo="Novo setor (ex.: Controladoria)"
      aoCriar={async (nome) => {
        await api("/setores", { method: "POST", json: { nome } });
        await recarregar();
      }}
      aoRenomear={async (setor, nome) => {
        await api(`/setores/${setor.id}`, { method: "PATCH", json: { nome } });
        await recarregar();
      }}
      extra={(setor) => (
        <button
          type="button"
          className="text-xs font-medium text-primary-dark hover:underline"
          onClick={async () => {
            await api(`/setores/${setor.id}`, { method: "PATCH", json: { ativo: !setor.ativo } });
            await recarregar();
          }}
        >
          {setor.ativo ? <Selo className="bg-success-soft text-success">ativo</Selo> : <Selo>inativo</Selo>}
        </button>
      )}
    />
  );
}

export function AbaTags() {
  const queryClient = useQueryClient();
  const tags = useTags();
  const recarregar = () => queryClient.invalidateQueries({ queryKey: chaves.tags });

  return (
    <ListaEditavel
      itens={tags.data}
      carregando={tags.isLoading}
      erro={tags.error}
      rotuloNovo="Nova tag (ex.: Renovação)"
      aoCriar={async (nome) => {
        await api("/tags", { method: "POST", json: { nome } });
        await recarregar();
      }}
      aoRenomear={async (tag, nome) => {
        await api(`/tags/${tag.id}`, { method: "PATCH", json: { nome } });
        await recarregar();
      }}
      aoExcluir={async (tag) => {
        await api(`/tags/${tag.id}`, { method: "DELETE" });
        await recarregar();
      }}
    />
  );
}
