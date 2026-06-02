"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type Ref,
} from "react";
import { EditorContent, type Editor } from "@tiptap/react";
import {
  assertKnexWriterNonRegression,
  type KnexWriterRetentionMaskRect as GuardRetentionMaskRect,
} from "./KnexWriterNonRegressionGuards";

export type KnexWriterEditableBodyMargins = {
  topPx: number;
  rightPx: number;
  bottomPx: number;
  leftPx: number;
};

export type KnexWriterParagraphIndents = {
  leftPx?: number;
  rightPx?: number;
  firstLinePx?: number;
  hangingPx?: number;
};

export type KnexWriterPaginationGeometry = {
  pageWidthPx: number;
  pageHeightPx: number;
  pageGapPx: number;
  pageStridePx: number;
  bodyLeftPx: number;
  bodyTopPx: number;
  bodyRightPx: number;
  bodyBottomPx: number;
  bodyWidthPx: number;
  bodyHeightPx: number;
};

export type KnexWriterMeasuredPagination = {
  pageCount: number;
  pageBreakOffsets: number[];
  pageFillRatios: number[];
  contentHeightPx: number;
};

type KnexWriterRetentionMaskRect = GuardRetentionMaskRect & {
  topPx: number;
  heightPx: number;
};

export type KnexWriterEditableBodyProps = {
  /**
   * Editor TipTap/ProseMirror principal.
   * Quando informado, o componente renderiza EditorContent.
   */
  editor?: Editor | null;
  editorVersion?: number;
  editorRef?: Ref<HTMLDivElement>;

  /**
   * Índice lógico da página ativa ou inicial.
   * No modelo atual, normalmente será 0 porque o editor é contínuo.
   */
  pageIndex?: number;

  /**
   * Geometria enviada pelo Stage.
   * Define onde o corpo editável começa dentro da folha e qual é sua largura útil.
   */
  bodyLeftPx?: number;
  bodyTopPx?: number;
  bodyWidthPx?: number;
  bodyBottomPx?: number;
  stageHeightPx?: number;

  /**
   * Geometria paginada preparada pelo Shell.
   * Use quando o Shell já estiver expondo writingPaginationGeometry.
   */
  paginationGeometry?: Partial<KnexWriterPaginationGeometry> | null;

  /**
   * Valores complementares para paginação visual.
   * O Stage pode passar estes valores diretamente.
   */
  pageCount?: number;
  pageGapPx?: number;
  enableSoftPagination?: boolean;

  /**
   * Props legadas, mantidas para compatibilidade com o antigo contentEditable
   * por página.
   */
  pageWidthPx?: number;
  pageHeightPx?: number;
  pageMargins?: KnexWriterEditableBodyMargins;

  placeholder?: string;
  editable?: boolean;
  isActive?: boolean;
  spellCheck?: boolean;
  className?: string;
  style?: CSSProperties;
  paragraphIndents?: KnexWriterParagraphIndents;
  defaultFontFamily?: string;
  defaultFontSizePt?: number;
  defaultLineHeight?: number | string;
  onFocusPage?: (pageIndex: number) => void;
  onMeasuredPaginationChange?: (measurement: KnexWriterMeasuredPagination) => void;
};

const DEFAULT_PAGE_WIDTH_PX = 794;
const DEFAULT_PAGE_HEIGHT_PX = 1123;
const DEFAULT_PAGE_GAP_PX = 22;

const DEFAULT_PAGE_MARGINS: KnexWriterEditableBodyMargins = {
  topPx: 96,
  rightPx: 96,
  bottomPx: 96,
  leftPx: 96,
};

/**
 * CSS estático.
 *
 * Os valores dinâmicos ficam em CSS variables no wrapper para evitar erro de
 * hydration no Next.js, especialmente em font-family com aspas.
 */
