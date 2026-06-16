"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PdfRenderQualityMode } from "../../native-pdf-reader/types";
import type { NativePdfSession } from "../../native-pdf-reader/services";
import type { PdfTileRenderState } from "../../native-pdf-reader/components/pdf-tiles/PdfTileCanvasTypes";
import type {
  KnexPdfRenderPhase,
  KnexPdfRenderedPage as RenderedPdfPage,
  KnexPdfTextBlock,
} from "../../native-pdf-reader/knex-pdf-engine";
import type { KnexPdfPageBlueprint } from "../../core/KnexPdfBlueprintTypes";
import { buildKnexPdfPageBlueprintFromSession } from "../../extraction/blueprint";
import { PdfCanvasLayer } from "../canvas/PdfCanvasLayer";
import { PdfPagePresentationSurface } from "../blueprint/PdfPagePresentationSurface";

type BlueprintStageStatus = "idle" | "building" | "ready" | "error";

type BlueprintVisualGeneration = {
  id: string;
  blueprint: KnexPdfPageBlueprint;
  cssWidth: number;
  cssHeight: number;
  scale: number;
  status: BlueprintStageStatus;
  reason: string;
  warningCount: number;
  renderPhase: KnexPdfRenderPhase;
  finalRenderVersion: number;
  createdAt: number;
};

export type PdfBlueprintStageProps = {
  session: NativePdfSession;
  pageNumber: number;
  zoom: number;
  pageCssWidth: number;
  pageCssHeight: number;
  renderQuality: PdfRenderQualityMode;
  renderPhase: KnexPdfRenderPhase;
  finalRenderVersion: number;
  onRendered?: (page: RenderedPdfPage) => void;
  onTextBlocksChange?: (
    pageNumber: number,
    blocks: KnexPdfTextBlock[],
    scale: number,
  ) => void;
  onCanvasRenderStateChange?: (state: PdfTileRenderState) => void;
};

function getDocumentId(session: NativePdfSession): string {
  return session.id ?? session.fingerprint ?? session.fileName;
}

function getLayoutScale(zoom: number): number {
  return Math.max(0.01, zoom / 100);
}

function countBlueprintText(blueprint: KnexPdfPageBlueprint | null): number {
  if (!blueprint) return 0;

  return blueprint.elements.filter(
    (element) =>
      ((element as { type?: string }).type ?? "text") === "text" &&
      typeof (element as { text?: unknown }).text === "string",
  ).length;
}

function countBlueprintElementsByType(
  blueprint: KnexPdfPageBlueprint | null,
  type: string,
): number {
  if (!blueprint) return 0;

  return blueprint.elements.filter(
    (element) => (element as { type?: string }).type === type,
  ).length;
}

function countBlueprintNonText(blueprint: KnexPdfPageBlueprint | null): number {
  if (!blueprint) return 0;

  return blueprint.elements.filter((element) => {
    const type = (element as { type?: string }).type ?? "text";

    return type !== "text";
  }).length;
}

function getGenerationProjectionTransform(input: {
  targetWidth: number;
  targetHeight: number;
  generationWidth: number;
  generationHeight: number;
}): string {
  const scaleX =
    Math.max(1, input.targetWidth) / Math.max(1, input.generationWidth);
  const scaleY =
    Math.max(1, input.targetHeight) / Math.max(1, input.generationHeight);

  if (Math.abs(scaleX - 1) <= 0.0001 && Math.abs(scaleY - 1) <= 0.0001) {
    return "none";
  }

  return `matrix(${scaleX}, 0, 0, ${scaleY}, 0, 0)`;
}

