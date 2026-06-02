export type PageBitmapCacheKeyInput = {
  /**
   * Identificador do documento/sessão.
   * Use quando o cache puder sobreviver à troca de PDF.
   */
  documentId?: string;

  backend?: string;

  pageNumber: number;
  region?: "page" | "tile" | string;
  tileId?: string;
  tileX?: number;
  tileY?: number;

  /**
   * Escala lógica do PDF.js/PDFium.
   * Exemplo:
   * 1 = 100%
   * 1.5 = 150%
  */
  renderScale: number;

  /**
   * Bucket normalizado de zoom. Evita criar entradas para cada microvariacao.
   */
  zoomBucket?: number;

  devicePixelRatio?: number;
  renderMode?: string;

  /**
   * Escala HiDPI do bitmap.
   * Exemplo:
   * cssWidth 1000, width 3000 => outputScale 3.
   */
  outputScale: number;

  /**
   * Tamanho CSS/visual da página.
   */
  cssWidth: number;
  cssHeight: number;

  /**
   * Tamanho real do bitmap.
   */
  width: number;
  height: number;

  /**
   * Qualidade usada no render.
   */
  quality?: string;

  /**
   * Fase visual do bitmap.
   * Evita reaproveitar preview interativo como se fosse render final.
   */
  renderPhase?: string;

  /**
   * Rotação da página, se existir.
   */
  rotation?: number;

  /**
   * Versão de render/layout.
   * Use quando quiser invalidar renders antigos depois de zoom, resize ou troca
   * de qualidade.
   */
  renderVersion?: number;

  /**
   * Versão do backend ativo. Impede reaproveitar bitmap depois de troca ou
   * recuperação de backend.
   */
  backendVersion?: number;
};

export type PageBitmapCacheKeyMetadata = {
  documentId: string;
  backend: string;
  pageNumber: number;
  region: string;
  tileId: string;
  tileX: number;
  tileY: number;
  renderScale: number;
  zoomBucket: number;
  devicePixelRatio: number;
  renderMode: string;
  outputScale: number;
  cssWidth: number;
  cssHeight: number;
  width: number;
  height: number;
  bitmapCssRatio: number;
  quality: string;
  qualityRank: number;
  renderPhase: string;
  renderPhaseRank: number;
  rotation: number;
  renderVersion: number;
  backendVersion: number;
};

export type PageBitmapCacheEntry<TValue> = {
  key: string;
  value: TValue;
  bytes: number;
  createdAt: number;
  lastUsedAt: number;
  hits: number;
  metadata?: PageBitmapCacheKeyMetadata;
};

export type PageBitmapCacheEntryRequirements = {
  documentId?: string;
  backend?: string;
  pageNumber?: number;
  region?: string;
  tileId?: string;
  tileX?: number;
  tileY?: number;
  renderScale?: number;
  zoomBucket?: number;
  devicePixelRatio?: number;
  renderMode?: string;
  outputScale?: number;
  cssWidth?: number;
  cssHeight?: number;
  width?: number;
  height?: number;
  quality?: string;
  renderPhase?: string;
  rotation?: number;
  renderVersion?: number;
  backendVersion?: number;

  /**
   * Quando informado, impede devolver bitmap com outputScale menor.
   */
  minOutputScale?: number;

  /**
   * Quando informado, impede devolver bitmap com razão bitmap/CSS menor.
   */
  minBitmapCssRatio?: number;

  /**
   * Quando informado, impede devolver bitmap de qualidade inferior.
   */
  minQuality?: string;

  /**
   * Quando informado, impede devolver bitmap de fase inferior.
   */
  minRenderPhase?: string;

  /**
   * Quando true, exige que a fase seja exatamente igual.
   * Útil para impedir preview de substituir settled-final.
   */
  exactRenderPhase?: boolean;

  /**
   * Quando true, exige renderVersion exatamente igual.
   */
  exactRenderVersion?: boolean;

  /**
   * Quando true, exige backendVersion exatamente igual.
   */
  exactBackendVersion?: boolean;

  /**
   * Tolerância para renderScale/outputScale.
   */
  numericTolerance?: number;
};

