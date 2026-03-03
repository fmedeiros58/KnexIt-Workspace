# API RAG: Query e Chat

Data: 2026-03-03  
Escopo: rotas minimas para consulta RAG reproduzivel.

Observacao de seguranca:
- Em modo de publicacao, `POST /api/query` e `POST /api/chat` tambem seguem protecao por API key (`x-api-key` ou Bearer), alinhadas com as rotas publicas `/query` e `/chat`.

## 1) POST `/api/query`

Executa uma consulta RAG com foco em pergunta unica.

### Body (JSON)

```json
{
  "question": "Qual a politica de backup?",
  "topK": 8,
  "maxDistance": 0.45,
  "documentId": 15,
  "sourceType": "user_upload",
  "retrievalEmbeddingModel": "meu-modelo-embedding",
  "maxResponseTokens": 700,
  "temperature": 0,
  "seed": 42
}
```

`question` tambem aceita alias `prompt`.

### Resposta 200

```json
{
  "ok": true,
  "question": "Qual a politica de backup?",
  "answer": "Resposta do assistente...",
  "metadata": {
    "retrieval": {
      "topK": 8,
      "maxDistance": 0.45,
      "strategy": "cosine",
      "filters": {
        "documentId": 15,
        "sourceType": "user_upload",
        "embeddingModel": "meu-modelo-embedding"
      },
      "returnedChunks": 6
    },
    "contextPack": {
      "selectedChunks": 6,
      "omittedChunks": 0,
      "totalCandidateChunks": 6,
      "maxChars": 9000,
      "usedChars": 4220,
      "truncated": false
    },
    "chunks": [
      {
        "chunkId": 1001,
        "documentId": 15,
        "chunkIndex": 0,
        "distance": 0.121,
        "score": 0.879,
        "sourceType": "user_upload",
        "sourcePath": "data/rag/raw/...",
        "snippet": "Trecho curto para auditoria..."
      }
    ],
    "queryEmbedding": {
      "model": "meu-modelo-embedding",
      "dimension": 768
    },
    "llm": {
      "provider": "vllm_internal",
      "baseUrl": "http://127.0.0.1:8000/v1",
      "model": "mistral-awq",
      "maxTokens": 700,
      "temperature": 0,
      "seed": 42
    },
    "timingsMs": {
      "embedding": 18,
      "retrieval": 9,
      "contextAssembly": 1,
      "llm": 320,
      "total": 352
    }
  }
}
```

## 2) POST `/api/chat`

Consulta RAG em formato de chat (mensagem + historico curto opcional).

### Body (JSON)

```json
{
  "message": "Explique o procedimento de restauracao",
  "history": [
    { "role": "user", "content": "Quero falar de backup" },
    { "role": "assistant", "content": "Certo, qual ponto?" }
  ],
  "topK": 8,
  "maxDistance": 0.45
}
```

`message` tambem aceita alias `question`/`prompt`.

### Resposta 200

```json
{
  "ok": true,
  "reply": {
    "role": "assistant",
    "content": "Resposta do assistente..."
  },
  "metadata": {
    "...": "mesma estrutura de auditoria de /api/query"
  }
}
```

## 3) Erros principais

- `400`
  - `RAG_QUESTION_REQUIRED`
  - `RAG_MESSAGE_REQUIRED`
- `422`
  - `RAG_EMBEDDING_UPSTREAM_ERROR` (modelo/endpoint de embedding invalido)
  - `RAG_LLM_UPSTREAM_ERROR` (payload/modelo invalido no chat completion)
- `503/504`
  - indisponibilidade/timeout de embeddings ou vLLM.
- `500`
  - falhas internas de pipeline/config.

## 4) Requisitos de ambiente para reproducao

- Banco vetorial com schema `vector_store` e `pgvector`.
- `chunk_embeddings` populada para os chunks consultados.
- vLLM interno disponivel (por padrao em `127.0.0.1:8000`).
- Variaveis:
  - `EMBEDDING_BASE_URL`, `EMBEDDING_MODEL_NAME`, `EMBEDDING_API_KEY`
  - `RAG_LLM_BASE_URL`, `RAG_LLM_MODEL_NAME`, `RAG_LLM_API_KEY`
  - `RAG_CONTEXT_MAX_CHARS`, `RAG_CONTEXT_MAX_CHUNKS`
  - `RAG_RESPONSE_MAX_TOKENS`, `RAG_RESPONSE_TEMPERATURE`, `RAG_RESPONSE_SEED`

## 5) Observacoes de auditabilidade

- A API sempre retorna metadados de retrieval e geracao.
- IDs de documento/chunk usados na resposta sao expostos no payload.
- Parametros efetivos (top-k, distancia, modelos, seed) sao retornados para reproducao.
