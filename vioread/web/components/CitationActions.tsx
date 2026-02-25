"use client";

import { useState } from "react";
import type { CitationPayload } from "../lib/types";

type Props = {
  citationDirect: CitationPayload | null;
  citationIndirect: CitationPayload | null;
};

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

export default function CitationActions({ citationDirect, citationIndirect }: Props) {
  const [notice, setNotice] = useState<string | null>(null);

  const handleCopy = async (payload: CitationPayload | null) => {
    if (!payload) return;
    try {
      await copyText(payload.citationText);
      setNotice(`Copiado (p. ${payload.pageNumber}).`);
      setTimeout(() => setNotice(null), 1800);
    } catch {
      setNotice("Falha ao copiar.");
      setTimeout(() => setNotice(null), 1800);
    }
  };

  return (
    <section className="reader-citation-box">
      <h3 className="reader-citation-title">Citação</h3>
      <p className="reader-citation-hint">Selecione um bloco para copiar com referência de página.</p>

      <div className="reader-citation-actions">
        <button type="button" onClick={() => handleCopy(citationDirect)} disabled={!citationDirect} className="reader-soft-btn w-full">
          Copiar direta
        </button>
        <button type="button" onClick={() => handleCopy(citationIndirect)} disabled={!citationIndirect} className="reader-soft-btn w-full">
          Copiar indireta
        </button>
      </div>

      {notice ? <p className="reader-citation-notice">{notice}</p> : null}
    </section>
  );
}
