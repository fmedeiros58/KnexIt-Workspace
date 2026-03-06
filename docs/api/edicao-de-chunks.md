# API - Edicao de Chunks (`/write/chunks/*`)

Data: 2026-03-03
Base path: `/write`

## 1) Endpoints

- `PATCH /write/chunks/{chunk_id}`
- `GET /write/chunks/{chunk_id}`
- `GET /write/chunks/{chunk_id}/versions`

## 2) PATCH /write/chunks/{chunk_id}

Edita o chunk atual sem perder historico.

Request:

```json
{
  "content": "Trecho revisado...",
  "edit_source": "user_edit",
  "token_count": 180,
  "metadata": {
    "editor": "frontend"
  },
  "update_embedding": true,
  "summarize_section": false,
  "summarize_project": false
}
```

Response (`200`):

```json
{
  "trace_id": "trace-...",
  "project_id": "wrp-...",
  "section_id": "wrs-...",
  "chunk": {
    "chunk_id": "wrc-...",
    "project_id": "wrp-...",
    "section_id": "wrs-...",
    "role": "user",
    "text": "Trecho revisado...",
    "source_type": "edited",
    "chunk_order": 3,
    "version": 2,
    "char_count": 19,
    "token_count": 180,
    "created_at": "2026-03-03T...",
    "updated_at": "2026-03-03T...",
    "metadata": {
      "editor": "frontend",
      "edit_source": "user_edit"
    }
  },
  "version_record": {
    "version_id": "wcv-...",
    "draft_chunk_id": "wrc-...",
    "project_id": "wrp-...",
    "section_id": "wrs-...",
    "version_number": 2,
    "previous_version_id": "wcv-...",
    "content_snapshot": "Trecho revisado...",
    "edit_source": "user_edit",
    "created_at": "2026-03-03T...",
    "metadata": {
      "origin": "edit_chunk"
    }
  },
  "applied": {
    "update_embedding": true,
    "summarize_section": false,
    "summarize_project": false
  },
  "section_summary": null,
  "project_summary": null
}
```

## 3) GET /write/chunks/{chunk_id}

Retorna estado atual do chunk.

Response (`200`):

```json
{
  "chunk": {
    "chunk_id": "wrc-...",
    "version": 2,
    "text": "Trecho revisado...",
    "updated_at": "2026-03-03T..."
  }
}
```

## 4) GET /write/chunks/{chunk_id}/versions

Retorna historico de versoes do chunk (mais recente primeiro).

Response (`200`):

```json
{
  "chunk_id": "wrc-...",
  "versions": [
    {
      "version_id": "wcv-2",
      "version_number": 2,
      "previous_version_id": "wcv-1",
      "content_snapshot": "Trecho revisado...",
      "edit_source": "user_edit",
      "created_at": "2026-03-03T..."
    },
    {
      "version_id": "wcv-1",
      "version_number": 1,
      "previous_version_id": null,
      "content_snapshot": "Trecho original...",
      "edit_source": "user_inserted",
      "created_at": "2026-03-03T..."
    }
  ]
}
```

## 5) Validacao e erros

- `404`: chunk nao encontrado.
- `422`: payload invalido (conteudo vazio/tipo limite).
- `503`: erro interno no fluxo de patch (ex.: dependencia indisponivel para summarize/embedding).

## 6) Regras de uso no frontend

1. carregar chunk atual (`GET /write/chunks/{id}`) antes de editar em multi-aba.
2. aplicar edicao com `PATCH /write/chunks/{id}`.
3. atualizar estado local pelo payload retornado, nao por inferencia local.
4. consultar historico com `GET /write/chunks/{id}/versions` quando precisar auditoria.

## 7) Estado vs consulta

Rotas que alteram estado:

- `PATCH /write/chunks/{chunk_id}`

Rotas somente consulta:

- `GET /write/chunks/{chunk_id}`
- `GET /write/chunks/{chunk_id}/versions`
