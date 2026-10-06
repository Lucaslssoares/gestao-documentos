-- =============================================================================
-- Seed de DESENVOLVIMENTO (roda só no `supabase db reset` local — nunca em produção).
-- Empresas e CNPJs são fictícios.
--
-- Usuários (senha de todos: Senha@123)
--   admin@example.com        admin   — todas as categorias
--   juridico@example.com     gestor  — Jurídico e Suprimentos
--   financeiro@example.com   editor  — Financeiro e Fiscal
--   rh@example.com           leitor  — RH
--
-- Documentos de exemplo (com arquivos no MinIO): `npm run seed:demo` no backend.
-- =============================================================================

do $$
declare
  v_usuarios jsonb := '[
    {"id": "00000000-0000-4000-a000-000000000001", "email": "admin@example.com",      "nome": "Administrador"},
    {"id": "00000000-0000-4000-a000-000000000002", "email": "juridico@example.com",   "nome": "Lucas Jurídico"},
    {"id": "00000000-0000-4000-a000-000000000003", "email": "financeiro@example.com", "nome": "Ana Financeiro"},
    {"id": "00000000-0000-4000-a000-000000000004", "email": "rh@example.com",         "nome": "Rita RH"}
  ]';
  u jsonb;
begin
  for u in select * from jsonb_array_elements(v_usuarios) loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', (u ->> 'id')::uuid, 'authenticated', 'authenticated',
      u ->> 'email', extensions.crypt('Senha@123', extensions.gen_salt('bf')), now(),
      '{"provider": "email", "providers": ["email"]}', jsonb_build_object('nome', u ->> 'nome'), now(), now(),
      '', '', '', ''
    );

    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), (u ->> 'id')::uuid, u ->> 'id',
      jsonb_build_object('sub', u ->> 'id', 'email', u ->> 'email', 'email_verified', true),
      'email', now(), now(), now()
    );
  end loop;
end $$;

-- O trigger ao_criar_usuario criou os perfis como "leitor"; define papel, setor e acessos.
update public.perfis set papel = 'admin'
  where email = 'admin@example.com';
update public.perfis set papel = 'gestor', setor_id = (select id from public.setores where sigla = 'JUR')
  where email = 'juridico@example.com';
update public.perfis set papel = 'editor', setor_id = (select id from public.setores where sigla = 'FIN')
  where email = 'financeiro@example.com';
update public.perfis set papel = 'leitor', setor_id = (select id from public.setores where sigla = 'RH')
  where email = 'rh@example.com';

insert into public.usuario_categorias (usuario_id, categoria_id)
select p.id, c.id
from (values
  ('juridico@example.com', 'Jurídico'), ('juridico@example.com', 'Suprimentos'),
  ('financeiro@example.com', 'Financeiro'), ('financeiro@example.com', 'Fiscal'),
  ('rh@example.com', 'RH')
) as a (email, categoria)
join public.perfis p on p.email = a.email
join public.categorias c on c.nome = a.categoria and c.parent_id is null;

-- -----------------------------------------------------------------------------
-- Empresas (fictícias) e filiais
-- -----------------------------------------------------------------------------
insert into public.empresas (id, razao_social, nome_fantasia, cnpj, tipo, email) values
  ('10000000-0000-4000-a000-000000000001', 'Belém Bioenergia Brasil S.A.', 'Belém Bioenergia', '56789012000100', 'grupo', null),
  ('10000000-0000-4000-a000-000000000002', 'Arcon Engenharia Ltda.',       'Arcon',            '12345678000195', 'fornecedor', 'contato@arcon.example.com'),
  ('10000000-0000-4000-a000-000000000003', 'Norte Log Transportes Ltda.',  'Norte Log',        '23456789000195', 'fornecedor', 'comercial@nortelog.example.com'),
  ('10000000-0000-4000-a000-000000000004', 'Guamá Tecnologia S.A.',        'Guamá Tec',        '34567890000130', 'fornecedor', 'suporte@guama.example.com'),
  ('10000000-0000-4000-a000-000000000005', 'Ver-o-Peso Alimentos Ltda.',   'Ver-o-Peso',       '45678901000175', 'fornecedor', 'vendas@veropeso.example.com'),
  ('10000000-0000-4000-a000-000000000006', 'AgroPará Insumos Agrícolas Ltda.', 'AgroPará',     '67890123000116', 'fornecedor', 'vendas@agropara.example.com');

insert into public.filiais (empresa_id, nome, codigo, cidade, uf) values
  ('10000000-0000-4000-a000-000000000001', 'Matriz',             '0001', 'Belém', 'PA'),
  ('10000000-0000-4000-a000-000000000001', 'Unidade Agrícola',   '0002', null,    'PA'),
  ('10000000-0000-4000-a000-000000000001', 'Unidade Industrial', '0003', null,    'PA');

-- -----------------------------------------------------------------------------
-- Tags
-- -----------------------------------------------------------------------------
insert into public.tags (nome, cor) values
  ('Urgente', '#C67139'), ('Renovação', '#3D472B'), ('Auditoria 2026', '#8C491A'),
  ('Confidencial', '#201E1D'), ('Original físico', '#645C50');
