import Link from "next/link";
import type { NavItem } from "./navigation";

type SidebarProps = {
  items: NavItem[];
  activeHref?: string | null;
  onNavigate?: () => void;
  className?: string;
};

export default function Sidebar({ items, activeHref, onNavigate, className }: SidebarProps) {
  return (
    <aside
      className={`flex h-full w-64 flex-col gap-4 border-r border-slate-200/80 bg-white px-3 py-4 ${
        className ?? ""
      }`.trim()}
    >
      <div className="px-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Apps</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const isActive = activeHref?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-semibold transition ${
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
        Use o menu para alternar entre os módulos do ecossistema.
      </div>
    </aside>
  );
}
