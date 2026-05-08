"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
  type FormEvent,
} from "react";

export type KnexWriterHeaderAreaProps = {
  pageIndex: number;
  pageNumber: number;
  pageCount?: number;
  sectionIndex?: number;

  pageWidthPx: number;
  bodyLeftPx: number;
  bodyWidthPx: number;
  headerTopPx: number;
  headerHeightPx: number;

  headerHtml?: string;
  isEditing?: boolean;
  showGuide?: boolean;

  sameAsPrevious?: boolean;
  differentFirstPage?: boolean;
  differentOddEvenPages?: boolean;

  className?: string;
  style?: CSSProperties;

  onOpenHeaderEditor?: () => void;
  onChangeHeaderHtml?: (html: string) => void;
  onMeasureHeaderHeight?: (heightPx: number) => void;
  onFocusPage?: (pageIndex: number) => void;
};

const EMPTY_HTML_VALUES = new Set(["", "<br>", "<br/>", "<p></p>", "<div></div>"]);

function isHtmlEmpty(value: string | undefined) {
  const normalized = (value ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/<br\s*\/?>/gi, "<br>")
    .trim();

  if (EMPTY_HTML_VALUES.has(normalized.toLowerCase())) {
    return true;
  }

  const textOnly = normalized
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return !textOnly && !/<img|<table|<svg|<hr/i.test(normalized);
}

function getSectionNumber(sectionIndex: number | undefined, pageIndex: number) {
  if (typeof sectionIndex === "number" && Number.isFinite(sectionIndex)) {
    return Math.max(1, sectionIndex + 1);
  }

  return Math.max(1, pageIndex + 1);
}

function measureEditableHeight(node: HTMLDivElement | null) {
  if (!node) return 0;

  const rect = node.getBoundingClientRect();
  const scrollHeight = node.scrollHeight;
  const offsetHeight = node.offsetHeight;

  return Math.ceil(Math.max(rect.height, scrollHeight, offsetHeight, 1));
}

/**
 * Cabeçalho com comportamento próximo ao Word:
 * - sem caixa retangular envolvendo a área;
 * - linha horizontal inferior em modo de edição;
 * - etiqueta abaixo da linha horizontal para não esconder o conteúdo;
 * - sem barra de rolagem;
 * - quando o conteúdo cresce, o Stage aumenta a altura do cabeçalho e desloca
 *   a linha horizontal para baixo.
 */
