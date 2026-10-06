-- =============================================================================
-- Gestão de Documentos — schema inicial
--
-- O DOCUMENTO é a entidade central. Ele é organizado por:
--   categoria (árvore de até 3 níveis: Jurídico › Contratos › ...), tipo (com campos
--   personalizados), tags, empresa/filial, setor responsável, contraparte, responsável,
--   datas e validade. O arquivo fica no MinIO (storage_key) e cada substituição gera
--   uma nova versão. Contratos e notas fiscais são TIPOS de documento, não tabelas próprias.
--
-- Segurança (RLS) em 20261005120100 · histórico em 20261005120200 ·
-- views/busca em 20261005120300 · dados iniciais em 20261005120400.
-- =============================================================================

create extension if not exists vector with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Busca textual em português que ignora acentos ("agricola" encontra "agrícola").
create text search configuration public.portugues (copy = pg_catalog.portuguese);
alter text search configuration public.portugues
  alter mapping for hword, hword_part, word with extensions.unaccent, portuguese_stem;

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.papel as enum ('admin', 'gestor', 'editor', 'leitor');
create type public.status_documento as enum ('ativo', 'arquivado', 'cancelado');
create type public.status_processamento as enum ('pendente', 'processando', 'concluido', 'sem_texto', 'erro');
create type public.tipo_empresa as enum ('grupo', 'fornecedor', 'cliente', 'parceiro', 'orgao_publico', 'outro');

-- -----------------------------------------------------------------------------
-- Utilitários
-- -----------------------------------------------------------------------------
create function public.tocar_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create function public.gerar_slug(texto text)
returns text
language sql
stable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(lower(extensions.unaccent(coalesce(texto, ''))), '[^a-z0-9]+', '-', 'g'));
$$;

-- -----------------------------------------------------------------------------
-- Setores (áreas responsáveis / departamentos)
-- -----------------------------------------------------------------------------
create table public.setores (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null check (btrim(nome) <> ''),
  sigla         text,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index setores_nome_key on public.setores (lower(nome));
create trigger setores_atualizado_em before update on public.setores
  for each row execute function public.tocar_atualizado_em();

-- -----------------------------------------------------------------------------
-- Perfis (usuários) — 1:1 com auth.users
-- -----------------------------------------------------------------------------
create table public.perfis (
  id            uuid primary key references auth.users (id) on delete cascade,
  nome          text not null default '',
  email         text not null,
  papel         public.papel not null default 'leitor',
  setor_id      uuid references public.setores (id) on delete set null,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create trigger perfis_atualizado_em before update on public.perfis
  for each row execute function public.tocar_atualizado_em();

-- Todo usuário criado no Auth (convite do admin) nasce "leitor" e sem categorias.
-- Papel e acessos são definidos pelo admin — nunca a partir de metadados do próprio usuário.
create function public.criar_perfil_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (id, email, nome)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'nome', ''), split_part(coalesce(new.email, ''), '@', 1))
  );
  return new;
end;
$$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil_novo_usuario();

-- -----------------------------------------------------------------------------
-- Categorias / pastas (árvore de até 3 níveis)
--   raiz_id: categoria de nível 1 da árvore (a própria, se for raiz). É a unidade
--   de controle de acesso: o usuário recebe acesso a categorias raiz.
-- -----------------------------------------------------------------------------
create table public.categorias (
  id            uuid primary key default gen_random_uuid(),
  parent_id     uuid references public.categorias (id) on delete restrict,
  raiz_id       uuid not null references public.categorias (id),
  nivel         smallint not null default 1 check (nivel between 1 and 3),
  nome          text not null check (btrim(nome) <> ''),
  slug          text not null,
  descricao     text,
  icone         text,
  cor           text,
  ordem         int not null default 0,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint categorias_nome_por_pai unique nulls not distinct (parent_id, nome)
);
create index categorias_parent_idx on public.categorias (parent_id);
create index categorias_raiz_idx on public.categorias (raiz_id);
create trigger categorias_atualizado_em before update on public.categorias
  for each row execute function public.tocar_atualizado_em();

create function public.categorias_definir_hierarquia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_atual  uuid;
  v_passos int := 0;
  v_pai    record;
