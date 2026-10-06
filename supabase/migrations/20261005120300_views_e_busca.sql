-- =============================================================================
-- View de documentos, pesquisa, busca semântica (RAG) e resumos do painel.
-- Tudo SECURITY INVOKER: respeita a RLS de quem consulta.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- v_documentos: documento + nomes relacionados + situação calculada.
-- Exclui documentos da lixeira.
--   situacao: vigente | a_vencer (≤ 30 dias) | vencido | sem_validade | arquivado | cancelado
-- -----------------------------------------------------------------------------
create view public.v_documentos
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
    when d.data_validade <= current_date + 30             then 'a_vencer'
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
  -- Texto usado na pesquisa por palavras (nome, descrição, classificação, empresas, tags e campos personalizados)
  concat_ws(' ',
    d.titulo, d.descricao, d.nome_arquivo, t.nome, avo.nome, pai.nome, c.nome,
    e.razao_social, e.nome_fantasia, cp.razao_social, cp.nome_fantasia, f.nome, s.nome,
    tg.tags_texto,
    (select string_agg(m.value, ' ') from jsonb_each_text(d.metadados) m)
  ) as texto_busca
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
left join lateral (
  select
    jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome, 'cor', x.cor) order by x.nome) as tags,
    string_agg(x.nome, ' ') as tags_texto
  from public.documento_tags dt
  join public.tags x on x.id = dt.tag_id
  where dt.documento_id = d.id
) tg on true
where d.excluido_em is null;

