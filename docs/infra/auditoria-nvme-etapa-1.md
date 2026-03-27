# Auditoria Tecnica NVMe - Etapa 1

Data da auditoria: 2026-03-02  
Escopo: repositorio `knexit-workspace` inteiro, com foco na implementacao recente de migrations/persistencia/artefatos para ambiente local com Supabase + Docker.

## 1) Resumo executivo

- O projeto principal roda em `Next.js 14` com API routes no proprio app, usando `@supabase/supabase-js` para persistencia e auth ([package.json:44](../../package.json), [package.json:29](../../package.json), [app/api/knexai/_store.ts:1](../../app/api/knexai/_store.ts)).
- Ha backends adicionais no monorepo:
  - `ANM backend` em `FastAPI` ([anm_backend/main.py:17](../../anm_backend/main.py), [anm_backend/requirements.txt:1](../../anm_backend/requirements.txt)).
  - `auth service` em `Express` ([auth/src/index.ts:1](../../auth/src/index.ts), [auth/package.json:14](../../auth/package.json)).
  - `knexai` legado/stub em `Fastify` ([knexai/src/server.ts:1](../../knexai/src/server.ts), [knexai/package.json:11](../../knexai/package.json)).
- Nao foi identificado ORM ativo (Prisma/TypeORM/Sequelize/Drizzle/Knex). O modelo de banco atual e SQL de migrations do Supabase + cliente Supabase JS.
- A mudanca NVMe foi implementada por scripts de automacao e docs, nao por refatoracao de camada de dados:
  - bootstrap local + aplicacao de migration unica ([scripts/supabase-local-start.ps1:4](../../scripts/supabase-local-start.ps1), [scripts/supabase-local-start.ps1:173](../../scripts/supabase-local-start.ps1)).
  - template/apply de `data-root` do Docker Engine ([scripts/configure-docker-nvme2.ps1:41](../../scripts/configure-docker-nvme2.ps1), [scripts/apply-docker-engine-template.ps1:2](../../scripts/apply-docker-engine-template.ps1), [infra/docker/docker-desktop-engine.nvme2.json:2](../../infra/docker/docker-desktop-engine.nvme2.json)).
- Estado observado nesta maquina:
  - `DockerRootDir=/var/lib/docker` (runtime).
  - Supabase local ativo em `127.0.0.1` (`API_URL`, `DB_URL`) via `supabase status -o env`.
  - `supabase_migrations.schema_migrations` com 19 migrations aplicadas e KnexAI via unificada `20260302195000`.
  - Health parcial do stack local: `supabase_vector_knexit-workspace` em estado de restart continuo no momento da auditoria.
- As 3 migrations legadas do KnexAI foram movidas para arquivo historico e estao fora do fluxo padrao do CLI ([supabase/migrations_legacy/knexai/README.md:6](../../supabase/migrations_legacy/knexai/README.md)).

## 2) Metodologia e evidencias

- Inspecao estatica de configuracoes, scripts, docs e codigo (`rg`, leitura de arquivos).
- Verificacao de estado runtime local:
  - `docker info --format "{{.DockerRootDir}}"`.
  - `npx supabase status -o env`.
  - `docker ps --format "table {{.Names}}\t{{.Status}}"`.
  - query em `supabase_migrations.schema_migrations`.
- Esta etapa nao removeu artefatos nem alterou comportamento de runtime.

## 3) Framework/backend e stack detectados

## 3.1 Aplicacao principal
- Next.js + React: [package.json:44](../../package.json), [package.json:47](../../package.json).
- API no proprio app (`app/api/*`), exemplo KnexAI store: [app/api/knexai/_store.ts:1](../../app/api/knexai/_store.ts).

## 3.2 Backends adicionais
- ANM FastAPI: [anm_backend/main.py:17](../../anm_backend/main.py), [anm_backend/main.py:68](../../anm_backend/main.py).
- Auth Express: [auth/src/index.ts:1](../../auth/src/index.ts), [auth/src/index.ts:19](../../auth/src/index.ts).
- KnexAI Fastify stub (legado/opcional): [knexai/src/server.ts:1](../../knexai/src/server.ts), [knexai/src/server.ts:4](../../knexai/src/server.ts).