export type PageBitmapCacheOptions<TValue> = {
  /**
   * Quantidade máxima de entradas no cache.
   */
  maxEntries: number;

  /**
   * Orçamento máximo de memória aproximada.
   * Se omitido, limita apenas por quantidade de entradas.
   */
  maxBytes?: number;

  /**
   * Função opcional para estimar bytes do valor.
   * Se não for informada, o cache tenta estimar HTMLCanvasElement/ImageBitmap.
   */
  estimateBytes?: (value: TValue) => number;

  /**
   * Função opcional para liberar recurso.
   * Útil para ImageBitmap.close(), canvas temporário etc.
   */
  dispose?: (value: TValue, key: string) => void;
};

const DEFAULT_NUMERIC_TOLERANCE = 0.0001;

const QUALITY_RANK: Record<string, number> = {
  economy: 0,
  draft: 1,
  standard: 2,
  auto: 3,
  high: 4,
  "very-high": 5,
  ultra: 5,
  extreme: 6,
};

const RENDER_PHASE_RANK: Record<string, number> = {
  "interactive-preview": 1,
  "warmup-preview": 2,
  "settled-final": 3,
};

function safeNumber(
  value: number | null | undefined,
  fallback = 0,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function normalizeNumber(value: number, precision = 4): string {
  const factor = 10 ** precision;
  return String(Math.round(safeNumber(value, 0) * factor) / factor);
}

function normalizePositiveInteger(value: number, fallback = 1): number {
  return Math.max(1, Math.round(safeNumber(value, fallback)));
}

function normalizePageNumber(pageNumber: number): number {
  return normalizePositiveInteger(pageNumber, 1);
}

function normalizeRegion(value: string | undefined): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : "page";
}

function normalizeTileId(value: string | undefined): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : "full";
}

function normalizeTileIndex(value: number | undefined): number {
  return Math.max(0, Math.floor(safeNumber(value, 0)));
}

function normalizeQuality(value: string | undefined): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : "auto";
}

function normalizeRenderMode(value: string | undefined): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : "bitmap-only";
}

function normalizeRenderPhase(value: string | undefined): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : "settled-final";
}

function getQualityRank(quality: string | undefined): number {
  return QUALITY_RANK[normalizeQuality(quality)] ?? QUALITY_RANK.auto ?? 3;
}

function getRenderPhaseRank(renderPhase: string | undefined): number {
  return (
    RENDER_PHASE_RANK[normalizeRenderPhase(renderPhase)] ??
    RENDER_PHASE_RANK["settled-final"] ??
    3
  );
}

function getNow() {
  return Date.now();
}

function estimateCanvasBytes(value: unknown): number | undefined {
  if (
    typeof HTMLCanvasElement !== "undefined" &&
    value instanceof HTMLCanvasElement
  ) {
    return Math.max(0, value.width * value.height * 4);
  }

  if (
    typeof OffscreenCanvas !== "undefined" &&
    value instanceof OffscreenCanvas
  ) {
    return Math.max(0, value.width * value.height * 4);
  }

  if (typeof ImageBitmap !== "undefined" && value instanceof ImageBitmap) {
    return Math.max(0, value.width * value.height * 4);
  }

  return undefined;
}

function defaultEstimateBytes(value: unknown): number {
  return estimateCanvasBytes(value) ?? 0;
}

function getStringPart(key: string, name: string): string | undefined {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = key.match(new RegExp(`(?:^|\\|)${escapedName}=([^|]*)`));

  return match?.[1];
}

function getNumberPart(
  key: string,
  name: string,
  fallback = 0,
): number {
  const raw = getStringPart(key, name);
  if (!raw) return fallback;

  const parsed = Number.parseFloat(raw);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function getDimensionPart(
  key: string,
  name: string,
): { width: number; height: number } | null {
  const raw = getStringPart(key, name);
  if (!raw) return null;

  const match = raw.match(/^(\d+)x(\d+)$/);
  if (!match) return null;

  const width = Number.parseInt(match[1], 10);
  const height = Number.parseInt(match[2], 10);

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return null;
  }

  return {
    width: Math.max(1, width),
    height: Math.max(1, height),
  };
}

