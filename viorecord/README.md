# VioRecord

Casca do produto de gravação/ingestão do ecossistema KnexIT.
- UI: `/viorecord` via wrapper em `app/viorecord/page.tsx` -> `viorecord/web/page.tsx`.
- Servidor stub: Fastify com health/check para evoluir depois.

## Variáveis (futuras)
- `VIORECORD_PORT` (padrão 3800)
- Credenciais de armazenamento/ingestão a definir.

## Servidor stub
```bash
cd viorecord
npm install
npm run dev   # porta 3800, /health
```

## Próximos passos
- Definir fluxo de ingestão, armazenamento e publicação das gravações.
- Integrar SupaDrive/KnexDocs para saída e VioStudio para edição.
