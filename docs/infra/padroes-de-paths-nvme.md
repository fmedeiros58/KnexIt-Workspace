# Padroes de Paths NVMe/NVMe2

Data: 2026-03-02  
Escopo: consolidacao de paths para migrations, storage persistente, documentos, temporarios persistentes e exportacoes, com compatibilidade total do comportamento atual.

## Objetivo

- Centralizar a definicao de caminhos via variaveis de ambiente.
- Reduzir hardcodes de path em scripts e runtime.
- Manter fallback seguro para o comportamento ja existente.
- Melhorar auditabilidade e reprodutibilidade entre ambientes.

## Ponto unico de resolucao

- Node/Next: `core/config/paths.ts` (`loadPathConfig()`).
- Scripts PowerShell:
  - `scripts/supabase-local-start.ps1`
  - `scripts/configure-docker-nvme2.ps1`
  - `scripts/apply-docker-engine-template.ps1`
  - `scripts/serve-anm-wsl.ps1`
- Python ANM (fallback de modelo local): `anm_backend/adapters/engine_client.py`.

## Convencao adotada

A implementacao segue variaveis de ambiente com fallback explicito.  
Se `NVME_BASE_PATH` estiver definido, paths relativos podem ser resolvidos sobre essa base.

## Matriz de paths

| Variavel | Proposito | Valor esperado | Fallback | Impacto operacional | Risco de alteracao |
|---|---|---|---|---|---|
| `NVME_BASE_PATH` | Base opcional para resolver paths relativos em disco rapido | path absoluto (Linux/WSL/Windows) | vazio (desativado) | habilita consolidacao em um volume | alto se apontar para volume inexistente |
| `MIGRATIONS_PATH` | Diretorio de migrations ativas | ex.: `supabase/migrations` | `supabase/migrations` | usado para resolver migration do KnexAI | medio se apontar para diretorio errado |
| `KNEXAI_MIGRATION_FILE` | Migration unificada do KnexAI | ex.: `supabase/migrations/20260302195000_create_knexai_unified_local.sql` | `<MIGRATIONS_PATH>/20260302195000_create_knexai_unified_local.sql` | usada por bootstrap local do Supabase | alto se arquivo nao existir |
| `LEGACY_MIGRATIONS_PATH` | Arquivo historico/legado de migrations | ex.: `supabase/migrations_legacy` | `supabase/migrations_legacy` | suporte a auditoria, fora do fluxo principal | baixo |
| `STORAGE_BASE_PATH` | Base para armazenamento persistente local | ex.: `data` ou `/mnt/nvme2/data` | `data` (ou `NVME_BASE_PATH/data`) | padroniza referencia de artefatos persistentes | medio |
| `DOCUMENTS_BASE_PATH` | Base de documentacao local | ex.: `docs` | `docs` (ou `NVME_BASE_PATH/docs`) | padroniza path documental | baixo |
| `EMBEDDINGS_BASE_PATH` | Base de modelos/embeddings no host | ex.: `models` ou `/mnt/nvme2/models` | `models` (ou `NVME_BASE_PATH/models`) | influencia fallback de modelo local | medio |
| `LOCAL_LLM_MODEL_DEFAULT` | Fallback padrao do path de modelo | ex.: `models/CModelosMistral-7B-Instruct-v0.2-AWQ` | `<EMBEDDINGS_BASE_PATH>/CModelosMistral-7B-Instruct-v0.2-AWQ` | usado quando `LOCAL_LLM_MODEL` nao estiver definido | medio |
| `TEMP_WORKDIR_PATH` | Base para temporarios persistentes/working dir | ex.: `.tmp` ou `/mnt/nvme2/tmp` | `.tmp` (ou `NVME_BASE_PATH/.tmp`) | reserva local de trabalho em disco | medio |
| `EXPORTS_BASE_PATH` | Base para exportacoes | ex.: `data/exports` ou `/mnt/nvme2/exports` | `data/exports` (ou `NVME_BASE_PATH/data/exports`) | padroniza destino de exportacao | medio |
| `ANM_CHECKPOINT_DIR` | Diretorio de checkpoints do ANM | ex.: `anm_backend/data/checkpoints` | `anm_backend/data/checkpoints` (ou com `NVME_BASE_PATH`) | persistencia de memoria operacional | medio |
| `ANM_VENV_DIR` | Diretorio do virtualenv ANM no WSL | ex.: `.anm-venv` | `.anm-venv` | afeta bootstrap do backend ANM | baixo |
| `ANM_WSL_WORKSPACE_DIR` | Workspace no WSL para `npm run serve:anm` | path WSL absoluto | autodeteccao via `wslpath` do repo local | remove hardcode em Windows/WSL | baixo |
| `ANM_WSL_ENTRY_SCRIPT` | Script de entrada ANM no WSL | ex.: `scripts/serve-anm.sh` | `scripts/serve-anm.sh` | controla entrypoint do backend ANM | baixo |
| `DOCKER_DATA_ROOT` | Data root do Docker Engine (template) | ex.: `/var/lib/docker` | detectado via `docker info`, senao `/var/lib/docker` | storage persistente do Supabase local (containers) | alto |
| `DOCKER_ENGINE_TEMPLATE_PATH` | Arquivo template para Docker Engine | ex.: `infra/docker/docker-desktop-engine.nvme2.json` | `infra/docker/docker-desktop-engine.nvme2.json` | centraliza aplicacao de template | baixo |
| `DOCKER_DESKTOP_EXE` | Caminho do Docker Desktop no Windows | path absoluto Windows | `C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe` | usado para autostart no bootstrap | baixo a medio |
| `IDENTITY_MIGRATIONS_POLICY` | Regra de validacao das migrations de identidade | `required` ou `optional` | `required` | define se pendencia de identity bloqueia validacao | medio |
| `ANM_CHECKPOINT_RETENTION_DAYS` | Janela de retencao logica para checkpoints ANM | inteiro positivo | `14` | referencia operacional para backup/limpeza | medio |
| `EXPORTS_RETENTION_DAYS` | Janela de retencao logica para exportacoes | inteiro positivo | `60` | referencia operacional para backup/limpeza | medio |

