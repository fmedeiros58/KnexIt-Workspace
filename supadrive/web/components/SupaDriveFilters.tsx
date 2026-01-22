"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

export type FilterChip = {
  id: string;
  label: string;
  baseLabel?: string;
  selectedLabel?: string;
};

type SupaDriveFiltersProps = {
  chips: FilterChip[];
  onToggle?: (id: string) => void; // usado só no cleanup
  onSelectOption?: (id: string, optionLabel: string) => void;
  onClear?: (id: string) => void;
};

type DropdownOpt = { icon: ReactNode; label: string };

const monoIcons = {
  folder: (
    <svg className="h-5 w-5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 7h7l2 2h9v10H3Z" />
      <path d="M3 7V5h7l2 2h9" />
    </svg>
  ),
  doc: (
    <svg className="h-5 w-5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5" />
    </svg>
  ),
  sheet: (
    <svg className="h-5 w-5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h8" />
    </svg>
  ),
  slides: (
    <svg className="h-5 w-5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="5" y="6" width="14" height="12" rx="2" />
      <rect x="8" y="9" width="8" height="6" rx="1" />
    </svg>
  ),
  video: (
    <svg className="h-5 w-5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="4" y="6" width="14" height="12" rx="2" />
      <path d="M11 10v4l3-2z" />
    </svg>
  ),
  form: (
    <svg className="h-5 w-5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <path d="M9.5 8h5M9.5 12h5M9.5 16H12" />
    </svg>
  ),
  image: (
    <svg className="h-5 w-5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="m8 14 3-3 3 3 3-3" />
      <circle cx="9" cy="9" r="1" />
    </svg>
  ),
  pdf: (
    <svg className="h-5 w-5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5" />
      <path d="M9 14h6" />
    </svg>
  ),
};

const TYPE_OPTIONS: DropdownOpt[] = [
  { icon: monoIcons.folder, label: "Pastas" },
  { icon: monoIcons.doc, label: "Documentos" },
  { icon: monoIcons.sheet, label: "Planilhas" },
  { icon: monoIcons.slides, label: "Apresentacoes" },
  { icon: monoIcons.video, label: "Videos" },
  { icon: monoIcons.form, label: "Formularios" },
  { icon: monoIcons.image, label: "Fotos e imagens" },
  { icon: monoIcons.pdf, label: "PDFs" },
];

const fallbackOptions: DropdownOpt[] = [{ icon: "·" as unknown as ReactNode, label: "Opcao" }];

export function SupaDriveFilters({ chips, onToggle, onSelectOption, onClear }: SupaDriveFiltersProps) {
  const [openChip, setOpenChip] = useState<string | null>(null);

  const hasActive = useMemo(
    () => chips.some((c) => c.id !== "cleanup" && Boolean(c.selectedLabel)),
    [chips]
  );

  // ✅ Fechar ao clicar fora, sem matar cliques internos
  useEffect(() => {
    const onDocMouseDown = (event: MouseEvent) => {
      const t = event.target;
      if (!(t instanceof Element)) return;
      if (!t.closest("[data-filter-chip]")) setOpenChip(null);
    };

    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  return (
    <div className="flex flex-wrap gap-3">
      {chips.map((chip) => {
        const isCleanup = chip.id === "cleanup";

        if (isCleanup) {
          if (!hasActive) return null;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => onToggle?.("cleanup")}
              className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-medium text-slate-600 underline-offset-2 hover:text-slate-800"
            >
              {chip.label}
            </button>
          );
        }

        const options = chip.id === "type" ? TYPE_OPTIONS : fallbackOptions;

        // ✅ azul só quando tem selectedLabel
        const isActive = Boolean(chip.selectedLabel);

        return (
          <div key={chip.id} className="relative" data-filter-chip>
            <button
              type="button"
              aria-pressed={isActive}
              onClick={() => setOpenChip((curr) => (curr === chip.id ? null : chip.id))}
              className={[
                "inline-flex items-center gap-2 rounded-md border px-3 py-1 text-sm font-medium leading-tight whitespace-nowrap transition shadow-sm",
                isActive
                  ? "!border-blue-400 !bg-blue-100 !text-blue-900"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              {chip.selectedLabel ?? chip.label}

              <svg viewBox="0 0 12 12" className="ml-1 h-3 w-3 text-slate-500" aria-hidden="true">
                <path
                  d="M3 4l3 3 3-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

              {chip.selectedLabel ? (
                <span className="ml-1 flex items-center gap-2 border-l border-blue-300/70 pl-2">
                  <button
                    type="button"
                    className="text-blue-700 hover:text-blue-900"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onClear?.(chip.id);
                      setOpenChip(null);
                    }}
                    aria-label={`Limpar filtro ${chip.label}`}
                  >
                    ×
                  </button>
                </span>
              ) : null}
            </button>

            {openChip === chip.id ? (
              <div className="absolute left-0 top-10 z-30 w-64 rounded-md border border-slate-200 bg-white shadow-lg">
                <ul className="py-1 text-base text-slate-800">
                  {options.map((opt) => (
                    <li key={opt.label}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onSelectOption?.(chip.id, opt.label);
                          setOpenChip(null);
                        }}
                        onClick={(e) => e.preventDefault()}
                      >
                        <span className="w-5 text-center">{opt.icon}</span>
                        <span className="whitespace-nowrap">{opt.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
