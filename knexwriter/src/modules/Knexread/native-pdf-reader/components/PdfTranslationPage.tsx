"use client";

export type PdfTranslationPageStatus = "blank" | "translating" | "rendered" | "error";

export function PdfTranslationPage({
  pageNumber,
  width,
  height,
  status = "blank",
}: {
  pageNumber: number;
  width: number;
  height: number;
  status?: PdfTranslationPageStatus;
}) {
  return (
    <div
      className="relative inline-block overflow-hidden rounded border border-zinc-300 bg-white shadow-sm"
      data-knexread-translation-page-number={pageNumber}
      data-knexread-translation-status={status}
      aria-label={`Folha de traducao da pagina ${pageNumber}`}
      style={{
        width: `${Math.max(1, width)}px`,
        height: `${Math.max(1, height)}px`,
      }}
    >
      <div
        className="absolute inset-0 z-[1] bg-white"
        data-knexread-blank-paper-layer
      />
      <div
        className="absolute inset-0 z-[2]"
        data-knexread-translated-text-layer
      />
      <div
        className="pointer-events-none absolute inset-0 z-[3]"
        data-knexread-translation-annotation-layer
      />
    </div>
  );
}