## 3.3 ORM/migrations
- ORM detectado: nenhum ativo.
- Migration system principal: Supabase SQL migrations via CLI:
  - [supabase/config.toml:53](../../supabase/config.toml) (`[db.migrations]`)
  - [supabase/config.toml:58](../../supabase/config.toml) (`schema_paths = []`, usa padrao `supabase/migrations`).

## 4) Paths de migrations e persistencia

## 4.1 Paths de migrations

- Diretorio ativo de migrations: `supabase/migrations`.
- Migration unificada KnexAI ativa: [supabase/migrations/20260302195000_create_knexai_unified_local.sql:1](../../supabase/migrations/20260302195000_create_knexai_unified_local.sql).
- Migrations legadas KnexAI arquivadas:
  - `supabase/migrations_legacy/knexai/*` ([supabase/migrations_legacy/knexai/README.md:1](../../supabase/migrations_legacy/knexai/README.md)).
- Script de bootstrap aplica migration especifica por parametro:
  - [scripts/supabase-local-start.ps1:4](../../scripts/supabase-local-start.ps1)
  - [scripts/supabase-local-start.ps1:173](../../scripts/supabase-local-start.ps1).

Observacao:
- Existe `supabase/identity/migrations/*` no repo, mas esse caminho nao esta referenciado em `schema_paths` do `supabase/config.toml`. Sem processo explicito, tende a ficar fora do fluxo padrao local.

## 4.2 Paths de storage/db/uploads/caches/persistentes

- DB local Supabase via Docker:
  - Config local: [supabase/config.toml:27](../../supabase/config.toml) (`[db]`), porta 54322.
  - Runtime observado: `DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres`.
- Docker data-root:
  - Template repo: [infra/docker/docker-desktop-engine.nvme2.json:2](../../infra/docker/docker-desktop-engine.nvme2.json) (`/var/lib/docker`).
  - Script de preparacao: [scripts/configure-docker-nvme2.ps1:35](../../scripts/configure-docker-nvme2.ps1).
  - Script de aplicacao no perfil do usuario: [scripts/apply-docker-engine-template.ps1:76](../../scripts/apply-docker-engine-template.ps1).
- Upload/storage app:
  - SupaDrive usa buckets Supabase, nao path local ([supadrive/web/page.tsx:72](../../supadrive/web/page.tsx), [supadrive/web/lib/storage.ts:6](../../supadrive/web/lib/storage.ts)).
  - KnexChat avatar/media tambem em `storage.from(bucket)` (ex.: [app/api/knexchat/messages/route.ts:422](../../app/api/knexchat/messages/route.ts)).
- Cache:
  - Browser/localStorage (ex.: [knexai/web/page.tsx:84](../../knexai/web/page.tsx)).
  - Memoria processo (`Map`, `LRUCache`) (ex.: [vioread/web/services/cache.service.ts:1](../../vioread/web/services/cache.service.ts), [lib/entitlement.ts:16](../../lib/entitlement.ts)).
- Persistencia local ANM (arquivo JSON):
  - Checkpoints em `anm_backend/data/checkpoints` por default ([anm_backend/main.py:92](../../anm_backend/main.py)).

## 5) Mapa de diretorios/arquivos impactados pela mudanca NVMe

| Area | Arquivos |
|---|---|
| Scripts de automacao | [scripts/supabase-local-start.ps1](../../scripts/supabase-local-start.ps1), [scripts/configure-docker-nvme2.ps1](../../scripts/configure-docker-nvme2.ps1), [scripts/apply-docker-engine-template.ps1](../../scripts/apply-docker-engine-template.ps1) |
| Config de engine Docker | [infra/docker/docker-desktop-engine.nvme2.json](../../infra/docker/docker-desktop-engine.nvme2.json) |
| Migrations KnexAI | [supabase/migrations/20260302195000_create_knexai_unified_local.sql](../../supabase/migrations/20260302195000_create_knexai_unified_local.sql), [supabase/migrations_legacy/knexai/README.md](../../supabase/migrations_legacy/knexai/README.md) |
| Documentacao operacional | [docs/supabase_local_stack_nvme2.md](../supabase_local_stack_nvme2.md), [docs/knexai_local_sql_nvme2_ram.md](../knexai_local_sql_nvme2_ram.md), [knexai/README.md](../../knexai/README.md), [README.md](../../README.md) |
| Entrada de comandos | [package.json:22](../../package.json), [package.json:23](../../package.json), [package.json:24](../../package.json) |
| Higiene local env | [scripts/supabase-local-start.ps1:101](../../scripts/supabase-local-start.ps1), [.gitignore:22](../../.gitignore) |

