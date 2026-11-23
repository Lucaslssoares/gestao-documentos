import { env } from "../config/env.js";
import { emailConfigurado, enviarEmail, type Email } from "../lib/email.js";
import { logger } from "../lib/logger.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { agruparPorResponsavel, chaveAprovacao, descreverAviso, planejarAvisos, type ItemCentral } from "./planejar.js";

const UMA_HORA = 60 * 60 * 1000;

/** Data de hoje no fuso da empresa (AAAA-MM-DD). */
export function hojeLocal(agora = new Date()): string {
  return agora.toLocaleDateString("en-CA", { timeZone: "America/Belem" });
}

async function emailsDosUsuarios(ids: string[]): Promise<Map<string, { nome: string; email: string }>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabaseAdmin.from("perfis").select("id, nome, email").in("id", ids).eq("ativo", true);
  if (error) throw error;
  return new Map((data ?? []).map((p) => [p.id as string, { nome: p.nome as string, email: p.email as string }]));
}

async function chavesJaEnviadas(chaves: string[]): Promise<Set<string>> {
  const enviadas = new Set<string>();
  for (let i = 0; i < chaves.length; i += 200) {
    const { data, error } = await supabaseAdmin.from("notificacoes_enviadas").select("chave").in("chave", chaves.slice(i, i + 200));
    if (error) throw error;
    for (const linha of data ?? []) enviadas.add(linha.chave as string);
  }
  return enviadas;
}

async function marcarEnviadas(chaves: string[]): Promise<void> {
  if (chaves.length === 0) return;
  const { error } = await supabaseAdmin.from("notificacoes_enviadas").upsert(chaves.map((chave) => ({ chave })), { ignoreDuplicates: true });
  if (error) logger.error({ err: error }, "falha ao registrar avisos enviados");
}

/**
 * Uma rodada: lê a central (todas as pendências), decide os avisos devidos, descarta os já
 * enviados e manda um e-mail por pessoa. Devolve quantos e-mails saíram.
 */
export async function verificarAlertas(agora = new Date()): Promise<number> {
  if (!emailConfigurado()) return 0;
  const hoje = hojeLocal(agora);

  const { data, error } = await supabaseAdmin.rpc("central_pendencias", { p_escopo: "todas" });
  if (error) throw error;
  const avisos = planejarAvisos((data ?? []) as ItemCentral[], hoje);
  const enviadas = await chavesJaEnviadas(avisos.map((a) => a.chave));
  const novos = avisos.filter((a) => !enviadas.has(a.chave));
  if (novos.length === 0) return 0;

  const grupos = agruparPorResponsavel(novos);
  const pessoas = await emailsDosUsuarios([...grupos.keys()]);
  let enviados = 0;
  for (const [id, lista] of grupos) {
    const pessoa = pessoas.get(id);
    if (!pessoa) continue;
    const atrasados = lista.filter((a) => a.motivo === "atrasado").length;
    try {
      await enviarEmail({
        para: pessoa.email,
        assunto: atrasados
          ? `${atrasados} pendência(s) atrasada(s) no Gestão de Documentos`
          : `${lista.length} pendência(s) precisam da sua atenção`,
        linhas: [`Olá, ${pessoa.nome.split(" ")[0]}.`, "Estes itens precisam da sua atenção:", ...lista.map(descreverAviso)],
        link: { rotulo: "Abrir minhas pendências", caminho: "/pendencias" },
      });
      await marcarEnviadas(lista.map((a) => a.chave));
      enviados++;
    } catch (err) {
      logger.error({ err, para: pessoa.email }, "falha ao enviar alerta por e-mail");
    }
  }
  return enviados;
}

/** Liga a verificação de hora em hora (primeira rodada 1 minuto após subir). */
export function iniciarAgendador(): void {
  if (!env.ALERTAS_ATIVOS) return;
  if (!emailConfigurado()) {
    logger.info("SMTP não configurado: alertas por e-mail desligados (as pendências continuam no sistema)");
    return;
  }
  const rodar = () =>
    verificarAlertas()
      .then((n) => n > 0 && logger.info(`${n} e-mail(s) de alerta enviado(s)`))
      .catch((err) => logger.error({ err }, "falha na verificação de alertas"));
  setTimeout(rodar, 60_000).unref();
  setInterval(rodar, UMA_HORA).unref();
}

// ---------------------------------------------------------------------------
// Avisos imediatos (não esperam a rodada do agendador)
// ---------------------------------------------------------------------------

/** Envia o mesmo e-mail a vários usuários; falhas só vão para o log. */
export async function avisarUsuarios(ids: string[], montar: (nome: string) => Omit<Email, "para">): Promise<void> {
  if (!emailConfigurado()) return;
  try {
    const pessoas = await emailsDosUsuarios([...new Set(ids)]);
    await Promise.all(
      [...pessoas.values()].map(({ nome, email }) =>
        enviarEmail({ para: email, ...montar(nome.split(" ")[0] ?? nome) }).catch((err) => logger.error({ err, para: email }, "falha ao enviar aviso")),
      ),
    );
  } catch (err) {
    logger.error({ err }, "falha ao preparar aviso por e-mail");
  }
}

/** Pede a aprovação já na hora e marca a janela atual como enviada (o agendador não repete). */
export async function avisarAprovacaoSolicitada(documento: { id: string; titulo: string }, aprovadorId: string, solicitante: string): Promise<void> {
  await avisarUsuarios([aprovadorId], (nome) => ({
    assunto: `Aprovação pendente: ${documento.titulo}`,
    linhas: [`Olá, ${nome}.`, `${solicitante} enviou o documento "${documento.titulo}" e indicou você para aprovar.`],
    link: { rotulo: "Revisar e aprovar", caminho: `/documentos/${documento.id}` },
  }));
  await marcarEnviadas([chaveAprovacao(documento.id, hojeLocal())]);
}

/**
 * Quem acompanha o documento: o responsável e quem o visualizou ou baixou nos últimos 180 dias.
 * Usado no aviso de nova versão.
 */
export async function interessadosNoDocumento(documentoId: string, responsavelId: string | null, excetoId: string): Promise<string[]> {
  const desde = new Date(Date.now() - 180 * 86_400_000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("historico")
    .select("ator_id")
    .eq("documento_id", documentoId)
    .in("acao", ["visualizar", "baixar"])
    .gte("criado_em", desde)
    .limit(500);
  if (error) {
    logger.error({ err: error }, "falha ao buscar leitores do documento");
    return responsavelId && responsavelId !== excetoId ? [responsavelId] : [];
  }
  const ids = new Set((data ?? []).map((h) => h.ator_id as string).filter(Boolean));
  if (responsavelId) ids.add(responsavelId);
  ids.delete(excetoId);
  return [...ids];
}
