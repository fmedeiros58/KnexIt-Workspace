# API Reindexacao Write

Data: 2026-03-03
Base path: `/write`

## 1) Endpoints

- `POST /write/chunks/{chunk_id}/reindex`
- `POST /write/sections/{section_id}/reindex`
- `POST /write/projects/{project_id}/reindex`

## 2) Request

Sem payload obrigatorio.

## 3) Response padrao

```json
{
  "trace_id": "trace-...",
  "scope": "chunk",
  "project_id": "wrp-...",
  "section_id": "wrs-...",
  "chunk_id": "wrc-...",
  "reindexed_chunk_ids": ["wrc-..."],
  "reindexed_count": 1,
  "failed_chunk_ids": [],
  "embedding_model": "deterministic-hash-embed-v1",
  "reindexed_at": "2026-03-03T..."
}
```

Observacoes:

- `scope` varia entre `chunk`, `section`, `project`.
- `reindexed_chunk_ids` lista os chunks atualizados.
- `failed_chunk_ids` fica vazio na versao atual quando nao ha falha parcial.

## 4) Erros comuns

- `404`: chunk/secao/projeto nao encontrado.

## 5) Uso recomendado

1. use reindex automatico no patch/autosave para manter consistencia imediata.
2. use endpoints de reindex manual para:
- recuperacao operacional;
- reindex em lote apos manutencao;
- validacao de ambiente.

## 6) Relacao com versionamento

- reindex sempre representa a versao atual do chunk;
- snapshots historicos nao sao indexados para retrieval ativo nessa etapa.
