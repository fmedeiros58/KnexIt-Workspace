# VioStudio

Casca do estúdio de edição/pós-produção do ecossistema KnexIT.
- UI: `/viostudio` via wrapper em `app/viostudio/page.tsx` -> `viostudio/web/page.tsx`.
- Servidor stub: Fastify de health para evoluir depois.

## Variáveis (futuras)
- `VIOSTUDIO_PORT` (padrão 3810)

## Servidor stub
```bash
cd viostudio
npm install
npm run dev   # porta 3810, /health
```

## Próximos passos
- Definir ingestão de mídia de VioRecord/VioLive.
- Modelar timelines, cortes e export para SupaDrive/KnexDocs.
