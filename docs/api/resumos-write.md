# API - Resumos do Modo Escrita

Data: 2026-03-03  
Base path: `/write`

## 1) Endpoints

### POST `/write/sections/{section_id}/summarize`

Recalcula (sincrono) o resumo da secao informada.

Resposta (`200`):

```json
{
  "updated": true,
  "trace_id": "trace-...",
  "summary": {
    "summary_id": "wss-...",
    "project_id": "wrp-...",
    "section_id": "wrs-...",
    "summary": "texto do resumo",
    "summary_version": 1,
    "source_chunk_count": 3,
    "last_chunk_id_processed": "wrc-...",
    "created_at": "2026-03-03T...",
    "updated_at": "2026-03-03T..."
  }
}
```

Erros:
- `404`: secao nao encontrada.

### GET `/write/sections/{section_id}/summary`

Retorna o resumo ativo da secao.

Resposta (`200`):

```json
{
  "summary": {
    "summary_id": "wss-...",
    "project_id": "wrp-...",
    "section_id": "wrs-...",
    "summary": "texto do resumo",
    "summary_version": 2,
    "source_chunk_count": 4,
    "last_chunk_id_processed": "wrc-...",
    "created_at": "2026-03-03T...",
    "updated_at": "2026-03-03T..."
  }
}
```

Erros:
- `404`: resumo da secao ainda nao existe.

### POST `/write/projects/{project_id}/summarize`

Recalcula (sincrono) o resumo global do projeto.

Resposta (`200`):

```json
{
  "updated": true,
  "trace_id": "trace-...",
  "summary": {
    "summary_id": "wpg-...",
    "project_id": "wrp-...",
    "summary": "texto do resumo global",
    "summary_version": 1,
    "source_chunk_count": 8,
    "created_at": "2026-03-03T...",
    "updated_at": "2026-03-03T..."
  }
}
```

Erros:
- `404`: projeto nao encontrado.

### GET `/write/projects/{project_id}/summary`

Retorna o resumo global ativo do projeto.

Resposta (`200`):

```json
{
  "summary": {
    "summary_id": "wpg-...",
    "project_id": "wrp-...",
    "summary": "texto do resumo global",
    "summary_version": 1,
    "source_chunk_count": 8,
    "created_at": "2026-03-03T...",
    "updated_at": "2026-03-03T..."
  }
}
```

Erros:
- `404`: resumo global ainda nao existe.

## 2) Comportamento de versionamento

- `summary_version` inicia em `1`.
- versao sobe apenas quando houve mudanca material no resumo (texto ou contadores de origem).
- campo `updated` deixa esse resultado explicito em `POST .../summarize`.

## 3) Fluxo recomendado

1. escrever novos chunks em uma secao;
2. chamar `POST /write/sections/{section_id}/summarize`;
3. chamar `POST /write/projects/{project_id}/summarize`;
4. consultar `GET` de resumo para verificar estado ativo/versionado.

## 4) Limites da versao atual

- sem processador assincorno/queue;
- sem historico de snapshots por versao (somente resumo ativo);
- sem acionamento automatico oculto apos append de chunk.

