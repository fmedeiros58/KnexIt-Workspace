import type { ReactNode } from "react";

type SupaDriveToolbarProps = {
  title: string;
  scopeLabel?: string;
  children?: ReactNode;
  onToggleInfo?: () => void;
  infoPanelVisible?: boolean;
};

export function SupaDriveToolbar({ title, scopeLabel, children, onToggleInfo, infoPanelVisible = true }: SupaDriveToolbarProps) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>{scopeLabel}</span>
            <svg viewBox="0 0 12 12" className="h-3 w-3 text-slate-400" aria-hidden="true">
              <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        </div>
        <div className="flex items-center gap-2 text-slate-500">
          <button className="rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600">Listar</button>
          <button className="rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Grid</button>
          {onToggleInfo ? (
            <button
              type="button"
              onClick={onToggleInfo}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                infoPanelVisible ? "border-slate-200 text-slate-600" : "border-blue-500 text-blue-600"
              }`}
            >
              {infoPanelVisible ? "Ocultar painel" : "Mostrar painel"}
            </button>
          ) : null}
        </div>
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
