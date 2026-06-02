# KnexRead Tile Renderer Status

Atualizado em 2026-06-01.

Nota de arquitetura: tiles continuam preservados como caminho legado/fallback.
O novo pipeline modular `single-canvas-html-text` pode ser ativado por
`globalThis.KNEX_PDF_USE_MODULAR_PAGE_PIPELINE = true`. Ele usa canvas unico
como base visual e camada HTML/CSS para texto quando os blocos textuais estao
disponiveis.

## Estado Oficial

O render visual legado do KnexRead segue o caminho de tiles:

- `tiled-canvas`: render local por tiles.
- `server-tiled`: render por rota server-side, com fallback para `tiled-canvas`.
- `auto-professional`: tenta `server-tiled`; se indisponivel, usa `tiled-canvas`.

O modo `page-canvas` antigo e as camadas visuais antigas foram removidos do fluxo vivo. A selecao, busca, citacao e acessibilidade continuam na camada semantica transparente.
O substituto modular e `single-canvas-html-text`, nao o antigo `page-canvas`.

## Mudancas Recentes

- `PdfPageView` renderiza `PdfTiledPageCanvas` como render visual unico.
- `PdfPageCanvas`, raster layers e visual text layers antigos foram removidos.
- `resolveTileRenderMode` nao retorna mais `page-canvas`.
- Fallback de servidor passa apenas para `tiled-canvas`.
- Rotas server-side existem em `/api/knexread/render/tile` e `/api/knexread/render/tiles/batch`.
- Cache local de tiles existe em memoria no navegador.
- Identidade visual de layer e cache de tile nao dependem mais de `finalRenderVersion`.
- Warmup/preload agora entram no caminho de render sempre que o Shell marcar a pagina para render.
- Margem de observacao do viewport foi ampliada para antecipar paginas adjacentes.
- Qualidade final dos tiles foi elevada para texto pequeno.
- A janela de render foi limitada para evitar saturacao de CPU/memoria.
- Preload distante nao renderiza durante scroll/zoom.
- Ambiente local deve usar `tiled-canvas` ate o renderer server-side virar servico isolado.
- Corrigido: `shouldRenderPageDuringZoom` nao pode liberar render para todas as paginas em repouso.
- `TileRenderScheduler` passou a controlar o render local de tiles com concorrencia baixa.
- Quando `.env.local` fixa `tiled-canvas`, `localStorage` nao pode forcar `server-tiled/auto-professional`.
- Paginas com canvas ja montado sao mantidas brevemente durante scroll/zoom para evitar skeleton branco.
- Tiles ja desenhados continuam visiveis enquanto revalidam ou renderizam substituto.
- Mudancas de prioridade nao reexecutam render de tile ja montado.
- A prioridade de tiles volta a subir quando a pagina chega ao palco, sem esconder bitmap ja desenhado.
- Concorrencia local de tiles ajustada para 2 para acelerar chegada de texto no palco.
- Grid visual final ajustado para 32 tiles por pagina em grade 16x2.
- Output scale final dos tiles mira escala efetiva 5.0, com piso operacional de auditoria em 4.75 e teto inicial 6.0.
- Auditoria de tiles disponivel em `window.__KNEX_PAGE_TILE_COUNT_AUDIT__`.

## Antirregressao

Estas regras so devem mudar se o usuario pedir explicitamente:

- Nao reintroduzir `PdfPageCanvas` como caminho visual.
- Nao reintroduzir `page-canvas` como fallback visual.
- Nao usar text layer HTML para redesenhar texto visual.
- Nao limpar uma pagina/tile antes de haver tile substituto pronto.
- Nao invalidar cache de tile por versoes transacionais que nao mudam geometria, zoom, qualidade, fase ou backend.
- Paginas adjacentes ao viewport devem ser renderizadas antecipadamente para evitar paginas brancas durante rolagem.
- Server-side deve falhar para `tiled-canvas`, nunca para pagina branca.
- O perfil visual de alta qualidade deve preservar 32 tiles por pagina, grade 16x2, overlap 2px e escala efetiva minima de 4.75.

## Situacao Do Server-Side

Implementado parcialmente:

- API Next.js `POST /api/knexread/render/tile`.
- API Next.js `POST /api/knexread/render/tiles/batch`.
- Renderer server-side baseado em `pdfjs-dist` + `@napi-rs/canvas`.

Nao esta completo como infraestrutura nativa dedicada:

- Nao ha deployment Kubernetes ativo neste modulo.
- Nao ha fila Redis/BullMQ ativa neste modulo.
- Nao ha metadados Supabase/Postgres ativos para `knexread_tile_cache`.
- `ServerTileCacheClient` e cache local sao caches em memoria.
- O encoder server-side so roda com `KNEXREAD_TILE_NATIVE_ENCODER_ENABLED=true` e dependencia nativa disponivel.

## Proximos Ajustes Prioritarios

- Manter camada visual antiga durante zoom/scroll ate a nova camada estar pronta.
- Medir no browser se a antecipacao atual elimina paginas brancas em documentos longos.
- Medir CPU/memoria com documento longo antes de reativar `auto-professional` como padrao local.
- Evoluir server-side para cache persistente, DB e Kubernetes quando a base visual estiver estabilizada.
