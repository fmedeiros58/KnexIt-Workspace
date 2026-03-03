# Schema RAG Base (Postgres + pgvector)

Data: 2026-03-03  
Escopo: schema minimo, auditavel e extensivel para ingestao, chunking, embeddings e recuperacao vetorial.

## 1) Diagrama logico textual

```text
vector_store.document_sources (1) ----< (N) vector_store.documents (1) ----< (N) vector_store.document_chunks (1) ---- (1) vector_store.chunk_embeddings
                                              \
                                               \----< (N) vector_store.ingestion_jobs
```

## 2) Proposito das tabelas

### `vector_store.document_sources`

Cataloga fontes de origem (tipo + caminho) para reuso e rastreabilidade.

Campos principais:
- `id` (PK)
- `source_type`
- `source_path`
- `display_name`
- `metadata` (`jsonb`)
- `created_at`
- `updated_at`

### `vector_store.documents`

Representa o documento canonico ingerido, com hash e estado operacional.

Campos principais:
- `id` (PK)
- `source_id` (FK opcional para `document_sources`)
- `source_type`
- `source_path`
- `original_filename`
- `mime_type`
- `content_hash`
- `title`
- `status`
- `metadata` (`jsonb`)
- `created_at`
- `updated_at`

### `vector_store.document_chunks`

Armazena chunking rastreavel por documento e posicao de caracteres.

Campos principais:
- `id` (PK)
- `document_id` (FK para `documents`)
- `chunk_index`
- `text`
- `token_count`
- `char_start`
- `char_end`
- `created_at`

### `vector_store.chunk_embeddings`

Armazena embedding vetorial por chunk (1 embedding por chunk).

Campos principais:
- `id` (PK)
- `chunk_id` (FK unico para `document_chunks`)
- `embedding` (`vector(768)`)
- `embedding_model`
- `created_at`

### `vector_store.ingestion_jobs`

Rastreia execucoes de ingestao/processamento para auditabilidade.

Campos principais:
- `id` (PK)
- `document_id` (FK nullable para `documents`)
- `status`
- `error_message`
- `started_at`
- `finished_at`
- `created_at`

## 3) Relacoes entre entidades

- `document_sources` -> `documents`:
  - `documents.source_id` referencia `document_sources.id` (`ON DELETE SET NULL`).
- `documents` -> `document_chunks`:
  - `document_chunks.document_id` referencia `documents.id` (`ON DELETE CASCADE`).
- `document_chunks` -> `chunk_embeddings`:
  - `chunk_embeddings.chunk_id` referencia `document_chunks.id` (`ON DELETE CASCADE`) e e `UNIQUE`.
- `documents` -> `ingestion_jobs`:
  - `ingestion_jobs.document_id` referencia `documents.id` (`ON DELETE SET NULL`).

## 4) Constraints relevantes

- Unicidade:
  - `document_sources(source_type, source_path)`
  - `documents(source_type, source_path, content_hash)`
  - indice unico adicional em `documents(content_hash)` para prevencao de duplicacao por hash.
  - `document_chunks(document_id, chunk_index)`
  - `chunk_embeddings(chunk_id)` (1 embedding por chunk)

- Validacoes:
  - status de `documents` e `ingestion_jobs` com `CHECK` em conjunto controlado.
  - `content_hash` obrigatorio e nao vazio.
  - `chunk_index >= 0`, `token_count >= 0` (quando presente), `char_end >= char_start`.

- Integridade temporal:
  - `ingestion_jobs.finished_at >= ingestion_jobs.started_at` quando ambos preenchidos.

## 5) Indices operacionais

- `documents`: por `status`, `source_type/source_path`, `created_at`, `metadata` (`GIN`).
- `document_chunks`: por `document_id`, faixa de caracteres e `created_at`.
- `chunk_embeddings`: por `embedding_model`, `created_at` e indice vetorial `hnsw` (`vector_cosine_ops`).
- `ingestion_jobs`: por `status/created_at` e `document_id`.

## 6) Suposicoes adotadas

- Um chunk possui exatamente um embedding ativo na tabela base (`chunk_id` unico).
- Reindexacao/multiplos modelos podem evoluir por versionamento futuro (sem quebrar o schema atual).
- O schema base e armazenado em `vector_store` para isolar responsabilidades de RAG.

## 7) Impacto da dimensao de embedding

- Dimensao base do schema: `768` (`vector(768)` em `chunk_embeddings.embedding`).
- Essa escolha deve permanecer alinhada com `EMBEDDING_DIMENSION` do runtime.
- Trocar dimensao no futuro exige estrategia de migração (nova coluna/tabela + backfill), pois `vector(N)` e tipado por dimensao.

## 8) Reproducao em outro ambiente

1. Garantir extensao `vector` suportada no Postgres alvo.
2. Configurar envs vetoriais (`VECTOR_DATABASE_URL` ou `VECTOR_DB_*`, `EMBEDDING_DIMENSION`).
3. Aplicar migration:

```bash
powershell -ExecutionPolicy Bypass -File scripts/supabase-local-start.ps1
```

4. Validar:

```bash
npm run verify:nvme
npm run verify:nvme:sh
```

5. Confirmar tabelas:

```sql
select to_regclass('vector_store.document_sources');
select to_regclass('vector_store.documents');
select to_regclass('vector_store.document_chunks');
select to_regclass('vector_store.chunk_embeddings');
select to_regclass('vector_store.ingestion_jobs');
```

## 9) Evolucao/versionamento sem quebra de dados

- Nunca alterar dimensao de embedding in-place sem plano de migração.
- Evoluir por migrations incrementais:
  - adicionar colunas nullable + backfill;
  - adicionar novas tabelas para novas versoes de embedding/modelo;
  - so depois promover constraints mais restritivas.
- Manter migracoes idempotentes e com nomenclatura temporal.
- Registrar decisoes estruturais em ADR antes de mudanças de cardinalidade/retencao.

## 10) Rollback conceitual (manual)

Como migrations Supabase sao forward-only no fluxo local atual, rollback deve ser manual e controlado:

1. Congelar escrita.
2. Exportar dados das tabelas RAG.
3. Reverter por script SQL manual em ordem inversa (drop indices/triggers/FKs/tabelas), se necessario.
4. Revalidar aplicacao com `verify:nvme`.
