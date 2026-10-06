/**
 * Documentos de DEMONSTRAÇÃO para o ambiente local (npm run seed:demo).
 *
 * Gera PDFs fictícios, envia ao MinIO, cadastra no Supabase e roda o pipeline de
 * processamento (texto → trechos → embeddings), deixando o painel, a pesquisa e o
 * assistente com dados para testar. Pré-requisito: `supabase db reset` (seed.sql) e MinIO no ar.
 * Pode rodar mais de uma vez: documentos com o mesmo título são ignorados.
 */
import { CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { env } from "../src/config/env.js";
import { pdfSimples } from "../src/lib/pdf-simples.js";
import { enviarArquivo, s3 } from "../src/lib/s3.js";
import { supabaseAdmin } from "../src/lib/supabase.js";
import { gerarStorageKey, sha256 } from "../src/modules/documentos/arquivos.js";
import { processarDocumento } from "../src/processing/pipeline.js";

const ADMIN = "00000000-0000-4000-a000-000000000001";
const JURIDICO = "00000000-0000-4000-a000-000000000002";
const FINANCEIRO = "00000000-0000-4000-a000-000000000003";
const EMPRESAS = {
  bbb: "10000000-0000-4000-a000-000000000001",
  arcon: "10000000-0000-4000-a000-000000000002",
  norteLog: "10000000-0000-4000-a000-000000000003",
  guama: "10000000-0000-4000-a000-000000000004",
  veroPeso: "10000000-0000-4000-a000-000000000005",
  agroPara: "10000000-0000-4000-a000-000000000006",
};

const dia = (deslocamento: number) => new Date(Date.now() + deslocamento * 86_400_000).toISOString().slice(0, 10);

interface Demo {
  titulo: string;
  categoria: [raiz: string, sub: string];
  tipo: string;
  contraparte?: string;
  setor: string;
  responsavel: string;
  data_documento: string;
  data_validade?: string;
  metadados?: Record<string, unknown>;
  tags?: string[];
  descricao?: string;
  paginas: string[][];
}

const DEMOS: Demo[] = [
  {
    titulo: "Contrato de manutenção predial — Arcon",
    categoria: ["Jurídico", "Contratos"],
    tipo: "contrato",
    contraparte: EMPRESAS.arcon,
    setor: "JUR",
    responsavel: JURIDICO,
    data_documento: dia(-240),
    data_validade: dia(125),
    metadados: { numero: "C-2026-014", valor_total: 480000, inicio_vigencia: dia(-240), renovacao_automatica: false, objeto: "Manutenção predial preventiva e corretiva das unidades" },
    tags: ["Renovação"],
    descricao: "Manutenção preventiva e corretiva da matriz e das unidades.",
    paginas: [
      [
        "CONTRATO DE PRESTAÇÃO DE SERVIÇOS Nº C-2026-014",
        "CONTRATANTE: Belém Bioenergia Brasil S.A.",
        "CONTRATADA: Arcon Engenharia Ltda.",
        "",
        "CLÁUSULA PRIMEIRA - DO OBJETO",
        "Prestação de serviços de manutenção predial preventiva e corretiva",
        "nas instalações da matriz e das unidades da CONTRATANTE.",
        "",
        "CLÁUSULA SEGUNDA - DO PRAZO",
        "O contrato vigora por 12 meses, podendo ser prorrogado por termo aditivo.",
        "",
        "CLÁUSULA TERCEIRA - DO VALOR",
        "Valor global de R$ 480.000,00, pago em 12 parcelas mensais de R$ 40.000,00.",
        "O reajuste anual será pelo IPCA.",
      ],
      [
        "CLÁUSULA QUARTA - DAS OBRIGAÇÕES DA CONTRATADA",
        "Atender chamados corretivos em até 24 horas e manter equipe técnica habilitada.",
        "",
        "CLÁUSULA QUINTA - DA RESCISÃO",
        "O descumprimento de obrigações sujeita a parte infratora a multa de 10%",
        "sobre o valor remanescente do contrato, além de rescisão imediata.",
      ],
    ],
  },
  {
    titulo: "1º Aditivo ao contrato C-2026-014",
    categoria: ["Jurídico", "Aditivos"],
    tipo: "aditivo",
    contraparte: EMPRESAS.arcon,
    setor: "JUR",
    responsavel: JURIDICO,
    data_documento: dia(-30),
    metadados: { numero: "01", contrato_referencia: "C-2026-014", valor_aditado: 48000, alteracao: "Inclusão da Unidade Industrial e reajuste de 10% no valor mensal" },
    paginas: [
      [
        "PRIMEIRO TERMO ADITIVO AO CONTRATO Nº C-2026-014",
        "Partes: Belém Bioenergia Brasil S.A. e Arcon Engenharia Ltda.",
        "",
        "CLÁUSULA PRIMEIRA - Fica incluída no escopo a manutenção da Unidade Industrial.",
        "CLÁUSULA SEGUNDA - O valor mensal passa de R$ 40.000,00 para R$ 44.000,00,",
        "acréscimo total de R$ 48.000,00 no período restante.",
        "CLÁUSULA TERCEIRA - Permanecem inalteradas as demais cláusulas do contrato.",
      ],
    ],
  },
  {
    titulo: "Contrato de frete e logística regional — Norte Log",
    categoria: ["Jurídico", "Contratos"],
    tipo: "contrato",
    contraparte: EMPRESAS.norteLog,
    setor: "LOG",
    responsavel: JURIDICO,
    data_documento: dia(-263),
    data_validade: dia(10),
    metadados: { numero: "C-2026-009", valor_total: 156000, inicio_vigencia: dia(-263), renovacao_automatica: true },
    tags: ["Urgente", "Renovação"],
    paginas: [
      [
        "CONTRATO DE TRANSPORTE Nº C-2026-009",
        "Objeto: frete rodoviário de insumos e produtos entre as unidades no Pará.",
        "Valor anual estimado: R$ 156.000,00. Pagamento em até 30 dias após a nota fiscal.",
        "Renovação automática por igual período, salvo aviso prévio de 30 dias.",
        "Seguro de carga por conta da contratada.",
      ],
    ],
  },
  {
    titulo: "Contrato de fornecimento de insumos agrícolas — AgroPará",
    categoria: ["Jurídico", "Contratos"],
    tipo: "contrato",
    contraparte: EMPRESAS.agroPara,
    setor: "AGR",
    responsavel: JURIDICO,
    data_documento: dia(-60),
    data_validade: dia(300),
    metadados: { numero: "C-2026-031", valor_total: 920000, inicio_vigencia: dia(-60), renovacao_automatica: false },
    paginas: [
      [
        "CONTRATO DE FORNECIMENTO Nº C-2026-031",
        "Fornecedor: AgroPará Insumos Agrícolas Ltda.",
        "Objeto: fornecimento de fertilizantes e defensivos para as áreas de plantio.",
        "Valor total: R$ 920.000,00, com entregas mensais conforme programação agrícola.",
        "Prazo de entrega: até 10 dias após o pedido. Multa por atraso: 0,5% ao dia.",
      ],
    ],
  },
  {
    titulo: "Procuração — representação junto à SEFAZ-PA",
    categoria: ["Jurídico", "Procurações"],
    tipo: "procuracao",
    setor: "JUR",
    responsavel: JURIDICO,
    data_documento: dia(-370),
    data_validade: dia(-5),
    metadados: { outorgante: "Belém Bioenergia Brasil S.A.", outorgado: "Escritório Fiscal Associado", poderes: "Representação em processos administrativos fiscais estaduais" },
    tags: ["Original físico"],
    paginas: [["PROCURAÇÃO", "Outorgante: Belém Bioenergia Brasil S.A.", "Poderes para representar a outorgante perante a SEFAZ-PA.", "Validade: 12 meses."]],
  },
  {
    titulo: "NF-e 1207 — Norte Log (frete setembro)",
    categoria: ["Financeiro", "Notas Fiscais"],
    tipo: "nota_fiscal",
    contraparte: EMPRESAS.norteLog,
    setor: "FIN",
    responsavel: FINANCEIRO,
    data_documento: dia(-18),
    metadados: { numero: "1207", serie: "1", chave_acesso: "15260923456789000195550010000012071000012074", valor_total: 13000 },
    paginas: [["DANFE - NF-e Nº 1207 Série 1", "Emitente: Norte Log Transportes Ltda.", "Destinatário: Belém Bioenergia Brasil S.A.", "Serviço: frete regional - setembro", "Valor total da nota: R$ 13.000,00"]],
  },
  {
    titulo: "NF-e 4587 — Arcon (manutenção outubro)",
    categoria: ["Financeiro", "Notas Fiscais"],
    tipo: "nota_fiscal",
    contraparte: EMPRESAS.arcon,
    setor: "FIN",
    responsavel: FINANCEIRO,
    data_documento: dia(0),
    metadados: { numero: "4587", serie: "1", valor_total: 44000 },
    paginas: [["DANFE - NF-e Nº 4587 Série 1", "Emitente: Arcon Engenharia Ltda.", "Serviço: manutenção predial - outubro (contrato C-2026-014)", "Valor total da nota: R$ 44.000,00"]],
  },
  {
    titulo: "Relatório financeiro — setembro/2026",
    categoria: ["Financeiro", "Relatórios"],
    tipo: "relatorio",
    setor: "FIN",
    responsavel: FINANCEIRO,
    data_documento: dia(-4),
    metadados: { periodo_referencia: "09/2026" },
    tags: ["Auditoria 2026"],
    paginas: [["RELATÓRIO FINANCEIRO MENSAL - SETEMBRO/2026", "Receita líquida: R$ 12,4 milhões.", "Despesas com fornecedores: R$ 3,1 milhões.", "Destaque: redução de 8% no custo de frete."]],
  },
  {
    titulo: "Guia ICMS — competência 09/2026",
    categoria: ["Fiscal", "Guias de impostos"],
    tipo: "guia_imposto",
    setor: "FIS",
    responsavel: FINANCEIRO,
    data_documento: dia(-2),
    data_validade: dia(15),
    metadados: { tributo: "ICMS", competencia: "09/2026", valor: 85234.12 },
    paginas: [["DOCUMENTO DE ARRECADAÇÃO ESTADUAL", "Tributo: ICMS - competência 09/2026", "Valor: R$ 85.234,12"]],
  },
  {
    titulo: "CND Federal — Guamá Tecnologia",
    categoria: ["Suprimentos", "Certidões de fornecedores"],
    tipo: "certidao",
    contraparte: EMPRESAS.guama,
    setor: "SUP",
    responsavel: JURIDICO,
    data_documento: dia(-160),
    data_validade: dia(20),
    metadados: { tipo_certidao: "CND Federal", orgao_emissor: "Receita Federal / PGFN" },
    paginas: [["CERTIDÃO NEGATIVA DE DÉBITOS RELATIVOS AOS TRIBUTOS FEDERAIS", "Contribuinte: Guamá Tecnologia S.A.", "Não constam pendências em nome do contribuinte."]],
  },
  {
    titulo: "CRF FGTS — Norte Log",
    categoria: ["Suprimentos", "Certidões de fornecedores"],
    tipo: "certidao",
    contraparte: EMPRESAS.norteLog,
    setor: "SUP",
    responsavel: JURIDICO,
    data_documento: dia(-33),
    data_validade: dia(-3),
    metadados: { tipo_certidao: "CRF FGTS", orgao_emissor: "Caixa Econômica Federal" },
    tags: ["Urgente"],
    paginas: [["CERTIFICADO DE REGULARIDADE DO FGTS - CRF", "Empregador: Norte Log Transportes Ltda.", "Situação: regular no período de validade."]],
  },
  {
    titulo: "Proposta comercial — Ver-o-Peso (refeições)",
    categoria: ["Suprimentos", "Propostas e cotações"],
    tipo: "proposta",
    contraparte: EMPRESAS.veroPeso,
    setor: "SUP",
    responsavel: JURIDICO,
    data_documento: dia(-7),
    data_validade: dia(40),
    metadados: { valor: 230000 },
    paginas: [["PROPOSTA COMERCIAL", "Fornecimento de 900 refeições/dia para as unidades.", "Valor anual: R$ 230.000,00. Validade da proposta: 45 dias."]],
  },
];

async function garantirBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }));
    console.log(`Bucket ${env.S3_BUCKET} criado no MinIO.`);
  }
}

