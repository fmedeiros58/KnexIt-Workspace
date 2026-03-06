# API - Continue Writing (`/write/continue`)

Data: 2026-03-03  
Base path: `/write`

## 1) Endpoint principal

### POST `/write/continue`

Executa o fluxo de continuidade de escrita com anti-redundancia.

Request:

```json
{
  "project_id": "wrp-...",
  "instruction": "continue a secao e aprofunde o topico",
  "section_id": "wrs-...",
  "top_k_chunks": 6,
  "top_k_memories": 6,
  "min_paragraphs": 2,
  "max_paragraphs": 4,
  "max_tokens": 1400,
  "temperature": 0.2
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
    "role": "assistant",
    "text": "novo bloco gerado",
    "source_type": "generated",
    "chunk_order": 4,
    "version": 1,
    "char_count": 812,
    "token_count": 190,
    "created_at": "2026-03-03T...",
    "updated_at": "2026-03-03T...",
    "metadata": {
      "trace_id": "trace-...",
      "retrieval_chunk_ids": ["wrc-..."],
      "retrieval_memory_ids": ["wpm-..."]
    }
  },
  "retrieved_chunk_ids": ["wrc-...", "wrc-..."],
  "retrieved_memory_ids": ["wpm-..."],
  "section_summary_used": {
    "summary_id": "wss-...",
    "project_id": "wrp-...",
    "section_id": "wrs-...",
    "summary": "...",
    "summary_version": 2,
    "source_chunk_count": 8,
    "last_chunk_id_processed": "wrc-...",
    "created_at": "2026-03-03T...",
    "updated_at": "2026-03-03T..."
  },
  "project_global_summary_used": {
    "summary_id": "wpg-...",
    "project_id": "wrp-...",
    "summary": "...",
    "summary_version": 1,
    "source_chunk_count": 24,
    "created_at": "2026-03-03T...",
    "updated_at": "2026-03-03T..."
  },
  "top_k_applied": {
    "chunks": 6,
    "memories": 6
  },
  "parameters": {
    "paragraphs_min": 2,
    "paragraphs_max": 4,
    "max_tokens": 1400,
    "temperature": 0.2,
    "embedding_model": "deterministic-hash-embed-v1",
    "prompt_builder": "ContinueWritingPromptBuilder"
  }
}
```

Erros:

- `404`: projeto/secao nao encontrados.
- `422`: request invalido (ex.: instrucao vazia).
- `503`: falha no engine (`engine_error`).

## 2) Endpoint auxiliar de memoria de processo

### POST `/write/projects/{project_id}/memory`

Cria item de memoria de processo e registra embedding para retrieval no continue-writing.

Request:

```json
{
  "section_id": "wrs-...",
  "memory_type": "terminology",
  "title": "termo oficial",
  "content": "usar termo X em todo o manuscrito",
  "priority": 800,
  "is_active": true
}
```

Response (`200`):

```json
{
  "memory": {
    "memory_id": "wpm-...",
    "project_id": "wrp-...",
    "section_id": "wrs-...",
    "memory_type": "terminology",
    "title": "termo oficial",
    "content": "usar termo X em todo o manuscrito",
    "priority": 800,
    "is_active": true,
    "created_at": "2026-03-03T...",
    "updated_at": "2026-03-03T..."
  }
}
```

## 3) Observacoes de uso

- `/write/continue` nao substitui `/chat` e nao compartilha endpoint com chat comum.
- atualizar resumos continua explicito via:
- `POST /write/sections/{section_id}/summarize`
- `POST /write/projects/{project_id}/summarize`
- para melhor qualidade de continuidade, manter `process_memory` ativo e atualizado por secao/projeto.