begin
  if new.slug is null or btrim(new.slug) = '' or (tg_op = 'UPDATE' and new.nome is distinct from old.nome) then
    new.slug := public.gerar_slug(new.nome);
  end if;

  if new.parent_id is null then
    new.raiz_id := new.id;
    new.nivel := 1;
    return new;
  end if;

  -- Impede ciclos (mover uma categoria para dentro dela mesma).
  v_atual := new.parent_id;
  while v_atual is not null and v_passos < 10 loop
    if v_atual = new.id then
      raise exception 'Uma categoria não pode ficar dentro dela mesma.' using errcode = '23514';
    end if;
    select c.parent_id into v_atual from public.categorias c where c.id = v_atual;
    v_passos := v_passos + 1;
  end loop;

  select c.raiz_id, c.nivel into v_pai from public.categorias c where c.id = new.parent_id;
  if v_pai.nivel >= 3 then
    raise exception 'Limite de 3 níveis de categorias atingido.' using errcode = '23514';
  end if;
  new.raiz_id := v_pai.raiz_id;
  new.nivel := v_pai.nivel + 1;
  return new;
end;
$$;

create trigger categorias_hierarquia
  before insert or update of parent_id, nome on public.categorias
  for each row execute function public.categorias_definir_hierarquia();

-- Ao mover uma categoria, propaga raiz/nível para as filhas e para os documentos.
create function public.categorias_propagar_hierarquia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.raiz_id is distinct from old.raiz_id or new.nivel is distinct from old.nivel then
    update public.categorias set parent_id = parent_id where parent_id = new.id;  -- dispara o recálculo nas filhas
    update public.documentos set raiz_id = new.raiz_id where categoria_id = new.id;
  end if;
  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- Acesso do usuário às categorias raiz
-- -----------------------------------------------------------------------------
create table public.usuario_categorias (
  usuario_id   uuid not null references public.perfis (id) on delete cascade,
  categoria_id uuid not null references public.categorias (id) on delete cascade,
  criado_em    timestamptz not null default now(),
  primary key (usuario_id, categoria_id)
);

create function public.validar_categoria_raiz()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.categorias c where c.id = new.categoria_id and c.parent_id is not null) then
    raise exception 'O acesso é concedido apenas a categorias raiz.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger usuario_categorias_somente_raiz
  before insert or update on public.usuario_categorias
  for each row execute function public.validar_categoria_raiz();

-- -----------------------------------------------------------------------------
-- Empresas (do grupo e externas: fornecedores, clientes, órgãos...) e filiais
-- -----------------------------------------------------------------------------
create table public.empresas (
  id            uuid primary key default gen_random_uuid(),
  razao_social  text not null check (btrim(razao_social) <> ''),
  nome_fantasia text,
  cnpj          text unique check (cnpj is null or cnpj ~ '^\d{14}$'),
  tipo          public.tipo_empresa not null default 'fornecedor',
  email         text,
  telefone      text,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index empresas_razao_social_idx on public.empresas (lower(razao_social));
create trigger empresas_atualizado_em before update on public.empresas
  for each row execute function public.tocar_atualizado_em();

create table public.filiais (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas (id) on delete cascade,
  nome          text not null check (btrim(nome) <> ''),
  codigo        text,
  cidade        text,
  uf            text check (uf is null or uf ~ '^[A-Z]{2}$'),
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, nome)
);
create trigger filiais_atualizado_em before update on public.filiais
  for each row execute function public.tocar_atualizado_em();

-- -----------------------------------------------------------------------------
-- Tags (classificações livres, várias por documento)
-- -----------------------------------------------------------------------------
create table public.tags (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null check (btrim(nome) <> '' and length(nome) <= 40),
  cor       text,
  criado_em timestamptz not null default now()
);
create unique index tags_nome_key on public.tags (lower(nome));

