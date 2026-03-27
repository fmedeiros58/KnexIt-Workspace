# KnexIT - Ecossistema central / autenticaÃ§Ã£o / billing / painel Ãºnico

Template com Next.js 14 + Tailwind + Supabase para autenticaÃ§Ã£o (senha, OTP de 6 dÃ­gitos e OAuth), pÃ¡ginas base e componentes de vÃ­deo e questÃµes.

## Como rodar

1. Node 18+ instalado.
2. `npm i`
3. Copie `.env.example` para `.env.local` e preencha:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_IDENTITY_SUPABASE_URL`
   - `NEXT_PUBLIC_IDENTITY_SUPABASE_ANON_KEY`
   - `IDENTITY_SUPABASE_SERVICE_ROLE_KEY`
   - `IDENTITY_AUTH_REDIRECT_URL`
4. `npm run dev` na raiz para subir o workspace principal (app + portal).
   - Portal: `http://localhost:3003/knexit-workspace`
   - Rotas diretas: `http://localhost:3000/<produto>` (lista abaixo)
5. Para motor local:
   - `npm run serve:vllm:wsl` (vLLM na porta 8000, com guard rails de estabilidade)
   - `npm run serve:vllm:wsl:restart` (reinicia vLLM e limpa processo preso na porta)
   - `npm run serve:embeddings:cpu` (embeddings OpenAI-compatible em CPU na porta 8001)

## Scripts principais

