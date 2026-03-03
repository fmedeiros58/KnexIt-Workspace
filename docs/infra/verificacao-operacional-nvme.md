# Verificacao Operacional NVMe/NVMe2

Data: 2026-03-02  
Escopo: integridade operacional e reprodutibilidade de paths de migrations, persistencia e artefatos locais.

## O que e verificado

Scripts:
- `scripts/verify-nvme-setup.sh` (Linux/WSL/bash)
- `scripts/verify-nvme-setup.ps1` (Windows/PowerShell)

Checagens executadas:
1. Variaveis de path efetivas (env + fallback) e exibicao auditavel no output.
2. Existencia e leitura de estruturas criticas:
   - `MIGRATIONS_PATH`
   - `KNEXAI_MIGRATION_FILE`
   - `LEGACY_MIGRATIONS_PATH`
   - `DOCUMENTS_BASE_PATH`
   - `EMBEDDINGS_BASE_PATH`
   - `DOCKER_ENGINE_TEMPLATE_PATH`
3. Escrita/leitura (ou capacidade de criacao) para paths operacionais:
   - `STORAGE_BASE_PATH`
   - `TEMP_WORKDIR_PATH`
   - `EXPORTS_BASE_PATH`
   - `ANM_CHECKPOINT_DIR`
4. Consistencia:
   - `KNEXAI_MIGRATION_FILE` dentro de `MIGRATIONS_PATH` (warn quando fora).
   - existencia de `supabase/config.toml`.
5. Governanca operacional:
   - `IDENTITY_MIGRATIONS_POLICY` (`required`/`optional`).
   - `ANM_CHECKPOINT_RETENTION_DAYS` > 0.
   - `EXPORTS_RETENTION_DAYS` > 0.
6. Migrations de identidade:
   - existencia de `supabase/identity/migrations/*.sql`.
   - validacao da presenca de cada `version` em `supabase_migrations.schema_migrations`.
7. NVMe opcional:
   - se `NVME_BASE_PATH` estiver definido, exige path existente;
   - no `.sh`, tenta detectar mountpoint dedicado quando `mountpoint` existe.

## Como rodar

Windows/PowerShell (recomendado neste workspace):

```bash
npm run verify:nvme
```

Linux/WSL/bash:

```bash
npm run verify:nvme:sh
```

Ou direto:

```bash
powershell -ExecutionPolicy Bypass -File scripts/verify-nvme-setup.ps1
bash scripts/verify-nvme-setup.sh
```

## Como interpretar falhas

- `[OK]`: validacao passou.
- `[WARN]`: nao bloqueia, mas indica risco operacional/reprodutibilidade.
- `[FAIL]`: bloqueante; o script retorna codigo de saida `1`.

Resumo final:
- `ok=<n> warn=<n> fail=<n>`

## Passos de correcao por tipo

### 1) Path inexistente (`[FAIL] ... inexistente`)

- Corrigir valor da env correspondente em `.env.local`.
- Se for path relativo, garantir que o diretorio/arquivo existe no repo.
- Se for path absoluto em NVMe, verificar montagem do volume.

### 2) Sem permissao de leitura/escrita

- Ajustar owner/permissoes do diretorio.
- Validar se o usuario do processo (Node/Python/Docker) tem acesso.
- Reexecutar verificacao apos ajuste.

### 3) `NVME_BASE_PATH` configurado mas ausente

- Validar ordem de boot/mount do volume.
- Confirmar path no sistema operacional correto (Windows vs WSL/Linux).
- Se ambiente nao usa NVMe dedicado, remover `NVME_BASE_PATH` para usar fallback relativo.

### 4) Migration fora de `MIGRATIONS_PATH` (`[WARN]`)

- Ajustar `KNEXAI_MIGRATION_FILE` para path consistente com `MIGRATIONS_PATH`.
- Manter excecao apenas se for intencional e documentada.

### 5) Identity migration pendente

- Rodar `npm run supabase:local:identity:migrate`.
- Reexecutar `npm run verify:nvme`.

## Protecoes adicionadas no runtime/execucao

1. `anm_backend/main.py`
- Falha explicita se `NVME_BASE_PATH` estiver definido e inexistente.
- Valida `ANM_CHECKPOINT_DIR` com criacao + probe de leitura/escrita.

2. `scripts/serve-anm.sh`
- Valida `NVME_BASE_PATH` (quando definido).
- Garante criacao de `ANM_CHECKPOINT_DIR`.
- Faz probe de leitura/escrita antes de subir o uvicorn.

3. `scripts/supabase-local-start.ps1`
- Valida `NVME_BASE_PATH` (incluindo caminho POSIX via WSL).
- Valida existencia e leitura da migration antes de aplicar.
- Falha com mensagem explicita quando path configurado e invalido.

4. `scripts/supabase-apply-identity-migrations.ps1` / `.sh`
- Aplica migrations de `supabase/identity/migrations` em ordem.
- Registra versoes em `supabase_migrations.schema_migrations`.
- Mantem idempotencia por `version` (skip se ja aplicada).

## Limitacoes conhecidas

1. Em Windows, caminhos POSIX dependem de WSL para validacao completa.
2. `NVME_BASE_PATH` nao prova desempenho do disco; valida apenas presenca/estrutura/permissao.
3. Mudancas em `~/.docker/daemon.json` continuam fora de versionamento Git.
4. Checagem de mountpoint no `.sh` depende do comando `mountpoint` no host.
5. Retencao configurada (`ANM_CHECKPOINT_RETENTION_DAYS`, `EXPORTS_RETENTION_DAYS`) e validada como parametro, mas a limpeza automatica nao faz parte deste script.

## Reproducao minima recomendada

1. Ajustar `.env.local` com paths de ambiente.
2. Rodar `npm run verify:nvme`.
3. Corrigir todos os `[FAIL]`.
4. Registrar output da verificacao em artefato de auditoria (CI ou log de deploy).
