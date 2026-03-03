# API Autosave Write

Data: 2026-03-03
Base path: `/write`

## 1) Endpoint

- `PATCH /write/chunks/{chunk_id}/autosave`

## 2) Request

```json
{
  "content": "Texto em edicao no editor...",
  "client_version": 3,
  "autosave_reason": "interval_tick",
  "editor_session_id": "editor-session-1",
  "client_timestamp": "2026-03-03T20:00:00Z",
  "metadata": {
    "cursor": 128
  },
  "reindex_embedding": true
}
```

Campos:

- `content`: conteudo atual do editor para o chunk.
- `client_version`: versao do chunk que o cliente acredita ser a atual.
- `autosave_reason`: motivo do trigger (`interval_tick`, `focus_lost`, etc.).
- `editor_session_id`: identificador de sessao local do editor.
- `client_timestamp`: timestamp do cliente (opcional, auditoria).
- `reindex_embedding`: se `true`, reindexa embedding da versao salva.

## 3) Response (save com mudanca)

```json
{
  "trace_id": "trace-...",
  "chunk_id": "wrc-...",
  "project_id": "wrp-...",
  "section_id": "wrs-...",
  "status": "saved",
  "conflict": false,
  "client_version": 3,
  "server_version": 4,
  "server_updated_at": "2026-03-03T...",
  "autosave_reason": "interval_tick",
  "editor_session_id": "editor-session-1",
  "chunk": {
    "chunk_id": "wrc-...",
    "version": 4,
    "text": "Texto em edicao no editor..."
  },
  "version_record": {
    "version_id": "wcv-...",
    "version_number": 4,
    "previous_version_id": "wcv-...",
    "edit_source": "system_edit"
  },
  "reindex_applied": true
}
```

## 4) Response (sem mudanca)

```json
{
  "trace_id": "trace-...",
  "chunk_id": "wrc-...",
  "status": "no_change",
  "conflict": false,
  "client_version": 4,
  "server_version": 4,
  "server_updated_at": "2026-03-03T...",
  "version_record": null,
  "reindex_applied": false
}
```

## 5) Erro de conflito (`409`)

```json
{
  "detail": {
    "error": "write_chunk_version_conflict",
    "chunk_id": "wrc-...",
    "client_version": 3,
    "server_version": 4,
    "server_updated_at": "2026-03-03T..."
  }
}
```

## 6) Erros comuns

- `404`: chunk inexistente.
- `409`: versao cliente desatualizada (conflito simples).
- `422`: payload invalido (conteudo vazio, versao invalida).

## 7) Uso recomendado no frontend

1. manter `server_version` do ultimo save confirmado.
2. enviar `client_version` em todo autosave.
3. em `409`, recarregar estado atual do chunk e resolver conflito no cliente.
4. usar `GET /write/chunks/{chunk_id}/versions` para auditoria do historico.
