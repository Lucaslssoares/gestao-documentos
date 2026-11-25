# Gestão de Documentos

Plataforma centralizada para **organização, armazenamento, classificação, pesquisa e controle do ciclo de vida de documentos corporativos**. Cada área (Jurídico, Financeiro, Fiscal, Suprimentos, RH, Administrativo, Operacional) guarda e encontra seus documentos de forma estruturada e segura.

O **documento é a entidade principal**. Contratos, notas fiscais, certidões, guias e atestados são *tipos* de documento, cada um com seus campos próprios. Não existem tabelas separadas para cada um.

```
Login → Painel → Documentos → Categorias/Pastas → Documento → Histórico
```

| Pilar | O que o sistema faz |
|---|---|
| **Organização** | Categoria e subcategoria (até 3 níveis), tipo, tags, empresa/filial, setor responsável, contraparte, responsável, datas, status |
| **Localização** | Pesquisa por palavras no nome, nos campos e **no conteúdo do arquivo**, sem diferenciar acentos, mais filtros por categoria, tipo, empresa, tags, situação e período |
| **Controle** | Histórico de quem enviou, alterou, moveu, substituiu (versões), visualizou, baixou, excluiu e restaurou; lixeira; acesso por categoria e perfil |
| **Prazos e pendências** | Pendências ligadas ao documento (condicionantes, prazos de renovação, entregas) com responsável e prazo; antecedência do aviso por documento; central "Minhas pendências"; alertas por e-mail até alguém concluir |
| **Aprovação e revisão** | Aprovador escolhido no cadastro (o tipo pode exigir); nova versão volta para aprovação; revisão periódica ("revisar a cada N meses"); aviso de nova versão a quem consultou o documento |
| **Inteligência** | Assistente de IA que responde com base nos documentos e cita as fontes (RAG com pgvector); "Preencher com IA" no cadastro; "O que falta" em cada documento |
| **Lista mestra** | Exportação (CSV para Excel) dos documentos controlados com versão, situação, aprovação, validade e próxima revisão |

## Interface (navegação Hub-and-Spoke)

O **Início é o hub**: busca, "Minhas pendências", enviados recentemente e um cartão por módulo. Cada módulo (Documentos, Pendências, Assistente IA, Lixeira, Configurações) abre em tela cheia com **"← Início"** no topo; para trocar de módulo, volta-se ao hub. Não há menu lateral.

