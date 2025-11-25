# KnexAI

Camada de IA nativa do ecossistema KnexIT (Letícia + modelo Mistral/vLLM). Inclui:
- `/knexai`: UI Next.js com chat em streaming.
- `/api/knexai`: endpoint de chat com mock em dev e proxy para vLLM/modelo local.
- `lib/knexai`: engine, prompts e utilitários de IA.

## Estrutura
- `web/`: componentes/página do chat e helper de streaming para o front.
- `lib/`: engine da Letícia (prompts, gates, moduladores, nodes).
- `src/`: stub Fastify para healthcheck/local runner (opcional).

## Variáveis de ambiente
```
# Mock (default ativo em dev; defina 0 para usar modelo)
LETICIA_MOCK=1

# vLLM (API OpenAI-compatível) / modelo local
VLLM_BASE_URL=http://127.0.0.1:8000/v1
VLLM_API_KEY=EMPTY
VLLM_MODEL=meta-llama/Meta-Llama-3-8B-Instruct
```

## UI (Next.js)
- Rota app: `/knexai` (wrapper em `app/knexai/page.tsx` -> `knexai/web/page.tsx`).
- Endpoint: `/api/knexai` (mock ou vLLM).
- Helper: `knexai/lib/client.ts` (streaming via fetch+ReadableStream).

## Servidor opcional (stub)
```bash
cd knexai
npm install
npm run dev  # porta 3700, health em /health
```

## Próximos passos
- Conectar fontes de contexto (Drive/Read/Review/Search) e cache semântico.
- Adicionar testes básicos de contrato do endpoint.
- Expor métricas/limites por plano.
