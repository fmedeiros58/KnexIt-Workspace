/**
 * index.ts
 * -----------------------------------------------------------------------------
 * Barrel export da camada core/interaction/zoom-scroll.
 *
 * Importante:
 * não usamos export * para PdfWheelInteractionPolicy junto com
 * PdfZoomFramePolicy, porque os dois arquivos exportam nomes iguais, como:
 *
 * - PdfWheelDeltaMode
 * - normalizePdfWheelDeltaToPixels
 * - getAcceleratedPdfWheelScrollDelta
 * - getAcceleratedPdfWheelZoomStep
 *
 * Usar export * nos dois gera TS2308 por ambiguidade.
 */

/**
 * Nova arquitetura modular.
 */
export * from "./ZoomScrollTypes";
export * from "./ZoomScrollConstants";
export * from "./WheelInputController";
export * from "./ZoomVelocityController";
export * from "./VisualZoomController";
export * from "./ZoomAnchorOrchestrator";
export * from "./RenderZoomCommitController";
export * from "./ScrollMotionController";
export * from "./ZoomScrollInteractionState";
export * from "./ZoomScrollPipeline";

/**
 * Política de frame/render.
 *
 * Este arquivo continua exportado de forma ampla porque já era parte do barrel
 * original e pode ser usado por componentes de página/renderização.
 */
export * from "./PdfZoomFramePolicy";
export * from "./usePdfZoomFramePolicy";

/**
 * Compatibilidade controlada com PdfWheelInteractionPolicy.
 *
 * Para evitar conflito com PdfZoomFramePolicy, expomos o módulo legado por
 * namespace. Quem precisar dele pode importar:
 *
 * import { PdfWheelInteractionPolicyModule } from ".../zoom-scroll";
 *
 * ou continuar importando diretamente:
 *
 * import { ... } from ".../zoom-scroll/PdfWheelInteractionPolicy";
 */
export * as PdfWheelInteractionPolicyModule from "./PdfWheelInteractionPolicy";
