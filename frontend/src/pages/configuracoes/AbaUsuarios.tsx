import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { IconeCategoria } from "../../components/documentos/Indicadores";
import { Botao, BotaoIcone } from "../../components/ui/Botao";
import { Campo, Carregando, MensagemErro, Selo } from "../../components/ui/Basicos";
import { Modal } from "../../components/ui/Modal";
import { api } from "../../lib/api";
import { chaves, useCategorias, useSetores } from "../../lib/consultas";
import { DESCRICAO_PAPEL, ROTULO_PAPEL } from "../../lib/format";
import type { Papel, UsuarioAdmin } from "../../lib/tipos";

interface Edicao {
  id?: string;
  nome: string;
  email: string;
  papel: Papel;
  setor_id: string;
  categorias: string[];
  ativo: boolean;
}

export function AbaUsuarios() {
  const queryClient = useQueryClient();
  const usuarios = useQuery({ queryKey: ["usuarios"], queryFn: () => api<{ itens: UsuarioAdmin[] }>("/usuarios").then((r) => r.itens) });
  const categorias = useCategorias();
  const setores = useSetores();
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [salvando, setSalvando] = useState(false);

  const raizes = categorias.data ?? [];
  const nomeCategoria = (id: string) => raizes.find((c) => c.id === id)?.nome ?? "—";

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!edicao) return;
    setSalvando(true);
    try {
      const corpo = { nome: edicao.nome, papel: edicao.papel, setor_id: edicao.setor_id, categorias: edicao.categorias };
      if (edicao.id) {
        await api(`/usuarios/${edicao.id}`, { method: "PATCH", json: { ...corpo, ativo: edicao.ativo } });
        toast.success("Usuário atualizado.");
      } else {
        await api("/usuarios/convite", { method: "POST", json: { ...corpo, email: edicao.email } });
        toast.success(`Convite enviado para ${edicao.email}.`);
      }
      setEdicao(null);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["usuarios"] }), queryClient.invalidateQueries({ queryKey: chaves.equipe })]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="cartao">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-4 py-3">
        <p className="text-sm text-ink-muted">O usuário recebe um e-mail para definir a senha. O acesso vale para as categorias marcadas.</p>
        <Botao
          icone={UserPlus}
          tamanho="sm"
          onClick={() => setEdicao({ nome: "", email: "", papel: "leitor", setor_id: "", categorias: [], ativo: true })}
        >
          Convidar usuário
        </Botao>
      </div>
      {usuarios.isLoading && <Carregando />}
      {usuarios.error && <MensagemErro erro={usuarios.error} />}
      <ul className="divide-y divide-line-soft">
        {usuarios.data?.map((u) => (
          <li key={u.id} className="flex items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{u.nome}</span>
                <Selo className="bg-warning-soft text-primary-dark">{ROTULO_PAPEL[u.papel]}</Selo>
                {!u.ativo && <Selo>inativo</Selo>}
              </span>
              <span className="block truncate text-xs text-ink-muted">
                {u.email} · {u.papel === "admin" ? "todas as categorias" : u.categorias.map(nomeCategoria).join(", ") || "sem categorias"}
              </span>
            </span>
            <BotaoIcone
              icone={Pencil}
              rotulo={`Editar ${u.nome}`}
              onClick={() => setEdicao({ id: u.id, nome: u.nome, email: u.email, papel: u.papel, setor_id: u.setor_id ?? "", categorias: u.categorias, ativo: u.ativo })}
            />
          </li>
        ))}
      </ul>

      <Modal
        aberto={edicao !== null}
        aoFechar={() => setEdicao(null)}
        titulo={edicao?.id ? "Editar acesso" : "Convidar usuário"}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setEdicao(null)}>
              Cancelar
            </Botao>
            <Botao type="submit" form="form-usuario" carregando={salvando}>
              {edicao?.id ? "Salvar" : "Enviar convite"}
            </Botao>
          </>
        }
      >
        {edicao && (
          <form id="form-usuario" onSubmit={salvar} className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Nome" htmlFor="usr-nome" obrigatorio>
              <input id="usr-nome" required className="campo" value={edicao.nome} onChange={(e) => setEdicao({ ...edicao, nome: e.target.value })} />
            </Campo>
            <Campo rotulo="E-mail" htmlFor="usr-email" obrigatorio>
              <input
                id="usr-email"
                type="email"
                required
                disabled={Boolean(edicao.id)}
                className="campo"
                value={edicao.email}
                onChange={(e) => setEdicao({ ...edicao, email: e.target.value })}
              />
            </Campo>
            <Campo rotulo="Perfil" htmlFor="usr-papel" ajuda={DESCRICAO_PAPEL[edicao.papel]}>
              <select id="usr-papel" className="campo" value={edicao.papel} onChange={(e) => setEdicao({ ...edicao, papel: e.target.value as Papel })}>
                {Object.entries(ROTULO_PAPEL).map(([valor, rotulo]) => (
                  <option key={valor} value={valor}>
                    {rotulo}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Setor" htmlFor="usr-setor">
              <select id="usr-setor" className="campo" value={edicao.setor_id} onChange={(e) => setEdicao({ ...edicao, setor_id: e.target.value })}>
                <option value="">—</option>
                {setores.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </Campo>
            <fieldset className="sm:col-span-2" disabled={edicao.papel === "admin"}>
              <legend className="rotulo">{edicao.papel === "admin" ? "Administradores acessam todas as categorias" : "Categorias liberadas"}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {raizes.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 rounded-lg border border-line-soft px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary-dark"
                      checked={edicao.papel === "admin" || edicao.categorias.includes(c.id)}
                      onChange={(e) =>
                        setEdicao({ ...edicao, categorias: e.target.checked ? [...edicao.categorias, c.id] : edicao.categorias.filter((id) => id !== c.id) })
                      }
                    />
                    <IconeCategoria icone={c.icone} cor={c.cor} className="size-4" />
                    {c.nome}
                  </label>
                ))}
              </div>
            </fieldset>
            {edicao.id && (
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" className="size-4 accent-primary-dark" checked={edicao.ativo} onChange={(e) => setEdicao({ ...edicao, ativo: e.target.checked })} />
                Usuário ativo (desativado não consegue entrar)
              </label>
            )}
          </form>
        )}
      </Modal>
    </div>
  );
}
