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
| `/write/chunks/{chunk_id}` | GET | nao | - |
| `/write/chunks/{chunk_id}/versions` | GET | nao | - |
| `/write/continue` | POST | sim | `project_id`, `instruction` |
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
- `POST /write/continue` executa retrieval multi-camada + anti-redundancia + persistencia de novo chunk.
- Summaries sao atualizados de forma explicita por rota dedicada ou por flag explicita (`insert`/`patch chunk`).

## 4) Erros comuns

- `404`: projeto/secao/chunk/resumo nao encontrado.
- `422`: payload invalido (campos, tipos, limites).
- `503`: falha de engine no fluxo de geracao ou erro interno de dependencia.

## 5) Uso recomendado no frontend

1. Criar projeto.
2. Criar secoes.
3. Carregar secoes com `include_chunks=true` e `include_summaries=true`.
4. Persistir edicao manual com `/write/insert`.
5. Revisar blocos com `PATCH /write/chunks/{id}` quando necessario.
6. Gerar proximo bloco com `/write/continue`.
7. Atualizar e consultar resumos em checkpoints de edicao.

## 6) Observacao de autenticacao

No estado atual do backend, nao existe middleware dedicado de autenticacao para `/write/*`; as rotas seguem o mesmo padrao global da aplicacao.
