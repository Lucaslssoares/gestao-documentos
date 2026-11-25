import { describe, expect, it } from "vitest";
import { corrigirCitacoes, normalizarCitacoes } from "./local.js";
import { decodificarChaveAcesso, palavrasChave, planejarBusca } from "./local-busca.js";
import { respostaDeFicha } from "./local-respostas.js";

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

describe("fichas sem modelo", () => {
  it("chave de acesso com prefixo e espaços vira busca exata", () => {
    const plano = planejarBusca("Me informe sobre essa nota : NFS15014022266604354000153000000000000226112066983292", HOJE);
    expect(plano).toMatchObject({ chave: "15014022266604354000153000000000000226112066983292", ficha: "geral", documentos: [], conteudo: null });
    expect(planejarBusca("valor da nota 3526 1011 2223 3300 0181 5500 1000 0012 3410 0012 3453", HOJE)).toMatchObject({
      chave: "35261011222333000181550010000012341000123453",
      ficha: "valor",
    });
  });

  it("dado de um documento vira ficha; texto do arquivo continua com o modelo", () => {
    expect(planejarBusca("Qual o valor do contrato com a AgroPará?", HOJE)).toMatchObject({ ficha: "valor", conteudo: null });
    expect(planejarBusca("Quando vence o contrato da Norte Log?", HOJE)).toMatchObject({ ficha: "validade" });
    expect(planejarBusca("Quem é o responsável pelo contrato da Arcon?", HOJE)).toMatchObject({ ficha: "responsavel" });
    expect(planejarBusca("O que diz a cláusula de multa do contrato com a Norte Log?", HOJE).ficha).toBeUndefined();
    expect(planejarBusca("Quais contratos vencem nos próximos 60 dias?", HOJE).ficha).toBeUndefined();
  });

  it("decodifica chaves de NF-e e NFS-e", () => {
    expect(decodificarChaveAcesso("15014022266604354000153000000000000226112066983292")).toEqual({
      modelo: "NFS-e",
      municipio_ou_uf: "Belém/PA",
      cnpj: "66604354000153",
      numero: "2",
      competencia: "11/2026",
    });
    expect(decodificarChaveAcesso("35261011222333000181550010000012341000123453")).toMatchObject({ modelo: "NF-e", municipio_ou_uf: "SP", numero: "1234", serie: "1", competencia: "10/2026" });
  });

  it("ficha destaca o dado pedido com os rótulos do tipo", () => {
    const texto = respostaDeFicha({
      doc: {
        id: "1",
        titulo: "NFS-e 2 — Alan",
        tipo_nome: "Nota fiscal",
        categoria_caminho: "Financeiro › Notas Fiscais",
        empresa_nome: null,
        contraparte_nome: "Alan dos Anjos Leão",
        responsavel_nome: null,
        data_documento: "2026-11-10",
        data_validade: null,
        situacao: "sem_validade",
        dias_para_vencer: null,
        metadados: { valor_total: 150, cnpj_emitente: "66604354000153" },
        aprovacao: "nao_exige",
        aprovador_nome: null,
        pendencias_abertas: 0,
        status_processamento: "concluido",
      },
      tipo: {
        campos: [
          { chave: "valor_total", rotulo: "Valor total", tipo: "moeda" },
          { chave: "cnpj_emitente", rotulo: "CNPJ do emitente", tipo: "texto", formato: "cnpj" },
        ],
        config: { rotulos: { contraparte: "Emitente", data_documento: "Data de emissão" }, ocultar: ["data_validade"] },
      },
      atributo: "valor",
      fonte: "F1",
    });
    expect(texto.split("\n")[0]?.replace(/\s/g, " ")).toBe("Valor total de **NFS-e 2 — Alan**: **R$ 150,00** [F1].");
    expect(texto).toContain("- **Emitente:** Alan dos Anjos Leão");
    expect(texto).toContain("- **Data de emissão:** 10/11/2026");
    expect(texto).toContain("- **CNPJ do emitente:** 66.604.354/0001-53");
  });
});
