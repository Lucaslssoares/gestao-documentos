import { existsSync } from "node:fs";
import { z } from "zod";

// Em desenvolvimento lê o .env da raiz do monorepo (ou do próprio backend).
// Variáveis já definidas no ambiente (ex.: docker compose) têm precedência.
if (process.env.NODE_ENV !== "test") {
  for (const arquivo of [".env", "../.env"]) {
    if (existsSync(arquivo)) {
      process.loadEnvFile(arquivo);
      break;
    }
  }
}

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3333),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  /** Origens liberadas no CORS, separadas por vírgula. */
  CORS_ORIGINS: z.string().default("http://localhost:5173,http://localhost:8080"),
  /** URL pública do front-end (links de convite e redefinição de senha). */
  APP_URL: z.url().default("http://localhost:5173"),

  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().default("gestao-documentos"),
  UPLOAD_MAX_MB: z.coerce.number().positive().max(100).default(25),

  /** Sem a chave o restante do sistema funciona; só o chat fica indisponível. */
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-opus-5-5"),

  /** Padrão: Edge Function "embed" do próprio Supabase (gte-small). */
  EMBEDDINGS_URL: z.url().optional(),
  EMBEDDINGS_LOTE: z.coerce.number().int().min(1).max(32).default(16),
  PROCESSAMENTO_CONCORRENCIA: z.coerce.number().int().min(1).max(8).default(2),
});

const resultado = schema.safeParse(process.env);

if (!resultado.success) {
  const problemas = resultado.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Variáveis de ambiente inválidas:\n${problemas}\nVeja o arquivo .env.example na raiz do projeto.`);
}

export const env = {
  ...resultado.data,
  EMBEDDINGS_URL: resultado.data.EMBEDDINGS_URL ?? `${resultado.data.SUPABASE_URL.replace(/\/$/, "")}/functions/v1/embed`,
  corsOrigins: resultado.data.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean),
};

export type Env = typeof env;
