-- =============================================================================
-- Histórico / auditoria ("quem enviou, alterou, moveu, substituiu, excluiu, visualizou")
--
-- Triggers registram tudo que passa pelas tabelas. O backend registra o que não
-- passa por elas: visualização, download, convite de usuário e uso do assistente.
-- =============================================================================

create table public.historico (
  id          bigint generated always as identity primary key,
  ator_id     uuid references auth.users (id) on delete set null,
  acao        text not null,
  entidade    text not null,
  entidade_id text,
  -- Documento e raiz (para a RLS e para a aba "Histórico" do documento)
  documento_id uuid,
  raiz_id     uuid,
  detalhes    jsonb not null default '{}'::jsonb,
  criado_em   timestamptz not null default now()
);
create index historico_documento_idx on public.historico (documento_id, criado_em desc) where documento_id is not null;
create index historico_entidade_idx on public.historico (entidade, entidade_id, criado_em desc);
create index historico_criado_em_idx on public.historico (criado_em desc);

-- Campos técnicos que mudam no processamento automático e não interessam ao usuário.
create function public.campos_tecnicos()
returns text[]
language sql immutable set search_path = ''
as $$
  select array[
    'atualizado_em', 'atualizado_por', 'status_processamento', 'erro_processamento', 'processado_em', 'paginas',
    'raiz_id', 'storage_key', 'sha256', 'excluido_por'
  ];
$$;

-- Diferença entre duas versões de uma linha: {"campo": {"de": ..., "para": ...}}
create function public.diferenca_jsonb(p_antigo jsonb, p_novo jsonb)
returns jsonb
language sql immutable set search_path = ''
as $$
  select coalesce(jsonb_object_agg(k, jsonb_build_object('de', p_antigo -> k, 'para', p_novo -> k)), '{}'::jsonb)
  from jsonb_object_keys(p_novo) as k
  where k <> all (public.campos_tecnicos())
    and (p_novo -> k) is distinct from (p_antigo -> k);
$$;

-- -----------------------------------------------------------------------------
-- Documentos: identifica a ação (criar, atualizar, mover, substituir_arquivo,
-- excluir → lixeira, restaurar, excluir_definitivo).
-- -----------------------------------------------------------------------------
create function public.registrar_historico_documento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acao     text;
  v_detalhes jsonb;
  v_linha    public.documentos;
begin
  if tg_op = 'INSERT' then
    v_linha := new;
    v_acao := 'criar';
    v_detalhes := jsonb_build_object(
      'titulo', new.titulo,
      'categoria', (select c.nome from public.categorias c where c.id = new.categoria_id),
      'tipo', (select t.nome from public.tipos_documento t where t.id = new.tipo_id),
      'arquivo', new.nome_arquivo
    );
  elsif tg_op = 'DELETE' then
    v_linha := old;
    v_acao := 'excluir_definitivo';
    v_detalhes := jsonb_build_object('titulo', old.titulo, 'arquivo', old.nome_arquivo);
  else
    v_linha := new;
    v_detalhes := public.diferenca_jsonb(to_jsonb(old), to_jsonb(new));
    if v_detalhes = '{}'::jsonb then
      return null;  -- só mudaram campos técnicos (ex.: processamento)
    end if;

    if new.excluido_em is not null and old.excluido_em is null then
      v_acao := 'excluir';
      v_detalhes := jsonb_build_object('titulo', new.titulo);
    elsif new.excluido_em is null and old.excluido_em is not null then
      v_acao := 'restaurar';
      v_detalhes := jsonb_build_object('titulo', new.titulo);
    elsif new.versao_atual <> old.versao_atual then
      v_acao := 'substituir_arquivo';
      v_detalhes := jsonb_build_object(
        'versao', jsonb_build_object('de', old.versao_atual, 'para', new.versao_atual),
        'arquivo', jsonb_build_object('de', old.nome_arquivo, 'para', new.nome_arquivo)
      );
    elsif new.categoria_id <> old.categoria_id then
      v_acao := 'mover';
      v_detalhes := v_detalhes || jsonb_build_object('categoria', jsonb_build_object(
        'de', (select c.nome from public.categorias c where c.id = old.categoria_id),
        'para', (select c.nome from public.categorias c where c.id = new.categoria_id)
      ));
    else
      v_acao := 'atualizar';
    end if;
  end if;

  insert into public.historico (ator_id, acao, entidade, entidade_id, documento_id, raiz_id, detalhes)
  values (auth.uid(), v_acao, 'documento', v_linha.id::text, v_linha.id, v_linha.raiz_id, v_detalhes);
  return null;
