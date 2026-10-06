-- =============================================================================
-- Dados iniciais (vão para produção): estrutura de categorias, tipos de documento
-- com campos personalizados e setores. Tudo pode ser alterado depois pelo admin.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Categorias raiz (ícones = nomes do lucide-react) e subcategorias
-- -----------------------------------------------------------------------------
insert into public.categorias (nome, descricao, icone, cor, ordem) values
  ('Jurídico',       'Contratos, aditivos, procurações e documentos legais', 'scale',      '#8C491A', 10),
  ('Financeiro',     'Notas fiscais, comprovantes e relatórios financeiros',  'wallet',     '#3D472B', 20),
  ('Fiscal',         'Guias, obrigações acessórias e documentos tributários', 'receipt',    '#C67139', 30),
  ('Suprimentos',    'Documentos de fornecedores, propostas e compras',      'package',    '#645C50', 40),
  ('RH',             'Documentos de colaboradores e atestados',              'users',      '#8C491A', 50),
  ('Administrativo', 'Ofícios, memorandos e documentos diversos',            'building-2', '#3D472B', 60),
  ('Operacional',    'Relatórios, ordens e documentos de operação',          'tractor',    '#C67139', 70);

with sub(raiz, nome, ordem) as (
  values
    ('Jurídico', 'Contratos', 1), ('Jurídico', 'Aditivos', 2), ('Jurídico', 'Procurações', 3),
    ('Jurídico', 'Pareceres e notificações', 4),
    ('Financeiro', 'Notas Fiscais', 1), ('Financeiro', 'Comprovantes', 2), ('Financeiro', 'Relatórios', 3),
    ('Fiscal', 'Guias de impostos', 1), ('Fiscal', 'Obrigações acessórias', 2), ('Fiscal', 'Certidões da empresa', 3),
    ('Suprimentos', 'Certidões de fornecedores', 1), ('Suprimentos', 'Propostas e cotações', 2),
    ('Suprimentos', 'Pedidos de compra', 3), ('Suprimentos', 'Cadastro de fornecedores', 4),
    ('RH', 'Documentos de colaboradores', 1), ('RH', 'Atestados', 2), ('RH', 'Comprovantes', 3),
    ('Administrativo', 'Ofícios', 1), ('Administrativo', 'Memorandos', 2), ('Administrativo', 'Documentos diversos', 3),
    ('Operacional', 'Relatórios', 1), ('Operacional', 'Ordens', 2), ('Operacional', 'Documentos de operação', 3)
)
insert into public.categorias (parent_id, nome, ordem)
select r.id, sub.nome, sub.ordem
from sub
join public.categorias r on r.nome = sub.raiz and r.parent_id is null;

