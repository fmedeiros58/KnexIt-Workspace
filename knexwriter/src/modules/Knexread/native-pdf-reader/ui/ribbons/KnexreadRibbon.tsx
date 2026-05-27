"use client";

import type {
  PdfReaderRibbonTab,
  PdfTranslationStrategy,
  PdfTranslationViewMode,
} from "../../types";
import { KNEXREAD_RIBBON_HEIGHT } from "../knexreadLayout";

function cmdClass(active = false, disabled = false) {
  return `inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-medium ${
    disabled
      ? "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400"
      : active
      ? "border-[#c23616] bg-[#c23616] text-white"
      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100"
  }`;
}

const ribbonClass =
  "flex shrink-0 items-center gap-2 overflow-hidden border-b border-zinc-200 bg-white px-3";
const ribbonStyle = { height: KNEXREAD_RIBBON_HEIGHT };

export function KnexreadRibbon({
  activeTab,
  translationViewMode,
  translationStrategy,
  sourceLanguage,
  targetLanguage,
  showRuler,
  showMargins,
  showViewportCenter,
  showPageCenter,
  showTextLayer,
  showOcrDebugBoxes,
  hasSelection = false,
  onOpenPdf,
  onClosePdf,
  onSaveSession,
  onZoomIn,
  onZoomOut,
  onFitWidth,
  onFitPage,
  onActualSize,
  onTranslateSelection,
  onHighlightSelection,
  onCommentSelection,
  onCopySelection,
  onCreateDirectCitation,
  onCreateIndirectCitation,
  onCreateReferenceFromSelection,
  onTranslatePage,
  onTranslateDocument,
  onTranslationStrategyChange,
  onSourceLanguageChange,
  onTargetLanguageChange,
  onTranslationViewModeChange,
  onToggleRuler,
  onToggleMargins,
  onToggleViewportCenter,
  onTogglePageCenter,
  onToggleTextLayer,
  onToggleOcrDebugBoxes,
  onRunPageOcr,
  onRunDocumentOcr,
  onNextReviewBlock,
  onPreviousReviewBlock,
  onMarkFocusedAsReviewed,
  onRebuildFocusedBlock,
  onExportTranslated,
  onExportBilingual,
  onExportWithAnnotations,
}: {
  activeTab: PdfReaderRibbonTab;
  translationViewMode: PdfTranslationViewMode;
  translationStrategy: PdfTranslationStrategy;
  sourceLanguage: string;
  targetLanguage: string;
  showRuler: boolean;
  showMargins: boolean;
  showViewportCenter: boolean;
  showPageCenter: boolean;
  showTextLayer: boolean;
  showOcrDebugBoxes: boolean;
  hasSelection?: boolean;
  onOpenPdf: () => void;
  onClosePdf: () => void;
  onSaveSession: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitWidth: () => void;
  onFitPage: () => void;
  onActualSize: () => void;
  onTranslateSelection: () => void;
  onHighlightSelection?: () => void;
  onCommentSelection?: () => void;
  onCopySelection?: () => void;
  onCreateDirectCitation?: () => void;
  onCreateIndirectCitation?: () => void;
  onCreateReferenceFromSelection?: () => void;
  onTranslatePage: () => void;
  onTranslateDocument: () => void;
  onTranslationStrategyChange: (strategy: PdfTranslationStrategy) => void;
  onSourceLanguageChange: (lang: string) => void;
  onTargetLanguageChange: (lang: string) => void;
  onTranslationViewModeChange: (mode: PdfTranslationViewMode) => void;
  onToggleRuler: () => void;
  onToggleMargins: () => void;
  onToggleViewportCenter: () => void;
  onTogglePageCenter: () => void;
  onToggleTextLayer: () => void;
  onToggleOcrDebugBoxes: () => void;
  onRunPageOcr: () => void;
  onRunDocumentOcr: () => void;
  onNextReviewBlock: () => void;
  onPreviousReviewBlock: () => void;
  onMarkFocusedAsReviewed: () => void;
  onRebuildFocusedBlock: () => void;
  onExportTranslated: () => void;
  onExportBilingual: () => void;
  onExportWithAnnotations: () => void;
}) {
  if (activeTab === "arquivo") {
    return (
      <div className={ribbonClass} style={ribbonStyle}>
        <button type="button" className={cmdClass()} onClick={onOpenPdf}>
          Abrir PDF
        </button>
        <button type="button" className={cmdClass()} onClick={onSaveSession}>
          Salvar sessão
        </button>
        <button type="button" className={cmdClass()} onClick={onClosePdf}>
          Fechar leitor
        </button>
      </div>
    );
  }

  if (activeTab === "inicio") {
    return (
      <div className={ribbonClass} style={ribbonStyle}>
        <button type="button" className={cmdClass()} onClick={onOpenPdf}>
          Open PDF
        </button>
        <button type="button" className={cmdClass()} onClick={onSaveSession}>
          Save session
        </button>
        <button type="button" className={cmdClass()} onClick={onClosePdf}>
          Close PDF
        </button>
      </div>
    );
  }

  if (activeTab === "leitura") {
    return (
      <div className={ribbonClass} style={ribbonStyle}>
        <button type="button" className={cmdClass()} onClick={onZoomOut}>
          Zoom -
        </button>
        <button type="button" className={cmdClass()} onClick={onZoomIn}>
          Zoom +
        </button>
        <button type="button" className={cmdClass()} onClick={onFitWidth}>
          Fit width
        </button>
        <button type="button" className={cmdClass()} onClick={onFitPage}>
          Fit page
        </button>
        <button type="button" className={cmdClass()} onClick={onActualSize}>
          100%
        </button>
      </div>
    );
  }

  if (activeTab === "traducao") {
    return (
      <div className={ribbonClass} style={ribbonStyle}>
        <select
          value={sourceLanguage}
          onChange={(event) => onSourceLanguageChange(event.target.value)}
          className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs font-medium text-zinc-700"
        >
          <option value="auto">Source: auto</option>
          <option value="pt-BR">Source: pt-BR</option>
          <option value="en-US">Source: en-US</option>
          <option value="es-ES">Source: es-ES</option>
        </select>
        <select
          value={targetLanguage}
          onChange={(event) => onTargetLanguageChange(event.target.value)}
          className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs font-medium text-zinc-700"
        >
          <option value="pt-BR">Target: pt-BR</option>
          <option value="en-US">Target: en-US</option>
          <option value="es-ES">Target: es-ES</option>
          <option value="fr-FR">Target: fr-FR</option>
        </select>
        <select
          value={translationStrategy}
          onChange={(event) =>
            onTranslationStrategyChange(event.target.value as PdfTranslationStrategy)
          }
          className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs font-medium text-zinc-700"
        >
          <option value="local-first">local-first</option>
          <option value="local-only">local-only</option>
          <option value="online-first">online-first</option>
          <option value="online-only">online-only</option>
          <option value="auto">auto</option>
        </select>
        <button type="button" className={cmdClass()} onClick={onTranslateSelection}>
          Translate selection
        </button>
        <button type="button" className={cmdClass()} onClick={onTranslatePage}>
          Translate page
        </button>
        <button type="button" className={cmdClass()} onClick={onTranslateDocument}>
          Translate document
        </button>
      </div>
    );
  }

  if (activeTab === "revisao") {
    return (
      <div className={ribbonClass} style={ribbonStyle}>
        <button type="button" className={cmdClass()} onClick={onPreviousReviewBlock}>
          Previous block
        </button>
        <button type="button" className={cmdClass()} onClick={onNextReviewBlock}>
          Next block
        </button>
        <button type="button" className={cmdClass()} onClick={onMarkFocusedAsReviewed}>
          Mark reviewed
        </button>
        <button type="button" className={cmdClass()} onClick={onRebuildFocusedBlock}>
          Rebuild block
        </button>
      </div>
    );
  }

  if (activeTab === "anotacoes") {
    return (
      <div className={ribbonClass} style={ribbonStyle}>
        <button
          type="button"
          disabled={!hasSelection}
          className={cmdClass(false, !hasSelection)}
          onClick={onHighlightSelection}
        >
          Grifar
        </button>
        <button
          type="button"
          disabled={!hasSelection}
          className={cmdClass(false, !hasSelection)}
          onClick={onCommentSelection}
        >
          Comentar
        </button>
        <button
          type="button"
          disabled={!hasSelection}
          className={cmdClass(false, !hasSelection)}
          onClick={onCopySelection}
        >
          Copiar
        </button>
        <button
          type="button"
          disabled={!hasSelection}
          className={cmdClass(false, !hasSelection)}
          onClick={onCreateDirectCitation}
        >
          Citação direta
        </button>
        <button
          type="button"
          disabled={!hasSelection}
          className={cmdClass(false, !hasSelection)}
          onClick={onCreateIndirectCitation}
        >
          Citação indireta
        </button>
        <button
          type="button"
          disabled={!hasSelection}
          className={cmdClass(false, !hasSelection)}
          onClick={onCreateReferenceFromSelection}
        >
          Criar fonte
        </button>
        <button
          type="button"
          disabled={!hasSelection}
          className={cmdClass(false, !hasSelection)}
          onClick={onTranslateSelection}
        >
          Traduzir seleção
        </button>
      </div>
    );
  }

  if (activeTab === "visualizacao") {
    return (
      <div className={ribbonClass} style={ribbonStyle}>
        <button
          type="button"
          className={cmdClass(translationViewMode === "normal")}
          onClick={() => onTranslationViewModeChange("normal")}
        >
          Normal
        </button>
        <button
          type="button"
          className={cmdClass(translationViewMode === "side-by-side")}
          onClick={() => onTranslationViewModeChange("side-by-side")}
        >
          Side by side
        </button>
        <button
          type="button"
          className={cmdClass(translationViewMode === "toggle")}
          onClick={() => onTranslationViewModeChange("toggle")}
        >
          Toggle
        </button>
        <button
          type="button"
          className={cmdClass(translationViewMode === "focus-review")}
          onClick={() => onTranslationViewModeChange("focus-review")}
        >
          Focus review
        </button>

        <button type="button" className={cmdClass(showRuler)} onClick={onToggleRuler}>
          Show ruler
        </button>
        <button type="button" className={cmdClass(showMargins)} onClick={onToggleMargins}>
          Show margins
        </button>
        <button
          type="button"
          className={cmdClass(showViewportCenter)}
          onClick={onToggleViewportCenter}
        >
          Viewport center
        </button>
        <button
          type="button"
          className={cmdClass(showPageCenter)}
          onClick={onTogglePageCenter}
        >
          Page center
        </button>
        <button
          type="button"
          className={cmdClass(showTextLayer)}
          onClick={onToggleTextLayer}
        >
          Text layer
        </button>
      </div>
    );
  }

  if (activeTab === "exportar") {
    return (
      <div className={ribbonClass} style={ribbonStyle}>
        <button type="button" className={cmdClass()} onClick={onExportTranslated}>
          Export translated
        </button>
        <button type="button" className={cmdClass()} onClick={onExportBilingual}>
          Export bilingual
        </button>
        <button type="button" className={cmdClass()} onClick={onExportWithAnnotations}>
          Export annotations
        </button>
      </div>
    );
  }

  return (
    <div className={ribbonClass} style={ribbonStyle}>
      <button type="button" className={cmdClass()} onClick={onRunPageOcr}>
        OCR page
      </button>
      <button type="button" className={cmdClass()} onClick={onRunDocumentOcr}>
        OCR document
      </button>
      <button
        type="button"
        className={cmdClass(showOcrDebugBoxes)}
        onClick={onToggleOcrDebugBoxes}
      >
        OCR debug boxes
      </button>
      <p className="text-xs text-zinc-600">
        OCR is isolated from the original canvas rendering and never overwrites the source PDF.
      </p>
    </div>
  );
}