export function PdfBlueprintStage({
  session,
  pageNumber,
  zoom,
  pageCssWidth,
  pageCssHeight,
  renderQuality,
  renderPhase,
  finalRenderVersion,
  onRendered,
  onTextBlocksChange,
  onCanvasRenderStateChange,
}: PdfBlueprintStageProps) {
  const documentId = useMemo(() => getDocumentId(session), [session]);
  const layoutScale = useMemo(() => getLayoutScale(zoom), [zoom]);

  /*
   * O PdfBlueprintStage agora trabalha exclusivamente no espaço de renderização
   * comprometido.
   *
   * A escala visual imediata durante wheel/zoom é aplicada pelo
   * PdfModularPageStage em uma superfície externa única. Portanto, aqui dentro
   * canvas, blueprint e texto HTML devem usar o mesmo zoom/renderScale e o
   * mesmo pageCssWidth/pageCssHeight. Isso evita a desconexão vertical/horizontal
   * entre texto e canvas no zoom-in e no zoom-out.
   */
  const blueprintCssWidth = pageCssWidth;
  const blueprintCssHeight = pageCssHeight;
  const blueprintScale = layoutScale;

  const [status, setStatus] = useState<BlueprintStageStatus>("idle");
  const [reason, setReason] = useState("");
  const [activeGeneration, setActiveGeneration] =
    useState<BlueprintVisualGeneration | null>(null);
  const activeGenerationRef = useRef<BlueprintVisualGeneration | null>(null);
  const [warningCount, setWarningCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const abortController = new AbortController();

    const build = async () => {
      setStatus("building");
      setReason("");
      setWarningCount(0);

      const result = await buildKnexPdfPageBlueprintFromSession({
        session,
        pageNumber,
        cssWidth: blueprintCssWidth,
        cssHeight: blueprintCssHeight,
        scale: blueprintScale,
        signal: abortController.signal,
        config: {
          extractNativeText: true,
          useOcr: true,
          extractFormFields: true,
          extractAnnotations: true,

          /*
           * No modo blueprint, o fallback canvas pode ser ocultado para evitar
           * duplicação do texto rasterizado. Por isso, imagens e formas precisam
           * entrar no próprio blueprint, em vez de dependerem do canvas como
           * camada visual permanente.
           */
          extractImages: true,
          extractShapes: true,
        },
      });

      if (cancelled) return;

      const nextStatus: BlueprintStageStatus = result.success ? "ready" : "error";
      const nextReason =
        result.errors[0] ??
        result.warnings[0] ??
        (result.success ? "blueprint-ready" : "blueprint-build-failed");

      setWarningCount(result.warnings.length);
      setStatus(nextStatus);
      setReason(nextReason);
      const nextGeneration: BlueprintVisualGeneration = {
        id: result.blueprint.blueprintId,
        blueprint: result.blueprint,
        cssWidth: blueprintCssWidth,
        cssHeight: blueprintCssHeight,
        scale: blueprintScale,
        status: nextStatus,
        reason: nextReason,
        warningCount: result.warnings.length,
        renderPhase,
        finalRenderVersion,
        createdAt: Date.now(),
      };
      activeGenerationRef.current = nextGeneration;
      setActiveGeneration(nextGeneration);
      onTextBlocksChange?.(pageNumber, result.textBlocks, blueprintScale);
    };

    void build().catch((error) => {
      if (cancelled || abortController.signal.aborted) return;
      setStatus("error");
      setReason(error instanceof Error ? error.message : "blueprint-build-failed");

      if (!activeGenerationRef.current) {
        onTextBlocksChange?.(pageNumber, [], blueprintScale);
      }
    });

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [
    blueprintCssHeight,
    blueprintCssWidth,
    blueprintScale,
    onTextBlocksChange,
    pageNumber,
    session,
  ]);

  const visibleBlueprint = activeGeneration?.blueprint ?? null;
  const visibleCssWidth = activeGeneration?.cssWidth ?? blueprintCssWidth;
  const visibleCssHeight = activeGeneration?.cssHeight ?? blueprintCssHeight;
  const visibleScale = activeGeneration?.scale ?? blueprintScale;
  const visibleRenderPhase = activeGeneration?.renderPhase ?? renderPhase;
  const visibleFinalRenderVersion =
    activeGeneration?.finalRenderVersion ?? finalRenderVersion;
  const visibleReason = reason || activeGeneration?.reason || "";
  const visibleWarningCount = activeGeneration?.warningCount ?? warningCount;
  const visualGenerationProjection = getGenerationProjectionTransform({
    targetWidth: pageCssWidth,
    targetHeight: pageCssHeight,
    generationWidth: visibleCssWidth,
    generationHeight: visibleCssHeight,
  });

  const textCount = countBlueprintText(visibleBlueprint);
  const imageCount = countBlueprintElementsByType(visibleBlueprint, "image");
  const shapeCount = countBlueprintElementsByType(visibleBlueprint, "shape");
  const formFieldCount = countBlueprintElementsByType(
    visibleBlueprint,
    "form-field",
  );
  const annotationCount = countBlueprintElementsByType(
    visibleBlueprint,
    "annotation",
  );
  const nonTextCount = countBlueprintNonText(visibleBlueprint);

  const nonTextFallbackSurface = (
    <div
      className="absolute inset-0"
      data-knexread-blueprint-canvas-host="true"
      data-knexread-blueprint-canvas-text-render="false"
      style={{
        width: "100%",
        minWidth: "100%",
        maxWidth: "100%",
        height: "100%",
        minHeight: "100%",
        maxHeight: "100%",
        overflow: "hidden",
        contain: "layout paint size",
      }}
    >
      <PdfCanvasLayer
        session={session}
        pageNumber={pageNumber}
        zoom={visibleScale * 100}
        pageCssWidth={visibleCssWidth}
        pageCssHeight={visibleCssHeight}
        renderQuality={renderQuality}
        onRendered={onRendered}
        renderPhase={visibleRenderPhase}
        finalRenderVersion={visibleFinalRenderVersion + 200_000}
        renderText={false}
        onCanvasRenderStateChange={onCanvasRenderStateChange}
      />
    </div>
  );

  return (
    <div
      className="absolute inset-0"
      data-knexread-blueprint-stage="true"
      data-knexread-blueprint-stage-status={status}
      data-knexread-blueprint-stage-reason={reason}
      data-knexread-blueprint-document-id={documentId}
      data-knexread-blueprint-page-number={pageNumber}
      data-knexread-blueprint-active={visibleBlueprint ? "true" : "false"}
      data-knexread-blueprint-active-generation={
        activeGeneration?.id ?? ""
      }
      data-knexread-blueprint-active-generation-width={visibleCssWidth}
      data-knexread-blueprint-active-generation-height={visibleCssHeight}
      data-knexread-blueprint-active-generation-scale={visibleScale}
      data-knexread-blueprint-generation-projection={
        visualGenerationProjection
      }
      data-knexread-blueprint-text-count={textCount}
      data-knexread-blueprint-non-text-count={nonTextCount}
      data-knexread-blueprint-image-count={imageCount}
      data-knexread-blueprint-shape-count={shapeCount}
      data-knexread-blueprint-form-field-count={formFieldCount}
      data-knexread-blueprint-annotation-count={annotationCount}
      data-knexread-blueprint-warning-count={visibleWarningCount}
      data-knexread-blueprint-layout-scale={layoutScale}
      data-knexread-blueprint-css-width={blueprintCssWidth}
      data-knexread-blueprint-css-height={blueprintCssHeight}
      data-knexread-blueprint-scale={blueprintScale}
      style={{
        width: `${pageCssWidth}px`,
        minWidth: `${pageCssWidth}px`,
        maxWidth: `${pageCssWidth}px`,
        height: `${pageCssHeight}px`,
        minHeight: `${pageCssHeight}px`,
        maxHeight: `${pageCssHeight}px`,
        flex: `0 0 ${pageCssWidth}px`,
        overflow: "hidden",
        contain: "layout paint size",
        boxSizing: "border-box",
      }}
    >
      <div
        className="absolute left-0 top-0"
        data-knexread-blueprint-active-generation-surface="true"
        data-knexread-blueprint-active-generation-projected={
          visualGenerationProjection !== "none" ? "true" : "false"
        }
        style={{
          width: `${visibleCssWidth}px`,
          minWidth: `${visibleCssWidth}px`,
          maxWidth: `${visibleCssWidth}px`,
          height: `${visibleCssHeight}px`,
          minHeight: `${visibleCssHeight}px`,
          maxHeight: `${visibleCssHeight}px`,
          transform: visualGenerationProjection,
          transformOrigin: "0 0",
          transition: "none",
          opacity: 1,
          willChange:
            visualGenerationProjection !== "none" ? "transform" : "auto",
        }}
      >
        <PdfPagePresentationSurface
          blueprint={visibleBlueprint}
          pageNumber={pageNumber}
          cssWidth={visibleCssWidth}
          cssHeight={visibleCssHeight}
          status={status}
          reason={visibleReason}
          nonTextFallbackSurface={nonTextFallbackSurface}
          interactiveFormFields
        />
      </div>
    </div>
  );
}
