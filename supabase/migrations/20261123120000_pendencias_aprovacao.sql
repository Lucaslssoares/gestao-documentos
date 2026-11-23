-- =============================================================================
-- Prazos e pendências, aprovação, revisão periódica e central de pendências.
--
--   * Pendência = ação ligada a um documento (condicionante, prazo de renovação,
--     entrega...) com responsável e prazo opcional. Um "prazo" é uma pendência com data.
--   * Aprovação: quem cadastra escolhe um aprovador; o tipo pode tornar obrigatório.
--   * Revisão periódica: próxima revisão calculada a partir de "revisar a cada N meses".
--   * central_pendencias(): junta ações, validades, revisões e aprovações numa lista só
--     (tela Pendências, Início e alertas por e-mail).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tipos: padrões de aprovação e revisão para o cadastro
-- -----------------------------------------------------------------------------
alter table public.tipos_documento
  add column exige_aprovacao boolean not null default false,
  add column revisao_meses   int check (revisao_meses between 1 and 120);

-- -----------------------------------------------------------------------------
-- Documentos: antecedência do aviso de validade, aprovação e revisão
-- -----------------------------------------------------------------------------
alter table public.documentos
  add column aviso_dias              int not null default 30 check (aviso_dias between 1 and 365),
  add column aprovacao               text not null default 'nao_exige'
    check (aprovacao in ('nao_exige', 'pendente', 'aprovado', 'reprovado')),
  add column aprovador_id            uuid references public.perfis (id) on delete set null,
  add column aprovacao_solicitada_em timestamptz,
  add column aprovado_por            uuid references auth.users (id) on delete set null,
  add column aprovado_em             timestamptz,
  add column comentario_aprovacao    text,
  add column revisao_meses           int check (revisao_meses between 1 and 120),
  add column proxima_revisao         date,
  add column ultima_revisao          date;

create index documentos_aprovador_idx on public.documentos (aprovador_id) where aprovacao = 'pendente';
create index documentos_proxima_revisao_idx on public.documentos (proxima_revisao)
  where excluido_em is null and proxima_revisao is not null;

-- Campos recalculados automaticamente não aparecem como "alteração" no histórico.
create or replace function public.campos_tecnicos()
returns text[]
language sql immutable set search_path = ''
as $$
  select array[
    'atualizado_em', 'atualizado_por', 'status_processamento', 'erro_processamento', 'processado_em', 'paginas',
    'raiz_id', 'storage_key', 'sha256', 'excluido_por',
    'proxima_revisao', 'aprovacao_solicitada_em', 'aprovado_por', 'aprovado_em'
  ];
$$;

-- Histórico do documento: nomeia aprovação e revisão (o resto continua igual).
create or replace function public.registrar_historico_documento()
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
    elsif new.aprovacao in ('aprovado', 'reprovado') and new.aprovacao is distinct from old.aprovacao then
      v_acao := case when new.aprovacao = 'aprovado' then 'aprovar' else 'reprovar' end;
      v_detalhes := jsonb_build_object('comentario', new.comentario_aprovacao);
    elsif new.aprovacao = 'pendente' and old.aprovacao is distinct from 'pendente' then
      v_acao := 'solicitar_aprovacao';
      v_detalhes := jsonb_build_object('aprovador', (select p.nome from public.perfis p where p.id = new.aprovador_id));
    elsif new.ultima_revisao is distinct from old.ultima_revisao then
      v_acao := 'revisar';
      v_detalhes := jsonb_build_object('proxima_revisao', new.proxima_revisao);
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

