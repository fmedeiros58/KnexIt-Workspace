"use client";

import type { PdfMetadataRecord, PdfSourceCandidate } from "../types";

export function PdfSourceInfoPanel({
  metadata,
  candidate,
  onCreateReferenceCandidate,
}: {
  metadata: PdfMetadataRecord | null;
  candidate: PdfSourceCandidate | null;
  onCreateReferenceCandidate: () => void;
}) {
  return (
    <div className="space-y-2 text-xs">
      <button
        type="button"
        onClick={onCreateReferenceCandidate}
        className="w-full rounded border border-zinc-300 bg-zinc-50 px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-100"
      >
        Criar referencia a partir deste PDF
      </button>

      <div className="rounded border border-zinc-200 bg-white p-2">
        <p><strong>Titulo:</strong> {metadata?.title || "-"}</p>
        <p><strong>Autor:</strong> {metadata?.author || "-"}</p>
        <p><strong>Assunto:</strong> {metadata?.subject || "-"}</p>
        <p><strong>Paginas:</strong> {metadata?.totalPages ?? "-"}</p>
        <p><strong>DOI:</strong> {metadata?.possibleDoi || "-"}</p>
        <p><strong>ISBN:</strong> {metadata?.possibleIsbn || "-"}</p>
      </div>

      {candidate ? (
        <div className="rounded border border-blue-200 bg-blue-50 p-2">
          <p><strong>Confianca:</strong> {candidate.confidence}</p>
          <p>
            <strong>Campos faltantes:</strong>{" "}
            {candidate.missingFields.join(", ") || "Nenhum"}
          </p>
          {!!candidate.warnings.length && (
            <p><strong>Avisos:</strong> {candidate.warnings.join(" | ")}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
