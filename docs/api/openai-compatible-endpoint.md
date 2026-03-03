# Endpoint OpenAI-Compatible

Data: 2026-03-03  
Rota: `POST /v1/chat/completions`

## 1) Objetivo

Fornecer adaptador compativel com SDK OpenAI para o backend RAG atual, sem expor o vLLM bruto.

Fluxo interno:
1. Recebe payload OpenAI-like.
2. Extrai ultima mensagem `role=user`.
3. Monta historico anterior (`user`/`assistant`).
4. Executa pipeline RAG interno.
5. Retorna estrutura semelhante ao `chat.completion`.

## 2) Seguranca

- Protegido por API key publica:
  - `x-api-key` ou `Authorization: Bearer <key>`
- CORS aplicado centralmente (`app/api/_shared/public-api.ts`).
- vLLM continua interno (`127.0.0.1:8000`).

## 3) Request suportado (minimo)

```json
{
  "model": "mistral-awq",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "Qual a politica de backup?" }
  ],
  "max_tokens": 700,
  "temperature": 0,
  "seed": 42,
  "stream": false
}
```

Campos extras de retrieval aceitos (nao padrao OpenAI):
- `top_k` / `topK`
- `max_distance` / `maxDistance`
- `document_id` / `documentId`
- `source_type` / `sourceType`
- `retrieval_embedding_model` / `retrievalEmbeddingModel`

Tambem aceitos em `extra_body`.

## 4) Response

```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1760000000,
  "model": "mistral-awq",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 123,
    "completion_tokens": 45,
    "total_tokens": 168
  },
  "knex_rag": {
    "retrieval": {},
    "chunks": [],
    "queryEmbedding": {},
    "llm": {},
    "timingsMs": {}
  }
}
```

## 5) Erros (formato compativel)

Exemplo:
```json
{
  "error": {
    "message": "Payload OpenAI-compatible precisa conter ao menos uma mensagem role=user.",
    "type": "invalid_request_error",
    "param": null,
    "code": "OPENAI_COMPAT_USER_MESSAGE_REQUIRED"
  }
}
```

## 6) Diferencas vs OpenAI oficial

- `stream=true` ainda nao suportado no adaptador.
- Campo `knex_rag` e adicional proprietario para auditoria.
- `model` do request e aceito, mas o backend decide o modelo efetivo conforme config interna.
- Retrieval vetorial e configuravel por campos extras (nao padrao OpenAI).

## 7) Exemplo de uso com OpenAI SDK

Defina no cliente:
- `baseURL=https://api.knexspace.com/v1`
- `apiKey=<PUBLIC_API_KEY>`

Use `chat.completions.create(...)` normalmente (sem stream nesta versao).

