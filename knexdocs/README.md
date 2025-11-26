# KnexDocs

Casca do editor/repositório de documentos do ecossistema KnexIT.
- UI: `/knexdocs` via wrapper em `app/knexdocs/page.tsx` -> `knexdocs/web/page.tsx`.
- Servidor stub: Fastify de health para evoluir depois.

## Variáveis (futuras)
- `KNEKXDOCS_PORT` (padrão 3830)
- Config de armazenamento/colaboração a definir.

## Servidor stub
```bash
cd knexdocs
npm install
npm run dev   # porta 3830, /health
```

## Próximos passos
- Definir formato de documentos, colaboração em tempo real e integração com SupaDrive/KnexAI/VioRead.
