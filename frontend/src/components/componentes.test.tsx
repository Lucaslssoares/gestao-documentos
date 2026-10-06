import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TextoResposta } from "./assistente/TextoResposta";
import { CamposPersonalizados } from "./documentos/CamposPersonalizados";
import { SituacaoBadge } from "./documentos/Indicadores";
import { detalheEvento, formatarXml, gerarChaveCampo } from "../lib/textos";

describe("SituacaoBadge", () => {
  it("mostra a situação e o prazo", () => {
    render(<SituacaoBadge situacao="a_vencer" dias={10} detalhado />);
    expect(screen.getByText("A vencer")).toBeInTheDocument();
    expect(screen.getByText(/vence em 10 dias/)).toBeInTheDocument();
  });
});

describe("CamposPersonalizados", () => {
  it("renderiza os campos do tipo e devolve valores tipados", () => {
    const aoMudar = vi.fn();
    render(
      <CamposPersonalizados
        campos={[
          { chave: "numero", rotulo: "Número", tipo: "texto", obrigatorio: true },
          { chave: "valor_total", rotulo: "Valor total", tipo: "moeda" },
          { chave: "forma", rotulo: "Forma", tipo: "selecao", opcoes: ["PIX", "Boleto"] },
        ]}
        valores={{}}
        aoMudar={aoMudar}
      />,
    );
    expect(screen.getByLabelText(/Número/)).toBeRequired();
    fireEvent.change(screen.getByLabelText("Valor total"), { target: { value: "1500.5" } });
    expect(aoMudar).toHaveBeenCalledWith("valor_total", 1500.5);
    fireEvent.change(screen.getByLabelText("Forma"), { target: { value: "PIX" } });
    expect(aoMudar).toHaveBeenCalledWith("forma", "PIX");
  });
});

describe("TextoResposta", () => {
  it("transforma citações em botões ligados às fontes e ignora ids desconhecidos", () => {
    const aoClicar = vi.fn();
    const fonte = { id: "F1", tipo: "documento" as const, titulo: "Contrato C-2026-014", documento_id: "doc-1" };
    render(<TextoResposta texto={"O contrato vence em **15/10/2026** [F1] [F9].\n\n- item A\n- item B"} fontes={[fonte]} aoClicarFonte={aoClicar} />);

    expect(screen.getByText("15/10/2026").tagName).toBe("STRONG");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    const botoes = screen.getAllByRole("button");
    expect(botoes).toHaveLength(1);
    fireEvent.click(botoes[0]!);
    expect(aoClicar).toHaveBeenCalledWith(fonte);
  });
});

describe("utilitários", () => {
  it("gera a chave técnica de um campo a partir do rótulo", () => {
    expect(gerarChaveCampo("Valor total (R$)")).toBe("valor_total_r");
    expect(gerarChaveCampo("Nº do Contrato")).toBe("n_do_contrato");
  });

  it("descreve eventos do histórico", () => {
    expect(
      detalheEvento({ id: 1, acao: "mover", entidade: "documento", entidade_id: null, documento_id: null, criado_em: "", ator_nome: "x", detalhes: { categoria: { de: "Jurídico", para: "Financeiro" } } }),
    ).toBe("Jurídico → Financeiro");
  });

  it("indenta XML para leitura", () => {
    expect(formatarXml("<a><b>1</b></a>")).toBe("<a>\n  <b>1</b>\n</a>");
  });
});
