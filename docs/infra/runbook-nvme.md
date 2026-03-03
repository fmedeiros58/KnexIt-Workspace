# Runbook NVMe/NVMe2

Data: 2026-03-03  
Escopo: provisionamento, validacao, troubleshooting e rollback conceitual de paths/persistencia local.

## 1) Pre-requisitos

- Windows com PowerShell e Docker Desktop instalados.
- WSL habilitado (para fluxo POSIX e `serve:anm`).
- Node.js 18+.
- Acesso ao repositorio `knexit-workspace`.
- Docker daemon ativo.

## 2) Estrutura esperada de diretorios

No repo:
- `supabase/migrations/`
- `supabase/migrations_legacy/`
- `infra/docker/docker-desktop-engine.nvme2.json`
- `anm_backend/data/checkpoints/`
- `data/`
- `data/exports/`
- `.tmp/`
- `docs/`
- `models/`

No host (Windows):
- `%USERPROFILE%\\.docker\\daemon.json` (estado do Docker Engine do host)

## 3) Variaveis de ambiente (operacionais)

Minimo recomendado em `.env.local`:

```env
NVME_BASE_PATH=/mnt/c
MIGRATIONS_PATH=supabase/migrations
KNEXAI_MIGRATION_FILE=supabase/migrations/20260302195000_create_knexai_unified_local.sql
LEGACY_MIGRATIONS_PATH=supabase/migrations_legacy
STORAGE_BASE_PATH=data
DOCUMENTS_BASE_PATH=docs
EMBEDDINGS_BASE_PATH=models
LOCAL_LLM_MODEL_DEFAULT=models/CModelosMistral-7B-Instruct-v0.2-AWQ
TEMP_WORKDIR_PATH=.tmp
EXPORTS_BASE_PATH=data/exports
DOCKER_DATA_ROOT=/var/lib/docker
DOCKER_ENGINE_TEMPLATE_PATH=infra/docker/docker-desktop-engine.nvme2.json
DOCKER_DESKTOP_EXE=C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe
ANM_WSL_WORKSPACE_DIR=/mnt/c/knexit-workspace/knexit-workspace
ANM_WSL_ENTRY_SCRIPT=scripts/serve-anm.sh
ANM_CHECKPOINT_DIR=anm_backend/data/checkpoints
ANM_VENV_DIR=.anm-venv
IDENTITY_MIGRATIONS_POLICY=required
ANM_CHECKPOINT_RETENTION_DAYS=14
EXPORTS_RETENTION_DAYS=60
```

Observacao:
- `NVME_BASE_PATH` deve apontar para path existente.
- Politica atual: manter `/mnt/c` como baseline local validado.
- Politica de evolucao: quando NVMe dedicado real estiver disponivel (ex.: `/mnt/nvme2`), atualizar `NVME_BASE_PATH` e revalidar.

## 4) Ordem correta de configuracao

1. Preparar env:
- Atualizar `.env.local` com variaveis acima.

2. Preparar template Docker:
- `npm run supabase:local:prep-nvme`

3. Aplicar template no host:
- `npm run supabase:local:apply-engine-template`

4. Subir Supabase local e aplicar migration KnexAI:
- `npm run supabase:local:start`

5. Aplicar migrations de identidade (fluxo oficial):
- `npm run supabase:local:identity:migrate`

6. Subir ANM backend:
- `npm run serve:anm`

7. Executar verificacao operacional:
- `npm run verify:nvme`
- (opcional WSL) `npm run verify:nvme:sh`

## 5) Como validar o ambiente

Validacao principal:
- `npm run verify:nvme`

Resultado esperado:
- `fail=0`
- `warn=0` (no estado atual validado)

Validacoes complementares:
- `docker info --format "{{.DockerRootDir}}"` deve ser igual a `DOCKER_DATA_ROOT`.
- `npx supabase status -o env` deve retornar `API_URL`, `DB_URL`, `SERVICE_ROLE_KEY`.
- `supabase_migrations.schema_migrations` deve conter versoes de `supabase/identity/migrations`.

## 6) Como detectar falhas

Sinais de falha:
- script retorna exit code `1`;
- linhas `[FAIL]` no output;
- divergecia entre:
  - template `data-root`,
  - `daemon.json` `data-root`,
  - `docker info` `DockerRootDir`.

Falhas comuns:
- `NVME_BASE_PATH` inexistente;
- migration ausente/sem permissao;
- falta de permissao de escrita em `ANM_CHECKPOINT_DIR`;
- WSL ausente com paths POSIX configurados.

## 7) Troubleshooting rapido

### Caso A - `NVME_BASE_PATH` inexistente
- Verificar mount/ordem de boot.
- Ajustar env para path valido.
- Reexecutar `npm run verify:nvme`.

### Caso B - `daemon.json` diverge de `DOCKER_DATA_ROOT`
- Ajustar `~/.docker/daemon.json` via:
  - `npm run supabase:local:apply-engine-template`
- Reiniciar Docker Desktop.
- Revalidar.

### Caso C - migration nao encontrada
- Confirmar `KNEXAI_MIGRATION_FILE`.
- Confirmar existencia em disco e permissao de leitura.

### Caso D - sem permissao em checkpoint/storage
- Ajustar ACL/permissoes do diretorio.
- Testar gravacao manual no path.

### Caso E - WSL indisponivel
- Habilitar WSL.
- Ou migrar paths POSIX para caminhos Windows no host.

### Caso F - identity migration pendente
- Rodar `npm run supabase:local:identity:migrate`.
- Reexecutar `npm run verify:nvme`.

## 8) Rollback conceitual

Se precisar voltar para setup anterior:

1. Congelar alteracoes de path:
- remover/zerar `NVME_BASE_PATH`;
- manter paths relativos padrao (`supabase/migrations`, `data`, `docs`, `models`).

2. Reverter configuracao Docker do host:
- restaurar backup do `daemon.json` (se existir);
- ou ajustar manualmente `data-root` para estado anterior.

3. Revalidar:
- `npm run verify:nvme`
- `npm run supabase:local:start`

4. Confirmar operacao:
- healthchecks do app/API/ANM.

## 9) Politicas e pontos pendentes

Politicas definidas nesta etapa:
- `supabase/identity/migrations` entra no fluxo unico local via `npm run supabase:local:identity:migrate` e validacao obrigatoria (`IDENTITY_MIGRATIONS_POLICY=required`).
- Retencao minima padrao:
  - `ANM_CHECKPOINT_RETENTION_DAYS=14`
  - `EXPORTS_RETENTION_DAYS=60`
- Baseline atual validado: `NVME_BASE_PATH=/mnt/c`.

Pendente de decisao humana:
- Janela oficial de migracao para NVMe dedicado real (`/mnt/nvme2` ou equivalente fisico) com plano de cutover.
- Destino off-host de backup para checkpoints/exports (S3, NAS ou snapshot de volume) e politica de restauracao.
