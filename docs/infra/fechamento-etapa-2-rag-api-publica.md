# Fechamento Etapa 2 - RAG + API Publica

Data: 2026-03-03  
Status: Concluida (MVP operacional)

## 1) Escopo da etapa

Consolidar base tecnica para:
- Postgres + pgvector;
- schema RAG auditavel;
- indice vetorial HNSW;
- pipeline de ingestao de documentos;
- retrieval + RAG minimo reproduzivel;
- API publica segura para frontend externo (Vercel);
- publicacao via reverse proxy HTTPS;
- documentacao e reprodutibilidade operacional.

## 2) O que foi implementado

1. Banco vetorial e schema
- bootstrap de `pgvector`;
- schema `vector_store` com:
  - `document_sources`
  - `documents`
  - `document_chunks`
  - `chunk_embeddings`
  - `ingestion_jobs`

2. Indexacao vetorial
- indice HNSW cosine em `chunk_embeddings.embedding`.

3. Ingestao de documentos
- recebimento por upload/referencia/lote;
- persistencia de arquivo bruto + texto extraido;
- hash SHA-256 e deduplicacao;
- chunking deterministico parametrizado;
- gravacao em `documents` e `document_chunks`;
- tracking de `ingestion_jobs`;
- indexacao de embeddings de chunks no fluxo de ingestao (configuravel).

4. RAG minimo reproduzivel
- embedding da query;
- top-k vetorial no Postgres + pgvector;
- assembly deterministico de context pack;
- chamada ao vLLM interno;
- resposta com metadados auditaveis.

5. API publica e compatibilidade OpenAI
- rotas publicas:
  - `GET /health`
  - `GET /ready`
  - `POST /chat`
  - `POST /query`
  - `POST /v1/chat/completions`
- CORS centralizado e restritivo;
- API key minima centralizada;
- suporte a headers de proxy (`X-Forwarded-*`);
- payload limit + rate limit basico + validacao de entrada.

6. Infra de publicacao
- configs versionadas para Nginx e Caddy;
- exemplo de service `systemd`;
- runbooks operacionais para ativacao/tls/reload/testes.

## 3) Migrations criadas

- `supabase/migrations/20260302195000_create_knexai_unified_local.sql`
- `supabase/migrations/20260303110000_bootstrap_pgvector_layer.sql`
- `supabase/migrations/20260303120000_create_rag_base_schema.sql`
- `supabase/migrations/20260303130000_add_hnsw_index_chunk_embeddings.sql`

## 4) Tabelas e indices adicionados

Tabelas RAG:
- `vector_store.document_sources`
- `vector_store.documents`
- `vector_store.document_chunks`
- `vector_store.chunk_embeddings`
- `vector_store.ingestion_jobs`

Indices relevantes:
- `documents_content_hash_unique_idx`
- `document_chunks_document_chunk_unique`
- `chunk_embeddings_embedding_hnsw_cosine_idx`
- indices de status/data/metadata para documentos e jobs.

## 5) Rotas/endpoints adicionados ou consolidados

API interna/app:
- `POST /api/ingest`
- `GET /api/ingest/:id`
- `GET /api/documents/:id`
- `POST /api/query`
- `POST /api/chat`

API publica:
- `GET /health`
- `GET /ready`
- `POST /query`
- `POST /chat`
- `POST /v1/chat/completions`

## 6) Arquivos de infra gerados

- `deploy/nginx/knexspace.conf`
- `deploy/caddy/Caddyfile`
- `deploy/systemd/knexspace-api.service`

## 7) Scripts de smoke test

- `scripts/smoke-test-api.sh`
- `scripts/smoke-test-rag.sh`
- scripts npm:
  - `npm run smoke:api`
  - `npm run smoke:rag`

## 8) Documentacao criada/atualizada (principal)

