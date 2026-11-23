/**
 * Lista mestra: relação dos documentos controlados (versão, situação, aprovação, prazos),
 * em CSV que o Excel em português abre direto (separador ";" e BOM UTF-8).
 */

export interface LinhaListaMestra {
  titulo: string;
  tipo_nome: string;
  categoria_caminho: string;
  versao_atual: number;
  situacao: string;
  aprovacao: string;
  data_documento: string | null;
  data_validade: string | null;
  proxima_revisao: string | null;
  responsavel_nome: string | null;
  empresa_nome: string | null;
  contraparte_nome: string | null;
  pendencias_abertas: number;
  atualizado_em: string;
}

const SITUACAO: Record<string, string> = {
  vigente: "Vigente",
  a_vencer: "A vencer",
  vencido: "Vencido",
  sem_validade: "Sem validade",
  arquivado: "Arquivado",
  cancelado: "Cancelado",
};
const APROVACAO: Record<string, string> = { nao_exige: "Não exige", pendente: "Em aprovação", aprovado: "Aprovado", reprovado: "Reprovado" };

const data = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");

/** Escapa uma célula: aspas, separador e quebra de linha; neutraliza fórmulas (=, +, -, @). */
export function celula(valor: unknown): string {
  let texto = valor === null || valor === undefined ? "" : String(valor);
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

const COLUNAS: [string, (l: LinhaListaMestra) => unknown][] = [
  ["Documento", (l) => l.titulo],
  ["Tipo", (l) => l.tipo_nome],
  ["Pasta", (l) => l.categoria_caminho],
  ["Versão", (l) => l.versao_atual],
  ["Situação", (l) => SITUACAO[l.situacao] ?? l.situacao],
  ["Aprovação", (l) => APROVACAO[l.aprovacao] ?? l.aprovacao],
  ["Data do documento", (l) => data(l.data_documento)],
  ["Validade", (l) => data(l.data_validade)],
  ["Próxima revisão", (l) => data(l.proxima_revisao)],
  ["Responsável", (l) => l.responsavel_nome],
  ["Empresa", (l) => l.empresa_nome],
  ["Contraparte", (l) => l.contraparte_nome],
  ["Pendências abertas", (l) => l.pendencias_abertas],
  ["Atualizado em", (l) => data(l.atualizado_em)],
];

export function gerarCsvListaMestra(linhas: LinhaListaMestra[]): string {
  const cabecalho = COLUNAS.map(([nome]) => celula(nome)).join(";");
  const corpo = linhas.map((l) => COLUNAS.map(([, valor]) => celula(valor(l))).join(";"));
  return `\uFEFF${[cabecalho, ...corpo].join("\r\n")}\r\n`;
}
