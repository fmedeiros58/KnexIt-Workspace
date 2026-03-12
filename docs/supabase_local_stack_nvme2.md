# Supabase Local no servidor (NVMe2 + fallback seguro)

Objetivo:
- Rodar Supabase local no proprio servidor, sem refatorar o codigo.
- Garantir Postgres em storage rapido (NVMe2) quando disponivel.
- Manter caminho seguro quando NVMe2 ainda nao estiver pronto.

## Bootstrap rapido

No root do projeto:

```bash
npm run supabase:local:start
```

Esse comando:
- sobe o Supabase local (`npx supabase start`);
- aplica a migration unica do KnexAI;
- preserva as variaveis Supabase atuais em `.env.local`;
- cria backup automatico de `.env.local`.

Se quiser sobrescrever `.env.local` com as chaves locais, use:

```bash
npm run supabase:local:start:update-env
```

Depois do bootstrap, aplicar identidade no mesmo fluxo:

```bash
npm run supabase:local:identity:migrate
```

Paths usados por esse bootstrap (com fallback):
- `MIGRATIONS_PATH` (default: `supabase/migrations`)
- `KNEXAI_MIGRATION_FILE` (default: `supabase/migrations/20260302195000_create_knexai_unified_local.sql`)
- `DOCKER_DESKTOP_EXE` (default: `C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe`)

## Migration usada

A migration aplicada no bootstrap e:
- `supabase/migrations/20260302195000_create_knexai_unified_local.sql`

Legado KnexAI:
- as migrations antigas foram movidas para `supabase/migrations_legacy/knexai` (fora do fluxo padrao de aplicacao).

## Preparar NVMe2 (quando quiser mover storage)

Gera template de configuracao para Docker Engine:

```bash
npm run supabase:local:prep-nvme
```

Opcional, com caminho explicito:

```bash
powershell -ExecutionPolicy Bypass -File scripts/configure-docker-nvme2.ps1 -DataRoot "$DOCKER_DATA_ROOT"
```

Variaveis uteis:
- `DOCKER_DATA_ROOT` (default: `/var/lib/docker`)
- `DOCKER_ENGINE_TEMPLATE_PATH` (default: `infra/docker/docker-desktop-engine.nvme2.json`)

O script cria:
- `infra/docker/docker-desktop-engine.nvme2.json`

Depois:
1. Docker Desktop -> `Settings` -> `Docker Engine`.
2. Mescle o JSON gerado.
3. `Apply & Restart`.

Automacao (aplica e reinicia):

```bash
npm run supabase:local:apply-engine-template
```

Fluxo completo (todas as migrations ativas no mesmo ambiente local):

```bash
npx supabase db reset --local
```

## Notas operacionais

- Se o host atual ja estiver em NVMe, o ganho principal ja esta capturado.
- Em Windows/WSL2, migracao real para outro NVMe ocorre pela localizacao do disco do Docker Desktop.
- Nao use `supabase db reset/push` para o fluxo de migration unica do KnexAI; use a SQL unificada.
- Politica de validacao recomendada: `IDENTITY_MIGRATIONS_POLICY=required`.
