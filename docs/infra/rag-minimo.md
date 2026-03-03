# RAG Minimo Reproduzivel (KnexAI)

Data: 2026-03-03  
Escopo: fluxo minimo, auditavel e previsivel para consulta RAG no backend atual.

## 1) Objetivo operacional

- Receber pergunta.
- Gerar embedding da pergunta no servidor.
- Buscar contexto vetorial no Postgres + pgvector.
- Montar context pack deterministico.
- Chamar vLLM interno (sem exposicao publica direta).
- Retornar resposta com metadados de auditoria.

## 2) Componentes implementados

- `core/rag/embedding-client.ts`
  - Gera embedding da query via endpoint OpenAI-compatible (`/embeddings`).
- `core/rag/retrieval-service.ts`
  - Executa top-k vetorial usando `vector_store.chunk_embeddings`.
- `core/rag/context-pack.ts`
  - Monta context pack deterministico com limite de chars/chunks.
- `core/rag/vllm-client.ts`
  - Cliente centralizado para vLLM interno (`/chat/completions`).
- `core/rag/rag-query-service.ts`
  - Orquestra pipeline e formata resposta auditavel.
- Rotas:
  - `POST /api/query`
  - `POST /api/chat`

## 3) Fluxo completo do RAG

1. API recebe pergunta (`question`/`prompt` em `/api/query` ou `message` em `/api/chat`).
2. `QueryEmbeddingClient` gera vetor da pergunta.
3. `RagRetrievalService` consulta top-k no pgvector:
   - join entre `chunk_embeddings`, `document_chunks`, `documents`.
   - filtro de `documents.status='processed'`.
4. `assembleContextPack` ordena resultados de forma estavel (distance asc + ids) e monta bloco textual.
5. `VllmInternalClient` chama `POST /chat/completions` no endpoint interno.
6. API responde com:
   - resposta textual;
   - chunks usados (ids, score/distance, origem);
   - parametros de retrieval;
   - modelo de embedding e modelo LLM;
   - tempos por etapa.

## 4) Onde o embedding da pergunta e gerado

- Local: `core/rag/embedding-client.ts`
- Endpoint: `${EMBEDDING_BASE_URL}/embeddings`
- Modelo: `EMBEDDING_MODEL_NAME` (fallbacks de env quando nao informado).
- Validacao: dimensao do vetor precisa bater com `EMBEDDING_DIMENSION`/schema vetorial.

## 5) Como o top-k e definido

- Resolve por `core/database/vector-search-params.ts`.
- Parametros principais:
  - `topK` (input da rota, com clamp por env)
  - `maxDistance` (opcional)
- Defaults/limites:
  - `VECTOR_SEARCH_TOP_K_DEFAULT`
  - `VECTOR_SEARCH_TOP_K_MAX`
  - `VECTOR_SEARCH_MAX_DISTANCE_DEFAULT` (opcional)

## 6) Como o contexto e montado

- Local: `core/rag/context-pack.ts`
- Regras:
  - ordenacao deterministica;
  - limite por `RAG_CONTEXT_MAX_CHARS`;
  - limite por `RAG_CONTEXT_MAX_CHUNKS`;
  - sem heuristica oculta.
- Cada bloco de contexto inclui:
  - `chunk_id`, `document_id`, `chunk_index`, `distance`, `score`;
  - texto do chunk.

## 7) Como o vLLM e chamado

- Local: `core/rag/vllm-client.ts`
- Endpoint: `${RAG_LLM_BASE_URL}/chat/completions`
- Restricao:
  - por padrao, aceita apenas `localhost/127.0.0.1` (`RAG_REQUIRE_INTERNAL_LLM_URL=1`).
- Parametros de geracao:
  - `RAG_RESPONSE_MAX_TOKENS`
  - `RAG_RESPONSE_TEMPERATURE`
  - `RAG_RESPONSE_SEED`

## 8) Auditabilidade da resposta

Resposta inclui:

- `metadata.retrieval`:
  - `topK`, `maxDistance`, estrategia, filtros, total recuperado.
- `metadata.chunks`:
  - ids de documento/chunk, distance/score, origem, trecho curto.
- `metadata.queryEmbedding`:
  - modelo e dimensao.
- `metadata.llm`:
  - provider (`vllm_internal`), baseUrl interna, modelo, seed, usage.
- `metadata.timingsMs`:
  - embedding, retrieval, context assembly, llm, total.

## 9) Limites atuais (MVP)

- Nao inclui reranking.
- Nao inclui filtros semanticos avancados.
- Nao inclui memoria conversacional longa no retrieval (somente historico curto no prompt final).
- A indexacao de embeddings e feita no pipeline de ingestao; documentos historicos sem embedding exigem reprocessamento/backfill.

## 10) Expansao futura recomendada

- Worker/cron de backfill para documentos antigos com `embedding_status` diferente de `completed`.
- Rerank (cross-encoder) apos top-k.
- Filtros por tenant/projeto/ACL.
- Memoria de conversa no retrieval.
- Citacoes estruturadas por trecho com offsets.
