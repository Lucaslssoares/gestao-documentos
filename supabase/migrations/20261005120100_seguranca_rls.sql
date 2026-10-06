-- =============================================================================
-- Segurança: controle de acesso por CATEGORIA RAIZ + PERFIL, aplicado com RLS.
--
--   admin   → tudo (inclusive cadastros base e usuários)
--   gestor  → nas categorias liberadas: ler, cadastrar, alterar, mover, excluir/restaurar
--   editor  → nas categorias liberadas: ler, cadastrar, alterar, mover, substituir arquivo
--   leitor  → nas categorias liberadas: ler, visualizar e baixar
--
-- O backend acessa o banco com o JWT do usuário, então estas regras valem também
-- para o assistente de IA. A service role (pipeline) ignora a RLS por definição.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Funções auxiliares (security definer: leem perfis/acessos sem depender da RLS deles)
-- -----------------------------------------------------------------------------
create function public.papel_atual()
returns public.papel
language sql stable security definer set search_path = ''
as $$
  select p.papel from public.perfis p where p.id = auth.uid() and p.ativo;
$$;

create function public.usuario_ativo()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.perfis p where p.id = auth.uid() and p.ativo);
$$;

create function public.tem_acesso_raiz(p_raiz uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.perfis p
    where p.id = auth.uid()
      and p.ativo
      and (
        p.papel = 'admin'
        or exists (select 1 from public.usuario_categorias uc where uc.usuario_id = p.id and uc.categoria_id = p_raiz)
      )
  );
$$;

create function public.pode_editar_raiz(p_raiz uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.perfis p
    where p.id = auth.uid()
      and p.ativo
      and (
        p.papel = 'admin'
        or (p.papel in ('gestor', 'editor')
            and exists (select 1 from public.usuario_categorias uc where uc.usuario_id = p.id and uc.categoria_id = p_raiz))
      )
  );
$$;

create function public.pode_excluir_raiz(p_raiz uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.perfis p
    where p.id = auth.uid()
      and p.ativo
      and (
        p.papel = 'admin'
        or (p.papel = 'gestor'
            and exists (select 1 from public.usuario_categorias uc where uc.usuario_id = p.id and uc.categoria_id = p_raiz))
      )
  );
$$;

-- Atalhos para tabelas filhas do documento (versões, tags).
create function public.tem_acesso_documento(p_documento uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.documentos d where d.id = p_documento and public.tem_acesso_raiz(d.raiz_id));
$$;

create function public.pode_editar_documento(p_documento uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.documentos d where d.id = p_documento and public.pode_editar_raiz(d.raiz_id));
$$;

revoke execute on function
  public.papel_atual(), public.usuario_ativo(),
  public.tem_acesso_raiz(uuid), public.pode_editar_raiz(uuid), public.pode_excluir_raiz(uuid),
  public.tem_acesso_documento(uuid), public.pode_editar_documento(uuid)
  from public, anon;
grant execute on function
  public.papel_atual(), public.usuario_ativo(),
  public.tem_acesso_raiz(uuid), public.pode_editar_raiz(uuid), public.pode_excluir_raiz(uuid),
  public.tem_acesso_documento(uuid), public.pode_editar_documento(uuid)
  to authenticated, service_role;

-- Funções de trigger não são chamáveis pela API.
revoke execute on function
  public.criar_perfil_novo_usuario(), public.categorias_definir_hierarquia(), public.categorias_propagar_hierarquia(),
  public.validar_categoria_raiz(), public.documentos_antes_de_gravar(), public.documentos_propagar_raiz(),
  public.tocar_atualizado_em()
  from public, anon, authenticated;

-- Nada é acessível sem login.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- -----------------------------------------------------------------------------
-- Habilita RLS em todas as tabelas
-- -----------------------------------------------------------------------------
alter table public.setores            enable row level security;
alter table public.perfis             enable row level security;
alter table public.categorias         enable row level security;
alter table public.usuario_categorias enable row level security;
alter table public.empresas           enable row level security;
alter table public.filiais            enable row level security;
alter table public.tags               enable row level security;
alter table public.tipos_documento    enable row level security;
alter table public.documentos         enable row level security;
alter table public.documento_versoes  enable row level security;
alter table public.documento_tags     enable row level security;
alter table public.documento_chunks   enable row level security;
alter table public.chat_conversas     enable row level security;
alter table public.chat_mensagens     enable row level security;

-- -----------------------------------------------------------------------------
-- Usuários e acessos
-- -----------------------------------------------------------------------------
create policy perfis_select on public.perfis
  for select to authenticated
  using (id = auth.uid() or (select public.usuario_ativo()));
create policy perfis_update_admin on public.perfis
  for update to authenticated
  using ((select public.papel_atual()) = 'admin')
  with check ((select public.papel_atual()) = 'admin');

create policy usuario_categorias_select on public.usuario_categorias
  for select to authenticated
  using (usuario_id = auth.uid() or (select public.papel_atual()) = 'admin');
