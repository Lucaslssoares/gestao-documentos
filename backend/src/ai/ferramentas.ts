import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { logger } from "../lib/logger.js";
import { somenteDigitos, termoSeguro } from "../lib/http.js";
import type { ProvedorEmbeddings } from "../processing/embeddings.js";
import { SITUACOES_DOCUMENTO, type CampoPersonalizado } from "../types/dominio.js";
import type { RegistroFontes } from "./fontes.js";

/**
 * Ferramentas do AI Orchestrator. TODAS são somente leitura e usam o cliente Supabase
 * com o JWT do usuário — a RLS garante que o assistente só veja as categorias liberadas.
 */
export interface DepsFerramentas {
  db: SupabaseClient;
  fontes: RegistroFontes;
  embeddings: ProvedorEmbeddings;
  /** Avisado quando uma ferramenta começa (para mostrar "Pesquisando documentos..." no chat). */
  aoUsar?: (nome: string) => void;
}

const data = (descricao: string) => z.iso.date().optional().describe(`${descricao} (AAAA-MM-DD)`);
const limite = (padrao: number, maximo: number) =>
  z.number().int().min(1).max(maximo).optional().describe(`Máximo de resultados (padrão ${padrao}).`);

interface DocumentoResumo {
  id: string;
  titulo: string;
  tipo_nome: string;
  tipo_codigo: string;
  categoria_caminho: string;
  empresa_nome: string | null;
  contraparte_nome: string | null;
  setor_nome: string | null;
  data_documento: string | null;
  data_validade: string | null;
  situacao: string;
  dias_para_vencer: number | null;
  metadados: Record<string, unknown>;
  tags: { nome: string }[];
  status_processamento: string;
  encontrado_no_conteudo?: boolean;
}