- `npm run dev`: sobe o workspace (app em 3000 + portal em 3003).
- `npm run serve:next:wsl`: sobe o Next no WSL (mesmo host/rede do vLLM host-only), com bootstrap de Node Linux via `nvm` quando disponivel.
- `npm run serve:vllm:wsl`: levanta o vLLM local (porta 8000) com perfil seguro (`max-num-seqs=2`, `max-model-len=4096`, `gpu-memory-utilization=0.90`).
- `npm run serve:vllm:wsl:restart`: reinicia o vLLM forçando limpeza da porta (evita conflito/processo zumbi).
- `npm run serve:knexai:watchdog`: monitora vLLM (8000), embeddings do RAG (8001) e deployment `knexit-web` no Kubernetes; aciona recuperacao automatica quando detecta degradacao.
- `npm run serve:knexai:watchdog:install`: registra a tarefa **canonica** do watchdog (ai-system + vLLM/embeddings/chat) e inicia a execucao.
- `npm run serve:knexai:watchdog:status`: mostra estado da tarefa canonica.
- `npm run serve:knexai:watchdog:uninstall`: remove a tarefa canonica (e encerra execucao atual).
- `npm run serve:backends:watchdog:install|status|uninstall`: aliases explicitos para a mesma tarefa canonica.
- `npm run serve:embeddings:cpu`: sobe endpoint local `/v1/embeddings` em CPU (porta 8001).
- O watchdog canônico agora está no `ai-system-anm-rag-qis/scripts` (os scripts na raiz são wrappers de compatibilidade).
- Alerta simples de restart: quando o watchdog aciona recuperacao automatica, grava log em `%LOCALAPPDATA%\\KnexIT\\watchdog-backends-alert.log` e exibe popup rapido no desktop.
- Webhook opcional de restart: configure `KNEXIT_WATCHDOG_WEBHOOK_URL` (Discord/Slack incoming webhook) e opcionalmente `KNEXIT_WATCHDOG_WEBHOOK_PROVIDER=auto|discord|slack`. O watchdog busca essa configuracao por parametro, variavel de ambiente do sistema ou `.env.local`.
- `npm run bench:rag:router:wsl`: roda benchmark do roteador usando `/api/chat` no proprio WSL (`127.0.0.1:<porta>`), evitando falso 5xx por rota Windows↔WSL.
- `npm run dev:knexai`: abre automaticamente `http://localhost:3004/knexai` e inicia o Next em 3004.
- `npm run dev:supadrive`: abre `http://localhost:3005/supadrive` e inicia Next em 3005.
- `npm run dev:vioclass`: abre `http://localhost:3006/vioclass` e inicia Next em 3006.
- `npm run dev:vioread`: abre `http://localhost:3007/vioread` e inicia Next em 3007.
- `npm run supabase:local:start`: sobe Supabase local e aplica migration unificada do KnexAI + bootstrap pgvector, preservando o `.env.local`.
- `npm run supabase:local:start:update-env`: mesmo fluxo, mas sobrescreve chaves Supabase no `.env.local` para o stack local.
- `npm run supabase:local:identity:migrate`: aplica migrations de `supabase/identity/migrations` no banco local e registra versoes no historico.
- `npm run supabase:local:prep-nvme`: gera template de Docker Engine para mover armazenamento para NVMe2.
- `npm run supabase:local:apply-engine-template`: aplica o template no `~/.docker/daemon.json` e reinicia o Docker Desktop.
- `npm run verify:nvme`: valida paths, permissoes, consistencia Docker e status de migrations (KnexAI + identity).
- `npm run verify:nvme:sh`: validacao equivalente em bash/WSL.
Padroes de paths NVMe/NVMe2:
- Documentacao central: `docs/infra/padroes-de-paths-nvme.md`.
- Validacao operacional: `docs/infra/verificacao-operacional-nvme.md`.
- Runbook: `docs/infra/runbook-nvme.md`.
- Checklist de reproducao: `docs/infra/checklist-reproducao-nvme.md`.
- ADR: `docs/adr/ADR-001-persistencia-em-nvme.md`.
- Variaveis de path em `.env`: `NVME_BASE_PATH`, `MIGRATIONS_PATH`, `KNEXAI_MIGRATION_FILE`, `VECTOR_MIGRATION_FILE`, `VECTOR_HNSW_MIGRATION_FILE`, `STORAGE_BASE_PATH`, `DOCUMENTS_BASE_PATH`, `EMBEDDINGS_BASE_PATH`, `TEMP_WORKDIR_PATH`, `EXPORTS_BASE_PATH`, `IDENTITY_MIGRATIONS_POLICY`, `ANM_CHECKPOINT_RETENTION_DAYS`, `EXPORTS_RETENTION_DAYS`.
- Variaveis do banco vetorial: `VECTOR_DATABASE_URL`, `VECTOR_DB_HOST`, `VECTOR_DB_PORT`, `VECTOR_DB_NAME`, `VECTOR_DB_USER`, `VECTOR_DB_PASSWORD`, `VECTOR_DB_SSL`, `EMBEDDING_DIMENSION`, `VECTOR_DISTANCE_STRATEGY`, `VECTOR_SEARCH_TOP_K_DEFAULT`, `VECTOR_SEARCH_TOP_K_MAX`.
- Variaveis de ingestao RAG: `RAG_RAW_DOCUMENTS_PATH`, `RAG_EXTRACTED_TEXT_PATH`, `RAG_ADMIN_BULK_BASE_PATH`, `RAG_MAX_FILE_SIZE_BYTES`, `RAG_CHUNK_SIZE_CHARS`, `RAG_CHUNK_OVERLAP_CHARS`, `RAG_MAX_CHUNKS_PER_DOC`, `RAG_INGEST_ADMIN_TOKEN`.
- Para evitar processos "invisiveis" (rodando em outro usuario/distro WSL), fixe tambem:
  - `ANM_WSL_DISTRO`, `ANM_WSL_USER`
  - `VLLM_WSL_DISTRO`, `VLLM_WSL_USER`
  - `NEXT_WSL_DISTRO`, `NEXT_WSL_USER`

Guia operacional:
- `docs/supabase_local_stack_nvme2.md`

## Produtos com pÃ¡ginas diretas

Cada pasta dentro de `app/` vira uma rota direta em `http://localhost:3000/<produto>`. Exemplos:

