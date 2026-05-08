"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
  type FormEvent,
} from "react";

export type KnexWriterFooterAreaProps = {
  pageIndex: number;
  pageNumber: number;
  pageCount: number;
  sectionIndex?: number;

  pageWidthPx: number;
  pageHeightPx: number;
  bodyLeftPx: number;
  bodyWidthPx: number;
  footerTopPx: number;
  footerHeightPx: number;

  footerHtml?: string;
  isEditing?: boolean;
  showGuide?: boolean;

  sameAsPrevious?: boolean;
  differentFirstPage?: boolean;
  differentOddEvenPages?: boolean;

  className?: string;
  style?: CSSProperties;

  onOpenFooterEditor?: () => void;
  onChangeFooterHtml?: (html: string) => void;
  onMeasureFooterHeight?: (heightPx: number) => void;
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
 * Rodapé com comportamento próximo ao Word:
 * - sem caixa retangular envolvendo a área;
 * - linha horizontal superior em modo de edição;
 * - etiqueta acima da linha horizontal para não esconder o conteúdo;
 * - sem barra de rolagem;
 * - quando o conteúdo cresce, o Stage aumenta a altura do rodapé e desloca
 *   a linha horizontal para cima.
 */
export function KnexWriterFooterArea({
  pageIndex,
  pageNumber,
  pageCount,
  sectionIndex,
  pageWidthPx,
  pageHeightPx,
  bodyLeftPx,
  bodyWidthPx,
  footerTopPx,
  footerHeightPx,
  footerHtml = "",
  isEditing = false,
  showGuide = false,
  sameAsPrevious = false,
  className = "",
  style,
  onOpenFooterEditor,
  onChangeFooterHtml,
  onMeasureFooterHeight,
  onFocusPage,
}: KnexWriterFooterAreaProps) {
  const editableRef = useRef<HTMLDivElement | null>(null);
  const latestHtmlRef = useRef(footerHtml);
  const frameRef = useRef<number | null>(null);

  const hasContent = !isHtmlEmpty(footerHtml);
  const sectionNumber = getSectionNumber(sectionIndex, pageIndex);

  const scheduleMeasure = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
    }

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;

      const measuredHeightPx = measureEditableHeight(editableRef.current);
      onMeasureFooterHeight?.(measuredHeightPx);
    });
  }, [onMeasureFooterHeight]);

  useEffect(() => {
    latestHtmlRef.current = footerHtml;
  }, [footerHtml]);

  useEffect(() => {
    const node = editableRef.current;
    if (!node) return;

    const isFocused = node === document.activeElement;

    if (!isFocused && node.innerHTML !== footerHtml) {
      node.innerHTML = footerHtml || "";
    }

    scheduleMeasure();
  }, [footerHtml, isEditing, scheduleMeasure]);

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
    onOpenFooterEditor?.();

    window.setTimeout(() => {
      editableRef.current?.focus();
      scheduleMeasure();
    }, 0);
  }, [onFocusPage, onOpenFooterEditor, pageIndex, scheduleMeasure]);

  const handleInput = useCallback(
    (event: FormEvent<HTMLDivElement>) => {
      latestHtmlRef.current = event.currentTarget.innerHTML;
      onChangeFooterHtml?.(event.currentTarget.innerHTML);
      scheduleMeasure();
    },
    [onChangeFooterHtml, scheduleMeasure],
  );

  return (
    <footer
      data-knexwriter-footer-area="true"
      data-page-index={pageIndex}
      data-page-number={pageNumber}
      data-page-count={pageCount}
      data-page-height-px={pageHeightPx}
      data-section-index={sectionIndex ?? pageIndex}
      className={["absolute overflow-visible", className].filter(Boolean).join(" ")}
      style={{
        left: 0,
        top: footerTopPx,
        width: pageWidthPx,
        height: footerHeightPx,
        boxSizing: "border-box",
        pointerEvents: "none",
        ...style,
      }}
    >
      {!isEditing ? (
        <div
          data-knexwriter-footer-activation-zone="true"
          aria-label={`Abrir rodapé da página ${pageNumber}`}
          title="Clique duas vezes para editar o rodapé"
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
            data-knexwriter-footer-separator="true"
            className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-zinc-500"
            style={{
              top: 0,
            }}
          />

          {showGuide ? (
            <>
              <span
                data-knexwriter-footer-guide-label="true"
                className="pointer-events-none absolute rounded-sm border border-zinc-500 bg-zinc-100 px-2 py-0.5 text-[10px] leading-none text-zinc-700 shadow-sm"
                style={{
                  left: bodyLeftPx,
                  top: -18,
                }}
              >
                Rodapé - Seção {sectionNumber} -
              </span>

              {sameAsPrevious ? (
                <span
                  data-knexwriter-footer-same-as-previous="true"
                  className="pointer-events-none absolute rounded-sm border border-zinc-500 bg-zinc-100 px-2 py-0.5 text-[10px] leading-none text-zinc-700 shadow-sm"
                  style={{
                    right: bodyLeftPx,
                    top: -18,
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
        data-knexwriter-footer-content-shell="true"
        className="absolute bg-transparent"
        style={{
          left: bodyLeftPx,
          top: 0,
          width: bodyWidthPx,
          minHeight: footerHeightPx,
          boxSizing: "border-box",
          pointerEvents: isEditing ? "auto" : "none",
        }}
      >
        <div
          ref={editableRef}
          data-knexwriter-footer-editable="true"
          role="textbox"
          aria-label={`Rodapé da página ${pageNumber} de ${pageCount}`}
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
    </footer>
  );
}

export default KnexWriterFooterArea;
