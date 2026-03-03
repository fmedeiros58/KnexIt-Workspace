# Observabilidade e Smoke Tests Operacionais

Data: 2026-03-03  
Escopo: camada minima para troubleshooting e validacao rapida pos-deploy.

## 1) Observabilidade implementada

1. Request ID/correlation ID
- `requestId` gerado por requisicao publica.
- Retornado em `X-Request-Id`.
- Propagado para logs do fluxo RAG.

2. Logs consistentes por etapa
- Ingestao:
  - `RAG_INGEST_*`
- Embeddings:
  - `RAG_EMBEDDING_*`
  - `RAG_EMBED_INDEX_*`
- Retrieval:
  - `RAG_RETRIEVAL_*`
- LLM interno:
  - `RAG_LLM_CALL_*`
- API publica:
  - `PUBLIC_*`
  - `OPENAI_COMPAT_*`

3. Eventos de falha relevantes
- Falha de banco vetorial:
  - `RAG_RETRIEVAL_DB_ERROR`
- Falha de chamada ao vLLM:
  - `RAG_LLM_TIMEOUT`, `RAG_LLM_UNAVAILABLE`
- Falha de embedding:
  - `RAG_EMBEDDING_TIMEOUT`, `RAG_EMBEDDING_UNAVAILABLE`
- Indicador de proxy mal configurado:
  - `PUBLIC_API_PROXY_HEADERS_MISSING`

4. Redacao de segredos
- Logger mascara metadados sensiveis automaticamente.

## 2) Health e Ready

### `GET /health`
- Verifica liveness da API.
- Retorna contexto de request/proxy.

### `GET /ready`
- Verifica readiness minima e rapida:
  - conectividade com banco vetorial;
  - acesso ao endpoint interno do LLM (`/models`);
  - carga de configuracao critica.
- Nao executa checks pesados de negocio.

## 3) Smoke tests adicionados

1. `scripts/smoke-test-api.sh`
- valida:
  - `/health`
  - `/ready`
  - `/query`
  - `/chat`
  - `/v1/chat/completions` (quando `OPENAI_REQUIRED=1`)

2. `scripts/smoke-test-rag.sh`
- valida:
  - metadata minima do RAG em `/query`
  - formato OpenAI-compatible + `knex_rag` em `/v1/chat/completions`

3. Scripts npm
- `npm run smoke:api`
- `npm run smoke:rag`

## 4) Como executar

Exemplo:
```bash
export BASE_URL="https://api.knexspace.com"
export API_KEY="<PUBLIC_API_KEY>"
npm run smoke:api
npm run smoke:rag
```

## 5) Interpretacao rapida de falhas

- `401 PUBLIC_API_UNAUTHORIZED`
  - API key invalida/ausente.
- `403 CORS_ORIGIN_FORBIDDEN`
  - origem nao permitida.
- `413 PUBLIC_API_PAYLOAD_TOO_LARGE`
  - payload excedeu limite configurado.
- `429 PUBLIC_API_RATE_LIMITED`
  - excedeu limite de requests por janela.
- `/ready` com `vectorDb.ok=false`
  - banco vetorial indisponivel.
- `/ready` com `llm.ok=false`
  - vLLM interno indisponivel/timeout.
- `/ready` com `criticalConfig.ok=false`
  - variavel critica ausente/invalida.

## 6) Limitacoes atuais

- Smoke tests sao scripts HTTP (nao substituem testes de carga).
- Rate limit in-memory nao persiste reinicio.
- Logs ainda nao enviados para stack central (ELK/Datadog etc.) nesta etapa.

## 7) Proximos passos (nao implementados agora)

1. Export de logs estruturados para observabilidade central.
2. Painel de SLI/SLO com latencia, erro e disponibilidade.
3. Smoke tests em pipeline CI/CD com ambiente de staging.
4. Alertas automaticos baseados em `/ready` e taxa de 5xx.

