# VioRead

Leitor acadêmico assistido por IA do ecossistema KnexIT. Integra documentos do SupaDrive, uploads e outras fontes, com tradução/explicação/resumo via KnexAI (mock por enquanto).

## Estrutura
- `web/`: UI Next.js (shell, componentes, hooks e rotas de API mock para tradução/explicação/resumo/conceitos).
- `src/`: serviço Fastify de healthcheck/stub para evolução futura.

## Executar serviço (stub)
```bash
cd vioread
npm install
npm run dev
```
Porta configurável via `VIOREAD_PORT` (padrão 3600), health em `/health`.

## UI (Next.js)
- Rota `/vioread` via wrappers em `app/vioread/page.tsx` -> `vioread/web/page.tsx`.
- APIs mockadas em `/api/vioread/*` para tradução/explicação/etc.

TODO
- Integrar SupaDrive real para origem de documentos.
- Plugar KnexAI para tradução/explicações.
- Exportar resumos para KnexDocs e materiais para VioClass.
