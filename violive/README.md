# VioLive

Plataforma de videoconferência do ecossistema KnexIT. Concentra criação de reuniões, salas com painéis (chat/host/tools) e integrações com gravação/armazenamento no SupaDrive.

## Estrutura
- `web/`: rotas Next.js do produto (home, agenda, salas, aliases de drive apontando para SupaDrive).
  - `page.tsx`: landing principal do VioLive.
  - `agenda/`: páginas de agendamento.
  - `sala/[code]/`: sala com painéis `@panel` (chat, host, tools).
  - `drive/`: aliases que reexportam o SupaDrive web para manter a experiência integrada.
- `src/`: serviço Fastify (stub) para healthcheck e evolução futura como serviço independente.

## Como rodar (via workspace Next)
1) Na raiz do monorepo, instale deps: `npm install`.
2) Garanta `.env.local` com as chaves Supabase (vide raiz do projeto).
3) `npm run dev` e acesse `/violive` (ou `/violive/agenda`, `/violive/sala/<code>`). Rotas antigas `/VioLive/**` seguem como alias se necessário.

## Como rodar o serviço VioLive (Fastify stub)
```bash
cd violive
npm install
npm run dev
```
- Porta configurável via `VIOLIVE_PORT` (padrão 3400).
- Healthcheck em `GET /health`.

## Observações
- As rotas em `app/violive/**` e `app/VioLive/**` são cascas finas que reexportam de `violive/web/**` para manter o roteamento do Next.
- O módulo de armazenamento usado pelo VioLive é o SupaDrive (`supadrive/web`).

