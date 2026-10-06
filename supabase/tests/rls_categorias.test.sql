-- Testes de controle de acesso por categoria + perfil (rode com: npx supabase test db)
-- Cada arquivo roda numa transação própria e é desfeito ao final.
begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

-- ---------------------------------------------------------------------------
-- Fixtures (como postgres, sem RLS)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-a000-000000000001', 'teste.juridico@example.com'),     -- editor Jurídico
  ('aaaaaaaa-0000-4000-a000-000000000002', 'teste.rh@example.com'),           -- editor RH
  ('aaaaaaaa-0000-4000-a000-000000000003', 'teste.leitor@example.com'),       -- leitor Jurídico
  ('aaaaaaaa-0000-4000-a000-000000000004', 'teste.gestor@example.com');       -- gestor Jurídico

update public.perfis set papel = 'editor' where id in ('aaaaaaaa-0000-4000-a000-000000000001', 'aaaaaaaa-0000-4000-a000-000000000002');
update public.perfis set papel = 'leitor' where id = 'aaaaaaaa-0000-4000-a000-000000000003';
update public.perfis set papel = 'gestor' where id = 'aaaaaaaa-0000-4000-a000-000000000004';

insert into public.usuario_categorias (usuario_id, categoria_id)
select u.id, c.id
from (values
  ('aaaaaaaa-0000-4000-a000-000000000001'::uuid, 'Jurídico'),
  ('aaaaaaaa-0000-4000-a000-000000000002'::uuid, 'RH'),
  ('aaaaaaaa-0000-4000-a000-000000000003'::uuid, 'Jurídico'),
  ('aaaaaaaa-0000-4000-a000-000000000004'::uuid, 'Jurídico')
) as u (id, categoria)
join public.categorias c on c.nome = u.categoria and c.parent_id is null;

-- Documento em Jurídico › Contratos, com um trecho indexado.
insert into public.documentos (id, titulo, tipo_id, categoria_id, storage_key, nome_arquivo, mime_type, tamanho_bytes, sha256, metadados)
select 'dddddddd-0000-4000-a000-000000000001', 'Contrato de fornecimento agrícola',
       (select id from public.tipos_documento where codigo = 'contrato'),
       sub.id, 'juridico/teste/rls.pdf', 'rls.pdf', 'application/pdf', 10, repeat('a', 64),
       '{"numero": "C-2026-014", "valor_total": 480000}'
from public.categorias sub
join public.categorias r on r.id = sub.parent_id
where r.nome = 'Jurídico' and sub.nome = 'Contratos';

insert into public.documento_chunks (documento_id, raiz_id, ordem, conteudo)
select id, raiz_id, 0, 'Cláusula de rescisão contratual por inadimplemento do fornecedor.'
from public.documentos where id = 'dddddddd-0000-4000-a000-000000000001';

create function pg_temp.logar(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p_uid::text, true);
$$;

-- raiz_id foi preenchida pelo trigger a partir da subcategoria
select is(
  (select r.nome from public.documentos d join public.categorias r on r.id = d.raiz_id where d.id = 'dddddddd-0000-4000-a000-000000000001'),
  'Jurídico', 'raiz do documento é calculada pela categoria');

set local role authenticated;

-- ---------------------------------------------------------------------------
-- Usuário de RH não enxerga o Jurídico
-- ---------------------------------------------------------------------------
select pg_temp.logar('aaaaaaaa-0000-4000-a000-000000000002');

select is((select count(*) from public.v_documentos where id = 'dddddddd-0000-4000-a000-000000000001')::int, 0,
  'RH não lê documento do Jurídico');
select is((select count(*) from public.categorias c where c.nome = 'Contratos')::int, 0,
  'RH não vê as categorias do Jurídico');
select is((select count(*) from public.buscar_trechos(null, 'rescisão inadimplemento'))::int, 0,
  'busca do RAG não devolve trechos de outra categoria');
select is((public.pesquisar_documentos(p_termo => 'agricola') ->> 'total')::int, 0,
  'pesquisa não devolve documentos de outra categoria');

-- ---------------------------------------------------------------------------
-- Editor do Jurídico: lê, pesquisa (sem acento), edita, mas não exclui
-- ---------------------------------------------------------------------------
select pg_temp.logar('aaaaaaaa-0000-4000-a000-000000000001');

select is((public.pesquisar_documentos(p_termo => 'fornecimento agricola') ->> 'total')::int, 1,
  'pesquisa ignora acentos e encontra pelo título');
select is((public.pesquisar_documentos(p_termo => 'C-2026-014') ->> 'total')::int, 1,
  'pesquisa encontra pelos campos personalizados');
select is((public.pesquisar_documentos(p_termo => 'inadimplemento') ->> 'total')::int, 1,
  'pesquisa encontra pelo conteúdo do arquivo');
select is((select count(*) from public.buscar_trechos(null, 'rescisão por inadimplemento'))::int, 1,
  'busca textual do RAG encontra o trecho');

update public.documentos set descricao = 'Revisado' where id = 'dddddddd-0000-4000-a000-000000000001';
select is((select descricao from public.documentos where id = 'dddddddd-0000-4000-a000-000000000001'), 'Revisado',
  'editor altera documento da sua categoria');

select throws_ok(
  $$ update public.documentos set excluido_em = now() where id = 'dddddddd-0000-4000-a000-000000000001' $$,
  '42501', null, 'editor não manda documento para a lixeira');

-- ---------------------------------------------------------------------------
-- Leitor não altera; gestor exclui (lixeira) e o histórico registra
-- ---------------------------------------------------------------------------
select pg_temp.logar('aaaaaaaa-0000-4000-a000-000000000003');
update public.documentos set descricao = 'Leitor tentou' where id = 'dddddddd-0000-4000-a000-000000000001';
select pg_temp.logar('aaaaaaaa-0000-4000-a000-000000000001');
select is((select descricao from public.documentos where id = 'dddddddd-0000-4000-a000-000000000001'), 'Revisado',
  'leitor não consegue alterar (a RLS ignora a linha)');

select pg_temp.logar('aaaaaaaa-0000-4000-a000-000000000004');
update public.documentos set excluido_em = now() where id = 'dddddddd-0000-4000-a000-000000000001';
select is((select count(*) from public.v_documentos where id = 'dddddddd-0000-4000-a000-000000000001')::int, 0,
  'documento na lixeira some da listagem');
select is(
  (select array_agg(acao order by id) from public.historico where documento_id = 'dddddddd-0000-4000-a000-000000000001'),
  array['criar', 'atualizar', 'excluir'],
  'histórico registra criação, alteração e exclusão');

select * from finish();
rollback;
