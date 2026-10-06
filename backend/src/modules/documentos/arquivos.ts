import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import multer from "multer";
import { env } from "../../config/env.js";
import { HttpError } from "../../lib/errors.js";

/** Tipos de arquivo aceitos (PDF, XML, DOCX, imagens e texto). */
export const TIPOS_ACEITOS: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "application/xml": [".xml"],
  "text/xml": [".xml"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "text/plain": [".txt"],
};

const MIME_POR_EXTENSAO: Record<string, string> = {
  ".pdf": "application/pdf",
  ".xml": "application/xml",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".txt": "text/plain",
};

/** Recebe o arquivo em memória (limite configurável) — o envio ao MinIO é feito pelo serviço. */
export const receberArquivo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.UPLOAD_MAX_MB * 1024 * 1024, files: 1, fields: 30 },
}).single("arquivo");

/**
 * Define o MIME a partir da extensão quando o navegador manda algo genérico
 * (ex.: application/octet-stream para .xml) e recusa tipos fora da lista.
 */
export function resolverMime(nomeArquivo: string, mimeInformado: string): string {
  const extensao = path.extname(nomeArquivo).toLowerCase();
  const pelaExtensao = MIME_POR_EXTENSAO[extensao];
  if (!pelaExtensao) {
    throw new HttpError(400, "Tipo de arquivo não aceito. Envie PDF, XML, DOCX, PNG, JPG ou TXT.");
  }
  const aceitas = TIPOS_ACEITOS[mimeInformado];
  return aceitas?.includes(extensao) ? mimeInformado : pelaExtensao;
}

export function sha256(conteudo: Buffer): string {
  return createHash("sha256").update(conteudo).digest("hex");
}

/** Corrige nomes UTF-8 que o multer entrega decodificados como latin1. */
export function nomeOriginal(nome: string): string {
  const convertido = Buffer.from(nome, "latin1").toString("utf8");
  return convertido.includes(String.fromCharCode(0xfffd)) ? nome : convertido;
}

export function slug(texto: string, limite = 60): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, limite);
}

/** Chave no bucket: {categoria-raiz}/{aaaa}/{mm}/{uuid}-{nome-normalizado}.{ext} */
export function gerarStorageKey(prefixo: string, nomeArquivo: string, agora = new Date()): string {
  const extensao = path.extname(nomeArquivo).toLowerCase();
  const base = slug(path.basename(nomeArquivo, path.extname(nomeArquivo)));
  const ano = agora.getUTCFullYear();
  const mes = String(agora.getUTCMonth() + 1).padStart(2, "0");
  return `${slug(prefixo) || "documentos"}/${ano}/${mes}/${randomUUID()}-${base || "arquivo"}${extensao}`;
}
