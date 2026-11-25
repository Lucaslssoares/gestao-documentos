import { describe, expect, it } from "vitest";
import { chaveNfeValida, lerDanfe, lerNotaFiscalPdf } from "./danfe.js";

/** Monta uma chave de 44 dígitos com o DV correto (cálculo independente do código testado). */
function chaveCom(base43: string): string {
  const pesos = [2, 3, 4, 5, 6, 7, 8, 9];
  const soma = [...base43].reverse().reduce((s, d, i) => s + Number(d) * pesos[i % 8]!, 0);
  const resto = soma % 11;
  return base43 + String(resto < 2 ? 0 : 11 - resto);
}

// UF 15 · 2026-11 · CNPJ 12345678000190 · modelo 55 · série 001 · nº 000001234 · emissão normal + código
const CHAVE = chaveCom("1526111234567800019055001000001234100001234");
const AGRUPADA = CHAVE.replace(/(\d{4})/g, "$1 ").trim();

const DANFE = `RECEBEMOS DE ARCON ENGENHARIA LTDA OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA ABAIXO
DANFE Documento Auxiliar da Nota Fiscal Eletrônica
CHAVE DE ACESSO
${AGRUPADA}
DATA DA EMISSÃO
20/11/2026
CÁLCULO DO IMPOSTO
VALOR TOTAL DA NOTA
15.750,90`;

describe("chaveNfeValida", () => {
  it("confere o dígito verificador", () => {
    expect(chaveNfeValida(CHAVE)).toBe(true);
    expect(chaveNfeValida(CHAVE.slice(0, 43) + ((Number(CHAVE[43]) + 1) % 10))).toBe(false);
    expect(chaveNfeValida("123")).toBe(false);
  });
});

describe("lerDanfe", () => {
  it("lê número, série, emitente, data e valor de um DANFE", () => {
    expect(lerDanfe(DANFE)).toMatchObject({
      chave: CHAVE,
      modelo: "NF-e (55)",
      numero: "1234",
      serie: "1",
      cnpj_emitente: "12345678000190",
      nome_emitente: "ARCON ENGENHARIA LTDA",
      emissao: "2026-11-20",
      valor_total: 15750.9,
    });
  });

  it("aceita a chave impressa sem espaços e funciona sem valor nem data", () => {
    const nf = lerDanfe(`CHAVE DE ACESSO ${CHAVE}`);
    expect(nf).toMatchObject({ chave: CHAVE, numero: "1234", emissao: null, valor_total: null, nome_emitente: "" });
  });

  it("devolve null quando não há chave válida", () => {
    expect(lerDanfe("Contrato de manutenção predial, vigência de 12 meses.")).toBeNull();
    expect(lerDanfe(`CHAVE ${CHAVE.slice(0, 43)}0`.replace(/0$/, String((Number(CHAVE[43]) + 1) % 10)))).toBeNull();
  });
});

// NFS-e nacional: município(7) ambiente(1) tipo(1) CNPJ(14) nº(13) AAMM(4) código(9) DV(1)
const CHAVE_NFSE = chaveCom("150140222" + "11222333000181" + "0000000000007" + "2611" + "206698329");

const DANFSE = `DANFSe v2.0
Documento Auxiliar da NFS-e
CHAVE DE ACESSO DA NFS-e
${CHAVE_NFSE}
NÚMERO DA NFS-e
7
DATA E HORA DA EMISSÃO DA NFS-e
10/11/2026 18:03:20
PRESTADOR / FORNECEDOR CNPJ / CPF / NIF
11.222.333/0001-81
Nome / Nome Empresarial
OFICINA DE TI LTDA
Município / Sigla UF
Belém / PA
Descrição do Serviço
Manutenção de computadores, como limpeza e troca de periféricos
TRIBUTAÇÃO MUNICIPAL (ISSQN) Tipo de Tributação do ISSQN
VALOR TOTAL DA NFS-e VALOR DA OPERAÇÃO / SERVIÇO
R$ 150,00
Desconto Incondicionado`;

describe("lerNotaFiscalPdf com NFS-e", () => {
  it("valida a chave de 50 dígitos", () => {
    expect(CHAVE_NFSE).toHaveLength(50);
    expect(chaveNfeValida(CHAVE_NFSE)).toBe(true);
    expect(chaveNfeValida(CHAVE_NFSE.slice(0, 49) + ((Number(CHAVE_NFSE[49]) + 1) % 10))).toBe(false);
  });

  it("lê número, prestador, data, valor e descrição do DANFSe", () => {
    expect(lerNotaFiscalPdf(DANFSE)).toMatchObject({
      chave: CHAVE_NFSE,
      modelo: "NFS-e",
      numero: "7",
      cnpj_emitente: "11222333000181",
      nome_emitente: "OFICINA DE TI LTDA",
      emissao: "2026-11-10",
      valor_total: 150,
      natureza: "Manutenção de computadores, como limpeza e troca de periféricos",
    });
  });

  it("continua lendo DANFE de produto e ignorando outros textos", () => {
    expect(lerNotaFiscalPdf(DANFE)?.modelo).toBe("NF-e (55)");
    expect(lerNotaFiscalPdf("Contrato de manutenção")).toBeNull();
  });
});
