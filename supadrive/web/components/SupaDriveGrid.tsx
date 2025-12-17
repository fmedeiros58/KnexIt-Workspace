export type SupaDriveItem = {
  id: string;
  name: string;
  meta: string;
  badge?: string;
  kind: "folder" | "doc" | "sheet" | "pdf" | "link";
};

type SupaDriveGridProps = {
  folders: SupaDriveItem[];
  files: SupaDriveItem[];
};

const kindGlyph: Record<SupaDriveItem["kind"], string> = {
  folder: "F",
  doc: "D",
  sheet: "S",
  pdf: "P",
  link: "L",
};

export function SupaDriveGrid({ folders, files }: SupaDriveGridProps) {
  const renderCard = (item: SupaDriveItem) => (
    <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-xs font-semibold text-slate-600">
            {kindGlyph[item.kind]}
          </span>
          <div>
            <p className="font-medium text-slate-900">{item.name}</p>
            <p className="text-xs text-slate-500">{item.meta}</p>
          </div>
        </div>
        <button className="text-slate-400" aria-label="more options">...</button>
      </div>
      {item.badge ? (
        <span className="mt-3 inline-block rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-500">{item.badge}</span>
      ) : null}
    </div>
  );

  return (
    <section className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto space-y-6 pr-1">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Pastas</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{folders.map(renderCard)}</div>
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Arquivos</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{files.map(renderCard)}</div>
        </div>
      </div>
    </section>
  );
}
