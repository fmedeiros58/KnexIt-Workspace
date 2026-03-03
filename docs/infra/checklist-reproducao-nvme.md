# Checklist de Reproducao NVMe/NVMe2

Data: 2026-03-03  
Objetivo: reproduzir ambiente com integridade operacional e auditabilidade.

## 1) Checklist passo a passo

- [ ] Clonar repositorio correto (`knexit-workspace`).
- [ ] Validar Node.js 18+.
- [ ] Validar Docker Desktop instalado e executando.
- [ ] Validar WSL habilitado (quando usar paths POSIX).
- [ ] Copiar `.env.example` para `.env.local`.
- [ ] Preencher variaveis de path operacionais.
- [ ] Criar/garantir diretorios: `data`, `data/exports`, `.tmp`, `anm_backend/data/checkpoints`.
- [ ] Rodar `npm run supabase:local:prep-nvme`.
- [ ] Rodar `npm run supabase:local:apply-engine-template`.
- [ ] Rodar `npm run supabase:local:start`.
- [ ] Rodar `npm run supabase:local:identity:migrate`.
- [ ] Rodar `npm run serve:anm`.
- [ ] Rodar `npm run verify:nvme`.
- [ ] (Opcional) Rodar `npm run verify:nvme:sh`.

## 2) Itens que devem ser identicos em outro ambiente

- [ ] Nome e local da migration ativa:
  - `supabase/migrations/20260302195000_create_knexai_unified_local.sql`
- [ ] `MIGRATIONS_PATH` e `KNEXAI_MIGRATION_FILE` consistentes.
- [ ] `IDENTITY_MIGRATIONS_POLICY` definido (`required` recomendado).
- [ ] `DOCKER_DATA_ROOT` coerente com:
  - template `infra/docker/docker-desktop-engine.nvme2.json`
  - `daemon.json` do host
  - `docker info --format "{{.DockerRootDir}}"`
- [ ] `ANM_CHECKPOINT_DIR` com permissao de leitura/escrita.
- [ ] Scripts de validacao presentes:
  - `scripts/verify-nvme-setup.ps1`
  - `scripts/verify-nvme-setup.sh`

## 3) Conferencia antes de subir o sistema

- [ ] `NVME_BASE_PATH` aponta para path existente.
- [ ] `DOCKER_ENGINE_TEMPLATE_PATH` existe e contem `data-root`.
- [ ] `supabase/config.toml` existe.
- [ ] `ANM_CHECKPOINT_RETENTION_DAYS` e `EXPORTS_RETENTION_DAYS` sao inteiros positivos.
- [ ] `models/CModelosMistral-7B-Instruct-v0.2-AWQ` existe (ou `LOCAL_LLM_MODEL` equivalente valido).
- [ ] WSL disponivel se houver path POSIX em env.

## 4) Verificacao pos-configuracao

- [ ] `npm run verify:nvme` retorna `fail=0`.
- [ ] Nao existem divergencias entre template/daemon/runtime Docker.
- [ ] `npx supabase status -o env` retorna URLs locais validas.
- [ ] Identity migrations constam como aplicadas em `supabase_migrations.schema_migrations`.
- [ ] `npm run serve:anm` sobe sem erro de permissao/path.

## 5) Verificacao pos-deploy (ou pos-go-live local)

- [ ] Endpoint de chat responde sem erro de infra de path.
- [ ] Persistencia de mensagens/session funcionando.
- [ ] Checkpoint ANM salva/restaura sem erro.
- [ ] Logs sem erro recorrente de filesystem/migration.
- [ ] Rodar novamente `npm run verify:nvme` apos restart da maquina.

## 6) Criterios de aceite

- [ ] Nenhum `[FAIL]` no verificador.
- [ ] Qualquer `[WARN]` com justificativa documentada.
- [ ] Output de verificacao arquivado para auditoria.

## 7) Lacunas explicitas (estado atual)

- [ ] Planejar janela de migracao de `NVME_BASE_PATH=/mnt/c` para volume NVMe dedicado real (quando disponivel).
- [ ] Definir destino off-host e procedimento de restauracao para backups de checkpoints e exportacoes.