-- -----------------------------------------------------------------------------
-- pesquisar_documentos: pesquisa por palavras (metadados + conteúdo do arquivo,
-- sem acentos e com radicais em português) combinada com filtros.
-- Ex.: "contrato fornecedor agricola" + categoria Jurídico + situação vigente.
-- Devolve {"total": n, "itens": [...]}.
-- -----------------------------------------------------------------------------
create function public.pesquisar_documentos(
  p_termo           text default null,
  p_categoria       uuid default null,   -- inclui subcategorias
  p_tipo            uuid default null,
  p_tipo_codigo     text default null,
  p_empresa         uuid default null,
  p_contraparte     uuid default null,
  p_empresa_ou_contraparte uuid default null, -- "documentos relacionados ao fornecedor X"
  p_filial          uuid default null,
  p_setor           uuid default null,
  p_responsavel     uuid default null,
  p_tags            uuid[] default null, -- qualquer uma das tags
  p_situacao        text default null,
  p_data_de         date default null,
  p_data_ate        date default null,
  p_validade_de     date default null,
  p_validade_ate    date default null,
  p_ordem           text default null,   -- relevancia | recentes | validade | nome
  p_limite          int default 20,
  p_deslocamento    int default 0
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with parametros as (
    select
      nullif(btrim(coalesce(p_termo, '')), '') as termo,
      coalesce(p_ordem, case when nullif(btrim(coalesce(p_termo, '')), '') is null then 'recentes' else 'relevancia' end) as ordem,
      least(greatest(coalesce(p_limite, 20), 1), 100) as limite,
      greatest(coalesce(p_deslocamento, 0), 0) as deslocamento
  ),
  consulta as (
    select
      p.*,
      -- OU entre os termos (perguntas raramente têm todas as palavras) …
      case
        when p.termo is null or numnode(plainto_tsquery('public.portugues', p.termo)) = 0 then null
        else regexp_replace(plainto_tsquery('public.portugues', p.termo)::text, ' (&|<->|<\d+>) ', ' | ', 'g')::tsquery
      end as q_algum,
      -- … e bônus quando todas aparecem.
      case when p.termo is null then null else plainto_tsquery('public.portugues', p.termo) end as q_todos,
      lower(extensions.unaccent(coalesce(p.termo, ''))) as termo_simples
    from parametros p
  ),
  filtrados as (
    select
      v.*,
      coalesce(case when q.q_algum is not null and tv.vetor @@ q.q_algum then ts_rank_cd(tv.vetor, q.q_algum) end, 0)
        + case when q.q_todos is not null and numnode(q.q_todos) > 0 and tv.vetor @@ q.q_todos then 1 else 0 end
        + case when q.termo is not null and lower(extensions.unaccent(v.titulo)) like '%' || q.termo_simples || '%' then 2 else 0 end
        + coalesce(cont.rank_conteudo, 0) as relevancia,
      cont.rank_conteudo is not null as encontrado_no_conteudo
    from public.v_documentos v
    cross join consulta q
    cross join lateral (select to_tsvector('public.portugues', v.texto_busca) as vetor) tv
    left join lateral (
      select max(ts_rank_cd(ch.fts, q.q_algum)) * 0.5 as rank_conteudo
      from public.documento_chunks ch
      where q.q_algum is not null and ch.documento_id = v.id and ch.fts @@ q.q_algum
    ) cont on true
    where (p_categoria is null or p_categoria in (v.categoria_id, v.categoria_pai_id, v.categoria_avo_id))
      and (p_tipo is null or v.tipo_id = p_tipo)
      and (p_tipo_codigo is null or v.tipo_codigo = p_tipo_codigo)
      and (p_empresa is null or v.empresa_id = p_empresa)
      and (p_contraparte is null or v.contraparte_id = p_contraparte)
      and (p_empresa_ou_contraparte is null or p_empresa_ou_contraparte in (v.empresa_id, v.contraparte_id))
      and (p_filial is null or v.filial_id = p_filial)
      and (p_setor is null or v.setor_id = p_setor)
      and (p_responsavel is null or v.responsavel_id = p_responsavel)
      and (p_tags is null or cardinality(p_tags) = 0
           or exists (select 1 from public.documento_tags dt where dt.documento_id = v.id and dt.tag_id = any (p_tags)))
      and (p_situacao is null or v.situacao = p_situacao)
      and (p_data_de is null or v.data_documento >= p_data_de)
      and (p_data_ate is null or v.data_documento <= p_data_ate)
      and (p_validade_de is null or v.data_validade >= p_validade_de)
      and (p_validade_ate is null or v.data_validade <= p_validade_ate)
      and (
        q.termo is null
        or (q.q_algum is not null and tv.vetor @@ q.q_algum)
        or cont.rank_conteudo is not null
        or lower(extensions.unaccent(v.texto_busca)) like '%' || q.termo_simples || '%'
      )
  ),
  ordenados as (
    select
      f.*,
      count(*) over () as total_geral,
      row_number() over (
        order by
          case when q.ordem = 'relevancia' then f.relevancia end desc nulls last,
          case when q.ordem = 'validade' then f.data_validade end asc nulls last,
          case when q.ordem = 'nome' then lower(f.titulo) end asc nulls last,
          f.criado_em desc,
          f.id
      ) as posicao
    from filtrados f
    cross join consulta q
  )
  select jsonb_build_object(
    'total', coalesce((select max(o.total_geral) from ordenados o), 0),
    'itens', coalesce((
      select jsonb_agg(to_jsonb(o) - 'texto_busca' - 'total_geral' - 'posicao' order by o.posicao)
      from ordenados o, parametros p
      where o.posicao > p.deslocamento and o.posicao <= p.deslocamento + p.limite
    ), '[]'::jsonb)
  );
$$;

-- -----------------------------------------------------------------------------
-- buscar_trechos: busca HÍBRIDA para o RAG = vetor (gte-small) + texto (português,
-- sem acento), combinados por Reciprocal Rank Fusion. O gte-small foi treinado em
-- inglês; a parte textual compensa nomes, números e termos em português.
-- -----------------------------------------------------------------------------
create function public.buscar_trechos(
  query_embedding  extensions.vector(384),
  query_texto      text,
  limite           int default 8,
  filtro_categoria uuid default null,   -- inclui subcategorias
  filtro_documento uuid default null,
  filtro_tipo      text default null,   -- código do tipo
  filtro_empresa   uuid default null,   -- empresa ou contraparte
  peso_texto       float default 1.0,
  peso_semantico   float default 1.0,
  rrf_k            int default 50
)
returns table (
  chunk_id     bigint,
  documento_id uuid,
  ordem        int,
  pagina       int,
  conteudo     text,
  score        float
)
language sql
stable
security invoker
set search_path = ''
as $$
  with candidatos as (
    select c.id
    from public.documento_chunks c
    join public.v_documentos v on v.id = c.documento_id
    where (filtro_categoria is null or filtro_categoria in (v.categoria_id, v.categoria_pai_id, v.categoria_avo_id))
      and (filtro_documento is null or v.id = filtro_documento)
      and (filtro_tipo is null or v.tipo_codigo = filtro_tipo)
      and (filtro_empresa is null or filtro_empresa in (v.empresa_id, v.contraparte_id))
  ),
  consulta as (
    select case
      when numnode(plainto_tsquery('public.portugues', coalesce(query_texto, ''))) = 0 then null
      else regexp_replace(plainto_tsquery('public.portugues', query_texto)::text, ' (&|<->|<\d+>) ', ' | ', 'g')::tsquery
    end as q
  ),
  texto as (
    select c.id,
           row_number() over (order by ts_rank_cd(c.fts, consulta.q) desc) as rank_ix
    from public.documento_chunks c, consulta
    where consulta.q is not null
      and c.id in (select id from candidatos)
      and c.fts @@ consulta.q
    order by rank_ix
    limit least(limite, 30) * 2
  ),
  semantico as (
    select c.id,
           row_number() over (order by c.embedding operator(extensions.<#>) query_embedding) as rank_ix
    from public.documento_chunks c
    where query_embedding is not null
      and c.embedding is not null
      and c.id in (select id from candidatos)
    order by rank_ix
    limit least(limite, 30) * 2
  )
  select c.id,
         c.documento_id,
         c.ordem,
         c.pagina,
         c.conteudo,
         (coalesce(1.0 / (rrf_k + t.rank_ix), 0.0) * peso_texto
          + coalesce(1.0 / (rrf_k + s.rank_ix), 0.0) * peso_semantico)::float as score
  from texto t
  full outer join semantico s on s.id = t.id
  join public.documento_chunks c on c.id = coalesce(t.id, s.id)
  order by score desc
  limit least(limite, 30);
$$;

-- -----------------------------------------------------------------------------
-- Painel: contadores gerais
-- -----------------------------------------------------------------------------
create function public.resumo_painel()
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
    'enviados_ultimos_30d',  count(*) filter (where criado_em >= now() - interval '30 days')
  )
  from public.v_documentos;
$$;

-- Quantidade de documentos por categoria (cada documento conta também nas categorias acima dele).
create function public.contagem_por_categoria()
returns table (categoria_id uuid, total bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select x.categoria_id, count(*) as total
  from (
    select v.categoria_id from public.v_documentos v
    union all
    select v.categoria_pai_id from public.v_documentos v where v.categoria_pai_id is not null
    union all
    select v.categoria_avo_id from public.v_documentos v where v.categoria_avo_id is not null
  ) x
  group by x.categoria_id;
$$;

revoke execute on function
  public.pesquisar_documentos(text, uuid, uuid, text, uuid, uuid, uuid, uuid, uuid, uuid, uuid[], text, date, date, date, date, text, int, int),
  public.buscar_trechos(extensions.vector, text, int, uuid, uuid, text, uuid, float, float, int),
  public.resumo_painel(),
  public.contagem_por_categoria()
  from public, anon;
grant execute on function
  public.pesquisar_documentos(text, uuid, uuid, text, uuid, uuid, uuid, uuid, uuid, uuid, uuid[], text, date, date, date, date, text, int, int),
  public.buscar_trechos(extensions.vector, text, int, uuid, uuid, text, uuid, float, float, int),
  public.resumo_painel(),
  public.contagem_por_categoria()
  to authenticated, service_role;
