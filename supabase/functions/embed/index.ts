// Edge Function "embed" — gera embeddings com o modelo gte-small nativo do Supabase Edge Runtime
// (gratuito, sem API externa). Vetores de 384 dimensões, normalizados (use produto interno <#>).
//
// Limitações do gte-small: treinado em inglês e trunca entradas acima de 512 tokens.
// Por isso o backend envia trechos curtos (~1.000 caracteres) e a busca é híbrida (vetor + texto).
//
// POST { "inputs": ["texto 1", "texto 2", ...] }  →  { "modelo": "gte-small", "dimensoes": 384, "embeddings": [[...], ...] }
// Exige JWT (verify_jwt = true em config.toml); o backend chama com a service role.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const MODELO = "gte-small";
const MAX_INPUTS = 32;
const MAX_CARACTERES = 4000;

const session = new Supabase.ai.Session(MODELO);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Use POST." }, 405);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Corpo da requisição não é um JSON válido." }, 400);
  }

  const inputs = (body as { inputs?: unknown })?.inputs;
  if (
    !Array.isArray(inputs) ||
    inputs.length === 0 ||
    inputs.length > MAX_INPUTS ||
    !inputs.every((i) => typeof i === "string" && i.trim().length > 0)
  ) {
    return json({ error: `Envie "inputs": lista com 1 a ${MAX_INPUTS} textos não vazios.` }, 400);
  }

  try {
    const embeddings: number[][] = [];
    for (const input of inputs as string[]) {
      const vetor = await session.run(input.slice(0, MAX_CARACTERES), {
        mean_pool: true,
        normalize: true,
      });
      embeddings.push(Array.from(vetor as number[]));
    }
    return json({ modelo: MODELO, dimensoes: 384, embeddings });
  } catch (err) {
    console.error("Falha ao gerar embeddings:", err);
    return json({ error: "Falha ao gerar embeddings." }, 500);
  }
});
