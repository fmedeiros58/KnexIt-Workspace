# Indices Vetoriais HNSW (pgvector)

Data: 2026-03-03  
Escopo: indexacao vetorial e consulta top-k minima sobre o schema RAG em Postgres.

## 1) Estrategia de distancia adotada

- Estrategia unica nesta etapa: **cosine distance** (`<=>` com `vector_cosine_ops`).
- Parametro operacional: `VECTOR_DISTANCE_STRATEGY=cosine`.

## 2) Motivo da escolha

- Compatibilidade com embeddings de texto normalmente normalizados.
- Interpretacao direta para retrieval sem reranking nesta fase.
- Suporte nativo e estavel no pgvector para HNSW + cosine.

## 3) Como o indice HNSW foi criado

Migration dedicada:

- `supabase/migrations/20260303130000_add_hnsw_index_chunk_embeddings.sql`

A migration:

1. Garante extensao `vector`.
2. Remove indice vetorial anterior (`ivfflat`) quando existente.
3. Cria indice HNSW:

```sql
create index if not exists chunk_embeddings_embedding_hnsw_cosine_idx
  on vector_store.chunk_embeddings
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);
```

## 4) Tabelas/campos participantes

- Tabela vetorial principal: `vector_store.chunk_embeddings`
  - campo indexado: `embedding vector(768)`
- Tabelas de contexto para retorno do retrieval:
  - `vector_store.document_chunks`
  - `vector_store.documents`

## 5) Consulta top-k implementada

Ponto central auditavel (sem SQL espalhado):

- Repositorio: `core/database/vector-retrieval-repository.ts`
- Utilitario de parametros: `core/database/vector-search-params.ts`

Retorno minimo por item:

- `chunkId`
- `documentId`
- `text`
- `distance`
- `score` (`1 - distance`)
- metadados uteis (`sourceType`, `sourcePath`, `title`, `metadata`, `embeddingModel`, faixa de chunk)

## 6) Exemplo de consulta top-k (SQL)

```sql
select
  dc.id as chunk_id,
  dc.document_id,
  dc.text,
  (ce.embedding <=> $1::vector) as distance
from vector_store.chunk_embeddings ce
join vector_store.document_chunks dc on dc.id = ce.chunk_id
join vector_store.documents d on d.id = dc.document_id
where d.status = 'processed'
order by ce.embedding <=> $1::vector
limit $2;
```

## 7) Parametros configuraveis

Env:

- `VECTOR_DISTANCE_STRATEGY=cosine` (fixado nesta etapa)
- `VECTOR_SEARCH_TOP_K_DEFAULT` (default: `8`)
- `VECTOR_SEARCH_TOP_K_MAX` (default: `50`)
- `VECTOR_SEARCH_MAX_DISTANCE_DEFAULT` (opcional)

Runtime (repositorio):

- `topK`
- `maxDistance`
- filtros opcionais (`documentId`, `sourceType`, `embeddingModel`)

## 8) Limitacoes da implementacao atual

- Nao ha reranking semantico/model-based nesta etapa.
- Assume 1 embedding por chunk (`chunk_id` unico na tabela).
- `score = 1 - distance` e utilitario para leitura; tuning de score final fica para etapa posterior.
- Dimensao fixa no schema: `768`.

## 9) Pontos de atencao para tuning futuro

- Ajustar `m` e `ef_construction` do HNSW conforme volume real.
- Avaliar `hnsw.ef_search` por sessao/consulta para recall x latencia.
- Definir politicas de cutoff por distancia por caso de uso.
- Se houver troca de modelo/dimensao, versionar estrutura de embeddings por migrations incrementais.

## 10) Reproducao e validacao

1. Aplicar bootstrap local:

```bash
powershell -ExecutionPolicy Bypass -File scripts/supabase-local-start.ps1
```

2. Validar infraestrutura:

```bash
npm run verify:nvme
npm run verify:nvme:sh
```

3. Confirmar indice no banco:

```sql
select to_regclass('vector_store.chunk_embeddings_embedding_hnsw_cosine_idx');
```