-- -----------------------------------------------------------------------------
-- Pendências do documento
-- -----------------------------------------------------------------------------
create table public.documento_pendencias (
  id             uuid primary key default gen_random_uuid(),
  documento_id   uuid not null references public.documentos (id) on delete cascade,
  titulo         text not null check (btrim(titulo) <> '' and char_length(titulo) <= 300),
  descricao      text,
  prazo          date,
  aviso_dias     int not null default 7 check (aviso_dias between 0 and 365),
  responsavel_id uuid references public.perfis (id) on delete set null,
  concluida_em   timestamptz,
  concluida_por  uuid references auth.users (id) on delete set null,
  criado_por     uuid default auth.uid() references auth.users (id) on delete set null,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create index documento_pendencias_documento_idx on public.documento_pendencias (documento_id);
create index documento_pendencias_abertas_idx on public.documento_pendencias (responsavel_id, prazo)
  where concluida_em is null;

-- Quem só é responsável (sem poder editar o documento) pode apenas concluir ou reabrir.
create function public.pendencias_antes_de_gravar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  if new.concluida_em is distinct from old.concluida_em then
    new.concluida_por := case when new.concluida_em is null then null else auth.uid() end;
  end if;

  if auth.uid() is not null and not public.pode_editar_documento(old.documento_id) then
    if (to_jsonb(new) - array['concluida_em', 'concluida_por', 'atualizado_em'])
       is distinct from (to_jsonb(old) - array['concluida_em', 'concluida_por', 'atualizado_em']) then
      raise exception 'Como responsável, você pode apenas concluir ou reabrir esta pendência.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger pendencias_antes_de_gravar
  before update on public.documento_pendencias
  for each row execute function public.pendencias_antes_de_gravar();

-- Histórico: pendências aparecem na linha do tempo do documento.
create function public.registrar_historico_pendencia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_documento uuid := coalesce(new.documento_id, old.documento_id);
  v_raiz      uuid;
  v_acao      text;
begin
  select d.raiz_id into v_raiz from public.documentos d where d.id = v_documento;
  if v_raiz is null then
    return null;  -- documento sendo excluído definitivamente (cascade)
  end if;

  if tg_op = 'INSERT' then
    v_acao := 'criar_pendencia';
  elsif tg_op = 'DELETE' then
    v_acao := 'remover_pendencia';
  elsif new.concluida_em is not null and old.concluida_em is null then
    v_acao := 'concluir_pendencia';
  elsif new.concluida_em is null and old.concluida_em is not null then
    v_acao := 'reabrir_pendencia';
  else
    v_acao := 'atualizar_pendencia';
  end if;

  insert into public.historico (ator_id, acao, entidade, entidade_id, documento_id, raiz_id, detalhes)
  values (
    auth.uid(), v_acao, 'pendencia', coalesce(new.id, old.id)::text, v_documento, v_raiz,
    jsonb_build_object('pendencia', coalesce(new.titulo, old.titulo), 'prazo', coalesce(new.prazo, old.prazo))
  );
  return null;
end;
$$;

create trigger documento_pendencias_historico
  after insert or update or delete on public.documento_pendencias
  for each row execute function public.registrar_historico_pendencia();

alter table public.documento_pendencias enable row level security;
revoke all on public.documento_pendencias from anon;

create policy documento_pendencias_select on public.documento_pendencias
  for select to authenticated using (public.tem_acesso_documento(documento_id));
create policy documento_pendencias_insert on public.documento_pendencias
  for insert to authenticated with check (public.pode_editar_documento(documento_id));
create policy documento_pendencias_update on public.documento_pendencias
  for update to authenticated
  using (public.pode_editar_documento(documento_id) or responsavel_id = auth.uid())
  with check (public.pode_editar_documento(documento_id) or responsavel_id = auth.uid());
create policy documento_pendencias_delete on public.documento_pendencias
  for delete to authenticated using (public.pode_editar_documento(documento_id));

-- -----------------------------------------------------------------------------
-- Alertas por e-mail já enviados (evita repetir o mesmo aviso). Só a service role.
-- -----------------------------------------------------------------------------
create table public.notificacoes_enviadas (
  chave      text primary key,
  enviado_em timestamptz not null default now()
);
alter table public.notificacoes_enviadas enable row level security;
revoke all on public.notificacoes_enviadas from anon, authenticated;

-- -----------------------------------------------------------------------------
-- v_documentos: colunas novas no fim; "a vencer" usa a antecedência do documento.
-- -----------------------------------------------------------------------------
create or replace view public.v_documentos
with (security_invoker = true)
as
select
  d.id,
  d.titulo,
  d.descricao,
  d.tipo_id,
  t.codigo  as tipo_codigo,
  t.nome    as tipo_nome,
  d.categoria_id,
  c.nome    as categoria_nome,
  c.parent_id as categoria_pai_id,
  pai.parent_id as categoria_avo_id,
  concat_ws(' › ', avo.nome, pai.nome, c.nome) as categoria_caminho,
  d.raiz_id,
  r.nome    as raiz_nome,
  r.icone   as raiz_icone,
  r.cor     as raiz_cor,
  d.empresa_id,
  coalesce(e.nome_fantasia, e.razao_social) as empresa_nome,
  d.filial_id,
  f.nome    as filial_nome,
  d.setor_id,
  s.nome    as setor_nome,
  d.contraparte_id,
  coalesce(cp.nome_fantasia, cp.razao_social) as contraparte_nome,
  d.responsavel_id,
  resp.nome as responsavel_nome,
  d.data_documento,
  d.data_validade,
  d.status,
  case
    when d.status <> 'ativo'                              then d.status::text
    when d.data_validade is null                          then 'sem_validade'
    when d.data_validade < current_date                   then 'vencido'
    when d.data_validade <= current_date + d.aviso_dias   then 'a_vencer'
    else 'vigente'
  end as situacao,
  case when d.data_validade is not null then d.data_validade - current_date end as dias_para_vencer,
  d.metadados,
  coalesce(tg.tags, '[]'::jsonb) as tags,
  d.versao_atual,
  d.nome_arquivo,
  d.mime_type,
  d.tamanho_bytes,
  d.status_processamento,
  d.erro_processamento,
  d.paginas,
  d.criado_por,
  autor.nome as criado_por_nome,
  d.criado_em,
  d.atualizado_em,
  concat_ws(' ',
    d.titulo, d.descricao, d.nome_arquivo, t.nome, avo.nome, pai.nome, c.nome,
    e.razao_social, e.nome_fantasia, cp.razao_social, cp.nome_fantasia, f.nome, s.nome,
    tg.tags_texto,
    (select string_agg(m.value, ' ') from jsonb_each_text(d.metadados) m)
  ) as texto_busca,
  -- colunas novas (20261123120000)
  d.aviso_dias,
  d.aprovacao,
  d.aprovador_id,
  aprov.nome as aprovador_nome,
  d.aprovacao_solicitada_em,
  d.aprovado_em,
  d.comentario_aprovacao,
  d.revisao_meses,
  d.proxima_revisao,
  d.ultima_revisao,
  coalesce(pend.abertas, 0) as pendencias_abertas
from public.documentos d
join public.tipos_documento t on t.id = d.tipo_id
join public.categorias c on c.id = d.categoria_id
join public.categorias r on r.id = d.raiz_id
left join public.categorias pai on pai.id = c.parent_id
left join public.categorias avo on avo.id = pai.parent_id
left join public.empresas e on e.id = d.empresa_id
left join public.empresas cp on cp.id = d.contraparte_id
left join public.filiais f on f.id = d.filial_id
left join public.setores s on s.id = d.setor_id
left join public.perfis resp on resp.id = d.responsavel_id
left join public.perfis autor on autor.id = d.criado_por
left join public.perfis aprov on aprov.id = d.aprovador_id
left join lateral (
  select
    jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome, 'cor', x.cor) order by x.nome) as tags,
    string_agg(x.nome, ' ') as tags_texto
  from public.documento_tags dt
  join public.tags x on x.id = dt.tag_id
  where dt.documento_id = d.id
) tg on true
left join lateral (
  select count(*)::int as abertas
  from public.documento_pendencias p
  where p.documento_id = d.id and p.concluida_em is null
) pend on true
where d.excluido_em is null;

