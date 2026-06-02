"use client";

import { useEffect, useMemo, type SyntheticEvent } from "react";
import type { KnexPdfBlueprintElement } from "../../core/KnexPdfBlueprintTypes";
import type { PdfVisualTextRun } from "../text/PdfVisualTextModelBuilder";
import {
  createPdfBlueprintTextDiagnostics,
  logPdfBlueprintTextDiagnostics,
} from "../text/PdfTextLayerDiagnostics";

export type PdfHtmlTextRendererProps = {
  elements: KnexPdfBlueprintElement[];
};

const BLUEPRINT_ELEMENT_RENDERER_SENTINEL = "KnexPdfBlueprintElementRenderer";

type BlueprintTextRun = PdfVisualTextRun & { type?: "text" };

type TextRunGeometry = {
  run: BlueprintTextRun;
  id: string;
  text: string;
  pageNumber: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: "normal" | "italic";
  lineHeight: number;
  letterSpacing: number;
  wordSpacing: number;
};

type TextLineSegment = {
  id: string;
  pageNumber: number;
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: "normal" | "italic";
  lineHeight: number;
  letterSpacing: number;
  wordSpacing: number;
  runCount: number;
};

function stopTextLayerEvent(event: SyntheticEvent) {
  /*
   * Não usar preventDefault aqui.
   *
   * preventDefault bloqueia a seleção nativa. O objetivo é apenas impedir que
   * o viewer/leitor receba o evento como pan/drag/scroll e colapse a seleção.
   */
  event.stopPropagation();
}

function getGlobalBoolean(key: string): boolean {
  if (typeof globalThis === "undefined") return false;

  const value = (globalThis as unknown as Record<string, unknown>)[key];

  return value === true || value === "true" || value === "1";
}

function isBlueprintTextDebugEnabled(): boolean {
  return (
    getGlobalBoolean("KNEX_PDF_DEBUG_RENDER") ||
    getGlobalBoolean("KNEX_PDF_DEBUG_TEXT_LAYER") ||
    getGlobalBoolean("KNEX_PDF_DEBUG_BLUEPRINT_TEXT")
  );
}

function isTextElement(
  element: KnexPdfBlueprintElement,
): element is BlueprintTextRun {
  return (
    (element as { type?: string }).type === "text" ||
    typeof (element as { text?: unknown }).text === "string"
  );
}

