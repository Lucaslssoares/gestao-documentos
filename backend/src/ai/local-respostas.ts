import type { CampoPersonalizado, ConfigTipo } from "../types/dominio.js";
import { decodificarChaveAcesso, type Atributo } from "./local-busca.js";

/**
 * Respostas do assistente local montadas direto dos dados (sem modelo): instantâneas e
 * sem risco de o modelo pequeno trocar valores, datas ou nomes.
 */

/** Linha de v_documentos usada nas fichas. */
export interface DocumentoFicha {
  id: string;
  titulo: string;
  tipo_nome: string;
  categoria_caminho: string;
  empresa_nome: string | null;
  contraparte_nome: string | null;
  responsavel_nome: string | null;
  data_documento: string | null;
  data_validade: string | null;
  situacao: string;
  dias_para_vencer: number | null;
  metadados: Record<string, unknown>;
  aprovacao: string | null;
  aprovador_nome: string | null;
  pendencias_abertas: number | null;
  status_processamento: string | null;
}

export interface TipoFicha {
  campos: CampoPersonalizado[];
  config: ConfigTipo | null;
}

const SITUACAO: Record<string, string> = {
  vigente: "vigente",
  a_vencer: "a vencer",
  vencido: "vencido",
  sem_validade: "sem validade",
  arquivado: "arquivado",
  cancelado: "cancelado",
};

export const dataBr = (iso: unknown) =>
  typeof iso === "string" && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10).split("-").reverse().join("/") : null;
const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const cnpj = (d: string) => (d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : d);

/** Valor de um campo do tipo, formatado como na tela. */
export function formatarCampoFicha(campo: CampoPersonalizado, valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === "") return null;
  if (campo.tipo === "moeda" && typeof valor === "number") return reais(valor);
  if (campo.tipo === "booleano") return valor ? "Sim" : "Não";
  if (campo.tipo === "data") return dataBr(valor) ?? String(valor);
  const texto = String(valor);
  const digitos = texto.replace(/\D/g, "");
  if (campo.formato === "cnpj") return cnpj(digitos);
  if (campo.formato === "chave_nfe") return digitos.replace(/(\d{4})(?=\d)/g, "$1 ");
  if (campo.formato === "competencia" && digitos.length === 6) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  return `${texto}${campo.sufixo ? ` ${campo.sufixo}` : ""}`;
}

function prazo(d: DocumentoFicha): string {
  if (!d.data_validade) return "sem data de validade";
  const dias = d.dias_para_vencer;
  if (dias === null) return `validade ${dataBr(d.data_validade)}`;
  if (dias < 0) return `venceu em ${dataBr(d.data_validade)} (há ${-dias} ${-dias === 1 ? "dia" : "dias"})`;
  if (dias === 0) return `vence hoje (${dataBr(d.data_validade)})`;
  return `vence em ${dataBr(d.data_validade)} (faltam ${dias} ${dias === 1 ? "dia" : "dias"})`;
}