function calculateBitmapCssRatio(input: {
  width: number;
  height: number;
  cssWidth: number;
  cssHeight: number;
}): number {
  const ratioX = safeNumber(input.width, 1) / Math.max(1, input.cssWidth);
  const ratioY = safeNumber(input.height, 1) / Math.max(1, input.cssHeight);

  return Math.min(ratioX, ratioY);
}

export function parsePageBitmapCacheKey(
  key: string,
): PageBitmapCacheKeyMetadata | undefined {
  const css = getDimensionPart(key, "css");
  const bmp = getDimensionPart(key, "bmp");

  if (!css || !bmp) {
    return undefined;
  }

  const quality = normalizeQuality(getStringPart(key, "q"));
  const renderPhase = normalizeRenderPhase(getStringPart(key, "phase"));

  return {
    documentId: getStringPart(key, "doc") ?? "default",
    backend: getStringPart(key, "be") ?? "unknown",
    pageNumber: Math.max(1, Math.floor(getNumberPart(key, "p", 1))),
    region: normalizeRegion(getStringPart(key, "region")),
    tileId: normalizeTileId(getStringPart(key, "tile")),
    tileX: normalizeTileIndex(getNumberPart(key, "tx", 0)),
    tileY: normalizeTileIndex(getNumberPart(key, "ty", 0)),
    renderScale: getNumberPart(key, "rs", 1),
    zoomBucket: getNumberPart(key, "zb", getNumberPart(key, "rs", 1)),
    devicePixelRatio: getNumberPart(key, "dpr", 1),
    renderMode: normalizeRenderMode(getStringPart(key, "mode")),
    outputScale: getNumberPart(key, "os", 1),
    cssWidth: css.width,
    cssHeight: css.height,
    width: bmp.width,
    height: bmp.height,
    bitmapCssRatio: calculateBitmapCssRatio({
      width: bmp.width,
      height: bmp.height,
      cssWidth: css.width,
      cssHeight: css.height,
    }),
    quality,
    qualityRank: getQualityRank(quality),
    renderPhase,
    renderPhaseRank: getRenderPhaseRank(renderPhase),
    rotation: getNumberPart(key, "rot", 0),
    renderVersion: Math.floor(getNumberPart(key, "rv", 0)),
    backendVersion: Math.floor(getNumberPart(key, "bv", 0)),
  };
}

/**
 * Cria uma chave segura para cache de bitmap.
 *
 * Ponto crítico:
 * NÃO use apenas pageNumber como chave.
 *
 * Uma mesma página pode ter bitmaps diferentes conforme:
 * - documento;
 * - backend;
 * - zoom/renderScale;
 * - outputScale;
 * - qualidade;
 * - tamanho CSS;
 * - tamanho real do bitmap;
 * - fase de render;
 * - rotação;
 * - versão de render;
 * - versão de backend.
 *
 * Se a chave for fraca, o cache pode devolver uma página antiga em baixa
 * resolução depois do zoom, mantendo o PDF borrado.
 */
export function createPageBitmapCacheKey(
  input: PageBitmapCacheKeyInput,
): string {
  return [
    input.documentId ? `doc=${input.documentId}` : "doc=default",
    `be=${input.backend ?? "unknown"}`,
    `p=${normalizePageNumber(input.pageNumber)}`,
    `region=${normalizeRegion(input.region)}`,
    `tile=${normalizeTileId(input.tileId)}`,
    `tx=${normalizeTileIndex(input.tileX)}`,
    `ty=${normalizeTileIndex(input.tileY)}`,
    `rs=${normalizeNumber(input.renderScale, 4)}`,
    `zb=${normalizeNumber(input.zoomBucket ?? input.renderScale, 2)}`,
    `dpr=${normalizeNumber(input.devicePixelRatio ?? 1, 2)}`,
    `mode=${normalizeRenderMode(input.renderMode)}`,
    `os=${normalizeNumber(input.outputScale, 4)}`,
    `css=${normalizePositiveInteger(input.cssWidth)}x${normalizePositiveInteger(input.cssHeight)}`,
    `bmp=${normalizePositiveInteger(input.width)}x${normalizePositiveInteger(input.height)}`,
    `ratio=${normalizeNumber(
      calculateBitmapCssRatio({
        width: normalizePositiveInteger(input.width),
        height: normalizePositiveInteger(input.height),
        cssWidth: normalizePositiveInteger(input.cssWidth),
        cssHeight: normalizePositiveInteger(input.cssHeight),
      }),
      4,
    )}`,
    `q=${normalizeQuality(input.quality)}`,
    `phase=${normalizeRenderPhase(input.renderPhase)}`,
    `rot=${normalizeNumber(input.rotation ?? 0, 2)}`,
    `rv=${input.renderVersion ?? 0}`,
    `bv=${input.backendVersion ?? 0}`,
  ].join("|");
}

