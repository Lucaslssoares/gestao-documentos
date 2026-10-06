import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";
import { env } from "../config/env.js";

/** Cliente S3 apontando para o MinIO (path-style, como o MinIO espera). */
export const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  forcePathStyle: true,
  credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
});

export async function enviarArquivo(chave: string, conteudo: Buffer, contentType: string, sha256: string): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: chave,
      Body: conteudo,
      ContentType: contentType,
      Metadata: { sha256 },
    }),
  );
}

export async function lerArquivo(chave: string): Promise<Buffer> {
  const resposta = await s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: chave }));
  if (!resposta.Body) throw new Error(`Objeto vazio no storage: ${chave}`);
  return Buffer.from(await resposta.Body.transformToByteArray());
}

export async function abrirArquivo(chave: string): Promise<{ stream: Readable; tamanho?: number }> {
  const resposta = await s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: chave }));
  if (!resposta.Body) throw new Error(`Objeto vazio no storage: ${chave}`);
  return { stream: resposta.Body as Readable, tamanho: resposta.ContentLength };
}

export async function removerArquivo(chave: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: chave }));
}
