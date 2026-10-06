import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { HttpError } from "../lib/errors.js";
import { provedorEmbeddings } from "../processing/embeddings.js";
import type { ContextoAuth } from "../types/express.js";
import { criarFerramentas } from "./ferramentas.js";
import { RegistroFontes, type Fonte } from "./fontes.js";
import { contextoDaRequisicao, PROMPT_SISTEMA } from "./prompt.js";

const anthropic = env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null;

export const chatDisponivel = (): boolean => anthropic !== null;

const ROTULOS: Record<string, string> = {
  pesquisar_documentos: "Pesquisando documentos",
  detalhar_documento: "Abrindo o documento",
  listar_categorias: "Consultando as categorias",
  busca_semantica: "Buscando no conteúdo dos arquivos",
  ler_documento: "Lendo o documento",
};

export interface EventosChat {
  status(texto: string): void;
  texto(delta: string): void;
}

export interface MensagemHistorico {
  papel: "user" | "assistant";
  conteudo: string;
}

export interface RespostaChat {
  texto: string;
  fontes: Fonte[];
  ferramentas: string[];
  recusado: boolean;
  uso: { entrada: number; saida: number; cache_leitura: number; cache_escrita: number };
}

class EntradaDeFerramentaTruncada extends Error {}

/**
 * AI Orchestrator: entende a pergunta, decide a fonte de dados (consultas SQL ou busca
 * semântica nos documentos), executa as ferramentas com a RLS do usuário e gera a
 * resposta com fontes. O loop de ferramentas é do tool runner do SDK, em streaming.
 */
export async function responderPergunta(opcoes: {
  auth: ContextoAuth;
  historico: MensagemHistorico[];
  pergunta: string;
  eventos: EventosChat;
  signal: AbortSignal;
}): Promise<RespostaChat> {
  if (!anthropic) throw new HttpError(503, "Chatbot não configurado: defina ANTHROPIC_API_KEY no servidor.");
  const { auth, eventos, signal } = opcoes;

  const fontes = new RegistroFontes();
  const ferramentasUsadas: string[] = [];
  const ferramentas = criarFerramentas({
    db: auth.db,
    fontes,
    embeddings: provedorEmbeddings,
    aoUsar: (nome) => {
      ferramentasUsadas.push(nome);
      eventos.status(ROTULOS[nome] ?? "Consultando dados");
    },
  });

  const categorias = await nomesDasCategorias(auth);
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...opcoes.historico.map((m) => ({ role: m.papel, content: m.conteudo })),
    { role: "user", content: opcoes.pergunta },
    // Contexto variável como mensagem de sistema no meio da conversa: não invalida o cache
    // do prompt de sistema e é um canal do operador (não pode ser forjado pelo usuário).
    {
      role: "system",
      content: contextoDaRequisicao({ hoje: new Date(), nome: auth.perfil.nome, papel: auth.perfil.papel, categorias }),
    },
  ];

  const parametros = {
    model: env.ANTHROPIC_MODEL,
    max_tokens: 16000,
    system: [{ type: "text" as const, text: PROMPT_SISTEMA, cache_control: { type: "ephemeral" as const } }],
    thinking: { type: "adaptive" as const },
    output_config: { effort: "medium" as const },
    // Se o modelo principal recusar por política, a API refaz no modelo recomendado.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default" as const,
    tools: ferramentas,
    messages,
    max_iterations: 10,
    stream: true as const,
  };

  let runner = anthropic.beta.messages.toolRunner(parametros, { signal });
  let texto = "";
  let recusado = false;
  const uso = { entrada: 0, saida: 0, cache_leitura: 0, cache_escrita: 0 };

  for (let tentativa = 0; ; tentativa++) {
    try {
      for await (const stream of runner) {
        for await (const evento of stream) {
          if (evento.type === "content_block_delta" && evento.delta.type === "text_delta") {
            texto += evento.delta.text;
            eventos.texto(evento.delta.text);
          }
        }
        const mensagem = await stream.finalMessage();
        tentativa = 0;
        uso.entrada += mensagem.usage.input_tokens;
        uso.saida += mensagem.usage.output_tokens;
        uso.cache_leitura += mensagem.usage.cache_read_input_tokens ?? 0;
        uso.cache_escrita += mensagem.usage.cache_creation_input_tokens ?? 0;

        // O runner não aplica as regras de stop_reason: entrada de ferramenta truncada
        // pode passar na validação, e uma recusa pode cortar um tool_use no meio.
        const temFerramenta = mensagem.content.some((b) => b.type === "tool_use");
        if (mensagem.stop_reason === "max_tokens" && temFerramenta) {
          throw new EntradaDeFerramentaTruncada("Entrada de ferramenta truncada.");
        }
        if (mensagem.stop_reason === "refusal") {
          recusado = true;
          break;
        }
      }
      break;
    } catch (err) {
      // JSON de ferramenta impossível de interpretar: refaz o turno (no máximo 2 vezes seguidas).
      if (err instanceof Anthropic.APIError || err instanceof EntradaDeFerramentaTruncada || tentativa >= 2 || signal.aborted) {
        throw err;
      }
      runner = anthropic.beta.messages.toolRunner({ ...runner.params }, { signal });
    }
  }

  if (recusado && !texto.trim()) {
    const aviso = "Não consigo ajudar com essa solicitação. Reformule a pergunta sobre contratos, documentos ou notas fiscais.";
    texto = aviso;
    eventos.texto(aviso);
  }

  return { texto, fontes: fontes.citadas(texto), ferramentas: ferramentasUsadas, recusado, uso };
}

async function nomesDasCategorias(auth: ContextoAuth): Promise<string[]> {
  if (auth.perfil.papel === "admin") return ["todas"];
  if (auth.perfil.categorias.length === 0) return [];
  const { data } = await auth.db.from("categorias").select("nome").in("id", auth.perfil.categorias).order("ordem");
  return (data ?? []).map((c) => c.nome as string);
}

/** Mensagem amigável para falhas da API do Claude. */
export function mensagemDeErro(err: unknown): string {
  if (err instanceof HttpError) return err.message;
  if (err instanceof Anthropic.RateLimitError) return "Muitas consultas ao assistente agora. Aguarde alguns segundos e tente de novo.";
  if (err instanceof Anthropic.AuthenticationError) return "Chave da API do assistente inválida. Avise o administrador.";
  if (err instanceof Anthropic.APIConnectionError) return "Não foi possível falar com o serviço de IA. Verifique a conexão do servidor.";
  if (err instanceof Anthropic.APIError && (err.status ?? 0) >= 500) return "O serviço de IA está instável. Tente novamente em instantes.";
  if (err instanceof EntradaDeFerramentaTruncada) return "A consulta ficou grande demais. Tente uma pergunta mais específica.";
  return "Não foi possível gerar a resposta. Tente novamente.";
}
