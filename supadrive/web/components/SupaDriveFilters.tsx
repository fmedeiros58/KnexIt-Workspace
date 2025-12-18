export type FilterChip = {
  id: string;
  label: string;
  active?: boolean;
};

type SupaDriveFiltersProps = {
  chips: FilterChip[];
  onToggle?: (id: string) => void;
};

export function SupaDriveFilters({ chips, onToggle }: SupaDriveFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {chips.map((chip) => (
        <button
          key={chip.id}
          onClick={() => onToggle?.(chip.id)}
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
            chip.active
              ? "border-blue-200 bg-blue-50 text-blue-700"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
          }`}
          type="button"
        >
          {chip.label}
          <svg viewBox="0 0 12 12" className="h-3 w-3 text-current" aria-hidden="true">
            <path d="M3 4l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ))}
    </div>
  );
}
