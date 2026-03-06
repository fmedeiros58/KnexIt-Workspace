# API Write Payloads and Responses

Data: 2026-03-03
Base path: /write

## 1) Matriz de contrato minimo

| Rota | Metodo | Altera estado | Payload minimo |
|---|---|---|---|
| `/write/projects` | POST | sim | `title` |
| `/write/projects/{project_id}` | GET | nao | - |
| `/write/projects/{project_id}` | PATCH | sim | pelo menos 1 campo de patch |
| `/write/projects/{project_id}/sections` | POST | sim | `title` |
| `/write/projects/{project_id}/sections` | GET | nao | - |
| `/write/sections/{section_id}` | PATCH | sim | pelo menos 1 campo de patch |
| `/write/insert` | POST | sim | `project_id`, `section_id`, `content` |
| `/write/chunks/{chunk_id}` | PATCH | sim | `content` |
| `/write/chunks/{chunk_id}/autosave` | PATCH | sim | `content`, `client_version` |
| `/write/chunks/{chunk_id}/resummarize` | POST | sim | - |
| `/write/chunks/{chunk_id}` | GET | nao | - |
| `/write/chunks/{chunk_id}/versions` | GET | nao | - |
| `/write/chunks/{chunk_id}/reindex` | POST | sim | - |
| `/write/sections/{section_id}/reindex` | POST | sim | - |
| `/write/projects/{project_id}/reindex` | POST | sim | - |
| `/write/continue` | POST | sim | `project_id`, `instruction` |
| `/write/projects/{project_id}/memory` | POST | sim | `memory_type`, `title`, `content` |
| `/write/memory/{memory_id}` | PATCH | sim | pelo menos 1 campo de patch |
| `/write/projects/{project_id}/memory/consolidate` | POST | sim | opcional (`dry_run`, `similarity_threshold`, `ttl_days`, `low_priority_max`) |
| `/write/projects/{project_id}/memory/inactive` | GET | nao | - |
| `/write/sections/{section_id}/summarize` | POST | sim | - |
| `/write/projects/{project_id}/summarize` | POST | sim | - |
| `/write/sections/{section_id}/summary` | GET | nao | - |
| `/write/projects/{project_id}/summary` | GET | nao | - |

## 2) Requests e responses (exemplos)

### POST /write/projects

Request:

```json
{
  "title": "Meu manuscrito",
  "description": "escopo inicial",
  "metadata": {
    "origin": "frontend"
  }
}
```

Response:

```json
{
  "project": {
    "project_id": "wrp-...",
    "title": "Meu manuscrito",
    "description": "escopo inicial",
    "objective": "escopo inicial",
    "status": "draft",
    "sections": [],
    "references": []
  }
}
```

### POST /write/projects/{project_id}/sections

Request:

```json
{
  "title": "Secao 1",
  "kind": "section",
  "order": 0,
  "objective": "Definir problema",
  "outline_notes": "Contexto, lacuna, objetivo",
  "status": "planned",
  "content": ""
}
```

### POST /write/insert

Request:

```json
{
  "project_id": "wrp-...",
  "section_id": "wrs-...",
  "content": "Trecho manual...",
  "source_type": "user_inserted",
  "role": "user",
  "update_embedding": true,
  "summarize_section": false,
  "summarize_project": false
}
```

### PATCH /write/chunks/{chunk_id}

Request:

```json
{
  "content": "Trecho revisado...",
  "edit_source": "user_edit",
  "update_embedding": true,
  "summarize_section": false,
  "summarize_project": false
}
```

### POST /write/chunks/{chunk_id}/resummarize

Response (resumo):

```json
{
  "trace_id": "trace-...",
  "chunk_id": "wrc-...",
  "section_summary": { "summary_version": 3, "is_stale": false },
  "project_summary": { "summary_version": 2, "is_stale": false }
}
```

Response (resumo):

```json
{
  "trace_id": "trace-...",
  "chunk": {
    "chunk_id": "wrc-...",
    "version": 2,
    "source_type": "edited",
    "updated_at": "2026-03-03T..."
  },
  "version_record": {
    "version_id": "wcv-...",
    "version_number": 2,
    "previous_version_id": "wcv-...",
    "edit_source": "user_edit"
  }
}
```

### PATCH /write/chunks/{chunk_id}/autosave

Request:

