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

export function SidebarNav({
  primary,
  secondary,
  storagePercent,
  storageTotal,
  storageUsed,
}: SidebarNavProps) {
  const renderItem = (item: NavItem) => {
    const active = Boolean(item.active);

    return (
      <button
        key={item.id}
        type="button"
        className={`group flex w-full items-center gap-2 rounded-full px-3 py-2 text-sm transition ${
          active ? "bg-[#d7ebff] text-blue-700" : "text-slate-700 hover:bg-slate-100"
        }`}
      >
        {/* ✅ ícone um pouco maior + área consistente */}
        <span
          className={`flex h-8 w-8 items-center justify-center ${
            active ? "text-blue-700" : "text-slate-500"
          }`}
        >
          {item.icon ? (
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d={item.icon} />
            </svg>
          ) : null}
        </span>

        <span className="flex-1 text-left">{item.label}</span>

        {item.badge ? (
          <span className="text-xs text-slate-500">{item.badge}</span>
        ) : null}
      </button>
    );
  };

  return (
    // ✅ largura ajustada para estilo Drive e para alinhar com o TopBar
    <aside className="flex h-full w-[280px] shrink-0 text-slate-900">
      <div className="flex h-full w-[268px] flex-col gap-5 rounded-3xl bg-transparent p-2">
        {/* ✅ botão Novo mais “Drive-like” */}
        <button className="ml-2 inline-flex h-11 w-fit items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50">
          <span className="text-xl leading-none">＋</span>
          Novo
        </button>

        {/* ✅ espaçamento mais suave */}
        <nav className="flex-1 space-y-4 text-sm pl-2">
          <div className="space-y-1">{primary.map(renderItem)}</div>
          <hr className="border-slate-200" />
          <div className="space-y-1">{secondary.map(renderItem)}</div>
        </nav>

        <div className="rounded-3xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
          <div className="text-sm font-semibold text-slate-700">
            Armazenamento ({storagePercent}% usado)
          </div>

          <div className="mt-2 h-2 rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-orange-400"
              style={{ width: `${storagePercent}%` }}
            />
          </div>

          <p className="mt-2 text-[11px] text-slate-500">
            {storageUsed} de {storageTotal} usados
          </p>

          <button className="mt-3 w-full rounded-3xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-blue-600 transition hover:border-blue-200 hover:bg-blue-50">
            Comprar mais armazenamento
          </button>
        </div>
      </div>
    </aside>
  );
}
