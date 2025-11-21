# KnexIT Auth Service

Serviço de autenticação centralizada responsável por SSO, emissão de tokens JWT e federação com provedores externos. Todos os produtos do ecossistema validam sessões contra este serviço.

## Estrutura
- `src/`: bootstrap do servidor Express/Node.
- `routes/`: definições de rotas REST (`/auth/login`, `/auth/refresh`, `/auth/profile`).
- `controllers/`: orquestram a autenticação, delegando para serviços e modelos.
- `models/`: contratos de usuário, sessão e integrações externas.
- `services/`: utilidades de token, hashing e comunicação com bancos/cache.

## Desenvolvimento
```bash
cd auth
npm install
npm run dev
```
Configure as variáveis `JWT_SECRET`, `SSO_PUBLIC_URL`, `CORE_DATABASE_URL` e `PORT`. O serviço publica JWKS em `/auth/.well-known/jwks.json` para que `portal`, `upgrade`, `supadrive` e `viohub` validem tokens.
