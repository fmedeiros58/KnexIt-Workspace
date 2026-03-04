# Auditoria RAG (A→K) + Plano Incremental v2

Data: 2026-03-04  
Escopo: auditoria do pipeline atual, verificação de cobertura A→K e implementação aditiva do pipeline `v2` sem quebrar o `v1`.

## 1) Inventário do repositório (arquivos-chave)

- Ingestão v1:
  - `app/api/ingest/route.ts`
  - `core/rag/document-ingestion-service.ts`
  - `core/rag/text-extractor.ts`
- Query/Chat v1 + roteamento de pipeline:
  - `core/rag/rag-query-service.ts`
  - `app/query/route.ts`
  - `app/api/query/route.ts`
  - `app/chat/route.ts`
  - `app/api/chat/route.ts`
  - `app/v1/chat/completions/route.ts`
- Retrieval e geração:
  - `core/database/vector-retrieval-repository.ts`
  - `core/rag/vllm-client.ts`
- Pipeline v2 (novo, paralelo):
  - `core/rag/v2/orchestrator_v2.ts`
  - `core/rag/v2/docs/ingest_v2.ts`
  - `core/rag/v2/index/chunker_v2.ts`
  - `core/rag/v2/index/embeddings_v2.ts`
  - `core/rag/v2/retrieval/hybrid_v2.ts`
  - `core/rag/v2/rerank/reranker_v2.ts`
  - `core/rag/v2/context/packager_v2.ts`
  - `core/rag/v2/citations/aligner_v2.ts`
  - `core/rag/v2/writer/pipeline_v2.ts`
  - `core/rag/v2/memory/process_store_v2.ts`
  - `core/rag/v2/observability/logger_v2.ts`
  - `core/rag/v2/observability/run_audit_repository_v2.ts`
- Schema/migrations:
  - `supabase/migrations/20260303120000_create_rag_base_schema.sql`
  - `supabase/migrations/20260303130000_add_hnsw_index_chunk_embeddings.sql`
  - `supabase/migrations/20260304100000_create_rag_v2_pipeline_schema.sql`

## 2) Fluxo atual (v1) em diagrama textual

1. `POST /query` ou `POST /chat` recebe pergunta e histórico.
2. `core/rag/rag-query-service.ts` prepara pergunta, embedding de query e busca vetorial.
3. `assembleContextPack(...)` seleciona chunks.
4. `vllm-client.completeWithContext(...)` gera resposta.
5. Retorno com metadados de retrieval/llm/timings.

Observação: no v1, o retrieval é primariamente vetorial e não possui pipeline híbrido completo com alinhamento de citação por claim.

## 3) Checklist A→K (status com evidência)

### A) Ingestão/PDF

- A1 Parser texto nativo: ✅  
  Evidência: `core/rag/text-extractor.ts:153` (PDF), `core/rag/v2/docs/ingest_v2.ts:45` (extração por página).
- A2 OCR automático (detecção + execução): 🟡  
  Evidência: `core/rag/v2/docs/ingest_v2.ts:175` (`needs_ocr`), porém OCR efetivo ainda não executa raster+OCR.
- A3 Estrutura página/seção/títulos: 🟡  
  Evidência: `core/rag/v2/index/chunker_v2.ts:42` (`detectSectionPath` heurístico).
- A4 Tabelas/figuras (metadados): ❌  
  Evidência: não há parser dedicado de tabelas/figuras no pipeline atual.
- A5 Texto bruto + normalizado armazenados: ✅  
  Evidência: `core/rag/v2/docs/ingest_v2.ts:163` (`text_raw`, `text_norm`), `:188` (`chunks` com `text`/`text_norm`).

### B) Chunking

- B1 Overlap configurável: ✅  
  Evidência: `core/rag/v2/index/chunker_v2.ts:29`, `:59`.
- B2 Semântico + fallback por tamanho: 🟡  
  Evidência: `core/rag/v2/index/chunker_v2.ts:42`, `:67` (heading heurístico + corte por tamanho).
- B3 Metadados obrigatórios: ✅  
  Evidência: `core/rag/v2/index/chunker_v2.ts:14-23` (`pageStart/pageEnd`, `sectionPath`, `hash`, `pipelineVersion`).
- B4 Dedup hash + near-dup opcional: 🟡  
  Evidência: hash por chunk (`core/rag/v2/index/chunker_v2.ts:97`), sem near-dup persistente dedicado.

### C) Embeddings + pgvector

- C1 Tabelas chunks/embeddings: ✅  
  Evidência: `supabase/migrations/20260304100000_create_rag_v2_pipeline_schema.sql:61`, `:103`.
- C2 Índice vetorial + params: ✅  
  Evidência: `...20260304100000...sql:123` (HNSW).
- C3 Versionamento de embeddings: ✅  
  Evidência: `core/rag/v2/index/embeddings_v2.ts:14`, `:42` (`embedding_version`), migration `:108`.

### D) Retrieval

- D1 Vector search topK: ✅  
  Evidência: `core/database/vector-retrieval-repository.ts` (busca vetorial existente).
- D2 Lexical search (tsvector/BM25): ✅  
  Evidência: `core/database/vector-retrieval-repository.ts:200`, `:208`.
- D3 Hybrid combiner: ✅  
  Evidência: `core/rag/v2/retrieval/hybrid_v2.ts:163`.
- D4 Query rewriting opcional: ❌  
  Evidência: não há módulo de rewrite dedicado no pipeline.
