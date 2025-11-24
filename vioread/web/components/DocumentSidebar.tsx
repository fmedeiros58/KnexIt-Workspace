"use client";

import type { VioReadSection } from "../lib/vioreadTypes";

type Props = {
  sections: VioReadSection[];
  activeSectionId: string | null;
  onSelectSection: (id: string | null) => void;
};

export default function DocumentSidebar({ sections, activeSectionId, onSelectSection }: Props) {
  if (!sections.length) {
    return <p className="text-sm text-slate-500">Nenhuma seção disponível.</p>;
  }

  return (
    <ul className="space-y-1 text-sm">
      {sections.map((sec) => (
        <li key={sec.id}>
          <button
            className={`w-full text-left rounded-lg px-3 py-2 ${
              sec.id === activeSectionId ? "bg-indigo-50 text-indigo-800 border border-indigo-100" : "hover:bg-slate-100"
            }`}
            onClick={() => onSelectSection(sec.id)}
          >
            <div className="font-medium">{sec.title || "Seção sem título"}</div>
            <div className="text-[12px] text-slate-500 truncate">Blocos: {sec.blocks.length}</div>
          </button>
        </li>
      ))}
    </ul>
  );
}

