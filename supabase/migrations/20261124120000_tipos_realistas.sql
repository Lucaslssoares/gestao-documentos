-- =============================================================================
-- Tipos de documento realistas: campos do dia a dia agrupados em seções, com formato
-- (CNPJ, chave da NF-e, competência), dicas e unidade; e uma configuração por tipo que
-- adapta o cadastro (rótulos das datas e da parte, o que não se aplica, antecedência
-- do aviso e validade padrão).
--
-- Campos (tipos_documento.campos), propriedades novas e opcionais:
--   grupo        seção do formulário ("Identificação", "Valores", "Vigência"...)
--   formato      cnpj | chave_nfe | competencia   (validado no backend)
--   ajuda        texto curto abaixo do campo
--   placeholder  exemplo dentro do campo
--   sufixo       unidade mostrada no campo ("dias", "ha", "%")
--
-- Configuração (tipos_documento.config):
--   rotulos.data_documento / rotulos.data_validade / rotulos.contraparte
--   ocultar: ["data_validade", "contraparte"]  — o que não se aplica ao tipo
--   aviso_padrao_dias      antecedência do aviso de vencimento sugerida
--   validade_padrao_dias   validade sugerida a partir da data do documento
--   dica                   orientação no topo dos campos do tipo
-- =============================================================================

alter table public.tipos_documento
  add column config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object');

-- Subpastas para os tipos novos.
insert into public.categorias (parent_id, nome, ordem)
select r.id, s.nome, s.ordem
from (values
  ('Operacional', 'Licenças e autorizações', 4),
  ('Operacional', 'Laudos técnicos', 5),
  ('Administrativo', 'Seguros', 4)
) as s (raiz, nome, ordem)
join public.categorias r on r.nome = s.raiz and r.parent_id is null
where not exists (select 1 from public.categorias c where c.parent_id = r.id and c.nome = s.nome);

