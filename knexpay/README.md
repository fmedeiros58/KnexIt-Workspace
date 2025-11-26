# KnexPay

Casca de billing/pagamentos do ecossistema KnexIT.
- UI: `/knexpay` via wrapper em `app/knexpay/page.tsx` -> `knexpay/web/page.tsx`.
- Servidor stub: Fastify de health para evoluir depois.

## Variáveis (futuras)
- `KNEXPAY_PORT` (padrão 3870)
- Provedores de pagamento a definir.

## Servidor stub
```bash
cd knexpay
npm install
npm run dev   # porta 3870, /health
```

## Próximos passos
- Integrar gateway de pagamento e lógica de planos/assinaturas.
- Expor webhooks e conciliação.
