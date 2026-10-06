import { FileSearch, History, ShieldCheck, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { Botao } from "../components/ui/Botao";
import { Campo, MensagemErro } from "../components/ui/Basicos";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

const DESTAQUES = [
  { icone: FileSearch, titulo: "Encontre em segundos", texto: "Pesquisa por nome, tipo, categoria, empresa, tags e até pelo conteúdo do arquivo." },
  { icone: ShieldCheck, titulo: "Acesso por categoria", texto: "Cada área vê apenas os documentos que lhe dizem respeito." },
  { icone: History, titulo: "Histórico completo", texto: "Quem enviou, alterou, moveu, visualizou ou excluiu — e quando." },
  { icone: Sparkles, titulo: "Assistente com IA", texto: "Pergunte e receba respostas com as fontes dos documentos." },
];

export function LoginPage() {
  const { sessao, entrar } = useAuth();
  const navigate = useNavigate();
  const local = useLocation();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<unknown>(null);
  const [enviando, setEnviando] = useState(false);

  const destino = (local.state as { de?: string } | null)?.de ?? "/";
  if (sessao) return <Navigate to={destino} replace />;

  async function aoEnviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await entrar(email.trim(), senha);
      navigate(destino, { replace: true });
    } catch (err) {
      setErro(err);
    } finally {
      setEnviando(false);
    }
  }

  async function esqueciSenha() {
    if (!email.trim()) {
      setErro(new Error("Informe seu e-mail para receber o link de redefinição."));
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/definir-senha`,
    });
    if (error) setErro(error);
    else toast.success("Se o e-mail estiver cadastrado, você receberá o link para criar uma nova senha.");
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-linear-to-br from-sidebar via-primary-deeper to-primary-dark p-12 text-surface lg:flex">
        <div className="textura-pontos absolute inset-0" aria-hidden />
        <div className="absolute -right-24 -bottom-24 size-96 rounded-full bg-primary/30 blur-3xl" aria-hidden />
        <div className="relative flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="size-11" />
          <span className="text-xl font-bold">
            Gestão de <span className="text-primary">Documentos</span>
          </span>
        </div>
        <div className="relative">
          <h1 className="max-w-md text-4xl leading-tight font-bold">
            Organização, controle e agilidade para os <span className="text-[#f2b48a]">documentos</span> da empresa.
          </h1>
          <ul className="mt-10 grid max-w-lg gap-5">
            {DESTAQUES.map(({ icone: Icone, titulo, texto }) => (
              <li key={titulo} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
                  <Icone className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block font-semibold">{titulo}</span>
                  <span className="block text-sm text-surface/75">{texto}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-surface/60">Contratos, notas fiscais, documentos fiscais, RH, jurídico e muito mais — em um só lugar.</p>
      </section>

      <section className="flex items-center justify-center px-5 py-10">
        <form onSubmit={aoEnviar} className="w-full max-w-sm rounded-[1.5rem] border border-line-soft bg-paper p-6 shadow-[var(--shadow-elevated)] sm:p-8">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <img src="/favicon.svg" alt="" className="size-10" />
            <span className="text-lg font-bold">
              Gestão de <span className="text-primary">Documentos</span>
            </span>
          </div>
          <h2 className="text-3xl font-bold">Bem-vindo</h2>
          <p className="mt-1 mb-6 text-sm text-ink-muted">Entre com o e-mail e a senha do seu convite.</p>

          <div className="grid gap-4">
            <Campo rotulo="E-mail" htmlFor="email">
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                className="campo"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Campo>
            <Campo rotulo="Senha" htmlFor="senha">
              <input
                id="senha"
                type="password"
                autoComplete="current-password"
                required
                className="campo"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
            </Campo>
            {erro !== null && <MensagemErro erro={erro} />}
            <Botao type="submit" carregando={enviando} className="h-11 w-full">
              Entrar
            </Botao>
            <button type="button" onClick={esqueciSenha} className="text-sm font-medium text-primary-dark hover:underline">
              Esqueci minha senha
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