async function principal() {
  await garantirBucket();

  const [categorias, tipos, setores, tags] = await Promise.all([
    supabaseAdmin.from("categorias").select("id, nome, parent_id"),
    supabaseAdmin.from("tipos_documento").select("id, codigo"),
    supabaseAdmin.from("setores").select("id, sigla"),
    supabaseAdmin.from("tags").select("id, nome"),
  ]);
  for (const r of [categorias, tipos, setores, tags]) if (r.error) throw r.error;

  const raizes = new Map(categorias.data!.filter((c) => !c.parent_id).map((c) => [c.nome as string, c.id as string]));
  const categoriaId = (raiz: string, sub: string) =>
    categorias.data!.find((c) => c.nome === sub && c.parent_id === raizes.get(raiz))?.id as string | undefined;

  let criados = 0;
  for (const demo of DEMOS) {
    const { data: existente } = await supabaseAdmin.from("documentos").select("id").eq("titulo", demo.titulo).maybeSingle();
    if (existente) {
      console.log(`· já existe: ${demo.titulo}`);
      continue;
    }

    const categoria = categoriaId(...demo.categoria);
    const tipo = tipos.data!.find((t) => t.codigo === demo.tipo)?.id;
    if (!categoria || !tipo) throw new Error(`Categoria/tipo não encontrado para "${demo.titulo}". Rode "supabase db reset" antes.`);

    const pdf = pdfSimples(demo.paginas);
    const hash = sha256(pdf);
    const nomeArquivo = `${demo.titulo.replace(/[—/]/g, "-").replace(/\s+/g, " ").trim()}.pdf`;
    const storageKey = gerarStorageKey(demo.categoria[0], nomeArquivo);
    await enviarArquivo(storageKey, pdf, "application/pdf", hash);

    const { data: doc, error } = await supabaseAdmin
      .from("documentos")
      .insert({
        titulo: demo.titulo,
        descricao: demo.descricao ?? null,
        tipo_id: tipo,
        categoria_id: categoria,
        empresa_id: EMPRESAS.bbb,
        filial_id: null,
        setor_id: setores.data!.find((s) => s.sigla === demo.setor)?.id ?? null,
        contraparte_id: demo.contraparte ?? null,
        responsavel_id: demo.responsavel,
        data_documento: demo.data_documento,
        data_validade: demo.data_validade ?? null,
        metadados: demo.metadados ?? {},
        storage_key: storageKey,
        nome_arquivo: nomeArquivo,
        mime_type: "application/pdf",
        tamanho_bytes: pdf.length,
        sha256: hash,
        criado_por: ADMIN,
      })
      .select("id")
      .single();
    if (error) throw error;

    await supabaseAdmin.from("documento_versoes").insert({
      documento_id: doc.id,
      versao: 1,
      storage_key: storageKey,
      nome_arquivo: nomeArquivo,
      mime_type: "application/pdf",
      tamanho_bytes: pdf.length,
      sha256: hash,
      enviado_por: ADMIN,
    });

    const idsTags = (demo.tags ?? []).map((nome) => tags.data!.find((t) => t.nome === nome)?.id).filter(Boolean);
    if (idsTags.length) {
      await supabaseAdmin.from("documento_tags").insert(idsTags.map((tag_id) => ({ documento_id: doc.id, tag_id })));
    }

    await processarDocumento(doc.id as string);
    const { data: status } = await supabaseAdmin
      .from("documentos")
      .select("status_processamento, erro_processamento")
      .eq("id", doc.id)
      .single();
    console.log(`✓ ${demo.titulo} — ${status?.status_processamento}${status?.erro_processamento ? ` (${status.erro_processamento})` : ""}`);
    criados++;
  }

  console.log(`\n${criados} documento(s) de demonstração criado(s).`);
}

principal()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Falha no seed de demonstração:", err);
    process.exit(1);
  });
