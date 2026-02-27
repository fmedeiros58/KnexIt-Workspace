# KnexAI

Camada de IA nativa do ecossistema KnexIT (Leticia + modelo Mistral/vLLM). Inclui:
- `/knexai`: UI Next.js com chat em streaming.
- `/api/knexai`: endpoint de chat com mock em dev e provider configuravel (`direct` ou `anm`).
- `lib/knexai/spec.ts`: prompt base da Leticia.

## Estrutura
- `web/`: componentes/pagina do chat e helper de streaming para o front.
- `lib/`: cliente front do chat (`knexai/lib/client.ts`).
- `src/`: stub Fastify legado para healthcheck/local runner (opcional, fora do fluxo principal).

## Variaveis de ambiente
```
# Mock (defina 0 para usar modelo local)
LETICIA_MOCK=0

# vLLM local (API OpenAI-compatible)
LOCAL_LLM_BASE_URL=http://127.0.0.1:8000/v1
LOCAL_LLM_API_KEY=token-local
LOCAL_LLM_MODEL=/mnt/c/knexit-workspace/knexit-workspace/models/CModelosMistral-7B-Instruct-v0.2-AWQ

# Nome logico enviado no payload
LLM_MODEL_NAME=mistral-awq
LLM_API_KEY=token-local
LLM_TIMEOUT_MS=45000
LLM_CONTEXT_WINDOW=2048
LLM_MAX_TOKENS=1536

# Fallback legado
VLLM_API_KEY=token-local

# Provider do endpoint /api/knexai
KNEXAI_ENGINE_MODE=direct
ANM_BACKEND_BASE_URL=http://127.0.0.1:8100
ANM_BACKEND_TIMEOUT_MS=45000
KNEXAI_ANM_FALLBACK_TO_DIRECT=1
```

## UI (Next.js)
- Rota app: `/knexai` (wrapper em `app/knexai/page.tsx` -> `knexai/web/page.tsx`).
- Endpoint: `/api/knexai` (mock, vLLM direto ou ANM backend).
- Helper: `knexai/lib/client.ts` (streaming via fetch+ReadableStream).
- Persistencia de chat: `/api/knexai/threads` e `/api/knexai/messages`.

## Guard de mensagens (persistencia)
- O frontend gera `sessionId` local e guarda em `localStorage`.
- Conversas sao carregadas automaticamente do backend (`/api/knexai/threads?includeMessages=1`).
- Cada mensagem user/assistant e salva em `/api/knexai/messages`.
- Se o backend estiver indisponivel, o cache local mantem os chats para nao "sumirem".

## Migracoes SQL (Supabase)
Aplicar as migracoes novas:
- `supabase/migrations/20260227160000_create_knexai_chat_persistence.sql`
- `supabase/migrations/20260227161000_create_knexai_memory_tables.sql`
- `supabase/migrations/20260227162000_create_knexai_memory_functions.sql`

Essas migracoes criam:
- sessoes/threads/mensagens do KnexAI;
- tabelas de memoria operacional/auditoria;
- funcoes SQL para montar contexto recente e fazer prune de memoria expirada.

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