## 6) Variaveis de ambiente relacionadas a paths/storage

| Variavel | Onde aparece | Funcao |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | [.env.example:2](../../.env.example), [app/api/knexai/_store.ts:3](../../app/api/knexai/_store.ts) | Endpoint do Supabase para app e APIs |
| `SUPABASE_SERVICE_ROLE_KEY` | [.env.example:4](../../.env.example), [app/api/knexai/_store.ts:4](../../app/api/knexai/_store.ts) | Chave admin para persistencia server-side |
| `NEXT_PUBLIC_IDENTITY_SUPABASE_URL` | [.env.example:8](../../.env.example), [lib/identitySupabaseClient.ts:8](../../lib/identitySupabaseClient.ts) | Endpoint Supabase de identidade |
| `IDENTITY_SUPABASE_SERVICE_ROLE_KEY` | [.env.example:10](../../.env.example), [lib/identitySupabaseAdmin.ts:10](../../lib/identitySupabaseAdmin.ts) | Chave admin projeto identidade |
| `LOCAL_LLM_MODEL` | [.env.example:23](../../.env.example), [app/api/knexai/route.ts:126](../../app/api/knexai/route.ts), [anm_backend/adapters/engine_client.py:46](../../anm_backend/adapters/engine_client.py) | Caminho do modelo local (path de disco) |
| `LOCAL_LLM_BASE_URL` / `LLM_BASE_URL` / `VLLM_BASE_URL` | [.env.example:21](../../.env.example), [.env.example:25](../../.env.example), [.env.example:33](../../.env.example) | Endpoints do motor LLM |
| `ANM_API_BASE_URL` | [.env.example:59](../../.env.example), [app/api/knexai/route.ts:173](../../app/api/knexai/route.ts) | Endpoint do backend ANM |
| `DATABASE_URL` | [core/database/client.ts:9](../../core/database/client.ts) | URL de banco do modulo core |
| `NEXT_DIST_DIR` | [next.config.mjs:2](../../next.config.mjs) | Path de build output Next |
| `ANM_VENV_DIR` | [scripts/serve-anm.sh:12](../../scripts/serve-anm.sh) | Path do virtualenv ANM |
| `ANM_CHECKPOINT_DIR` | [anm_backend/main.py:92](../../anm_backend/main.py) | Path de checkpoints locais ANM |
| `ANM_BOOTSTRAP_CHECKPOINT` | [anm_backend/main.py:177](../../anm_backend/main.py) | Checkpoint a restaurar no boot |
| `NEXT_PUBLIC_SUPABASE_FILES_BUCKET` / `NEXT_PUBLIC_SUPABASE_FILES_PRIVATE` / `NEXT_PUBLIC_SUPABASE_THUMBS_PRIVATE` | [supadrive/web/page.tsx:72](../../supadrive/web/page.tsx), [supadrive/web/lib/storage.ts:6](../../supadrive/web/lib/storage.ts) | Controle de buckets/publico-privado (storage logico) |

Observacao:
- Nao foi encontrado uso de variavel de ambiente dedicada para "NVMe2 path" no Docker/Supabase. O `data-root` e configurado por arquivo/script, nao por env de runtime do app.

## 7) Arquivos com caminhos NVMe/absolutos detectados

| Arquivo | Evidencia |
|---|---|
| [package.json](../../package.json) | [package.json:19](../../package.json) hardcode `/mnt/c/knexit-workspace/knexit-workspace` em `serve:anm` |
| [.env.example](../../.env.example) | [.env.example:23](../../.env.example) `LOCAL_LLM_MODEL=/mnt/c/...` |
| [README.md](../../README.md) | [README.md:140](../../README.md) referencia absoluta `/mnt/c/...` |
| [knexai/README.md](../../knexai/README.md) | [knexai/README.md:21](../../knexai/README.md) referencia absoluta `/mnt/c/...` |
| [scripts/supabase-local-start.ps1](../../scripts/supabase-local-start.ps1) | [scripts/supabase-local-start.ps1:17](../../scripts/supabase-local-start.ps1) `C:\\Program Files\\Docker\\...` |
| [scripts/configure-docker-nvme2.ps1](../../scripts/configure-docker-nvme2.ps1) | [scripts/configure-docker-nvme2.ps1:19](../../scripts/configure-docker-nvme2.ps1) `docker_data.vhdx`; [scripts/configure-docker-nvme2.ps1:35](../../scripts/configure-docker-nvme2.ps1) `/var/lib/docker` |
| [infra/docker/docker-desktop-engine.nvme2.json](../../infra/docker/docker-desktop-engine.nvme2.json) | [infra/docker/docker-desktop-engine.nvme2.json:2](../../infra/docker/docker-desktop-engine.nvme2.json) `data-root` |
| [docs/knexai_local_sql_nvme2_ram.md](../knexai_local_sql_nvme2_ram.md) | [docs/knexai_local_sql_nvme2_ram.md:25](../knexai_local_sql_nvme2_ram.md) `/mnt/nvme2/postgres-data` |

