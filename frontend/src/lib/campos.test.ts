import { describe, expect, it } from "vitest";
import { chaveNfeValida, decodificarChave, lerXmlNfe } from "./campos";

const NFE = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe15261112345678000190550010000012341000012349" versao="4.00">
      <ide><mod>55</mod><serie>1</serie><nNF>1234</nNF><dhEmi>2026-11-20T10:30:00-03:00</dhEmi><natOp>Venda de mercadoria</natOp></ide>
      <emit><CNPJ>12345678000190</CNPJ><xNome>ARCON ENGENHARIA LTDA</xNome></emit>
      <total><ICMSTot><vNF>15750.90</vNF><vTotTrib>1200.50</vTotTrib></ICMSTot></total>
    </infNFe>
  </NFe>
</nfeProc>`;

describe("lerXmlNfe", () => {
  it("lê os dados principais de uma NF-e", () => {
    const nf = lerXmlNfe(NFE);
    expect(nf).toMatchObject({
      chave: "15261112345678000190550010000012341000012349",
      numero: "1234",
      serie: "1",
      emissao: "2026-11-20",
      valor_total: 15750.9,
      cnpj_emitente: "12345678000190",
      nome_emitente: "ARCON ENGENHARIA LTDA",
    });
  });

  it("devolve null quando o XML não é uma nota fiscal", () => {
    expect(lerXmlNfe("<relatorio><item>1</item></relatorio>")).toBeNull();
    expect(lerXmlNfe("isto não é xml")).toBeNull();
  });
});

describe("chave de acesso da NFS-e (50 dígitos)", () => {
  // município(7) ambiente(1) tipo(1) CNPJ(14) nº(13) AAMM(4) código(9) DV(1); DV calculado à parte
  const base = "150140222" + "11222333000181" + "0000000000007" + "2611" + "206698329";
  const dv = (() => {
    let soma = 0;
    let peso = 2;
    for (let i = base.length - 1; i >= 0; i--) {
      soma += Number(base[i]) * peso;
      peso = peso === 9 ? 2 : peso + 1;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  })();
  const chave = base + dv;

  it("aceita 50 dígitos com o DV certo e recusa o errado", () => {
    expect(chaveNfeValida(chave)).toBe(true);
    expect(chaveNfeValida(base + ((dv + 1) % 10))).toBe(false);
  });

  it("não tenta decodificar a chave da NFS-e como se fosse de NF-e", () => {
    expect(decodificarChave(chave)).toBeNull();
  });
});

describe("lerXmlNfe com NFS-e nacional", () => {
  const base = "150140222" + "11222333000181" + "0000000000007" + "2611" + "206698329";
  const dv = (() => {
    let soma = 0;
    let peso = 2;
    for (let i = base.length - 1; i >= 0; i--) {
      soma += Number(base[i]) * peso;
      peso = peso === 9 ? 2 : peso + 1;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  })();
  const chave = base + dv;
  // Estrutura do leiaute nacional: infNFSe (com emit e valores) contendo a DPS enviada pelo prestador.
  const NFSE = `<?xml version="1.0" encoding="UTF-8"?>
<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">
  <infNFSe Id="NFS${chave}">
    <xLocEmi>Belém</xLocEmi><nNFSe>7</nNFSe><dhProc>2026-11-10T18:03:25-03:00</dhProc>
    <emit><CNPJ>11222333000181</CNPJ><xNome>OFICINA DE TI LTDA</xNome></emit>
    <valores><vLiq>150.00</vLiq></valores>
    <DPS versao="1.00"><infDPS Id="DPS1">
      <dhEmi>2026-11-10T18:03:20-03:00</dhEmi><serie>70000</serie><nDPS>5</nDPS>
      <toma><CNPJ>04696357000107</CNPJ><xNome>DIOCESE DE PONTA DE PEDRAS</xNome></toma>
      <serv><cServ><xDescServ>Manutenção de computadores</xDescServ></cServ></serv>
      <valores><vServPrest><vServ>150.00</vServ></vServPrest></valores>
    </infDPS></DPS>
  </infNFSe>
</NFSe>`;

  it("lê chave, número, prestador, data, valor e descrição", () => {
    expect(lerXmlNfe(NFSE)).toMatchObject({
      chave,
      modelo: "NFS-e",
      numero: "7",
      cnpj_emitente: "11222333000181",
      nome_emitente: "OFICINA DE TI LTDA",
      emissao: "2026-11-10",
      valor_total: 150,
      natureza: "Manutenção de computadores",
    });
  });

  it("não confunde o tomador com o prestador", () => {
    expect(lerXmlNfe(NFSE)?.cnpj_emitente).not.toBe("04696357000107");
  });
});
