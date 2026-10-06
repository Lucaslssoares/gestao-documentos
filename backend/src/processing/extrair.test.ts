import { describe, expect, it } from "vitest";
import { pdfSimples } from "../lib/pdf-simples.js";
import { extrairTexto, limparTexto, temTextoUtil, xmlParaTexto } from "./extrair.js";

describe("extrairTexto", () => {
  it("extrai o texto de um PDF página a página (com acentos)", async () => {
    const pdf = pdfSimples([["Cláusula primeira do contrato", "Objeto: manutenção"], ["Rescisão por inadimplemento (multa)"]]);
    const resultado = await extrairTexto(pdf, "application/pdf");
    expect(resultado.totalPaginas).toBe(2);
    expect(resultado.paginas[0]).toMatchObject({ numero: 1 });
    expect(resultado.paginas[0]!.texto).toContain("Cláusula primeira");
    expect(resultado.paginas[0]!.texto).toContain("manutenção");
    expect(resultado.paginas[1]!.texto).toContain("Rescisão por inadimplemento (multa)");
  });

  it("lê texto puro", async () => {
    const resultado = await extrairTexto(Buffer.from("Linha 1\r\n\r\n\r\n\r\nLinha 2"), "text/plain");
    expect(resultado.paginas).toEqual([{ numero: null, texto: "Linha 1\n\nLinha 2" }]);
  });

  it("devolve vazio para imagens (sem OCR no MVP)", async () => {
    const resultado = await extrairTexto(Buffer.from([0x89, 0x50, 0x4e, 0x47]), "image/png");
    expect(resultado.paginas).toEqual([]);
    expect(temTextoUtil(resultado)).toBe(false);
  });
});

describe("xmlParaTexto", () => {
  it("transforma uma NF-e em linhas campo: valor, sem a assinatura digital", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <nfeProc xmlns="http://www.portalfiscal.inf.br/nfe">
        <NFe><infNFe Id="NFe15260923456789000101550010000012071000012074">
          <ide><nNF>1207</nNF><serie>1</serie></ide>
          <emit><CNPJ>23456789000101</CNPJ><xNome>Norte Log Transportes</xNome></emit>
          <total><ICMSTot><vNF>13000.00</vNF></ICMSTot></total>
        </infNFe>
        <Signature><SignatureValue>abc</SignatureValue></Signature></NFe>
      </nfeProc>`;
    const texto = xmlParaTexto(xml);
    expect(texto).toContain("ide.nNF: 1207");
    expect(texto).toContain("emit.xNome: Norte Log Transportes");
    expect(texto).toContain("ICMSTot.vNF: 13000.00");
    expect(texto).toContain("infNFe.Id: NFe15260923456789000101550010000012071000012074");
    expect(texto).not.toContain("SignatureValue");
  });
});

describe("limparTexto", () => {
  it("remove \\u0000 (inválido no Postgres) e espaços extras", () => {
    expect(limparTexto("a\u0000b   c\t\td")).toBe("ab c d");
  });
});
