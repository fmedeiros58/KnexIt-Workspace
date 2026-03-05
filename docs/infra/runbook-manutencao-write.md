# Runbook de Manutencao do Modo Escrita

Data: 2026-03-03
Escopo: operacao rotineira de reindexacao, re-sumarizacao, consolidacao de memoria e consistencia do `/write/*`.

## 1) Ordem recomendada

1. Reindexar chunks pendentes.
2. Re-sumarizar secoes/projetos stale.
3. Consolidar memoria.
4. Rodar consistencia final.

## 2) Comandos de referencia

Linux/macOS:

```bash
scripts/write-maintenance-reindex.sh --max-projects 100 --max-chunks 800
scripts/write-maintenance-resummarize.sh --max-projects 100 --max-sections-per-project 400
scripts/write-maintenance-memory.sh --similarity-threshold 0.96 --ttl-days 45 --low-priority-max 200
scripts/write-maintenance-consistency.sh --max-projects 100
```

Windows PowerShell:

```powershell
./scripts/write-maintenance-reindex.ps1 --max-projects 100 --max-chunks 800
./scripts/write-maintenance-resummarize.ps1 --max-projects 100 --max-sections-per-project 400
./scripts/write-maintenance-memory.ps1 --similarity-threshold 0.96 --ttl-days 45 --low-priority-max 200
./scripts/write-maintenance-consistency.ps1 --max-projects 100
```

## 3) Interpretacao de resultado

Saida padrao:
- cada comando emite evento final `maintenance_*_completed` com payload consolidado.

Leituras importantes:
- `chunks_failed > 0` no reindex: houve falhas de indexacao por chunk.
- `failures` nao vazio em resummarize/memory: houve erro por secao/projeto.
- `errors` nao vazio em consistency: integridade invalida e exige acao antes de avancar.

Codigo de saida:
- `0`: sucesso
- `2`: concluiu com erro operacional
- `130`: interrupcao manual

## 4) Tratamento de falhas

### Falha de conectividade/API

Sinais:
- `request_failed` ou `unexpected_status` em payload.

Acoes:
1. validar `WRITE_API_BASE_URL`;
2. validar disponibilidade da API;
3. rerodar comando com `--project-id` para escopo reduzido.

### Falha de reindex recorrente em chunk

Acoes:
1. rodar consistency para coletar contexto;
2. tentar `POST /write/chunks/{id}/reindex` manualmente;
3. manter chunk no snapshot pendente ate sucesso.

### Summary stale persistente

Acoes:
1. confirmar escrita recente na secao/projeto;
2. rerodar resummarize no projeto especifico (`--project-id`);
3. validar retorno de `GET /write/sections/{id}/summary` e `GET /write/projects/{id}/summary`.

### Consolidacao de memoria agressiva

Acoes:
1. usar `--dry-run` para inspecionar impacto;
2. reduzir `--ttl-days`/ajustar `--low-priority-max` com cautela;
3. reativar memoria via `PATCH /write/memory/{id}` quando necessario.

## 5) Cuidados operacionais

- manter backup do `state_file` de reindex se houver rotacao de ambiente;
- nao executar jobs simultaneos no mesmo ambiente sem necessidade;
- preferir janelas de menor uso para lotes maiores;
- registrar logs de cada rodada para auditoria.

## 6) Reproducao em outro ambiente

1. apontar `WRITE_API_BASE_URL` para o backend alvo;
2. garantir schema/migrations de escrita aplicados;
3. executar os 4 comandos na ordem recomendada;
4. verificar ausencia de erros no consistency.