const KNEXWRITER_EDITABLE_BODY_CSS = `
  .knexwriter-editable-body-wrapper {
    border: 0 !important;
    outline: none !important;
    box-shadow: none !important;
    background: transparent !important;
    overflow-wrap: break-word;
    word-break: normal;
    tab-size: 4;
  }

  .knexwriter-editable-body-wrapper,
  .knexwriter-editable-body-wrapper * {
    box-sizing: border-box;
  }

  .knexwriter-editor {
    border: 0 !important;
    outline: none !important;
    box-shadow: none !important;
    background: transparent !important;
    width: 100%;
    min-height: var(--kw-editor-min-height, 1px);
    overflow: visible;
    white-space: pre-wrap;
    overflow-wrap: break-word;
    word-break: normal;
    font-family: var(--kw-editor-font-family);
    font-size: var(--kw-editor-font-size);
    line-height: var(--kw-editor-line-height);
    color: var(--kw-editor-color, #18181b);
  }

  .knexwriter-editor .ProseMirror {
    border: 0 !important;
    outline: none !important;
    box-shadow: none !important;
    background: transparent !important;
    width: 100%;
    max-width: 100%;
    min-height: var(--kw-editor-min-height, 1px);
    overflow: visible;
    white-space: pre-wrap;
    overflow-wrap: break-word;
    word-break: normal;
    font-family: var(--kw-editor-font-family);
    font-size: var(--kw-editor-font-size);
    line-height: var(--kw-editor-line-height);
    color: var(--kw-editor-color, #18181b);
    caret-color: var(--kw-editor-color, #18181b);
  }

  .knexwriter-editor .ProseMirror:focus {
    border: 0 !important;
    outline: none !important;
    box-shadow: none !important;
  }

  .knexwriter-editor .ProseMirror p,
  .knexwriter-editor .ProseMirror h1,
  .knexwriter-editor .ProseMirror h2,
  .knexwriter-editor .ProseMirror h3,
  .knexwriter-editor .ProseMirror h4,
  .knexwriter-editor .ProseMirror h5,
  .knexwriter-editor .ProseMirror h6,
  .knexwriter-editor .ProseMirror li,
  .knexwriter-editor .ProseMirror blockquote,
  .knexwriter-editor .ProseMirror pre,
  .knexwriter-editor .ProseMirror table,
  .knexwriter-editor .ProseMirror figure {
    max-width: 100%;
    box-sizing: border-box;
  }

  .knexwriter-editor .ProseMirror > * {
    max-width: 100%;
  }

  .knexwriter-editor .ProseMirror p,
  .knexwriter-editor .ProseMirror h1,
  .knexwriter-editor .ProseMirror h2,
  .knexwriter-editor .ProseMirror h3,
  .knexwriter-editor .ProseMirror h4,
  .knexwriter-editor .ProseMirror h5,
  .knexwriter-editor .ProseMirror h6,
  .knexwriter-editor .ProseMirror blockquote,
  .knexwriter-editor .ProseMirror pre {
    margin-left: calc(
      var(--kw-paragraph-left-indent, 0px) + var(--kw-paragraph-hanging-indent, 0px)
    );
    margin-right: var(--kw-paragraph-right-indent, 0px);
    text-indent: calc(
      var(--kw-paragraph-first-line-indent, 0px) - var(--kw-paragraph-hanging-indent, 0px)
    );
  }

  .knexwriter-editor .ProseMirror h1,
  .knexwriter-editor .ProseMirror h2,
  .knexwriter-editor .ProseMirror h3,
  .knexwriter-editor .ProseMirror h4,
  .knexwriter-editor .ProseMirror h5,
  .knexwriter-editor .ProseMirror h6 {
    line-height: 1.2;
  }

  .knexwriter-editor .ProseMirror ul,
  .knexwriter-editor .ProseMirror ol {
    padding-left: 1.45em;
  }

  .knexwriter-editor .ProseMirror blockquote {
    border-left: 3px solid #d4d4d8;
    margin-left: 0;
    padding-left: 12px;
    color: #3f3f46;
  }

  .knexwriter-editor .ProseMirror hr {
    border: 0;
    border-top: 1px solid #d4d4d8;
    margin: 12px 0;
  }

  .knexwriter-editor .knexwriter-tab-stop {
    display: inline-block;
    white-space: pre;
  }

  .knexwriter-editor .knexwriter-page-break,
  .knexwriter-editor [data-knexwriter-page-break] {
    display: block;
    width: 100%;
    min-height: var(--kw-manual-page-break-height, 1px);
    margin: 0;
    padding: 0;
    border: 0;
    break-after: page;
    page-break-after: always;
    pointer-events: none;
  }

  .knexwriter-editor img,
  .knexwriter-editor table,
  .knexwriter-editor figure {
    max-width: 100%;
  }

  .knexwriter-editor img {
    height: auto;
  }

  .knexwriter-editor figure {
    margin-left: 0;
    margin-right: 0;
  }

  .knexwriter-editor table {
    border-collapse: collapse;
    table-layout: auto;
    width: auto;
    max-width: 100%;
  }

  .knexwriter-editor th,
  .knexwriter-editor td {
    border: 1px solid #d4d4d8;
    padding: 4px 6px;
    vertical-align: top;
  }

  .knexwriter-editor th {
    background: #f4f4f5;
    font-weight: 600;
  }

  .knexwriter-editor .ProseMirror-selectednode {
    outline: 2px solid #93c5fd;
    outline-offset: 2px;
  }

  .knexwriter-editor .ProseMirror ::selection {
    background: rgba(190, 242, 100, 0.7);
  }

  .knexwriter-editor .ProseMirror p.is-editor-empty:first-child::before,
  .knexwriter-editor .ProseMirror [data-placeholder-visible="true"] {
    pointer-events: none;
    color: #a1a1aa;
  }

  .knexwriter-editor .ProseMirror p.is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    float: left;
    height: 0;
  }

`;

function clampPositive(value: number | undefined, fallback = 0) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, value);
}

function normalizeLineHeight(value: number | string) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? String(value) : "1.5";
  }

  const normalized = value.trim();
  return normalized || "1.5";
}