```json
{
  "content": "Trecho em edicao...",
  "client_version": 3,
  "autosave_reason": "interval_tick",
  "editor_session_id": "editor-session-1",
  "reindex_embedding": true
}
```

Response (resumo):

```json
{
  "status": "saved",
  "client_version": 3,
  "server_version": 4,
  "server_updated_at": "2026-03-03T...",
  "reindex_applied": true
}
```

### POST /write/chunks/{chunk_id}/reindex

Response (resumo):

```json
{
  "scope": "chunk",
  "reindexed_count": 1,
  "embedding_model": "deterministic-hash-embed-v1"
}
```

### POST /write/continue

Request:

```json
{
  "project_id": "wrp-...",
  "section_id": "wrs-...",
  "instruction": "continue e aprofunde a secao",
  "top_k_chunks": 6,
  "top_k_memories": 6,
  "min_paragraphs": 2,
  "max_paragraphs": 4,
  "max_tokens": 1200,
  "temperature": 0.2
}
```

### POST /write/projects/{project_id}/memory/consolidate

Request:

```json
{
  "similarity_threshold": 0.96,
  "ttl_days": 45,
  "low_priority_max": 200,
  "dry_run": false
}
```

Response (resumo):

```json
{
  "trace_id": "trace-...",
  "duplicate_groups": [
    { "primary_memory_id": "wpm-a", "duplicate_memory_ids": ["wpm-b"] }
  ],
  "deactivated_memory_ids": ["wpm-b"],
  "active_count": 7,
  "inactive_count": 2
}
```

Response (resumo):

```json
{
  "trace_id": "trace-...",
  "chunk": { "chunk_id": "wrc-...", "source_type": "generated" },
  "retrieved_chunk_ids": ["wrc-..."],
  "retrieved_memory_ids": ["wpm-..."],
  "top_k_applied": { "chunks": 6, "memories": 6 }
}
```

### Rotas de resumo

- `POST /write/sections/{section_id}/summarize`
- `POST /write/projects/{project_id}/summarize`
- `GET /write/sections/{section_id}/summary`
- `GET /write/projects/{project_id}/summary`

## 3) Comportamento esperado

- `POST /write/insert` persiste chunk e, opcionalmente, atualiza embedding e resumos.
- `PATCH /write/chunks/{id}` edita chunk sem destruir historico e gera registro de versao.
- `PATCH /write/chunks/{id}/autosave` salva com controle de `client_version` para evitar overwrite cego.
- `POST /write/chunks/{id}/resummarize` recalcula secao e resumo global apos edicao relevante.
- `POST /write/*/reindex` recalcula embeddings explicitamente por escopo.
- `POST /write/continue` executa retrieval multi-camada + anti-redundancia + persistencia de novo chunk.
- `POST /write/projects/{id}/memory/consolidate` aplica deduplicacao/poda leve sem exclusao fisica.
- `PATCH /write/memory/{id}` permite desativar/reativar e ajustar prioridade de memoria.
- Summaries sao atualizados de forma explicita por rota dedicada ou por flag explicita (`insert`/`patch chunk`).

## 4) Erros comuns

- `404`: projeto/secao/chunk/resumo nao encontrado.
- `404`: memoria tambem pode retornar nao encontrado (`/write/memory/{id}`).
- `409`: conflito de versao no autosave.
- `422`: payload invalido (campos, tipos, limites).
- `503`: falha de engine no fluxo de geracao ou erro interno de dependencia.

## 5) Uso recomendado no frontend

1. Criar projeto.
2. Criar secoes.
3. Carregar secoes com `include_chunks=true` e `include_summaries=true`.
4. Persistir edicao manual com `/write/insert`.
5. Revisar blocos com `PATCH /write/chunks/{id}` quando necessario.
6. Usar autosave com `/write/chunks/{id}/autosave` durante digitacao.
7. Reindexar manualmente se necessario com `/write/chunks/{id}/reindex`.
8. Gerar proximo bloco com `/write/continue`.
9. Consolidar memoria periodicamente com `/write/projects/{id}/memory/consolidate`.
10. Atualizar e consultar resumos em checkpoints de edicao, incluindo `/write/chunks/{id}/resummarize` quando necessario.

## 6) Observacao de autenticacao

No estado atual do backend, nao existe middleware dedicado de autenticacao para `/write/*`; as rotas seguem o mesmo padrao global da aplicacao.
