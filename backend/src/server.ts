import { criarApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { filaProcessamento } from "./processing/fila.js";
import { processarDocumento } from "./processing/pipeline.js";

const app = criarApp();

const servidor = app.listen(env.PORT, () => {
  logger.info(`API do Gestão de Documentos ouvindo na porta ${env.PORT}`);
});

// Pipeline de documentos: liga a fila e retoma o que ficou pendente numa parada anterior.
filaProcessamento.iniciar((id) => processarDocumento(id));
filaProcessamento
  .retomarPendentes()
  .then((n) => n > 0 && logger.info(`${n} documento(s) pendente(s) retomado(s) para processamento`))
  .catch((err) => logger.error({ err }, "falha ao retomar documentos pendentes"));

function encerrar(sinal: string) {
  logger.info(`${sinal} recebido, encerrando...`);
  servidor.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => encerrar("SIGTERM"));
process.on("SIGINT", () => encerrar("SIGINT"));
