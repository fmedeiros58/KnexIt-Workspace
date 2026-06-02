"use client";

import { useEffect, useMemo, useState } from "react";
import type { PdfRenderQualityMode } from "../../native-pdf-reader/types";
import type { NativePdfSession } from "../../native-pdf-reader/services";
import type { PdfTileRenderState } from "../../native-pdf-reader/components/pdf-tiles/PdfTileCanvasTypes";
import type {
  KnexPdfRenderPhase,
  KnexPdfRenderedPage as RenderedPdfPage,
  KnexPdfTextBlock,
} from "../../native-pdf-reader/knex-pdf-engine";
import { detectPdfOcrNeed } from "../../extraction/ocr/PdfOcrNeedDetector";
import { runPdfOcrPipeline } from "../../extraction/ocr/PdfOcrPipeline";
import { extractPdfNativeText } from "../../extraction/native-text/PdfNativeTextExtractor";
import { PdfCanvasLayer } from "../canvas/PdfCanvasLayer";
import { PdfHtmlTextLayer } from "../text/PdfHtmlTextLayer";
import {
  buildPdfVisualTextModel,
  type PdfVisualTextModel,
} from "../text/PdfVisualTextModelBuilder";
import { PdfBlueprintStage } from "./PdfBlueprintStage";

type TextPipelineStatus =
  | "idle"
  | "extracting-native"
  | "running-ocr"
  | "ready"
  | "error";

const EMPTY_TEXT_MODEL: PdfVisualTextModel = {
  pageNumber: 0,
  runs: [],
  source: "empty",
};

function getDocumentId(session: NativePdfSession): string {
  return session.id ?? session.fingerprint ?? session.fileName;
}

function getLayoutScale(zoom: number): number {
  return Math.max(0.01, zoom / 100);
}

