# Checklist Operacional da Etapa 4

Data: 2026-03-03
Escopo: checks de deploy e operacao para edicao/versionamento/autosave/reindex/resumo/memoria.

## 1) Checks apos deploy

1. rotas `/write/*` respondendo (`projects`, `sections`, `chunks`, `summary`, `memory`).
2. migrations aplicadas (incluindo campos de consolidacao de memoria).
3. script `python scripts/write_maintenance.py --help` executa sem erro.

## 2) Checks apos edicao de chunk

1. `PATCH /write/chunks/{id}` retorna `version_record` novo.
2. `GET /write/chunks/{id}/versions` inclui versao criada.
3. nao houve perda do snapshot anterior.

## 3) Checks apos autosave

1. autosave com `client_version` correto retorna `status=saved`.
2. autosave repetido sem mudanca retorna `status=no_change`.
3. autosave com versao antiga retorna `409`.

## 4) Checks apos reindexacao

1. `POST /write/chunks/{id}/reindex` retorna `reindexed_count=1`.
2. script `reindex` nao deixa falhas pendentes sem log.

## 5) Checks apos re-sumarizacao

1. `GET /write/sections/{id}/summary` e `GET /write/projects/{id}/summary` com `is_stale=false` apos execucao.
2. `POST /write/chunks/{id}/resummarize` atualiza secao e projeto.

## 6) Checks apos consolidacao de memoria

1. `POST /write/projects/{id}/memory/consolidate` retorna relatorio coerente.
2. itens desativados aparecem em `GET /write/projects/{id}/memory/inactive`.
3. nenhum item some sem trilha (`deactivation_reason`/`consolidated_into_memory_id`).

## 7) Troubleshooting rapido

1. rodar `consistency` para diagnostico inicial.
2. rodar `resummarize` no projeto afetado.
3. rodar `reindex` com escopo reduzido (`--project-id`).
4. revalidar com `consistency`.

## 8) Lacunas ainda para proxima etapa

1. agendamento automatico nativo (cron/timer externo ainda necessario);
2. retry assinado e observabilidade dedicada para jobs longos;
3. reconciliacao automatica de conflito no frontend (hoje e fluxo basico/manual).
