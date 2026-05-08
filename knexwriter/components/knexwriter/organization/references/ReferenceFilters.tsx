"use client";

import type { ReferenceFilter } from "../organizationTypes";
import { REFERENCE_FILTER_LABEL } from "../organizationTypes";

const FILTERS: ReferenceFilter[] = [
  "available_sources",
  "used",
  "unused",
  "pending",
  "direct_quotes",
  "indirect_quotes",
  "bibliography",
];

export function ReferenceFilters({
  activeFilter,
  onChange,
}: {
  activeFilter: ReferenceFilter;
  onChange: (filter: ReferenceFilter) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-2">
      {FILTERS.map((filter) => (
        <button
          key={filter}
          type="button"
          onClick={() => onChange(filter)}
          className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium ${
            activeFilter === filter
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          {REFERENCE_FILTER_LABEL[filter]}
        </button>
      ))}
    </div>
  );
}
