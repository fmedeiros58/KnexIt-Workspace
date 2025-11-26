# KnexSearch

Casca de busca unificada do ecossistema KnexIT.
- UI: `/knexsearch` via wrapper em `app/knexsearch/page.tsx` -> `knexsearch/web/page.tsx`.
- Servidor stub: Fastify de health para evoluir depois.

## Variáveis (futuras)
- `KNEXSEARCH_PORT` (padrão 3860)

## Servidor stub
```bash
cd knexsearch
npm install
npm run dev   # porta 3860, /health
```

## Próximos passos
- Definir indexação de fontes e ranking (semantic/keyword).
- Integrar IA (KnexAI) para reformular consultas e enriquecer resultados.
