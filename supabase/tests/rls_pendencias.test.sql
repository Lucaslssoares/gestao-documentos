-- Pendências: quem cria, quem conclui e quem enxerga (rode com: npx supabase test db).
begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

-- ---------------------------------------------------------------------------
-- Fixtures (como postgres, sem RLS)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('bbbbbbbb-0000-4000-a000-000000000001', 'pend.editor@example.com'),   -- editor Jurídico
  ('bbbbbbbb-0000-4000-a000-000000000002', 'pend.leitor@example.com'),   -- leitor Jurídico (responsável)
  ('bbbbbbbb-0000-4000-a000-000000000003', 'pend.rh@example.com');       -- editor RH (sem acesso)

update public.perfis set papel = 'editor' where id in ('bbbbbbbb-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000003');
update public.perfis set papel = 'leitor' where id = 'bbbbbbbb-0000-4000-a000-000000000002';

insert into public.usuario_categorias (usuario_id, categoria_id)
select u.id, c.id
from (values
  ('bbbbbbbb-0000-4000-a000-000000000001'::uuid, 'Jurídico'),
  ('bbbbbbbb-0000-4000-a000-000000000002'::uuid, 'Jurídico'),
  ('bbbbbbbb-0000-4000-a000-000000000003'::uuid, 'RH')
) as u (id, categoria)
join public.categorias c on c.nome = u.categoria and c.parent_id is null;

insert into public.documentos (id, titulo, tipo_id, categoria_id, storage_key, nome_arquivo, mime_type, tamanho_bytes, sha256, data_validade, aviso_dias)
select 'eeeeeeee-0000-4000-a000-000000000001', 'Licença de teste',
       (select id from public.tipos_documento where codigo = 'contrato'),
       sub.id, 'juridico/teste/pend.pdf', 'pend.pdf', 'application/pdf', 10, repeat('b', 64),
       current_date + 45, 60
from public.categorias sub
join public.categorias r on r.id = sub.parent_id
where r.nome = 'Jurídico' and sub.nome = 'Contratos';

create function pg_temp.logar(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p_uid::text, true);
$$;

-- A antecedência do documento (60 dias) define "a vencer", não mais os 30 dias fixos.
select is((select situacao from public.v_documentos where id = 'eeeeeeee-0000-4000-a000-000000000001'), 'a_vencer',
  'situação usa a antecedência do documento');

set local role authenticated;

-- ---------------------------------------------------------------------------
-- Editor da pasta cria a pendência e atribui ao leitor
-- ---------------------------------------------------------------------------
select pg_temp.logar('bbbbbbbb-0000-4000-a000-000000000001');
select lives_ok(
  $$insert into public.documento_pendencias (id, documento_id, titulo, prazo, responsavel_id)
    values ('ffffffff-0000-4000-a000-000000000001', 'eeeeeeee-0000-4000-a000-000000000001', 'Protocolar renovação',
            current_date - 1, 'bbbbbbbb-0000-4000-a000-000000000002')$$,
  'editor da pasta cria pendência');

-- ---------------------------------------------------------------------------
-- Leitor: não cria, mas conclui a pendência que é dele (e só isso)
-- ---------------------------------------------------------------------------
select pg_temp.logar('bbbbbbbb-0000-4000-a000-000000000002');
select throws_ok(
  $$insert into public.documento_pendencias (documento_id, titulo) values ('eeeeeeee-0000-4000-a000-000000000001', 'Outra')$$,
  '42501', null, 'leitor não cria pendência');

select is((select count(*)::int from public.central_pendencias('minhas') where tipo = 'acao' and estado = 'atrasado'), 1,
  'pendência atrasada aparece em "minhas" do responsável');

select throws_ok(
  $$update public.documento_pendencias set titulo = 'Mudou' where id = 'ffffffff-0000-4000-a000-000000000001'$$,
  '42501', 'Como responsável, você pode apenas concluir ou reabrir esta pendência.',
  'responsável sem edição não altera o texto');

update public.documento_pendencias set concluida_em = now() where id = 'ffffffff-0000-4000-a000-000000000001';
select isnt((select concluida_por from public.documento_pendencias where id = 'ffffffff-0000-4000-a000-000000000001'), null,
  'responsável conclui a própria pendência (concluida_por preenchido)');

select is((select count(*)::int from public.central_pendencias('minhas') where tipo = 'acao'), 0,
  'pendência concluída sai da central');

-- ---------------------------------------------------------------------------
-- Usuário de outra área não enxerga
-- ---------------------------------------------------------------------------
select pg_temp.logar('bbbbbbbb-0000-4000-a000-000000000003');
select is((select count(*)::int from public.documento_pendencias where documento_id = 'eeeeeeee-0000-4000-a000-000000000001'), 0,
  'quem não tem acesso à pasta não vê as pendências');

reset role;
select is(
  (select count(*)::int from public.historico where entidade = 'pendencia' and entidade_id = 'ffffffff-0000-4000-a000-000000000001'),
  2, 'criação e conclusão ficam no histórico do documento');

select * from finish();
rollback;