## 8) Riscos encontrados

## R1 - Ambiguidade operacional de migrations (medio)
- Ha dois modos documentados:
  - migration unica via `psql -f` ([docs/knexai_local_sql_nvme2_ram.md:14](../knexai_local_sql_nvme2_ram.md)).
  - fluxo completo via `supabase db reset --local` ([docs/supabase_local_stack_nvme2.md:61](../supabase_local_stack_nvme2.md)).
- Sem runbook decisorio unico, operadores podem aplicar modo diferente sem intencao.

## R2 - Hardcodes de path dependentes de SO (medio)
- `/mnt/c/...` e caminho especifico WSL/Windows em comando de producao local ([package.json:19](../../package.json), [.env.example:23](../../.env.example)).
- Script usa caminho fixo do executavel do Docker Desktop em Windows ([scripts/supabase-local-start.ps1:17](../../scripts/supabase-local-start.ps1)).

## R3 - Alteracao de `.env.local` automatica (medio)
- O bootstrap sobrescreve chaves Supabase locais em `.env.local` ([scripts/supabase-local-start.ps1:101](../../scripts/supabase-local-start.ps1)).
- Embora haja backup, isso pode causar drift entre ambientes e perda de rastreabilidade de parametros antigos.

## R4 - Mudancas criticas fora do repositorio (medio)
- `~/.docker/daemon.json` e alterado via script ([scripts/apply-docker-engine-template.ps1:76](../../scripts/apply-docker-engine-template.ps1)).
- Isso e estado de maquina, nao versionado no repo.

## R5 - Migrations de identidade potencialmente fora do fluxo (medio)
- Existe `supabase/identity/migrations`, mas o fluxo principal usa `supabase/migrations` por padrao ([supabase/config.toml:58](../../supabase/config.toml)).
- Sem procedimento explicito, pode haver divergence entre ambientes.

## R6 - Nomenclatura NVMe2 vs configuracao efetiva (baixo a medio)
- Artefatos falam em NVMe2, mas template atual define `/var/lib/docker` ([infra/docker/docker-desktop-engine.nvme2.json:2](../../infra/docker/docker-desktop-engine.nvme2.json)).
- Em Windows/WSL2, ganho real depende de onde esta o VHDX do Docker, nao apenas do valor do `data-root`.

## R7 - Saude parcial do stack local durante auditoria (baixo)
- `supabase_vector_knexit-workspace` estava em `Restarting` no snapshot de runtime (`docker ps`).
- Nao bloqueia a avaliacao de paths NVMe/migrations, mas reduz reprodutibilidade para testes que dependem do componente vetorial.

## 9) Inconsistencias identificadas

1. Documentacao com mensagens potencialmente conflitantes:
- "nao usar `db reset/push` para migration unica" ([docs/knexai_local_sql_nvme2_ram.md:19](../knexai_local_sql_nvme2_ram.md)).
- "fluxo completo ... `db reset --local`" ([docs/supabase_local_stack_nvme2.md:58](../supabase_local_stack_nvme2.md), [docs/supabase_local_stack_nvme2.md:61](../supabase_local_stack_nvme2.md)).

2. Existe pasta `supabase/identity/migrations` sem integracao explicita no fluxo padrao local.

3. Nomenclatura "nvme2" em alguns arquivos nao garante, por si so, realocacao fisica de dados para outro disco.

## 10) Pontos sem documentacao suficiente