export function KnexWriterHeaderArea({
  pageIndex,
  pageNumber,
  pageCount = 1,
  sectionIndex,
  pageWidthPx,
  bodyLeftPx,
  bodyWidthPx,
  headerTopPx,
  headerHeightPx,
  headerHtml = "",
  isEditing = false,
  showGuide = false,
  sameAsPrevious = false,
  className = "",
  style,
  onOpenHeaderEditor,
  onChangeHeaderHtml,
  onMeasureHeaderHeight,
  onFocusPage,
}: KnexWriterHeaderAreaProps) {
  const editableRef = useRef<HTMLDivElement | null>(null);
  const latestHtmlRef = useRef(headerHtml);
  const frameRef = useRef<number | null>(null);

  const hasContent = !isHtmlEmpty(headerHtml);
  const sectionNumber = getSectionNumber(sectionIndex, pageIndex);

  const scheduleMeasure = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
    }

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;

      const measuredHeightPx = measureEditableHeight(editableRef.current);
      onMeasureHeaderHeight?.(measuredHeightPx);
    });
  }, [onMeasureHeaderHeight]);

  useEffect(() => {
    latestHtmlRef.current = headerHtml;
  }, [headerHtml]);

  useEffect(() => {
    const node = editableRef.current;
    if (!node) return;

    const isFocused = node === document.activeElement;

    if (!isFocused && node.innerHTML !== headerHtml) {
      node.innerHTML = headerHtml || "";
    }

    scheduleMeasure();
  }, [headerHtml, isEditing, scheduleMeasure]);

  useEffect(() => {
    const node = editableRef.current;
    if (!node || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => scheduleMeasure());
    observer.observe(node);

    return () => observer.disconnect();
  }, [scheduleMeasure]);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  const handleOpenEditor = useCallback(() => {
    onFocusPage?.(pageIndex);
    onOpenHeaderEditor?.();

    window.setTimeout(() => {
      editableRef.current?.focus();
      scheduleMeasure();
    }, 0);
  }, [onFocusPage, onOpenHeaderEditor, pageIndex, scheduleMeasure]);

  const handleInput = useCallback(
    (event: FormEvent<HTMLDivElement>) => {
      latestHtmlRef.current = event.currentTarget.innerHTML;
      onChangeHeaderHtml?.(event.currentTarget.innerHTML);
      scheduleMeasure();
    },
    [onChangeHeaderHtml, scheduleMeasure],
  );

  return (
    <header
      data-knexwriter-header-area="true"
      data-page-index={pageIndex}
      data-page-number={pageNumber}
      data-page-count={pageCount}
      data-section-index={sectionIndex ?? pageIndex}
      className={["absolute overflow-visible", className].filter(Boolean).join(" ")}
      style={{
        left: 0,
        top: headerTopPx,
        width: pageWidthPx,
        height: headerHeightPx,
        boxSizing: "border-box",
        pointerEvents: "none",
        ...style,
      }}
    >
      {!isEditing ? (
        <div
          data-knexwriter-header-activation-zone="true"
          aria-label={`Abrir cabeçalho da página ${pageNumber}`}
          title="Clique duas vezes para editar o cabeçalho"
          className="absolute inset-0"
          style={{
            pointerEvents: "auto",
            cursor: "text",
          }}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onDoubleClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            handleOpenEditor();
          }}
        />
      ) : null}

      {isEditing ? (
        <>
          <div
            aria-hidden="true"
            data-knexwriter-header-separator="true"
            className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-zinc-500"
            style={{
              top: headerHeightPx,
            }}
          />

          {showGuide ? (
            <>
              <span
                data-knexwriter-header-guide-label="true"
                className="pointer-events-none absolute rounded-sm border border-zinc-500 bg-zinc-100 px-2 py-0.5 text-[10px] leading-none text-zinc-700 shadow-sm"
                style={{
                  left: bodyLeftPx,
                  top: headerHeightPx + 4,
                }}
              >
                Cabeçalho - Seção {sectionNumber} -
              </span>

              {sameAsPrevious ? (
                <span
                  data-knexwriter-header-same-as-previous="true"
                  className="pointer-events-none absolute rounded-sm border border-zinc-500 bg-zinc-100 px-2 py-0.5 text-[10px] leading-none text-zinc-700 shadow-sm"
                  style={{
                    right: bodyLeftPx,
                    top: headerHeightPx + 4,
                  }}
                >
                  Mesmo que a seção anterior
                </span>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      <div
        data-knexwriter-header-content-shell="true"
        className="absolute bg-transparent"
        style={{
          left: bodyLeftPx,
          top: 0,
          width: bodyWidthPx,
          minHeight: headerHeightPx,
          boxSizing: "border-box",
          pointerEvents: isEditing ? "auto" : "none",
        }}
      >
        <div
          ref={editableRef}
          data-knexwriter-header-editable="true"
          role="textbox"
          aria-label={`Cabeçalho da página ${pageNumber}`}
          aria-multiline="true"
          contentEditable={isEditing}
          suppressContentEditableWarning
          spellCheck={false}
          tabIndex={isEditing ? 0 : -1}
          className={[
            "relative z-[2] min-h-full w-full bg-transparent text-center text-[11px] text-zinc-600 outline-none",
            isEditing
              ? "cursor-text overflow-visible whitespace-pre-wrap break-words px-2 pb-1 pt-5"
              : "pointer-events-none overflow-hidden px-2 py-1",
            !isEditing && !hasContent ? "opacity-0" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{
            fontFamily: 'Tinos, "Times New Roman", serif',
            lineHeight: 1.25,
            boxSizing: "border-box",
          }}
          onInput={handleInput}
          onPointerDown={(event) => {
            if (isEditing) {
              event.stopPropagation();
              onFocusPage?.(pageIndex);
            }
          }}
          onClick={(event) => {
            if (isEditing) {
              event.stopPropagation();
            }
          }}
          onFocus={() => onFocusPage?.(pageIndex)}
        />
      </div>
    </header>
  );
}

export default KnexWriterHeaderArea;
