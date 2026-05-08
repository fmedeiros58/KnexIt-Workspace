"use client";

import type { OrganizationSectionItem } from "../organizationTypes";

export function StructurePanel({ sections, query }: { sections: OrganizationSectionItem[]; query: string }) {
  const normalizedQuery = query.trim().toLowerCase();
  const filteredSections = normalizedQuery
    ? sections.filter((section) => section.title.toLowerCase().includes(normalizedQuery))
    : sections;

  if (!filteredSections.length) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm">
        <p className="font-medium text-zinc-800">Estrutura ainda vazia.</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">Títulos, capítulos, itens e subitens do projeto aparecerão aqui.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 rounded-lg border border-zinc-300 bg-white p-3 text-sm">
      {filteredSections.map((section) => (
        <div key={section.section_id} className="flex items-center gap-2 border-b border-zinc-100 py-1.5 last:border-b-0">
          <span className="text-xs font-semibold text-zinc-400">{typeof section.order === "number" ? section.order + 1 : "-"}</span>
          <span className="min-w-0 flex-1 truncate text-zinc-800">{section.title}</span>
        </div>
      ))}
    </div>
  );
}