-- -----------------------------------------------------------------------------
-- Tipos de documento e seus campos personalizados
-- -----------------------------------------------------------------------------
insert into public.tipos_documento (codigo, nome, categoria_padrao_id, exige_validade, ordem, campos)
select ti.codigo, ti.nome, sub.id, ti.exige_validade, ti.ordem, ti.campos::jsonb
from (values
  ('contrato', 'Contrato', 'Jurídico', 'Contratos', false, 10, '[
    {"chave": "numero", "rotulo": "Número do contrato", "tipo": "texto", "obrigatorio": false},
    {"chave": "valor_total", "rotulo": "Valor total", "tipo": "moeda", "obrigatorio": false},
    {"chave": "inicio_vigencia", "rotulo": "Início da vigência", "tipo": "data", "obrigatorio": false},
    {"chave": "renovacao_automatica", "rotulo": "Renovação automática", "tipo": "booleano", "obrigatorio": false},
    {"chave": "objeto", "rotulo": "Objeto", "tipo": "texto_longo", "obrigatorio": false}
  ]'),
  ('aditivo', 'Aditivo contratual', 'Jurídico', 'Aditivos', false, 11, '[
    {"chave": "numero", "rotulo": "Número do aditivo", "tipo": "texto", "obrigatorio": false},
    {"chave": "contrato_referencia", "rotulo": "Contrato de referência", "tipo": "texto", "obrigatorio": true},
    {"chave": "valor_aditado", "rotulo": "Valor aditado", "tipo": "moeda", "obrigatorio": false},
    {"chave": "alteracao", "rotulo": "O que foi alterado", "tipo": "texto_longo", "obrigatorio": false}
  ]'),
  ('procuracao', 'Procuração', 'Jurídico', 'Procurações', true, 12, '[
    {"chave": "outorgante", "rotulo": "Outorgante", "tipo": "texto", "obrigatorio": true},
    {"chave": "outorgado", "rotulo": "Outorgado", "tipo": "texto", "obrigatorio": true},
    {"chave": "poderes", "rotulo": "Poderes", "tipo": "texto_longo", "obrigatorio": false}
  ]'),
  ('parecer', 'Parecer jurídico', 'Jurídico', 'Pareceres e notificações', false, 13, '[]'),
  ('notificacao', 'Notificação', 'Jurídico', 'Pareceres e notificações', false, 14, '[
    {"chave": "prazo_resposta", "rotulo": "Prazo de resposta", "tipo": "data", "obrigatorio": false}
  ]'),
  ('nota_fiscal', 'Nota fiscal', 'Financeiro', 'Notas Fiscais', false, 20, '[
    {"chave": "numero", "rotulo": "Número", "tipo": "texto", "obrigatorio": true},
    {"chave": "serie", "rotulo": "Série", "tipo": "texto", "obrigatorio": false},
    {"chave": "chave_acesso", "rotulo": "Chave de acesso (44 dígitos)", "tipo": "texto", "obrigatorio": false},
    {"chave": "valor_total", "rotulo": "Valor total", "tipo": "moeda", "obrigatorio": true}
  ]'),
  ('comprovante', 'Comprovante de pagamento', 'Financeiro', 'Comprovantes', false, 21, '[
    {"chave": "valor", "rotulo": "Valor", "tipo": "moeda", "obrigatorio": true},
    {"chave": "forma_pagamento", "rotulo": "Forma de pagamento", "tipo": "selecao", "obrigatorio": false,
     "opcoes": ["PIX", "Boleto", "TED", "Cartão", "Dinheiro"]}
  ]'),
  ('relatorio', 'Relatório', 'Financeiro', 'Relatórios', false, 22, '[
    {"chave": "periodo_referencia", "rotulo": "Período de referência", "tipo": "texto", "obrigatorio": false}
  ]'),
  ('guia_imposto', 'Guia de imposto', 'Fiscal', 'Guias de impostos', true, 30, '[
    {"chave": "tributo", "rotulo": "Tributo", "tipo": "selecao", "obrigatorio": true,
     "opcoes": ["ICMS", "ISS", "PIS/COFINS", "IRPJ/CSLL", "INSS", "FGTS", "Outro"]},
    {"chave": "competencia", "rotulo": "Competência (MM/AAAA)", "tipo": "texto", "obrigatorio": true},
    {"chave": "valor", "rotulo": "Valor", "tipo": "moeda", "obrigatorio": true}
  ]'),
  ('certidao', 'Certidão', 'Suprimentos', 'Certidões de fornecedores', true, 40, '[
    {"chave": "tipo_certidao", "rotulo": "Certidão", "tipo": "selecao", "obrigatorio": true,
     "opcoes": ["CND Federal", "CND Estadual", "CND Municipal", "CRF FGTS", "CNDT (Trabalhista)", "Outra"]},
    {"chave": "orgao_emissor", "rotulo": "Órgão emissor", "tipo": "texto", "obrigatorio": false}
  ]'),
  ('proposta', 'Proposta comercial', 'Suprimentos', 'Propostas e cotações', true, 41, '[
    {"chave": "valor", "rotulo": "Valor", "tipo": "moeda", "obrigatorio": false}
  ]'),
  ('pedido_compra', 'Pedido de compra', 'Suprimentos', 'Pedidos de compra', false, 42, '[
    {"chave": "numero", "rotulo": "Número do pedido", "tipo": "texto", "obrigatorio": true},
    {"chave": "valor", "rotulo": "Valor", "tipo": "moeda", "obrigatorio": false}
  ]'),
  ('documento_colaborador', 'Documento de colaborador', 'RH', 'Documentos de colaboradores', false, 50, '[
    {"chave": "colaborador", "rotulo": "Colaborador", "tipo": "texto", "obrigatorio": true},
    {"chave": "matricula", "rotulo": "Matrícula", "tipo": "texto", "obrigatorio": false}
  ]'),
  ('atestado', 'Atestado', 'RH', 'Atestados', false, 51, '[
    {"chave": "colaborador", "rotulo": "Colaborador", "tipo": "texto", "obrigatorio": true},
    {"chave": "dias_afastamento", "rotulo": "Dias de afastamento", "tipo": "numero", "obrigatorio": false}
  ]'),
  ('oficio', 'Ofício', 'Administrativo', 'Ofícios', false, 60, '[
    {"chave": "numero", "rotulo": "Número", "tipo": "texto", "obrigatorio": false},
    {"chave": "destinatario", "rotulo": "Destinatário", "tipo": "texto", "obrigatorio": false}
  ]'),
  ('memorando', 'Memorando', 'Administrativo', 'Memorandos', false, 61, '[
    {"chave": "numero", "rotulo": "Número", "tipo": "texto", "obrigatorio": false},
    {"chave": "destinatario", "rotulo": "Destinatário", "tipo": "texto", "obrigatorio": false}
  ]'),
  ('ordem_servico', 'Ordem de serviço', 'Operacional', 'Ordens', false, 70, '[
    {"chave": "numero", "rotulo": "Número", "tipo": "texto", "obrigatorio": false},
    {"chave": "local", "rotulo": "Local / unidade", "tipo": "texto", "obrigatorio": false}
  ]'),
  ('relatorio_operacional', 'Relatório operacional', 'Operacional', 'Relatórios', false, 71, '[
    {"chave": "periodo_referencia", "rotulo": "Período de referência", "tipo": "texto", "obrigatorio": false}
  ]'),
  ('outro', 'Outro documento', null, null, false, 99, '[]')
) as ti (codigo, nome, raiz, sub, exige_validade, ordem, campos)
left join public.categorias raiz on raiz.nome = ti.raiz and raiz.parent_id is null
left join public.categorias sub on sub.parent_id = raiz.id and sub.nome = ti.sub;

-- -----------------------------------------------------------------------------
-- Setores (áreas responsáveis)
-- -----------------------------------------------------------------------------
insert into public.setores (nome, sigla) values
  ('Jurídico', 'JUR'), ('Financeiro', 'FIN'), ('Fiscal', 'FIS'), ('Suprimentos', 'SUP'),
  ('Recursos Humanos', 'RH'), ('Administrativo', 'ADM'), ('Tecnologia da Informação', 'TI'),
  ('Operações Agrícolas', 'AGR'), ('Industrial', 'IND'), ('Logística', 'LOG');
