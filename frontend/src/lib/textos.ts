import type { EventoHistorico, TipoEmpresa } from "./tipos";

export const ROTULO_TIPO_EMPRESA: Record<TipoEmpresa, string> = {
  grupo: "Empresa do grupo",
  fornecedor: "Fornecedor",
  cliente: "Cliente",
  parceiro: "Parceiro",
  orgao_publico: "Órgão público",
  outro: "Outro",
};

export function formatarCnpj(cnpj: string | null): string {
  if (!cnpj || cnpj.length !== 14) return cnpj ?? "";
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}

/** Chave técnica de um campo personalizado a partir do rótulo: "Valor total" → "valor_total". */
export function gerarChaveCampo(rotulo: string): string {
  return rotulo
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "c_$1")
    .slice(0, 40);
}

/** Indenta XML (ex.: NF-e) para leitura; outros textos voltam como estão. */
export function formatarXml(conteudo: string): string {
  const texto = conteudo.trim();
  if (!texto.startsWith("<")) return conteudo;
  let nivel = 0;
  return texto
    .replace(/>\s*</g, ">\n<")
    .split("\n")
    .map((linha) => {
      const fecha = linha.startsWith("</");
      const completa = /^<[^>]+>.*<\/[^>]+>$/.test(linha); // <b>1</b>
      const autoFechada = linha.endsWith("/>");
      const declaracao = /^<[?!]/.test(linha);
      if (fecha) nivel = Math.max(nivel - 1, 0);
      const saida = "  ".repeat(nivel) + linha;
      if (linha.startsWith("<") && !fecha && !completa && !autoFechada && !declaracao) nivel++;
      return saida;
    })
    .join("\n");
}

const NOMES_CAMPOS: Record<string, string> = {
  titulo: "título",
  descricao: "descrição",
  tipo_id: "tipo",
  categoria_id: "categoria",
  empresa_id: "empresa",
  filial_id: "filial",
  setor_id: "setor",
  contraparte_id: "contraparte",
  responsavel_id: "responsável",
  data_documento: "data do documento",
  data_validade: "validade",
  status: "status",
  metadados: "campos do tipo",
};

/** Resumo legível dos detalhes de um evento do histórico. */
export function detalheEvento(evento: EventoHistorico): string | null {
  const d = evento.detalhes;
  switch (evento.acao) {
    case "adicionar_tag":
    case "remover_tag":
      return typeof d.tag === "string" ? d.tag : null;
    case "mover": {
      const categoria = d.categoria as { de?: string; para?: string } | undefined;
      return categoria ? `${categoria.de ?? "?"} → ${categoria.para ?? "?"}` : null;
    }
    case "substituir_arquivo": {
      const versao = d.versao as { de?: number; para?: number } | undefined;
      const arquivo = d.arquivo as { para?: string } | undefined;
      return versao ? `versão ${versao.de} → ${versao.para}${arquivo?.para ? ` (${arquivo.para})` : ""}` : null;
    }
    case "atualizar": {
      const campos = Object.keys(d)
        .map((k) => NOMES_CAMPOS[k])
        .filter(Boolean);
      return campos.length ? campos.join(", ") : null;
    }
    case "visualizar":
    case "baixar":
      return typeof d.versao === "number" ? `versão ${d.versao}` : null;
    default:
      return null;
  }
}