-- Tipos originais: só atualiza os que o administrador ainda não editou.
update public.tipos_documento t
set campos = n.campos::jsonb, config = n.config::jsonb, exige_validade = n.exige_validade
from (values
  ('contrato', true, '[
    {"chave": "numero", "rotulo": "Número do contrato", "tipo": "texto", "grupo": "Identificação", "placeholder": "C-2026-014"},
    {"chave": "modalidade", "rotulo": "Modalidade", "tipo": "selecao", "obrigatorio": true, "grupo": "Identificação",
     "opcoes": ["Prestação de serviços", "Fornecimento", "Locação", "Comodato", "Parceria agrícola", "Arrendamento rural", "Confidencialidade (NDA)", "Outro"]},
    {"chave": "objeto", "rotulo": "Objeto", "tipo": "texto_longo", "obrigatorio": true, "grupo": "Identificação", "ajuda": "O que está sendo contratado, em uma ou duas frases."},
    {"chave": "valor_total", "rotulo": "Valor total", "tipo": "moeda", "grupo": "Valores"},
    {"chave": "forma_pagamento", "rotulo": "Forma de pagamento", "tipo": "selecao", "grupo": "Valores", "opcoes": ["Mensal", "Por medição", "Parcelado", "À vista"]},
    {"chave": "indice_reajuste", "rotulo": "Índice de reajuste", "tipo": "selecao", "grupo": "Valores", "opcoes": ["IPCA", "IGP-M", "INPC", "Sem reajuste"]},
    {"chave": "inicio_vigencia", "rotulo": "Início da vigência", "tipo": "data", "obrigatorio": true, "grupo": "Vigência"},
    {"chave": "renovacao_automatica", "rotulo": "Renovação automática", "tipo": "booleano", "grupo": "Vigência"},
    {"chave": "aviso_previo_dias", "rotulo": "Aviso prévio para rescisão", "tipo": "numero", "grupo": "Vigência", "sufixo": "dias"},
    {"chave": "gestor_contrato", "rotulo": "Gestor do contrato", "tipo": "texto", "grupo": "Gestão", "ajuda": "Quem acompanha a execução no dia a dia."}
  ]', '{"rotulos": {"data_documento": "Data de assinatura", "data_validade": "Fim da vigência", "contraparte": "Contratada / contratante"},
        "aviso_padrao_dias": 60}'),
  ('aditivo', false, '[
    {"chave": "numero", "rotulo": "Número do aditivo", "tipo": "texto", "grupo": "Identificação", "placeholder": "1º aditivo"},
    {"chave": "contrato_referencia", "rotulo": "Contrato de referência", "tipo": "texto", "obrigatorio": true, "grupo": "Identificação", "placeholder": "C-2026-014"},
    {"chave": "tipo_alteracao", "rotulo": "O que muda", "tipo": "selecao", "obrigatorio": true, "grupo": "Alteração", "opcoes": ["Prazo", "Valor", "Prazo e valor", "Escopo", "Outro"]},
    {"chave": "valor_aditado", "rotulo": "Valor aditado", "tipo": "moeda", "grupo": "Alteração"},
    {"chave": "alteracao", "rotulo": "Descrição da alteração", "tipo": "texto_longo", "grupo": "Alteração"}
  ]', '{"rotulos": {"data_documento": "Data de assinatura", "data_validade": "Novo término do contrato", "contraparte": "Contratada / contratante"},
        "aviso_padrao_dias": 60}'),
  ('procuracao', true, '[
    {"chave": "outorgante", "rotulo": "Outorgante", "tipo": "texto", "obrigatorio": true, "grupo": "Partes", "ajuda": "Quem concede os poderes."},
    {"chave": "outorgado", "rotulo": "Outorgado", "tipo": "texto", "obrigatorio": true, "grupo": "Partes", "ajuda": "Quem recebe os poderes."},
    {"chave": "tipo_instrumento", "rotulo": "Instrumento", "tipo": "selecao", "grupo": "Instrumento", "opcoes": ["Pública (cartório)", "Particular", "Particular com firma reconhecida"]},
    {"chave": "cartorio", "rotulo": "Cartório", "tipo": "texto", "grupo": "Instrumento", "placeholder": "2º Ofício de Notas de Belém"},
    {"chave": "substabelecimento", "rotulo": "Permite substabelecer", "tipo": "booleano", "grupo": "Instrumento"},
    {"chave": "poderes", "rotulo": "Poderes", "tipo": "texto_longo", "grupo": "Instrumento"}
  ]', '{"rotulos": {"data_documento": "Data de outorga", "data_validade": "Validade"}, "ocultar": ["contraparte"], "aviso_padrao_dias": 30}'),
  ('parecer', false, '[
    {"chave": "assunto", "rotulo": "Assunto", "tipo": "texto", "obrigatorio": true, "grupo": "Parecer"},
    {"chave": "parecerista", "rotulo": "Parecerista", "tipo": "texto", "grupo": "Parecer"},
    {"chave": "conclusao", "rotulo": "Conclusão", "tipo": "selecao", "grupo": "Parecer", "opcoes": ["Favorável", "Favorável com ressalvas", "Desfavorável"]}
  ]', '{"rotulos": {"data_documento": "Data do parecer"}, "ocultar": ["data_validade", "contraparte"]}'),
  ('notificacao', false, '[
    {"chave": "tipo_notificacao", "rotulo": "Tipo", "tipo": "selecao", "grupo": "Notificação", "opcoes": ["Extrajudicial", "Judicial", "Administrativa"]},
    {"chave": "assunto", "rotulo": "Assunto", "tipo": "texto", "obrigatorio": true, "grupo": "Notificação"},
    {"chave": "prazo_resposta", "rotulo": "Prazo de resposta", "tipo": "data", "grupo": "Notificação"}
  ]', '{"rotulos": {"data_documento": "Data do recebimento", "contraparte": "Remetente"}, "ocultar": ["data_validade"]}'),
  ('nota_fiscal', false, '[
    {"chave": "chave_acesso", "rotulo": "Chave de acesso", "tipo": "texto", "formato": "chave_nfe", "grupo": "Nota",
     "ajuda": "Preenche número, série, modelo e CNPJ do emitente sozinho."},
    {"chave": "modelo", "rotulo": "Modelo", "tipo": "selecao", "grupo": "Nota", "opcoes": ["NF-e (55)", "NFC-e (65)", "NFS-e", "CT-e (57)"]},
    {"chave": "numero", "rotulo": "Número", "tipo": "texto", "obrigatorio": true, "grupo": "Nota"},
    {"chave": "serie", "rotulo": "Série", "tipo": "texto", "grupo": "Nota"},
    {"chave": "natureza_operacao", "rotulo": "Natureza da operação", "tipo": "texto", "grupo": "Nota", "placeholder": "Venda de mercadoria"},
    {"chave": "cnpj_emitente", "rotulo": "CNPJ do emitente", "tipo": "texto", "formato": "cnpj", "grupo": "Nota"},
    {"chave": "valor_total", "rotulo": "Valor total da nota", "tipo": "moeda", "obrigatorio": true, "grupo": "Valores"},
    {"chave": "valor_impostos", "rotulo": "Valor dos impostos", "tipo": "moeda", "grupo": "Valores"}
  ]', '{"rotulos": {"data_documento": "Data de emissão", "contraparte": "Emitente / destinatário"}, "ocultar": ["data_validade"],
        "dica": "Envie o XML da nota: o sistema preenche chave, número, série, valores e emitente."}'),
  ('comprovante', false, '[
    {"chave": "valor", "rotulo": "Valor pago", "tipo": "moeda", "obrigatorio": true, "grupo": "Pagamento"},
    {"chave": "forma_pagamento", "rotulo": "Forma de pagamento", "tipo": "selecao", "grupo": "Pagamento", "opcoes": ["PIX", "Boleto", "TED", "Cartão", "Dinheiro"]},
    {"chave": "referente_a", "rotulo": "Referente a", "tipo": "texto", "grupo": "Pagamento", "placeholder": "NF-e 4587 — manutenção de outubro"}
  ]', '{"rotulos": {"data_documento": "Data do pagamento", "contraparte": "Favorecido"}, "ocultar": ["data_validade"]}'),
  ('relatorio', false, '[
    {"chave": "periodo_referencia", "rotulo": "Competência", "tipo": "texto", "formato": "competencia", "grupo": "Relatório"},
    {"chave": "area", "rotulo": "Área", "tipo": "texto", "grupo": "Relatório"}
  ]', '{"rotulos": {"data_documento": "Data do relatório"}, "ocultar": ["data_validade", "contraparte"]}'),
  ('guia_imposto', true, '[
    {"chave": "tributo", "rotulo": "Tributo", "tipo": "selecao", "obrigatorio": true, "grupo": "Guia",
     "opcoes": ["ICMS", "ISS", "PIS/COFINS", "IRPJ/CSLL", "INSS", "FGTS", "IPI", "Outro"]},
    {"chave": "competencia", "rotulo": "Competência", "tipo": "texto", "formato": "competencia", "obrigatorio": true, "grupo": "Guia"},
    {"chave": "codigo_receita", "rotulo": "Código da receita", "tipo": "texto", "grupo": "Guia", "placeholder": "1138"},
    {"chave": "valor", "rotulo": "Valor principal", "tipo": "moeda", "obrigatorio": true, "grupo": "Valores"},
    {"chave": "multa_juros", "rotulo": "Multa e juros", "tipo": "moeda", "grupo": "Valores"},
    {"chave": "situacao_pagamento", "rotulo": "Situação", "tipo": "selecao", "grupo": "Valores", "opcoes": ["A pagar", "Paga"]}
  ]', '{"rotulos": {"data_documento": "Data de emissão", "data_validade": "Vencimento"}, "ocultar": ["contraparte"], "aviso_padrao_dias": 5}'),
  ('certidao', true, '[
    {"chave": "tipo_certidao", "rotulo": "Certidão", "tipo": "selecao", "obrigatorio": true, "grupo": "Certidão",
     "opcoes": ["CND Federal", "CND Estadual", "CND Municipal", "CRF FGTS", "CNDT (Trabalhista)", "Outra"]},
    {"chave": "resultado", "rotulo": "Resultado", "tipo": "selecao", "grupo": "Certidão", "opcoes": ["Negativa", "Positiva com efeito de negativa", "Positiva"]},
    {"chave": "orgao_emissor", "rotulo": "Órgão emissor", "tipo": "texto", "grupo": "Certidão", "placeholder": "Receita Federal / PGFN"},
    {"chave": "codigo_controle", "rotulo": "Código de controle", "tipo": "texto", "grupo": "Certidão", "ajuda": "Usado para conferir a autenticidade no site do órgão."},
    {"chave": "cnpj_consultado", "rotulo": "CNPJ consultado", "tipo": "texto", "formato": "cnpj", "grupo": "Certidão"}
  ]', '{"rotulos": {"data_documento": "Data de emissão", "data_validade": "Validade", "contraparte": "Empresa da certidão"},
        "aviso_padrao_dias": 15, "validade_padrao_dias": 180}'),
  ('proposta', true, '[
    {"chave": "numero_proposta", "rotulo": "Número da proposta", "tipo": "texto", "grupo": "Proposta"},
    {"chave": "valor", "rotulo": "Valor", "tipo": "moeda", "grupo": "Proposta"},
    {"chave": "prazo_entrega_dias", "rotulo": "Prazo de entrega", "tipo": "numero", "grupo": "Proposta", "sufixo": "dias"},
    {"chave": "condicao_pagamento", "rotulo": "Condição de pagamento", "tipo": "texto", "grupo": "Proposta", "placeholder": "28 dias após a entrega"}
  ]', '{"rotulos": {"data_documento": "Data da proposta", "data_validade": "Validade da proposta", "contraparte": "Fornecedor"},
        "aviso_padrao_dias": 7, "validade_padrao_dias": 30}'),
  ('pedido_compra', false, '[
    {"chave": "numero", "rotulo": "Número do pedido", "tipo": "texto", "obrigatorio": true, "grupo": "Pedido"},
    {"chave": "valor", "rotulo": "Valor", "tipo": "moeda", "grupo": "Pedido"},
    {"chave": "centro_custo", "rotulo": "Centro de custo", "tipo": "texto", "grupo": "Pedido"},
    {"chave": "entrega_prevista", "rotulo": "Entrega prevista", "tipo": "data", "grupo": "Pedido"}
  ]', '{"rotulos": {"data_documento": "Data do pedido", "contraparte": "Fornecedor"}, "ocultar": ["data_validade"]}'),
  ('documento_colaborador', false, '[
    {"chave": "colaborador", "rotulo": "Colaborador", "tipo": "texto", "obrigatorio": true, "grupo": "Colaborador"},
    {"chave": "matricula", "rotulo": "Matrícula", "tipo": "texto", "grupo": "Colaborador"},
    {"chave": "cargo", "rotulo": "Cargo", "tipo": "texto", "grupo": "Colaborador"},
    {"chave": "tipo_documento_rh", "rotulo": "Documento", "tipo": "selecao", "grupo": "Colaborador",
     "opcoes": ["Contrato de trabalho", "Ficha de registro", "Aviso de férias", "Advertência", "Termo de rescisão", "Outro"]}
  ]', '{"ocultar": ["contraparte"], "dica": "Dados pessoais: registre só o necessário (LGPD)."}'),
  ('atestado', false, '[
    {"chave": "colaborador", "rotulo": "Colaborador", "tipo": "texto", "obrigatorio": true, "grupo": "Atestado"},
    {"chave": "matricula", "rotulo": "Matrícula", "tipo": "texto", "grupo": "Atestado"},
    {"chave": "tipo_atestado", "rotulo": "Tipo", "tipo": "selecao", "obrigatorio": true, "grupo": "Atestado",
     "opcoes": ["Médico", "Odontológico", "Comparecimento", "ASO admissional", "ASO periódico", "ASO demissional"]},
    {"chave": "dias_afastamento", "rotulo": "Afastamento", "tipo": "numero", "grupo": "Atestado", "sufixo": "dias"}
  ]', '{"rotulos": {"data_documento": "Data do atestado", "data_validade": "Validade (ASO)"}, "ocultar": ["contraparte"],
        "dica": "Não registre o CID nem o diagnóstico (dado sensível — LGPD)."}'),
  ('oficio', false, '[
    {"chave": "numero", "rotulo": "Número", "tipo": "texto", "grupo": "Ofício", "placeholder": "045/2026"},
    {"chave": "assunto", "rotulo": "Assunto", "tipo": "texto", "grupo": "Ofício"},
    {"chave": "destinatario", "rotulo": "Destinatário", "tipo": "texto", "grupo": "Ofício"},
    {"chave": "prazo_resposta", "rotulo": "Prazo de resposta", "tipo": "data", "grupo": "Ofício"}
  ]', '{"rotulos": {"data_documento": "Data do ofício"}, "ocultar": ["data_validade", "contraparte"]}'),
  ('memorando', false, '[
    {"chave": "numero", "rotulo": "Número", "tipo": "texto", "grupo": "Memorando"},
    {"chave": "assunto", "rotulo": "Assunto", "tipo": "texto", "grupo": "Memorando"},
    {"chave": "destinatario", "rotulo": "Destinatário", "tipo": "texto", "grupo": "Memorando"}
  ]', '{"rotulos": {"data_documento": "Data do memorando"}, "ocultar": ["data_validade", "contraparte"]}'),
  ('ordem_servico', false, '[
    {"chave": "numero", "rotulo": "Número da OS", "tipo": "texto", "grupo": "Ordem de serviço"},
    {"chave": "local", "rotulo": "Local / unidade", "tipo": "texto", "grupo": "Ordem de serviço", "placeholder": "Fazenda Tailândia — talhão 12"},
    {"chave": "equipamento", "rotulo": "Equipamento", "tipo": "texto", "grupo": "Ordem de serviço"},
    {"chave": "prioridade", "rotulo": "Prioridade", "tipo": "selecao", "grupo": "Ordem de serviço", "opcoes": ["Baixa", "Média", "Alta", "Emergencial"]}
  ]', '{"rotulos": {"data_documento": "Data de abertura", "contraparte": "Prestador"}, "ocultar": ["data_validade"]}'),
  ('relatorio_operacional', false, '[
    {"chave": "periodo_referencia", "rotulo": "Competência", "tipo": "texto", "formato": "competencia", "grupo": "Relatório"},
    {"chave": "unidade", "rotulo": "Unidade / fazenda", "tipo": "texto", "grupo": "Relatório"}
  ]', '{"rotulos": {"data_documento": "Data do relatório"}, "ocultar": ["data_validade", "contraparte"]}')
) as n (codigo, exige_validade, campos, config)
where t.codigo = n.codigo
  and t.atualizado_em = t.criado_em;

