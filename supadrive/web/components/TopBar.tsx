import type { ReactNode } from "react";

type TopBarProps = {
  workspaceLabel: string;
  workspaceName: string;
  userName: string;
  userInitials: string;
  actions?: ReactNode;
};

export function TopBar({ workspaceLabel, workspaceName, userName, userInitials, actions }: TopBarProps) {
  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <div className="space-y-0.5">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">{workspaceLabel}</p>
          <p className="text-lg font-semibold text-slate-900">{workspaceName}</p>
        </div>
        <div className="flex flex-1 items-center justify-end gap-3">
          <div className="relative hidden max-w-md flex-1 sm:block">
            <input
              type="search"
              placeholder="Pesquisar no SupaDrive"
              className="w-full rounded-full border border-slate-200 bg-slate-50/70 px-4 py-2 text-sm text-slate-700 outline-none focus:border-slate-400 focus:bg-white"
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400">/</span>
          </div>
          {actions}
          <button className="hidden rounded-full border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 md:inline-flex">
            Feedback
          </button>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5">
            <span className="hidden text-sm text-slate-500 sm:block">{userName}</span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold uppercase text-white">
              {userInitials}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