/** Ficha do documento, com a resposta ao dado pedido em destaque na primeira linha. */
export function respostaDeFicha(opcoes: {
  doc: DocumentoFicha;
  tipo: TipoFicha;
  atributo: Atributo;
  fonte: string;
  outros?: { titulo: string; fonte: string }[];
}): string {
  const { doc, tipo, atributo, fonte } = opcoes;
  const config = tipo.config ?? {};
  const oculto = new Set(config.ocultar ?? []);
  const rotulo = (campo: "data_documento" | "data_validade" | "contraparte", padrao: string) => config.rotulos?.[campo] ?? padrao;
  const nome = `**${doc.titulo}**`;

  // 1. Resposta direta ao que foi perguntado.
  let destaque: string;
  switch (atributo) {
    case "valor": {
      const campos = tipo.campos.filter((c) => c.tipo === "moeda" && typeof doc.metadados[c.chave] === "number");
      const principal = campos.find((c) => /total|global|valor$/.test(c.chave)) ?? campos[0];
      destaque = principal
        ? `${principal.rotulo} de ${nome}: **${reais(doc.metadados[principal.chave] as number)}** [${fonte}].`
        : `${nome} não tem valor cadastrado [${fonte}].`;
      break;
    }
    case "validade":
      destaque = oculto.has("data_validade") ? `${nome} não tem validade (${doc.tipo_nome.toLowerCase()}) [${fonte}].` : `${nome}: **${prazo(doc)}** [${fonte}].`;
      break;
    case "responsavel":
      destaque = doc.responsavel_nome ? `O responsável por ${nome} é **${doc.responsavel_nome}** [${fonte}].` : `${nome} está sem responsável definido [${fonte}].`;
      break;
    case "contraparte": {
      const papel = rotulo("contraparte", "Contraparte");
      destaque = doc.contraparte_nome ? `${papel} de ${nome}: **${doc.contraparte_nome}** [${fonte}].` : `${nome} não tem ${papel.toLowerCase()} cadastrado [${fonte}].`;
      break;
    }
    case "numero": {
      const numero = doc.metadados.numero;
      destaque = numero ? `Número de ${nome}: **${String(numero)}** [${fonte}].` : `${nome} não tem número cadastrado [${fonte}].`;
      break;
    }
    default:
      destaque = `${nome} [${fonte}]`;
  }

  // 2. Ficha completa.
  const linhas: string[] = [`- **Tipo:** ${doc.tipo_nome} — ${doc.categoria_caminho}`];
  if (doc.contraparte_nome && !oculto.has("contraparte")) linhas.push(`- **${rotulo("contraparte", "Contraparte")}:** ${doc.contraparte_nome}`);
  if (doc.empresa_nome) linhas.push(`- **Empresa:** ${doc.empresa_nome}`);
  if (doc.data_documento) linhas.push(`- **${rotulo("data_documento", "Data do documento")}:** ${dataBr(doc.data_documento)}`);
  if (!oculto.has("data_validade")) linhas.push(`- **${rotulo("data_validade", "Validade")}:** ${prazo(doc)}`);
  else linhas.push(`- **Situação:** ${SITUACAO[doc.situacao] ?? doc.situacao}`);
  if (doc.responsavel_nome) linhas.push(`- **Responsável:** ${doc.responsavel_nome}`);
  for (const campo of tipo.campos) {
    const valor = formatarCampoFicha(campo, doc.metadados[campo.chave]);
    if (valor) linhas.push(`- **${campo.rotulo}:** ${valor}`);
  }
  if (doc.aprovacao === "pendente") linhas.push(`- **Aprovação:** aguardando ${doc.aprovador_nome ?? "o aprovador"}`);
  if (doc.aprovacao === "reprovado") linhas.push("- **Aprovação:** reprovado");
  if (doc.pendencias_abertas) linhas.push(`- **Pendências abertas:** ${doc.pendencias_abertas}`);
  if (doc.status_processamento === "erro") linhas.push('- ⚠️ O texto do arquivo não foi totalmente indexado: use "Reprocessar" na tela do documento.');

  const partes = [destaque, "", ...linhas];
  if (opcoes.outros?.length) {
    partes.push("", `Outros documentos parecidos: ${opcoes.outros.map((o) => `${o.titulo} [${o.fonte}]`).join(" · ")}`);
  }
  return partes.join("\n");
}

/** Chave sem documento no sistema: diz o que a própria chave informa. */
export function respostaChaveNaoEncontrada(chave: string): string {
  const dados = decodificarChaveAcesso(chave);
  const inicio = "Não encontrei nenhuma nota com essa chave de acesso nas pastas que você acessa.";
  if (!dados) return inicio;
  const linhas = [
    `- **Modelo:** ${dados.modelo}`,
    `- **Número:** ${dados.numero}${dados.serie ? ` (série ${dados.serie})` : ""}`,
    `- **CNPJ do emitente:** ${cnpj(dados.cnpj)}`,
    `- **Emissão (mês):** ${dados.competencia}`,
    `- **Local:** ${dados.municipio_ou_uf}`,
  ];
  return `${inicio} Pela própria chave, ela é:\n\n${linhas.join("\n")}\n\nSe for uma nota da empresa, cadastre o PDF ou o XML em "Novo documento": os dados são preenchidos sozinhos.`;
}