-- -----------------------------------------------------------------------------
-- Tipos de documento, com campos personalizados
--   campos: [{ "chave": "valor_total", "rotulo": "Valor total", "tipo": "moeda",
--              "obrigatorio": true, "opcoes": [...] }]
--   tipos de campo: texto | texto_longo | numero | moeda | data | booleano | selecao
-- -----------------------------------------------------------------------------
create table public.tipos_documento (
  id                  uuid primary key default gen_random_uuid(),
  codigo              text not null unique check (codigo ~ '^[a-z0-9_]+$'),
  nome                text not null check (btrim(nome) <> ''),
  descricao           text,
  categoria_padrao_id uuid references public.categorias (id) on delete set null,
  campos              jsonb not null default '[]'::jsonb check (jsonb_typeof(campos) = 'array'),
  exige_validade      boolean not null default false,
  ativo               boolean not null default true,
  ordem               int not null default 0,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);
create trigger tipos_documento_atualizado_em before update on public.tipos_documento
  for each row execute function public.tocar_atualizado_em();

-- -----------------------------------------------------------------------------
-- Documentos
--   Os campos de arquivo refletem a versão atual (histórico completo em documento_versoes).
--   Exclusão é lógica (lixeira): excluido_em/excluido_por.
-- -----------------------------------------------------------------------------
create table public.documentos (
  id                   uuid primary key default gen_random_uuid(),
  titulo               text not null check (btrim(titulo) <> ''),
  descricao            text,
  tipo_id              uuid not null references public.tipos_documento (id),
  categoria_id         uuid not null references public.categorias (id),
  raiz_id              uuid not null references public.categorias (id),
  empresa_id           uuid references public.empresas (id) on delete set null,
  filial_id            uuid references public.filiais (id) on delete set null,
  setor_id             uuid references public.setores (id) on delete set null,
  contraparte_id       uuid references public.empresas (id) on delete set null,
  responsavel_id       uuid references public.perfis (id) on delete set null,
  data_documento       date,
  data_validade        date,
  status               public.status_documento not null default 'ativo',
  metadados            jsonb not null default '{}'::jsonb check (jsonb_typeof(metadados) = 'object'),
  -- versão atual do arquivo
  versao_atual         int not null default 1 check (versao_atual >= 1),
  storage_key          text not null,
  nome_arquivo         text not null,
  mime_type            text not null,
  tamanho_bytes        bigint not null check (tamanho_bytes >= 0),
  sha256               text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  -- processamento (extração de texto → chunks → embeddings)
  status_processamento public.status_processamento not null default 'pendente',
  erro_processamento   text,
  paginas              int,
  processado_em        timestamptz,
  -- controle
  criado_por           uuid default auth.uid() references auth.users (id) on delete set null,
  atualizado_por       uuid references auth.users (id) on delete set null,
  excluido_em          timestamptz,
  excluido_por         uuid references auth.users (id) on delete set null,
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now()
);

create index documentos_raiz_idx on public.documentos (raiz_id) where excluido_em is null;
create index documentos_categoria_idx on public.documentos (categoria_id);
create index documentos_tipo_idx on public.documentos (tipo_id);
create index documentos_empresa_idx on public.documentos (empresa_id);
create index documentos_contraparte_idx on public.documentos (contraparte_id);
create index documentos_setor_idx on public.documentos (setor_id);
create index documentos_criado_em_idx on public.documentos (criado_em desc);
create index documentos_validade_idx on public.documentos (data_validade)
  where excluido_em is null and data_validade is not null;
create index documentos_processamento_idx on public.documentos (status_processamento)
  where status_processamento in ('pendente', 'processando');
-- O mesmo arquivo não é cadastrado duas vezes na mesma categoria raiz (fora da lixeira).
create unique index documentos_arquivo_unico on public.documentos (raiz_id, sha256) where excluido_em is null;

-- Antes de gravar: raiz a partir da categoria, autor da alteração e regra da lixeira.
create function public.documentos_antes_de_gravar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.categoria_id is distinct from old.categoria_id then
    select c.raiz_id into new.raiz_id from public.categorias c where c.id = new.categoria_id;
  end if;

  if tg_op = 'UPDATE' then
    new.atualizado_em := now();
    new.atualizado_por := coalesce(auth.uid(), old.atualizado_por);

    -- Mandar para a lixeira / restaurar exige gestor ou admin na categoria.
    if new.excluido_em is distinct from old.excluido_em then
      if auth.uid() is not null and not public.pode_excluir_raiz(old.raiz_id) then
        raise exception 'Somente gestores ou administradores podem excluir ou restaurar documentos.'
          using errcode = '42501';
      end if;
      new.excluido_por := case when new.excluido_em is null then null else auth.uid() end;
    end if;
  end if;
  return new;
