"use client";

import { useEffect, useState, type ReactNode } from "react";

export type FilterChip = {
  id: string;
  label: string;
  baseLabel?: string;
  selectedLabel?: string;
  active?: boolean;
};

type SupaDriveFiltersProps = {
  chips: FilterChip[];
  onToggle?: (id: string) => void;
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
  spark: (
    <svg className="h-5 w-5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 3v4M12 17v4M5.5 5.5l2.5 2.5M16 16l2.5 2.5M3 12h4m10 0h4M5.5 18.5 8 16M16 8l2.5-2.5" />
      <path d="m9 15 3-6 3 6-3 6z" />
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
  archive: (
    <svg className="h-5 w-5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <rect x="6" y="4" width="12" height="3" rx="1" />
      <path d="M10 12h4" />
    </svg>
  ),
  audio: (
    <svg className="h-5 w-5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="5" y="5" width="9" height="14" rx="2" />
      <path d="M14 9.5 19 8v8l-5-1.5" />
    </svg>
  ),
  draw: (
    <svg className="h-5 w-5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 20h16" />
      <path d="M8 20c0-6 8-6 8-12a4 4 0 1 0-8 0" />
      <path d="M11 20v-6" />
    </svg>
  ),
  site: (
    <svg className="h-5 w-5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
    </svg>
  ),
  shortcut: (
    <svg className="h-5 w-5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M7 7h7v7" />
      <path d="M7 17 17 7" />
    </svg>
  ),
};

const TYPE_OPTIONS: DropdownOpt[] = [
  { icon: monoIcons.folder, label: "Pastas" },
  { icon: monoIcons.doc, label: "Documentos" },
  { icon: monoIcons.sheet, label: "Planilhas" },
  { icon: monoIcons.slides, label: "Apresentacoes" },
  { icon: monoIcons.video, label: "Vids" },
  { icon: monoIcons.spark, label: "Gems" },
  { icon: monoIcons.form, label: "Formularios" },
  { icon: monoIcons.image, label: "Fotos e imagens" },
  { icon: monoIcons.pdf, label: "PDFs" },
  { icon: monoIcons.video, label: "Videos" },
  { icon: monoIcons.archive, label: "Arquivos (.zip)" },
  { icon: monoIcons.audio, label: "Audio" },
  { icon: monoIcons.draw, label: "Desenhos" },
  { icon: monoIcons.site, label: "Sites" },
  { icon: monoIcons.shortcut, label: "Atalhos" },
];

const fallbackOptions: DropdownOpt[] = [{ icon: "·", label: "Opcao" }];

export function SupaDriveFilters({ chips, onToggle, onSelectOption, onClear }: SupaDriveFiltersProps) {
  const [openChip, setOpenChip] = useState<string | null>(null);

  const toggleMenu = (id: string) => setOpenChip((curr) => (curr === id ? null : id));
  // Só consideramos “ativo” se houver um valor escolhido (selectedLabel),
  // evitando mostrar o botão de limpar apenas por abrir/clicar no chip.
  const hasActive = chips.some((chip) => chip.id !== "cleanup" && Boolean(chip.selectedLabel));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest("[data-filter-chip]")) setOpenChip(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
              onClick={() => onToggle?.(chip.id)}
              type="button"
              className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-medium text-slate-600 underline-offset-2 hover:text-slate-800"
            >
              {chip.label}
            </button>
          );
        }

        const options = chip.id === "type" ? TYPE_OPTIONS : fallbackOptions;
        const isActive = chip.active || Boolean(chip.selectedLabel);

        return (
          <div key={chip.id} className="relative" data-filter-chip>
            <button
              type="button"
              onClick={() => {
                if (!isActive) onToggle?.(chip.id);
                toggleMenu(chip.id);
              }}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-1 text-sm font-medium leading-tight whitespace-nowrap transition ${
                isActive
                  ? "border-sky-500 bg-sky-200 text-sky-900 shadow-sm"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 shadow-sm"
              }`}
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
                <span className="flex items-center gap-2 pl-2 ml-1 border-l border-sky-400/60">
                  <button
                    type="button"
                    className="text-sky-700 hover:text-sky-900"
                    onClick={(e) => {
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
                    <li
                      key={opt.label}
                      className="flex items-center gap-2 cursor-pointer px-3 py-2 hover:bg-slate-50"
                      onClick={() => {
                        onSelectOption?.(chip.id, opt.label);
                        onToggle?.(chip.id);
                        setOpenChip(null);
                      }}
                    >
                      <span className="w-5 text-center">{opt.icon}</span>
                      <span className="whitespace-nowrap">{opt.label}</span>
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
