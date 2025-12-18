"use client";

import { useState } from "react";

import {
  SupaDriveFilters,
  SupaDriveToolbar,
  InfoPanel,
  SupaDriveAppsRail,
  SidebarNav,
  TopBar,
} from "./components";

type ChipFilter = { id: string; label: string; active?: boolean };
type InfoTab = { id: string; label: string; active?: boolean };

const TOPBAR_OFFSET = 72; // ajuste fino: 64/68/72/80 conforme a altura real do TopBar

const initialFilters: ChipFilter[] = [
  { id: "type", label: "Tipo" },
  { id: "people", label: "Pessoas" },
  { id: "modified", label: "Modificado", active: true },
  { id: "source", label: "Fonte" },
  { id: "cleanup", label: "Limpar filtros" },
];

const infoTabs: InfoTab[] = [
  { id: "details", label: "Detalhes", active: true },
  { id: "activity", label: "Atividades" },
];

const iconPath = (name: string) => {
  const paths: Record<string, string> = {
    personal:
      "M12 4a4 4 0 1 1-4 4 4 4 0 0 1 4-4Zm0 7c-3.866 0-7 1.79-7 4v1h14v-1c0-2.21-3.134-4-7-4Z",
    supadrive: "M4 6h7l2 2h7v11H4ZM4 6V4h7l2 2h7M6 12h12M6 16h12",
    shared: "M7 7a3 3 0 1 1 3 3 3 3 0 0 1-3-3Zm7-1h6v12H7v-3h8Z",
    computers: "M4 5h16v10H4Zm4 12h8",
    recent: "M12 6v6l4 2M5 12a7 7 0 1 1 7 7",
    starred:
      "m12 5 1.9 3.86L18 9.62l-3 2.92.71 4.14L12 15.77l-3.71 1.91L9 12.54 6 9.62l4.1-.76Z",
    spam: "M12 3.1 4.1 11l7.9 7.9L19.9 11Zm0 4v4m0 4h.01",
    trash: "M5 7h14M10 11v6m4-6v6M7 7l1-2h8l1 2M9 7v-2h6v2",
  };
  return paths[name] ?? "M5 5h14v14H5Z";
};

const primaryNav = [
  { id: "personal", label: "Pessoal", icon: iconPath("personal") },
  { id: "supadrive", label: "Meu SupaDrive", icon: iconPath("supadrive"), active: true },
  { id: "shared", label: "Drives compartilhados", icon: iconPath("shared") },
  { id: "computers", label: "Computadores", icon: iconPath("computers") },
];

const secondaryNav = [
  { id: "shared", label: "Compartilhados comigo", icon: iconPath("shared") },
  { id: "recent", label: "Recentes", icon: iconPath("recent") },
  { id: "starred", label: "Com estrela", icon: iconPath("starred") },
  { id: "spam", label: "Spam", icon: iconPath("spam") },
  { id: "trash", label: "Lixeira", icon: iconPath("trash") },
];

export default function SupaDrivePage() {
  const [appsRailOpen, setAppsRailOpen] = useState(true);
  const [infoPanelVisible, setInfoPanelVisible] = useState(true);
  const [chipFilters, setChipFilters] = useState<ChipFilter[]>(initialFilters);

  const handleToggleFilter = (id: string) => {
    setChipFilters((prev) =>
      prev.map((chip) => (chip.id === id ? { ...chip, active: !chip.active } : chip))
    );
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex w-full flex-col gap-0 px-0 pb-0 pt-0">
        <div className="bg-transparent p-0" data-section="header-container">
          <TopBar workspaceName="SupaDrive" userInitials="FM" />
        </div>

        {/* ✅ aqui está o ponto principal: altura do shell = viewport - TopBar */}
        <div
          className="flex gap-3 pb-0 items-stretch"
          data-section="layout-shell"
          style={{ height: `calc(100vh - ${TOPBAR_OFFSET}px)` }}
        >
          {/* ✅ garante que a sidebar “encoste” no fundo */}
          <div className="h-full">
            <SidebarNav
              primary={primaryNav}
              secondary={secondaryNav}
              storagePercent={84}
              storageUsed="84,88 GB"
              storageTotal="100 GB"
            />
          </div>

          {/* ✅ content ocupa toda a altura do shell */}
          <div className="flex flex-1 h-full flex-col gap-2" data-section="content-stack">
            <div
              className="flex h-full flex-col gap-6 rounded-3xl bg-white p-3 shadow-sm"
              data-section="filters-container"
              style={{ minWidth: "560px" }}
            >
              <SupaDriveToolbar
                title="Meu SupaDrive"
                onToggleInfo={() => setInfoPanelVisible((open) => !open)}
                infoPanelVisible={infoPanelVisible}
              >
                <SupaDriveFilters chips={chipFilters} onToggle={handleToggleFilter} />
              </SupaDriveToolbar>

              {/* ✅ grid preenche o restante do card */}
              <div
                className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 text-sm text-slate-500"
                data-section="visual-grid-container"
              >
                <div className="space-y-1 text-center">
                  <p>Visual do grid em ajuste.</p>
                  <p className="text-xs text-slate-400">
                    Vamos reposicionar os documentos em breve.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ✅ painel direito também com altura cheia */}
          <aside className="flex h-full shrink-0 items-stretch gap-3" data-section="panel-stack">
            {infoPanelVisible ? (
              <div className="h-full rounded-3xl bg-white shadow-sm" data-section="info-panel">
                <InfoPanel
                  title="Meu SupaDrive"
                  tabs={infoTabs}
                  emptyTitle="Selecione um item"
                  emptyMessage="Escolha uma pasta ou arquivo para ver os detalhes aqui."
                />
              </div>
            ) : null}

            <div
              className="flex h-full flex-col items-center justify-between rounded-3xl bg-white p-3 shadow-sm"
              data-section="toggles-container"
            >
              <div className="flex-1">{appsRailOpen ? <SupaDriveAppsRail /> : null}</div>

              <div className="mt-6 flex flex-col items-center gap-2" id="apps-rail-toggle">
                <div className="h-10 w-px bg-slate-200" />
                <button
                  type="button"
                  onClick={() => setAppsRailOpen((open) => !open)}
                  className={`flex h-10 w-10 items-center justify-center rounded-full border text-lg shadow transition ${
                    appsRailOpen
                      ? "border-slate-200 bg-white text-slate-500"
                      : "border-slate-900 bg-slate-900 text-white"
                  }`}
                  aria-label={appsRailOpen ? "Recolher apps" : "Mostrar apps"}
                >
                  {appsRailOpen ? ">" : "<"}
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
