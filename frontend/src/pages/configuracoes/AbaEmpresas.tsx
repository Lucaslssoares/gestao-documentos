import { useQueryClient } from "@tanstack/react-query";
import { Building2, Pencil, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { NovaEmpresaModal } from "../../components/documentos/NovaEmpresaModal";
import { Botao, BotaoIcone } from "../../components/ui/Botao";
import { Campo, Carregando, MensagemErro, Selo } from "../../components/ui/Basicos";
import { Modal } from "../../components/ui/Modal";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../lib/api";
import { chaves, useEmpresas } from "../../lib/consultas";
import { formatarCnpj, ROTULO_TIPO_EMPRESA } from "../../lib/textos";
import type { Empresa, TipoEmpresa } from "../../lib/tipos";

export function AbaEmpresas() {
  const { ehAdmin } = useAuth();
  const queryClient = useQueryClient();
  const empresas = useEmpresas();
  const [busca, setBusca] = useState("");
  const [nova, setNova] = useState(false);
  const [edicao, setEdicao] = useState<Empresa | null>(null);
  const [novaFilial, setNovaFilial] = useState({ nome: "", cidade: "", uf: "" });
  const [salvando, setSalvando] = useState(false);

  const filtradas = (empresas.data ?? []).filter((e) =>
    `${e.razao_social} ${e.nome_fantasia ?? ""} ${e.cnpj ?? ""}`.toLowerCase().includes(busca.toLowerCase()),
  );

  async function salvarEdicao(e: FormEvent) {
    e.preventDefault();
    if (!edicao) return;
    setSalvando(true);
    try {
      await api(`/empresas/${edicao.id}`, {
        method: "PATCH",
        json: {
          razao_social: edicao.razao_social,
          nome_fantasia: edicao.nome_fantasia ?? "",
          cnpj: edicao.cnpj ?? "",
          tipo: edicao.tipo,
          email: edicao.email ?? "",
          telefone: edicao.telefone ?? "",
          ativo: edicao.ativo,
        },
      });
      toast.success("Empresa atualizada.");
      setEdicao(null);
      await queryClient.invalidateQueries({ queryKey: chaves.empresas });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function adicionarFilial() {
    if (!edicao || !novaFilial.nome.trim()) return;
    try {
      const filial = await api<Empresa["filiais"][number]>(`/empresas/${edicao.id}/filiais`, { method: "POST", json: novaFilial });
      setEdicao({ ...edicao, filiais: [...edicao.filiais, filial] });
      setNovaFilial({ nome: "", cidade: "", uf: "" });
      await queryClient.invalidateQueries({ queryKey: chaves.empresas });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao adicionar filial.");
    }
  }

  return (
    <div className="cartao">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-4 py-3">
        <input type="search" placeholder="Buscar empresa ou CNPJ..." aria-label="Buscar empresa" className="campo h-9 max-w-xs py-1" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <Botao icone={Plus} tamanho="sm" onClick={() => setNova(true)}>
          Nova empresa
        </Botao>
      </div>
      {empresas.isLoading && <Carregando />}
      {empresas.error && <MensagemErro erro={empresas.error} />}
      <ul className="divide-y divide-line-soft">
        {filtradas.map((e) => (
          <li key={e.id} className="flex items-center gap-3 px-4 py-3">
            <Building2 className="size-5 shrink-0 text-primary-dark" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{e.nome_fantasia ?? e.razao_social}</span>
                <Selo>{ROTULO_TIPO_EMPRESA[e.tipo]}</Selo>
                {!e.ativo && <Selo>inativa</Selo>}
              </span>
              <span className="block truncate text-xs text-ink-muted">
                {e.razao_social}
                {e.cnpj && ` · ${formatarCnpj(e.cnpj)}`}
                {e.filiais.length > 0 && ` · ${e.filiais.length} filial(is)`}
              </span>
            </span>
            <BotaoIcone icone={Pencil} rotulo={`Editar ${e.razao_social}`} onClick={() => setEdicao(e)} />
          </li>
        ))}
      </ul>

      <NovaEmpresaModal aberto={nova} aoFechar={() => setNova(false)} />

      <Modal
        aberto={edicao !== null}
        aoFechar={() => setEdicao(null)}
        titulo="Editar empresa"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setEdicao(null)}>
              Cancelar
            </Botao>
            <Botao type="submit" form="form-empresa" carregando={salvando}>
              Salvar
            </Botao>
          </>
        }
      >
        {edicao && (
          <form id="form-empresa" onSubmit={salvarEdicao} className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Razão social" htmlFor="ed-razao" obrigatorio className="sm:col-span-2">
              <input id="ed-razao" required className="campo" value={edicao.razao_social} onChange={(e) => setEdicao({ ...edicao, razao_social: e.target.value })} />
            </Campo>
            <Campo rotulo="Nome fantasia" htmlFor="ed-fantasia">
              <input id="ed-fantasia" className="campo" value={edicao.nome_fantasia ?? ""} onChange={(e) => setEdicao({ ...edicao, nome_fantasia: e.target.value })} />
            </Campo>
            <Campo rotulo="CNPJ" htmlFor="ed-cnpj">
              <input id="ed-cnpj" className="campo" value={edicao.cnpj ?? ""} onChange={(e) => setEdicao({ ...edicao, cnpj: e.target.value })} />
            </Campo>
            <Campo rotulo="Tipo" htmlFor="ed-tipo">
              <select id="ed-tipo" className="campo" value={edicao.tipo} onChange={(e) => setEdicao({ ...edicao, tipo: e.target.value as TipoEmpresa })}>
                {Object.entries(ROTULO_TIPO_EMPRESA).map(([valor, rotulo]) => (
                  <option key={valor} value={valor}>
                    {rotulo}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="E-mail" htmlFor="ed-email">
              <input id="ed-email" type="email" className="campo" value={edicao.email ?? ""} onChange={(e) => setEdicao({ ...edicao, email: e.target.value })} />
            </Campo>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" className="size-4 accent-primary-dark" checked={edicao.ativo} onChange={(e) => setEdicao({ ...edicao, ativo: e.target.checked })} />
              Empresa ativa
            </label>

            {edicao.tipo === "grupo" && (
              <div className="sm:col-span-2">
                <span className="rotulo">Filiais</span>
                <ul className="mb-2 grid gap-1 text-sm">
                  {edicao.filiais.map((f) => (
                    <li key={f.id} className="rounded-lg bg-surface/70 px-3 py-1.5">
                      {f.nome}
                      {f.cidade && ` — ${f.cidade}`}
                      {f.uf && `/${f.uf}`}
                    </li>
                  ))}
                  {edicao.filiais.length === 0 && <li className="text-ink-muted">Nenhuma filial cadastrada.</li>}
                </ul>
                {ehAdmin && (
                  <div className="flex flex-wrap gap-2">
                    <input aria-label="Nome da filial" placeholder="Nome da filial" className="campo h-9 flex-1 py-1" value={novaFilial.nome} onChange={(e) => setNovaFilial({ ...novaFilial, nome: e.target.value })} />
                    <input aria-label="Cidade" placeholder="Cidade" className="campo h-9 w-32 py-1" value={novaFilial.cidade} onChange={(e) => setNovaFilial({ ...novaFilial, cidade: e.target.value })} />
                    <input aria-label="UF" placeholder="UF" maxLength={2} className="campo h-9 w-16 py-1 uppercase" value={novaFilial.uf} onChange={(e) => setNovaFilial({ ...novaFilial, uf: e.target.value })} />
                    <Botao variante="secundario" tamanho="sm" icone={Plus} onClick={adicionarFilial} className="h-9">
                      Filial
                    </Botao>
                  </div>
                )}
              </div>
            )}
          </form>
        )}
      </Modal>
    </div>
  );
}
