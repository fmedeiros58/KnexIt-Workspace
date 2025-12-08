# KnexIT Infra

Stack de infraestrutura que orquestra os serviços do ecossistema KnexIT Workspace. Centraliza arquivos Docker, composição local, roteamento Nginx, scripts e pipelines de deploy.

## Estrutura
- `docker/`: `docker-compose` para desenvolvimento e produção, além de Dockerfiles base.
- `nginx/`: configs de gateway/API (`knexit.conf`).
- `scripts/`: utilidades para provisionamento, seed de dados e CI/CD.
- `deploy/`: manifests e documentação de pipelines (GitHub Actions, Terraform, etc.).

## Uso rápido
1. Configure `.env` com URLs do `auth` e demais serviços.
2. Execute `docker compose -f docker/docker-compose.dev.yml up`.
3. O proxy Nginx ficará disponível em `https://workspace.localhost`, roteando para `portal`, `vioclass`, `violive`, `supadrive`, `viohub` e `auth`.
