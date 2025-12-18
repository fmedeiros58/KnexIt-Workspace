"use client";

type TopBarProps = {
  workspaceName: string;
  userInitials: string;
  sidebarWidth?: number;

  /**
   * Distância extra para alinhar a search com o início do bloco central.
   * Deve bater com o gap do layout-shell (gap-3 = 12px) + qualquer “gutter”.
   */
  contentOffset?: number;
};

export function TopBar({
  workspaceName,
  userInitials,
  sidebarWidth = 280,
  contentOffset = 12, // gap-3 padrão do seu layout-shell
}: TopBarProps) {
  return (
    <header className="w-full bg-slate-50" data-section="topbar">
      <div className="flex items-center gap-3 px-3 py-3">
        {/* Coluna esquerda (mesma largura do SidebarNav) */}
        <div className="flex items-center gap-2" style={{ width: sidebarWidth }}>
          {/* SD azul */}
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-[11px] font-semibold text-white">
            SD
          </div>

          <span className="text-sm font-semibold text-slate-900">{workspaceName}</span>
        </div>

        {/* Search: alinhada à esquerda e com offset para bater com a coluna do content */}
        <div className="flex flex-1 justify-start">
          <div className="w-full max-w-[780px]" style={{ paddingLeft: contentOffset }}>
            <div className="flex h-11 items-center gap-3 rounded-full border border-slate-200 bg-slate-100 px-4 text-slate-600 shadow-sm">
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M10 4a6 6 0 1 1 3.6 10.8l4.3 4.3-1.4 1.4-4.3-4.3A6 6 0 0 1 10 4Zm0 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"
                />
              </svg>

              <input
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
                placeholder={`Pesquise no ${workspaceName}`}
              />

              {/* ícone de filtros (opcional, parecido com drive) */}
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-200/70"
                aria-label="Filtros"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M10 18h4v-2h-4v2Zm-7-12v2h18V6H3Zm3 7h12v-2H6v2Z"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Direita (ícones “limpos” estilo Drive) */}
        <div className="flex items-center gap-1">
          <button className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100" aria-label="Ajuda">
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path
                fill="currentColor"
                d="M11 18h2v-2h-2v2Zm1-16C6.935 2 3 5.935 3 11s3.935 9 9 9 9-3.935 9-9-3.935-9-9-9Zm0 16c-3.859 0-7-3.141-7-7s3.141-7 7-7 7 3.141 7 7-3.141 7-7 7Zm0-12a3 3 0 0 0-3 3h2a1 1 0 1 1 2 0c0 1-1 1.25-1.5 1.75-.5.5-.5 1.25-.5 1.25h2c0-.5 0-.75.29-1.04.62-.62 1.71-1.14 1.71-2.96a3 3 0 0 0-3-3Z"
              />
            </svg>
          </button>

          <button className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100" aria-label="Configurações">
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path
                fill="currentColor"
                d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.05 7.05 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 1h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.58.23-1.13.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 7.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.23.39.32.6.22l2.39-.96c.5.4 1.05.71 1.63.94l.36 2.54c.04.24.25.42.49.42h3.8c.24 0 .45-.18.49-.42l.36-2.54c.58-.23 1.13-.54 1.63-.94l2.39.96c.22.1.47.01.6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z"
              />
            </svg>
          </button>

          <div className="ml-2 flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
            {userInitials}
          </div>
        </div>
      </div>
    </header>
  );
}