function metadataFromInput(
  input: PageBitmapCacheKeyInput,
): PageBitmapCacheKeyMetadata {
  const cssWidth = normalizePositiveInteger(input.cssWidth);
  const cssHeight = normalizePositiveInteger(input.cssHeight);
  const width = normalizePositiveInteger(input.width);
  const height = normalizePositiveInteger(input.height);
  const quality = normalizeQuality(input.quality);
  const renderPhase = normalizeRenderPhase(input.renderPhase);

  return {
    documentId: input.documentId ?? "default",
    backend: input.backend ?? "unknown",
    pageNumber: normalizePageNumber(input.pageNumber),
    region: normalizeRegion(input.region),
    tileId: normalizeTileId(input.tileId),
    tileX: normalizeTileIndex(input.tileX),
    tileY: normalizeTileIndex(input.tileY),
    renderScale: safeNumber(input.renderScale, 1),
    zoomBucket: safeNumber(input.zoomBucket, safeNumber(input.renderScale, 1)),
    devicePixelRatio: safeNumber(input.devicePixelRatio, 1),
    renderMode: normalizeRenderMode(input.renderMode),
    outputScale: safeNumber(input.outputScale, 1),
    cssWidth,
    cssHeight,
    width,
    height,
    bitmapCssRatio: calculateBitmapCssRatio({
      width,
      height,
      cssWidth,
      cssHeight,
    }),
    quality,
    qualityRank: getQualityRank(quality),
    renderPhase,
    renderPhaseRank: getRenderPhaseRank(renderPhase),
    rotation: safeNumber(input.rotation, 0),
    renderVersion: Math.floor(safeNumber(input.renderVersion, 0)),
    backendVersion: Math.floor(safeNumber(input.backendVersion, 0)),
  };
}

function areNumbersClose(
  a: number,
  b: number,
  tolerance = DEFAULT_NUMERIC_TOLERANCE,
): boolean {
  return Math.abs(safeNumber(a, 0) - safeNumber(b, 0)) <= tolerance;
}

