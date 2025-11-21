# KnexIT Workspace

KnexIT Workspace é um ecossistema modular baseado em microserviços, projetado para reunir todos os produtos digitais sob um único ambiente seguro. Cada módulo opera de forma independente, mas compartilha autenticação, padrões de integração e bibliotecas internas expostas pelo serviço `auth/` e pelo pacote `core/`.

## Produtos e serviços

| Serviço     | Descrição | Principais módulos |
|-------------|-----------|--------------------|
| `portal/`   | Porta de entrada, painel unificado, integração com SSO | `src`, `routes`, `components`, `services` |
| `upgrade/`  | Plataforma educacional | `routes`, `controllers`, `models`, `services` |
| `supadrive/`| Armazenamento e streaming (origin + encoder HLS + CDN) | `api`, `encoder`, `uploader`, `player` |
| `viohub/`   | Produção audiovisual e gestão de vídeos | `src`, `controllers`, `routes`, `services` |
| `auth/`     | Autenticação centralizada (SSO / JWT) | `src`, `routes`, `controllers`, `services` |
| `core/`     | Biblioteca compartilhada (config, middlewares, utilitários) | `config`, `utils`, `database`, `shared` |
| `infra/`    | Infraestrutura (Docker, CI/CD, Nginx, deploy) | `docker`, `nginx`, `scripts`, `deploy` |

## Integração
- Todos os microsserviços expõem APIs REST/GraphQL autenticadas via tokens emitidos por `auth/`.
- `core/` publica pacotes internos (helpers, middlewares, adapters) para uso em cada projeto Node.js.
- `infra/` centraliza os manifests do Docker, balanceadores Nginx, pipelines de deploy e scripts de provisionamento.

## Desenvolvimento
1. Clonar o repositório.
2. Entrar no serviço desejado (por exemplo `portal/`) e executar `npm install`.
3. Exportar variáveis compartilhadas (via `.env` e `core/config`).
4. Subir o stack local com `infra/docker/docker-compose.dev.yml` (placeholder).

Cada pasta possui seu próprio `README.md` explicando como iniciar e integrar com os demais serviços.
