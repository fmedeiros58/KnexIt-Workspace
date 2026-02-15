type InfoPanelProps = {
  title: string;
  tabs: { id: string; label: string; active?: boolean }[];
  emptyTitle: string;
  emptyMessage: string;
};

export function InfoPanel({ title, tabs, emptyMessage, emptyTitle }: InfoPanelProps) {
  return (
    <aside className="h-full w-full min-w-0">
      <div className="flex h-full min-h-0 flex-col rounded-3xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-slate-400">Painel</p>
            <p className="truncate text-base font-semibold text-slate-900">{title}</p>
          </div>
          <button aria-label="close panel" className="text-slate-400">
            x
          </button>
        </div>

        <div className="mt-4 flex border-b border-slate-200 text-sm">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`flex-1 border-b-2 px-3 py-2 ${
                tab.active ? "border-blue-500 font-medium text-blue-700" : "border-transparent text-slate-500"
              }`}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-8 flex flex-1 flex-col items-center justify-center space-y-3 text-center text-slate-500">
          <div className="h-24 w-24 rounded-full bg-slate-50" />
          <p className="text-sm font-semibold text-slate-700">{emptyTitle}</p>
          <p className="text-xs text-slate-500">{emptyMessage}</p>
        </div>
      </div>
    </aside>
  );
}