- `/knexai` â€“ chat da LetÃ­cia.
- `/supadrive`, `/knexflow`, `/knexdocs`, `/knexmail`, `/knexpay`, `/knexsearch`.
- `/vioanalytics`, `/violive`, `/vioread`, `/viorecord`, `/viostudio`, `/vioclass`.

Para testar cada produto basta abrir o URL correspondente depois que o `npm run dev` estiver rodando na raiz. As subrotas (`/supadrive/viewer/[id]`, `/vioclass/agenda` etc.) tambÃ©m funcionam diretamente.


## App Shell (layout responsivo)

- O shell global mantem header fixo, sidebar/rail no desktop e drawer no mobile.
- No mobile, use o menu (hamburguer) para abrir a navegacao.
- No KnexChat, a lista (master) e a conversa (detail) alternam em telas pequenas.

### Teste rapido

1. `npm run dev`
2. Abra `/knexchat/web`
3. No DevTools, selecione um viewport mobile (< 768px).
4. Clique em uma conversa para abrir o detail em tela cheia.
5. Use o botao Voltar no topo para retornar a lista.

## Deploy (Vercel)

- FaÃ§a login na Vercel e importe este repositÃ³rio.
- Crie um projeto no Supabase e copie URL/Anon Key para as variÃ¡veis do projeto na Vercel.
- Configure provedores de vÃ­deo (Mux/Vimeo) e pagamentos (Mercado Pago) quando integrar os mÃ³dulos correspondentes.

## Leticia (chat) - engine real

- O endpoint `/api/knexai` nao usa mais modo mock.
- Para responder no chat, rode `npm run serve:vllm:wsl`.

## Login local

- A pÃ¡gina de login fica em `app/login` e oferece:
  - senha
  - cÃ³digo OTP de 6 dÃ­gitos (sem link mÃ¡gico)
  - OAuth (Google, Microsoft, Facebook)
- Para testar localmente, abra `http://localhost:3000/login`.

### OTP sem magic link (Supabase)

Para garantir que o e-mail envie **apenas o cÃ³digo**:

1. Em **Supabase > Authentication > Email Templates**, edite o template de OTP.
2. Remova/ignore qualquer `{{ .ConfirmationURL }}`.
3. Inclua o token diretamente no corpo, por exemplo: `{{ .Token }}`.

O envio Ã© feito via `POST /api/auth/otp/request` e a verificaÃ§Ã£o via `POST /api/auth/otp/verify`.

### OAuth (callback)

Configure o redirect no Supabase para bater com `IDENTITY_AUTH_REDIRECT_URL`.
Exemplo em dev: `http://127.0.0.1:3000/auth/callback`.

## Entitlements (KnexChat)

- O acesso ao KnexChat exige entitlement ativo em `public.app_entitlements`.
- APIs retornam `403` com `{ code: "ENTITLEMENT_REQUIRED", appKey: "knexchat" }` quando o acesso nÃ£o estÃ¡ liberado.

## Resend (teste de e-mail)

- Configure no `.env.local`:
  - `RESEND_API_KEY`
  - `RESEND_FROM`
  - `KNEXCHAT_OTP_SALT` (segredo para hash do OTP de ativacao do KnexChat)
- Endpoint de teste: `POST /api/email/test`

### Exemplo (PowerShell)

```powershell
curl -Method POST http://localhost:3000/api/email/test `
  -Headers @{ "Content-Type"="application/json" } `
  -Body '{"to":"SEU_EMAIL@gmail.com","subject":"Teste Resend","text":"Teste ok","html":"<p>Teste <b>ok</b></p>"}'
```

### Exemplo (bash)

```bash
curl -X POST http://localhost:3000/api/email/test \
  -H "Content-Type: application/json" \
  -d '{"to":"SEU_EMAIL@gmail.com","subject":"Teste Resend","text":"Teste ok","html":"<p>Teste <b>ok</b></p>"}'
```

### Script rapido

```bash
TEST_EMAIL_TO=SEU_EMAIL@gmail.com npm run email:test
```

