"use client";

import { ChevronDown, FolderTree, PanelRightOpen } from "lucide-react";
import type { WriterRibbonProps } from "../../../shell/KnexWriterShell";
import { WriterRibbonGroup } from "../../WriterRibbonGroup";

// =====================================================
// 1. CONFIGURACAO VISUAL DO GRUPO
// =====================================================

const PROJECT_SECTION_GROUP_LAYOUT = {
  minButtonHeight: 76,
  minButtonWidth: 92,
  buttonGap: 4,
  buttonRadius: 6,
  buttonPaddingX: 8,
  buttonPaddingY: 4,
  iconContainerSize: 32,
  iconSize: 22,
  panelBadgeIconSize: 13,
  panelBadgeOffsetRight: -4,
  panelBadgeOffsetBottom: -4,
  indicatorFontSize: 10,
  indicatorChevronSize: 10,
} as const;

const PROJECT_SECTION_GROUP_COLORS = {
  activeBorder: "#93c5fd",
  activeBackground: "#eff6ff",
  activeText: "#1e40af",
  defaultText: "#3f3f46",
  defaultHoverBorder: "#d4d4d8",
  defaultHoverBackground: "#ffffff",
  iconContainerBorder: "#d4d4d8",
  iconContainerBackground: "#ffffff",
  iconContainerText: "#3f3f46",
  panelBadgeText: "#52525b",
} as const;

export function ProjectSectionGroup({ state, actions }: WriterRibbonProps) {
  const isOpen = !state.isWritingWorksCollapsed;

  return (
    <WriterRibbonGroup title="Organizacao de projetos">
      <button
        type="button"
        onClick={actions.toggleOrganizationPanel}
        aria-label="Abrir organizacao de projetos"
        aria-pressed={isOpen}
        title="Abrir organizacao de projetos"
        className="flex flex-col items-center justify-center border text-xs font-medium transition-colors"
        style={{
          minHeight: PROJECT_SECTION_GROUP_LAYOUT.minButtonHeight,
          minWidth: PROJECT_SECTION_GROUP_LAYOUT.minButtonWidth,
          gap: PROJECT_SECTION_GROUP_LAYOUT.buttonGap,
          borderRadius: PROJECT_SECTION_GROUP_LAYOUT.buttonRadius,
          paddingLeft: PROJECT_SECTION_GROUP_LAYOUT.buttonPaddingX,
          paddingRight: PROJECT_SECTION_GROUP_LAYOUT.buttonPaddingX,
          paddingTop: PROJECT_SECTION_GROUP_LAYOUT.buttonPaddingY,
          paddingBottom: PROJECT_SECTION_GROUP_LAYOUT.buttonPaddingY,
          borderColor: isOpen
            ? PROJECT_SECTION_GROUP_COLORS.activeBorder
            : "transparent",
          backgroundColor: isOpen
            ? PROJECT_SECTION_GROUP_COLORS.activeBackground
            : "transparent",
          color: isOpen
            ? PROJECT_SECTION_GROUP_COLORS.activeText
            : PROJECT_SECTION_GROUP_COLORS.defaultText,
        }}
        onMouseEnter={(event) => {
          if (isOpen) return;
          event.currentTarget.style.borderColor =
            PROJECT_SECTION_GROUP_COLORS.defaultHoverBorder;
          event.currentTarget.style.backgroundColor =
            PROJECT_SECTION_GROUP_COLORS.defaultHoverBackground;
        }}
        onMouseLeave={(event) => {
          if (isOpen) return;
          event.currentTarget.style.borderColor = "transparent";
          event.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        <span
          className="relative inline-flex items-center justify-center rounded-md border shadow-sm"
          style={{
            width: PROJECT_SECTION_GROUP_LAYOUT.iconContainerSize,
            height: PROJECT_SECTION_GROUP_LAYOUT.iconContainerSize,
            borderColor: PROJECT_SECTION_GROUP_COLORS.iconContainerBorder,
            backgroundColor: PROJECT_SECTION_GROUP_COLORS.iconContainerBackground,
            color: PROJECT_SECTION_GROUP_COLORS.iconContainerText,
          }}
        >
          <FolderTree
            size={PROJECT_SECTION_GROUP_LAYOUT.iconSize}
            strokeWidth={1.8}
          />
          <PanelRightOpen
            className="absolute rounded bg-white"
            style={{
              right: PROJECT_SECTION_GROUP_LAYOUT.panelBadgeOffsetRight,
              bottom: PROJECT_SECTION_GROUP_LAYOUT.panelBadgeOffsetBottom,
              color: PROJECT_SECTION_GROUP_COLORS.panelBadgeText,
            }}
            size={PROJECT_SECTION_GROUP_LAYOUT.panelBadgeIconSize}
            strokeWidth={1.8}
          />
        </span>
        <span>Organizacao</span>
        <span
          className="inline-flex items-center text-zinc-500"
          style={{
            gap: 2,
            fontSize: PROJECT_SECTION_GROUP_LAYOUT.indicatorFontSize,
          }}
        >
          Painel{" "}
          <ChevronDown size={PROJECT_SECTION_GROUP_LAYOUT.indicatorChevronSize} />
        </span>
      </button>
    </WriterRibbonGroup>
  );
}
