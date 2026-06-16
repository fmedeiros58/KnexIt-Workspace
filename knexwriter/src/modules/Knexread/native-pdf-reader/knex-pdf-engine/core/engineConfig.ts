import type { KnexPdfRenderQuality } from "./engineTypes";

export const KNEX_PDF_ENGINE_NAME = "KnexPDF Engine";

/**
 * Limites públicos do viewer.
 *
 * Regra estrutural:
 * - 0.1  = 10%
 * - 1.0  = 100%
 * - 20.0 = 2000%
 *
 * O leitor comum não deve expor 8000%, porque isso cria risco de estouro
 * de memória, tela preta, canvas inválido, filas de tiles enormes e cache
 * excessivo. Caso o projeto precise testar zoom extremo no futuro, isso deve
 * ficar isolado em modo técnico/debug, nunca no fluxo padrão do usuário.
 */
export const KNEX_PDF_MIN_ZOOM = 0.1;
export const KNEX_PDF_MAX_ZOOM = 20;

/**
 * Limite técnico reservado.
 *
 * Não usar este valor em toolbar, presets, wheel, pinch, fit, renderização
 * comum, cacheKey ou cálculo de tiles do viewer padrão.
 *
 * Ele existe apenas para experimentos isolados, auditoria visual ou debug
 * controlado, desde que o chamador aplique suas próprias travas de memória.
 */
export const KNEX_PDF_TECHNICAL_DEBUG_MAX_ZOOM = 80;

/**
 * Presets oficiais do viewer comum.
 *
 * Mantidos em harmonia com o ZoomController:
 * - sobem de modo progressivo;
 * - incluem escalas altas úteis para leitura;
 * - encerram em 2000%.
 */
export const KNEX_PDF_ZOOM_PRESETS = [
  10,
  25,
  50,
  75,
  100,
  125,
  150,
  175,
  200,
  250,
  300,
  350,
  400,
  500,
  600,
  800,
  1000,
  1200,
  1600,
  2000,
] as const;

/**
 * Multiplicadores de qualidade.
 *
 * O objetivo aqui não é forçar nitidez por bitmap extremo, mas preservar
 * equilíbrio entre qualidade, fluidez e memória. A nitidez fina do texto deve
 * vir preferencialmente da camada HTML/text layer, e não de outputScale alto
 * no canvas.
 */
export const KNEX_PDF_QUALITY_MULTIPLIER: Record<KnexPdfRenderQuality, number> = {
  draft: 1,
  standard: 1.35,
  high: 2,
  ultra: 3,
  extreme: 4,
};

/**
 * Limite de pixels por canvas/render.
 *
 * Mesmo usando tiles, este limite serve como trava de segurança para qualquer
 * caminho que ainda tente criar bitmap grande demais. O tile renderer deve
 * dividir a página antes de chegar nesses tetos.
 *
 * Estimativa de memória RGBA:
 * - 16M px  ≈ 64 MB
 * - 28M px  ≈ 112 MB
 * - 44M px  ≈ 176 MB
 * - 64M px  ≈ 256 MB
 * - 80M px  ≈ 320 MB
 *
 * Como o navegador pode manter buffers intermediários, cache e ImageBitmap,
 * não é seguro trabalhar com tetos muito próximos do limite físico.
 */
export const KNEX_PDF_MAX_CANVAS_PIXELS: Record<KnexPdfRenderQuality, number> = {
  draft: 16_000_000,
  standard: 28_000_000,
  high: 44_000_000,
  ultra: 64_000_000,
  extreme: 80_000_000,
};

/**
 * Output scale máximo.
 *
 * Antes estava em 12, o que é agressivo demais para zoom alto. Na arquitetura
 * atual, a qualidade deve vir de:
 * - separação visualZoom/renderZoom;
 * - renderização final apenas após settle;
 * - tiles;
 * - text layer HTML para texto nítido.
 *
 * Por isso, 4 é um teto mais equilibrado e coerente com HiDPI sem abrir espaço
 * para bitmap gigantesco.
 */
export const KNEX_PDF_MAX_OUTPUT_SCALE = 4;

/**
 * Lado máximo de canvas.
 *
 * 32767 é um teto técnico comum em alguns ambientes, mas deixar esse valor como
 * limite operacional aumenta o risco de canvas inválido/tela preta. O valor
 * abaixo força divisão por tiles antes de chegar numa dimensão perigosa.
 */
export const KNEX_PDF_MAX_CANVAS_SIDE = 16384;

export const KNEX_PDF_DEFAULT_PAGE_GAP = 24;

/**
 * Constantes auxiliares para renderizadores/cache que precisem calcular
 * orçamento de memória sem repetir números mágicos.
 */
export const KNEX_PDF_BYTES_PER_RGBA_PIXEL = 4;

export const KNEX_PDF_MAX_CANVAS_BYTES: Record<KnexPdfRenderQuality, number> = {
  draft: KNEX_PDF_MAX_CANVAS_PIXELS.draft * KNEX_PDF_BYTES_PER_RGBA_PIXEL,
  standard: KNEX_PDF_MAX_CANVAS_PIXELS.standard * KNEX_PDF_BYTES_PER_RGBA_PIXEL,
  high: KNEX_PDF_MAX_CANVAS_PIXELS.high * KNEX_PDF_BYTES_PER_RGBA_PIXEL,
  ultra: KNEX_PDF_MAX_CANVAS_PIXELS.ultra * KNEX_PDF_BYTES_PER_RGBA_PIXEL,
  extreme: KNEX_PDF_MAX_CANVAS_PIXELS.extreme * KNEX_PDF_BYTES_PER_RGBA_PIXEL,
};
