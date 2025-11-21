# Upgrade Service

Plataforma educacional dentro do KnexIT Workspace. Responsável por aulas, módulos, avaliações e integrações com pagamentos/acesso via `auth/`.

## Estrutura
- `src/`: inicialização do servidor, middlewares e helpers gerais.
- `routes/`: rotas HTTP/GraphQL expostas para o portal e apps móveis.
- `controllers/`: regras de negócio (matrícula, progresso, certificados).
- `models/`: schemas ORM/Prisma/Mongoose.
- `services/`: integrações externas (billing, e-mail, supadrive).

## Scripts
```bash
cd upgrade
npm install
npm run dev
```

