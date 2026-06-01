export type PdfPageLayerId =
  | "canvas"
  | "annotation-behind-text"
  | "text"
  | "annotation-above-text"
  | "selection"
  | "debug";

export interface PdfPageLayerConfig {
  id: PdfPageLayerId;
  zIndex: number;
  pointerEvents: "auto" | "none";
}

export const PDF_PAGE_LAYER_CONFIG: PdfPageLayerConfig[] = [
  { id: "canvas", zIndex: 0, pointerEvents: "none" },
  { id: "annotation-behind-text", zIndex: 10, pointerEvents: "none" },
  { id: "text", zIndex: 20, pointerEvents: "auto" },
  { id: "annotation-above-text", zIndex: 30, pointerEvents: "auto" },
  { id: "selection", zIndex: 40, pointerEvents: "none" },
  { id: "debug", zIndex: 50, pointerEvents: "none" },
];

export function getPdfPageLayerConfig(
  id: PdfPageLayerId,
): PdfPageLayerConfig {
  const config = PDF_PAGE_LAYER_CONFIG.find((layer) => layer.id === id);

  if (!config) {
    throw new Error(`Unknown PDF page layer: ${id}`);
  }

  return config;
}