end;
$$;

create trigger documentos_historico
  after insert or update or delete on public.documentos
  for each row execute function public.registrar_historico_documento();

-- Tags adicionadas/removidas aparecem no histórico do documento.
create function public.registrar_historico_tags()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_documento uuid := coalesce(new.documento_id, old.documento_id);
  v_tag       uuid := coalesce(new.tag_id, old.tag_id);
  v_raiz      uuid;
begin
  select d.raiz_id into v_raiz from public.documentos d where d.id = v_documento;
  if v_raiz is null then
    return null;  -- documento sendo excluído definitivamente (cascade)
  end if;
  insert into public.historico (ator_id, acao, entidade, entidade_id, documento_id, raiz_id, detalhes)
  values (
    auth.uid(),
    case when tg_op = 'INSERT' then 'adicionar_tag' else 'remover_tag' end,
    'documento', v_documento::text, v_documento, v_raiz,
    jsonb_build_object('tag', (select t.nome from public.tags t where t.id = v_tag))
  );
  return null;
end;
$$;

create trigger documento_tags_historico
  after insert or delete on public.documento_tags
  for each row execute function public.registrar_historico_tags();

-- -----------------------------------------------------------------------------
-- Cadastros de apoio (categorias, tipos, empresas, filiais, setores, tags, acessos)
-- -----------------------------------------------------------------------------
create function public.registrar_historico_cadastro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acao     text;
  v_linha    jsonb;
  v_detalhes jsonb;
begin
  if tg_op = 'INSERT' then
    v_acao := 'criar';
    v_linha := to_jsonb(new);
    v_detalhes := v_linha - public.campos_tecnicos();
  elsif tg_op = 'UPDATE' then
    v_acao := 'atualizar';
    v_linha := to_jsonb(new);
    v_detalhes := public.diferenca_jsonb(to_jsonb(old), v_linha);
    if v_detalhes = '{}'::jsonb then
      return null;
    end if;
  else
    v_acao := 'excluir';
    v_linha := to_jsonb(old);
    v_detalhes := v_linha - public.campos_tecnicos();
  end if;

  insert into public.historico (ator_id, acao, entidade, entidade_id, detalhes)
  values (auth.uid(), v_acao, tg_argv[0], coalesce(v_linha ->> 'id', v_linha ->> 'usuario_id'), v_detalhes);
  return null;
end;
$$;

create trigger categorias_historico after insert or update or delete on public.categorias
  for each row execute function public.registrar_historico_cadastro('categoria');
create trigger tipos_documento_historico after insert or update or delete on public.tipos_documento
  for each row execute function public.registrar_historico_cadastro('tipo_documento');
create trigger empresas_historico after insert or update or delete on public.empresas
  for each row execute function public.registrar_historico_cadastro('empresa');
create trigger filiais_historico after insert or update or delete on public.filiais
  for each row execute function public.registrar_historico_cadastro('filial');
create trigger setores_historico after insert or update or delete on public.setores
  for each row execute function public.registrar_historico_cadastro('setor');
create trigger tags_historico after insert or update or delete on public.tags
  for each row execute function public.registrar_historico_cadastro('tag');
create trigger usuario_categorias_historico after insert or delete on public.usuario_categorias
  for each row execute function public.registrar_historico_cadastro('acesso_categoria');

revoke execute on function
  public.registrar_historico_documento(), public.registrar_historico_tags(), public.registrar_historico_cadastro()
  from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- RLS: histórico de documento → quem tem acesso à categoria raiz;
--      histórico de cadastros → admin e gestores.
-- Inserção apenas pelos triggers (security definer) e pela service role do backend.
-- -----------------------------------------------------------------------------
alter table public.historico enable row level security;
revoke all on public.historico from anon;

create policy historico_select on public.historico
  for select to authenticated
  using (
    (select public.usuario_ativo())
    and case
      when raiz_id is null then (select public.papel_atual()) in ('admin', 'gestor')
      else public.tem_acesso_raiz(raiz_id)
    end
  );