Nunca commite o `.env.local` e nunca cole a chave no codigo.

## Motor local com vLLM

- Suba o servidor com `npm run serve:vllm:wsl` (usa `models/CModelosMistral-7B-Instruct-v0.2-AWQ`, publica `--served-model-name mistral-awq`, `--max-num-seqs 2`, `--max-model-len 4096` e porta 8000).
- Para recuperacao automatica sem acao manual apos quedas/relogon, execute uma vez: `npm run serve:knexai:watchdog:install`.
- A tarefa canonica instalada cobre Docker + vLLM + embeddings + ANM/chat no mesmo processo; Kubernetes fica desabilitado por padrao na instalacao canonica para reduzir ruido local.
- Para alerta remoto de restart, adicione no `.env.local`: `KNEXIT_WATCHDOG_WEBHOOK_URL=<sua-url>` e opcional `KNEXIT_WATCHDOG_WEBHOOK_PROVIDER=auto`.
- Configure as variÃ¡veis: `LOCAL_LLM_BASE_URL`, `LOCAL_LLM_API_KEY`, `LOCAL_LLM_MODEL`, `LOCAL_LLM_MODEL_DEFAULT`, `EMBEDDINGS_BASE_PATH`, `LLM_MODEL_NAME`, `LLM_API_KEY`.
- Caminho fÃ­sico do modelo (disco): `LOCAL_LLM_MODEL=models/CModelosMistral-7B-Instruct-v0.2-AWQ` (ou caminho absoluto do seu host).
- Nome lÃ³gico no payload OpenAI-compatible: `LLM_MODEL_NAME=mistral-awq`
- Deixe no `.env.local`: `LOCAL_LLM_BASE_URL=http://127.0.0.1:8000/v1`, `LLM_BASE_URL=http://127.0.0.1:8000/v1`, `LLM_API_KEY=token-local`.

## Ingestao RAG (v1)

- Usuario (frontend): `POST /api/ingest` com `multipart/form-data` (`file` + `sessionId`).
- Consulta job: `GET /api/ingest/:id`.
- Consulta documento/chunks: `GET /api/documents/:id`.
- Super admin (servidor): `POST /api/ingest` com `sourcePaths[]` + header `x-rag-admin-token` (exige `RAG_INGEST_ADMIN_TOKEN`).
- UI web de ingestao: `/knexai/ingest` (atalho: `/ingest`).
- Ingestao por referencia no servidor: coloque arquivos em `data/rag/bulk` e use `filePath` relativo (resolvido por `RAG_ADMIN_BULK_BASE_PATH`).

## Query RAG (MVP)

- Pergunta unica: `POST /api/query`.
- Chat com historico curto: `POST /api/chat`.
- API publica (proxy/HTTPS): `POST /query`, `POST /chat`, `GET /health`, `GET /ready`.
- Adaptador OpenAI-compatible: `POST /v1/chat/completions`.
- Metadados de auditoria retornados:
  - ids de documentos/chunks usados;
  - score/distancia;
  - parametros de retrieval (top-k, filtros, maxDistance);
  - modelo de embedding e modelo LLM.
- Para embeddings funcionarem localmente, rode `npm run serve:embeddings:cpu` e mantenha `EMBEDDING_BASE_URL=http://127.0.0.1:8001/v1`.

Documentacao:
- `docs/infra/rag-minimo.md`
- `docs/api/query-e-chat-rag.md`
- `docs/api/api-publica-vercel.md`
- `docs/api/openai-compatible-endpoint.md`
- `docs/infra/reverse-proxy-publicacao-api.md`
- `docs/infra/runbook-nginx-caddy.md`
- `docs/infra/seguranca-minima-api.md`
- `docs/infra/observabilidade-smoke-tests.md`
- `docs/infra/fechamento-etapa-2-rag-api-publica.md`

Smoke tests:
- `npm run smoke:api`
- `npm run smoke:rag`


