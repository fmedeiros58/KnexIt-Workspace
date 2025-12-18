export type SupaDriveItem = {
  id: string;
  name: string;
  meta: string;
  badge?: string;
  kind: "folder" | "doc" | "sheet" | "pdf" | "link";
};

type SupaDriveGridProps = Record<string, never>;

export function SupaDriveGrid(_: SupaDriveGridProps) {
  return (
    <section className="flex h-full flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/70 text-center text-sm text-slate-500">
      <p>Sem pastas ou arquivos para exibir.</p>
      <p className="text-xs text-slate-400">Use o painel lateral para adicionar conteúdo.</p>
    </section>
  );
}