- `docs/infra/pipeline-ingestao-documentos.md`
- `docs/api/ingestao-documentos.md`
- `docs/infra/rag-minimo.md`
- `docs/api/query-e-chat-rag.md`
- `docs/api/api-publica-vercel.md`
- `docs/api/openai-compatible-endpoint.md`
- `docs/infra/reverse-proxy-publicacao-api.md`
- `docs/infra/runbook-nginx-caddy.md`
- `docs/infra/seguranca-minima-api.md`
- `docs/infra/observabilidade-smoke-tests.md`

## 9) Riscos remanescentes (fora do MVP)

1. Rate limit in-memory (nao distribuido).
2. Sem rerank/hybrid retrieval.
3. Sem ACL/tenant filter vetorial avancado.
4. Adaptador OpenAI sem `stream=true`.
5. Necessidade de backfill para documentos antigos sem embeddings completos.

## 10) Pendencias para Etapa 3

1. Pipeline dedicado de backfill/reindex de embeddings.
2. Rerank e filtros de retrieval por dominio/tenant.
3. Persistencia conversacional integrada ao `/chat` publico.
4. Observabilidade centralizada (coleta/alerta/dashboard).
5. Hardening adicional de seguranca (rotacao de chaves, rate limit distribuido).

## 11) Criterios de aceite da etapa

- [x] Postgres + pgvector configurado e documentado
- [x] schema minimo do RAG criado
- [x] HNSW implementado
- [x] ingestao minima disponivel
- [x] retrieval funcional
- [x] API publica preparada para Vercel
- [x] publicacao via reverse proxy especificada
- [x] documentacao para auditoria e reproducao

## 12) Evidencias de auditabilidade

1. Migrations
- `supabase/migrations/20260302195000_create_knexai_unified_local.sql`
- `supabase/migrations/20260303110000_bootstrap_pgvector_layer.sql`
- `supabase/migrations/20260303120000_create_rag_base_schema.sql`
- `supabase/migrations/20260303130000_add_hnsw_index_chunk_embeddings.sql`

2. ADRs
- `docs/adr/ADR-001-persistencia-em-nvme.md`
- `docs/adr/ADR-002-schema-rag-base.md`

3. Docs tecnicas
- `docs/data/schema-rag-base.md`
- `docs/data/indices-vetoriais-hnsw.md`
- `docs/infra/rag-minimo.md`
- `docs/infra/pipeline-ingestao-documentos.md`

4. Configs de proxy
- `deploy/nginx/knexspace.conf`
- `deploy/caddy/Caddyfile`
- `deploy/systemd/knexspace-api.service`

5. Scripts operacionais
- `scripts/smoke-test-api.sh`
- `scripts/smoke-test-rag.sh`
- `scripts/verify-nvme-setup.sh`
- `scripts/verify-nvme-setup.ps1`

6. Variaveis de ambiente relevantes
- vetorial/RAG:
  - `VECTOR_DATABASE_URL`, `EMBEDDING_DIMENSION`, `VECTOR_SEARCH_TOP_K_DEFAULT`, `VECTOR_SEARCH_TOP_K_MAX`
  - `RAG_CHUNK_SIZE_CHARS`, `RAG_CHUNK_OVERLAP_CHARS`, `RAG_MAX_CHUNKS_PER_DOC`
  - `RAG_INGEST_EMBED_CHUNKS`, `RAG_INGEST_EMBED_REQUIRED`, `RAG_INGEST_EMBED_BATCH_SIZE`
- API publica:
  - `PUBLIC_API_ALLOWED_ORIGINS`, `VERCEL_FRONTEND_ORIGIN`, `APP_PUBLIC_ORIGIN`
  - `PUBLIC_API_KEY`, `PUBLIC_API_KEYS`
  - `PUBLIC_API_MAX_BODY_BYTES`, `PUBLIC_API_RATE_LIMIT_*`

7. Pontos de configuracao centralizada
- `core/config/env.ts` (env de RAG/DB)
- `core/config/paths.ts` (paths NVMe/documentos)
- `app/api/_shared/public-api.ts` (CORS, API key, rate limit, payload, request-id)
- `core/utils/logger.ts` (padrao e redacao de logs)

