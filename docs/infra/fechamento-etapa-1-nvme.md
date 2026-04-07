# Fechamento da Etapa 1 - NVMe/NVMe2

Data: 2026-03-03  
Escopo: concluir revisao e consolidacao da implementacao de paths/persistencia NVMe/NVMe2 com minimo risco e alta auditabilidade.

## 1) Escopo da etapa

- Auditoria tecnica da implementacao atual.
- Consolidacao de paths via configuracao central.
- Validacao operacional de integridade (paths, permissao, consistencia Docker, migrations).
- Formalizacao documental (ADR, runbook, checklist).
- Ajustes finais minimos para remover inconsistencias e fechar criterios de aceite.

## 2) O que foi revisado

- Runtime/app:
  - `anm_backend/main.py` (guardas de NVMe e leitura/escrita de checkpoint).
  - `anm_backend/adapters/engine_client.py` (fallback de modelo local e paths por env).
  - `app/api/ai-system-anm/route.ts` (uso de config central de paths no Node).
- Config central:
  - `core/config/paths.ts` (resolucao padronizada de paths com fallback).
- Scripts de operacao/verificacao:
  - `scripts/supabase-local-start.ps1`
  - `scripts/serve-anm.sh`
  - `scripts/serve-anm-wsl.ps1`
  - `scripts/verify-nvme-setup.ps1`
  - `scripts/verify-nvme-setup.sh`
  - `scripts/supabase-apply-identity-migrations.ps1`
  - `scripts/supabase-apply-identity-migrations.sh`
- Migrations:
  - migration ativa KnexAI unificada em `supabase/migrations/20260302195000_create_knexai_unified_local.sql`.
  - migrations legadas movidas para `supabase/migrations_legacy/`.
  - migration de identity `20260210_init_identity.sql` ajustada para idempotencia de policies (`drop policy if exists`).

## 3) O que foi consolidado

- Paths criticos mapeados e validados por env com fallback previsivel.
- Politica oficial para identity no fluxo local unico:
  - executar `npm run supabase:local:identity:migrate` apos `npm run supabase:local:start`.
  - validar por `IDENTITY_MIGRATIONS_POLICY=required`.
- Politica de retencao operacional registrada:
  - `ANM_CHECKPOINT_RETENTION_DAYS=14`
  - `EXPORTS_RETENTION_DAYS=60`
- Baseline operacional atual registrado:
  - `NVME_BASE_PATH=/mnt/c` (estado validado atual).
  - migracao para NVMe dedicado real fica como cutover planejado.

## 4) Arquivos alterados (escopo NVMe/Etapa 1)

- Config/infra/scripts:
  - `.env.example`
  - `package.json`
  - `core/config/paths.ts`
  - `scripts/supabase-local-start.ps1`
  - `scripts/serve-anm.sh`
  - `scripts/serve-anm-wsl.ps1`
  - `scripts/verify-nvme-setup.ps1`
  - `scripts/verify-nvme-setup.sh`
  - `scripts/supabase-apply-identity-migrations.ps1`
  - `scripts/supabase-apply-identity-migrations.sh`
- Runtime:
  - `anm_backend/main.py`
  - `anm_backend/adapters/engine_client.py`
  - `app/api/ai-system-anm/route.ts`
- Migrations:
  - `supabase/migrations/20260302195000_create_knexai_unified_local.sql`
  - `supabase/migrations_legacy/...`
  - `supabase/identity/migrations/20260210_init_identity.sql`
- Documentacao:
  - `docs/infra/auditoria-nvme-etapa-1.md`
  - `docs/infra/padroes-de-paths-nvme.md`
  - `docs/infra/verificacao-operacional-nvme.md`
  - `docs/infra/runbook-nvme.md`
  - `docs/infra/checklist-reproducao-nvme.md`
  - `docs/adr/ADR-001-persistencia-em-nvme.md`
  - `docs/supabase_local_stack_nvme2.md`
  - `README.md`

## 5) Scripts adicionados

- `scripts/verify-nvme-setup.ps1`
- `scripts/verify-nvme-setup.sh`
- `scripts/supabase-apply-identity-migrations.ps1`
- `scripts/supabase-apply-identity-migrations.sh`

