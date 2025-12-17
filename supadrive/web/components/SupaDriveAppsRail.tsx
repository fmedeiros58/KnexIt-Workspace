type SupaDriveAppsRailProps = {
  items?: { id: string; label: string; color: string; glyph: string }[];
};

const DEFAULT_ITEMS = [
  { id: "calendar", label: "Calendar", color: "bg-white", glyph: "??" },
  { id: "keep", label: "Notas", color: "bg-[#fbbc04]", glyph: "??" },
  { id: "tasks", label: "Tarefas", color: "bg-[#1a73e8]", glyph: "?" },
  { id: "contacts", label: "Contatos", color: "bg-[#1a73e8]", glyph: "??" },
  { id: "add", label: "Adicionar", color: "bg-slate-200", glyph: "+" },
];

export function SupaDriveAppsRail({ items = DEFAULT_ITEMS }: SupaDriveAppsRailProps) {
  return (
    <aside className="flex h-80 w-14 shrink-0 flex-col items-center justify-between rounded-3xl bg-transparent py-4">
      <div className="flex flex-col items-center gap-4">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`flex h-10 w-10 items-center justify-center rounded-2xl ${item.color} text-base shadow-sm ring-1 ring-black/5`}
            aria-label={item.label}
          >
            <span className="text-lg" aria-hidden="true">{item.glyph}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
