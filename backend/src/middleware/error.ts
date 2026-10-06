import type { ErrorRequestHandler, RequestHandler } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { env } from "../config/env.js";
import { HttpError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export const rotaNaoEncontrada: RequestHandler = (_req, _res, next) => {
  next(new HttpError(404, "Rota não encontrada."));
};

export const tratarErros: ErrorRequestHandler = (err, req, res, _next) => {
  if (res.headersSent) {
    req.log?.error({ err }, "erro após o início da resposta");
    res.end();
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      erro: "Dados inválidos.",
      campos: err.issues.map((i) => ({ campo: i.path.join("."), mensagem: i.message })),
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    const mensagem =
      err.code === "LIMIT_FILE_SIZE" ? `Arquivo maior que o limite de ${env.UPLOAD_MAX_MB} MB.` : "Falha no envio do arquivo.";
    res.status(400).json({ erro: mensagem });
    return;
  }

  if (err instanceof HttpError) {
    if (err.status >= 500) (req.log ?? logger).error({ err, detalhes: err.detalhes }, err.message);
    res.status(err.status).json({ erro: err.message });
    return;
  }

  // JSON malformado no corpo
  if (typeof err === "object" && err !== null && "type" in err && err.type === "entity.parse.failed") {
    res.status(400).json({ erro: "JSON inválido no corpo da requisição." });
    return;
  }

  (req.log ?? logger).error({ err }, "erro não tratado");
  res.status(500).json({ erro: "Erro interno. Tente novamente em instantes." });
};
