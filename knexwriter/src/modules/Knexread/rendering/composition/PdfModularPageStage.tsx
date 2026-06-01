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

export type PdfModularPageStageProps = {
  session: NativePdfSession;
  pageNumber: number;
  zoom: number;
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