function getComputedPx(value: string | null | undefined) {
  if (!value) return 0;

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampRatio(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function getDirectEditableBlocks(editorDom: HTMLElement) {
  const children = Array.from(editorDom.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  );

  return children.filter((child) => {
    if (child.dataset.knexwriterPageBreak === "true") return true;
    if (child.classList.contains("knexwriter-page-break")) return true;

    const rect = child.getBoundingClientRect();
    return rect.height > 0 || child.textContent?.trim();
  });
}

function resetPaginationBlock(block: HTMLElement) {
  if (!block.dataset.kwOriginalMarginTop) {
    block.dataset.kwOriginalMarginTop = block.style.marginTop || "__empty__";
  }

  const originalMarginTop =
    block.dataset.kwOriginalMarginTop === "__empty__"
      ? ""
      : block.dataset.kwOriginalMarginTop ?? "";

  block.style.marginTop = originalMarginTop;
  block.style.removeProperty("transform");
  block.style.removeProperty("will-change");
  block.dataset.kwPageIndex = "0";
  block.dataset.kwPageShift = "0";
  block.removeAttribute("data-kw-pagination-overflow");
  block.removeAttribute("data-kw-soft-pagination-shift");
}

function areRetentionMasksEqual(
  left: KnexWriterRetentionMaskRect[],
  right: KnexWriterRetentionMaskRect[],
) {
  if (left.length !== right.length) return false;

  for (let index = 0; index < left.length; index += 1) {
    if (
      Math.abs(left[index].topPx - right[index].topPx) > 0.5 ||
      Math.abs(left[index].heightPx - right[index].heightPx) > 0.5
    ) {
      return false;
    }
  }

  return true;
}

function collectRenderedTextLineRects(args: {
  editorDom: HTMLElement;
  wrapperRect: DOMRect;
  cssScale: number;
}) {
  const { editorDom, wrapperRect, cssScale } = args;
  const fragments: Array<{ topPx: number; bottomPx: number; centerPx: number }> = [];
  const walker = document.createTreeWalker(
    editorDom,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        if (!(node instanceof Text)) return NodeFilter.FILTER_REJECT;
        if (!node.textContent || !node.textContent.trim()) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );

  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text;
    const range = document.createRange();
    range.selectNodeContents(textNode);
    const rects = Array.from(range.getClientRects());

    for (const rect of rects) {
      if (rect.height <= 0 || rect.width <= 0) continue;
      const topPx = (rect.top - wrapperRect.top) / cssScale;
      const bottomPx = (rect.bottom - wrapperRect.top) / cssScale;
      fragments.push({
        topPx,
        bottomPx,
        centerPx: (topPx + bottomPx) / 2,
      });
    }
  }

  fragments.sort((left, right) =>
    left.centerPx === right.centerPx
      ? left.topPx - right.topPx
      : left.centerPx - right.centerPx,
  );

  const merged: Array<{ topPx: number; bottomPx: number; centerPx: number }> = [];
  const LINE_MERGE_CENTER_TOLERANCE_PX = 3.5;

  for (const fragment of fragments) {
    const previous = merged[merged.length - 1];
    if (previous && Math.abs(previous.centerPx - fragment.centerPx) <= LINE_MERGE_CENTER_TOLERANCE_PX) {
      previous.topPx = Math.min(previous.topPx, fragment.topPx);
      previous.bottomPx = Math.max(previous.bottomPx, fragment.bottomPx);
      previous.centerPx = (previous.topPx + previous.bottomPx) / 2;
      continue;
    }

    merged.push({ ...fragment });
  }

  return merged.map(({ topPx, bottomPx }) => ({ topPx, bottomPx }));
}

function buildRetentionMasksFromRenderedLines(args: {
  lines: Array<{ topPx: number; bottomPx: number }>;
  pageCount: number;
  pageHeightPx: number;
  pageStridePx: number;
  bodyTopPx: number;
  bodyBottomPx: number;
}) {
  const {
    lines,
    pageCount,
    pageHeightPx,
    pageStridePx,
    bodyTopPx,
    bodyBottomPx,
  } = args;

  const masks: KnexWriterRetentionMaskRect[] = [];

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const pageTopPx = pageIndex * pageStridePx;
    const pageBottomPx = pageTopPx + pageHeightPx;
    const bodyTopLimitPx = pageTopPx + bodyTopPx;
    const bodyBottomLimitPx = pageTopPx + pageHeightPx - bodyBottomPx;

    const pageLines = lines.filter(
      (line) => line.bottomPx > bodyTopLimitPx + 0.5 && line.topPx < bodyBottomLimitPx - 0.5,
    );

    const firstLine = pageLines[0];
    const fullyVisibleLines = pageLines.filter(
      (line) => line.bottomPx <= bodyBottomLimitPx + 0.5,
    );
    const lastLine = fullyVisibleLines[fullyVisibleLines.length - 1];

    const safeTopPx = firstLine
      ? Math.max(bodyTopLimitPx, Math.min(firstLine.topPx, bodyBottomLimitPx))
      : bodyTopLimitPx;

    const safeBottomPx = lastLine
      ? Math.max(safeTopPx, Math.min(lastLine.bottomPx, bodyBottomLimitPx))
      : bodyBottomLimitPx;

    const hardTopMaskEndPx = bodyTopLimitPx;
    const topMaskEndPx = Math.max(hardTopMaskEndPx, safeTopPx);
    const topMaskHeightPx = Math.max(0, topMaskEndPx - pageTopPx);
    if (topMaskHeightPx > 0.5) {
      masks.push({
        topPx: pageTopPx,
        heightPx: topMaskHeightPx,
      });
    }

    const hardBottomMaskStartPx = bodyBottomLimitPx;
    const bottomMaskStartPx = Math.min(hardBottomMaskStartPx, safeBottomPx);
    const bottomMaskHeightPx = Math.max(0, pageBottomPx - bottomMaskStartPx);
    if (bottomMaskHeightPx > 0.5) {
      masks.push({
        topPx: bottomMaskStartPx,
        heightPx: bottomMaskHeightPx,
      });
    }
  }

  return masks;
}

