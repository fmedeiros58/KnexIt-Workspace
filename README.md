# KnexIT — Ecossistema central / autenticação / billing / integração / painel único

Template com Next.js 14 + Tailwind + Supabase para autenticação por e-mail (link mágico), páginas base e componentes para vídeo e questões.

## Como rodar

1. Node 18+ instalado.
2. `npm i`
3. Copie `.env.example` para `.env.local` e preencha:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. `npm run dev` e acesse http://localhost:3000

## Deploy (Vercel)

- Faça login na Vercel e importe este repositório.
- Crie um projeto no Supabase e copie URL/Anon Key para as variáveis de ambiente do projeto na Vercel.
- Configure provedor de vídeo (Mux/Vimeo) e pagamentos (Mercado Pago) quando for integrar de fato.

## Estrutura

- `app/` — rotas (Home, Login, Dashboard, Lessons, Questions)
- `components/` — Player, Nav, Pricing, QuestionCard
- `lib/` — cliente do Supabase
- `app/globals.css` — Tailwind

> Este é um ponto de partida minimalista. A partir daqui dá para adicionar: planos/assinaturas, trilhas, filtros de questões, perfis, RBAC etc.

### Letícia (chat) — modo mock
- Para testar o streaming sem modelo local, use o modo mock.
- Já está ativo por padrão em desenvolvimento. Em produção, defina LETICIA_MOCK=1 em variáveis de ambiente, ou configure o motor local.

### Motor local com vLLM
- Suba o servidor: `python -m vllm.entrypoints.openai.api_server --model <modelo> --host 127.0.0.1 --port 8000`
- Defina env: VLLM_BASE_URL, VLLM_API_KEY (se houver), VLLM_MODEL
- Em produção, defina LETICIA_MOCK=0 para usar o vLLM.

### Script vLLM local
- Execute `npm run serve:vllm` para subir o vLLM com `models/CModelosMistral-7B-Instruct-v0.2-AWQ` na GPU (use `--device cuda:0`).
- Ajuste `concurrency` conforme o n?mero de usu?rios simult?neos.
- Mantenha `VLLM_BASE_URL=http://localhost:8080/v1` e `VLLM_MODEL=mistral-7b-instruct-v0.2-awq` no `.env.local` para que `/api/knexai` aponte para essa inst?ncia.

