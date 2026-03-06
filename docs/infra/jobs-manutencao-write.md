# Jobs de Manutencao do Modo Escrita

Data: 2026-03-03
Escopo: rotinas operacionais leves para manutencao do dominio `/write/*`.

## 1) Rotinas disponiveis

Script central:
- `scripts/write_maintenance.py`

Wrappers Linux/macOS:
- `scripts/write-maintenance-reindex.sh`
- `scripts/write-maintenance-resummarize.sh`
- `scripts/write-maintenance-memory.sh`
- `scripts/write-maintenance-consistency.sh`

Wrappers Windows:
- `scripts/write-maintenance-reindex.ps1`
- `scripts/write-maintenance-resummarize.ps1`
- `scripts/write-maintenance-memory.ps1`
- `scripts/write-maintenance-consistency.ps1`

## 2) O que cada rotina processa

### reindex

Comando: `python scripts/write_maintenance.py reindex`

Processa:
- projetos retornados por `GET /write/projects`;
- secoes/chunks por `GET /write/projects/{id}/sections`.

Como seleciona pendencias:
- compara cada chunk com snapshot local (`state_file`);
- pendente quando:
  - chunk nao existe no snapshot, ou
  - `version` mudou, ou
  - `updated_at` mudou.

Acao:
- chama `POST /write/chunks/{chunk_id}/reindex` apenas para pendentes.

Persistencia operacional:
- atualiza `data/write-maintenance/reindex-state.json` (padrao).

### resummarize

Comando: `python scripts/write_maintenance.py resummarize`

Processa:
- secoes de cada projeto;
- resumo global por projeto.

Como seleciona pendencias:
- `GET /write/sections/{id}/summary`:
  - stale quando `is_stale=true` ou `404`.
- `GET /write/projects/{id}/summary`:
  - stale quando `is_stale=true` ou `404`.

Acao:
- secao stale: `POST /write/sections/{id}/summarize`;
- projeto stale: `POST /write/projects/{id}/summarize`.

### memory

Comando: `python scripts/write_maintenance.py memory`

Processa:
- consolidacao de memoria por projeto.

Acao:
- chama `POST /write/projects/{id}/memory/consolidate`.

Parametros principais:
- `--similarity-threshold`
- `--ttl-days`
- `--low-priority-max`
- `--dry-run`

### consistency

Comando: `python scripts/write_maintenance.py consistency`

Processa:
- verificacao de consistencia estrutural do dominio `/write/*`.

Checks principais:
- correspondencia de `project_id`/`section_id` em secoes e chunks;
- chunk ids duplicados no escopo do projeto;
- versao de chunk invalida;
- existencia/staleness de summaries;
- coesao de `process_memory` com projeto.

## 3) Limites e selecao

Todos os comandos aceitam:
- `--base-url` (default: `WRITE_API_BASE_URL` ou `http://127.0.0.1:8010`)
- `--timeout-sec`
- `--max-projects`
- `--project-id` (filtro repetivel)

Limites adicionais:
- `reindex`: `--max-chunks`
- `resummarize`: `--max-sections-per-project`

## 4) Logs, erros e previsibilidade

Formato:
- logs em JSON (stdout), com `timestamp`, `event` e `payload`.

Falhas:
- nao ha operacao destrutiva silenciosa;
- falhas sao listadas no resumo final;
- codigo de saida `2` quando ha erro operacional.

## 5) Execucao local e producao

Local:
- chamar comando python direto ou wrappers `.ps1`/`.sh`.

Producao:
- usar os wrappers `.sh` em cron/systemd timer;
- manter `WRITE_API_BASE_URL` apontando para API interna.
