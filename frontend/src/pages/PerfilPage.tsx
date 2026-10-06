import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { IconeCategoria } from "../components/documentos/Indicadores";
import { Botao } from "../components/ui/Botao";
import { CabecalhoPagina, Campo } from "../components/ui/Basicos";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { useCategorias } from "../lib/consultas";
import { DESCRICAO_PAPEL, ROTULO_PAPEL } from "../lib/format";
import { supabase } from "../lib/supabase";

export default function PerfilPage() {
  const { perfil, sair } = useAuth();
  const categorias = useCategorias();
  const queryClient = useQueryClient();
  const [nome, setNome] = useState(perfil?.nome ?? "");
  const [senha, setSenha] = useState("");
  const [salvando, setSalvando] = useState(false);

  if (!perfil) return null;

  async function salvarNome(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await api("/me", { method: "PATCH", json: { nome } });
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success("Nome atualizado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function trocarSenha(e: FormEvent) {
    e.preventDefault();
    if (senha.length < 8) return toast.error("A senha precisa ter pelo menos 8 caracteres.");
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) return toast.error(error.message);
    setSenha("");
    toast.success("Senha alterada.");
  }

  const raizes = categorias.data ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <CabecalhoPagina
        titulo="Meu perfil"
        descricao={perfil.email}
        acoes={
          <Botao variante="secundario" icone={LogOut} onClick={sair}>
            Sair
          </Botao>
        }
      />

      <section className="cartao p-5">
        <h2 className="font-semibold">Perfil de acesso: {ROTULO_PAPEL[perfil.papel]}</h2>
        <p className="mt-1 text-sm text-ink-muted">{DESCRICAO_PAPEL[perfil.papel]}.</p>
        <p className="mt-4 mb-2 text-sm font-medium">{perfil.papel === "admin" ? "Acesso a todas as categorias:" : "Categorias liberadas:"}</p>
        <div className="flex flex-wrap gap-2">
          {raizes.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-paper px-3 py-1 text-sm">
              <IconeCategoria icone={c.icone} cor={c.cor} className="size-4" />
              {c.nome}
            </span>
          ))}
          {raizes.length === 0 && <span className="text-sm text-ink-muted">Nenhuma — peça acesso ao administrador.</span>}
        </div>
      </section>

      <form onSubmit={salvarNome} className="cartao flex flex-wrap items-end gap-3 p-5">
        <Campo rotulo="Nome" htmlFor="nome" className="min-w-56 flex-1">
          <input id="nome" className="campo" value={nome} minLength={2} maxLength={120} onChange={(e) => setNome(e.target.value)} />
        </Campo>
        <Botao type="submit" carregando={salvando}>
          Salvar
        </Botao>
      </form>

      <form onSubmit={trocarSenha} className="cartao flex flex-wrap items-end gap-3 p-5">
        <Campo rotulo="Nova senha" htmlFor="nova-senha" ajuda="Mínimo de 8 caracteres." className="min-w-56 flex-1">
          <input id="nova-senha" type="password" autoComplete="new-password" className="campo" value={senha} onChange={(e) => setSenha(e.target.value)} />
        </Campo>
        <Botao type="submit" variante="secundario">
          Alterar senha
        </Botao>
      </form>
    </div>
  );
}
