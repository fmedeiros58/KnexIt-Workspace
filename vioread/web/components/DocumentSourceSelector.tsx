"use client";

import { useState } from "react";
import DocumentSelectorFromSupaDrive from "./DocumentSelectorFromSupaDrive";
import DocumentUploader from "./DocumentUploader";
import type { DocumentDescriptor, DocumentSourceType } from "../lib/vioreadTypes";

type Props = {
  onDocumentSelected: (descriptor: DocumentDescriptor) => void;
};

export default function DocumentSourceSelector({ onDocumentSelected }: Props) {
  const [activeSource, setActiveSource] = useState<DocumentSourceType | null>(null);

  const setDescriptor = (descriptor: DocumentDescriptor) => {
    onDocumentSelected(descriptor);
    setActiveSource(null);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">Origem do documento</h3>
        <p className="text-xs text-slate-500">Escolha um arquivo do SupaDrive, faça upload ou cole texto/URL.</p>
      </div>
      <div className="divide-y divide-slate-200">
        <button
          className="w-full text-left px-4 py-3 hover:bg-slate-50 transition"
          onClick={() => setActiveSource((s) => (s === "supadrive" ? null : "supadrive"))}
        >
          <div className="text-sm font-medium text-slate-900">Escolher do SupaDrive</div>
          <div className="text-xs text-slate-500">Busca arquivos já armazenados</div>
        </button>
        {activeSource === "supadrive" && (
          <div className="px-4 py-3">
            <DocumentSelectorFromSupaDrive onSelect={(d) => setDescriptor(d)} />
          </div>
        )}

        <button
          className="w-full text-left px-4 py-3 hover:bg-slate-50 transition"
          onClick={() => setActiveSource((s) => (s === "upload" ? null : "upload"))}
        >
          <div className="text-sm font-medium text-slate-900">Enviar arquivo (upload)</div>
          <div className="text-xs text-slate-500">PDF, DOCX ou outros formatos</div>
        </button>
        {activeSource === "upload" && (
          <div className="px-4 py-3">
            <DocumentUploader onUpload={(d) => setDescriptor(d)} />
          </div>
        )}

        <button
          className="w-full text-left px-4 py-3 hover:bg-slate-50 transition"
          onClick={() => {
            setDescriptor({
              id: "raw-text",
              name: "Texto colado",
              source: "rawText",
              payload: {
                content: "Cole um texto ou URL aqui (mock).",
              },
            });
          }}
        >
          <div className="text-sm font-medium text-slate-900">Digitar/colar texto</div>
          <div className="text-xs text-slate-500">Modo rápido (mock)</div>
        </button>
      </div>
    </div>
  );
}

