// Tipos das respostas da API (espelham o backend).

export type Papel = "admin" | "gestor" | "editor" | "leitor";
export type Situacao = "vigente" | "a_vencer" | "vencido" | "sem_validade" | "arquivado" | "cancelado";
export type StatusProcessamento = "pendente" | "processando" | "concluido" | "sem_texto" | "erro";
export type TipoCampo = "texto" | "texto_longo" | "numero" | "moeda" | "data" | "booleano" | "selecao";
export type TipoEmpresa = "grupo" | "fornecedor" | "cliente" | "parceiro" | "orgao_publico" | "outro";

export interface Perfil {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  setor_id: string | null;
  ativo: boolean;
  categorias: string[];
}

export interface Categoria {
  id: string;
  parent_id: string | null;
  raiz_id: string;
  nivel: number;
  nome: string;
  descricao: string | null;
  icone: string | null;
  cor: string | null;
  ordem: number;
  ativo: boolean;
  total: number;
  filhos: Categoria[];
}

export interface CampoPersonalizado {
  chave: string;
  rotulo: string;
  tipo: TipoCampo;
  obrigatorio?: boolean;
  opcoes?: string[];
}

export interface TipoDocumento {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  categoria_padrao_id: string | null;
  campos: CampoPersonalizado[];
  exige_validade: boolean;
  ativo: boolean;
  ordem: number;
}

export interface Filial {
  id: string;
  nome: string;
  codigo: string | null;
  cidade: string | null;
  uf: string | null;
  ativo: boolean;
}

export interface Empresa {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  tipo: TipoEmpresa;
  email: string | null;
  telefone: string | null;
  ativo: boolean;
  filiais: Filial[];
}

export interface Setor {
  id: string;
  nome: string;
  sigla: string | null;
  ativo: boolean;
}

export interface Tag {
  id: string;
  nome: string;
  cor: string | null;
}

export interface MembroEquipe {
  id: string;
  nome: string;
}

/** Linha da pesquisa / listagens (v_documentos). */
export interface DocumentoResumo {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo_id: string;
  tipo_codigo: string;
  tipo_nome: string;
  categoria_id: string;
  categoria_nome: string;
  categoria_caminho: string;
  raiz_id: string;
  raiz_nome: string;
  raiz_icone: string | null;
  raiz_cor: string | null;
  empresa_id: string | null;
  empresa_nome: string | null;
  filial_id: string | null;
  filial_nome: string | null;
  setor_id: string | null;
  setor_nome: string | null;
  contraparte_id: string | null;
  contraparte_nome: string | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  data_documento: string | null;
  data_validade: string | null;
  status: "ativo" | "arquivado" | "cancelado";
  situacao: Situacao;
  dias_para_vencer: number | null;
  metadados: Record<string, unknown>;
  tags: Tag[];
  versao_atual: number;
  nome_arquivo: string;
  mime_type: string;
  tamanho_bytes: number;
  status_processamento: StatusProcessamento;
  erro_processamento: string | null;
  paginas: number | null;
  criado_por_nome: string | null;
  criado_em: string;
  atualizado_em: string;
  relevancia?: number;
  encontrado_no_conteudo?: boolean;
}

export interface Versao {
  id: string;
  versao: number;
  nome_arquivo: string;
  mime_type: string;
  tamanho_bytes: number;
  comentario: string | null;
  enviado_em: string;
}

export interface DocumentoDetalhe extends DocumentoResumo {
  tipo: Pick<TipoDocumento, "id" | "nome" | "campos" | "exige_validade">;
  versoes: Versao[];
  permissoes: { editar: boolean; excluir: boolean };
}

export interface ResultadoPesquisa {
  total: number;
  itens: DocumentoResumo[];
}

export interface EventoHistorico {
  id: number;
  acao: string;
  entidade: string;
  entidade_id: string | null;
  documento_id: string | null;
  detalhes: Record<string, unknown>;
  criado_em: string;
  ator_nome: string;
}

export interface Painel {
  resumo: {
    documentos: number;
    vencendo: number;
    vencidos: number;
    em_processamento: number;
    erros_processamento: number;
    pendencias: number;
    enviados_ultimos_30d: number;
  };
  categorias: { id: string; nome: string; icone: string | null; cor: string | null; total: number }[];
  recentes: DocumentoResumo[];
  vencimentos: DocumentoResumo[];
}

export interface Fonte {
  id: string;
  tipo: "documento" | "trecho";
  titulo: string;
  detalhe?: string;
  documento_id: string;
  pagina?: number | null;
  trecho?: string;
}

export interface MensagemChat {
  id?: number;
  papel: "user" | "assistant";
  conteudo: string;
  fontes: Fonte[];
}

export interface UsuarioAdmin extends Omit<Perfil, "categorias"> {
  categorias: string[];
  criado_em: string;
}
