# KnexIT - Ecossistema central / autenticação / billing / painel único

Template com Next.js 14 + Tailwind + Supabase para autenticação (senha, OTP de 6 dígitos e OAuth), páginas base e componentes de vídeo e questões.

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
5. Dentro de `knexai/`, use `npm run dev:hot` para manter `http://localhost:3700/api/knexai` ativo.

## Scripts principais

- `npm run dev`: sobe o workspace (app em 3000 + portal em 3003).
- `npm run dev:hot` (em `knexai/`): mata processos presos na porta 3700 e inicia `tsx src/server.ts`.
- `npm run serve:vllm`: levanta o vLLM local com `models/CModelosMistral-7B-Instruct-v0.2-AWQ` usando GPU (`cuda:0`) na porta 8080.
- `npm run dev:knexai`: abre automaticamente `http://localhost:3004/knexai` e inicia o Next em 3004.
- `npm run dev:supadrive`: abre `http://localhost:3005/supadrive` e inicia Next em 3005.
- `npm run dev:vioclass`: abre `http://localhost:3006/vioclass` e inicia Next em 3006.
- `npm run dev:vioread`: abre `http://localhost:3007/vioread` e inicia Next em 3007.

## Produtos com páginas diretas

Cada pasta dentro de `app/` vira uma rota direta em `http://localhost:3000/<produto>`. Exemplos:

- `/knexai` – chat da Letícia (requere backend em 3700).
- `/supadrive`, `/knexflow`, `/knexdocs`, `/knexmail`, `/knexpay`, `/knexsearch`.
- `/vioanalytics`, `/violive`, `/vioread`, `/viorecord`, `/viostudio`, `/vioclass`.

Para testar cada produto basta abrir o URL correspondente depois que o `npm run dev` estiver rodando na raiz. As subrotas (`/supadrive/viewer/[id]`, `/vioclass/agenda` etc.) também funcionam diretamente.


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

- Faça login na Vercel e importe este repositório.
- Crie um projeto no Supabase e copie URL/Anon Key para as variáveis do projeto na Vercel.
- Configure provedores de vídeo (Mux/Vimeo) e pagamentos (Mercado Pago) quando integrar os módulos correspondentes.

## Letícia (chat) – modo mock

- Para testar o streaming sem o modelo local, mantenha `LETICIA_MOCK=1` (padrão em dev).
- Em produção, defina `LETICIA_MOCK=0` e rode `npm run serve:vllm` para apontar `/api/knexai` ao servidor vLLM.

## Login local

- A página de login fica em `app/login` e oferece:
  - senha
  - código OTP de 6 dígitos (sem link mágico)
  - OAuth (Google, Microsoft, Facebook)
- Para testar localmente, abra `http://localhost:3000/login`.

### OTP sem magic link (Supabase)

Para garantir que o e-mail envie **apenas o código**:

1. Em **Supabase > Authentication > Email Templates**, edite o template de OTP.
2. Remova/ignore qualquer `{{ .ConfirmationURL }}`.
3. Inclua o token diretamente no corpo, por exemplo: `{{ .Token }}`.

O envio é feito via `POST /api/auth/otp/request` e a verificação via `POST /api/auth/otp/verify`.

### OAuth (callback)

Configure o redirect no Supabase para bater com `IDENTITY_AUTH_REDIRECT_URL`.
Exemplo em dev: `http://127.0.0.1:3000/auth/callback`.

## Entitlements (KnexChat)

- O acesso ao KnexChat exige entitlement ativo em `public.app_entitlements`.
- APIs retornam `403` com `{ code: "ENTITLEMENT_REQUIRED", appKey: "knexchat" }` quando o acesso não está liberado.

## Resend (teste de e-mail)

- Configure no `.env.local`:
  - `RESEND_API_KEY`
  - `RESEND_FROM`
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

- Suba o servidor com `npm run serve:vllm` (usa `models/CModelosMistral-7B-Instruct-v0.2-AWQ`, `cuda:0` e porta 8080). Ajuste `concurrency` conforme a carga.
- Configure as variáveis: `VLLM_BASE_URL`, `VLLM_MODEL`, `VLLM_API_KEY` (se necessário).
- Deixe no `.env.local`: `VLLM_BASE_URL=http://localhost:8080/v1` e `VLLM_MODEL=mistral-7b-instruct-v0.2-awq`.