## 6) Documentos criados

- `docs/infra/auditoria-nvme-etapa-1.md`
- `docs/infra/padroes-de-paths-nvme.md`
- `docs/infra/verificacao-operacional-nvme.md`
- `docs/infra/runbook-nvme.md`
- `docs/infra/checklist-reproducao-nvme.md`
- `docs/adr/ADR-001-persistencia-em-nvme.md`

## 7) Validacao de integridade executada

Comandos executados no ambiente atual:

- `npm run supabase:local:identity:migrate`
- `npm run verify:nvme`
- `npm run verify:nvme:sh`
- `npx tsc --noEmit`

Resultado observado:

- `verify:nvme`: `ok=20 warn=0 fail=0`
- `verify:nvme:sh`: `ok=21 warn=0 fail=0`
- identity migrations registradas no historico local:
  - `20260210`
  - `20260211090000`
  - `20260211090500`

## 8) Riscos remanescentes

- `NVME_BASE_PATH=/mnt/c` nao garante NVMe dedicado fisico; garante apenas consistencia estrutural atual.
- `~/.docker/daemon.json` continua sendo estado de maquina (fora do Git).
- Politica de retencao foi definida e validada como parametro, mas limpeza/backup off-host ainda depende de operacao externa.

## 9) Pendencias para a Etapa 2

- Planejar e executar cutover controlado para NVMe dedicado real (`/mnt/nvme2` ou equivalente).
- Definir automacao operacional de backup/retencao (job/scheduler + destino off-host + restore test).
- Incluir verificacao NVMe em pipeline CI/CD (gate de pre-deploy/release).

## 10) Criterios de aceite da Etapa 1

- [x] paths centralizados ou claramente mapeados.
- [x] documentacao suficiente para reproducao.
- [x] verificacao operacional disponivel (PowerShell e bash).
- [x] decisao arquitetural registrada (ADR-001).
- [x] riscos conhecidos explicitamente documentados.

## 11) Evidencias de auditabilidade

### 11.1 Lista de arquivos de documentacao

- `docs/infra/auditoria-nvme-etapa-1.md`
- `docs/infra/padroes-de-paths-nvme.md`
- `docs/infra/verificacao-operacional-nvme.md`
- `docs/infra/runbook-nvme.md`
- `docs/infra/checklist-reproducao-nvme.md`
- `docs/adr/ADR-001-persistencia-em-nvme.md`

### 11.2 Lista de scripts de verificacao

- `scripts/verify-nvme-setup.ps1`
- `scripts/verify-nvme-setup.sh`
- `scripts/supabase-apply-identity-migrations.ps1`
- `scripts/supabase-apply-identity-migrations.sh`

### 11.3 Lista de pontos configuraveis

- `NVME_BASE_PATH`
- `MIGRATIONS_PATH`
- `KNEXAI_MIGRATION_FILE`
- `LEGACY_MIGRATIONS_PATH`
- `STORAGE_BASE_PATH`
- `DOCUMENTS_BASE_PATH`
- `EMBEDDINGS_BASE_PATH`
- `LOCAL_LLM_MODEL_DEFAULT`
- `TEMP_WORKDIR_PATH`
- `EXPORTS_BASE_PATH`
- `ANM_CHECKPOINT_DIR`
- `DOCKER_DATA_ROOT`
- `DOCKER_ENGINE_TEMPLATE_PATH`
- `IDENTITY_MIGRATIONS_POLICY`
- `ANM_CHECKPOINT_RETENTION_DAYS`
- `EXPORTS_RETENTION_DAYS`

### 11.4 Lista de decisoes registradas

- Consolidar persistencia por env + config central (`core/config/paths.ts`).
- Manter migration unificada KnexAI como fluxo ativo local.
- Arquivar migrations legadas em `supabase/migrations_legacy`.
- Tornar identity parte do fluxo unico local com comando explicito e validacao obrigatoria.
- Definir retencao padrao para checkpoints/exports e validar parametros na verificacao operacional.
- Manter baseline atual em `/mnt/c` ate janela de cutover para NVMe dedicado.
