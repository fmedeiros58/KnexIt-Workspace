"use client";

export type PdfSearchMatch = {
  id: string;
  pageNumber: number;
  excerpt: string;
};

export function PdfSearchPanel({
  query,
  matches,
  onQueryChange,
  onSelectMatch,
}: {
  query: string;
  matches: PdfSearchMatch[];
  onQueryChange: (value: string) => void;
  onSelectMatch: (match: PdfSearchMatch) => void;
}) {
  return (
    <div className="space-y-2">
      <input
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Buscar no PDF..."
        className="w-full rounded border border-zinc-300 p-2 text-sm outline-none focus:border-blue-400"
      />
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {matches.map((match) => (
          <button
            key={match.id}
            type="button"
            onClick={() => onSelectMatch(match)}
            className="block w-full rounded border border-zinc-200 p-2 text-left text-xs hover:bg-zinc-100"
          >
            <p className="font-medium text-zinc-700">Pagina {match.pageNumber}</p>
            <p className="mt-1 line-clamp-2 text-zinc-600">{match.excerpt}</p>
          </button>
        ))}
        {!matches.length && query.trim() ? (
          <p className="rounded border border-zinc-200 p-2 text-xs text-zinc-500">
            Nenhum resultado encontrado.
          </p>
        ) : null}
      </div>
    </div>
  );
}
