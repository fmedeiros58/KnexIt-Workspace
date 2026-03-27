# UI Toggle Chat Escrever

Data: 2026-03-03  
Escopo: Etapa 5 (base de alternancia de modo no frontend)

## Estrategia de integracao escolhida

- Estrategia adotada: `mesmo espaco com toggle local` na tela principal do KnexAI.
- Implementacao: `activeMode: "chat" | "write"` em `knexai/web/page.tsx`.
- O toggle fica no header principal e controla explicitamente o modo ativo.
- O modo de escrita continua no mesmo ambiente (`/knexai`), sem duplicar pagina e sem misturar estado de chat.

## Como o modo escrita se encaixa no app

- O modo Chat continua sendo a experiencia padrao da tela.
- Ao alternar para Escrever, o frontend abre o workspace de escrita no mesmo ambiente visual.
- O workspace de escrita consome o dominio `/write/*` via proxy interno:
  - `app/api/write/[[...path]]/route.ts` -> encaminha para `ANM_API_BASE_URL/write/*`.

## Como o toggle funciona

- Controle de modo:
  - `activeMode === "chat"`: exibe fluxo de conversa existente.
  - `activeMode === "write"`: exibe workspace de escrita.
- O header mostra badge de modo ativo (`Modo Chat` ou `Modo Escrever`).
- O toggle foi implementado como dois botoes explicitos: `Chat` e `Escrever`.

## Componentes/estados criados ou ajustados

Arquivo principal:
- `knexai/web/page.tsx`

Estados principais:
- `activeMode`
- `writeProjects`
- `writeSession` (estado minimo da sessao do editor)

Cliente e integracao HTTP:
- `knexai/lib/client.ts`
  - funcoes tipadas para `/api/write/*` (projetos, secoes, summaries, continue).
- `app/api/write/[[...path]]/route.ts`
  - proxy interno de GET/POST/PATCH/PUT/DELETE para backend ANM.

## Integracao com /write/*

Nesta base foram conectados:
- `GET /write/projects`
- `GET /write/projects/{id}`
- `GET /write/projects/{id}/sections`
- `GET /write/sections/{id}/summary`
- `GET /write/projects/{id}/summary`
- `POST /write/projects`
- `POST /write/projects/{id}/sections`
- `POST /write/continue`

## Limitacoes atuais de UX

- O modo escrita ainda usa um container de workspace em camada dedicada dentro da mesma pagina (sem rota dedicada).
- Nao ha persistencia de `activeMode` na URL.
- Nao ha deep-link para abrir diretamente projeto/secao especificos via query string.
- O fluxo prioriza estabilidade de alternancia e sessao local antes de otimizar navegacao avancada.
