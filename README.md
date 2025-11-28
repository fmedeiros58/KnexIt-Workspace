# KnexIT - Ecossistema central / autenticação / billing / painel único

Template com Next.js 14 + Tailwind + Supabase para autenticação por e-mail (link mágico), páginas base e componentes de vídeo e questões.

## Como rodar

1. Node 18+ instalado.
2. `npm i`
3. Copie `.env.example` para `.env.local` e preencha:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
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

## Deploy (Vercel)

- Faça login na Vercel e importe este repositório.
- Crie um projeto no Supabase e copie URL/Anon Key para as variáveis do projeto na Vercel.
- Configure provedores de vídeo (Mux/Vimeo) e pagamentos (Mercado Pago) quando integrar os módulos correspondentes.

## Letícia (chat) – modo mock

- Para testar o streaming sem o modelo local, mantenha `LETICIA_MOCK=1` (padrão em dev).
- Em produção, defina `LETICIA_MOCK=0` e rode `npm run serve:vllm` para apontar `/api/knexai` ao servidor vLLM.

## Login local

- A página de login agora é um formulário simples dentro de `app/login`.
- O guard redireciona para `/login`, então o fluxo permanece relativo (não usa domínios externos).
- Para testar, abra `http://localhost:3000/login`, preencha seu e-mail e aguarde o link mágico enviado pelo Supabase usando o próprio domínio local.

## Motor local com vLLM

- Suba o servidor com `npm run serve:vllm` (usa `models/CModelosMistral-7B-Instruct-v0.2-AWQ`, `cuda:0` e porta 8080). Ajuste `concurrency` conforme a carga.
- Configure as variáveis: `VLLM_BASE_URL`, `VLLM_MODEL`, `VLLM_API_KEY` (se necessário).
- Deixe no `.env.local`: `VLLM_BASE_URL=http://localhost:8080/v1` e `VLLM_MODEL=mistral-7b-instruct-v0.2-awq`.
