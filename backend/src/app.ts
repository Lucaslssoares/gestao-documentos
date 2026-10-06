import cors from "cors";
import express, { Router } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { autenticar } from "./middleware/auth.js";
import { rotaNaoEncontrada, tratarErros } from "./middleware/error.js";
import { categoriasRouter } from "./modules/cadastros/categorias.js";
import { empresasRouter } from "./modules/cadastros/empresas.js";
import { setoresRouter, tagsRouter } from "./modules/cadastros/setores-tags.js";
import { tiposRouter } from "./modules/cadastros/tipos.js";
import { chatRouter } from "./modules/chat/routes.js";
import { dashboardRouter } from "./modules/dashboard/routes.js";
import { documentosRouter } from "./modules/documentos/routes.js";
import { historicoRouter } from "./modules/historico/routes.js";
import { equipeRouter, meRouter, usuariosRouter } from "./modules/usuarios/routes.js";

export function criarApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1); // atrás do nginx do front-end
  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: false,
      exposedHeaders: ["Content-Disposition"],
    }),
  );
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === "/health" },
      customProps: (req) => ({ usuario: (req as express.Request).auth?.userId }),
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  const api = Router();
  api.use(autenticar);
  api.use("/me", meRouter);
  api.use("/dashboard", dashboardRouter);
  api.use("/documentos", documentosRouter);
  api.use("/categorias", categoriasRouter);
  api.use("/tipos-documento", tiposRouter);
  api.use("/empresas", empresasRouter);
  api.use("/setores", setoresRouter);
  api.use("/tags", tagsRouter);
  api.use("/historico", historicoRouter);
  api.use("/equipe", equipeRouter);
  api.use("/usuarios", usuariosRouter);
  api.use("/chat", chatRouter);

  app.use("/api", api);
  app.use(rotaNaoEncontrada);
  app.use(tratarErros);

  return app;
}