function safeZoomPercent(value: number | null | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function resolveRenderCssSize(input: {
  pageCssWidth: number;
  pageCssHeight: number;
  visualZoom: number;
  renderZoom: number;
}) {
  const visualScale = getLayoutScale(input.visualZoom);
  const renderScale = getLayoutScale(input.renderZoom);
  const visualToRenderScaleRatio = visualScale / Math.max(0.01, renderScale);

  return {
    visualScale,
    renderScale,
    visualToRenderScaleRatio,
    renderPageCssWidth: Math.max(1, input.pageCssWidth / visualToRenderScaleRatio),
    renderPageCssHeight: Math.max(1, input.pageCssHeight / visualToRenderScaleRatio),
  };
}

function getScaledSurfaceTransform(ratio: number): string {
  if (Math.abs(ratio - 1) <= 0.0001) return "none";
  return `matrix(${ratio}, 0, 0, ${ratio}, 0, 0)`;
}

function getGlobalBoolean(key: string): boolean {
  if (typeof globalThis === "undefined") return false;

  const value = (globalThis as unknown as Record<string, unknown>)[key];
  return value === true || value === "true" || value === "1";
}

function shouldUseBlueprintStage(): boolean {
  if (
    getGlobalBoolean("KNEX_PDF_DISABLE_BLUEPRINT_MODE") ||
    getGlobalBoolean("KNEX_PDF_FORCE_LEGACY_MODULAR_STAGE")
  ) {
    return false;
  }

  return true;
}

export type PdfModularPageStageProps = {
  session: NativePdfSession;
  pageNumber: number;

  /**
   * Mantido por compatibilidade. Quando visualZoom/renderZoom não forem
   * informados, este valor será usado para ambos.
   */
  zoom: number;

  /**
   * Zoom visual/interativo: muda imediatamente durante wheel/zoom e controla o
   * tamanho externo da página no palco.
   */
  visualZoom?: number;

  /**
   * Zoom comprometido de renderização: só deve mudar após estabilização do
   * gesto. Controla canvas, blueprint, OCR/text extraction e render pesado.
   */
  renderZoom?: number;

  pageCssWidth: number;
  pageCssHeight: number;
  renderQuality: PdfRenderQualityMode;
  renderPhase: KnexPdfRenderPhase;
  finalRenderVersion: number;
  highlightedRunIds?: Set<string>;
  onRendered?: (page: RenderedPdfPage) => void;
  onTextBlocksChange?: (
    pageNumber: number,
    blocks: KnexPdfTextBlock[],
    scale: number,
  ) => void;
  onCanvasRenderStateChange?: (state: PdfTileRenderState) => void;
};

export function PdfModularPageStage({
  session,
  pageNumber,
  zoom,
  visualZoom,
  renderZoom,
  pageCssWidth,
  pageCssHeight,
  renderQuality,
  renderPhase,
  finalRenderVersion,
  highlightedRunIds,
  onRendered,
  onTextBlocksChange,
  onCanvasRenderStateChange,
}: PdfModularPageStageProps) {
  const [blueprintStageEnabled] = useState(shouldUseBlueprintStage);

  const effectiveRenderZoom = safeZoomPercent(renderZoom, zoom);
  const effectiveVisualZoom = safeZoomPercent(visualZoom, effectiveRenderZoom);
  const {
    renderPageCssWidth,
    renderPageCssHeight,
    visualScale,
    renderScale,
    visualToRenderScaleRatio,
  } = resolveRenderCssSize({
    pageCssWidth,
    pageCssHeight,
    visualZoom: effectiveVisualZoom,
    renderZoom: effectiveRenderZoom,
  });
  const scaledSurfaceTransform = getScaledSurfaceTransform(
    visualToRenderScaleRatio,
  );

  /*
   * Regra estrutural:
   *
   * O frame externo usa o tamanho visual imediato. A superfície interna usa o
   * tamanho de renderização comprometido e é escalada por transform.
   *
   * Assim, canvas e texto/blueprint ficam sempre sincronizados durante
   * zoom-in/zoom-out, enquanto o render pesado só muda após o settle.
   */
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      data-knexread-modular-page-stage="true"
      data-knexread-modular-page-number={pageNumber}
      data-knexread-modular-stage-mode={
        blueprintStageEnabled ? "blueprint" : "legacy"
      }
      data-knexread-modular-visual-zoom={effectiveVisualZoom}
      data-knexread-modular-render-zoom={effectiveRenderZoom}
      data-knexread-modular-visual-scale={visualScale}
      data-knexread-modular-render-scale={renderScale}
      data-knexread-modular-visual-to-render-scale-ratio={
        visualToRenderScaleRatio
      }
      data-knexread-modular-render-css-width={renderPageCssWidth}
      data-knexread-modular-render-css-height={renderPageCssHeight}
      style={{
        width: `${pageCssWidth}px`,
        height: `${pageCssHeight}px`,
      }}
    >
      <div
        className="absolute left-0 top-0"
        data-knexread-modular-scaled-render-surface="true"
        style={{
          width: `${renderPageCssWidth}px`,
          height: `${renderPageCssHeight}px`,
          transform: scaledSurfaceTransform,
          transformOrigin: "0 0",
          willChange:
            Math.abs(visualToRenderScaleRatio - 1) > 0.0001
              ? "transform"
              : "auto",
        }}
      >
        {blueprintStageEnabled ? (
          <PdfBlueprintStage
            session={session}
            pageNumber={pageNumber}
            zoom={effectiveRenderZoom}
            pageCssWidth={renderPageCssWidth}
            pageCssHeight={renderPageCssHeight}
            renderQuality={renderQuality}
            renderPhase={renderPhase}
            finalRenderVersion={finalRenderVersion}
            onRendered={onRendered}
            onTextBlocksChange={onTextBlocksChange}
            onCanvasRenderStateChange={onCanvasRenderStateChange}
          />
        ) : (
          <PdfLegacyModularPageStage
            session={session}
            pageNumber={pageNumber}
            zoom={effectiveRenderZoom}
            pageCssWidth={renderPageCssWidth}
            pageCssHeight={renderPageCssHeight}
            renderQuality={renderQuality}
            renderPhase={renderPhase}
            finalRenderVersion={finalRenderVersion}
            highlightedRunIds={highlightedRunIds}
            onRendered={onRendered}
            onTextBlocksChange={onTextBlocksChange}
            onCanvasRenderStateChange={onCanvasRenderStateChange}
          />
        )}
      </div>
    </div>
  );
}

