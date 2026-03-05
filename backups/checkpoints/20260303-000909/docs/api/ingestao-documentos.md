# API de Ingestao de Documentos

Data: 2026-03-03  
Escopo: endpoints minimos para ingestao RAG por usuario (frontend) e super admin (lote).

## 1) POST `/api/ingest`

Endpoint unico para ingestao.

### 1.1 Modo usuario (frontend) - upload de arquivo

Content-Type: `multipart/form-data`

Campos:
- `file` (obrigatorio)
- `sessionId` (obrigatorio quando nao houver Bearer token)
- `title` (opcional)
- `sourceType` (opcional, default: `user_upload`)
- `metadata` (opcional, JSON string)

Exemplo (curl):

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Authorization: Bearer <token-opcional>" \
  -F "sessionId=knx_session_123456" \
  -F "file=@./meu-arquivo.md" \
  -F "title=Manual interno"
```

### 1.2 Modo usuario (frontend) - referencia unica

Content-Type: `application/json`

Body:

```json
{
  "sessionId": "knx_session_123456",
  "filePath": "entrada/manual.md",
  "title": "Manual interno",
  "sourceType": "server_reference",
  "metadata": {
    "team": "ops"
  }
}
```

### 1.3 Modo super admin - ingestao em massa

Content-Type: `application/json`  
Autorizacao: `x-rag-admin-token` (ou `adminToken` no body), comparado com `RAG_INGEST_ADMIN_TOKEN`.

Body:

```json
{
  "sourcePaths": [
    "lote/politicas/p1.md",
    "lote/politicas/p2.docx"
  ],
  "sourceType": "server_reference",
  "titlePrefix": "Lote RH",
  "metadata": {
    "batch": "rh-2026-03"
  }
}
```

Resposta:
- `200` quando todos itens concluem.
- `207` quando ha sucesso parcial.
- `result.embeddingStatus` indica estado da indexacao de embeddings (`completed`, `failed`, `pending`).

## 2) GET `/api/ingest/:id`

Consulta status de um `ingestion_job`.

Exemplo:

```bash
curl http://localhost:3000/api/ingest/42
```

Resposta esperada:

```json
{
  "ok": true,
  "job": {
    "id": 42,
    "status": "succeeded",
    "errorMessage": null,
    "startedAt": "2026-03-03T20:15:10.000Z",
    "finishedAt": "2026-03-03T20:15:11.000Z",
    "createdAt": "2026-03-03T20:15:10.000Z",
    "documentId": 15,
    "documentStatus": "processed",
    "contentHash": "..."
  }
}
```

Observacao:
- Se a tabela `vector_store.ingestion_jobs` nao existir no ambiente, o `POST /api/ingest` pode retornar `jobId: null` e `GET /api/ingest/:id` retorna erro explicito de indisponibilidade de tracking.

## 3) GET `/api/documents/:id`

Consulta documento e chunks persistidos.

Query params:
- `limit` (default `200`, max `1000`)
- `offset` (default `0`)

Exemplo:

```bash
curl "http://localhost:3000/api/documents/15?limit=100&offset=0"
```

Resposta:
- dados do documento (`source_type`, `hash`, status, metadata)
- lista de chunks (`chunkIndex`, `text`, `tokenCount`, `charStart`, `charEnd`)
- metadados de paginacao

## 4) Codigos de erro principais

- `400`: payload invalido (`INGEST_INPUT_REQUIRED`, `INGEST_INVALID_METADATA`)
- `401/403`: autenticacao/autorizacao (`INGEST_BULK_UNAUTHORIZED`, `INGEST_REFERENCE_FORBIDDEN`)
- `413`: arquivo excede limite (`INGEST_FILE_TOO_LARGE`)
- `415`: formato nao suportado (`INGEST_UNSUPPORTED_TYPE`)
- `422`: falha de extracao ou texto/chunks vazios (`INGEST_TEXT_EXTRACT_FAILED`, `INGEST_EMPTY_TEXT`, `INGEST_EMPTY_CHUNKS`)
- `500`: falha interna (`INGEST_INTERNAL_ERROR`)

## 5) Formatos suportados (v1)

- `text/plain` (`.txt`)
- `text/markdown` (`.md`, `.markdown`)
- `text/csv` (`.csv`)
- `application/json` (`.json`)
- `application/pdf` (`.pdf`)
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (`.docx`)

Formatos fora dessa lista retornam erro explicito (`415`).

Observacao sobre PDF:
- Esta versao extrai texto de PDFs textuais.
- PDFs apenas escaneados (imagem sem camada textual) podem retornar `INGEST_EMPTY_TEXT` (422), pois OCR nao faz parte do MVP.

## 6) Observacoes de rastreabilidade

- Cada ingestao cria linha em `vector_store.ingestion_jobs`.
- Cada documento possui `content_hash` para deduplicacao global.
- Metadata do documento registra:
  - ator (`user_id`, `session_id`, canal)
  - parametros de chunking usados
  - caminhos de arquivo bruto e texto extraido
  - estado de embeddings (`embedding_status=completed|failed|pending`).
- Logs operacionais (`RAG_INGEST_API_*` e `RAG_INGEST_*`) registram etapas, falhas e deduplicacao.

## 7) Embeddings no pipeline de ingestao

Variaveis de controle:
- `RAG_INGEST_EMBED_CHUNKS` (default `1`)
- `RAG_INGEST_EMBED_REQUIRED` (default `0`)
- `RAG_INGEST_EMBED_BATCH_SIZE` (default `16`)

Comportamento:
- Quando habilitado, o pipeline indexa embeddings em `vector_store.chunk_embeddings`.
- Se houver falha:
  - com `RAG_INGEST_EMBED_REQUIRED=1`: a ingestao retorna erro.
  - com `RAG_INGEST_EMBED_REQUIRED=0`: a ingestao conclui com `embeddingStatus=failed` (falha auditavel).
