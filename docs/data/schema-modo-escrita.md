# Schema Modo Escrita (Projetos, Secoes, Chunks e Memoria de Processo)

Data: 2026-03-03  
Escopo: base relacional e vetorial auditavel para escrita longa, continuidade textual e recuperacao semantica.

## 1) Visao geral

O schema do Modo Escrita foi adicionado em `writing_store` sem alterar nem remover estruturas da Etapa 2 (`vector_store`).

Diagrama logico textual:

```text
writing_store.writing_projects (1) ----< (N) writing_store.writing_sections
writing_store.writing_projects (1) ----< (N) writing_store.draft_chunks
writing_store.writing_sections (1) ----< (N) writing_store.draft_chunks
writing_store.draft_chunks (1) ---- (1) writing_store.draft_chunk_embeddings
writing_store.draft_chunks (1) ----< (N) writing_store.draft_chunk_versions

writing_store.writing_projects (1) ----< (N) writing_store.process_memory
writing_store.writing_sections (1) ----< (N) writing_store.process_memory (opcional)
writing_store.process_memory (1) ---- (1) writing_store.process_memory_embeddings
```

## 2) Proposito por tabela

### `writing_store.writing_projects`

Projeto raiz de escrita longa.

Campos principais:
- `id` (PK)
- `title`
- `description`
- `status`
- `writing_mode`
- `style_profile`
- `metadata` (`jsonb`)
- `created_at`
- `updated_at`

### `writing_store.writing_sections`

Estrutura do projeto por secoes com ordenacao previsivel.

Campos principais:
- `id` (PK)
- `project_id` (FK)
- `parent_section_id` (FK nullable)
- `title`
- `objective`
- `section_order`
- `status`
- `outline_notes`
- `created_at`
- `updated_at`

### `writing_store.draft_chunks`

Blocos de texto produzidos por secao, com rastreabilidade de origem e versao.

Campos principais:
- `id` (PK)
- `project_id` (FK)
- `section_id` (FK)
- `chunk_order`
- `content`
- `source_type` (`generated`, `user_inserted`, `edited`)
- `version`
- `char_count`
- `token_count` (nullable)
- `created_at`
- `updated_at`

### `writing_store.draft_chunk_embeddings`

Embeddings dos chunks (1 embedding por chunk).

Campos principais:
- `id` (PK)
- `draft_chunk_id` (FK unico)
- `embedding` (`vector(768)`)
- `embedding_model`
- `created_at`

### `writing_store.draft_chunk_versions` (Etapa 4)

Historico imutavel de snapshots por versao do chunk.

Campos principais:
- `id` (PK)
- `draft_chunk_id` (FK)
- `version_number`
- `previous_version_id` (FK nullable)
- `content_snapshot`
- `edit_source`
- `metadata` (`jsonb`)
- `created_at`

### `writing_store.process_memory`

Memoria de processo para regras, decisoes e restricoes editoriais do projeto.

Campos principais:
- `id` (PK)
- `project_id` (FK)
- `section_id` (FK nullable)
- `memory_type` (`rule`, `constraint`, `decision`, `definition`, `terminology`, `warning`)
- `title`
- `content`
- `priority`
- `is_active`
- `created_at`
- `updated_at`

### `writing_store.process_memory_embeddings`

Embeddings dos itens de memoria (1 embedding por item).

Campos principais:
- `id` (PK)
- `process_memory_id` (FK unico)
- `embedding` (`vector(768)`)
- `embedding_model`
- `created_at`

## 3) Relacoes e integridade

- FKs explicitas entre projeto, secao, chunks e memoria de processo.
- Embeddings separados em tabelas dedicadas para manter cardinalidade 1:1 por entidade textual.
- Constraints de checks para status, tipo, prioridade e contagens.
- Triggers `updated_at` para auditabilidade temporal.
- Ordenacao previsivel:
  - `writing_sections`: `unique (project_id, section_order)`
  - `draft_chunks`: `unique (project_id, section_id, chunk_order, version)`

## 4) Decisao de embeddings separados

Embeddings de `draft_chunks` e `process_memory` ficam em tabelas distintas por motivos operacionais:

- isolam carga vetorial de escrita vs memoria de processo;
- permitem ciclos de re-embedding independentes;
- evitam colunas vetoriais em tabelas transacionais de alto churn;
- mantem contratos limpos para busca semantica por contexto.

Indices vetoriais HNSW foram adicionados com `vector_cosine_ops` para ambos os conjuntos.

## 5) Regras de versionamento de chunks

- `chunk_order` identifica a posicao logica do bloco na secao.
- `version` identifica revisoes do mesmo bloco logico.
- A constraint `unique (project_id, section_id, chunk_order, version)` impede sobrescrita silenciosa.
- `source_type` registra a origem da alteracao (`generated`, `user_inserted`, `edited`).

Observacao: resumos por secao nao fazem parte desta etapa.

## 6) Como o schema sustenta continuidade de escrita

- Outline: `writing_sections` + `outline_notes`.
- Texto produzido: `draft_chunks` ordenados e versionados.
- Regras e decisoes: `process_memory` com prioridade e ativacao.
- Recuperacao semantica:
  - contexto textual por `draft_chunk_embeddings`;
  - contexto de decisao/restricao por `process_memory_embeddings`.

Esse conjunto permite retomar escrita longa com historico auditavel e contexto semantico persistente.

## 7) Migrations aplicadas

- `supabase/migrations/20260303140000_create_writing_mode_schema.sql`
- `supabase/migrations/20260303141000_add_hnsw_indexes_writing_embeddings.sql`
- `supabase/migrations/20260303150000_create_draft_chunk_versions_schema.sql`

Rollback formal versionado (manual e controlado):
- `supabase/migrations/rollback/20260303140000_drop_writing_mode_schema.sql`

## 8) Reproducao em outro ambiente

1. Garantir Postgres com extensao `vector`.
2. Aplicar migrations do projeto (fluxo Supabase padrao) ou aplicar os arquivos SQL acima em ordem.
3. Validar existencia das tabelas:

```sql
select to_regclass('writing_store.writing_projects');
select to_regclass('writing_store.writing_sections');
select to_regclass('writing_store.draft_chunks');
select to_regclass('writing_store.draft_chunk_embeddings');
select to_regclass('writing_store.process_memory');
select to_regclass('writing_store.process_memory_embeddings');
```

4. Validar indices HNSW:

```sql
select to_regclass('writing_store.draft_chunk_embeddings_embedding_hnsw_cosine_idx');
select to_regclass('writing_store.process_memory_embeddings_embedding_hnsw_cosine_idx');
```