-- -----------------------------------------------------------------------------
-- central_pendencias: tudo o que pede ação, numa lista só.
--   tipo:   acao | validade | revisao | aprovacao
--   estado: atrasado | proximo | futuro
--   p_escopo 'minhas' → só o que é do usuário (responsável ou aprovador); 'todas' → o que a RLS deixa ver.
-- -----------------------------------------------------------------------------
create function public.central_pendencias(p_escopo text default 'minhas')
returns table (
  tipo             text,
  chave            text,
  documento_id     uuid,
  documento_titulo text,
  raiz_nome        text,
  raiz_cor         text,
  titulo           text,
  data             date,
  dias             int,
  aviso_dias       int,
  estado           text,
  responsavel_id   uuid,
  responsavel_nome text,
  pendencia_id     uuid,
  minha            boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with itens as (
    select 'acao' as tipo, 'acao:' || p.id as chave, d.id as documento_id, d.titulo as documento_titulo,
           d.raiz_nome, d.raiz_cor, p.titulo, p.prazo as data, p.aviso_dias,
           p.responsavel_id, rp.nome as responsavel_nome, p.id as pendencia_id
    from public.documento_pendencias p
    join public.v_documentos d on d.id = p.documento_id
    left join public.perfis rp on rp.id = p.responsavel_id
    where p.concluida_em is null
    union all
    select 'validade', 'validade:' || d.id, d.id, d.titulo, d.raiz_nome, d.raiz_cor,
           case when d.situacao = 'vencido' then 'Documento vencido' else 'Documento a vencer' end,
           d.data_validade, d.aviso_dias, d.responsavel_id, d.responsavel_nome, null::uuid
    from public.v_documentos d
    where d.situacao in ('a_vencer', 'vencido')
    union all
    select 'revisao', 'revisao:' || d.id, d.id, d.titulo, d.raiz_nome, d.raiz_cor, 'Revisão periódica',
           d.proxima_revisao, 30, d.responsavel_id, d.responsavel_nome, null::uuid
    from public.v_documentos d
    where d.status = 'ativo' and d.proxima_revisao is not null and d.proxima_revisao <= current_date + 30
    union all
    select 'aprovacao', 'aprovacao:' || d.id, d.id, d.titulo, d.raiz_nome, d.raiz_cor, 'Aprovar documento',
           null::date, 0, d.aprovador_id, d.aprovador_nome, null::uuid
    from public.v_documentos d
    where d.aprovacao = 'pendente'
  )
  select
    i.tipo, i.chave, i.documento_id, i.documento_titulo, i.raiz_nome, i.raiz_cor, i.titulo, i.data,
    (i.data - current_date)::int as dias,
    i.aviso_dias,
    case
      when i.tipo = 'aprovacao'                        then 'proximo'
      when i.data is null                              then 'futuro'
      when i.data < current_date                       then 'atrasado'
      when i.data <= current_date + i.aviso_dias       then 'proximo'
      else 'futuro'
    end as estado,
    i.responsavel_id, i.responsavel_nome, i.pendencia_id,
    coalesce(i.responsavel_id = auth.uid(), false) as minha
  from itens i
  where coalesce(p_escopo, 'minhas') = 'todas' or i.responsavel_id = auth.uid()
  order by
    case
      when i.tipo = 'aprovacao' then 1
      when i.data is null then 3
      when i.data < current_date then 0
      when i.data <= current_date + i.aviso_dias then 1
      else 2
    end,
    i.data nulls last,
    i.documento_titulo;
$$;

-- Painel: contadores (+ minhas_pendencias: atrasadas ou próximas que são do usuário).
create or replace function public.resumo_painel()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'documentos',            count(*),
    'vencendo',              count(*) filter (where situacao = 'a_vencer'),
    'vencidos',              count(*) filter (where situacao = 'vencido'),
    'em_processamento',      count(*) filter (where status_processamento in ('pendente', 'processando')),
    'erros_processamento',   count(*) filter (where status_processamento = 'erro'),
    'pendencias',            count(*) filter (where situacao = 'vencido' or status_processamento = 'erro'),
    'enviados_ultimos_30d',  count(*) filter (where criado_em >= now() - interval '30 days'),
    'minhas_pendencias',     (select count(*) from public.central_pendencias('minhas') c where c.estado in ('atrasado', 'proximo'))
  )
  from public.v_documentos;
$$;

-- -----------------------------------------------------------------------------
-- Permissões das funções
-- -----------------------------------------------------------------------------
revoke execute on function public.central_pendencias(text) from public, anon;
grant execute on function public.central_pendencias(text) to authenticated, service_role;

revoke execute on function public.pendencias_antes_de_gravar(), public.registrar_historico_pendencia()
  from public, anon, authenticated;