- Procedimento oficial e testado para mover fisicamente o disco Docker Desktop para outro NVMe em Windows/WSL2.
- Procedimento de rollback (voltar de Supabase local para remoto) apos uso de `supabase-local-start`.
- Politica de aplicacao das migrations em `supabase/identity/migrations`.
- Politica de retencao/limpeza de backups `.env.local.bak.*`.

## 11) Dependencias implicitas

- Docker Desktop + daemon ativo + plugin `docker desktop`.
- WSL habilitado para `serve:anm` ([package.json:19](../../package.json)).
- `npx supabase@latest` com acesso a rede.
- Credenciais Supabase locais/servico no `.env.local`.
- Para ANM: Python + venv + uvicorn ([scripts/serve-anm.sh:12](../../scripts/serve-anm.sh), [scripts/serve-anm.sh:29](../../scripts/serve-anm.sh)).

## 12) Pontos que comprometem auditabilidade

- Mudanca de configuracao critica em arquivo fora do repo (`~/.docker/daemon.json`).
- Reescrita automatica de `.env.local` (arquivo nao versionado) com segredos/chaves locais.
- Ausencia de "manifest" versionado de estado aplicado (ex.: hash do daemon config + resultado de migrations).

## 13) Pontos que comprometem reprodutibilidade

- Scripts dependentes de caminhos/semantica Windows/WSL (`/mnt/c`, `C:\\Program Files\\...`).
- Passo manual em GUI do Docker ainda descrito em docs.
- Dois procedimentos de migration coexistem sem "decision table" unica.

## 14) Checklist de conformidade (etapa 1)

| Item | Status | Evidencia |
|---|---|---|
| Framework/backend identificados | OK | [package.json:44](../../package.json), [anm_backend/main.py:17](../../anm_backend/main.py), [auth/src/index.ts:1](../../auth/src/index.ts), [knexai/src/server.ts:1](../../knexai/src/server.ts) |
| ORM/migration system identificado | OK | Supabase SQL migrations ([supabase/config.toml:53](../../supabase/config.toml)) |
| Paths de migrations mapeados | OK | `supabase/migrations`, `migrations_legacy`, script `MigrationFile` |
| Paths de storage/persistencia mapeados | OK | Docker data-root, Supabase DB URL, ANM checkpoints |
| Variaveis de ambiente de path mapeadas | OK | Secao 6 |
| Hardcodes absolutos detectados | OK | Secao 7 |
| Consistencia operacional completa | PARCIAL | Ambiguidade entre modo "migration unica" e "fluxo completo" |
| Rastreabilidade completa de mudanca de host | PARCIAL | Estado critico em `~/.docker/daemon.json` fora do repo |
| Reprodutibilidade cross-platform | PARCIAL | Dependencias especificas de Windows/WSL |

## 15) Mudanças recomendadas para consolidação

Prioridade P0 (minimo necessario, sem refatoracao grande):

1. Criar runbook unico com tabela de decisao:
   - Modo A: "somente migration KnexAI unificada".
   - Modo B: "todas as migrations do ambiente".
   - Comandos exatos, pre-condicoes e validacoes de pos-execucao.

2. Padronizar comando de validacao pos-setup (script unico):
   - validar `docker info` (`DockerRootDir`);
   - validar `supabase status -o env`;
   - validar versoes em `supabase_migrations.schema_migrations`.

3. Declarar formalmente o fluxo de `supabase/identity/migrations`:
   - ou integrar no fluxo principal,
   - ou documentar que e fluxo separado, com comando explicito.

Prioridade P1 (baixo impacto, melhora de robustez):

4. Remover hardcode `/mnt/c/...` de `serve:anm` para usar caminho relativo ao repo no WSL.
5. Tornar scripts de Docker/NVMe explicitamente "Windows-only" com fallback claro e mensagem de erro orientativa.
6. Registrar (log/arquivo versionavel) o resultado do merge no `daemon.json` e data/hora da aplicacao.

Prioridade P2 (governanca):

7. Definir politica para backups `.env.local.bak.*` (retencao e limpeza).
8. Consolidar docs NVMe em um unico documento de referencia e manter o outro como complemento tecnico.

---

Conclusao da etapa 1:
- Implementacao atual esta funcional e parcialmente rastreavel.
- Ha pontos claros de consolidacao para reduzir ambiguidade operacional e aumentar auditabilidade/reprodutibilidade, sem necessidade de refatoracao estrutural imediata.