function doesMetadataSatisfyRequirements(input: {
  metadata: PageBitmapCacheKeyMetadata | undefined;
  requirements?: PageBitmapCacheEntryRequirements;
}): boolean {
  const { metadata, requirements } = input;

  if (!requirements) {
    return true;
  }

  if (!metadata) {
    return false;
  }

  const tolerance = Math.max(
    0,
    safeNumber(requirements.numericTolerance, DEFAULT_NUMERIC_TOLERANCE),
  );

  if (
    requirements.documentId !== undefined &&
    metadata.documentId !== requirements.documentId
  ) {
    return false;
  }

  if (
    requirements.backend !== undefined &&
    metadata.backend !== requirements.backend
  ) {
    return false;
  }

  if (
    requirements.pageNumber !== undefined &&
    metadata.pageNumber !== normalizePageNumber(requirements.pageNumber)
  ) {
    return false;
  }

  if (
    requirements.region !== undefined &&
    metadata.region !== normalizeRegion(requirements.region)
  ) {
    return false;
  }

  if (
    requirements.tileId !== undefined &&
    metadata.tileId !== normalizeTileId(requirements.tileId)
  ) {
    return false;
  }

  if (
    requirements.tileX !== undefined &&
    metadata.tileX !== normalizeTileIndex(requirements.tileX)
  ) {
    return false;
  }

  if (
    requirements.tileY !== undefined &&
    metadata.tileY !== normalizeTileIndex(requirements.tileY)
  ) {
    return false;
  }

  if (
    requirements.renderScale !== undefined &&
    !areNumbersClose(metadata.renderScale, requirements.renderScale, tolerance)
  ) {
    return false;
  }

  if (
    requirements.zoomBucket !== undefined &&
    !areNumbersClose(metadata.zoomBucket, requirements.zoomBucket, tolerance)
  ) {
    return false;
  }

  if (
    requirements.devicePixelRatio !== undefined &&
    !areNumbersClose(
      metadata.devicePixelRatio,
      requirements.devicePixelRatio,
      tolerance,
    )
  ) {
    return false;
  }

  if (
    requirements.renderMode !== undefined &&
    metadata.renderMode !== normalizeRenderMode(requirements.renderMode)
  ) {
    return false;
  }

  if (
    requirements.outputScale !== undefined &&
    !areNumbersClose(metadata.outputScale, requirements.outputScale, tolerance)
  ) {
    return false;
  }

  if (
    requirements.cssWidth !== undefined &&
    metadata.cssWidth !== normalizePositiveInteger(requirements.cssWidth)
  ) {
    return false;
  }

  if (
    requirements.cssHeight !== undefined &&
    metadata.cssHeight !== normalizePositiveInteger(requirements.cssHeight)
  ) {
    return false;
  }

  if (
    requirements.width !== undefined &&
    metadata.width !== normalizePositiveInteger(requirements.width)
  ) {
    return false;
  }

  if (
    requirements.height !== undefined &&
    metadata.height !== normalizePositiveInteger(requirements.height)
  ) {
    return false;
  }

  if (
    requirements.rotation !== undefined &&
    !areNumbersClose(metadata.rotation, requirements.rotation, tolerance)
  ) {
    return false;
  }

  if (
    requirements.renderVersion !== undefined &&
    requirements.exactRenderVersion === true &&
    metadata.renderVersion !== Math.floor(safeNumber(requirements.renderVersion, 0))
  ) {
    return false;
  }

  if (
    requirements.renderVersion !== undefined &&
    requirements.exactRenderVersion !== true &&
    metadata.renderVersion < Math.floor(safeNumber(requirements.renderVersion, 0))
  ) {
    return false;
  }

  if (
    requirements.backendVersion !== undefined &&
    requirements.exactBackendVersion === true &&
    metadata.backendVersion !== Math.floor(safeNumber(requirements.backendVersion, 0))
  ) {
    return false;
  }

  if (
    requirements.backendVersion !== undefined &&
    requirements.exactBackendVersion !== true &&
    metadata.backendVersion < Math.floor(safeNumber(requirements.backendVersion, 0))
  ) {
    return false;
  }

  if (
    requirements.renderPhase !== undefined &&
    requirements.exactRenderPhase === true &&
    metadata.renderPhase !== normalizeRenderPhase(requirements.renderPhase)
  ) {
    return false;
  }

  if (
    requirements.minRenderPhase !== undefined &&
    metadata.renderPhaseRank <
      getRenderPhaseRank(requirements.minRenderPhase)
  ) {
    return false;
  }

  if (
    requirements.minQuality !== undefined &&
    metadata.qualityRank < getQualityRank(requirements.minQuality)
  ) {
    return false;
  }

  if (
    requirements.quality !== undefined &&
    metadata.qualityRank < getQualityRank(requirements.quality)
  ) {
    return false;
  }

  if (
    requirements.minOutputScale !== undefined &&
    metadata.outputScale + tolerance < requirements.minOutputScale
  ) {
    return false;
  }

  if (
    requirements.minBitmapCssRatio !== undefined &&
    metadata.bitmapCssRatio + tolerance < requirements.minBitmapCssRatio
  ) {
    return false;
  }

  return true;
}

