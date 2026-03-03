# KnexAI Local SQL (NVMe2) + Hot Memory (RAM)

Objetivo:
- Persistir historico/auditoria em SQL local (disco NVMe2).
- Manter memoria quente no runtime (RAM do servidor) para baixa latencia.

## 1) Migration unica (local)
Use somente:
- `supabase/migrations/20260302195000_create_knexai_unified_local.sql`
  - ou via env consolidada: `KNEXAI_MIGRATION_FILE`

Aplicacao direta em Postgres local:

```bash
psql "$DATABASE_URL" -f "${KNEXAI_MIGRATION_FILE:-supabase/migrations/20260302195000_create_knexai_unified_local.sql}"
```

Importante:
- Para executar **apenas essa migration**, use o comando `psql -f` acima.
- Evite `supabase db reset` / `supabase db push` nesse fluxo local, pois esses comandos aplicam todo o historico de `supabase/migrations`.

## 2) Postgres em NVMe2
Garanta que o data directory do Postgres esteja em NVMe2.

Exemplo (Linux):
- `data_directory = '/mnt/nvme2/postgres-data'`
- `wal_level = replica` (default), com WAL no mesmo volume NVMe2

Parametros recomendados (ajuste por RAM total):
- `shared_buffers = 25%` da RAM
- `effective_cache_size = 50-75%` da RAM
- `maintenance_work_mem = 512MB` (ou maior em servidor dedicado)
- `synchronous_commit = on` (durabilidade)

## 3) Memoria quente em RAM (ANM)
No ANM, a camada quente ja e in-memory (working memory + cortex + hypotheses).
Persistencia SQL deve ficar fora do caminho critico por token.

Variaveis uteis:
- `ANM_WORKING_MEMORY_CAPACITY=192` (aumente se houver RAM disponivel)
- `ANM_CHAT_MAX_TOKENS=512` (ou valor de acordo com cauda aceitavel)
- `ANM_CHECKPOINT_DIR=anm_backend/data/checkpoints` (ou path no NVMe)

## 4) Observacao operacional
- SQL local = durabilidade + auditoria.
- RAM local = contexto vivo e resposta rapida.
- Evite carregar contexto SQL inteiro a cada turno; mantenha janela curta no hot path.
