# VioHub

Aplicação de vídeos e produção audiovisual do KnexIT Workspace. Reúne pipeline de edição colaborativa, aprovação de roteiros e entrega de conteúdos para `supadrive`.

## Estrutura
- `src/`: bootstrap da aplicação (Express/Fastify).
- `controllers/`: fluxos de produção, revisão e postagem.
- `routes/`: rotas HTTP expostas para o portal.
- `models/`: entidades (projetos, clipes, timeline, assets).
- `services/`: integrações com AI, encoding e armazenamento.

## Execução
```bash
cd viohub
npm install
npm run dev
```