## Compatibilidade (100%)

- Se nenhuma variavel nova for definida, o comportamento permanece o mesmo:
  - migration unificada do KnexAI em `supabase/migrations/...`;
  - checkpoint ANM em `anm_backend/data/checkpoints`;
  - Docker template em `infra/docker/docker-desktop-engine.nvme2.json`;
  - ANM no WSL sobe sem hardcode (com autodeteccao do workspace atual).

## Exemplos de uso

### Exemplo 1 - Ambiente local padrao (sem NVMe dedicado)

```env
MIGRATIONS_PATH=supabase/migrations
KNEXAI_MIGRATION_FILE=supabase/migrations/20260302195000_create_knexai_unified_local.sql
EMBEDDINGS_BASE_PATH=models
LOCAL_LLM_MODEL=models/CModelosMistral-7B-Instruct-v0.2-AWQ
ANM_CHECKPOINT_DIR=anm_backend/data/checkpoints
```

### Exemplo 2 - Consolidado em NVMe2

```env
NVME_BASE_PATH=/mnt/nvme2/knexit
MIGRATIONS_PATH=/mnt/nvme2/knexit/supabase/migrations
KNEXAI_MIGRATION_FILE=/mnt/nvme2/knexit/supabase/migrations/20260302195000_create_knexai_unified_local.sql
STORAGE_BASE_PATH=/mnt/nvme2/knexit/data
EMBEDDINGS_BASE_PATH=/mnt/nvme2/knexit/models
LOCAL_LLM_MODEL_DEFAULT=/mnt/nvme2/knexit/models/CModelosMistral-7B-Instruct-v0.2-AWQ
TEMP_WORKDIR_PATH=/mnt/nvme2/knexit/tmp
EXPORTS_BASE_PATH=/mnt/nvme2/knexit/exports
ANM_CHECKPOINT_DIR=/mnt/nvme2/knexit/anm/checkpoints
DOCKER_DATA_ROOT=/var/lib/docker
```

## Orientacao por ambiente

### Local (dev)

- Usar `.env.local` para override de paths.
- Rodar:
  - `npm run supabase:local:start`
  - `npm run supabase:local:prep-nvme`
  - `npm run supabase:local:apply-engine-template` (quando aplicavel)
- Em Windows/WSL, `npm run serve:anm` resolve workspace automaticamente; use `ANM_WSL_WORKSPACE_DIR` apenas se necessario.

### Producao

- Definir vars de path via secret manager/plataforma de deploy.
- Nao depender de paths locais relativos do repo para dados criticos.
- Em containerizacao, garantir volume persistente montado para paths de dados/checkpoint/export.

## Pontos com ajuste manual (nao automatizados)

- Realocacao fisica do disco Docker Desktop para outro NVMe (Windows/WSL2) continua dependente do host.
- Revisao de permissao do filesystem (owner/ACL) para paths novos.
- Validacao de capacidade de disco e execucao da politica de backup/retencao para `ANM_CHECKPOINT_DIR` e exportacoes.

## Riscos conhecidos e isolamento

- `~/.docker/daemon.json` permanece fora do versionamento Git (estado de maquina).
- Caminhos absolutos variam por SO; manter valores em env reduz acoplamento no codigo, mas exige governanca de ambiente.
- `supabase/identity/migrations` exige aplicacao explicita pelo comando `npm run supabase:local:identity:migrate`.

## Checklist rapido de validacao

1. `docker info --format "{{.DockerRootDir}}"` confere com expectativa.
2. `npx supabase status -o env` retorna stack local ativo.
3. `KNEXAI_MIGRATION_FILE` existe no path esperado.
4. `npm run serve:anm` sobe no host sem depender de hardcode.
5. `LOCAL_LLM_MODEL` ou `LOCAL_LLM_MODEL_DEFAULT` apontam para modelo valido.

## Extensao RAG (etapa 09)

Novos paths consolidados para ingestao de documentos:

- `RAG_RAW_DOCUMENTS_PATH` (default: `data/rag/raw`): armazenamento do arquivo bruto ingerido.
- `RAG_EXTRACTED_TEXT_PATH` (default: `data/rag/text`): persistencia do texto extraido.
- `RAG_ADMIN_BULK_BASE_PATH` (default: `data/rag/bulk`): base permitida para referencia de arquivos em ingestao em massa.

Novos parametros operacionais:

- `RAG_MAX_FILE_SIZE_BYTES` (default: `20971520`)
- `RAG_CHUNK_SIZE_CHARS` (default: `1200`)
- `RAG_CHUNK_OVERLAP_CHARS` (default: `180`)
- `RAG_MAX_CHUNKS_PER_DOC` (default: `5000`)
- `RAG_INGEST_ADMIN_TOKEN` (vazio por default; quando definido, habilita lote admin em `POST /api/ingest` com `sourcePaths[]`).