export function getBlueprintTextElements(
  elements: KnexPdfBlueprintElement[],
): BlueprintTextRun[] {
  return elements.filter(isTextElement);
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function roundCss(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function normalizeText(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function getRunLeft(run: BlueprintTextRun): number {
  return safeNumber(
    (run as { left?: number; x?: number }).left,
    safeNumber((run as { x?: number }).x, 0),
  );
}

function getRunTop(run: BlueprintTextRun): number {
  return safeNumber(
    (run as { top?: number; y?: number }).top,
    safeNumber((run as { y?: number }).y, 0),
  );
}

function toRunGeometry(run: BlueprintTextRun): TextRunGeometry | null {
  const text = normalizeText(run.text ?? "");
  if (!text) return null;

  const left = getRunLeft(run);
  const top = getRunTop(run);
  const width = Math.max(0, safeNumber(run.width, 0));
  const height = Math.max(0, safeNumber(run.height, 0));

  if (width <= 0 || height <= 0) return null;

  return {
    run,
    id: run.id,
    text,
    pageNumber: safeNumber(run.pageNumber, 0),
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    fontFamily: run.fontFamily || '"Times New Roman", Times, serif',
    fontSize: Math.max(1, safeNumber(run.fontSize, height)),
    fontWeight: String(run.fontWeight ?? "400"),
    fontStyle: run.fontStyle === "italic" ? "italic" : "normal",
    lineHeight: Math.max(1, safeNumber(run.lineHeight, height)),
    letterSpacing: safeNumber(run.letterSpacing, 0),
    wordSpacing: safeNumber((run as { wordSpacing?: number }).wordSpacing, 0),
  };
}

function dedupeRunsByTextAndGeometry(
  runs: TextRunGeometry[],
): TextRunGeometry[] {
  const map = new Map<string, TextRunGeometry>();

  for (const run of runs) {
    const key = [
      run.pageNumber,
      roundTo(run.top, 2),
      roundTo(run.left, 2),
      roundTo(run.width, 2),
      roundTo(run.height, 2),
      run.text.toLowerCase(),
    ].join("|");

    if (!map.has(key)) {
      map.set(key, run);
    }
  }

  return Array.from(map.values());
}

function shouldInsertSpace(input: {
  previous: TextRunGeometry;
  current: TextRunGeometry;
  gap: number;
}): boolean {
  const { previous, current, gap } = input;
  const previousText = previous.text;
  const currentText = current.text;

  if (!previousText || !currentText) return false;
  if (/\s$/.test(previousText) || /^\s/.test(currentText)) return false;
  if (/^[,.;:!?%)}\]»”’]/.test(currentText)) return false;
  if (/[({\[«“‘]$/.test(previousText)) return false;

  const threshold = Math.max(2.5, previous.height * 0.14);

  return gap > threshold;
}

function concatenateLineText(items: TextRunGeometry[]): string {
  let text = "";

  for (let index = 0; index < items.length; index += 1) {
    const current = items[index];
    const previous = items[index - 1];

    if (!previous) {
      text += current.text;
      continue;
    }

    const gap = current.left - previous.right;

    if (shouldInsertSpace({ previous, current, gap })) {
      text += " ";
    }

    text += current.text;
  }

  return normalizeText(text);
}

function chooseDominantRun(items: TextRunGeometry[]): TextRunGeometry {
  return [...items].sort((a, b) => b.height * b.width - a.height * a.width)[0];
}

function buildLineBuckets(runs: TextRunGeometry[]): TextRunGeometry[][] {
  const sorted = [...runs].sort((a, b) => {
    if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;

    const tolerance = Math.max(4, Math.min(a.height, b.height) * 0.55);
    if (Math.abs(a.top - b.top) <= tolerance) return a.left - b.left;

    return a.top - b.top;
  });

  const lines: Array<{
    pageNumber: number;
    top: number;
    center: number;
    height: number;
    items: TextRunGeometry[];
  }> = [];

  for (const item of sorted) {
    const itemCenter = item.top + item.height / 2;
    let targetLine:
      | {
          pageNumber: number;
          top: number;
          center: number;
          height: number;
          items: TextRunGeometry[];
        }
      | undefined;

    for (const line of lines) {
      if (line.pageNumber !== item.pageNumber) continue;

      const tolerance = Math.max(5, Math.min(line.height, item.height) * 0.65);

      if (Math.abs(line.center - itemCenter) <= tolerance) {
        targetLine = line;
        break;
      }
    }

    if (!targetLine) {
      targetLine = {
        pageNumber: item.pageNumber,
        top: item.top,
        center: itemCenter,
        height: item.height,
        items: [],
      };
      lines.push(targetLine);
    }

    targetLine.items.push(item);

    const sortedLineItems = targetLine.items;
    const minTop = Math.min(...sortedLineItems.map((run) => run.top));
    const maxBottom = Math.max(...sortedLineItems.map((run) => run.bottom));

    targetLine.top = minTop;
    targetLine.height = Math.max(1, maxBottom - minTop);
    targetLine.center = minTop + targetLine.height / 2;
  }

  return lines
    .sort((a, b) => {
      if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;
      return a.top - b.top;
    })
    .map((line) => line.items.sort((a, b) => a.left - b.left));
}

function getAverageCharWidth(item: TextRunGeometry): number {
  const textLength = Math.max(1, item.text.replace(/\s+/g, "").length);

  return Math.max(1, item.width / textLength);
}

function getColumnAwareSplitThreshold(input: {
  previous: TextRunGeometry;
  current: TextRunGeometry;
}): number {
  const previousCharWidth = getAverageCharWidth(input.previous);
  const currentCharWidth = getAverageCharWidth(input.current);
  const averageCharWidth = (previousCharWidth + currentCharWidth) / 2;
  const averageHeight = Math.max(1, (input.previous.height + input.current.height) / 2);

  /*
   * Este limiar é intencionalmente menor que o antigo.
   *
   * O limiar anterior, baseado em ~2.4x a altura da linha, era largo demais
   * para artigos em duas colunas: o espaço entre a coluna esquerda e a direita
   * podia ser interpretado como apenas um grande espaço dentro da mesma linha,
   * criando um único span atravessando as duas colunas.
   *
   * Aqui usamos uma regra mais sensível a colunas:
   * - espaços normais entre palavras geralmente ficam abaixo de 12-18px;
   * - vãos entre colunas costumam ultrapassar esse valor;
   * - tabelas e blocos com grandes lacunas também devem virar segmentos.
   */
  return Math.max(16, Math.min(28, averageCharWidth * 3.25, averageHeight * 1.05));
}

function shouldSplitColumnSegment(input: {
  previous: TextRunGeometry;
  current: TextRunGeometry;
  gap: number;
}): boolean {
  if (input.gap <= 0) return false;

  /*
   * Não separar pontuação que veio isolada do fragmentador de texto.
   */
  if (/^[,.;:!?%)}\]»”’]/.test(input.current.text)) return false;

  const threshold = getColumnAwareSplitThreshold({
    previous: input.previous,
    current: input.current,
  });

  return input.gap > threshold;
}

