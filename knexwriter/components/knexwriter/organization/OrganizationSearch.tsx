"use client";

import { Search } from "lucide-react";
import type { OrganizationTab } from "./organizationTypes";

const PLACEHOLDER_BY_TAB: Record<OrganizationTab, string> = {
  projects: "Buscar projeto...",
  sections: "Buscar seção...",
  contexts: "Buscar contexto...",
  references: "Buscar referência...",
  structure: "Buscar título ou seção...",
  notes: "Buscar nota...",
  revisions: "Buscar revisão...",
  files: "Buscar arquivo...",
  archived: "Buscar arquivado...",
  trash: "Buscar na lixeira...",
  settings: "Buscar configuração...",
  more: "Buscar item...",
};

export function OrganizationSearch({
  activeTab,
  value,
  onChange,
}: {
  activeTab: OrganizationTab;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="p-2">
      <div className="flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-2">
        <Search size={14} className="text-zinc-400" />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={PLACEHOLDER_BY_TAB[activeTab]}
          className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
        />
      </div>
    </div>
  );
}