- D5 MMR diversidade opcional: ✅  
  Evidência: `core/rag/v2/retrieval/hybrid_v2.ts:100`, `:241`.

### E) Rerank

- E1 Reranker (cross-encoder ou equivalente): 🟡  
  Evidência: `core/rag/v2/rerank/reranker_v2.ts:58` (rerank heurístico lexical/score; não cross-encoder).
- E2 Condicional por confiança/custo: ✅  
  Evidência: `core/rag/v2/rerank/reranker_v2.ts:47`.
- E3 Logs antes/depois: 🟡  
  Evidência: `beforeOrderChunkIds`/`afterOrderChunkIds` em `reranker_v2.ts:13-14`, mas persistência detalhada completa não está plena.

### F) Context packing + citações

- F1 Budgeter de tokens: ✅  
  Evidência: `core/rag/v2/context/packager_v2.ts:7`, `:96`.
- F2 Packing por relevância + estrutura: ✅  
  Evidência: header com `DOC/CHUNK/PAGES/SECTION/SCORE` em `packager_v2.ts:91`.
- F3 Citation alignment claim→evidência: ✅  
  Evidência: `core/rag/v2/citations/aligner_v2.ts:61`.
- F4 Quote guard (sem evidência, sem fato): 🟡  
  Evidência: claims sem cobertura viram `uncoveredClaims` (`aligner_v2.ts:65`, `:89`) e nota final no orquestrador (`orchestrator_v2.ts:384`).

### G) Construção de resposta por solicitação

- G1 Orchestrator por request: ✅  
  Evidência: `core/rag/v2/orchestrator_v2.ts`.
- G2 Políticas por tipo de tarefa: 🟡  
  Evidência: roteamento heurístico para modo writer (`orchestrator_v2.ts:165`, `:316`), sem taxonomia completa de task types.

### H) Escrita longa

- H1 Planner (outline): ✅  
  Evidência: `core/rag/v2/writer/pipeline_v2.ts:37`.
- H2 Writer por seção (multi-call): ✅  
  Evidência: loop por seções com chamada LLM em `pipeline_v2.ts:128+`.
- H3 Merge/coherence pass: ✅  
  Evidência: chamada de merge final `pipeline_v2.ts:176+`.

### I) Memória de processo

- I1 State store: ✅  
  Evidência: `core/rag/v2/memory/process_store_v2.ts:29`.
- I2 Anti-redundância: ✅  
  Evidência: anti-redundância no pack (`packager_v2.ts:98`, `:108`) + memória de argumentos usados no writer.
- I3 Checkpoints por run/conversation: ✅  
  Evidência: `pipeline_v2.ts:168`, `:192` e schema `process_memory` (`migration:182`).

### J) Sumarização hierárquica

- J1 Resumo por chunk: ❌  
- J2 Resumo por seção/capítulo: ❌  
- J3 Resumo global com rastreio: ❌  
  Evidência: sem módulo de map-reduce hierárquico dedicado no pipeline v2 atual.

### K) Robustez

- K1 Observabilidade (logs/traces/métricas de etapa): ✅  
  Evidência: `core/rag/v2/observability/logger_v2.ts`, `run_audit_repository_v2.ts`.
- K2 Fallbacks obrigatórios: ✅  
  Evidência: vector→lexical no híbrido (`hybrid_v2.ts`), rerank opcional com fallback (`orchestrator_v2.ts`), marcação OCR pendente (`ingest_v2.ts:175`).
- K3 Cache query hash: ✅  
  Evidência: cache TTL no híbrido (`core/rag/v2/retrieval/hybrid_v2.ts`).
- K4 Segurança upload/rate-limit/validação: ✅  
  Evidência: `app/api/_shared/public-api.ts` (rate limit/body limit), `document-ingestion-service.ts` (`INGEST_FILE_TOO_LARGE`, tipo/mime/path guard).
- K5 Testes smoke/regressão: 🟡  
  Evidência: `scripts/smoke-test-rag.sh` + novo `scripts/smoke_rag_v2`; benchmark de regressão de qualidade ainda precisa suite dedicada.

## 4) Gaps e riscos principais

- OCR completo de PDF escaneado ainda incompleto (há detecção de necessidade, não OCR final).
- Falta query rewriting explícito para consultas ambíguas.
- Falta sumarização hierárquica map-reduce.
- Rerank atual é heurístico; para precisão máxima recomenda-se cross-encoder configurável.

## 5) Implementação incremental v2 (ordem de patches)

1. Fundacional:
   - Flags de pipeline e roteamento por header/body (`pipeline=v2`).
2. Retrieval v2:
   - lexical + híbrido + MMR + rerank condicional.
3. Contexto/citações:
   - packager com budget/anti-redundância + alinhamento de citação.
4. Escrita longa/memória:
   - writer multi-call com checkpoints em `process_memory`.
5. Observabilidade:
   - `retrieval_runs`, `generation_runs`, `citations`.
6. Infra:
   - migration `rag_v2` + smoke `scripts/smoke_rag_v2`.

## 6) Artefatos obrigatórios gerados

- `docs/rag_audit_report.md` (este relatório)
- `docs/pipeline_flags.md`
- `supabase/migrations/20260304100000_create_rag_v2_pipeline_schema.sql`
- `supabase/migrations/rollback/20260304100000_drop_rag_v2_pipeline_schema.sql`
- `scripts/smoke_rag_v2`