function PdfLegacyModularPageStage({
  session,
  pageNumber,
  zoom,
  pageCssWidth,
  pageCssHeight,
  renderQuality,
  renderPhase,
  finalRenderVersion,
  highlightedRunIds,
  onRendered,
  onTextBlocksChange,
  onCanvasRenderStateChange,
}: PdfModularPageStageProps) {
  const documentId = useMemo(() => getDocumentId(session), [session]);
  const extractionScale = useMemo(() => getLayoutScale(zoom), [zoom]);
  const [textPipelineStatus, setTextPipelineStatus] =
    useState<TextPipelineStatus>("idle");
  const [textPipelineReason, setTextPipelineReason] = useState("");
  const [ocrStatus, setOcrStatus] = useState("not-run");
  const [textBlocks, setTextBlocks] = useState<KnexPdfTextBlock[]>([]);
  const visualTextModel = useMemo(
    () =>
      textBlocks.length > 0
        ? buildPdfVisualTextModel({
            pageNumber,
            blocks: textBlocks,
            source:
              ocrStatus === "ready" && textBlocks.some((block) => block.rasterized)
                ? "ocr"
                : "native",
          })
        : { ...EMPTY_TEXT_MODEL, pageNumber },
    [ocrStatus, pageNumber, textBlocks],
  );

  useEffect(() => {
    let cancelled = false;
    const abortController = new AbortController();

    const runTextPipeline = async () => {
      setTextPipelineStatus("extracting-native");
      setTextPipelineReason("");
      setOcrStatus("not-run");

      try {
        const nativeText = await extractPdfNativeText({
          session,
          pageNumber,
          scale: extractionScale,
          signal: abortController.signal,
        });

        if (cancelled) return;

        const ocrNeed = detectPdfOcrNeed({
          nativeTextBlockCount: nativeText.blocks.length,
          nativeTextConfidence: nativeText.confidence,
        });

        if (ocrNeed.shouldRunOcr) {
          setTextPipelineStatus("running-ocr");
        }

        const ocrResult = await runPdfOcrPipeline({
          session,
          pageNumber,
          scale: extractionScale,
          shouldRun: ocrNeed.shouldRunOcr,
          reason: ocrNeed.reason,
          signal: abortController.signal,
        });

        if (cancelled) return;

        const nextBlocks =
          nativeText.blocks.length > 0 ? nativeText.blocks : ocrResult.blocks;

        setTextBlocks(nextBlocks);
        setTextPipelineStatus("ready");
        setTextPipelineReason(
          nativeText.blocks.length > 0 ? "native-text-ready" : ocrResult.reason,
        );
        setOcrStatus(ocrResult.status);
        onTextBlocksChange?.(pageNumber, nextBlocks, extractionScale);
      } catch (error) {
        if (cancelled || abortController.signal.aborted) return;

        setTextBlocks([]);
        setTextPipelineStatus("error");
        setTextPipelineReason(
          error instanceof Error ? error.message : "text-pipeline-failed",
        );
        setOcrStatus("not-run");
        onTextBlocksChange?.(pageNumber, [], extractionScale);
      }
    };

    void runTextPipeline();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [extractionScale, onTextBlocksChange, pageNumber, session]);

  const hasHtmlText = visualTextModel.runs.length > 0;

  return (
    <div
      className="absolute inset-0"
      data-knexread-modular-page-stage="true"
      data-knexread-modular-document-id={documentId}
      data-knexread-modular-page-number={pageNumber}
      data-knexread-modular-text-status={textPipelineStatus}
      data-knexread-modular-text-reason={textPipelineReason}
      data-knexread-modular-native-text-block-count={textBlocks.length}
      data-knexread-modular-ocr-status={ocrStatus}
      data-knexread-modular-html-text-active={hasHtmlText ? "true" : "false"}
      style={{
        width: `${pageCssWidth}px`,
        height: `${pageCssHeight}px`,
      }}
    >
      <div
        className="absolute inset-0 z-0"
        data-knexread-modular-canvas-host="true"
      >
        <PdfCanvasLayer
          session={session}
          pageNumber={pageNumber}
          zoom={zoom}
          pageCssWidth={pageCssWidth}
          pageCssHeight={pageCssHeight}
          renderQuality={renderQuality}
          onRendered={onRendered}
          renderPhase={renderPhase}
          finalRenderVersion={finalRenderVersion + (hasHtmlText ? 100_000 : 0)}
          renderText={!hasHtmlText}
          onCanvasRenderStateChange={onCanvasRenderStateChange}
        />
      </div>

      {hasHtmlText ? (
        <div
          className="absolute inset-0 z-[5]"
          data-knexread-modular-html-text-host="true"
        >
          <PdfHtmlTextLayer
            model={visualTextModel}
            highlightedRunIds={highlightedRunIds}
          />
        </div>
      ) : null}
    </div>
  );
}
