"use client";

import type { OrganizationSectionItem } from "../organizationTypes";

export function SectionsPanel({
  sections,
  activeSectionId,
  query,
  label = "Seções",
  onOpenSection,
}: {
  sections: OrganizationSectionItem[];
  activeSectionId: string | null;
  query: string;
  label?: string;
  onOpenSection: (sectionId: string) => void;
}) {
  const normalizedQuery = query.trim().toLowerCase();
  const filteredSections = normalizedQuery
    ? sections.filter((section) => `${section.title} ${section.objective ?? ""}`.toLowerCase().includes(normalizedQuery))
    : sections;

  if (!filteredSections.length) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm">
        <p className="font-medium text-zinc-800">Nenhuma seção encontrada.</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">{label} do projeto aparecerão aqui.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filteredSections.map((section) => {
        const order = typeof section.order === "number" ? section.order + 1 : null;
        const chunkCount = section.chunks?.length ?? 0;

        return (
          <button
            key={section.section_id}
            type="button"
            onClick={() => onOpenSection(section.section_id)}
            className={`block w-full rounded-lg border p-3 text-left text-sm ${
              activeSectionId === section.section_id
                ? "border-zinc-900 bg-white"
                : "border-zinc-300 bg-white hover:bg-zinc-100"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-zinc-900">{order ? `${order}. ` : ""}{section.title}</p>
              {section.status ? (
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] text-zinc-500">
                  {section.status}
                </span>
              ) : null}
            </div>
            {section.objective ? <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{section.objective}</p> : null}
            <p className="mt-2 text-[11px] text-zinc-400">{chunkCount} bloco{chunkCount === 1 ? "" : "s"} vinculado{chunkCount === 1 ? "" : "s"}</p>
          </button>
        );
      })}
    </div>
  );
}
