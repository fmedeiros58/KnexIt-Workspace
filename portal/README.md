# KnexIT Workspace Portal

Portal web que concentra login, onboarding e o dashboard geral do ecossistema. Este serviço é construído em Node.js/Next.js e consome o SSO exposto por `../auth`.

## Estrutura
- `src/`: hooks, contextos e utilidades do portal.
- `pages/`: páginas públicas (login, recuperação de senha) e privadas (dashboard, cards de acesso).
- `routes/`: handlers de API internos ou proxies para outros produtos.
- `components/`: UI compartilhada.
- `services/`: SDKs para conversar com `auth`, `upgrade`, `supadrive`, etc.

## Desenvolvimento
```bash
cd portal
npm install
npm run dev
```
Defina as variáveis de ambiente para apontar para o endpoint de `auth` (`AUTH_BASE_URL`) e para cada produto.

