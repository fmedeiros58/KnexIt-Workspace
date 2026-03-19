# KnexAI

Camada de IA nativa do ecossistema KnexIT (Leticia + modelo Mistral/vLLM). Inclui:
- `/knexai`: UI Next.js com chat em streaming.
- `/api/knexai`: endpoint de chat com engine real (pipeline descendente + vLLM).
- `lib/knexai/spec.ts`: prompt base da Leticia.

## Estrutura
- `web/`: componentes/pagina do chat e helper de streaming para o front.
- `lib/`: cliente front do chat (`knexai/lib/client.ts`).
- `src/`: stub Fastify legado para healthcheck/local runner (opcional, fora do fluxo principal).

## Variaveis de ambiente
```
# vLLM local (API OpenAI-compatible)
LOCAL_LLM_BASE_URL=http://127.0.0.1:8000/v1
LOCAL_LLM_API_KEY=token-local
LOCAL_LLM_MODEL=models/CModelosMistral-7B-Instruct-v0.2-AWQ
LOCAL_LLM_MODEL_DEFAULT=models/CModelosMistral-7B-Instruct-v0.2-AWQ
EMBEDDINGS_BASE_PATH=models

# Nome logico enviado no payload
LLM_MODEL_NAME=mistral-awq
LLM_API_KEY=token-local
LLM_TIMEOUT_MS=45000
LLM_CONTEXT_WINDOW=2048
LLM_MAX_TOKENS=1536

# Fallback legado
VLLM_API_KEY=token-local

# RAG (query/chat)
EMBEDDING_BASE_URL=http://127.0.0.1:8001/v1
EMBEDDING_MODEL_NAME=intfloat/multilingual-e5-base
EMBEDDING_API_KEY=token-local
RAG_LLM_BASE_URL=http://127.0.0.1:8000/v1
RAG_LLM_MODEL_NAME=mistral-awq
RAG_LLM_API_KEY=token-local
RAG_CONTEXT_MAX_CHARS=9000
RAG_CONTEXT_MAX_CHUNKS=12
RAG_RESPONSE_MAX_TOKENS=700
RAG_RESPONSE_TEMPERATURE=0
RAG_RESPONSE_SEED=42
RAG_REQUIRE_INTERNAL_LLM_URL=1
RAG_INGEST_EMBED_CHUNKS=1
RAG_INGEST_EMBED_REQUIRED=0
RAG_INGEST_EMBED_BATCH_SIZE=16

# API publica
PUBLIC_API_ALLOWED_ORIGINS=https://seu-frontend.vercel.app,https://app.knexspace.com
PUBLIC_API_KEY=troque-por-uma-chave-forte

# Provider do endpoint /api/knexai
KNEXAI_ENGINE_MODE=direct
```

## UI (Next.js)
- Rota app: `/knexai` (wrapper em `app/knexai/page.tsx` -> `knexai/web/page.tsx`).
- Endpoint: `/api/knexai` (pipeline descendente + vLLM).
- Endpoints RAG (MVP): `/api/query` e `/api/chat`.
- UI de ingestao de documentos: `/knexai/ingest` (atalho: `/ingest`).
- Endpoints publicos (proxy/HTTPS): `/query`, `/chat`, `/health`, `/ready`, `/v1/chat/completions`.
- Para embeddings locais em CPU: `npm run serve:embeddings:cpu`.
- Helper: `knexai/lib/client.ts` (streaming via fetch+ReadableStream).
- Persistencia de chat: `/api/knexai/threads` e `/api/knexai/messages`.

## Guard de mensagens (persistencia)
- O frontend gera `sessionId` local e guarda em `localStorage`.
- Conversas sao carregadas automaticamente do backend (`/api/knexai/threads?includeMessages=1`).
- Cada mensagem user/assistant e salva em `/api/knexai/messages`.
- Se o backend estiver indisponivel, o cache local mantem os chats para nao "sumirem".

## Migracoes SQL (Supabase)
Para ambiente local (Postgres no seu servidor), use **apenas 1 migration**:
- `supabase/migrations/20260302195000_create_knexai_unified_local.sql`

Fluxo recomendado para garantir migration unica:
- aplicar via `psql "$DATABASE_URL" -f supabase/migrations/20260302195000_create_knexai_unified_local.sql`;
- nao usar `supabase db reset/push` nesse modo local, porque esses comandos percorrem todo o historico em `supabase/migrations`.

Essa migration unificada cria:
- sessoes/threads/mensagens do KnexAI;
- tabelas de memoria operacional/auditoria;
- funcoes SQL para montar contexto recente e fazer prune de memoria expirada.

Notas de arquitetura:
- Persistencia SQL = camada duravel (ideal com data directory em NVMe).
- Memoria quente = camada em RAM no runtime ANM/Next (nao depende de roundtrip SQL por token).
- As 3 migrations antigas foram arquivadas em `supabase/migrations_legacy/knexai` e nao entram mais no fluxo padrao do Supabase CLI.

Padroes de path (consolidacao):
- `MIGRATIONS_PATH` e `KNEXAI_MIGRATION_FILE` controlam o fluxo da migration unificada.
- `NVME_BASE_PATH` pode servir como base opcional para paths relativos.

## Servidor opcional (stub)
```bash
cd knexai
npm install
npm run dev  # porta 3700, health em /health
```
Observacao: esse stub nao e o caminho principal do produto; o fluxo oficial usa `app/api/knexai` no Next.

## Proximos passos
- Conectar fontes de contexto (Drive/Read/Review/Search) e cache semantico.
- Adicionar testes basicos de contrato do endpoint.
- Expor metricas/limites por plano.
