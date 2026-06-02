"use client";

import type { PdfReaderRibbonTab } from "../../types";
import {
  KNEXREAD_TAB_BAR_HEIGHT,
  KNEXREAD_TAB_BUTTON_HEIGHT,
} from "../knexreadLayout";

const TABS: Array<{ id: PdfReaderRibbonTab; label: string }> = [
  { id: "arquivo", label: "Arquivo" },
  { id: "inicio", label: "Página Inicial" },
  { id: "leitura", label: "Leitura" },
  { id: "traducao", label: "Tradução" },
  { id: "revisao", label: "Revisão" },
  { id: "anotacoes", label: "Anotações" },
  { id: "visualizacao", label: "Visualização" },
  { id: "exportar", label: "Exportar" },
  { id: "configuracoes", label: "Configurações" },
];

export function KnexreadTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: PdfReaderRibbonTab;
  onTabChange: (tab: PdfReaderRibbonTab) => void;
}) {
  return (
    <nav
      className="flex shrink-0 items-center gap-2 border-b border-zinc-300 bg-white px-3"
      style={{ height: KNEXREAD_TAB_BAR_HEIGHT }}
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className="relative inline-flex items-center whitespace-nowrap border border-transparent bg-white px-2 text-[15px] font-semibold leading-none transition hover:text-[#c23616]"
          style={
            activeTab === tab.id
              ? {
                  height: KNEXREAD_TAB_BUTTON_HEIGHT,
                  color: "#c23616",
                }
              : {
                  height: KNEXREAD_TAB_BUTTON_HEIGHT,
                  color: "#09090b",
                }
          }
        >
          <span
            className="inline-flex flex-col items-center justify-center"
            style={
              activeTab === tab.id
                ? {
                    color: "currentColor",
                  }
                : undefined
            }
          >
            <span>{tab.label}</span>
            {activeTab === tab.id ? (
              <span
                aria-hidden="true"
                style={{
                  marginTop: 3,
                  height: 3,
                  width: "100%",
                  minWidth: 24,
                  borderRadius: 9999,
                  backgroundColor: "currentColor",
                }}
              />
            ) : null}
          </span>
        </button>
      ))}
    </nav>
  );
}
