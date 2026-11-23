import { describe, expect, it } from "vitest";
import { celula, gerarCsvListaMestra, type LinhaListaMestra } from "./lista-mestra.js";

const linha: LinhaListaMestra = {
  titulo: 'Contrato "Arcon"; manutenção',
  tipo_nome: "Contrato",
  categoria_caminho: "Jurídico › Contratos",
  versao_atual: 2,
  situacao: "a_vencer",
  aprovacao: "aprovado",
  data_documento: "2026-10-06",
  data_validade: "2027-02-08",
  proxima_revisao: null,
  responsavel_nome: "Ana",
  empresa_nome: null,
  contraparte_nome: "Arcon",
  pendencias_abertas: 1,
  atualizado_em: "2026-11-23T14:00:00Z",
};

describe("lista mestra", () => {
  it("gera CSV com BOM, separador ; e rótulos em português", () => {
    const csv = gerarCsvListaMestra([linha]);
    expect(csv.startsWith("\uFEFFDocumento;Tipo;Pasta;Versão")).toBe(true);
    const [, dados] = csv.trim().split("\r\n");
    expect(dados).toBe('"Contrato ""Arcon""; manutenção";Contrato;Jurídico › Contratos;2;A vencer;Aprovado;06/10/2026;08/02/2027;;Ana;;Arcon;1;23/11/2026');
  });

  it("neutraliza fórmulas e trata vazios", () => {
    expect(celula("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(celula(null)).toBe("");
    expect(celula("linha\nquebrada")).toBe('"linha\nquebrada"');
  });
});
