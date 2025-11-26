# VioAnalytics

Casca analítica do ecossistema KnexIT.
- UI: `/vioanalytics` via wrapper em `app/vioanalytics/page.tsx` -> `vioanalytics/web/page.tsx`.
- Servidor stub: Fastify de health para evoluir depois.

## Variáveis (futuras)
- `VIOANALYTICS_PORT` (padrão 3820)

## Servidor stub
```bash
cd vioanalytics
npm install
npm run dev   # porta 3820, /health
```

## Próximos passos
- Definir esquema de eventos e KPIs por produto.
- Integração com data warehouse/BI e painéis.
