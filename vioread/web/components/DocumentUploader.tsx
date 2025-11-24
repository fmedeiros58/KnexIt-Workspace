"use client";

import { ChangeEvent } from "react";
import type { DocumentDescriptor } from "../lib/vioreadTypes";

type Props = {
  onUpload: (descriptor: DocumentDescriptor) => void;
};

export default function DocumentUploader({ onUpload }: Props) {
  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text().catch(() => "");
    onUpload({
      id: `upload-${Date.now()}`,
      name: file.name,
      source: "upload",
      payload: { mime: file.type, size: file.size, content },
    });
    e.target.value = "";
  };

  return (
    <div className="space-y-2">
      <input
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        onChange={onFile}
        className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border file:border-slate-200 file:bg-slate-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-800 hover:file:bg-slate-100"
      />
      <p className="text-xs text-slate-500">MVP: conteúdo lido como texto simples. TODO: parsing PDF/DOCX real.</p>
    </div>
  );
}

