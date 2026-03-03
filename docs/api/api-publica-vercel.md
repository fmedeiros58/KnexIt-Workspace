# API Publica para Frontend no Vercel

Data: 2026-03-03  
Escopo: exposicao controlada da API para consumo externo, mantendo LLM e bancos privados.

## 1) Rotas publicas

- `GET /health`
- `GET /ready`
- `POST /chat`
- `POST /query`
- `POST /v1/chat/completions` (adaptador OpenAI-compatible)

## 2) O que permanece privado

- Backend Next (origem interna): `127.0.0.1:3000`
- vLLM: `127.0.0.1:8000`
- Banco(s): `localhost` (ex.: Postgres 5432)

Somente o reverse proxy publica `80/443`.

## 3) Politica de CORS (centralizada)

Implementacao central:
- `app/api/_shared/public-api.ts`

Headers aplicados:
- `Access-Control-Allow-Origin` (somente origins permitidas)
- `Access-Control-Allow-Methods`
- `Access-Control-Allow-Headers`
- `Access-Control-Max-Age`
- `Vary: Origin`

Principios:
- Sem wildcard aberto em producao.
- Origins permitidas por allowlist explicita.
- Requisicoes com `Origin` fora da lista retornam `403` (`CORS_ORIGIN_FORBIDDEN`).

Variaveis:
- `PUBLIC_API_ALLOWED_ORIGINS` (CSV)
- `VERCEL_FRONTEND_ORIGIN` (opcional)
- `APP_PUBLIC_ORIGIN` (opcional)

## 4) Autenticacao minima da API publica

Endpoints protegidos:
- `POST /chat`
- `POST /query`
- `POST /v1/chat/completions`

Mecanismo:
- API key via `x-api-key` ou `Authorization: Bearer <key>`

Variaveis:
- `PUBLIC_API_KEY` (chave unica)
- `PUBLIC_API_KEYS` (CSV, opcional para rotacao)

Comportamento:
- Sem chave valida => `401` (`PUBLIC_API_UNAUTHORIZED`)
- Em producao, sem chave configurada => `503` (`PUBLIC_API_KEY_NOT_CONFIGURED`)

Protecoes adicionais:
- payload limit (`PUBLIC_API_MAX_BODY_BYTES`, erro `413`);
- rate limit basico (`PUBLIC_API_RATE_LIMIT_*`, erro `429`);
- validacao de tamanho de entrada (`message/question/history/messages`).

## 5) Suporte a reverse proxy

Contexto por request usa:
- `X-Forwarded-For`
- `X-Forwarded-Proto`
- `X-Forwarded-Host`
- `X-Real-IP`

Endpoints de diagnostico (`/health` e `/ready`) retornam metadados de request para auditoria:
- `clientIp`
- `forwardedProto`
- `forwardedHost`
- `publicBaseUrl`

## 6) Como consumir do frontend no Vercel

1. Configurar origem permitida:
   - `VERCEL_FRONTEND_ORIGIN=https://<seu-frontend>.vercel.app`
   - e/ou `PUBLIC_API_ALLOWED_ORIGINS=https://app.knexspace.com,https://<seu-frontend>.vercel.app`
2. Configurar API key pública no backend:
   - `PUBLIC_API_KEY=<token-forte>`
3. No frontend, chamar somente dominio publico da API (exemplo):
   - `https://api.knexspace.com/chat`
   - `https://api.knexspace.com/query`
4. Enviar `x-api-key` (ou Bearer token) nas rotas protegidas.

## 7) Formatos de request/response (resumo)

### `POST /query`

Request:
```json
{
  "question": "Pergunta",
  "topK": 8,
  "maxDistance": 0.45
}
```

Response:
```json
{
  "ok": true,
  "question": "Pergunta",
  "answer": "Resposta",
  "metadata": { "retrieval": {}, "chunks": [], "llm": {}, "timingsMs": {} }
}
```

### `POST /chat`

Request:
```json
{
  "message": "Pergunta",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

Response:
```json
{
  "ok": true,
  "reply": { "role": "assistant", "content": "Resposta" },
  "metadata": {}
}
```

## 8) Limites atuais

- `POST /chat` segue stateless por padrao (historico enviado pelo cliente).
- Adaptador OpenAI-compatible atual nao suporta `stream=true`.
- RAG depende de qualidade dos embeddings e da base vetorial atual.
