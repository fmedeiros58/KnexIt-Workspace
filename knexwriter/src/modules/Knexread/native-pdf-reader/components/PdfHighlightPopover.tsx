"use client";

export function PdfHighlightPopover({
  position,
  onHighlight,
  onComment,
  onCopy,
  onCreateDirectCitation,
  onCreateIndirectCitation,
  onCreateReference,
  onTranslateSelection,
}: {
  position: { top: number; left: number } | null;
  onHighlight: () => void;
  onComment: () => void;
  onCopy: () => void;
  onCreateDirectCitation: () => void;
  onCreateIndirectCitation: () => void;
  onCreateReference: () => void;
  onTranslateSelection?: () => void;
}) {
  if (!position) return null;

  return (
    <div
      className="fixed z-[3200] rounded-md border border-zinc-200 bg-white p-2 shadow-xl"
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
    >
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={onHighlight}
          className="rounded border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-100"
        >
          Grifar
        </button>
        <button
          type="button"
          onClick={onComment}
          className="rounded border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-100"
        >
          Comentar
        </button>
        <button
          type="button"
          onClick={onCopy}
          className="rounded border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-100"
        >
          Copiar
        </button>
        <button
          type="button"
          onClick={onCreateDirectCitation}
          className="rounded border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-100"
        >
          Citacao direta
        </button>
        <button
          type="button"
          onClick={onCreateIndirectCitation}
          className="rounded border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-100"
        >
          Citacao indireta
        </button>
        <button
          type="button"
          onClick={onCreateReference}
          className="rounded border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-100"
        >
          Criar fonte
        </button>
        {onTranslateSelection ? (
          <button
            type="button"
            onClick={onTranslateSelection}
            className="rounded border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-100"
          >
            Traduzir selecao
          </button>
        ) : null}
      </div>
    </div>
  );
}
