export type NavItem = {
  id: string;
  label: string;
  icon?: string;
  active?: boolean;
  badge?: string;
};

type SidebarNavProps = {
  primary: NavItem[];
  secondary: NavItem[];
  storageUsed: string;
  storageTotal: string;
  storagePercent: number;
};

export function SidebarNav({ primary, secondary, storagePercent, storageTotal, storageUsed }: SidebarNavProps) {
  const renderItem = (item: NavItem) => (
    <button
      key={item.id}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition hover:bg-slate-100 ${
        item.active ? "bg-blue-50 font-medium text-blue-700" : "text-slate-700"
      }`}
      type="button"
    >
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-500">
        {item.icon ?? ""}
      </span>
      <span className="flex-1 text-left">{item.label}</span>
      {item.badge ? <span className="text-xs text-slate-500">{item.badge}</span> : null}
    </button>
  );

  return (
    <aside className="hidden h-full w-64 shrink-0 lg:block">
      <div className="flex h-full flex-col space-y-6 rounded-3xl border border-slate-200 bg-white p-4">
        <button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white">
          + Novo
        </button>
        <nav className="flex-1 space-y-4 text-sm">
          <div className="space-y-1">{primary.map(renderItem)}</div>
          <hr className="border-slate-200" />
          <div className="space-y-1">{secondary.map(renderItem)}</div>
        </nav>
        <div>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Armazenamento</span>
            <span>{storageUsed} / {storageTotal}</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-blue-500" style={{ width: `${storagePercent}%` }} />
          </div>
          <button className="mt-3 w-full rounded-2xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600">
            Comprar mais armazenamento
          </button>
        </div>
      </div>
    </aside>
  );
}
