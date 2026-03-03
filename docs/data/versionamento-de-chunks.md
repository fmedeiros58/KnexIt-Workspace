# Versionamento de Chunks (Modo Escrita)

Data: 2026-03-03
Escopo: base de edicao nao destrutiva para `/write/chunks/*`.

## 1) Estrategia escolhida

Estrategia adotada:

- `draft_chunks` permanece como estado atual do chunk;
- `draft_chunk_versions` registra snapshots imutaveis por versao.

Motivo:

- leitura da versao atual fica simples e rapida;
- historico fica rastreavel sem sobrescrever irreversivelmente;
- baixo acoplamento com retrieval e resumos existentes.

## 2) Relacao entre chunk atual e versoes

- `draft_chunks.id` identifica o chunk atual.
- `draft_chunk_versions.draft_chunk_id` referencia esse chunk.
- cada linha em `draft_chunk_versions` representa um snapshot (`version_number`).
- `previous_version_id` encadeia historico entre snapshots.

## 3) Tabela `writing_store.draft_chunk_versions`

Campos principais:

- `id`
- `draft_chunk_id` (FK -> `draft_chunks.id`)
- `version_number`
- `previous_version_id` (nullable)
- `content_snapshot`
- `edit_source` (`generated`, `user_inserted`, `edited`, `user_edit`, `system_edit`)
- `metadata` (`jsonb`)
- `created_at`

Garantias:

- edicao nao destrutiva: historico imutavel em tabela dedicada;
- unicidade por versao: `unique(draft_chunk_id, version_number)`;
- rastreabilidade de origem da edicao por `edit_source` e `metadata`.

## 4) Fluxo de edicao

1. frontend chama `PATCH /write/chunks/{chunk_id}` com novo `content`.
2. service valida payload e delega para repositorio.
3. repositorio atualiza estado atual do chunk (`draft_chunks` runtime/in-memory na stack atual).
4. repositorio cria snapshot em `draft_chunk_versions` com `version_number` incrementado.
5. service opcionalmente atualiza embedding e, se solicitado, resumos.

## 5) Impacto em retrieval, resumos e consistencia

- Retrieval de chunks continua usando o estado atual do chunk.
- Quando `update_embedding=true`, embedding do chunk atual e atualizado.
- Resumos permanecem explicitos; edicao nao dispara resumo implicitamente.
- Flags de summarize no `PATCH` permitem fluxo rastreavel (`summarize_section`, `summarize_project`).

## 6) Reproducao em outro ambiente

1. aplicar migration:
- `supabase/migrations/20260303150000_create_draft_chunk_versions_schema.sql`

2. (opcional) rollback:
- `supabase/migrations/rollback/20260303150000_drop_draft_chunk_versions_schema.sql`

3. validar tabela:

```sql
select to_regclass('writing_store.draft_chunk_versions');
```

4. validar historico:

```sql
select draft_chunk_id, version_number, edit_source, created_at
from writing_store.draft_chunk_versions
order by draft_chunk_id, version_number;
```

## 7) Limitacoes atuais

1. runtime atual usa repositorio in-memory para dominio write.
2. sem lock otimista para edicoes concorrentes.
3. sem autosave nesta etapa.
4. sem endpoint de diff entre versoes (apenas snapshots).