create policy usuario_categorias_admin on public.usuario_categorias
  for all to authenticated
  using ((select public.papel_atual()) = 'admin')
  with check ((select public.papel_atual()) = 'admin');

-- -----------------------------------------------------------------------------
-- Categorias: cada usuário só enxerga as árvores liberadas para ele; só admin altera.
-- -----------------------------------------------------------------------------
create policy categorias_select on public.categorias
  for select to authenticated
  using (public.tem_acesso_raiz(raiz_id));
create policy categorias_admin on public.categorias
  for all to authenticated
  using ((select public.papel_atual()) = 'admin')
  with check ((select public.papel_atual()) = 'admin');

-- -----------------------------------------------------------------------------
-- Cadastros de apoio: leitura para usuários ativos.
-- -----------------------------------------------------------------------------
create policy setores_select on public.setores
  for select to authenticated using ((select public.usuario_ativo()));
create policy setores_admin on public.setores
  for all to authenticated
  using ((select public.papel_atual()) = 'admin')
  with check ((select public.papel_atual()) = 'admin');

create policy tipos_documento_select on public.tipos_documento
  for select to authenticated using ((select public.usuario_ativo()));
create policy tipos_documento_admin on public.tipos_documento
  for all to authenticated
  using ((select public.papel_atual()) = 'admin')
  with check ((select public.papel_atual()) = 'admin');

create policy filiais_select on public.filiais
  for select to authenticated using ((select public.usuario_ativo()));
create policy filiais_admin on public.filiais
  for all to authenticated
  using ((select public.papel_atual()) = 'admin')
  with check ((select public.papel_atual()) = 'admin');

-- Empresas e tags podem ser criadas por quem cadastra documentos.
create policy empresas_select on public.empresas
  for select to authenticated using ((select public.usuario_ativo()));
create policy empresas_insert on public.empresas
  for insert to authenticated
  with check ((select public.papel_atual()) in ('admin', 'gestor', 'editor'));
create policy empresas_update on public.empresas
  for update to authenticated
  using ((select public.papel_atual()) in ('admin', 'gestor', 'editor'))
  with check ((select public.papel_atual()) in ('admin', 'gestor', 'editor'));
create policy empresas_delete on public.empresas
  for delete to authenticated
  using ((select public.papel_atual()) = 'admin');

create policy tags_select on public.tags
  for select to authenticated using ((select public.usuario_ativo()));
create policy tags_insert on public.tags
  for insert to authenticated
  with check ((select public.papel_atual()) in ('admin', 'gestor', 'editor'));
create policy tags_update on public.tags
  for update to authenticated
  using ((select public.papel_atual()) in ('admin', 'gestor'))
  with check ((select public.papel_atual()) in ('admin', 'gestor'));
create policy tags_delete on public.tags
  for delete to authenticated
  using ((select public.papel_atual()) in ('admin', 'gestor'));

-- -----------------------------------------------------------------------------
-- Documentos e dependentes: pela categoria raiz.
--   Exclusão física só para admin (o fluxo normal é a lixeira, controlada no trigger).
-- -----------------------------------------------------------------------------
create policy documentos_select on public.documentos
  for select to authenticated using (public.tem_acesso_raiz(raiz_id));
create policy documentos_insert on public.documentos
  for insert to authenticated with check (public.pode_editar_raiz(raiz_id));
create policy documentos_update on public.documentos
  for update to authenticated
  using (public.pode_editar_raiz(raiz_id))
  with check (public.pode_editar_raiz(raiz_id));
create policy documentos_delete on public.documentos
  for delete to authenticated using ((select public.papel_atual()) = 'admin');

create policy documento_versoes_select on public.documento_versoes
  for select to authenticated using (public.tem_acesso_documento(documento_id));
create policy documento_versoes_insert on public.documento_versoes
  for insert to authenticated with check (public.pode_editar_documento(documento_id));

create policy documento_tags_select on public.documento_tags
  for select to authenticated using (public.tem_acesso_documento(documento_id));
create policy documento_tags_insert on public.documento_tags
  for insert to authenticated with check (public.pode_editar_documento(documento_id));
create policy documento_tags_delete on public.documento_tags
  for delete to authenticated using (public.pode_editar_documento(documento_id));

-- Trechos (RAG): leitura pela raiz; escrita só pela service role (pipeline).
create policy documento_chunks_select on public.documento_chunks
  for select to authenticated using (public.tem_acesso_raiz(raiz_id));

-- -----------------------------------------------------------------------------
-- Chat: cada usuário só vê as próprias conversas.
-- -----------------------------------------------------------------------------
create policy chat_conversas_dono on public.chat_conversas
  for all to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

create policy chat_mensagens_dono on public.chat_mensagens
  for all to authenticated
  using (exists (select 1 from public.chat_conversas c where c.id = conversa_id and c.usuario_id = auth.uid()))
  with check (exists (select 1 from public.chat_conversas c where c.id = conversa_id and c.usuario_id = auth.uid()));
