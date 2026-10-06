import { useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { FolderPlus, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { IconeCategoria } from "../../components/documentos/Indicadores";
import { ICONES_CATEGORIA } from "../../lib/icones";
import { Botao, BotaoIcone } from "../../components/ui/Botao";
import { Campo, Carregando, MensagemErro } from "../../components/ui/Basicos";
import { Modal } from "../../components/ui/Modal";
import { api } from "../../lib/api";
import { chaves } from "../../lib/consultas";
import type { Categoria } from "../../lib/tipos";

const CORES = ["#8C491A", "#C67139", "#3D472B", "#645C50", "#201E1D"];

interface Edicao {
  id?: string;
  parent_id: string | null;
  nivel: number;
  nome: string;
  descricao: string;
  icone: string;
  cor: string;
  ativo: boolean;
}

interface AcoesCategoria {
  aoNova: (pai: Categoria) => void;
  aoEditar: (c: Categoria) => void;
  aoExcluir: (c: Categoria) => void;
}

function LinhaCategoria({ c, acoes }: { c: Categoria; acoes: AcoesCategoria }) {
  return (
    <>
      <li className={clsx("flex items-center gap-2 py-2 pr-2", !c.ativo && "opacity-60")} style={{ paddingLeft: `${(c.nivel - 1) * 24 + 12}px` }}>
        {c.nivel === 1 ? <IconeCategoria icone={c.icone} cor={c.cor} /> : <span className="text-ink-muted">›</span>}
        <span className="min-w-0 flex-1">
          <span className="font-medium">{c.nome}</span>
          {!c.ativo && <span className="ml-2 text-xs text-ink-muted">(desativada)</span>}
          <span className="ml-2 text-xs text-ink-muted">{c.total} doc.</span>
        </span>
        {c.nivel < 3 && <BotaoIcone icone={Plus} rotulo={`Nova subcategoria em ${c.nome}`} onClick={() => acoes.aoNova(c)} />}
        <BotaoIcone icone={Pencil} rotulo={`Editar ${c.nome}`} onClick={() => acoes.aoEditar(c)} />
        {c.total === 0 && c.filhos.length === 0 && <BotaoIcone icone={Trash2} rotulo={`Excluir ${c.nome}`} onClick={() => acoes.aoExcluir(c)} />}
      </li>
      {c.filhos.map((f) => (
        <LinhaCategoria key={f.id} c={f} acoes={acoes} />
      ))}
    </>
  );
}

export function AbaCategorias() {
  const queryClient = useQueryClient();
  const categorias = useQuery({ queryKey: [...chaves.categorias, "todas"], queryFn: () => api<Categoria[]>("/categorias?inativas=1") });
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [salvando, setSalvando] = useState(false);

  const recarregar = () => queryClient.invalidateQueries({ queryKey: chaves.categorias });

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!edicao) return;
    setSalvando(true);
    try {
      const corpo = {
        nome: edicao.nome,
        descricao: edicao.descricao,
        ativo: edicao.ativo,
        ...(edicao.nivel === 1 ? { icone: edicao.icone || null, cor: edicao.cor || null } : {}),
        ...(edicao.id ? {} : { parent_id: edicao.parent_id }),
      };
      if (edicao.id) await api(`/categorias/${edicao.id}`, { method: "PATCH", json: corpo });
      else await api("/categorias", { method: "POST", json: corpo });
      toast.success("Categoria salva.");
      setEdicao(null);
      await recarregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(c: Categoria) {
    if (!window.confirm(`Excluir a categoria "${c.nome}"?`)) return;
    try {
      await api(`/categorias/${c.id}`, { method: "DELETE" });
      toast.success("Categoria excluída.");
      await recarregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao excluir.");
    }
  }

  const nova = (pai: Categoria | null): Edicao => ({
    parent_id: pai?.id ?? null,
    nivel: pai ? pai.nivel + 1 : 1,
    nome: "",
    descricao: "",
    icone: "folder",
    cor: CORES[0]!,
    ativo: true,
  });

  const acoes: AcoesCategoria = {
    aoNova: (pai) => setEdicao(nova(pai)),
    aoEditar: (c) =>
      setEdicao({ id: c.id, parent_id: c.parent_id, nivel: c.nivel, nome: c.nome, descricao: c.descricao ?? "", icone: c.icone ?? "", cor: c.cor ?? "", ativo: c.ativo }),
    aoExcluir: excluir,
  };

  return (
    <div className="cartao">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-4 py-3">
        <p className="text-sm text-ink-muted">Até 3 níveis. O acesso dos usuários é concedido pelas categorias raiz.</p>
        <Botao icone={FolderPlus} tamanho="sm" onClick={() => setEdicao(nova(null))}>
          Nova categoria raiz
        </Botao>
      </div>
      {categorias.isLoading && <Carregando />}
      {categorias.error && <MensagemErro erro={categorias.error} />}
      <ul className="divide-y divide-line-soft">
        {categorias.data?.map((c) => (
          <LinhaCategoria key={c.id} c={c} acoes={acoes} />
        ))}
      </ul>

      <Modal
        aberto={edicao !== null}
        aoFechar={() => setEdicao(null)}
        titulo={edicao?.id ? "Editar categoria" : edicao?.parent_id ? "Nova subcategoria" : "Nova categoria raiz"}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setEdicao(null)}>
              Cancelar
            </Botao>
            <Botao type="submit" form="form-categoria" carregando={salvando}>
              Salvar
            </Botao>
          </>
        }
      >
        {edicao && (
          <form id="form-categoria" onSubmit={salvar} className="grid gap-4">
            <Campo rotulo="Nome" htmlFor="cat-nome" obrigatorio>
              <input id="cat-nome" required maxLength={80} className="campo" value={edicao.nome} onChange={(e) => setEdicao({ ...edicao, nome: e.target.value })} />
            </Campo>
            <Campo rotulo="Descrição" htmlFor="cat-desc">
              <input id="cat-desc" className="campo" value={edicao.descricao} onChange={(e) => setEdicao({ ...edicao, descricao: e.target.value })} />
            </Campo>
            {edicao.nivel === 1 && (
              <>
                <div>
                  <span className="rotulo">Ícone</span>
                  <div className="flex flex-wrap gap-2">
                    {Object.keys(ICONES_CATEGORIA).map((nome) => (
                      <button
                        key={nome}
                        type="button"
                        aria-pressed={edicao.icone === nome}
                        aria-label={nome}
                        onClick={() => setEdicao({ ...edicao, icone: nome })}
                        className={clsx("rounded-lg border p-2", edicao.icone === nome ? "border-primary bg-warning-soft" : "border-line-soft")}
                      >
                        <IconeCategoria icone={nome} cor={edicao.cor} />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="rotulo">Cor</span>
                  <div className="flex gap-2">
                    {CORES.map((cor) => (
                      <button
                        key={cor}
                        type="button"
                        aria-label={`Cor ${cor}`}
                        aria-pressed={edicao.cor === cor}
                        onClick={() => setEdicao({ ...edicao, cor })}
                        className={clsx("size-8 rounded-full ring-offset-2", edicao.cor === cor && "ring-2 ring-primary")}
                        style={{ backgroundColor: cor }}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={edicao.ativo} onChange={(e) => setEdicao({ ...edicao, ativo: e.target.checked })} className="size-4 accent-primary-dark" />
              Categoria ativa (desativadas não aparecem para novos cadastros)
            </label>
          </form>
        )}
      </Modal>
    </div>
  );
}
