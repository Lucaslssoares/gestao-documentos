import { describe, expect, it } from "vitest";
import { pontosDeAtencao, type DocumentoParaAtencao } from "./atencao.js";

const base: DocumentoParaAtencao = {
  data_validade: "2027-06-01",
  situacao: "vigente",
  dias_para_vencer: 190,
  responsavel_id: "u1",
  proxima_revisao: null,
  aprovacao: "nao_exige",
  aprovacao_solicitada_em: null,
  comentario_aprovacao: null,
  status_processamento: "concluido",
  metadados: { numero: "C-1" },
  tipo: { nome: "Contrato", exige_validade: true, campos: [{ chave: "numero", rotulo: "Número", tipo: "texto", obrigatorio: true }] },
  pendencias: [],
};
const codigos = (doc: Partial<DocumentoParaAtencao>) => pontosDeAtencao({ ...base, ...doc }, "2026-11-23").map((p) => p.codigo);

describe("pontosDeAtencao", () => {
  it("documento completo não tem pontos", () => {
    expect(codigos({})).toEqual([]);
  });

  it("vencido sem prazo de renovação pede um prazo; com prazo aberto não", () => {
    expect(codigos({ situacao: "vencido", data_validade: "2026-11-01" })).toContain("sem_plano_renovacao");
    expect(codigos({ situacao: "vencido", data_validade: "2026-11-01", pendencias: [{ prazo: "2026-12-10", concluida_em: null }] })).not.toContain(
      "sem_plano_renovacao",
    );
  });

  it("aponta validade exigida, campo obrigatório vazio e falta de responsável", () => {
    expect(codigos({ data_validade: null, metadados: {}, responsavel_id: null })).toEqual(["sem_validade", "campos_obrigatorios", "sem_responsavel"]);
  });

  it("pendências atrasadas e revisão atrasada", () => {
    const r = codigos({ proxima_revisao: "2026-10-01", pendencias: [{ prazo: "2026-11-01", concluida_em: null }, { prazo: "2026-11-01", concluida_em: "x" }] });
    expect(r).toEqual(["pendencias_atrasadas", "revisao_atrasada"]);
  });

  it("aprovação parada há mais de 7 dias e reprovação com comentário", () => {
    expect(codigos({ aprovacao: "pendente", aprovacao_solicitada_em: "2026-11-10T10:00:00Z" })).toContain("aprovacao_parada");
    expect(codigos({ aprovacao: "pendente", aprovacao_solicitada_em: "2026-11-20T10:00:00Z" })).not.toContain("aprovacao_parada");
    const [reprovado] = pontosDeAtencao({ ...base, aprovacao: "reprovado", comentario_aprovacao: "Falta assinatura" }, "2026-11-23");
    expect(reprovado?.texto).toContain("Falta assinatura");
  });

  it("problemas de indexação viram informação", () => {
    expect(codigos({ status_processamento: "sem_texto" })).toEqual(["sem_texto"]);
  });
});