end;
$$;

create trigger documentos_antes_de_gravar
  before insert or update on public.documentos
  for each row execute function public.documentos_antes_de_gravar();

-- Mantém os trechos (RAG) na mesma raiz do documento quando ele é movido.
create function public.documentos_propagar_raiz()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.raiz_id is distinct from old.raiz_id then
    update public.documento_chunks set raiz_id = new.raiz_id where documento_id = new.id;
  end if;
  return null;
end;
$$;

-- Sem lista de colunas de propósito: "UPDATE OF raiz_id" não dispara quando quem muda a
-- raiz é o trigger BEFORE (a partir de categoria_id). A função compara old/new.
create trigger documentos_propagar_raiz
  after update on public.documentos
  for each row execute function public.documentos_propagar_raiz();

create trigger categorias_propagar
  after update on public.categorias
  for each row execute function public.categorias_propagar_hierarquia();

-- -----------------------------------------------------------------------------
-- Versões do arquivo ("qual arquivo foi substituído")
-- -----------------------------------------------------------------------------
create table public.documento_versoes (
  id            uuid primary key default gen_random_uuid(),
  documento_id  uuid not null references public.documentos (id) on delete cascade,
  versao        int not null check (versao >= 1),
  storage_key   text not null unique,
  nome_arquivo  text not null,
  mime_type     text not null,
  tamanho_bytes bigint not null check (tamanho_bytes >= 0),
  sha256        text not null,
  comentario    text,
  enviado_por   uuid default auth.uid() references auth.users (id) on delete set null,
  enviado_em    timestamptz not null default now(),
  unique (documento_id, versao)
);

-- -----------------------------------------------------------------------------
-- Tags do documento
-- -----------------------------------------------------------------------------
create table public.documento_tags (
  documento_id uuid not null references public.documentos (id) on delete cascade,
  tag_id       uuid not null references public.tags (id) on delete cascade,
  primary key (documento_id, tag_id)
);
create index documento_tags_tag_idx on public.documento_tags (tag_id);

-- -----------------------------------------------------------------------------
-- Trechos dos documentos + embeddings (pgvector) + busca textual
--   gte-small: 384 dimensões, vetores normalizados → produto interno (<#>)
-- -----------------------------------------------------------------------------
create table public.documento_chunks (
  id               bigint generated always as identity primary key,
  documento_id     uuid not null references public.documentos (id) on delete cascade,
  raiz_id          uuid not null references public.categorias (id),
  ordem            int not null,
  pagina           int,
  conteudo         text not null,
  embedding        extensions.vector(384),
  embedding_modelo text not null default 'gte-small',
  fts              tsvector generated always as (to_tsvector('public.portugues'::regconfig, conteudo)) stored,
  criado_em        timestamptz not null default now(),
  unique (documento_id, ordem)
);
create index documento_chunks_embedding_idx on public.documento_chunks
  using hnsw (embedding extensions.vector_ip_ops);
create index documento_chunks_fts_idx on public.documento_chunks using gin (fts);
create index documento_chunks_raiz_idx on public.documento_chunks (raiz_id);

-- -----------------------------------------------------------------------------
-- Chat (assistente de IA)
-- -----------------------------------------------------------------------------
create table public.chat_conversas (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo        text not null default 'Nova conversa',
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index chat_conversas_usuario_idx on public.chat_conversas (usuario_id, atualizado_em desc);
create trigger chat_conversas_atualizado_em before update on public.chat_conversas
  for each row execute function public.tocar_atualizado_em();

create table public.chat_mensagens (
  id          bigint generated always as identity primary key,
  conversa_id uuid not null references public.chat_conversas (id) on delete cascade,
  papel       text not null check (papel in ('user', 'assistant')),
  conteudo    text not null,
  fontes      jsonb not null default '[]'::jsonb,
  uso         jsonb,
  criado_em   timestamptz not null default now()
);
create index chat_mensagens_conversa_idx on public.chat_mensagens (conversa_id, id);
