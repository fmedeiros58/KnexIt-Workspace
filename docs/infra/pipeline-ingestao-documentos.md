# Pipeline de Ingestao de Documentos (RAG)

Data: 2026-03-03  
Escopo: pipeline minimo de ingestao para alimentar `vector_store.documents` e `vector_store.document_chunks` com rastreabilidade ponta a ponta.

## 1) Objetivo operacional

- Receber documentos do frontend (usuario final) ou por referencia de arquivo (super admin).
- Persistir arquivo bruto em storage local/NVMe.
- Extrair texto com parser seguro.
- Fazer chunking deterministico e configuravel.
- Persistir metadados, documento, chunks e status de ingestao.
- Indexar embeddings de chunks no fluxo de ingestao (configuravel).

## 2) Componentes implementados

- Servico central de ingestao:
  - `core/rag/document-ingestion-service.ts`
- Chunking deterministico:
  - `core/rag/chunking.ts`
- Extracao de texto (formatos suportados):
  - `core/rag/text-extractor.ts`
- Endpoints:
  - `POST /api/ingest`
  - `GET /api/ingest/:id`
  - `GET /api/documents/:id`

## 3) Fluxo completo da ingestao

1. Requisicao chega em `POST /api/ingest`.
2. Sistema identifica modo:
   - upload individual via `multipart/form-data` (`file`)
   - referencia unica via JSON (`filePath`)
   - lote admin via JSON (`sourcePaths[]`)
3. Sistema resolve ator de auditoria:
   - `userId` por Bearer token (quando disponivel)
   - `sessionId` (frontend)
4. Cria `ingestion_jobs` com status `running`.
   - quando a tabela `vector_store.ingestion_jobs` nao existe no ambiente, o pipeline segue com warning explicito em log e sem tracking de job.
5. Materializa entrada (bytes do arquivo):
   - upload: bytes vindos do frontend
   - referencia: leitura de arquivo no servidor
6. Calcula `content_hash` (SHA-256).
7. Deduplica por hash em `vector_store.documents`.
   - se ja existir, job termina como `succeeded` reutilizando `document_id`.
8. Salva arquivo bruto em `RAG_RAW_DOCUMENTS_PATH`.
9. Extrai texto (parser conforme tipo).
10. Executa chunking deterministico (tamanho + overlap configuraveis).
11. Salva texto extraido em `RAG_EXTRACTED_TEXT_PATH`.
12. Persiste no banco:
   - `document_sources` (upsert)
   - `documents` (`processing` -> `processed`)
   - `document_chunks`
13. Indexa embeddings dos chunks em `vector_store.chunk_embeddings` (quando `RAG_INGEST_EMBED_CHUNKS=1`).
14. Atualiza metadata de embeddings (`embedding_status`) no documento.
15. Atualiza `ingestion_jobs` para `succeeded` (ou `failed` em erro).

## 4) Validacoes implementadas

- Arquivo obrigatorio em upload (`file`).
- `filePath` obrigatorio em ingestao por referencia.
- Limite de tamanho: `RAG_MAX_FILE_SIZE_BYTES`.
- `sessionId` ou Bearer token exigidos para ingestao de usuario.
- Lote admin exige `RAG_INGEST_ADMIN_TOKEN`.
- Referencias de arquivo restritas a bases permitidas:
  - `RAG_ADMIN_BULK_BASE_PATH`
  - `STORAGE_BASE_PATH`
  - `DOCUMENTS_BASE_PATH`
- Formatos nao suportados falham com erro explicito (`415`).

## 5) Onde os arquivos ficam salvos

- Arquivo bruto:
  - `RAG_RAW_DOCUMENTS_PATH` (fallback: `data/rag/raw`)
  - Estrutura por ator e prefixo de hash para organizacao.
- Texto extraido:
  - `RAG_EXTRACTED_TEXT_PATH` (fallback: `data/rag/text`)
  - Nomeado por hash de conteudo (`<hash>.txt`).

## 6) Onde o texto e persistido

- Texto integral extraido:
  - arquivo `.txt` em `RAG_EXTRACTED_TEXT_PATH`
- Texto segmentado para RAG:
  - `vector_store.document_chunks.text`

## 7) Chunking (deterministico e configuravel)

Implementacao: `core/rag/chunking.ts`

- Parametros:
  - `RAG_CHUNK_SIZE_CHARS` (default `1200`)
  - `RAG_CHUNK_OVERLAP_CHARS` (default `180`)
  - `RAG_MAX_CHUNKS_PER_DOC` (default `5000`)
- Regras:
  - normaliza quebras de linha (`CRLF` -> `LF`)
  - tenta quebrar no fim de linha/espaco perto do limite
  - usa overlap fixo e previsivel
  - gera `char_start`/`char_end` por chunk
  - calcula `token_count` aproximado por separacao em whitespace

## 8) Status e falhas

`vector_store.ingestion_jobs.status`:
- `running`: job iniciado
- `succeeded`: concluido com documento criado ou deduplicado
- `failed`: falha validada/auditavel

Observacao:
- Se `vector_store.ingestion_jobs` estiver ausente, `jobId` pode vir `null` na resposta e o status detalhado por job fica indisponivel ate a migration do schema RAG ser aplicada.
- `embedding_status` do documento:
  - `completed`: embeddings indexados
  - `failed`: falha na indexacao
  - `pending`: indexacao nao executada (ex.: desabilitada por env)

Falhas comuns:
- `INGEST_FILE_TOO_LARGE`
- `INGEST_UNSUPPORTED_TYPE`
- `INGEST_EMPTY_TEXT`
- `INGEST_EMPTY_CHUNKS`
- `INGEST_REFERENCE_FORBIDDEN`
- `INGEST_BULK_UNAUTHORIZED`

## 9) Reproducao em outro ambiente

1. Configurar `.env.local` com:
   - `VECTOR_DATABASE_URL` (ou `VECTOR_DB_*`)
   - paths RAG (`RAG_RAW_DOCUMENTS_PATH`, `RAG_EXTRACTED_TEXT_PATH`, `RAG_ADMIN_BULK_BASE_PATH`)
   - parametros de chunking e limite de arquivo
2. Garantir schema RAG aplicado (`supabase/migrations/20260303120000_create_rag_base_schema.sql`).
3. Validar infraestrutura:
   - `npm run verify:nvme`
   - `npm run verify:nvme:sh`
4. Executar ingestao por API.

## 10) Limitacoes atuais (primeira versao)

- Indexacao de embeddings depende da disponibilidade do endpoint interno de embeddings/vLLM.
- Se `RAG_INGEST_EMBED_REQUIRED=0`, ingestao pode concluir com `embedding_status=failed` em caso de erro de embedding (falha explicita e auditavel).
- Parser inicial cobre formatos basicos: `txt`, `md`, `csv`, `json`, `docx`.
- `pdf` e outros formatos ainda retornam erro explicito de formato nao suportado.
- Lote admin e sequencial (sem paralelismo) para priorizar previsibilidade e auditabilidade.
- Logs de ingestao sao emitidos por etapa (`RAG_INGEST_*`) para trilha operacional.