export function paginateProseMirrorBlocks(args: {
  editorDom: HTMLElement;
  bodyTopPx: number;
  bodyBottomPx: number;
  pageHeightPx: number;
  pageGapPx: number;
}): KnexWriterMeasuredPagination {
  const { editorDom, bodyTopPx, bodyBottomPx, pageHeightPx, pageGapPx } = args;

  const bodyHeightPx = Math.max(1, pageHeightPx - bodyTopPx - bodyBottomPx);
  const pageStridePx = pageHeightPx + pageGapPx;
  const blocks = getDirectEditableBlocks(editorDom);

  if (blocks.length === 0) {
    return {
      pageCount: 1,
      pageBreakOffsets: [],
      pageFillRatios: [0],
      contentHeightPx: 0,
    };
  }

  for (const block of blocks) {
    resetPaginationBlock(block);
  }

  // A primeira leitura força o navegador a estabilizar offsets após a limpeza.
  void editorDom.offsetHeight;

  const maxPasses = Math.min(8, Math.max(2, blocks.length + 1));

  for (let pass = 0; pass < maxPasses; pass += 1) {
    let changed = false;

    for (const block of blocks) {
      const blockHeightPx = block.offsetHeight;

      if (blockHeightPx <= 0) {
        continue;
      }

      const currentShiftPx = Number(block.dataset.kwPageShift || "0") || 0;
      const computed = window.getComputedStyle(block);
      const currentMarginTopPx = getComputedPx(computed.marginTop);
      const blockTopInDocumentPx = bodyTopPx + block.offsetTop;
      const pageIndex = Math.max(0, Math.floor(blockTopInDocumentPx / pageStridePx));
      const pageBodyBottomPx = pageIndex * pageStridePx + pageHeightPx - bodyBottomPx;
      const blockBottomInDocumentPx = blockTopInDocumentPx + blockHeightPx;

      const isManualBreak =
        block.dataset.knexwriterPageBreak === "true" ||
        block.classList.contains("knexwriter-page-break");

      if (isManualBreak) {
        const nextPageTopPx = (pageIndex + 1) * pageStridePx + bodyTopPx;
        const shiftPx = Math.max(0, nextPageTopPx - blockTopInDocumentPx);
        const nextShiftPx = Math.max(currentShiftPx, shiftPx);
        block.dataset.kwPageShift = String(nextShiftPx);
        block.style.marginTop = `${currentMarginTopPx + (nextShiftPx - currentShiftPx)}px`;
        changed = changed || Math.abs(nextShiftPx - currentShiftPx) > 0.5;
        continue;
      }

      const blockCanMoveAsUnit = blockHeightPx <= bodyHeightPx;

      if (blockCanMoveAsUnit && blockBottomInDocumentPx > pageBodyBottomPx) {
        const nextPageBodyTopPx = (pageIndex + 1) * pageStridePx + bodyTopPx;
        const shiftPx = Math.max(0, nextPageBodyTopPx - blockTopInDocumentPx);
        const nextShiftPx = Math.max(currentShiftPx, shiftPx);
        block.dataset.kwPageShift = String(nextShiftPx);
        block.style.marginTop = `${currentMarginTopPx + (nextShiftPx - currentShiftPx)}px`;
        changed = changed || Math.abs(nextShiftPx - currentShiftPx) > 0.5;
      } else if (!blockCanMoveAsUnit) {
        block.dataset.kwPaginationOverflow = "true";
      }
    }

    if (!changed) break;
  }

  let lastBlockBottomPx = 0;
  const pageFillBottoms = new Map<number, number>();

  for (const block of blocks) {
    const blockHeightPx = block.offsetHeight;
    const blockTopPx = bodyTopPx + block.offsetTop;
    const blockBottomPx = blockTopPx + blockHeightPx;
    const pageIndex = Math.max(0, Math.floor(blockTopPx / pageStridePx));

    block.dataset.kwPageIndex = String(pageIndex);
    block.dataset.kwPageShift = block.dataset.kwPageShift || "0";

    if (blockHeightPx > bodyHeightPx) {
      block.dataset.kwPaginationOverflow = "true";
    }

    lastBlockBottomPx = Math.max(lastBlockBottomPx, blockBottomPx);
    pageFillBottoms.set(
      pageIndex,
      Math.max(pageFillBottoms.get(pageIndex) ?? 0, blockBottomPx),
    );
  }

  const pageCount = Math.max(1, Math.ceil(lastBlockBottomPx / pageStridePx));
  const pageBreakOffsets = Array.from(
    { length: Math.max(0, pageCount - 1) },
    (_unused, index) => (index + 1) * pageStridePx,
  );
  const pageFillRatios = Array.from({ length: pageCount }, (_unused, index) => {
    const pageBodyTopPx = index * pageStridePx + bodyTopPx;
    const pageBodyBottomPx = index * pageStridePx + pageHeightPx - bodyBottomPx;
    const pageLastBottomPx = Math.min(
      pageFillBottoms.get(index) ?? pageBodyTopPx,
      pageBodyBottomPx,
    );

    return clampRatio((pageLastBottomPx - pageBodyTopPx) / bodyHeightPx);
  });

  return {
    pageCount,
    pageBreakOffsets,
    pageFillRatios,
    contentHeightPx: lastBlockBottomPx,
  };
}