function compareBitmapQuality(
  a: PageBitmapCacheKeyMetadata | undefined,
  b: PageBitmapCacheKeyMetadata | undefined,
): number {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;

  const phaseDiff = a.renderPhaseRank - b.renderPhaseRank;
  if (phaseDiff !== 0) return phaseDiff;

  const qualityDiff = a.qualityRank - b.qualityRank;
  if (qualityDiff !== 0) return qualityDiff;

  const ratioDiff = a.bitmapCssRatio - b.bitmapCssRatio;
  if (Math.abs(ratioDiff) > DEFAULT_NUMERIC_TOLERANCE) {
    return ratioDiff;
  }

  const outputScaleDiff = a.outputScale - b.outputScale;
  if (Math.abs(outputScaleDiff) > DEFAULT_NUMERIC_TOLERANCE) {
    return outputScaleDiff;
  }

  const renderVersionDiff = a.renderVersion - b.renderVersion;
  if (renderVersionDiff !== 0) return renderVersionDiff;

  const backendVersionDiff = a.backendVersion - b.backendVersion;
  if (backendVersionDiff !== 0) return backendVersionDiff;

  return 0;
}

/**
 * Cache LRU para bitmaps de páginas.
 *
 * Compatível com a chamada antiga:
 *
 *   new PageBitmapCache<T>(20)
 *
 * E com a chamada nova:
 *
 *   new PageBitmapCache<T>({
 *     maxEntries: 20,
 *     maxBytes: 256 * 1024 * 1024,
 *     dispose: (bitmap) => bitmap.close?.(),
 *   })
 */
export class PageBitmapCache<TValue> {
  private readonly values = new Map<string, PageBitmapCacheEntry<TValue>>();
  private readonly maxEntries: number;
  private readonly maxBytes?: number;
  private readonly estimateBytes: (value: TValue) => number;
  private readonly disposeValue?: (value: TValue, key: string) => void;
  private totalBytes = 0;

  constructor(options: number | PageBitmapCacheOptions<TValue>) {
    if (typeof options === "number") {
      this.maxEntries = Math.max(1, Math.floor(options));
      this.estimateBytes = defaultEstimateBytes as (value: TValue) => number;
      return;
    }

    this.maxEntries = Math.max(1, Math.floor(options.maxEntries));
    this.maxBytes =
      typeof options.maxBytes === "number"
        ? Math.max(0, Math.floor(options.maxBytes))
        : undefined;
    this.estimateBytes =
      options.estimateBytes ??
      (defaultEstimateBytes as (value: TValue) => number);
    this.disposeValue = options.dispose;
  }

  get size() {
    return this.values.size;
  }

  get bytes() {
    return this.totalBytes;
  }

  get maxSize() {
    return this.maxEntries;
  }

  has(key: string) {
    return this.values.has(key);
  }

  hasUsable(key: string, requirements?: PageBitmapCacheEntryRequirements) {
    const entry = this.values.get(key);

    return doesMetadataSatisfyRequirements({
      metadata: entry?.metadata ?? parsePageBitmapCacheKey(key),
      requirements,
    });
  }

  get(key: string, requirements?: PageBitmapCacheEntryRequirements) {
    const entry = this.values.get(key);

    if (!entry) {
      return undefined;
    }

    if (
      !doesMetadataSatisfyRequirements({
        metadata: entry.metadata ?? parsePageBitmapCacheKey(key),
        requirements,
      })
    ) {
      return undefined;
    }

    /**
     * LRU: tocar a entrada move para o fim do Map.
     */
    this.values.delete(key);

    const touchedEntry: PageBitmapCacheEntry<TValue> = {
      ...entry,
      lastUsedAt: getNow(),
      hits: entry.hits + 1,
    };

    this.values.set(key, touchedEntry);

    return touchedEntry.value;
  }

  peek(key: string, requirements?: PageBitmapCacheEntryRequirements) {
    const entry = this.values.get(key);

    if (!entry) {
      return undefined;
    }

    if (
      !doesMetadataSatisfyRequirements({
        metadata: entry.metadata ?? parsePageBitmapCacheKey(key),
        requirements,
      })
    ) {
      return undefined;
    }

    return entry.value;
  }

  getEntry(key: string, requirements?: PageBitmapCacheEntryRequirements) {
    const entry = this.values.get(key);

    if (!entry) {
      return undefined;
    }

    if (
      !doesMetadataSatisfyRequirements({
        metadata: entry.metadata ?? parsePageBitmapCacheKey(key),
        requirements,
      })
    ) {
      return undefined;
    }

    return entry;
  }

