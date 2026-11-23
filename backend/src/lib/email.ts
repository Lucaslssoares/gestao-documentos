import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

let transporte: Transporter | null | undefined;

function obterTransporte(): Transporter | null {
  if (transporte !== undefined) return transporte;
  transporte = env.SMTP_HOST
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      })
    : null;
  return transporte;
}

export function emailConfigurado(): boolean {
  return Boolean(env.SMTP_HOST);
}

export interface Email {
  para: string;
  assunto: string;
  /** Parágrafos do corpo (texto simples; viram HTML escapado). */
  linhas: string[];
  /** Botão com link para o sistema. */
  link?: { rotulo: string; caminho: string };
}

const escapar = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function montarHtml(email: Email): string {
  const url = email.link ? `${env.APP_URL.replace(/\/$/, "")}${email.link.caminho}` : null;
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f5f7f1;font-family:Arial,sans-serif;color:#1c2616">
<div style="max-width:560px;margin:0 auto;padding:24px">
  <p style="margin:0 0 16px;font-weight:bold;color:#4e7a1c">Gestão de Documentos</p>
  <div style="background:#fff;border:1px solid #e2e7da;border-radius:12px;padding:24px">
    ${email.linhas.map((l) => `<p style="margin:0 0 12px;line-height:1.5">${escapar(l)}</p>`).join("")}
    ${url ? `<p style="margin:20px 0 0"><a href="${escapar(url)}" style="display:inline-block;background:#4e7a1c;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:bold">${escapar(email.link!.rotulo)}</a></p>` : ""}
  </div>
  <p style="margin:16px 0 0;font-size:12px;color:#5d6852">Aviso automático. Não responda este e-mail.</p>
</div></body></html>`;
}

/** Envia um e-mail. Sem SMTP configurado só registra no log e devolve false. */
export async function enviarEmail(email: Email): Promise<boolean> {
  const t = obterTransporte();
  if (!t) {
    logger.debug({ para: email.para, assunto: email.assunto }, "SMTP não configurado: aviso por e-mail ignorado");
    return false;
  }
  const texto = [...email.linhas, ...(email.link ? [`${email.link.rotulo}: ${env.APP_URL.replace(/\/$/, "")}${email.link.caminho}`] : [])].join("\n\n");
  await t.sendMail({ from: env.SMTP_FROM, to: email.para, subject: email.assunto, text: texto, html: montarHtml(email) });
  return true;
}
