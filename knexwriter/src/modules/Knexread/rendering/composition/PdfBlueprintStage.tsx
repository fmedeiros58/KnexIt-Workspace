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
import type { KnexPdfPageBlueprint } from "../../core/KnexPdfBlueprintTypes";
import { buildKnexPdfPageBlueprintFromSession } from "../../extraction/blueprint";
import { PdfCanvasLayer } from "../canvas/PdfCanvasLayer";
import { PdfPagePresentationSurface } from "../blueprint/PdfPagePresentationSurface";

type BlueprintStageStatus = "idle" | "building" | "ready" | "error";

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
  const [status, setStatus] = useState<BlueprintStageStatus>("idle");
  const [reason, setReason] = useState("");
  const [blueprint, setBlueprint] = useState<KnexPdfPageBlueprint | null>(null);
  const [warningCount, setWarningCount] = useState(0);
  const textCount = countBlueprintText(blueprint);
  const imageCount = countBlueprintElementsByType(blueprint, "image");
  const shapeCount = countBlueprintElementsByType(blueprint, "shape");
  const formFieldCount = countBlueprintElementsByType(blueprint, "form-field");
  const annotationCount = countBlueprintElementsByType(blueprint, "annotation");
  const nonTextCount = countBlueprintNonText(blueprint);

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
        cssWidth: pageCssWidth,
        cssHeight: pageCssHeight,
        scale: layoutScale,
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

      setBlueprint(result.blueprint);
      setWarningCount(result.warnings.length);
      setStatus(result.success ? "ready" : "error");
      setReason(
        result.errors[0] ??
          result.warnings[0] ??
          (result.success ? "blueprint-ready" : "blueprint-build-failed"),
      );
      onTextBlocksChange?.(pageNumber, result.textBlocks, layoutScale);
    };

    void build().catch((error) => {
      if (cancelled || abortController.signal.aborted) return;
      setBlueprint(null);
      setStatus("error");
      setReason(error instanceof Error ? error.message : "blueprint-build-failed");
      onTextBlocksChange?.(pageNumber, [], layoutScale);
    });

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [
    layoutScale,
    onTextBlocksChange,
    pageCssHeight,
    pageCssWidth,
    pageNumber,
    session,
  ]);

  const nonTextFallbackSurface = (
    <div
      className="absolute inset-0"
      data-knexread-blueprint-canvas-host="true"
      data-knexread-blueprint-canvas-text-render="false"
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
        finalRenderVersion={finalRenderVersion + 200_000}
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
      data-knexread-blueprint-active={blueprint ? "true" : "false"}
      data-knexread-blueprint-text-count={textCount}
      data-knexread-blueprint-non-text-count={nonTextCount}
      data-knexread-blueprint-image-count={imageCount}
      data-knexread-blueprint-shape-count={shapeCount}
      data-knexread-blueprint-form-field-count={formFieldCount}
      data-knexread-blueprint-annotation-count={annotationCount}
      data-knexread-blueprint-warning-count={warningCount}
      style={{
        width: `${pageCssWidth}px`,
        height: `${pageCssHeight}px`,
      }}
    >
      <PdfPagePresentationSurface
        blueprint={blueprint}
        pageNumber={pageNumber}
        cssWidth={pageCssWidth}
        cssHeight={pageCssHeight}
        status={status}
        reason={reason}
        nonTextFallbackSurface={nonTextFallbackSurface}
        interactiveFormFields
      />
    </div>
  );
}
