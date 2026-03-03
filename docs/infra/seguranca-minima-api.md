# Seguranca Minima da API Publica

Data: 2026-03-03  
Escopo: camada minima de seguranca para API publica + RAG, sem complexidade excessiva.

## 1) Protecoes implementadas

1. CORS restritivo (sem wildcard em producao)
- Origem validada por allowlist central:
  - `PUBLIC_API_ALLOWED_ORIGINS`
  - `VERCEL_FRONTEND_ORIGIN`
  - `APP_PUBLIC_ORIGIN`
- Requisicao com `Origin` fora da lista retorna `403` (`CORS_ORIGIN_FORBIDDEN`).

2. Autenticacao minima por API key
- Endpoints protegidos:
  - `POST /chat`
  - `POST /query`
  - `POST /v1/chat/completions`
  - `POST /api/chat`
  - `POST /api/query`
- Header aceito:
  - `x-api-key`
  - `Authorization: Bearer <key>`
- Variaveis:
  - `PUBLIC_API_KEY`
  - `PUBLIC_API_KEYS`

3. Limite de payload (anti-abuso basico)
- Validacao de `content-length` + limite efetivo no parse JSON.
- Erro `413` quando excede `PUBLIC_API_MAX_BODY_BYTES`.

4. Rate limiting basico (in-memory)
- Aplicado por `method + path + clientIp`.
- Retorna `429` (`PUBLIC_API_RATE_LIMITED`) ao exceder limite.
- Config:
  - `PUBLIC_API_RATE_LIMIT_ENABLED`
  - `PUBLIC_API_RATE_LIMIT_WINDOW_MS`
  - `PUBLIC_API_RATE_LIMIT_MAX`

5. Validacao basica de entrada
- Limites para `message`, `question`, `history`, `messages` (OpenAI-compatible).
- Erros explicitos com codigos auditaveis (`*_TOO_LONG`).

6. Protecao de erros sensiveis
- Em producao, mensagens internas sao sanitizadas em erros 5xx (`sanitizePublicErrorMessage`).
- Stack traces nao sao retornados para cliente.

7. Redacao de segredos em logs
- Logger redige chaves sensiveis por nome:
  - `token`, `secret`, `password`, `authorization`, `cookie`, `api_key` etc.

## 2) Componentes centrais

- Seguranca/CORS/API key/rate limit/payload:
  - `app/api/_shared/public-api.ts`
- Logger com redacao:
  - `core/utils/logger.ts`

## 3) Endpoints de controle

- `GET /health`: liveness e contexto de proxy.
- `GET /ready`: verifica dependencias leves e config critica.

## 4) Configuracoes relevantes

- `PUBLIC_API_ALLOWED_ORIGINS`
- `VERCEL_FRONTEND_ORIGIN`
- `APP_PUBLIC_ORIGIN`
- `PUBLIC_API_KEY` / `PUBLIC_API_KEYS`
- `PUBLIC_API_MAX_BODY_BYTES`
- `PUBLIC_API_RATE_LIMIT_ENABLED`
- `PUBLIC_API_RATE_LIMIT_WINDOW_MS`
- `PUBLIC_API_RATE_LIMIT_MAX`
- `PUBLIC_API_MAX_MESSAGE_CHARS`
- `PUBLIC_API_MAX_QUESTION_CHARS`
- `PUBLIC_API_MAX_HISTORY_ITEMS`
- `PUBLIC_API_MAX_HISTORY_ITEM_CHARS`
- `PUBLIC_API_MAX_OPENAI_MESSAGES`
- `PUBLIC_API_MAX_OPENAI_MESSAGE_CHARS`

## 5) Limitacoes atuais

- Rate limit em memoria (nao distribuido entre multiplas instancias).
- API key simples (sem rotacao automatica, sem escopos por rota).
- Sem WAF dedicado nesta etapa.
- Sem bloqueio geolocalizado/IP reputation.

## 6) Proximos passos (nao implementados agora)

1. Rate limit distribuido (Redis/KV) para multi-instancia.
2. API keys com escopos, expiracao e rotacao auditavel.
3. Auditoria de tentativas 401/429 com armazenamento dedicado.
4. WAF/regras de bot mitigation no edge/proxy.

