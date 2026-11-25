import { describe, expect, it } from "vitest";
import { corrigirCitacoes, normalizarCitacoes } from "./local.js";
import { palavrasChave, planejarBusca } from "./local-busca.js";

const HOJE = "2026-11-23";

describe("planejarBusca", () => {
  it("vencimentos com prazo: filtra por tipo e janela de validade, sem buscar trechos", () => {
    const plano = planejarBusca("Quais contratos vencem nos próximos 60 dias?", HOJE);
    expect(plano.documentos).toEqual([{ limite: 10, tipo: "contrato", validade_de: HOJE, validade_ate: "2027-01-22", ordem: "validade" }]);
    expect(plano.conteudo).toBeNull();
    expect(plano.pendencias).toBe(false);
  });

  it("vencidos viram filtro de situação", () => {
    const plano = planejarBusca("Quais certidões estão vencidas?", HOJE);
    expect(plano.documentos[0]).toMatchObject({ tipo: "certidao", situacao: "vencido" });
  });

  it("pergunta de conteúdo busca por palavras e nos trechos", () => {
    const plano = planejarBusca("O que diz a cláusula de multa do contrato com a Norte Log?", HOJE);
    expect(plano.conteudo).toContain("multa");
    // Só a busca por palavras (já filtrada pelo tipo), sem a listagem de todos os contratos.
    expect(plano.documentos).toEqual([{ termo: expect.stringContaining("Norte Log"), tipo: "contrato", ordem: "relevancia", limite: 6 }]);
  });

  it("pendências consultam a central e não os trechos", () => {
    const plano = planejarBusca("Quais são minhas pendências?", HOJE);
    expect(plano.pendencias).toBe(true);
    expect(plano.conteudo).toBeNull();
  });

  it("saudação não consulta nada", () => {
    expect(planejarBusca("Bom dia!", HOJE).saudacao).toBe(true);
  });
});

describe("palavrasChave", () => {
  it("tira palavras vazias e as que viraram filtro, mantendo acentos e códigos", () => {
    expect(palavrasChave("Qual o valor das notas fiscais da AgroPará C-2026-014?", [/\bnotas? fisca(l|is)\b/])).toBe("AgroPará C-2026-014");
  });
});

describe("corrigirCitacoes", () => {
  const fontes = [
    { id: "F1", tipo: "documento" as const, titulo: "Contrato de frete e logística regional — Norte Log", documento_id: "1" },
    { id: "F2", tipo: "documento" as const, titulo: "Contrato de fornecimento de insumos agrícolas — AgroPará", documento_id: "2" },
    { id: "F4", tipo: "trecho" as const, titulo: "Contrato de manutenção predial — Arcon", documento_id: "4" },
  ];

  it("troca a fonte citada pela que a frase menciona", () => {
    expect(corrigirCitacoes("O valor do contrato com a AgroPará é de R$ 920.000,00 [F4].", fontes)).toBe(
      "O valor do contrato com a AgroPará é de R$ 920.000,00 [F2].",
    );
  });

  it("corrige citação colocada depois do ponto final", () => {
    expect(corrigirCitacoes("Se a Arcon descumprir, paga multa de 10%. [F2]", fontes)).toBe("Se a Arcon descumprir, paga multa de 10%. [F4]");
  });

  it("mantém citação certa ou sem nome mencionado", () => {
    const texto = "- Norte Log vence em 15/12/2026 [F1]\n- Sem nome aqui [F4].";
    expect(corrigirCitacoes(texto, fontes)).toBe(texto);
  });
});

describe("normalizarCitacoes", () => {
  it("separa citações agrupadas", () => {
    expect(normalizarCitacoes("vence em 10/10 [F1, F2] e [F3; 4]")).toBe("vence em 10/10 [F1] [F2] e [F3] [F4]");
  });
});
