import { describe, expect, it } from "vitest";
import { RegistroFontes, semCitacoes } from "./fontes.js";

describe("RegistroFontes", () => {
  it("numera fontes e reaproveita o id da mesma chave", () => {
    const registro = new RegistroFontes();
    const a = registro.registrar("documento:1", { tipo: "documento", titulo: "Contrato C-2026-014", documento_id: "1" });
    const b = registro.registrar("trecho:9:2", { tipo: "trecho", titulo: "Aditivo 1", documento_id: "9", pagina: 2 });
    const aDeNovo = registro.registrar("documento:1", { tipo: "documento", titulo: "outro título", documento_id: "1" });

    expect([a, b, aDeNovo]).toEqual(["F1", "F2", "F1"]);
    expect(registro.total).toBe(2);
  });

  it("devolve só as fontes citadas, na ordem da primeira citação e sem ids inventados", () => {
    const registro = new RegistroFontes();
    registro.registrar("a", { tipo: "documento", titulo: "A", documento_id: "a" });
    registro.registrar("b", { tipo: "documento", titulo: "B", documento_id: "b" });
    registro.registrar("c", { tipo: "documento", titulo: "C", documento_id: "c" });

    const citadas = registro.citadas("Vence em 10/10 [F3]. Valor de R$ 10 [F1]. Ver também [F3] e [F9].");
    expect(citadas.map((f) => f.titulo)).toEqual(["C", "A"]);
  });
});

describe("semCitacoes", () => {
  it("remove marcadores de fonte do histórico", () => {
    expect(semCitacoes("Vence em 10/10 [F2]. Valor [F10].")).toBe("Vence em 10/10. Valor.");
  });
});
