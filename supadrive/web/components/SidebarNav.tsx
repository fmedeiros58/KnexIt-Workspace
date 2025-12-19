"use client";

import { useState } from "react";

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
  onCreateItem?: (type: string) => void | Promise<void>;
};

const quickActions = [
  { id: "folder", label: "Nova pasta", shortcut: "Alt+C, depois F", icon: "M4 6h16v12H4Z M4 6V4h7l2 2h7" },
  { id: "file", label: "Upload de arquivo", shortcut: "Alt+C, depois U", icon: "M6 3h9l5 5v10H6Z M15 3v5h5" },
  { id: "folder-upload", label: "Upload de pasta", shortcut: "Alt+C, depois I", icon: "M4 7h7l2 2h7v9H4Z" },
];

const templateItems = [
  { id: "docs", label: "Documentos Google", color: "text-blue-500" },
  { id: "sheets", label: "Planilhas Google", color: "text-green-500" },
  { id: "slides", label: "Apresentações Google", color: "text-yellow-500" },
  { id: "vids", label: "Google Vids", color: "text-purple-500" },
  { id: "forms", label: "Formulários Google", color: "text-pink-500" },
  { id: "more", label: "Mais", color: "text-slate-500" },
];

const TemplateIcon = ({ variant }: { variant: string }) => {
  switch (variant) {
    case "docs":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <path d="M7 3h7l5 5v13H7z" opacity={0.3} />
          <path d="M14 3v5h5" />
          <path d="M9 12h6M9 15h6M9 18h4" stroke="white" strokeWidth={1.4} strokeLinecap="round" />
        </svg>
      );
    case "sheets":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <rect x="5" y="3" width="14" height="18" rx="1.5" opacity={0.3} />
          <path d="M8 8h8M8 12h8M8 16h8M10 6v12" stroke="white" strokeWidth={1.4} strokeLinecap="round" />
        </svg>
      );
    case "slides":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <rect x="5" y="5" width="14" height="14" rx="2" opacity={0.3} />
          <rect x="8" y="8" width="8" height="8" rx="1" stroke="white" strokeWidth={1.4} fill="none" />
        </svg>
      );
    case "vids":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <rect x="5" y="6" width="14" height="12" rx="2" opacity={0.3} />
          <path d="M11 9v6l4-3z" fill="white" />
        </svg>
      );
    case "forms":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <rect x="7" y="3" width="10" height="18" rx="2" opacity={0.3} />
          <path d="M9.5 8h5M9.5 12h5M9.5 16H12" stroke="white" strokeWidth={1.4} strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <circle cx="6" cy="6" r="2" />
          <circle cx="18" cy="6" r="2" />
          <circle cx="6" cy="18" r="2" />
          <circle cx="18" cy="18" r="2" />
        </svg>
      );
  }
};

export function SidebarNav({ primary, secondary, storagePercent, storageTotal, storageUsed, onCreateItem }: SidebarNavProps) {
  const [newMenuOpen, setNewMenuOpen] = useState(false);

  const renderItem = (item: NavItem) => {
    const active = Boolean(item.active);
    const labelClasses =
      "flex-1 text-left font-medium" + (item.id === "supadrive" ? " text-lg font-semibold" : "");
    return (
      <button
        key={item.id}
        type="button"
        className={`group flex w-full items-center gap-2 rounded-full px-3 py-1.5 text-base transition ${
          active ? "bg-[#d7ebff] text-blue-700" : "text-slate-700 hover:bg-slate-100"
        }`}
      >
        <span className={`flex h-8 w-8 items-center justify-center ${active ? "text-blue-700" : "text-slate-500"}`}>
          {item.icon ? (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={item.icon} />
            </svg>
          ) : null}
        </span>
        <span className={labelClasses}>{item.label}</span>
        {item.badge ? <span className="text-xs text-slate-500">{item.badge}</span> : null}
      </button>
    );
  };

  return (
    <aside className="relative z-20 flex h-full w-[280px] shrink-0 overflow-visible text-slate-900">
      <div className="mb-4 flex h-full w-[268px] flex-col gap-5 rounded-3xl bg-transparent p-2">
        <div className="relative self-start">
          <button
            className="ml-2 inline-flex h-12 w-fit items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            type="button"
            onClick={() => setNewMenuOpen((open) => !open)}
          >
            <span className="text-2xl leading-none">+</span>
            Novo
          </button>
          {newMenuOpen ? (
            <div className="absolute left-2 mt-2 w-80 rounded-2xl border border-slate-200 bg-white shadow-2xl z-50">
              <ul className="divide-y divide-slate-100 p-2 text-sm text-slate-700">
                {quickActions.map((action) => (
                  <li key={action.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-100"
                      onClick={() => {
                        void onCreateItem?.(action.id);
                        setNewMenuOpen(false);
                      }}
                    >
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                          <path d={action.icon} />
                        </svg>
                      </span>
                      <span className="flex-1 text-left">{action.label}</span>
                      <span className="text-xs text-slate-400">{action.shortcut}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="border-t border-slate-100 p-2">
                {templateItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                    onClick={() => {
                      void onCreateItem?.(item.id);
                      setNewMenuOpen(false);
                    }}
                  >
                    <span className={`flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 ${item.color}`}>
                      <TemplateIcon variant={item.id} />
                    </span>
                    <span className="flex-1 px-3">{item.label}</span>
                    <span className="text-lg text-slate-400">›</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <nav className="flex-1 space-y-4 text-sm pl-2">
          <div className="space-y-1">{primary.map(renderItem)}</div>
          <hr className="border-slate-200" />
          <div className="space-y-1">{secondary.map(renderItem)}</div>
        </nav>

        <div className="mb-2 rounded-3xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
          <div className="text-sm font-semibold text-slate-700">Armazenamento ({storagePercent}% usado)</div>
          <div className="mt-2 h-2 rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-orange-400" style={{ width: `${storagePercent}%` }} />
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