export function criarFerramentas(deps: DepsFerramentas) {
  const { db, fontes } = deps;

  /** Executa a ferramenta devolvendo JSON; erros viram resultado legível para o modelo. */
  const executar = async (nome: string, fn: () => Promise<unknown>): Promise<string> => {
    deps.aoUsar?.(nome);
    try {
      return JSON.stringify(await fn());
    } catch (err) {
      logger.warn({ err, ferramenta: nome }, "falha em ferramenta do assistente");
      return JSON.stringify({ erro: "Falha ao consultar os dados. Informe ao usuário que a consulta não pôde ser concluída." });
    }
  };

  const fonteDocumento = (d: Pick<DocumentoResumo, "id" | "titulo" | "tipo_nome" | "categoria_caminho">) =>
    fontes.registrar(`documento:${d.id}`, {
      tipo: "documento",
      titulo: d.titulo,
      detalhe: `${d.tipo_nome} — ${d.categoria_caminho}`,
      documento_id: d.id,
    });

  /** IDs de empresas (do grupo ou externas) cujo nome/CNPJ combinam com o termo. */
  const empresasPorTermo = async (termo: string): Promise<string[]> => {
    const t = termoSeguro(termo);
    const digitos = somenteDigitos(termo);
    const condicoes = [`razao_social.ilike.*${t}*`, `nome_fantasia.ilike.*${t}*`];
    if (digitos.length >= 8) condicoes.push(`cnpj.like.*${digitos}*`);
    const { data: empresas, error } = await db.from("empresas").select("id").or(condicoes.join(",")).limit(5);
    if (error) throw error;
    return (empresas ?? []).map((e) => e.id as string);
  };

  const categoriaPorNome = async (nome: string): Promise<string | null> => {
    const { data: categorias, error } = await db
      .from("categorias")
      .select("id, nivel")
      .ilike("nome", termoSeguro(nome))
      .order("nivel")
      .limit(1);
    if (error) throw error;
    return (categorias?.[0]?.id as string | undefined) ?? null;
  };

  const pesquisar = betaZodTool({
    name: "pesquisar_documentos",
    description:
      "Pesquisa documentos por palavras (título, descrição, campos e conteúdo do arquivo) e filtros. Use para listagens como 'quais contratos vencem nos próximos 30 dias' (tipo=contrato + validade_ate), 'documentos do fornecedor X' (empresa) ou 'notas fiscais de setembro' (tipo=nota_fiscal + data_de/data_ate). Devolve os campos personalizados (ex.: valor_total) em 'campos'.",
    inputSchema: z.object({
      termo: z.string().max(200).optional().describe("Palavras-chave. Omita para listar só por filtros."),
      tipo: z
        .string()
        .max(40)
        .optional()
        .describe("Código do tipo: contrato, aditivo, procuracao, parecer, notificacao, nota_fiscal, comprovante, relatorio, guia_imposto, certidao, proposta, pedido_compra, documento_colaborador, atestado, oficio, memorando, ordem_servico, relatorio_operacional, outro."),
      categoria: z.string().max(80).optional().describe("Nome da categoria ou subcategoria (ex.: Jurídico, Notas Fiscais)."),
      empresa: z.string().max(100).optional().describe("Nome ou CNPJ de empresa, fornecedor ou cliente relacionado."),
      tags: z.array(z.string().max(40)).max(5).optional().describe("Nomes de tags."),
      situacao: z.enum(SITUACOES_DOCUMENTO).optional(),
      validade_de: data("Validade a partir de"),
      validade_ate: data("Validade até"),
      data_de: data("Data do documento a partir de"),
      data_ate: data("Data do documento até"),
      ordem: z.enum(["relevancia", "recentes", "validade", "nome"]).optional(),
      limite: limite(20, 50),
    }),
    run: (input) =>
      executar("pesquisar_documentos", async () => {
        let categoria: string | null = null;
        if (input.categoria) {
          categoria = await categoriaPorNome(input.categoria);
          if (!categoria) return { documentos: [], observacao: `Categoria "${input.categoria}" não encontrada (ou sem acesso).` };
        }
        let empresa: string | null = null;
        if (input.empresa) {
          const ids = await empresasPorTermo(input.empresa);
          if (ids.length === 0) return { documentos: [], observacao: `Nenhuma empresa encontrada para "${input.empresa}".` };
          empresa = ids[0] ?? null;
        }
        let tags: string[] | null = null;
        if (input.tags?.length) {
          const { data: encontradas, error } = await db.from("tags").select("id, nome");
          if (error) throw error;
          const nomes = new Set(input.tags.map((t) => t.toLowerCase()));
          tags = (encontradas ?? []).filter((t) => nomes.has(String(t.nome).toLowerCase())).map((t) => t.id as string);
          if (tags.length === 0) return { documentos: [], observacao: "Nenhuma das tags existe." };
        }

        const { data: resultado, error } = await db.rpc("pesquisar_documentos", {
          p_termo: input.termo ?? null,
          p_tipo_codigo: input.tipo ?? null,
          p_categoria: categoria,
          p_empresa_ou_contraparte: empresa,
          p_tags: tags,
          p_situacao: input.situacao ?? null,
          p_validade_de: input.validade_de ?? null,
          p_validade_ate: input.validade_ate ?? null,
          p_data_de: input.data_de ?? null,
          p_data_ate: input.data_ate ?? null,
          p_ordem: input.ordem ?? (input.validade_ate || input.situacao === "a_vencer" ? "validade" : null),
          p_limite: input.limite ?? 20,
        });
        if (error) throw error;
        const { total, itens } = resultado as { total: number; itens: DocumentoResumo[] };
        return {
          total,
          documentos: itens.map((d) => ({
            fonte: fonteDocumento(d),
            documento_id: d.id,
            titulo: d.titulo,
            tipo: d.tipo_nome,
            categoria: d.categoria_caminho,
            empresa: d.empresa_nome,
            contraparte: d.contraparte_nome,
            setor: d.setor_nome,
            data_documento: d.data_documento,
            data_validade: d.data_validade,
            situacao: d.situacao,
            dias_para_vencer: d.dias_para_vencer,
            campos: d.metadados,
            tags: d.tags.map((t) => t.nome),
            texto_pesquisavel: d.status_processamento === "concluido" || d.status_processamento === "erro",
            encontrado_no_conteudo: d.encontrado_no_conteudo ?? false,
          })),
        };
      }),
  });

  const detalhar = betaZodTool({
    name: "detalhar_documento",
    description: "Todos os dados de um documento: classificação, datas, situação, campos personalizados com rótulos, tags e versões do arquivo.",
    inputSchema: z.object({ documento_id: z.uuid() }),
    run: (input) =>
      executar("detalhar_documento", async () => {
        const { data: doc, error } = await db.from("v_documentos").select("*").eq("id", input.documento_id).maybeSingle();
        if (error) throw error;
        if (!doc) return { encontrado: false, mensagem: "Documento não encontrado (ou sem acesso)." };

        const [tipo, versoes] = await Promise.all([
          db.from("tipos_documento").select("campos").eq("id", doc.tipo_id as string).single(),
          db.from("documento_versoes").select("versao, nome_arquivo, enviado_em, comentario").eq("documento_id", input.documento_id).order("versao"),
        ]);
        const campos = ((tipo.data?.campos ?? []) as CampoPersonalizado[]).map((c) => ({
          campo: c.rotulo,
          valor: (doc.metadados as Record<string, unknown>)[c.chave] ?? null,
        }));
        return {
          encontrado: true,
          fonte: fonteDocumento(doc as DocumentoResumo),
          titulo: doc.titulo,
          descricao: doc.descricao,
          tipo: doc.tipo_nome,
          categoria: doc.categoria_caminho,
          empresa: doc.empresa_nome,
          filial: doc.filial_nome,
          setor: doc.setor_nome,
          contraparte: doc.contraparte_nome,
          responsavel: doc.responsavel_nome,
          data_documento: doc.data_documento,
          data_validade: doc.data_validade,
          situacao: doc.situacao,
          dias_para_vencer: doc.dias_para_vencer,
          campos,
          tags: (doc.tags as { nome: string }[]).map((t) => t.nome),
          arquivo: doc.nome_arquivo,
          versoes: versoes.data ?? [],
          enviado_por: doc.criado_por_nome,
          enviado_em: doc.criado_em,
        };
      }),
  });

  const listarCategorias = betaZodTool({
    name: "listar_categorias",
    description: "Estrutura de categorias e subcategorias que o usuário pode ver, com a quantidade de documentos em cada uma.",
    inputSchema: z.object({}),
    run: () =>
      executar("listar_categorias", async () => {
        const [categorias, contagem] = await Promise.all([
          db.from("categorias").select("id, parent_id, nome, nivel").eq("ativo", true).order("nivel").order("ordem"),
          db.rpc("contagem_por_categoria"),
        ]);
        if (categorias.error) throw categorias.error;
        if (contagem.error) throw contagem.error;
        const totais = new Map(((contagem.data ?? []) as { categoria_id: string; total: number }[]).map((c) => [c.categoria_id, Number(c.total)]));
        const lista = categorias.data ?? [];
        return lista
          .filter((c) => !c.parent_id)
          .map((raiz) => ({
            categoria: raiz.nome,
            documentos: totais.get(raiz.id as string) ?? 0,
            subcategorias: lista
              .filter((s) => s.parent_id === raiz.id)
              .map((s) => ({ nome: s.nome, documentos: totais.get(s.id as string) ?? 0 })),
          }));
      }),
  });

  const buscaSemantica = betaZodTool({
    name: "busca_semantica",
    description:
      "Busca no CONTEÚDO dos arquivos (contratos, aditivos, pareceres, notas, relatórios...) por significado e por palavras-chave. Devolve trechos com documento e página. Filtre por documento_id quando a pergunta for sobre um documento específico.",
    inputSchema: z.object({
      consulta: z.string().min(2).max(500).describe("O que procurar, em linguagem natural ou palavras-chave."),
      documento_id: z.uuid().optional(),
      tipo: z.string().max(40).optional().describe("Código do tipo de documento."),
      categoria: z.string().max(80).optional(),
      empresa: z.string().max(100).optional(),
      limite: limite(8, 15),
    }),
    run: (input) =>
      executar("busca_semantica", async () => {
        const filtroCategoria = input.categoria ? await categoriaPorNome(input.categoria) : null;
        const filtroEmpresa = input.empresa ? ((await empresasPorTermo(input.empresa))[0] ?? null) : null;

        // Sem embeddings (função fora do ar) a busca segue só pela parte textual.
        let vetor: number[] | null = null;
        try {
          [vetor = null] = await deps.embeddings.gerar([input.consulta]);
        } catch (err) {
          logger.warn({ err }, "embeddings indisponíveis; busca só textual");
        }

        const { data: trechos, error } = await db.rpc("buscar_trechos", {
          query_embedding: vetor ? JSON.stringify(vetor) : null,
          query_texto: input.consulta,
          limite: input.limite ?? 8,
          filtro_categoria: filtroCategoria,
          filtro_documento: input.documento_id ?? null,
          filtro_tipo: input.tipo ?? null,
          filtro_empresa: filtroEmpresa,
        });
        if (error) throw error;
        const lista = (trechos ?? []) as { documento_id: string; pagina: number | null; conteudo: string }[];
        if (lista.length === 0) return { trechos: [], observacao: "Nenhum trecho encontrado nos documentos processados." };

        const docs = await resumoDocumentos(db, [...new Set(lista.map((t) => t.documento_id))]);
        return {
          trechos: lista.map((t) => {
            const doc = docs.get(t.documento_id);
            return {
              fonte: fontes.registrar(`trecho:${t.documento_id}:${t.pagina ?? 0}`, {
                tipo: "trecho",
                titulo: doc?.titulo ?? "Documento",
                detalhe: [doc?.tipo_nome, t.pagina ? `p. ${t.pagina}` : null].filter(Boolean).join(" — "),
                documento_id: t.documento_id,
                pagina: t.pagina,
                trecho: t.conteudo.slice(0, 280),
              }),
              documento_id: t.documento_id,
              documento: doc?.titulo,
              tipo: doc?.tipo_nome,
              pagina: t.pagina,
              conteudo: t.conteudo,
            };
          }),
        };
      }),
  });

  const lerDocumento = betaZodTool({
    name: "ler_documento",
    description:
      "Lê o texto de um documento em ordem (até ~12 mil caracteres por chamada). Use para resumir um documento inteiro depois de obter o documento_id. Se 'continua' vier true, chame de novo com a_partir_do_trecho.",
    inputSchema: z.object({
      documento_id: z.uuid(),
      a_partir_do_trecho: z.number().int().min(0).optional().describe("Ordem do trecho inicial (padrão 0)."),
    }),
    run: (input) =>
      executar("ler_documento", async () => {
        const docs = await resumoDocumentos(db, [input.documento_id]);
        const doc = docs.get(input.documento_id);
        if (!doc) return { encontrado: false, mensagem: "Documento não encontrado (ou sem acesso)." };

        const LIMITE_TRECHOS = 14;
        const { data: trechos, error } = await db
          .from("documento_chunks")
          .select("ordem, pagina, conteudo")
          .eq("documento_id", input.documento_id)
          .gte("ordem", input.a_partir_do_trecho ?? 0)
          .order("ordem")
          .limit(LIMITE_TRECHOS);
        if (error) throw error;
        if (!trechos.length) {
          return { encontrado: true, documento: doc.titulo, texto: "", observacao: "Documento sem texto extraído (escaneado ou imagem)." };
        }

        const selecionados: typeof trechos = [];
        let total = 0;
        for (const t of trechos) {
          total += String(t.conteudo).length;
          if (total > 12_000 && selecionados.length > 0) break;
          selecionados.push(t);
        }
        const paginas = [...new Set(selecionados.map((t) => t.pagina as number | null).filter((p): p is number => p !== null))];
        return {
          encontrado: true,
          fonte: fonteDocumento({ id: input.documento_id, ...doc }),
          documento: doc.titulo,
          paginas_lidas: paginas,
          texto: selecionados.map((t) => t.conteudo).join("\n\n"),
          continua: selecionados.length < trechos.length || trechos.length === LIMITE_TRECHOS,
          proximo_trecho: (selecionados.at(-1)?.ordem as number) + 1,
        };
      }),
  });

  return [pesquisar, detalhar, listarCategorias, buscaSemantica, lerDocumento].map((ferramenta) => ({
    ...ferramenta,
    // Entrada da ferramenta chega em streaming (padrão recomendado com stream + ferramentas próprias).
    eager_input_streaming: true,
  }));
}

async function resumoDocumentos(
  db: SupabaseClient,
  ids: string[],
): Promise<Map<string, { titulo: string; tipo_nome: string; categoria_caminho: string }>> {
  const { data, error } = await db.from("v_documentos").select("id, titulo, tipo_nome, categoria_caminho").in("id", ids);
  if (error) throw error;
  return new Map(
    (data ?? []).map((d) => [
      d.id as string,
      { titulo: d.titulo as string, tipo_nome: d.tipo_nome as string, categoria_caminho: d.categoria_caminho as string },
    ]),
  );
}
