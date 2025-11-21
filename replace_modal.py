from pathlib import Path
path = Path('app/(no-nav)/upconect/drive/page.tsx')
text = path.read_text(encoding='utf-8')
start = text.index('        {playerOpen && active && (')
end = text.index('        )}', start)
end += len('        )}')
new = '''        {playerOpen && active && (
          <div class="fixed inset-0 z-50 flex items-center justify-center">
            <div class="absolute inset-0 bg-slate-900/80" onClick={closePlayer} />
            <div
              class="relative z-10 inline-block overflow-visible rounded-none shadow-2xl ring-1 ring-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                class="absolute inset-x-0 left-0 top-0 z-30 flex w-full max-w-[95vw] justify-center"
              >
                <div
                  class={`flex w-full max-w-[95vw] items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white/90 px-4 py-2 shadow-lg transition-all duration-300 ${overlayActive ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"}`}
                >
                  <button
                    type="button"
                    onClick={closePlayer}
                    class="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-semibold uppercase tracking-wide shadow"
                    aria-label="Fechar player"
                  >
                    ✕
                  </button>
                  <div class="flex gap-2">
                    <button
                      class="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-white/20"
                      title="Editar nome do arquivo"
                      type="button"
                    >
                      ✏️
                    </button>
                    <button
                      class="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-white/20"
                      title="Mais ações"
                      type="button"
                    >
                      ⋮
                    </button>
                  </div>
                </div>
              </div>
              {previewLoading && (
                <div class="flex h-[min(65vh,520px)] flex-col items-center justify-center text-xs uppercase tracking-[0.4em] text-slate-400">
                  carregando player...
                </div>
              )}
              {previewSrc && (
                <div class="relative pt-16">
                  <video
                    src={previewSrc}
                    class="block max-w-[95vw] max-h-[85vh]"
                    style={{ width: "auto", height: "auto" }}
                    controls
                    autoPlay
                    playsInline
                  />
                </div>
              )}
              {!previewSrc && !previewLoading && (
                <div class="flex h-[min(75vh,560px)] flex-col items-center justify-center gap-3 text-slate-400">
                  <FileThumb className="h-12 w-12" />
                  <p className="text-sm">Prévia indisponível</p>
                  {previewError && <p className="text-xs text-rose-500">{previewError}</p>}
                </div>
              )}
            </div>
          </div>
        )}
'''
text = text[:start] + new + text[end:]
path.write_text(text, encoding='utf-8')
