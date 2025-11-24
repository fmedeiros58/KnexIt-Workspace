"use client";

type Props = {
  onRun: () => void;
  loading: boolean;
  error: string | null;
};

export default function SearchExecutionPanel({ onRun, loading, error }: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex items-center justify-between">
      <div>
        <div className="text-sm font-semibold text-slate-900">Execução da busca</div>
        <div className="text-xs text-slate-500">Roda a estratégia nas fontes selecionadas.</div>
        {error ? <div className="text-xs text-rose-600">Erro: {error}</div> : null}
      </div>
      <button
        onClick={onRun}
        disabled={loading}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {loading ? "Buscando..." : "Executar busca"}
      </button>
    </div>
  );
}

