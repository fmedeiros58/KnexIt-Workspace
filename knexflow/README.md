# KnexFlow

Casca do orquestrador/automação do ecossistema KnexIT.
- UI: `/knexflow` via wrapper em `app/knexflow/page.tsx` -> `knexflow/web/page.tsx`.
- Servidor stub: Fastify de health para evoluir depois.

## Variáveis (futuras)
- `KNEXFLOW_PORT` (padrão 3840)

## Servidor stub
```bash
cd knexflow
npm install
npm run dev   # porta 3840, /health
```

## Próximos passos
- Definir gatilhos/ações e integrações entre produtos.
- Adicionar persistência e painéis de execução.
