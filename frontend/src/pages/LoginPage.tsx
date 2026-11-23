import clsx from "clsx";
import { ArrowRight, BadgeCheck, CalendarClock, Eye, EyeOff, FileSearch, FileText, History, LockKeyhole, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { MensagemErro } from "../components/ui/Basicos";
import { Botao } from "../components/ui/Botao";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

const DESTAQUES = [
  { icone: FileSearch, titulo: "Encontre em segundos", texto: "Busca no nome, nos campos e no conteúdo do arquivo." },
  { icone: CalendarClock, titulo: "Nenhum prazo perdido", texto: "Pendências e avisos antes de cada vencimento." },
  { icone: ShieldCheck, titulo: "Acesso por área", texto: "Cada equipe vê só o que lhe diz respeito." },
  { icone: History, titulo: "Histórico completo", texto: "Quem enviou, alterou, aprovou ou baixou — e quando." },
];

const SUAVE = [0.23, 1, 0.32, 1] as const;

export function LoginPage() {
  const { sessao, entrar } = useAuth();
  const navigate = useNavigate();
  const local = useLocation();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
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
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Painel da marca: gradiente vivo + ilustração de documentos flutuando */}
      <section className="relative hidden overflow-hidden bg-linear-120 from-sidebar via-primary-deeper to-primary-dark bg-[length:220%_220%] p-12 text-white animate-gradiente lg:flex lg:flex-col lg:justify-between">
        <div className="textura-pontos absolute inset-0" aria-hidden />
        <motion.div
          className="absolute -top-32 -left-24 size-[28rem] rounded-full bg-primary/40 blur-3xl"
          animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden
        />
        <motion.div
          className="absolute -right-24 -bottom-32 size-[30rem] rounded-full bg-[#b9d77a]/25 blur-3xl"
          animate={{ x: [0, -30, 0], y: [0, -40, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden
        />

        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: SUAVE }} className="relative flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="size-11 rounded-xl shadow-lg" />
          <span className="text-xl font-bold">
            Gestão de <span className="text-[#c9e38f]">Documentos</span>
          </span>
        </motion.div>

        <div className="relative grid grid-cols-[1fr_auto] items-center gap-10">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: SUAVE, delay: 0.1 }}
              className="max-w-md text-[2.6rem] leading-[1.1] font-bold tracking-tight"
            >
              Seus documentos <span className="bg-linear-to-r from-[#d7ee9f] to-[#9fcf4f] bg-clip-text text-transparent">organizados</span>, seus prazos sob controle.
            </motion.h1>
            <motion.ul initial="oculto" animate="visivel" variants={{ visivel: { transition: { staggerChildren: 0.08, delayChildren: 0.3 } } }} className="mt-9 grid max-w-md gap-4">
              {DESTAQUES.map(({ icone: Icone, titulo, texto }) => (
                <motion.li
                  key={titulo}
                  variants={{ oculto: { opacity: 0, x: -12 }, visivel: { opacity: 1, x: 0, transition: { duration: 0.4, ease: SUAVE } } }}
                  className="flex items-start gap-3.5"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
                    <Icone className="size-5" aria-hidden />
                  </span>
                  <span>
                    <span className="block font-semibold">{titulo}</span>
                    <span className="block text-sm text-white/70">{texto}</span>
                  </span>
                </motion.li>
              ))}
            </motion.ul>
          </div>
          <IlustracaoDocumentos />
        </div>

        <p className="relative text-sm text-white/55">Contratos, licenças, notas fiscais, certidões e muito mais — em um só lugar.</p>
      </section>

      {/* Formulário */}
      <section className="relative flex items-center justify-center overflow-hidden px-5 py-10">
        <div className="absolute -top-40 -right-40 size-96 rounded-full bg-primary/10 blur-3xl lg:hidden" aria-hidden />
        <motion.form
          onSubmit={aoEnviar}
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: SUAVE, delay: 0.05 }}
          className="relative w-full max-w-sm"
        >
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img src="/favicon.svg" alt="" className="size-11 rounded-xl" />
            <span className="text-lg font-bold">
              Gestão de <span className="text-primary-dark">Documentos</span>
            </span>
          </div>

          <h2 className="text-3xl font-bold tracking-tight">Bem-vindo de volta</h2>
          <p className="mt-1.5 mb-8 text-sm text-ink-muted">Entre com o e-mail e a senha do seu convite.</p>

          <div className="grid gap-4">
            <CampoIcone id="email" rotulo="E-mail" icone={Mail}>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                placeholder="voce@empresa.com.br"
                className="campo h-12 pl-11"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </CampoIcone>
            <CampoIcone
              id="senha"
              rotulo="Senha"
              icone={LockKeyhole}
              acao={
                <button
                  type="button"
                  onClick={() => setVerSenha(!verSenha)}
                  className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-2 hover:text-ink"
                  aria-label={verSenha ? "Esconder senha" : "Mostrar senha"}
                >
                  {verSenha ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                </button>
              }
            >
              <input
                id="senha"
                type={verSenha ? "text" : "password"}
                autoComplete="current-password"
                required
                placeholder="••••••••"
                className="campo h-12 pr-12 pl-11"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
            </CampoIcone>

            <div className="-mt-1 flex justify-end">
              <button type="button" onClick={esqueciSenha} className="text-sm font-medium text-primary-dark hover:underline">
                Esqueci minha senha
              </button>
            </div>

            {erro !== null && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
                <MensagemErro erro={erro} />
              </motion.div>
            )}

            <Botao type="submit" carregando={enviando} className="group h-12 w-full text-[15px]">
              Entrar
              {!enviando && <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />}
            </Botao>
          </div>

          <p className="mt-8 text-center text-xs text-ink-muted">Acesso restrito a usuários convidados pelo administrador.</p>
        </motion.form>
      </section>
    </div>
  );
}

