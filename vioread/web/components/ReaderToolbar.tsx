"use client";

type Props = {
  mode: "single" | "dual";
  onModeChange: (m: "single" | "dual") => void;
  sourceLang: string;
  targetLang: string;
  onSourceLangChange: (lang: string) => void;
  onTargetLangChange: (lang: string) => void;
  translating: boolean;
  translateError: string | null;
};

const LANGS = [
  { code: "en", label: "Inglês" },
  { code: "pt", label: "Português" },
  { code: "es", label: "Espanhol" },
  { code: "fr", label: "Francês" },
];

export default function ReaderToolbar({
  mode,
  onModeChange,
  sourceLang,
  targetLang,
  onSourceLangChange,
  onTargetLangChange,
  translating,
  translateError,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs uppercase tracking-wide text-slate-500">Origem</label>
          <select
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm"
            value={sourceLang}
            onChange={(e) => onSourceLangChange(e.target.value)}
          >
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs uppercase tracking-wide text-slate-500">Destino</label>
          <select
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm"
            value={targetLang}
            onChange={(e) => onTargetLangChange(e.target.value)}
          >
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
          <span className="font-semibold">Modo:</span>
          <button
            className={`rounded-full px-2 py-1 ${mode === "single" ? "bg-white shadow border border-slate-200" : "hover:bg-white/60"}`}
            onClick={() => onModeChange("single")}
          >
            Traduzido
          </button>
          <button
            className={`rounded-full px-2 py-1 ${mode === "dual" ? "bg-white shadow border border-slate-200" : "hover:bg-white/60"}`}
            onClick={() => onModeChange("dual")}
          >
            Lado a lado
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {translateError ? <span className="text-xs text-rose-600">Falha na tradução (mock): {translateError}</span> : null}
        {translating ? (
          <span className="text-xs text-slate-500 animate-pulse">Traduzindo...</span>
        ) : (
          <span className="text-xs text-emerald-600">Pronto</span>
        )}
      </div>
    </div>
  );
}