  /**
   * Busca o melhor bitmap disponível para a mesma página.
   *
   * Use isto quando o chamador quiser evitar regressão visual:
   * - não devolve preview se foi pedido settled-final;
   * - não devolve outputScale menor que o mínimo;
   * - escolhe a entrada com maior fase, qualidade, ratio e versão.
   */
  getBest(requirements: PageBitmapCacheEntryRequirements) {
    let bestEntry: PageBitmapCacheEntry<TValue> | undefined;

    for (const entry of this.values.values()) {
      const metadata = entry.metadata ?? parsePageBitmapCacheKey(entry.key);

      if (
        !doesMetadataSatisfyRequirements({
          metadata,
          requirements,
        })
      ) {
        continue;
      }

      if (
        !bestEntry ||
        compareBitmapQuality(
          metadata,
          bestEntry.metadata ?? parsePageBitmapCacheKey(bestEntry.key),
        ) > 0
      ) {
        bestEntry = entry;
      }
    }

    if (!bestEntry) {
      return undefined;
    }

    return this.get(bestEntry.key, requirements);
  }

  getBestEntry(requirements: PageBitmapCacheEntryRequirements) {
    let bestEntry: PageBitmapCacheEntry<TValue> | undefined;

    for (const entry of this.values.values()) {
      const metadata = entry.metadata ?? parsePageBitmapCacheKey(entry.key);

      if (
        !doesMetadataSatisfyRequirements({
          metadata,
          requirements,
        })
      ) {
        continue;
      }

      if (
        !bestEntry ||
        compareBitmapQuality(
          metadata,
          bestEntry.metadata ?? parsePageBitmapCacheKey(bestEntry.key),
        ) > 0
      ) {
        bestEntry = entry;
      }
    }

    return bestEntry;
  }

  set(key: string, value: TValue, options?: { bytes?: number }) {
    const existing = this.values.get(key);
    const nextMetadata = parsePageBitmapCacheKey(key);

    if (existing) {
      const existingMetadata =
        existing.metadata ?? parsePageBitmapCacheKey(existing.key);

      /**
       * Proteção contra regressão:
       * se, por algum erro de chamada, a mesma chave for usada para substituir
       * um bitmap melhor por outro pior, mantemos o melhor.
       */
      if (compareBitmapQuality(existingMetadata, nextMetadata) > 0) {
        if (existing.value !== value) {
          this.disposeSafely(value, key);
        }

        return;
      }

      this.values.delete(key);
      this.totalBytes = Math.max(0, this.totalBytes - existing.bytes);

      if (existing.value !== value) {
        this.disposeSafely(existing.value, key);
      }
    }

    const bytes = Math.max(
      0,
      Math.floor(
        typeof options?.bytes === "number"
          ? options.bytes
          : this.estimateBytes(value),
      ),
    );

    const now = getNow();

    this.values.set(key, {
      key,
      value,
      bytes,
      createdAt: now,
      lastUsedAt: now,
      hits: 0,
      metadata: nextMetadata,
    });

    this.totalBytes += bytes;
    this.prune();
  }

  setByInput(
    input: PageBitmapCacheKeyInput,
    value: TValue,
    options?: { bytes?: number },
  ) {
    const key = createPageBitmapCacheKey(input);
    this.set(key, value, options);
    return key;
  }

  getByInput(
    input: PageBitmapCacheKeyInput,
    requirements?: PageBitmapCacheEntryRequirements,
  ) {
    return this.get(createPageBitmapCacheKey(input), requirements);
  }

  delete(key: string) {
    const existing = this.values.get(key);

    if (!existing) {
      return false;
    }

    this.values.delete(key);
    this.totalBytes = Math.max(0, this.totalBytes - existing.bytes);
    this.disposeSafely(existing.value, key);

    return true;
  }

  /**
   * Remove todas as entradas cujo predicado retorne true.
   */
  deleteWhere(predicate: (entry: PageBitmapCacheEntry<TValue>) => boolean) {
    let deleted = 0;

    for (const entry of [...this.values.values()]) {
      if (!predicate(entry)) continue;

      if (this.delete(entry.key)) {
        deleted += 1;
      }
    }

    return deleted;
  }

