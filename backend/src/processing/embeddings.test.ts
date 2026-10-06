import { describe, expect, it, vi } from "vitest";
import { EmbeddingsSupabaseGteSmall } from "./embeddings.js";

const vetor = (v: number) => Array.from({ length: 384 }, () => v);

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
}

describe("EmbeddingsSupabaseGteSmall", () => {
  it("envia em lotes e devolve os vetores na ordem", async () => {
    const fetchFn = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const { inputs } = JSON.parse(String(init?.body)) as { inputs: string[] };
      return respostaJson({ embeddings: inputs.map((t) => vetor(Number(t))) });
    });
    const provedor = new EmbeddingsSupabaseGteSmall("http://x/functions/v1/embed", "chave", 2, fetchFn as unknown as typeof fetch);

    const resultado = await provedor.gerar(["1", "2", "3", "4", "5"]);

    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(resultado.map((v) => v[0])).toEqual([1, 2, 3, 4, 5]);
    const headers = fetchFn.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer chave");
  });

  it("falha quando a função responde erro", async () => {
    const fetchFn = vi.fn(async () => respostaJson({ error: "x" }, 500));
    const provedor = new EmbeddingsSupabaseGteSmall("http://x", "k", 16, fetchFn as unknown as typeof fetch);
    await expect(provedor.gerar(["a"])).rejects.toThrow(/500/);
  });

  it("falha quando a dimensão do vetor não é 384", async () => {
    const fetchFn = vi.fn(async () => respostaJson({ embeddings: [[0.1, 0.2]] }));
    const provedor = new EmbeddingsSupabaseGteSmall("http://x", "k", 16, fetchFn as unknown as typeof fetch);
    await expect(provedor.gerar(["a"])).rejects.toThrow(/384/);
  });
});
