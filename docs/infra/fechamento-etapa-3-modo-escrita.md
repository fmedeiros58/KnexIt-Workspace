# Fechamento Etapa 3 - Modo Escrita

Data: 2026-03-03
Status: Concluida
Escopo: consolidacao do dominio de escrita longa separado do chat comum.

## 1) Escopo da etapa

Consolidar implementacao de:

- Modo Escrita separado de `/chat`;
- estrutura de projetos e secoes de escrita;
- memoria de processo;
- resumos por secao e resumo global;
- fluxo de continue writing com anti-redundancia;
- superficie de API `/write/*` para frontend de editor com IA.

## 2) O que foi implementado

1. Dominio `/write/*` separado do chat comum.
2. Modelo de projeto, secao, chunk e memoria de processo.
3. Embeddings de chunks e memoria para retrieval semantico.
4. Servico de resumo de secao e resumo global, com versionamento explicito.
5. Servico de continue writing com context pack multi-camada e instrucoes anti-redundancia.
6. Rotas de CRUD minimo de projeto/secao e fluxo de insercao/continuidade.
7. Documentacao tecnica, ADRs e guias de integracao frontend.

## 3) Tabelas criadas

Schema `writing_store`:

- `writing_projects`
- `writing_sections`
- `draft_chunks`
- `draft_chunk_embeddings`
- `process_memory`
- `process_memory_embeddings`
- `section_summaries`
- `project_global_summaries`

## 4) Migrations criadas

- `supabase/migrations/20260303140000_create_writing_mode_schema.sql`
- `supabase/migrations/20260303141000_add_hnsw_indexes_writing_embeddings.sql`
- `supabase/migrations/20260303142000_create_writing_summaries_schema.sql`

Rollbacks formais:

- `supabase/migrations/rollback/20260303140000_drop_writing_mode_schema.sql`
- `supabase/migrations/rollback/20260303142000_drop_writing_summaries_schema.sql`

## 5) Servicos implementados

- `WriteService`
- `WriteSummaryService`
- `WriteContinueService`

## 6) Rotas `/write/*` adicionadas (Etapa 3)

- `POST /write/projects`
- `GET /write/projects/{project_id}`
- `PATCH /write/projects/{project_id}`
- `POST /write/projects/{project_id}/sections`
- `GET /write/projects/{project_id}/sections`
- `PATCH /write/sections/{section_id}`
- `POST /write/insert`
- `POST /write/continue`
- `POST /write/sections/{section_id}/summarize`
- `POST /write/projects/{project_id}/summarize`
- `GET /write/sections/{section_id}/summary`
- `GET /write/projects/{project_id}/summary`

Complementares do dominio write:

- `GET /write/projects`
- `POST /write/projects/{project_id}/memory`
- `GET /write/projects/{project_id}/memory`
- `POST /write/projects/{project_id}/references`
- `POST /write/projects/{project_id}/assist`

## 7) Fluxo de anti-redundancia

`POST /write/continue` executa:

1. resolucao de projeto/secao alvo;
2. retrieval semantico de top-k chunks similares;
3. retrieval de memoria de processo relevante;
4. leitura de resumo de secao + resumo global;
5. montagem centralizada de context pack (`ContinueWritingPromptBuilder`);
6. chamada ao LLM interno para gerar apenas o proximo bloco;
7. persistencia em `draft_chunks` + embedding do chunk gerado.

## 8) Mecanismo de resumos

- Resumo de secao em `section_summaries`.
- Resumo global em `project_global_summaries`.
- Atualizacao explicita por endpoint de summarize.
- `summary_version` evolui apenas quando houve mudanca material (`updated=true`).

## 9) Documentos criados na etapa

- `docs/data/schema-modo-escrita.md`
- `docs/adr/ADR-003-schema-modo-escrita.md`
- `docs/api/resumos-write.md`
- `docs/infra/resumos-modo-escrita.md`
- `docs/api/write-continue.md`
- `docs/infra/anti-redundancia-write.md`
- `docs/infra/continue-writing-flow.md`
- `docs/api/write-routes.md`
- `docs/api/write-payloads-e-responses.md`
- `docs/adr/ADR-004-modo-escrita-workspace.md`
- `docs/infra/workspace-escrita-fluxo.md`
- `docs/frontend/integracao-modo-escrita.md`
- `docs/frontend/estado-minimo-editor-ia.md`

## 10) Riscos remanescentes

1. Repositorio de runtime write ainda in-memory (sem persistencia transacional de producao).
2. Sem controle otimista de concorrencia para multi-editor.
3. Sem auto-refresh obrigatorio de resumos apos todo chunk.
4. Qualidade de retrieval depende do embedding baseline atual.

## 11) Pendencias para proxima etapa

1. Edicao de chunks com versionamento nao destrutivo (iniciada na Etapa 4).
2. Exposicao de historico de versoes por API (iniciada na Etapa 4).
3. Politica explicita de impacto de edicao em retrieval e resumos (iniciada na Etapa 4).

## 12) Criterios de aceite da etapa

- [x] dominio de escrita separado do chat;
- [x] schema de projetos e memoria implementado;
- [x] resumos por secao e globais disponiveis;
- [x] fluxo de continue writing com anti-redundancia funcional;
- [x] rotas `/write/*` documentadas;
- [x] documentacao suficiente para auditoria e reproducao.

## 13) Evidencias de auditabilidade

### 13.1 Migrations

- `supabase/migrations/20260303140000_create_writing_mode_schema.sql`
- `supabase/migrations/20260303141000_add_hnsw_indexes_writing_embeddings.sql`
- `supabase/migrations/20260303142000_create_writing_summaries_schema.sql`
- `supabase/migrations/rollback/20260303140000_drop_writing_mode_schema.sql`
- `supabase/migrations/rollback/20260303142000_drop_writing_summaries_schema.sql`

### 13.2 ADRs

- `docs/adr/ADR-003-schema-modo-escrita.md`
- `docs/adr/ADR-004-modo-escrita-workspace.md`

### 13.3 Docs tecnicas

- `docs/data/schema-modo-escrita.md`
- `docs/infra/resumos-modo-escrita.md`
- `docs/infra/anti-redundancia-write.md`
- `docs/infra/continue-writing-flow.md`
- `docs/infra/workspace-escrita-fluxo.md`
- `docs/api/write-routes.md`
- `docs/api/write-payloads-e-responses.md`
- `docs/api/write-continue.md`

### 13.4 Rotas implementadas

- superficie completa em `anm_backend/api/routes_write.py`.

### 13.5 Servicos centrais

- `anm_backend/services/write_service.py`
- `anm_backend/services/write_summary_service.py`
- `anm_backend/services/write_continue_service.py`

### 13.6 Pontos de configuracao

- `EMBEDDING_DIMENSION`
- `ANM_WRITE_EMBEDDING_MODEL`
- `ANM_WRITE_MAX_TOKENS`
- `ANM_WRITE_CONTEXT_LIMIT`
- `ANM_WRITE_CONTINUE_MAX_TOKENS`

### 13.7 Componentes de prompt assembly

- `anm_backend/write/continue_prompt_builder.py`
- `ContinueWritingPromptBuilder`
- `ContinueWritingContextPack`

### 13.8 Componentes de retrieval e resumo

- `anm_backend/write/semantic_embeddings.py`
- `DeterministicEmbeddingProvider`
- `cosine_similarity`
- `anm_backend/write/summarizer.py`
- `DeterministicWriteSummarizer`