function splitLineIntoSegments(items: TextRunGeometry[]): TextRunGeometry[][] {
  if (items.length <= 1) return [items];

  const segments: TextRunGeometry[][] = [];
  let currentSegment: TextRunGeometry[] = [];

  for (const item of items) {
    const previous = currentSegment[currentSegment.length - 1];

    if (!previous) {
      currentSegment.push(item);
      continue;
    }

    const gap = item.left - previous.right;

    /*
     * Gaps grandes indicam mudança de coluna, tabela ou bloco.
     * Ao separar aqui, o PdfPageView passa a enxergar cada coluna como linhas
     * independentes, impedindo que a seleção geométrica atravesse para a coluna
     * vizinha.
     */
    if (shouldSplitColumnSegment({ previous, current: item, gap })) {
      segments.push(currentSegment);
      currentSegment = [item];
      continue;
    }

    currentSegment.push(item);
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments;
}

function buildTextLineSegments(runs: BlueprintTextRun[]): TextLineSegment[] {
  const normalizedRuns = dedupeRunsByTextAndGeometry(
    runs.map(toRunGeometry).filter((run): run is TextRunGeometry => Boolean(run)),
  );

  const lineBuckets = buildLineBuckets(normalizedRuns);
  const segments: TextLineSegment[] = [];

  for (const lineItems of lineBuckets) {
    const lineSegments = splitLineIntoSegments(lineItems);

    for (const segmentItems of lineSegments) {
      const text = concatenateLineText(segmentItems);
      if (!text) continue;

      const dominant = chooseDominantRun(segmentItems);
      const left = Math.min(...segmentItems.map((run) => run.left));
      const top = Math.min(...segmentItems.map((run) => run.top));
      const right = Math.max(...segmentItems.map((run) => run.right));
      const bottom = Math.max(...segmentItems.map((run) => run.bottom));

      segments.push({
        id: `text-line-${dominant.pageNumber}-${segments.length}-${dominant.id}`,
        pageNumber: dominant.pageNumber,
        text,
        left: roundCss(left),
        top: roundCss(top),
        width: roundCss(Math.max(1, right - left)),
        height: roundCss(Math.max(1, bottom - top)),
        fontFamily: dominant.fontFamily,
        fontSize: roundCss(dominant.fontSize),
        fontWeight: dominant.fontWeight,
        fontStyle: dominant.fontStyle,
        lineHeight: roundCss(Math.max(dominant.lineHeight, bottom - top)),
        letterSpacing: 0,
        wordSpacing: 0,
        runCount: segmentItems.length,
      });
    }
  }

  return segments;
}

const TRANSPARENT_TEXT_LAYER_CSS = `
  [data-knexread-presentation-html-text-surface="true"],
  .knex-pdf-blueprint-html-text-renderer {
    pointer-events: auto !important;
    user-select: text !important;
    -webkit-user-select: text !important;
    background: transparent !important;
  }

  .knex-pdf-blueprint-html-text-line {
    pointer-events: auto !important;
    user-select: text !important;
    -webkit-user-select: text !important;
    background: transparent !important;
  }

  .knex-pdf-blueprint-html-text-line__inner {
    color: transparent !important;
    -webkit-text-fill-color: transparent !important;
    text-shadow: none !important;
    background: transparent !important;
    opacity: 1 !important;
    pointer-events: auto !important;
    user-select: text !important;
    -webkit-user-select: text !important;
    cursor: text !important;
    transform: none !important;
  }

  .knex-pdf-blueprint-html-text-line__inner::selection {
    color: transparent !important;
    -webkit-text-fill-color: transparent !important;
    background: rgba(59, 130, 246, 0.32) !important;
    text-shadow: none !important;
  }

  .knex-pdf-blueprint-html-text-line__inner::-moz-selection {
    color: transparent !important;
    background: rgba(59, 130, 246, 0.32) !important;
    text-shadow: none !important;
  }
`;

export function PdfHtmlTextRenderer({ elements }: PdfHtmlTextRendererProps) {
  const textElements = useMemo(() => getBlueprintTextElements(elements), [elements]);
  const lineSegments = useMemo(
    () => buildTextLineSegments(textElements),
    [textElements],
  );
  const pageNumber = textElements[0]?.pageNumber ?? 0;
  const diagnostics = useMemo(
    () =>
      createPdfBlueprintTextDiagnostics({
        pageNumber,
        renderMode: "blueprint",
        runs: textElements,
      }),
    [pageNumber, textElements],
  );
  useEffect(() => {
    /*
     * Diagnóstico textual é caro em páginas com muitos runs.
     * Ele não deve rodar em produção durante zoom/scroll, porque pode competir
     * com a resposta visual imediata do canvas/texto.
     */
    if (!isBlueprintTextDebugEnabled()) return;

    logPdfBlueprintTextDiagnostics({
      pageNumber,
      runs: textElements,
    });
  }, [pageNumber, textElements]);

  return (
    <div
      className="knex-pdf-blueprint-html-text-renderer"
      data-knexread-blueprint-html-text-renderer="true"
      data-knexread-blueprint-element-renderer={
        BLUEPRINT_ELEMENT_RENDERER_SENTINEL
      }
      data-knexread-blueprint-html-text-count={textElements.length}
      data-knexread-blueprint-html-line-count={lineSegments.length}
      data-knexread-blueprint-html-missing-font-runs={
        diagnostics.missingFontFamilyRuns
      }
      data-knexread-blueprint-html-generic-ui-font-runs={
        diagnostics.genericUiFontRuns
      }
      data-knexread-blueprint-html-font-families={diagnostics.fontFamilies.join(
        " | ",
      )}
      data-knexread-blueprint-html-coordinate-space="render"
      data-knexread-blueprint-html-local-transform="none"
      data-knexread-blueprint-html-scale-owner="PdfModularPageStage"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        minWidth: "100%",
        minHeight: "100%",
        maxWidth: "100%",
        maxHeight: "100%",
        overflow: "hidden",
        contain: "layout paint style",
        boxSizing: "border-box",
        transform: "none",
        transformOrigin: "0 0",
        pointerEvents: "auto",
        userSelect: "text",
        WebkitUserSelect: "text",
        fontFamily: '"Times New Roman", Times, serif',
        fontSize: "1px",
        fontWeight: 400,
        fontStyle: "normal",
        lineHeight: 1,
        letterSpacing: 0,
        wordSpacing: 0,
        textAlign: "left",
        textTransform: "none",
        textDecoration: "none",
        color: "transparent",
        WebkitTextFillColor: "transparent",
        background: "transparent",
      }}
    >
      <style>{TRANSPARENT_TEXT_LAYER_CSS}</style>

      {lineSegments.map((line) => (
        <span
          key={line.id}
          className="knex-pdf-blueprint-html-text-line"
          data-knexread-blueprint-element="text"
          data-knexread-blueprint-text-line="true"
          data-knexread-blueprint-text-line-page-number={line.pageNumber}
          data-knexread-blueprint-text-line-run-count={line.runCount}
          data-knexread-blueprint-text-line-left={line.left}
          data-knexread-blueprint-text-line-top={line.top}
          data-knexread-blueprint-text-line-width={line.width}
          data-knexread-blueprint-text-line-height={line.height}
          draggable={false}
          style={{
            position: "absolute",
            left: `${line.left}px`,
            top: `${line.top}px`,
            width: `${line.width}px`,
            height: `${line.height}px`,
            display: "block",
            margin: 0,
            padding: 0,
            border: 0,
            boxSizing: "border-box",
            overflow: "visible",
            whiteSpace: "pre",
            contain: "layout style",
            pointerEvents: "auto",
            userSelect: "text",
            WebkitUserSelect: "text",
            transform: "none",
            transformOrigin: "0 0",
          }}
        >
          <span
            className="knex-pdf-blueprint-html-text-line__inner"
            data-knexread-blueprint-text-line-inner="true"
            data-knexread-blueprint-text-inner-coordinate-space="render"
            draggable={false}
            onPointerDownCapture={stopTextLayerEvent}
            onMouseDownCapture={stopTextLayerEvent}
            onMouseMoveCapture={stopTextLayerEvent}
            onMouseUpCapture={stopTextLayerEvent}
            onClickCapture={stopTextLayerEvent}
            onDoubleClickCapture={stopTextLayerEvent}
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              margin: 0,
              padding: 0,
              border: 0,
              boxSizing: "border-box",
              overflow: "visible",
              whiteSpace: "pre",
              contain: "layout style",
              fontFamily: line.fontFamily,
              fontSize: `${line.fontSize}px`,
              fontWeight: line.fontWeight,
              fontStyle: line.fontStyle,
              lineHeight: `${line.height}px`,
              letterSpacing: `${line.letterSpacing}px`,
              wordSpacing: `${line.wordSpacing}px`,
              color: "transparent",
              WebkitTextFillColor: "transparent",
              textShadow: "none",
              background: "transparent",
              opacity: 1,
              pointerEvents: "auto",
              userSelect: "text",
              WebkitUserSelect: "text",
              cursor: "text",
              transform: "none",
              transformOrigin: "0 0",
            }}
          >
            {line.text}
          </span>
        </span>
      ))}
    </div>
  );
}