export function KnexWriterEditableBody({
  editor,
  editorVersion = 0,
  editorRef,
  pageIndex = 0,

  bodyLeftPx,
  bodyTopPx,
  bodyWidthPx,
  bodyBottomPx,
  stageHeightPx,

  paginationGeometry,
  pageCount = 1,
  pageGapPx,
  enableSoftPagination = true,

  pageWidthPx = DEFAULT_PAGE_WIDTH_PX,
  pageHeightPx = DEFAULT_PAGE_HEIGHT_PX,
  pageMargins = DEFAULT_PAGE_MARGINS,

  placeholder = "Digite o texto do documento...",
  editable = true,
  isActive = false,
  spellCheck = true,
  className = "",
  style,
  paragraphIndents,
  defaultFontFamily = 'Tinos, "Times New Roman", serif',
  defaultFontSizePt = 12,
  defaultLineHeight = 1.5,
  onFocusPage,
  onMeasuredPaginationChange,
}: KnexWriterEditableBodyProps) {
  const wrapperRef = useRef<HTMLElement | null>(null);
  const softPaginationFrameRef = useRef<number | null>(null);
  const focusPageFrameRef = useRef<number | null>(null);
  const lastPaginationMeasurementKeyRef = useRef("");
  const nonRegressionWarnedRef = useRef(false);
  const [retentionMasks, setRetentionMasks] = useState<KnexWriterRetentionMaskRect[]>([]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.setEditable(editable);

    const dom = editor.view.dom as HTMLElement;
    dom.setAttribute("data-placeholder", placeholder);
    dom.setAttribute("spellcheck", String(spellCheck));
    dom.setAttribute("aria-label", `Corpo do texto da página ${pageIndex + 1}`);
    dom.setAttribute("aria-multiline", "true");
    dom.setAttribute("role", "textbox");
  }, [editor, editable, pageIndex, placeholder, spellCheck]);

  const geometry = useMemo(() => {
    const resolvedPageWidthPx = Math.max(1, paginationGeometry?.pageWidthPx ?? pageWidthPx);
    const resolvedPageHeightPx = Math.max(1, paginationGeometry?.pageHeightPx ?? pageHeightPx);
    const resolvedPageGapPx = Math.max(
      0,
      paginationGeometry?.pageGapPx ?? pageGapPx ?? DEFAULT_PAGE_GAP_PX,
    );
    const resolvedPageStridePx = Math.max(
      resolvedPageHeightPx,
      paginationGeometry?.pageStridePx ?? resolvedPageHeightPx + resolvedPageGapPx,
    );

    const fallbackBodyLeftPx = clampPositive(bodyLeftPx ?? pageMargins.leftPx);
    const fallbackBodyTopPx = clampPositive(bodyTopPx ?? pageMargins.topPx);
    const fallbackBodyBottomPx = clampPositive(bodyBottomPx ?? pageMargins.bottomPx);
    const fallbackBodyWidthPx = Math.max(
      1,
      bodyWidthPx ?? resolvedPageWidthPx - fallbackBodyLeftPx - clampPositive(pageMargins.rightPx),
    );

    const safeBodyLeftPx = clampPositive(
      typeof paginationGeometry?.bodyLeftPx === "number"
        ? paginationGeometry.bodyLeftPx
        : fallbackBodyLeftPx,
    );
    const safeBodyTopPx = clampPositive(
      typeof paginationGeometry?.bodyTopPx === "number"
        ? paginationGeometry.bodyTopPx
        : fallbackBodyTopPx,
    );
    const safeBodyBottomPx = clampPositive(
      typeof paginationGeometry?.bodyBottomPx === "number"
        ? paginationGeometry.bodyBottomPx
        : fallbackBodyBottomPx,
    );
    const safeBodyWidthPx = Math.max(
      1,
      typeof paginationGeometry?.bodyWidthPx === "number"
        ? paginationGeometry.bodyWidthPx
        : fallbackBodyWidthPx,
    );
    const safeBodyHeightPx = Math.max(
      1,
      typeof paginationGeometry?.bodyHeightPx === "number"
        ? paginationGeometry.bodyHeightPx
        : resolvedPageHeightPx - safeBodyTopPx - safeBodyBottomPx,
    );
    const safeStageHeightPx = Math.max(
      resolvedPageHeightPx,
      stageHeightPx ?? resolvedPageHeightPx,
      Math.max(1, pageCount) * resolvedPageStridePx - resolvedPageGapPx,
    );

    return {
      mode: "primary" as const,
      pageWidthPx: resolvedPageWidthPx,
      pageHeightPx: resolvedPageHeightPx,
      pageGapPx: resolvedPageGapPx,
      pageStridePx: resolvedPageStridePx,
      leftPx: safeBodyLeftPx,
      topPx: 0,
      widthPx: safeBodyWidthPx,
      minHeightPx: safeStageHeightPx,
      paddingTopPx: safeBodyTopPx,
      paddingBottomPx: safeBodyBottomPx,
      bodyTopPx: safeBodyTopPx,
      bodyBottomPx: safeBodyBottomPx,
      bodyHeightPx: safeBodyHeightPx,
      proseMirrorMinHeightPx: safeBodyHeightPx,
    };
  }, [
    bodyBottomPx,
    bodyLeftPx,
    bodyTopPx,
    bodyWidthPx,
    pageCount,
    pageGapPx,
    pageHeightPx,
    pageMargins.bottomPx,
    pageMargins.leftPx,
    pageMargins.rightPx,
    pageMargins.topPx,
    pageWidthPx,
    paginationGeometry,
    stageHeightPx,
  ]);

  const textIndentPx = paragraphIndents?.firstLinePx ?? 0;
  const paragraphLeftIndentPx = paragraphIndents?.leftPx ?? 0;
  const paragraphRightIndentPx = paragraphIndents?.rightPx ?? 0;
  const paragraphHangingIndentPx = paragraphIndents?.hangingPx ?? 0;
  const normalizedLineHeight = normalizeLineHeight(defaultLineHeight);

  const getPageIndexFromClientY = useCallback(
    (clientY: number) => {
      const wrapper = wrapperRef.current;

      if (!wrapper) return pageIndex;

      const wrapperRect = wrapper.getBoundingClientRect();
      const cssScale = Math.max(0.01, wrapperRect.width / Math.max(1, geometry.widthPx));
      const localY = Math.max(0, (clientY - wrapperRect.top) / cssScale);
      const nextPageIndex = Math.floor(localY / Math.max(1, geometry.pageStridePx));

      return Math.max(0, nextPageIndex);
    },
    [geometry.pageStridePx, geometry.widthPx, pageIndex],
  );

  const notifyFocusPageFromClientY = useCallback(
    (clientY: number) => {
      if (!onFocusPage) return;

      if (focusPageFrameRef.current !== null) {
        cancelAnimationFrame(focusPageFrameRef.current);
      }

      focusPageFrameRef.current = requestAnimationFrame(() => {
        focusPageFrameRef.current = null;
        onFocusPage(getPageIndexFromClientY(clientY));
      });
    },
    [getPageIndexFromClientY, onFocusPage],
  );

  const getPageIndexFromEditorSelection = useCallback(() => {
    if (!editor) return null;

    const editorDom = editor.view.dom as HTMLElement | null;

    if (!editorDom) return null;

    const { node } = editor.view.domAtPos(editor.state.selection.from);
    let element: HTMLElement | null =
      node instanceof HTMLElement ? node : node.parentElement;

    while (element && element !== editorDom) {
      const pageIndexAttribute = element.getAttribute("data-kw-page-index");

      if (pageIndexAttribute != null) {
        const parsedPageIndex = Number(pageIndexAttribute);

        if (Number.isFinite(parsedPageIndex)) {
          return Math.max(0, Math.round(parsedPageIndex));
        }
      }

      element = element.parentElement;
    }

    return null;
  }, [editor]);

  const notifyFocusPageFromSelection = useCallback(() => {
    if (!editor || !onFocusPage) return;

    if (focusPageFrameRef.current !== null) {
      cancelAnimationFrame(focusPageFrameRef.current);
    }

    focusPageFrameRef.current = requestAnimationFrame(() => {
      focusPageFrameRef.current = null;

      const selectedPageIndex = getPageIndexFromEditorSelection();

      if (selectedPageIndex != null) {
        onFocusPage(selectedPageIndex);
        return;
      }

      try {
        const coords = editor.view.coordsAtPos(editor.state.selection.from);
        onFocusPage(getPageIndexFromClientY((coords.top + coords.bottom) / 2));
      } catch {
        // During typing ProseMirror can briefly expose an unresolved DOM position.
        // Preserve the current active page instead of falling back to page 1.
      }
    });
  }, [
    editor,
    getPageIndexFromClientY,
    getPageIndexFromEditorSelection,
    onFocusPage,
  ]);

  const scheduleSoftPagination = useCallback(() => {
    if (!editor || !enableSoftPagination) {
      return;
    }

    if (softPaginationFrameRef.current !== null) {
      cancelAnimationFrame(softPaginationFrameRef.current);
    }

    softPaginationFrameRef.current = requestAnimationFrame(() => {
      softPaginationFrameRef.current = null;

      const editorDom = editor.view.dom as HTMLElement | null;
      const wrapperRect = wrapperRef.current?.getBoundingClientRect();
      if (!editorDom || !wrapperRect) return;
      const cssScale = Math.max(0.01, wrapperRect.width / Math.max(1, geometry.widthPx));
      const scaledStage = wrapperRef.current?.closest(
        '[data-knexwriter-scaled-stage="true"]',
      ) as HTMLElement | null;
      const hasPageGapMaskLayer = Boolean(
        scaledStage?.querySelector('[data-knexwriter-page-gap-mask-layer="true"]') ||
          document.querySelector('[data-knexwriter-page-gap-mask-layer="true"]'),
      );

      const measurement = paginateProseMirrorBlocks({
        editorDom,
        bodyTopPx: geometry.bodyTopPx,
        bodyBottomPx: geometry.bodyBottomPx,
        pageHeightPx: geometry.pageHeightPx,
        pageGapPx: geometry.pageGapPx,
      });

      const measurementKey = [
        measurement.pageCount,
        Math.round(measurement.contentHeightPx),
        measurement.pageBreakOffsets.map((offset) => Math.round(offset)).join(","),
        measurement.pageFillRatios.map((ratio) => ratio.toFixed(3)).join(","),
      ].join("|");

      if (measurementKey !== lastPaginationMeasurementKeyRef.current) {
        lastPaginationMeasurementKeyRef.current = measurementKey;
        onMeasuredPaginationChange?.(measurement);
      }

      const lines = collectRenderedTextLineRects({
        editorDom,
        wrapperRect,
        cssScale,
      });
      const renderedPageCount = Math.max(1, pageCount);
      const measuredPageCount = Math.max(1, measurement.pageCount);

      const nextRetentionMasks = buildRetentionMasksFromRenderedLines({
        lines,
        /**
         * Importante:
         * usar páginas medidas aqui cria "máscaras fantasmas" durante a
         * transição 1 -> N páginas (antes do Stage renderizar a nova folha).
         * A retenção precisa refletir apenas as páginas já renderizadas.
         */
        pageCount: renderedPageCount,
        pageHeightPx: geometry.pageHeightPx,
        pageStridePx: geometry.pageStridePx,
        bodyTopPx: geometry.bodyTopPx,
        bodyBottomPx: geometry.bodyBottomPx,
      });

      setRetentionMasks((current) =>
        areRetentionMasksEqual(current, nextRetentionMasks)
          ? current
          : nextRetentionMasks,
      );

      if (process.env.NODE_ENV !== "production") {
        const requiresPageGapMask = renderedPageCount > 1;
        const isPaginationTransitioning = measuredPageCount > renderedPageCount;
        try {
          assertKnexWriterNonRegression({
            featureLineAwareRetentionEnabled: true,
            featureBodyBoundsRetentionEnabled: true,
            featurePageGapMaskEnabled: requiresPageGapMask
              ? hasPageGapMaskLayer || isPaginationTransitioning || !scaledStage
              : true,
            featureCursorPlacementFallbackEnabled: true,
            masks: nextRetentionMasks,
            pageCount: renderedPageCount,
            pageHeightPx: geometry.pageHeightPx,
            pageStridePx: geometry.pageStridePx,
            bodyTopPx: geometry.bodyTopPx,
            bodyBottomPx: geometry.bodyBottomPx,
          });
        } catch (error) {
          if (!nonRegressionWarnedRef.current) {
            nonRegressionWarnedRef.current = true;
            console.error(error);
          }
        }
      }
    });
  }, [
    editor,
    enableSoftPagination,
    geometry.bodyBottomPx,
    geometry.bodyTopPx,
    geometry.pageGapPx,
    geometry.pageHeightPx,
    geometry.pageStridePx,
    pageCount,
    onMeasuredPaginationChange,
  ]);

  useEffect(() => {
    if (!editor || !enableSoftPagination) {
      setRetentionMasks((current) => (current.length === 0 ? current : []));
    }
  }, [editor, enableSoftPagination]);

  useEffect(() => {
    if (!editor || !enableSoftPagination) {
      return;
    }

    scheduleSoftPagination();

    const handleUpdate = () => {
      scheduleSoftPagination();
      notifyFocusPageFromSelection();
    };
    const handleSelectionUpdate = () => {
      scheduleSoftPagination();
      notifyFocusPageFromSelection();
    };

    editor.on("update", handleUpdate);
    editor.on("selectionUpdate", handleSelectionUpdate);

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => scheduleSoftPagination())
        : null;

    if (resizeObserver) {
      resizeObserver.observe(editor.view.dom);
    }

    window.addEventListener("resize", scheduleSoftPagination);

    return () => {
      editor.off("update", handleUpdate);
      editor.off("selectionUpdate", handleSelectionUpdate);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleSoftPagination);

      if (softPaginationFrameRef.current !== null) {
        cancelAnimationFrame(softPaginationFrameRef.current);
        softPaginationFrameRef.current = null;
      }

      if (focusPageFrameRef.current !== null) {
        cancelAnimationFrame(focusPageFrameRef.current);
        focusPageFrameRef.current = null;
      }
    };
  }, [
    editor,
    enableSoftPagination,
    notifyFocusPageFromSelection,
    scheduleSoftPagination,
  ]);

  useEffect(() => {
    scheduleSoftPagination();
  }, [editorVersion, pageCount, scheduleSoftPagination]);

  const focusEditorAtEnd = useCallback(() => {
    if (!editor || !editable) {
      return;
    }

    editor.commands.focus("end");
  }, [editable, editor]);

  const resolvePrintableClientPoint = useCallback(
    (container: HTMLElement, clientX: number, clientY: number) => {
      const rect = container.getBoundingClientRect();
      const localY = Math.max(0, clientY - rect.top);
      const pageStridePx = Math.max(1, geometry.pageStridePx);
      const pageIndex = Math.max(0, Math.floor(localY / pageStridePx));
      const yInPage = localY - pageIndex * pageStridePx;
      const bodyTopPx = geometry.bodyTopPx;
      const bodyBottomLimitPx = geometry.pageHeightPx - geometry.bodyBottomPx - 1;
      const clampedYInPage = Math.min(
        Math.max(yInPage, bodyTopPx),
        Math.max(bodyTopPx, bodyBottomLimitPx),
      );
      const clampedLocalY = pageIndex * pageStridePx + clampedYInPage;

      return {
        x: Math.min(Math.max(clientX, rect.left + 2), rect.right - 2),
        y: rect.top + clampedLocalY,
      };
    },
    [
      geometry.bodyBottomPx,
      geometry.bodyTopPx,
      geometry.pageHeightPx,
      geometry.pageStridePx,
    ],
  );

  const focusEditorAtClientPoint = useCallback(
    (container: HTMLElement, clientX: number, clientY: number) => {
      if (!editor || !editable) {
        return;
      }

      const point = resolvePrintableClientPoint(container, clientX, clientY);
      const viewRect = editor.view.dom.getBoundingClientRect();
      const clampedX = Math.min(Math.max(point.x, viewRect.left + 2), viewRect.right - 2);
      const clampedY = Math.min(Math.max(point.y, viewRect.top + 2), viewRect.bottom - 2);

      const candidatePoints = [
        { left: clampedX, top: clampedY },
        { left: clampedX, top: clampedY - 2 },
        { left: clampedX, top: clampedY + 2 },
        { left: clampedX - 6, top: clampedY },
        { left: clampedX + 6, top: clampedY },
        { left: viewRect.left + 4, top: clampedY },
        { left: viewRect.right - 4, top: clampedY },
      ];

      for (const candidate of candidatePoints) {
        const position = editor.view.posAtCoords(candidate);
        if (position?.pos != null) {
          editor.chain().focus().setTextSelection(position.pos).run();
          return;
        }
      }

      focusEditorAtEnd();
    },
    [editable, editor, focusEditorAtEnd, resolvePrintableClientPoint],
  );

  const handleWrapperMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      notifyFocusPageFromClientY(event.clientY);

      if (!editor || !editable) {
        return;
      }

      const container = event.currentTarget;
      const rect = container.getBoundingClientRect();
      const localY = Math.max(0, event.clientY - rect.top);
      const pageStridePx = Math.max(1, geometry.pageStridePx);
      const pageIndexFromY = Math.max(0, Math.floor(localY / pageStridePx));
      const yInPage = localY - pageIndexFromY * pageStridePx;
      const bodyTopPx = geometry.bodyTopPx;
      const bodyBottomPx = geometry.pageHeightPx - geometry.bodyBottomPx;
      const clickInsidePrintableBody =
        yInPage >= bodyTopPx && yInPage <= bodyBottomPx;

      const target = event.target as HTMLElement | null;
      const clickedInsideEditor = Boolean(target?.closest(".ProseMirror"));

      if (!clickInsidePrintableBody || !clickedInsideEditor) {
        event.preventDefault();
        event.stopPropagation();
        focusEditorAtClientPoint(container, event.clientX, event.clientY);
      }
    },
    [
      editable,
      editor,
      focusEditorAtClientPoint,
      geometry.bodyBottomPx,
      geometry.bodyTopPx,
      geometry.pageHeightPx,
      geometry.pageStridePx,
      notifyFocusPageFromClientY,
      pageIndex,
    ],
  );

  const handleWrapperClick = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      if (!editor || !editable) {
        return;
      }

      const target = event.target as HTMLElement | null;

      /**
       * Se o clique foi no vazio do wrapper, focamos o editor.
       * Se o clique foi dentro da ProseMirror, deixamos o navegador/ProseMirror
       * cuidar da seleção e do cursor.
       */
      if (
        target &&
        !target.closest(".ProseMirror") &&
        !target.closest("[data-knexwriter-editor-content=true]")
      ) {
        focusEditorAtClientPoint(event.currentTarget, event.clientX, event.clientY);
      }
    },
    [editable, editor, focusEditorAtClientPoint],
  );

  const handleEditorFocusCapture = useCallback(() => {
    notifyFocusPageFromSelection();
  }, [notifyFocusPageFromSelection]);

  const editorVariables = {
    ["--kw-paragraph-left-indent" as string]: `${paragraphLeftIndentPx}px`,
    ["--kw-paragraph-right-indent" as string]: `${paragraphRightIndentPx}px`,
    ["--kw-paragraph-first-line-indent" as string]: `${textIndentPx}px`,
    ["--kw-paragraph-hanging-indent" as string]: `${paragraphHangingIndentPx}px`,
    ["--kw-editor-min-height" as string]: `${geometry.proseMirrorMinHeightPx}px`,
    ["--kw-editor-font-family" as string]: defaultFontFamily,
    ["--kw-editor-font-size" as string]: `${defaultFontSizePt}pt`,
    ["--kw-editor-line-height" as string]: normalizedLineHeight,
    ["--kw-editor-color" as string]: "#18181b",
    ["--kw-manual-page-break-height" as string]: `${geometry.bodyHeightPx}px`,
  } as CSSProperties & Record<string, string>;

  const wrapperStyle: CSSProperties = {
    position: "absolute",
    left: geometry.leftPx,
    top: geometry.topPx,
    width: geometry.widthPx,
    minHeight: geometry.minHeightPx,
    zIndex: 2,
    boxSizing: "border-box",
    paddingTop: geometry.paddingTopPx,
    paddingBottom: geometry.paddingBottomPx,
    overflow: "visible",
    fontFamily: defaultFontFamily,
    fontSize: `${defaultFontSizePt}pt`,
    lineHeight: normalizedLineHeight,
    color: "#18181b",
    ...editorVariables,
    ...style,
  };

  return (
    <section
      ref={wrapperRef}
      data-knexwriter-editable-body-wrapper="true"
      data-knexwriter-editable-body-mode={geometry.mode}
      data-page-index={pageIndex}
      className={[
        "knexwriter-editable-body-wrapper",
        "absolute",
        "bg-transparent",
        "text-black",
        "outline-none",
        isActive ? "ring-0" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={wrapperStyle}
      onMouseDown={handleWrapperMouseDown}
      onClick={handleWrapperClick}
      onFocus={() => handleEditorFocusCapture()}
    >
      <style
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: KNEXWRITER_EDITABLE_BODY_CSS,
        }}
      />

      {retentionMasks.length > 0 ? (
        <div
          data-knexwriter-line-aware-retention-mask-layer="true"
          className="pointer-events-none absolute inset-0 z-[20]"
          aria-hidden="true"
        >
          {retentionMasks.map((maskRect, index) => (
            <div
              key={`retention-mask-${index}`}
              className="absolute left-0"
              style={{
                top: maskRect.topPx,
                width: "100%",
                height: maskRect.heightPx,
                backgroundColor: "#ffffff",
              }}
            />
          ))}
        </div>
      ) : null}

      {editor ? (
        <EditorContent
          key={`knexwriter-editor-${editorVersion}`}
          ref={editorRef}
          editor={editor}
          spellCheck={spellCheck}
          data-knexwriter-editor-content="true"
          data-placeholder={placeholder}
          onFocusCapture={handleEditorFocusCapture}
          className={[
            "knexwriter-editor",
            "relative",
            "z-[3]",
            "text-zinc-900",
            "outline-none",
            "selection:bg-lime-300/70",
            "[&_.ProseMirror>*:first-child]:!mt-0",
            "[&_.ProseMirror>*:first-child]:!pt-0",
            "[&_.ProseMirror]:outline-none",
          ].join(" ")}
        />
      ) : (
        <div
          data-knexwriter-editor-runtime="initializing"
          aria-hidden="true"
          className="pointer-events-none h-full w-full"
        />
      )}
    </section>
  );
}

export default KnexWriterEditableBody;
