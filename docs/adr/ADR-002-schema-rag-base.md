# ADR-002 - Schema RAG Base em Postgres + pgvector

- Status: Aceito
- Data: 2026-03-03
- Responsavel: Time KnexIT
- Escopo: base RAG auditavel no schema `vector_store`

## Contexto

A Etapa 2 introduziu conexao vetorial dedicada e bootstrap de `pgvector`, mas faltava um schema RAG minimo e formal para:

- ingestao rastreavel de documentos;
- chunking deterministico;
- embeddings vetoriais com integridade referencial;
- trilha de jobs para auditoria operacional.

Sem esse schema, a evolucao para pipeline de RAG ficaria ambigua e pouco auditavel.

## Decisao

Criar migration formal de schema base RAG em Postgres (`supabase/migrations/20260303120000_create_rag_base_schema.sql`) contendo:

- `vector_store.document_sources`
- `vector_store.documents`
- `vector_store.document_chunks`
- `vector_store.chunk_embeddings`
- `vector_store.ingestion_jobs`

Com:

- FKs explicitas;
- constraints de unicidade e checks de integridade;
- indices operacionais (incluindo indice vetorial `hnsw`);
- `CREATE EXTENSION IF NOT EXISTS vector` na migration;
- padrao de auditabilidade por timestamps e status controlado.

## Motivacao tecnica

- Garantir rastreabilidade ponta-a-ponta do documento ao embedding.
- Evitar duplicacao silenciosa de conteudo (`content_hash`).
- Suportar recuperacao vetorial mantendo extensibilidade para multiplos modelos.
- Preservar compatibilidade com a arquitetura atual (sem refatoracao destrutiva).

## Alternativas consideradas

1. Manter tabela unica de chunks+embedding.
- Rejeitada: baixa normalizacao e rastreabilidade de ingestao.

2. Adotar nova stack ORM para modelagem RAG.
- Rejeitada: fora do escopo, risco alto de quebra.

3. Guardar embeddings fora do Postgres nesta etapa.
- Rejeitada: contraria objetivo da etapa e reduz auditabilidade no banco.

## Impactos positivos

- Base minima clara para pipeline RAG.
- Integridade referencial entre documentos, chunks e embeddings.
- Capacidade de auditoria por jobs/status/erros.
- Estrutura preparada para reproduzir em novos ambientes.

## Riscos

- `vector(768)` fixa dimensao base; mudancas futuras exigem estrategia de migração.
- Em ambientes gerenciados, permissao para `CREATE EXTENSION vector` pode variar.
- Indice `hnsw` exige tuning futuro conforme volume de dados.

## Trade-offs

- Pro:
  - schema minimo, coeso e extensivel.
  - melhora auditabilidade e reproducao.
- Contra:
  - adiciona complexidade inicial de governanca (dimensao/modelo/versionamento).

## Consequencias futuras

- Evolucoes de embedding/modelo devem ser versionadas por migration (sem overwrite destrutivo).
- Qualquer mudanca de dimensao deve ser tratada com backfill controlado.
- Pipeline de ingestao da Etapa 3 deve respeitar esse contrato de dados.

## Dependencias

- Postgres com extensao `vector`.
- Fluxo de migration Supabase local.
- Config central de dimensao (`EMBEDDING_DIMENSION`, default 768).

## Compatibilidade

- Banco atual foi preservado.
- Sem remocao de tabelas legadas.
- Sem migracao de dados antigos nesta etapa.

## Evidencias

- Migration: `supabase/migrations/20260303120000_create_rag_base_schema.sql`
- Verificacao operacional atualizada:
  - `scripts/verify-nvme-setup.ps1`
  - `scripts/verify-nvme-setup.sh`
- Documentacao tecnica:
  - `docs/data/schema-rag-base.md`
  - `docs/infra/bootstrap-postgres-pgvector.md`
