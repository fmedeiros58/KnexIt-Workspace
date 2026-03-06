# API Memoria de Processo Write

Data: 2026-03-03
Base path: /write

## 1) Rotas

- `POST /write/projects/{project_id}/memory`
- `GET /write/projects/{project_id}/memory`
- `GET /write/projects/{project_id}/memory/inactive`
- `PATCH /write/memory/{memory_id}`
- `POST /write/projects/{project_id}/memory/consolidate`

## 2) Criacao de memoria

### POST /write/projects/{project_id}/memory

Request:

```json
{
  "section_id": "wrs-...",
  "memory_type": "terminology",
  "title": "Termo padrao",
  "content": "Usar framework de evidencia como termo padrao.",
  "priority": 800,
  "is_active": true
}
```

Response (resumo):

```json
{
  "memory": {
    "memory_id": "wpm-...",
    "is_active": true,
    "use_count": 0,
    "last_used_at": null,
    "deactivated_at": null,
    "deactivation_reason": "",
    "consolidated_into_memory_id": null
  }
}
```

## 3) Patch de memoria

### PATCH /write/memory/{memory_id}

Request exemplo (desativar):

```json
{
  "is_active": false,
  "deactivation_reason": "manual_cleanup"
}
```

Request exemplo (reativar):

```json
{
  "is_active": true,
  "deactivation_reason": "manual_reactivation"
}
```

## 4) Consolidacao

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
  "project_id": "wrp-...",
  "dry_run": false,
  "duplicate_groups": [
    {
      "primary_memory_id": "wpm-a",
      "duplicate_memory_ids": ["wpm-b"]
    }
  ],
  "deactivated_memory_ids": ["wpm-b"],
  "kept_memory_ids": ["wpm-a"],
  "deactivated_by_ttl_ids": [],
  "active_count": 12,
  "inactive_count": 3
}
```

## 5) Consultas

### GET /write/projects/{project_id}/memory

Retorna estrutura completa com:
- `items` (todas)
- `active_items`
- `inactive_items`
- `counts` (total/active/inactive)

### GET /write/projects/{project_id}/memory/inactive

Retorna apenas lista inativa em `inactive_memory`.

## 6) Erros comuns

- `404`: projeto ou memoria nao encontrado.
- `422`: payload invalido.

## 7) Observacao de escopo

Esta versao cobre consolidacao minima e auditavel. Nao inclui co-edicao complexa nem remocao fisica automatica de memorias.

