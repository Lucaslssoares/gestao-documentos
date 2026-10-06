import { Router, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { chatDisponivel, mensagemDeErro, responderPergunta, type MensagemHistorico } from "../../ai/orquestrador.js";
import { semCitacoes } from "../../ai/fontes.js";
import { ctx } from "../../middleware/auth.js";
import { erroDoBanco, HttpError } from "../../lib/errors.js";
import { idParam } from "../../lib/http.js";
import { registrarEvento } from "../historico/service.js";

export const chatRouter = Router();

const MENSAGENS_DE_HISTORICO = 10;

const limitador = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => req.auth?.userId ?? "anonimo",
  message: { erro: "Muitas perguntas em sequência. Aguarde um minuto." },
});

const perguntaSchema = z.object({
  conversa_id: z.uuid().optional(),
  mensagem: z.string().trim().min(2, { error: "Digite sua pergunta." }).max(4000, { error: "Pergunta muito longa (máx. 4.000 caracteres)." }),
});

chatRouter.get("/status", (_req, res) => {
  res.json({ disponivel: chatDisponivel() });
});

chatRouter.get("/conversas", async (req, res) => {
  const { db } = ctx(req);
  const { data, error } = await db
    .from("chat_conversas")
    .select("id, titulo, criado_em, atualizado_em")
    .order("atualizado_em", { ascending: false })
    .limit(50);
  if (error) throw erroDoBanco(error, "conversa");
  res.json({ itens: data });
});

chatRouter.get("/conversas/:id", async (req, res) => {
  const { db } = ctx(req);
  const { id } = idParam.parse(req.params);
  const [conversa, mensagens] = await Promise.all([
    db.from("chat_conversas").select("id, titulo, criado_em").eq("id", id).single(),
    db.from("chat_mensagens").select("id, papel, conteudo, fontes, criado_em").eq("conversa_id", id).order("id"),
  ]);
  if (conversa.error) throw erroDoBanco(conversa.error, "conversa");
  if (mensagens.error) throw erroDoBanco(mensagens.error, "mensagem");
  res.json({ ...conversa.data, mensagens: mensagens.data });
});

chatRouter.delete("/conversas/:id", async (req, res) => {
  const { db } = ctx(req);
  const { id } = idParam.parse(req.params);
  const { error } = await db.from("chat_conversas").delete().eq("id", id);
  if (error) throw erroDoBanco(error, "conversa");
  res.status(204).end();
});

/**
 * Pergunta ao assistente. Resposta em Server-Sent Events:
 *   conversa {id} → status {texto}* → texto {delta}* → fontes {fontes[]} → fim {mensagem_id}
 *   (ou "erro" {mensagem})
 */
chatRouter.post("/", limitador, async (req, res) => {
  const auth = ctx(req);
  const { db, userId } = auth;
  if (!chatDisponivel()) throw new HttpError(503, "Chatbot não configurado: defina ANTHROPIC_API_KEY no servidor.");
  const { conversa_id, mensagem } = perguntaSchema.parse(req.body);

  // Conversa existente (RLS: só do próprio usuário) ou nova.
  let conversaId = conversa_id;
  let historico: MensagemHistorico[] = [];
  if (conversaId) {
    const { data, error } = await db
      .from("chat_mensagens")
      .select("papel, conteudo")
      .eq("conversa_id", conversaId)
      .order("id", { ascending: false })
      .limit(MENSAGENS_DE_HISTORICO);
    if (error) throw erroDoBanco(error, "conversa");
    historico = (data ?? [])
      .reverse()
      .map((m) => ({ papel: m.papel as MensagemHistorico["papel"], conteudo: semCitacoes(m.conteudo as string) }));
    // A conversa precisa começar com o usuário.
    while (historico[0]?.papel === "assistant") historico.shift();
  } else {
    const { data, error } = await db
      .from("chat_conversas")
      .insert({ titulo: mensagem.slice(0, 80) })
      .select("id")
      .single();
    if (error) throw erroDoBanco(error, "conversa");
    conversaId = data.id as string;
  }

  const { error: erroPergunta } = await db
    .from("chat_mensagens")
    .insert({ conversa_id: conversaId, papel: "user", conteudo: mensagem });
  if (erroPergunta) throw erroDoBanco(erroPergunta, "conversa");

  // ---- A partir daqui a resposta é um stream SSE ----
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  const enviar = (evento: string, dados: unknown) => escreverEvento(res, evento, dados);
  enviar("conversa", { id: conversaId });

  const controle = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controle.abort();
  });

  try {
    const resposta = await responderPergunta({
      auth,
      historico,
      pergunta: mensagem,
      signal: controle.signal,
      eventos: {
        status: (texto) => enviar("status", { texto }),
        texto: (delta) => enviar("texto", { delta }),
      },
    });

    const { data: salva } = await db
      .from("chat_mensagens")
      .insert({
        conversa_id: conversaId,
        papel: "assistant",
        conteudo: resposta.texto,
        fontes: resposta.fontes,
        uso: { ...resposta.uso, ferramentas: resposta.ferramentas, recusado: resposta.recusado },
      })
      .select("id")
      .single();
    await db.from("chat_conversas").update({ atualizado_em: new Date().toISOString() }).eq("id", conversaId);

    void registrarEvento({
      atorId: userId,
      acao: "consultar",
      entidade: "chat",
      entidadeId: conversaId,
      detalhes: {
        pergunta: mensagem.slice(0, 500),
        ferramentas: resposta.ferramentas,
        fontes: resposta.fontes.map((f) => ({ tipo: f.tipo, titulo: f.titulo })),
        tokens: resposta.uso,
      },
    });

    enviar("fontes", { fontes: resposta.fontes });
    enviar("fim", { mensagem_id: salva?.id ?? null });
  } catch (err) {
    if (!controle.signal.aborted) {
      req.log?.error({ err }, "falha no chat");
      enviar("erro", { mensagem: mensagemDeErro(err) });
    }
  } finally {
    res.end();
  }
});

function escreverEvento(res: Response, evento: string, dados: unknown): void {
  if (res.writableEnded) return;
  res.write(`event: ${evento}\ndata: ${JSON.stringify(dados)}\n\n`);
}
