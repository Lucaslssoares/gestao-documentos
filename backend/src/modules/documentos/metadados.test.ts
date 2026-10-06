import { describe, expect, it } from "vitest";
import { HttpError } from "../../lib/errors.js";
import type { CampoPersonalizado } from "../../types/dominio.js";
import { camposSchema, validarMetadados } from "./metadados.js";

const CAMPOS_NF: CampoPersonalizado[] = [
  { chave: "numero", rotulo: "Número", tipo: "texto", obrigatorio: true },
  { chave: "valor_total", rotulo: "Valor total", tipo: "moeda", obrigatorio: true },
  { chave: "emissao", rotulo: "Emissão", tipo: "data" },
  { chave: "retencao", rotulo: "Com retenção", tipo: "booleano" },
  { chave: "forma", rotulo: "Forma", tipo: "selecao", opcoes: ["PIX", "Boleto"] },
];

describe("validarMetadados", () => {
  it("normaliza valores e descarta chaves desconhecidas", () => {
    const resultado = validarMetadados(CAMPOS_NF, {
      numero: " 4587 ",
      valor_total: "1234,567",
      emissao: "2026-10-05",
      retencao: "true",
      forma: "PIX",
      invasor: "x",
    });
    expect(resultado).toEqual({ numero: "4587", valor_total: 1234.57, emissao: "2026-10-05", retencao: true, forma: "PIX" });
  });

  it("exige os campos obrigatórios", () => {
    expect(() => validarMetadados(CAMPOS_NF, { numero: "" })).toThrow(/Número.*Valor total/);
  });

  it("recusa data inexistente, número inválido e opção fora da lista", () => {
    try {
      validarMetadados(CAMPOS_NF, { numero: "1", valor_total: "abc", emissao: "2026-02-30", forma: "Cheque" });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      const mensagem = (err as HttpError).message;
      expect(mensagem).toContain("Valor total");
      expect(mensagem).toContain("Emissão");
      expect(mensagem).toContain("Forma");
    }
  });

  it("recusa valores monetários negativos", () => {
    expect(() => validarMetadados(CAMPOS_NF, { numero: "1", valor_total: -10 })).toThrow(/negativo/);
  });
});

describe("camposSchema", () => {
  it("aceita uma definição válida", () => {
    expect(camposSchema.parse([{ chave: "valor", rotulo: "Valor", tipo: "moeda" }])).toEqual([
      { chave: "valor", rotulo: "Valor", tipo: "moeda", obrigatorio: false },
    ]);
  });

  it("recusa chaves repetidas e seleção sem opções", () => {
    const resultado = camposSchema.safeParse([
      { chave: "a", rotulo: "A", tipo: "texto" },
      { chave: "a", rotulo: "A2", tipo: "selecao" },
    ]);
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues.map((i) => i.message)).toEqual(["Chave repetida: a", 'O campo "A2" precisa de opções.']);
  });
});
