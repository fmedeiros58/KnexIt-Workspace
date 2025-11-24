"use client";

import { useMemo } from "react";
import type { DocumentDescriptor } from "../lib/vioreadTypes";

type Props = {
  onSelect: (descriptor: DocumentDescriptor) => void;
};

const MOCK_SUPADRIVE_ITEMS: DocumentDescriptor[] = [
  { id: "sd-1", name: "Metodologia Pesquisa.pdf", source: "supadrive", payload: { mime: "application/pdf" } },
  { id: "sd-2", name: "Bioquímica avançada.docx", source: "supadrive", payload: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" } },
  { id: "sd-3", name: "Relatório IA 2024.pdf", source: "supadrive", payload: { mime: "application/pdf" } },
];

export default function DocumentSelectorFromSupaDrive({ onSelect }: Props) {
  const items = useMemo(() => MOCK_SUPADRIVE_ITEMS, []);

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">Integração real com SupaDrive ficará aqui. Mockando itens para fluxo.</p>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <button
            key={item.id}
            className="w-full text-left rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50"
            onClick={() => onSelect(item)}
          >
            <div className="text-sm font-semibold text-slate-900">{item.name}</div>
            <div className="text-xs text-slate-500">Fonte: SupaDrive • id: {item.id}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

