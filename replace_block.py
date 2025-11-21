from pathlib import Path
path = Path('app/(no-nav)/upconect/drive/page.tsx')
text = path.read_text(encoding='utf-8')
start = text.index('        {playerOpen && active && (')
end = text.index('      </main>', start)
block = text[start:end]
new = '''        {playerOpen && active && (
          <div className="relative z-10 mb-8 inline-block w-full max-w-[95vw] overflow-visible rounded-none shadow-2xl ring-1 ring-slate-200">
            {previewLoading && (
              <div className="flex h-[min(65vh,520px)] items-center justify-center text-xs uppercase tracking-[0.4em] text-slate-400">
                carregando player...
              </div>
            )}
            {previewSrc && (
              <div
                className="relative"
                onMouseMove={showOverlay}
                onMouseLeave={hideOverlay}
              >
                <div
                  className={`absolute inset-x-0 top-0 z-20 transition-all duration-300 ${
                    overlayActive ? "opacity-100 pointer-events-auto translate-y-0" : "opacity-0 pointer-events-none -translate-y-4"
                  }`}
                >
                  <div className="mx-auto flex w-full max-w-[95vw] items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white/90 px-4 py-2 shadow-lg">
                    <button
                      type="button"
                      onClick={closePlayer}
                      className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-semibold uppercase tracking-wide shadow"
                      aria-label="Fechar player"
                    >
                      ✕
                    </button>
                    <div className="flex gap-2">
                      <button
                        className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-white/20"
                        title="Editar nome do arquivo"
                        type="button"
                      >
                        ✏️
                      </button>
                      <button
                        className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-white/20"
                        title="Mais ações"
                        type="button"
                      >
                        ⋮
                      </button>
                    </div>
                  </div>
                </div>
                <div className="translate-y-12">
                  <video
                    src={previewSrc}
                    className="block max-w-[95vw] max-h-[85vh]"
                    style={{ width: "auto", height: "auto" }}
                    controls
                    autoPlay
                    playsInline
                  />
                </div>
              </div>
            )}
            {!previewSrc && !previewLoading && (
              <div className="flex h-[min(75vh,560px)] flex-col items-center justify-center gap-3 text-slate-400">
                <FileThumb className="h-12 w-12" />
                <p className="text-sm">Prévia indisponível</p>
                {previewError && <p className="text-xs text-rose-500">{previewError}</p>}
              </div>
            )}
          </div>
        )}
'''
text = text[:start] + new + text[end:]
path.write_text(text, encoding='utf-8')