-- Tipos novos (operação agrícola/industrial).
insert into public.tipos_documento (codigo, nome, descricao, categoria_padrao_id, exige_validade, ordem, campos, config)
select n.codigo, n.nome, n.descricao, sub.id, n.exige_validade, n.ordem, n.campos::jsonb, n.config::jsonb
from (values
  ('licenca_ambiental', 'Licença ambiental', 'Licenças, outorgas e autorizações ambientais', 'Operacional', 'Licenças e autorizações', true, 72, '[
    {"chave": "numero_licenca", "rotulo": "Número da licença", "tipo": "texto", "obrigatorio": true, "grupo": "Licença", "placeholder": "LO nº 12345/2026"},
    {"chave": "tipo_licenca", "rotulo": "Tipo", "tipo": "selecao", "obrigatorio": true, "grupo": "Licença",
     "opcoes": ["Licença Prévia (LP)", "Licença de Instalação (LI)", "Licença de Operação (LO)", "Licença Ambiental Única (LAU)", "Outorga de uso da água", "Autorização de supressão vegetal", "Dispensa de licenciamento"]},
    {"chave": "orgao_emissor", "rotulo": "Órgão emissor", "tipo": "selecao", "obrigatorio": true, "grupo": "Licença", "opcoes": ["SEMAS-PA", "IBAMA", "ANA", "Secretaria municipal", "Outro"]},
    {"chave": "processo", "rotulo": "Número do processo", "tipo": "texto", "grupo": "Licença"},
    {"chave": "atividade", "rotulo": "Atividade licenciada", "tipo": "texto_longo", "grupo": "Empreendimento"},
    {"chave": "unidade", "rotulo": "Unidade / fazenda", "tipo": "texto", "grupo": "Empreendimento"},
    {"chave": "area_ha", "rotulo": "Área licenciada", "tipo": "numero", "grupo": "Empreendimento", "sufixo": "ha"}
  ]', '{"rotulos": {"data_documento": "Data de emissão", "data_validade": "Vencimento da licença"}, "ocultar": ["contraparte"],
        "aviso_padrao_dias": 120,
        "dica": "A renovação da LO deve ser pedida com 120 dias de antecedência do vencimento. Cadastre as condicionantes como pendências."}'),
  ('apolice_seguro', 'Apólice de seguro', 'Apólices e endossos de seguro', 'Administrativo', 'Seguros', true, 62, '[
    {"chave": "numero_apolice", "rotulo": "Número da apólice", "tipo": "texto", "obrigatorio": true, "grupo": "Apólice"},
    {"chave": "seguradora", "rotulo": "Seguradora", "tipo": "texto", "obrigatorio": true, "grupo": "Apólice"},
    {"chave": "ramo", "rotulo": "Ramo", "tipo": "selecao", "obrigatorio": true, "grupo": "Apólice",
     "opcoes": ["Patrimonial", "Frota", "Responsabilidade civil", "Vida em grupo", "Transporte de cargas", "Agrícola", "Riscos de engenharia"]},
    {"chave": "corretora", "rotulo": "Corretora", "tipo": "texto", "grupo": "Apólice"},
    {"chave": "importancia_segurada", "rotulo": "Importância segurada", "tipo": "moeda", "grupo": "Valores"},
    {"chave": "premio", "rotulo": "Prêmio", "tipo": "moeda", "grupo": "Valores"},
    {"chave": "franquia", "rotulo": "Franquia", "tipo": "moeda", "grupo": "Valores"}
  ]', '{"rotulos": {"data_documento": "Início da vigência", "data_validade": "Fim da vigência"}, "ocultar": ["contraparte"], "aviso_padrao_dias": 45}'),
  ('laudo_tecnico', 'Laudo técnico', 'Laudos de inspeção, NRs e análises', 'Operacional', 'Laudos técnicos', true, 73, '[
    {"chave": "tipo_laudo", "rotulo": "Tipo de laudo", "tipo": "selecao", "obrigatorio": true, "grupo": "Laudo",
     "opcoes": ["NR-10 (instalações elétricas)", "NR-12 (máquinas)", "NR-13 (caldeiras e vasos de pressão)", "SPDA (para-raios)", "Análise de solo", "Análise de água/efluente", "Outro"]},
    {"chave": "equipamento_local", "rotulo": "Equipamento / local", "tipo": "texto", "obrigatorio": true, "grupo": "Laudo"},
    {"chave": "responsavel_tecnico", "rotulo": "Responsável técnico", "tipo": "texto", "grupo": "Responsável"},
    {"chave": "registro_profissional", "rotulo": "Registro profissional", "tipo": "texto", "grupo": "Responsável", "placeholder": "CREA-PA 12345"},
    {"chave": "conclusao", "rotulo": "Conclusão", "tipo": "selecao", "grupo": "Responsável", "opcoes": ["Conforme", "Conforme com recomendações", "Não conforme"]}
  ]', '{"rotulos": {"data_documento": "Data da inspeção", "data_validade": "Próxima inspeção", "contraparte": "Empresa responsável"},
        "aviso_padrao_dias": 30, "validade_padrao_dias": 365}')
) as n (codigo, nome, descricao, raiz, sub, exige_validade, ordem, campos, config)
join public.categorias raiz on raiz.nome = n.raiz and raiz.parent_id is null
left join public.categorias sub on sub.parent_id = raiz.id and sub.nome = n.sub
on conflict (codigo) do nothing;