- **Busca global (Ctrl+K ou /)** em qualquer tela: documentos em tempo real (nome, campos e conteúdo do arquivo), pastas e ações rápidas.
- **Documentos**: caminho de pastas, subpastas, atalhos de situação, lista ou grade, filtros, "Novo documento" já na pasta aberta e **exportar lista mestra**.
- **Documento**: visualização, versões e histórico; na lateral, **o que falta**, **prazos e pendências**, informações (validade, revisão, aprovação); faixa de aprovação com Aprovar/Reprovar para o aprovador.
- **Novo documento em 3 etapas**: arquivo → classificação (pode enviar daqui) → organização (aprovador, revisão, empresa, tags), com **Preencher com IA** quando o assistente está configurado.
- **Pendências**: tudo o que pede ação, agrupado em atrasadas, próximas e depois; "Minhas" ou "Toda a equipe" (gestor/admin).
- Cores: paleta da Belém Bioenergia (verde #7AA52A / #4E7A1C, laranja #E14E0D), sem logotipo.

## Arquitetura

```
Usuário (web / celular)
   │
React + Tailwind (frontend/)  ── login via Supabase Auth
   │ HTTPS /api
Node.js + Express (backend/)  ── API REST · regras de negócio · RLS do usuário · auditoria
   │                         └─ AI Orchestrator (Claude + ferramentas de consulta)
   ├── Supabase: Auth · PostgreSQL · pgvector · Edge Function "embed" (gte-small)
   └── MinIO (S3): arquivos e versões (bucket privado, referenciado por storage_key)

Processamento de documentos (fila no backend):
   extração de texto (PDF/DOCX/XML/TXT) → chunking → embeddings → pgvector
```

**Segurança:** o backend consulta o banco **com o JWT do usuário**, então a RLS do Postgres vale para todas as telas e também para o assistente. Ele só enxerga o que o usuário pode ver. Os arquivos não ficam expostos: o download passa pela API, que confere a permissão e registra o acesso no histórico.

### Estrutura

```
gestão_documentos/
├── frontend/        React 19 + Vite + Tailwind 4 (paleta terrosa em src/index.css)
├── backend/         Node 24 + Express 5 + TypeScript
│   ├── src/modules/   documentos, cadastros, dashboard, historico, usuarios, chat
│   ├── src/processing/ extração, chunking, embeddings, fila
│   ├── src/ai/        orquestrador, ferramentas e prompt do assistente
│   └── scripts/seed-demo.ts  documentos de demonstração
├── supabase/        migrations, seed (dev), testes pgTAP, Edge Function "embed"
├── infra/           script de inicialização do MinIO
├── docker-compose.yml
└── .github/workflows/  CI (build, testes, imagens) e deploy do Supabase
```

## Perfis de acesso

O acesso é concedido por **categoria raiz** (Jurídico, RH...) e o **perfil** define o que a pessoa pode fazer nelas:

| Perfil | Pode |
|---|---|
| **Administrador** | Tudo, em todas as categorias, além de cadastros base (categorias, tipos, setores, filiais) e usuários |
| **Gestor** | Consultar, cadastrar, alterar, mover, excluir e restaurar (lixeira) nas categorias liberadas; cadastrar empresas e tags |
| **Editor** | Consultar, cadastrar, alterar, mover e enviar novas versões nas categorias liberadas |
| **Leitor** | Consultar, visualizar e baixar nas categorias liberadas |

Novos usuários são **convidados** pelo administrador (Configurações → Usuários) e definem a senha pelo link do e-mail. O cadastro aberto fica desligado.

## Rodando localmente

**Pré-requisitos:**
- Node.js 24 ou 22.12+.
- **Docker Desktop rodando**, usado pelo Supabase local e pelo MinIO.
- Assistente: por padrão usa a IA local. Rode `docker compose up -d ollama ollama-init`: o init baixa o modelo de cerca de 1 GB na primeira vez. Opcionalmente, uma chave da API da Anthropic troca o modo local pelo Claude.

```bash
# 1. Variáveis de ambiente
cp .env.example .env

# 2. Supabase local (Postgres + Auth + Edge Functions) — aplica migrations e seed
npx supabase start
npx supabase status -o env   # copie ANON_KEY e SERVICE_ROLE_KEY para o .env
                             # (SUPABASE_ANON_KEY, VITE_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY)
npx supabase functions serve embed   # deixe este terminal aberto (embeddings gte-small)

# 3. MinIO (cria o bucket privado e o usuário da aplicação)
docker compose up -d minio minio-init

# 4. Backend  →  http://localhost:3333/health
cd backend && npm install && npm run dev

# 5. Frontend (outro terminal)  →  http://localhost:5173
cd frontend && npm install && npm run dev

# 6. (opcional) Documentos de demonstração, com PDFs no MinIO e texto indexado
cd backend && npm run seed:demo
```

**Usuários de desenvolvimento** (senha `Senha@123`, criados pelo `supabase/seed.sql`):

| E-mail | Perfil | Categorias |
|---|---|---|
| admin@example.com | Administrador | todas |
| juridico@example.com | Gestor | Jurídico, Suprimentos |
| financeiro@example.com | Editor | Financeiro, Fiscal |
| rh@example.com | Leitor | RH |

Outros endereços úteis:
- Console do MinIO: http://localhost:9001.
- Supabase Studio: http://localhost:54323.
- E-mails (Mailpit): http://localhost:54324 — convites e também os **alertas de prazos, aprovações e nova versão** (SMTP local na porta 54325; no `.env`: `SMTP_HOST=host.docker.internal` e `SMTP_PORT=54325` para o backend no Docker, ou `SMTP_HOST=127.0.0.1` rodando fora dele). Sem `SMTP_HOST` os avisos ficam só na tela Pendências; o agendador confere os prazos de hora em hora.

### Tudo em Docker

```bash
docker compose up -d --build     # frontend + backend + MinIO  →  http://localhost:8080
                                 # (porta configurável em FRONTEND_PORT no .env)
```

O Supabase continua pela CLI (`npx supabase start`). O backend no container o acessa por `host.docker.internal`.

## Testes

```bash
cd backend && npm run lint && npm run typecheck && npm test
cd frontend && npm run lint && npm test && npm run build
npx supabase test db             # RLS: acesso por categoria e perfil, pendências, lixeira, histórico, pesquisa
```

O GitHub Actions (`.github/workflows/ci.yml`) roda tudo isso a cada push ou PR, sobe o banco com as migrations para os testes pgTAP e, na `main`, publica as imagens no GitHub Container Registry.

## Pesquisa e assistente de IA

- **Pesquisa** (`pesquisar_documentos`):
  - Usa a busca textual do Postgres em português, com radicais e sem acentos: "agricola" encontra "agrícola".
  - Procura no nome, na descrição, na classificação, nas empresas, nas tags e nos campos do tipo. Também procura **no texto extraído do arquivo**.
- **Embeddings:**
  - Modelo `gte-small`, gratuito e nativo do Supabase, rodando na Edge Function `supabase/functions/embed`.
  - Limitação: o modelo foi treinado em inglês e lê até 512 tokens. Por isso os trechos têm cerca de 1.000 caracteres e a busca do assistente é **híbrida** (vetor + texto em português, combinados por RRF).
  - O provedor fica atrás de uma interface (`backend/src/processing/embeddings.ts`). Trocar por um modelo multilíngue exige só reprocessar os documentos.
- **Assistente** (`backend/src/ai/`). Responde só com os documentos das pastas que o usuário acessa (RLS), em streaming, citando as fontes como `[F1]`. Na tela, cada citação abre o documento. Há dois modos:
  - **IA local (padrão, sem custo e sem enviar dados para fora).** Usa o Ollama com o `qwen2.5:1.5b` (cerca de 1 GB, roda em CPU), no serviço `ollama` do `docker compose`. Fica ativo quando há `OLLAMA_URL` e não há `ANTHROPIC_API_KEY`.
    - **Busca primeiro** (`local-busca.ts` e `local.ts`): o código decide o que consultar, como filtros de tipo e vencimento, palavras-chave, trechos do conteúdo e pendências. O modelo só redige a resposta com essas fontes.
    - **Listagens sem modelo:** perguntas como "quais contratos vencem nos próximos 60 dias?", "certidões vencidas" ou "minhas pendências" são respondidas direto dos dados, em menos de 1 s.
    - **Perguntas de conteúdo** ("o que diz a cláusula de multa…", "resuma o contrato X") levam de 15 s a 1 min em CPU de notebook. A primeira pergunta depois de ligar o computador demora mais, porque o modelo precisa carregar.
    - **Citações:** o backend corrige citações trocadas pelo modelo pequeno, conferindo o nome do documento mencionado na frase.
    - **Outro modelo:** em máquina com mais memória, `OLLAMA_MODEL=qwen2.5:3b` responde melhor. Para usá-lo, rode `docker compose exec ollama ollama pull qwen2.5:3b`.
  - **Claude**, quando há `ANTHROPIC_API_KEY`. Usa o `claude-opus-5-5` com ferramentas somente leitura (pesquisar, detalhar, listar categorias, busca semântica, ler documento e pendências), com *fallback* automático se o modelo recusar. Também ativa o "Preencher com IA" no cadastro.
  - Sem nenhum dos dois, o sistema funciona normalmente e só o assistente fica indisponível.
- **LGPD/confidencialidade:**
  - No modo local, nada sai do servidor.
  - No modo Claude, trechos dos documentos acessíveis ao usuário são enviados à API da Anthropic. Valide com o Jurídico quais categorias podem ser usadas.

## Armazenamento (MinIO)

- O backend usa o SDK S3 padrão. Qualquer armazenamento compatível com S3 funciona, trocando só as variáveis `S3_*`.
- **Situação da edição comunitária do MinIO:**
  - Foi descontinuada: deixou de publicar imagens oficiais em out/2025 e o repositório foi arquivado em 2026.
  - As imagens `minio/minio` foram removidas do Docker Hub em set/2026.
  - O `docker-compose.yml` usa a imagem gratuita da Chainguard (`cgr.dev/chainguard/minio`), compilada a partir do código do MinIO.
- **Para produção, escolha uma destas opções:**
  - **MinIO comercial (AIStor)**, que é pago e tem suporte;
  - **SeaweedFS** (Apache-2.0);
  - **Garage**.
- `infra/minio-init.sh` cria o bucket **privado** e um usuário da aplicação com acesso apenas a esse bucket. O backend nunca usa a conta root.

## Produção (resumo)

1. **Supabase Cloud**:
   - Crie o projeto.
   - Configure os secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` e `SUPABASE_DB_PASSWORD`.
   - Rode o workflow **Supabase (produção)**, que aplica as migrations e publica a função `embed`.
   - Em Auth, configure:
     - SMTP próprio (para os convites);
     - `Site URL` = URL do sistema.
2. **Servidor com Docker**:
   - Copie `docker-compose.yml`, `infra/` e um `.env` de produção, com `GHCR_OWNER` = dono do repositório.
   - Coloque HTTPS na frente (proxy reverso).
   - **Não exponha** as portas 9000/9001 do MinIO.
3. **GitHub**:
   - Variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
   - Para o deploy automático por SSH: secrets `DEPLOY_HOST`, `DEPLOY_USER` e `DEPLOY_SSH_KEY`.
4. **Backup**:
   - Banco: o Supabase Cloud faz backup diário.
   - Arquivos: volume do MinIO, com `mc mirror` para outro disco ou local.

> **OneDrive:** esta pasta está sincronizada pelo OneDrive. Os `node_modules` têm centenas de MB e milhares de arquivos. Prefira manter o projeto fora do OneDrive (por exemplo, num repositório Git em `C:\dev`) ou pause a sincronização ao instalar as dependências.

## Próximas fases (sugestões)

- OCR para PDFs escaneados e imagens (hoje ficam como "sem texto" e não entram na pesquisa por conteúdo).
- Alertas de vencimento por e-mail ou Teams.
- Leitura automática do XML da NF-e (preencher número, valor e emitente).
- Fluxos de aprovação e assinatura digital.
- Política de retenção e descarte (LGPD).
- Modelo de embeddings multilíngue.
