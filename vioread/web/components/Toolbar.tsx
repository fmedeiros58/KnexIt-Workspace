"use client";

import { LANGUAGE_OPTIONS } from "../lib/language";
import type { ReaderFitMode } from "../lib/types";

type Props = {
  sourceLanguage: string;
  targetLanguage: string;
  fitMode: ReaderFitMode;
  translating: boolean;
  translateError: string | null;
  onSourceLanguageChange: (value: string) => void;
  onTargetLanguageChange: (value: string) => void;
  onFitModeChange: (mode: ReaderFitMode) => void;
};

export default function Toolbar({
  sourceLanguage,
  targetLanguage,
  fitMode,
  translating,
  translateError,
  onSourceLanguageChange,
  onTargetLanguageChange,
  onFitModeChange,
}: Props) {
  return (
    <section className="reader-toolbar">
      <div className="reader-toolbar-row">
        <label className="reader-select-label">Origem</label>
        <select value={sourceLanguage} onChange={(event) => onSourceLanguageChange(event.target.value)} className="reader-select">
          {LANGUAGE_OPTIONS.map((lang) => (
            <option key={`src-${lang.code}`} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>

        <label className="reader-select-label">Destino</label>
        <select value={targetLanguage} onChange={(event) => onTargetLanguageChange(event.target.value)} className="reader-select">
          {LANGUAGE_OPTIONS.map((lang) => (
            <option key={`dst-${lang.code}`} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>

        <label className="reader-select-label">Visualização</label>
        <select
          value={fitMode}
          onChange={(event) => onFitModeChange(event.target.value as ReaderFitMode)}
          className="reader-select"
        >
          <option value="fit-pane">Ajustar ao painel</option>
          <option value="actual-size">Tamanho real</option>
        </select>

        {translating ? <span className="reader-status-pill">Traduzindo página...</span> : null}
        {translateError ? <span className="reader-status-pill error">{translateError}</span> : null}
      </div>
    </section>
  );
}

