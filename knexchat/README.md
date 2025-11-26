# KnexChat

Casca do mensageiro/omnichat do ecossistema KnexIT.
- UI: `/knexchat` via wrapper em `app/knexchat/page.tsx` -> `knexchat/web/page.tsx`.
- Servidor stub: Fastify de health para evoluir depois.

## Variáveis (futuras)
- `KNEXCHAT_PORT` (padrão 3850)

## Servidor stub
```bash
cd knexchat
npm install
npm run dev   # porta 3850, /health
```

## Próximos passos
- Definir canais, threads, integrações e históricos.
- Integrar IA (KnexAI) para sumarização/respostas sugeridas.
