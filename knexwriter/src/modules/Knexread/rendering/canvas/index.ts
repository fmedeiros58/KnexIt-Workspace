/**
 * rendering/canvas/index.ts
 * 
 * Exports públicos do módulo de canvas
 */

export { BlankCanvasBuilder, BlankCanvasScaleCalculator } from './BlankCanvasBuilder';
export type { BlankCanvasConfig, BlankCanvasResult } from './BlankCanvasBuilder';

export { PdfCanvasLayer } from './PdfCanvasLayer';
export type { PdfCanvasLayerProps } from './PdfCanvasLayer';

export { PdfSingleCanvasRenderer } from './PdfSingleCanvasRenderer';
export type {
  CanvasRenderToken,
  CanvasRenderConfig,
  CanvasRenderResult,
  ICanvasRenderObserver,
} from './PdfSingleCanvasRenderer';