function CampoIcone({ id, rotulo, icone: Icone, acao, children }: { id: string; rotulo: string; icone: typeof Mail; acao?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="rotulo">
        {rotulo}
      </label>
      <div className="group relative">
        <Icone className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-ink-muted transition-colors group-focus-within:text-primary-dark" aria-hidden />
        {children}
        {acao}
      </div>
    </div>
  );
}

/** Três cartões de documento flutuando, com selos de situação (decorativo). */
function IlustracaoDocumentos() {
  const cartoes = [
    { titulo: "Licença de operação", detalhe: "Vence em 12 dias", icone: CalendarClock, selo: "A vencer", tom: "bg-[#fde8dd] text-[#b33e08]", giro: -6, atraso: 0 },
    { titulo: "Contrato — AgroPará", detalhe: "Aprovado por Jurídico", icone: BadgeCheck, selo: "Aprovado", tom: "bg-[#e5f0d6] text-[#3f6b1f]", giro: 4, atraso: 1.2 },
    { titulo: "NF-e 4587 — Arcon", detalhe: "Lida pela IA", icone: Sparkles, selo: "Indexado", tom: "bg-white/80 text-[#4e7a1c]", giro: -2, atraso: 2.4 },
  ];
  return (
    <div className="relative hidden h-80 w-60 xl:block" aria-hidden>
      {cartoes.map((c, i) => (
        <motion.div
          key={c.titulo}
          initial={{ opacity: 0, y: 30, rotate: c.giro }}
          animate={{ opacity: 1, y: [0, -10, 0], rotate: c.giro }}
          transition={{ opacity: { duration: 0.5, delay: 0.4 + i * 0.15 }, y: { duration: 6, repeat: Infinity, ease: "easeInOut", delay: c.atraso } }}
          className={clsx("absolute w-56 rounded-2xl bg-white/95 p-4 text-ink shadow-2xl ring-1 ring-black/5", i === 0 && "top-0 left-0", i === 1 && "top-24 left-6", i === 2 && "top-48 -left-2")}
        >
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-[#e5f0d6] text-[#4e7a1c]">
              <FileText className="size-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{c.titulo}</span>
              <span className="flex items-center gap-1 text-xs text-ink-muted">
                <c.icone className="size-3" /> {c.detalhe}
              </span>
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className={clsx("rounded-full px-2 py-0.5 text-[11px] font-semibold", c.tom)}>{c.selo}</span>
            <span className="h-1.5 w-16 rounded-full bg-surface-2" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
