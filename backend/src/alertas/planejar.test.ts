import { describe, expect, it } from "vitest";
import { agruparPorResponsavel, descreverAviso, planejarAvisos, semanaIso, type ItemCentral } from "./planejar.js";

const item = (parcial: Partial<ItemCentral>): ItemCentral => ({
  tipo: "acao",
  chave: "acao:p1",
  documento_id: "d1",
  documento_titulo: "Licença de operação",
  titulo: "Protocolar renovação",
  data: "2026-12-01",
  dias: 8,
  estado: "proximo",
  responsavel_id: "u1",
  ...parcial,
});

describe("planejarAvisos", () => {
  const hoje = "2026-11-23";

  it("avisa uma vez quando entra na janela de antecedência, com a data na chave", () => {
    const [aviso] = planejarAvisos([item({})], hoje);
    expect(aviso).toMatchObject({ motivo: "aviso", chave: "acao:p1:aviso:2026-12-01", responsavelId: "u1" });
  });

  it("vence hoje tem chave própria", () => {
    expect(planejarAvisos([item({ dias: 0, data: hoje })], hoje)[0]?.motivo).toBe("hoje");
  });

  it("atrasado repete uma vez por semana", () => {
    const atrasado = item({ estado: "atrasado", dias: -3, data: "2026-11-20" });
    const semana1 = planejarAvisos([atrasado], "2026-11-23")[0]!.chave;
    const mesmaSemana = planejarAvisos([atrasado], "2026-11-26")[0]!.chave;
    const semana2 = planejarAvisos([atrasado], "2026-11-30")[0]!.chave;
    expect(semana1).toBe(mesmaSemana);
    expect(semana2).not.toBe(semana1);
  });

  it("aprovação avisa a cada 3 dias", () => {
    const aprovacao = item({ tipo: "aprovacao", chave: "aprovacao:d1", data: null, dias: null });
    const dia1 = planejarAvisos([aprovacao], "2026-11-23")[0]!.chave;
    const dia4 = planejarAvisos([aprovacao], "2026-11-26")[0]!.chave;
    expect(dia1).not.toBe(dia4);
  });

  it("ignora itens futuros, sem prazo ou sem responsável", () => {
    const itens = [item({ estado: "futuro", dias: 90 }), item({ data: null, dias: null, estado: "futuro" }), item({ responsavel_id: null })];
    expect(planejarAvisos(itens, hoje)).toEqual([]);
  });
});

describe("agrupamento e texto", () => {
  it("junta os avisos de cada pessoa num e-mail só", () => {
    const avisos = planejarAvisos([item({}), item({ chave: "acao:p2" }), item({ chave: "acao:p3", responsavel_id: "u2" })], "2026-11-23");
    const grupos = agruparPorResponsavel(avisos);
    expect(grupos.get("u1")).toHaveLength(2);
    expect(grupos.get("u2")).toHaveLength(1);
  });

  it("descreve o aviso com estado, título, documento e data", () => {
    const [aviso] = planejarAvisos([item({ estado: "atrasado", dias: -2 })], "2026-11-23");
    expect(descreverAviso(aviso!)).toBe("[Atrasado] Protocolar renovação — Licença de operação (01/12/2026)");
  });

  it("semana ISO", () => {
    expect(semanaIso("2026-01-01")).toBe("2026-W01");
    expect(semanaIso("2026-11-23")).toBe("2026-W48");
  });
});
