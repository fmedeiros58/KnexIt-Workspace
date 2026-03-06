# ADR-003 - Schema Modo Escrita (Projetos, Secoes, Chunks e Memoria)

- Status: Aceito
- Data: 2026-03-03
- Responsavel: Time KnexIT
- Escopo: dominio de escrita longa em Postgres com recuperacao semantica dedicada

## Contexto

A Etapa 3 introduziu o dominio de escrita no backend, mas ainda faltava schema persistente para:

- projetos de escrita longa;
- estrutura por secoes;
- blocos de texto com versao;
- memoria de processo (regras, decisoes, restricoes);
- busca semantica tanto no texto quanto na memoria.

Sem esse schema, a continuidade de escrita ficava dependente de estado em memoria e sem trilha auditavel completa.

## Decisao

Criar schema dedicado `writing_store` com migrations formais:

- `supabase/migrations/20260303140000_create_writing_mode_schema.sql`
- `supabase/migrations/20260303141000_add_hnsw_indexes_writing_embeddings.sql`

E rollback formal versionado (manual e controlado):

- `supabase/migrations/rollback/20260303140000_drop_writing_mode_schema.sql`

Tabelas adotadas:

- `writing_projects`
- `writing_sections`
- `draft_chunks`
- `draft_chunk_embeddings`
- `process_memory`
- `process_memory_embeddings`

## Motivacao tecnica

- Separar claramente o dominio de escrita do dominio de RAG da Etapa 2.
- Garantir rastreabilidade de texto produzido (ordem + versao + origem).
- Persistir memoria editorial para continuidade entre sessoes.
- Permitir recuperacao semantica contextual em dois planos:
  - texto produzido;
  - memoria de processo.

## Regras estruturais definidas

- FKs explicitas e checks de integridade em todas as entidades centrais.
- `updated_at` com trigger dedicado para trilha temporal.
- Embeddings em tabelas separadas (1:1 por entidade textual).
- Ordenacao previsivel:
  - secoes por `project_id + section_order`;
  - chunks por `project_id + section_id + chunk_order + version`.

## Decisoes estaveis para proximas etapas

1. **Separacao de embeddings**
- `draft_chunk_embeddings` e `process_memory_embeddings` continuam separados.

2. **Versionamento de chunks por coluna**
- `version` permanece no `draft_chunks`; nao usar sobrescrita destrutiva.

3. **Schema dedicado**
- dominio de escrita permanece em `writing_store`, sem acoplar em `vector_store`.

4. **Dimensao vetorial base**
- `vector(768)` como baseline operacional, alinhado ao `EMBEDDING_DIMENSION`.

5. **Sem resumo por secao nesta etapa**
- sumarizacao de secao fica para etapa posterior.

## Alternativas consideradas

1. Unificar texto e memoria em uma unica tabela vetorial.
- Rejeitada: mistura semanticas e dificulta governanca.

2. Armazenar embedding diretamente nas tabelas transacionais.
- Rejeitada: aumenta acoplamento e custo de atualizacao.

3. Nao versionar chunks.
- Rejeitada: perde auditabilidade de revisoes e continuidade controlada.

## Consequencias

- Base pronta para escrita longa auditavel.
- Continuidade textual sustentada por secoes ordenadas + chunks versionados.
- Recuperacao semantica habilitada para texto e memoria de processo.
- Evolucoes futuras (resumos, anti-redundancia, checkpoint semantico) podem ser incrementais sem quebra estrutural.

## Compatibilidade

- Schema vetorial da Etapa 2 foi preservado.
- Nenhuma tabela da Etapa 2 foi removida ou alterada destrutivamente.

## Evidencias

- Migration de schema: `supabase/migrations/20260303140000_create_writing_mode_schema.sql`
- Migration de indices vetoriais: `supabase/migrations/20260303141000_add_hnsw_indexes_writing_embeddings.sql`
- Rollback formal versionado: `supabase/migrations/rollback/20260303140000_drop_writing_mode_schema.sql`
- Documentacao tecnica: `docs/data/schema-modo-escrita.md`

