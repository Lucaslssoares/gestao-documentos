import { describe, expect, it } from "vitest";
import { formatarCampo, formatarData, formatarMoeda, formatarTamanho, textoPrazo } from "./format";

describe("formatação", () => {
  it("formata datas ISO sem deslocar o fuso", () => {
    expect(formatarData("2026-10-05")).toBe("05/10/2026");
    expect(formatarData(null)).toBe("—");
  });

  it("formata moeda e tamanho de arquivo em português", () => {
    expect(formatarMoeda(480000).replace(/\s/g, " ")).toBe("R$ 480.000,00");
    expect(formatarTamanho(512)).toBe("512 B");
    expect(formatarTamanho(1536 * 1024)).toBe("1,5 MB");
  });

  it("descreve o prazo de vencimento", () => {
    expect(textoPrazo(0)).toBe("vence hoje");
    expect(textoPrazo(10)).toBe("vence em 10 dias");
    expect(textoPrazo(-3)).toBe("venceu há 3 dias");
    expect(textoPrazo(null)).toBeNull();
  });

  it("formata campos personalizados conforme o tipo", () => {
    expect(formatarCampo({ tipo: "booleano" }, true)).toBe("Sim");
    expect(formatarCampo({ tipo: "data" }, "2026-01-31")).toBe("31/01/2026");
    expect(formatarCampo({ tipo: "texto" }, "")).toBe("—");
  });
});
