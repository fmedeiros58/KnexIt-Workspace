# KnexIT Workspace

KnexIT Workspace é um ecossistema modular baseado em microserviços, projetado para reunir todos os produtos digitais sob um único ambiente seguro. Cada módulo opera de forma independente, mas compartilha autenticação, padrões de integração e bibliotecas internas expostas pelo serviço `auth/` e pelo pacote `core/`.

## Produtos e serviços

| Serviço    | Descrição                                        | Principais módulos                          |
|------------|--------------------------------------------------|---------------------------------------------|
| `portal/`  | Porta de entrada, painel unificado, SSO          | `src`, `routes`, `components`, `services`   |
| `vioclass/`| Educação (fundamental, médio, superior, concursos) | `routes`, `controllers`, `models`, `services` |
| `violive/` | Videoconferência (ex-UpConect)                   | `web`, `src` (Fastify stub)                 |
| `supadrive/` | Armazenamento e streaming (origin + CDN)       | `api`, `encoder`, `uploader`, `player`, `web`, `lib`, `types` |
| `viohub/`  | Produção audiovisual e gestão de vídeos          | `src`, `controllers`, `routes`, `services`  |
| `auth/`    | Autenticação centralizada (SSO / JWT)            | `src`, `routes`, `controllers`, `services`  |
| `core/`    | Biblioteca compartilhada                         | `config`, `utils`, `database`, `shared`     |
| `infra/`   | Infraestrutura (Docker, Nginx, CI/CD)            | `docker`, `nginx`, `scripts`, `deploy`      |

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
