import { describe, expect, it } from "vitest";
import { dividirEmTrechos } from "./chunking.js";

const frase = (n: number) => `Cláusula ${n}: o contratado deverá cumprir as obrigações previstas neste instrumento.`;

describe("dividirEmTrechos", () => {
  it("mantém textos curtos em um único trecho", () => {
    const trechos = dividirEmTrechos([{ numero: 1, texto: "Contrato de manutenção predial." }]);
    expect(trechos).toEqual([{ ordem: 0, pagina: 1, conteudo: "Contrato de manutenção predial." }]);
  });

  it("respeita o tamanho máximo e numera os trechos em sequência", () => {
    const texto = Array.from({ length: 40 }, (_, i) => frase(i + 1)).join("\n\n");
    const trechos = dividirEmTrechos([{ numero: 1, texto }], { tamanho: 300, sobreposicao: 50 });

    expect(trechos.length).toBeGreaterThan(5);
    for (const t of trechos) expect(t.conteudo.length).toBeLessThanOrEqual(300);
    expect(trechos.map((t) => t.ordem)).toEqual(trechos.map((_, i) => i));
  });

  it("repete o fim do trecho anterior (sobreposição)", () => {
    const texto = Array.from({ length: 10 }, (_, i) => frase(i + 1)).join("\n\n");
    const [primeiro, segundo] = dividirEmTrechos([{ numero: 1, texto }], { tamanho: 250, sobreposicao: 60 });
    const finalDoPrimeiro = primeiro!.conteudo.slice(-30);
    expect(segundo!.conteudo).toContain(finalDoPrimeiro);
  });

  it("não mistura páginas no mesmo trecho", () => {
    const trechos = dividirEmTrechos([
      { numero: 1, texto: "Página um." },
      { numero: 2, texto: "Página dois." },
    ]);
    expect(trechos.map((t) => [t.pagina, t.conteudo])).toEqual([
      [1, "Página um."],
      [2, "Página dois."],
    ]);
  });

  it("quebra parágrafos e palavras enormes sem perder conteúdo", () => {
    const enorme = "a".repeat(50) + " " + "palavra ".repeat(300);
    const trechos = dividirEmTrechos([{ numero: null, texto: enorme }], { tamanho: 200, sobreposicao: 0 });
    for (const t of trechos) expect(t.conteudo.length).toBeLessThanOrEqual(200);
    const total = trechos.map((t) => t.conteudo).join(" ").split(/\s+/).filter((p) => p === "palavra").length;
    expect(total).toBe(300);
  });
});