  /**
   * Remove entradas de versões antigas.
   *
   * Funciona quando a chave foi criada com createPageBitmapCacheKey e contém:
   * rv=<number>
   */
  clearOlderThanRenderVersion(renderVersion: number) {
    const targetVersion = Math.floor(safeNumber(renderVersion, 0));

    return this.deleteWhere((entry) => {
      const metadata = entry.metadata ?? parsePageBitmapCacheKey(entry.key);

      if (!metadata) return false;

      return metadata.renderVersion < targetVersion;
    });
  }

  clearOlderThanBackendVersion(backendVersion: number) {
    const targetVersion = Math.floor(safeNumber(backendVersion, 0));

    return this.deleteWhere((entry) => {
      const metadata = entry.metadata ?? parsePageBitmapCacheKey(entry.key);

      if (!metadata) return false;

      return metadata.backendVersion < targetVersion;
    });
  }

  clearLowerThanOutputScale(outputScale: number) {
    const minimum = safeNumber(outputScale, 1);

    return this.deleteWhere((entry) => {
      const metadata = entry.metadata ?? parsePageBitmapCacheKey(entry.key);

      if (!metadata) return false;

      return metadata.outputScale + DEFAULT_NUMERIC_TOLERANCE < minimum;
    });
  }

  clearLowerThanBitmapCssRatio(bitmapCssRatio: number) {
    const minimum = safeNumber(bitmapCssRatio, 1);

    return this.deleteWhere((entry) => {
      const metadata = entry.metadata ?? parsePageBitmapCacheKey(entry.key);

      if (!metadata) return false;

      return metadata.bitmapCssRatio + DEFAULT_NUMERIC_TOLERANCE < minimum;
    });
  }

  clearNonFinalPreviews() {
    return this.deleteWhere((entry) => {
      const metadata = entry.metadata ?? parsePageBitmapCacheKey(entry.key);

      if (!metadata) return false;

      return metadata.renderPhase !== "settled-final";
    });
  }

  clearPage(pageNumber: number) {
    const normalized = normalizePageNumber(pageNumber);

    return this.deleteWhere((entry) => {
      const metadata = entry.metadata ?? parsePageBitmapCacheKey(entry.key);

      if (metadata) {
        return metadata.pageNumber === normalized;
      }

      return entry.key.includes(`p=${normalized}|`);
    });
  }

  clearDocument(documentId: string) {
    return this.deleteWhere((entry) => {
      const metadata = entry.metadata ?? parsePageBitmapCacheKey(entry.key);

      if (metadata) {
        return metadata.documentId === documentId;
      }

      return entry.key.startsWith(`doc=${documentId}|`);
    });
  }

  clearBackend(backend: string) {
    return this.deleteWhere((entry) => {
      const metadata = entry.metadata ?? parsePageBitmapCacheKey(entry.key);

      if (!metadata) return false;

      return metadata.backend === backend;
    });
  }

  clear() {
    for (const [key, entry] of this.values.entries()) {
      this.disposeSafely(entry.value, key);
    }

    this.values.clear();
    this.totalBytes = 0;
  }

  keys() {
    return [...this.values.keys()];
  }

  entries() {
    return [...this.values.values()];
  }

  metadataEntries() {
    return [...this.values.values()].map((entry) => ({
      ...entry,
      metadata: entry.metadata ?? parsePageBitmapCacheKey(entry.key),
    }));
  }

  private prune() {
    while (this.values.size > this.maxEntries) {
      this.deleteOldest();
    }

    if (typeof this.maxBytes === "number") {
      while (this.totalBytes > this.maxBytes && this.values.size > 0) {
        this.deleteOldest();
      }
    }
  }

  private deleteOldest() {
    const oldest = this.values.keys().next().value as string | undefined;

    if (!oldest) {
      return;
    }

    this.delete(oldest);
  }

  private disposeSafely(value: TValue, key: string) {
    if (!this.disposeValue) return;

    try {
      this.disposeValue(value, key);
    } catch {
      /**
       * O cache não deve derrubar o viewer por erro de descarte.
       */
    }
  }
}
