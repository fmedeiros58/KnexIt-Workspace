"use client";

import { useState } from "react";

import {
  SupaDriveFilters,
  SupaDriveGrid,
  type SupaDriveItem,
  SupaDriveToolbar,
  InfoPanel,
  SidebarNav,
  SupaDriveAppsRail,
  TopBar,
} from "./components";

const primaryNav = [
  { id: "home", label: "Inicio", icon: "--" },
  { id: "supaDrive", label: "Meu SupaDrive", icon: "--", active: true },
  { id: "shared", label: "Compartilhados comigo", icon: "--" },
  { id: "starred", label: "Com estrela", icon: "--" },
];

const secondaryNav = [
  { id: "recent", label: "Recentes", icon: "--" },
  { id: "trash", label: "Lixeira", icon: "--" },
  { id: "storage", label: "Armazenamento", icon: "--", badge: "84%" },
];

const filters = [
  { id: "type", label: "Tipo" },
  { id: "people", label: "Pessoas" },
  { id: "modified", label: "Modificado", active: true },
  { id: "source", label: "Fonte" },
];

const folderItems: SupaDriveItem[] = [
  { id: "f1", name: "Projeto de Mestrado", meta: "Atualizado ontem - Voce", kind: "folder" },
  { id: "f2", name: "Materiais de aula", meta: "Atualizado ha 3 dias - Bruna", kind: "folder" },
  { id: "f3", name: "Classroom", meta: "Atualizado ha 1 semana - Sistema", kind: "folder" },
  { id: "f4", name: "Arquivos gerais", meta: "Atualizado ha 2 semanas - Time", kind: "folder" },
];

const fileItems: SupaDriveItem[] = [
  { id: "d1", name: "Terceiro questionario", meta: "Doc - 2 MB", kind: "doc" },
  { id: "d2", name: "SEI_UFAC 1359419", meta: "PDF - 4 MB", kind: "pdf" },
  { id: "d3", name: "Planilha sem titulo", meta: "Sheet - 620 KB", kind: "sheet" },
  { id: "d4", name: "Relatorio Quantitativo", meta: "Sheet - 1.2 MB", kind: "sheet" },
  { id: "d5", name: "Remover atalho", meta: "Link - Indisponivel", kind: "link", badge: "Atalho" },
];

const infoTabs = [
  { id: "details", label: "Detalhes", active: true },
  { id: "activity", label: "Atividades" },
];

export default function SupaDrivePage() {
  const [appsRailOpen, setAppsRailOpen] = useState(true);
  const [infoPanelVisible, setInfoPanelVisible] = useState(true);

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-slate-50 text-slate-900">
      <TopBar workspaceLabel="Preview" workspaceName="SupaDrive Workbench" userName="Francimar" userInitials="FM" />
      <div className="relative mx-auto flex w-full max-w-[1580px] flex-1 gap-6 px-4 py-6 pr-4 overflow-hidden">
        <SidebarNav
          primary={primaryNav}
          secondary={secondaryNav}
          storagePercent={84}
          storageTotal="100 GB"
          storageUsed="84.45 GB"
        />
        <section className="flex flex-1 flex-col space-y-6 overflow-hidden">
          <SupaDriveToolbar
            title="Meu SupaDrive"
            scopeLabel="Pessoal"
            onToggleInfo={() => setInfoPanelVisible((open) => !open)}
            infoPanelVisible={infoPanelVisible}
          >
            <SupaDriveFilters chips={filters} />
          </SupaDriveToolbar>
          <div className="flex-1 overflow-hidden">
            <SupaDriveGrid folders={folderItems} files={fileItems} />
          </div>
        </section>
        {infoPanelVisible ? (
          <div className="ml-auto flex shrink-0 items-stretch gap-2 pr-0">
            <InfoPanel
              title="Meu SupaDrive"
              tabs={infoTabs}
              emptyTitle="Selecione um item"
              emptyMessage="Escolha uma pasta ou arquivo para ver os detalhes aqui."
            />
            {appsRailOpen ? (
              <div className="flex flex-col items-center justify-between">
                <SupaDriveAppsRail />
              </div>
            ) : null}
            <div className="flex flex-col items-center justify-end">
              <button
                type="button"
                onClick={() => setAppsRailOpen((open) => !open)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-lg text-slate-500 shadow"
                aria-label={appsRailOpen ? "Recolher apps" : "Mostrar apps"}
                style={{ marginRight: "16px", paddingRight: "4px" }}
              >
                {appsRailOpen ? ">" : "<"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
