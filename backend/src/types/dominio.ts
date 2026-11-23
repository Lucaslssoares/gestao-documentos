// Tipos do domínio usados no backend (espelham supabase/migrations).

export const PAPEIS = ["admin", "gestor", "editor", "leitor"] as const;
export type Papel = (typeof PAPEIS)[number];

export const STATUS_DOCUMENTO = ["ativo", "arquivado", "cancelado"] as const;
export const SITUACOES_DOCUMENTO = ["vigente", "a_vencer", "vencido", "sem_validade", "arquivado", "cancelado"] as const;
export const STATUS_PROCESSAMENTO = ["pendente", "processando", "concluido", "sem_texto", "erro"] as const;
export type StatusProcessamento = (typeof STATUS_PROCESSAMENTO)[number];
export const TIPOS_EMPRESA = ["grupo", "fornecedor", "cliente", "parceiro", "orgao_publico", "outro"] as const;

export interface Perfil {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  setor_id: string | null;
  ativo: boolean;
  /** IDs das categorias raiz liberadas (admin acessa todas, independentemente desta lista). */
  categorias: string[];
}

/** Campo personalizado de um tipo de documento. */
export const TIPOS_CAMPO = ["texto", "texto_longo", "numero", "moeda", "data", "booleano", "selecao"] as const;
export type TipoCampo = (typeof TIPOS_CAMPO)[number];

/** Formatos validados de campos de texto. */
export const FORMATOS_CAMPO = ["cnpj", "chave_nfe", "competencia"] as const;
export type FormatoCampo = (typeof FORMATOS_CAMPO)[number];

export interface CampoPersonalizado {
  chave: string;
  rotulo: string;
  tipo: TipoCampo;
  obrigatorio?: boolean;
  opcoes?: string[];
  /** Seção do formulário (ex.: "Valores"). */
  grupo?: string;
  formato?: FormatoCampo;
  ajuda?: string;
  placeholder?: string;
  /** Unidade mostrada no campo (ex.: "dias", "ha"). */
  sufixo?: string;
}

/** Como o cadastro se adapta ao tipo (rótulos, o que não se aplica, sugestões). */
export interface ConfigTipo {
  rotulos?: { data_documento?: string; data_validade?: string; contraparte?: string };
  ocultar?: ("data_validade" | "contraparte")[];
  aviso_padrao_dias?: number;
  validade_padrao_dias?: number;
  dica?: string;
}

export interface TipoDocumento {
  id: string;
  codigo: string;
  nome: string;
  campos: CampoPersonalizado[];
  exige_validade: boolean;
  ativo: boolean;
}

export interface DocumentoArquivo {
  id: string;
  raiz_id: string;
  storage_key: string;
  nome_arquivo: string;
  mime_type: string;
  versao_atual: number;
}
