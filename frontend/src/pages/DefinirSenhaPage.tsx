import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Botao } from "../components/ui/Botao";
import { Campo, Carregando, MensagemErro } from "../components/ui/Basicos";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

/** Destino dos links de convite e de "esqueci minha senha" (o Supabase já abre a sessão pelo link). */
export default function DefinirSenhaPage() {
  const { sessao, carregando } = useAuth();
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<unknown>(null);
  const [salvando, setSalvando] = useState(false);

  if (carregando) return <Carregando className="min-h-dvh" />;

  async function aoEnviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha.length < 8) return setErro(new Error("A senha precisa ter pelo menos 8 caracteres."));
    if (senha !== confirmacao) return setErro(new Error("As senhas não conferem."));
    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);
    if (error) return setErro(error);
    toast.success("Senha definida. Bem-vindo!");
    navigate("/", { replace: true });
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-5">
      <form onSubmit={aoEnviar} className="cartao w-full max-w-sm p-6 sm:p-8">
        <img src="/favicon.svg" alt="" className="mb-4 size-10" />
        <h1 className="text-2xl font-bold">Defina sua senha</h1>
        {!sessao ? (
          <div className="mt-4">
            <MensagemErro erro={new Error("Link inválido ou expirado. Peça um novo convite ou use “Esqueci minha senha” na tela de login.")} />
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            <Campo rotulo="Nova senha" htmlFor="senha" ajuda="Mínimo de 8 caracteres.">
              <input id="senha" type="password" autoComplete="new-password" className="campo" value={senha} onChange={(e) => setSenha(e.target.value)} />
            </Campo>
            <Campo rotulo="Confirme a senha" htmlFor="confirmacao">
              <input
                id="confirmacao"
                type="password"
                autoComplete="new-password"
                className="campo"
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
              />
            </Campo>
            {erro !== null && <MensagemErro erro={erro} />}
            <Botao type="submit" carregando={salvando}>
              Salvar senha
            </Botao>
          </div>
        )}
      </form>
    </div>
  );
}
