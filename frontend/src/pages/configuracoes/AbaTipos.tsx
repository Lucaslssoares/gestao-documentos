import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Botao, BotaoIcone } from "../../components/ui/Botao";
import { Campo, Carregando, MensagemErro, Selo } from "../../components/ui/Basicos";
import { Modal } from "../../components/ui/Modal";
import { api } from "../../lib/api";
import { achatarCategorias, chaves, useCategorias } from "../../lib/consultas";
import { gerarChaveCampo } from "../../lib/textos";
import type { CampoPersonalizado, TipoCampo, TipoDocumento } from "../../lib/tipos";

const TIPOS_CAMPO: Record<TipoCampo, string> = {
  texto: "Texto curto",
  texto_longo: "Texto longo",
  numero: "Número",
  moeda: "Valor (R$)",
  data: "Data",
  booleano: "Sim/Não",
  selecao: "Lista de opções",
};

interface Edicao {
  id?: string;
  nome: string;
  descricao: string;
  categoria_padrao_id: string;
  exige_validade: boolean;
  ativo: boolean;
  campos: (CampoPersonalizado & { opcoesTexto?: string })[];
}

export function AbaTipos() {
  const queryClient = useQueryClient();
  const tipos = useQuery({ queryKey: [...chaves.tipos, "todos"], queryFn: () => api<TipoDocumento[]>("/tipos-documento?inativos=1") });
  const categorias = useCategorias();
  const listaCategorias = useMemo(() => achatarCategorias(categorias.data ?? []), [categorias.data]);
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [salvando, setSalvando] = useState(false);

  function abrir(tipo?: TipoDocumento) {
    setEdicao(
      tipo
        ? {
            id: tipo.id,
            nome: tipo.nome,
            descricao: tipo.descricao ?? "",
            categoria_padrao_id: tipo.categoria_padrao_id ?? "",
            exige_validade: tipo.exige_validade,
            ativo: tipo.ativo,
            campos: tipo.campos.map((c) => ({ ...c, opcoesTexto: c.opcoes?.join(", ") })),
          }
        : { nome: "", descricao: "", categoria_padrao_id: "", exige_validade: false, ativo: true, campos: [] },
    );
  }

  function alterarCampo(i: number, mudanca: Partial<Edicao["campos"][number]>) {
    if (!edicao) return;
    setEdicao({ ...edicao, campos: edicao.campos.map((c, j) => (j === i ? { ...c, ...mudanca } : c)) });
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!edicao) return;
    setSalvando(true);
    try {
      const corpo = {
        nome: edicao.nome,
        descricao: edicao.descricao,
        categoria_padrao_id: edicao.categoria_padrao_id,
        exige_validade: edicao.exige_validade,
        ativo: edicao.ativo,
        campos: edicao.campos.map(({ opcoesTexto, ...c }) => ({
          ...c,
          chave: c.chave || gerarChaveCampo(c.rotulo),
          opcoes:
            c.tipo === "selecao"
              ? (opcoesTexto ?? "")
                  .split(",")
                  .map((o) => o.trim())
                  .filter(Boolean)
              : undefined,
        })),
      };
      if (edicao.id) await api(`/tipos-documento/${edicao.id}`, { method: "PATCH", json: corpo });
      else await api("/tipos-documento", { method: "POST", json: corpo });
      toast.success("Tipo de documento salvo.");
      setEdicao(null);
      await queryClient.invalidateQueries({ queryKey: chaves.tipos });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="cartao">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-4 py-3">
        <p className="text-sm text-ink-muted">Cada tipo define seus campos próprios — o formulário de cadastro se adapta automaticamente.</p>
        <Botao icone={Plus} tamanho="sm" onClick={() => abrir()}>
          Novo tipo
        </Botao>
      </div>
      {tipos.isLoading && <Carregando />}
      {tipos.error && <MensagemErro erro={tipos.error} />}
      <ul className="divide-y divide-line-soft">
        {tipos.data?.map((t) => (
          <li key={t.id} className="flex items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{t.nome}</span>
                {t.exige_validade && <Selo className="bg-warning-soft text-warning-ink">exige validade</Selo>}
                {!t.ativo && <Selo>desativado</Selo>}
              </span>
              <span className="block truncate text-xs text-ink-muted">
                {t.campos.length ? t.campos.map((c) => c.rotulo).join(" · ") : "Sem campos próprios"}
              </span>
            </span>
            <BotaoIcone icone={Pencil} rotulo={`Editar ${t.nome}`} onClick={() => abrir(t)} />
          </li>
        ))}
      </ul>

      <Modal
        aberto={edicao !== null}
        aoFechar={() => setEdicao(null)}
        titulo={edicao?.id ? "Editar tipo de documento" : "Novo tipo de documento"}
        largura="max-w-3xl"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setEdicao(null)}>
              Cancelar
            </Botao>
            <Botao type="submit" form="form-tipo" carregando={salvando}>
              Salvar
            </Botao>
          </>
        }
      >
        {edicao && (
          <form id="form-tipo" onSubmit={salvar} className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Nome" htmlFor="tipo-nome" obrigatorio>
              <input id="tipo-nome" required maxLength={80} className="campo" value={edicao.nome} onChange={(e) => setEdicao({ ...edicao, nome: e.target.value })} />
            </Campo>
            <Campo rotulo="Categoria sugerida" htmlFor="tipo-cat">
              <select id="tipo-cat" className="campo" value={edicao.categoria_padrao_id} onChange={(e) => setEdicao({ ...edicao, categoria_padrao_id: e.target.value })}>
                <option value="">—</option>
                {listaCategorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.caminho}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Descrição" htmlFor="tipo-desc" className="sm:col-span-2">
              <input id="tipo-desc" className="campo" value={edicao.descricao} onChange={(e) => setEdicao({ ...edicao, descricao: e.target.value })} />
            </Campo>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-primary-dark" checked={edicao.exige_validade} onChange={(e) => setEdicao({ ...edicao, exige_validade: e.target.checked })} />
              Exige data de validade
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-primary-dark" checked={edicao.ativo} onChange={(e) => setEdicao({ ...edicao, ativo: e.target.checked })} />
              Tipo ativo
            </label>

            <div className="sm:col-span-2">
              <div className="mb-2 flex items-center justify-between">
                <span className="rotulo mb-0">Campos personalizados</span>
                <Botao
                  variante="secundario"
                  tamanho="sm"
                  icone={Plus}
                  onClick={() => setEdicao({ ...edicao, campos: [...edicao.campos, { chave: "", rotulo: "", tipo: "texto", obrigatorio: false }] })}
                >
                  Adicionar campo
                </Botao>
              </div>
              {edicao.campos.length === 0 && <p className="text-sm text-ink-muted">Nenhum campo — o documento terá só os dados gerais.</p>}
              <ul className="grid gap-2">
                {edicao.campos.map((campo, i) => (
                  <li key={i} className="grid gap-2 rounded-xl border border-line-soft p-3 sm:grid-cols-[1fr_160px_auto_auto] sm:items-center">
                    <input
                      required
                      aria-label="Rótulo do campo"
                      placeholder="Rótulo (ex.: Valor total)"
                      className="campo"
                      value={campo.rotulo}
                      onChange={(e) => alterarCampo(i, { rotulo: e.target.value, ...(edicao.id && campo.chave ? {} : { chave: gerarChaveCampo(e.target.value) }) })}
                    />
                    <select aria-label="Tipo do campo" className="campo" value={campo.tipo} onChange={(e) => alterarCampo(i, { tipo: e.target.value as TipoCampo })}>
                      {Object.entries(TIPOS_CAMPO).map(([valor, rotulo]) => (
                        <option key={valor} value={valor}>
                          {rotulo}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1.5 text-sm">
                      <input type="checkbox" className="size-4 accent-primary-dark" checked={Boolean(campo.obrigatorio)} onChange={(e) => alterarCampo(i, { obrigatorio: e.target.checked })} />
                      Obrigatório
                    </label>
                    <BotaoIcone
                      icone={Trash2}
                      rotulo="Remover campo"
                      onClick={() => setEdicao({ ...edicao, campos: edicao.campos.filter((_, j) => j !== i) })}
                    />
                    {campo.tipo === "selecao" && (
                      <input
                        aria-label="Opções"
                        placeholder="Opções separadas por vírgula (ex.: PIX, Boleto, TED)"
                        className="campo sm:col-span-4"
                        value={campo.opcoesTexto ?? ""}
                        onChange={(e) => alterarCampo(i, { opcoesTexto: e.target.value })}
                      />
                    )}
                    {campo.chave && <span className="text-xs text-ink-muted sm:col-span-4">Chave: {campo.chave}</span>}
                  </li>
                ))}
              </ul>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
