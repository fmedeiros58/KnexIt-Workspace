"use client";

import { useCallback, useEffect, useRef } from "react";
import { OPEN_PDF_PICKER_EVENT } from "../lib/constants";

type Props = {
  loading: boolean;
  error: string | null;
  hasTextLayer: boolean;
  onSelectFile: (file: File) => void;
};

export default function FileUploader({ loading, error, hasTextLayer, onSelectFile }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const openPicker = useCallback(() => {
    if (loading) return;
    inputRef.current?.click();
  }, [loading]);

  useEffect(() => {
    const handler = () => openPicker();
    window.addEventListener(OPEN_PDF_PICKER_EVENT, handler);
    return () => window.removeEventListener(OPEN_PDF_PICKER_EVENT, handler);
  }, [openPicker]);

  return (
    <section className="reader-uploader">
      <div className="reader-uploader-main">
        <span className="reader-uploader-title">Arquivo</span>
        <span className="reader-uploader-hint">Abra um PDF e visualize em duas páginas retrato paralelas.</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = "";
          if (!file) return;
          onSelectFile(file);
        }}
      />
      <span className="reader-uploader-hint">{loading ? "Carregando arquivo..." : "Use Arquivo > Abrir para selecionar um PDF."}</span>

      {error ? <span className="reader-inline-error">{error}</span> : null}
      {!loading && !error && !hasTextLayer ? <span className="reader-inline-warn">PDF sem camada textual detectada.</span> : null}
    </section>
  );
}
