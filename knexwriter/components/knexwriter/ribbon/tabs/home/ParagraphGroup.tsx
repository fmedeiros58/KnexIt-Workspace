"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ChevronDown,
  IndentDecrease,
  IndentIncrease,
  List,
  ListOrdered,
  PaintBucket,
  Pilcrow,
  RotateCcw,
  SortAsc,
} from "lucide-react";
import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import type { WriterRenderActions } from "../../../shell/KnexWriterShell";

// =====================================================
// 1. CONFIGURAÇÃO VISUAL DO GRUPO
// =====================================================

const PARAGRAPH_GROUP_LAYOUT = {
  minWidth: 260,
  paddingX: 4,
  paddingTop: 4,
  paddingBottom: 18,
  rowCount: 2,
  rowHeight: 28,
  rowGap: 2,
  buttonHeight: 28,
  buttonMinWidth: 28,
  buttonPaddingX: 2,
  buttonRadius: 3,
  iconSize: 17,
  smallIconSize: 14,
  chevronSize: 12,
  commandGap: 2,
  dividerHeight: 20,
  dividerMarginX: 2,
  dialogLauncherSize: 16,
  dialogLauncherBottom: 2,
  dialogLauncherRight: 2,
  menuZIndex: 120000,
  menuViewportGap: 6,
  menuViewportPadding: 8,
  lineSpacingButtonMinWidth: 34,
} as const;

const PARAGRAPH_GROUP_COLORS = {
  selectorColor: "#3b82f6",
  selectorBorderColor: "#93c5fd",
  selectorBackgroundColor: "#dbeafe",
  selectorTextColor: "#1e40af",
  hoverBackgroundColor: "#eff6ff",
  defaultTextColor: "#27272a",
  disabledOpacity: 0.45,
  dividerColor: "#d4d4d8",
  menuBorderColor: "#d4d4d8",
} as const;

const PARAGRAPH_GROUP_MENU_LAYOUT = {
  bulletMenuWidth: 262,
  orderedMenuWidth: 278,
  multilevelMenuWidth: 318,
  lineSpacingMenuWidth: 300,
  shadingMenuWidth: 224,
  borderMenuWidth: 258,
  menuPadding: 8,
  menuGap: 4,
  menuRadius: 6,
  tilePadding: 8,
  tileRadius: 4,
} as const;

type TextAlignment = "left" | "center" | "right" | "justify";

type BulletListStyle = "disc" | "circle" | "square" | "check" | "dash" | "none";

type OrderedListStyle =
  | "decimal"
  | "lower-alpha"
  | "upper-alpha"
  | "lower-roman"
  | "upper-roman"
  | "none";

type MultilevelListStyle = "classic" | "legal" | "outline" | "article" | "none";

type LineSpacingValue = "1" | "1.15" | "1.5" | "2" | "2.5" | "3" | "custom";

type ParagraphSpacingPreset =
  | "none"
  | "compact"
  | "normal"
  | "open"
  | "relaxed"
  | "academic";

type ParagraphBorderStyle =
  | "none"
  | "bottom"
  | "top"
  | "left"
  | "right"
  | "outside"
  | "inside"
  | "all";

type ParagraphShadingColor =
  | "transparent"
  | "#fef3c7"
  | "#e0f2fe"
  | "#dcfce7"
  | "#fce7f3"
  | "#f3f4f6"
  | "#ede9fe"
  | "#ffffff";

type ParagraphCommands = {
  toggleBulletList: (style?: BulletListStyle) => void;
  toggleOrderedList: (style?: OrderedListStyle) => void;
  setMultilevelList: (style: MultilevelListStyle) => void;
  decreaseIndent: () => void;
  increaseIndent: () => void;
  setTextAlignLeft: () => void;
  setTextAlignCenter: () => void;
  setTextAlignRight: () => void;
  setTextAlignJustify: () => void;
  setTextAlign: (alignment: TextAlignment) => void;
  setLineSpacing: (spacing: LineSpacingValue) => void;
  setParagraphSpacing: (preset: ParagraphSpacingPreset) => void;
  setParagraphShading: (color: ParagraphShadingColor) => void;
  setParagraphBorder: (border: ParagraphBorderStyle) => void;
  sortParagraphsAscending: () => void;
  toggleParagraphMarks: () => void;
  clearParagraphFormatting: () => void;
  openParagraphDialog: () => void;
};

type ParagraphGroupProps = {
  editor?: Editor | null;
  actions?: WriterRenderActions;
  commands?: Partial<ParagraphCommands>;
  disabled?: boolean;
  currentAlignment?: TextAlignment;
  currentLineSpacing?: LineSpacingValue;
  currentParagraphSpacing?: ParagraphSpacingPreset;
  currentShadingColor?: ParagraphShadingColor;
  currentBorderStyle?: ParagraphBorderStyle;
  showParagraphMarks?: boolean;
  isBulletListActive?: boolean;
  isOrderedListActive?: boolean;

  /**
   * Permite receber props extras vindas do HomeRibbonTab sem quebrar
   * a tipagem durante a evolução modular do KnexWriter.
   */
  [key: string]: unknown;
};

type DropdownRenderProps = {
  close: () => void;
};

type FloatingMenuPosition = {
  top: number;
  left: number;
  minWidth: number;
};

const BULLET_STYLES: Array<{
  id: BulletListStyle;
  label: string;
  preview: string;
  description: string;
}> = [
  {
    id: "disc",
    label: "Marcadores sólidos",
    preview: "•",
    description: "Lista com marcador circular preenchido.",
  },
  {
    id: "circle",
    label: "Marcadores vazados",
    preview: "○",
    description: "Lista com marcador circular vazado.",
  },
  {
    id: "square",
    label: "Marcadores quadrados",
    preview: "▪",
    description: "Lista com marcador quadrado.",
  },
  {
    id: "check",
    label: "Marcadores de verificação",
    preview: "✓",
    description: "Lista com marca de verificação.",
  },
  {
    id: "dash",
    label: "Marcadores em traço",
    preview: "–",
    description: "Lista com traço como marcador.",
  },
  {
    id: "none",
    label: "Nenhum",
    preview: " ",
    description: "Remove a lista com marcadores.",
  },
];

const ORDERED_STYLES: Array<{
  id: OrderedListStyle;
  label: string;
  preview: string;
  description: string;
}> = [
  {
    id: "decimal",
    label: "1, 2, 3",
    preview: "1.",
    description: "Lista numerada padrão.",
  },
  {
    id: "lower-alpha",
    label: "a, b, c",
    preview: "a.",
    description: "Lista com letras minúsculas.",
  },
  {
    id: "upper-alpha",
    label: "A, B, C",
    preview: "A.",
    description: "Lista com letras maiúsculas.",
  },
  {
    id: "lower-roman",
    label: "i, ii, iii",
    preview: "i.",
    description: "Lista com algarismos romanos minúsculos.",
  },
  {
    id: "upper-roman",
    label: "I, II, III",
    preview: "I.",
    description: "Lista com algarismos romanos maiúsculos.",
  },
  {
    id: "none",
    label: "Nenhum",
    preview: " ",
    description: "Remove a lista numerada.",
  },
];

const MULTILEVEL_STYLES: Array<{
  id: MultilevelListStyle;
  label: string;
  preview: string[];
  description: string;
}> = [
  {
    id: "classic",
    label: "Lista multinível clássica",
    preview: ["1.", "a.", "i."],
    description: "Estrutura simples com número, letra e romano.",
  },
  {
    id: "legal",
    label: "Numeração legal",
    preview: ["1", "1.1", "1.1.1"],
    description: "Boa opção para documentos normativos.",
  },
  {
    id: "outline",
    label: "Estrutura de tópicos",
    preview: ["I.", "A.", "1."],
    description: "Estrutura hierárquica formal.",
  },
  {
    id: "article",
    label: "Artigos e itens",
    preview: ["Art. 1º", "I", "a)"],
    description: "Modelo útil para minutas e documentos administrativos.",
  },
  {
    id: "none",
    label: "Nenhum",
    preview: ["", "", ""],
    description: "Remove estrutura multinível.",
  },
];

const LINE_SPACING_OPTIONS: Array<{
  id: LineSpacingValue;
  label: string;
  description: string;
}> = [
  { id: "1", label: "1,0", description: "Espaçamento simples." },
  { id: "1.15", label: "1,15", description: "Espaçamento padrão moderno." },
  { id: "1.5", label: "1,5", description: "Espaçamento intermediário." },
  { id: "2", label: "2,0", description: "Espaçamento duplo." },
  { id: "2.5", label: "2,5", description: "Espaçamento ampliado." },
  { id: "3", label: "3,0", description: "Espaçamento muito amplo." },
  { id: "custom", label: "Opções...", description: "Abrir opções avançadas." },
];

const PARAGRAPH_SPACING_PRESETS: Array<{
  id: ParagraphSpacingPreset;
  label: string;
  description: string;
  previewGap: number;
}> = [
  {
    id: "none",
    label: "Sem espaçamento",
    description: "Remove espaços antes e depois do parágrafo.",
    previewGap: 2,
  },
  {
    id: "compact",
    label: "Compacto",
    description: "Reduz o espaço entre os parágrafos.",
    previewGap: 4,
  },
  {
    id: "normal",
    label: "Normal",
    description: "Espaçamento equilibrado para documentos comuns.",
    previewGap: 6,
  },
  {
    id: "open",
    label: "Aberto",
    description: "Aumenta a separação entre os parágrafos.",
    previewGap: 8,
  },
  {
    id: "relaxed",
    label: "Relaxado",
    description: "Deixa a leitura em tela mais confortável.",
    previewGap: 10,
  },
  {
    id: "academic",
    label: "Acadêmico",
    description: "Configuração de espaçamento para texto formal.",
    previewGap: 7,
  },
];

const SHADING_COLORS: Array<{
  id: ParagraphShadingColor;
  label: string;
}> = [
  { id: "transparent", label: "Sem sombreamento" },
  { id: "#fef3c7", label: "Amarelo claro" },
  { id: "#e0f2fe", label: "Azul claro" },
  { id: "#dcfce7", label: "Verde claro" },
  { id: "#fce7f3", label: "Rosa claro" },
  { id: "#f3f4f6", label: "Cinza claro" },
  { id: "#ede9fe", label: "Roxo claro" },
  { id: "#ffffff", label: "Branco" },
];

const BORDER_STYLES: Array<{
  id: ParagraphBorderStyle;
  label: string;
  preview: ReactNode;
}> = [
  {
    id: "none",
    label: "Sem borda",
    preview: <BorderPreview type="none" />,
  },
  {
    id: "bottom",
    label: "Borda inferior",
    preview: <BorderPreview type="bottom" />,
  },
  {
    id: "top",
    label: "Borda superior",
    preview: <BorderPreview type="top" />,
  },
  {
    id: "left",
    label: "Borda esquerda",
    preview: <BorderPreview type="left" />,
  },
  {
    id: "right",
    label: "Borda direita",
    preview: <BorderPreview type="right" />,
  },
  {
    id: "outside",
    label: "Bordas externas",
    preview: <BorderPreview type="outside" />,
  },
  {
    id: "inside",
    label: "Bordas internas",
    preview: <BorderPreview type="inside" />,
  },
  {
    id: "all",
    label: "Todas as bordas",
    preview: <BorderPreview type="all" />,
  },
];

// =====================================================
// 4. LEITURA DO ESTADO DO EDITOR
// =====================================================

const PARAGRAPH_SPACING_STYLE_MAP: Record<
  ParagraphSpacingPreset,
  { marginTop: string | null; marginBottom: string | null }
> = {
  none: { marginTop: "0px", marginBottom: "0px" },
  compact: { marginTop: "0px", marginBottom: "4px" },
  normal: { marginTop: "0px", marginBottom: "8px" },
  open: { marginTop: "0px", marginBottom: "12px" },
  relaxed: { marginTop: "0px", marginBottom: "16px" },
  academic: { marginTop: "0px", marginBottom: "10px" },
};

const BORDER_COLOR = "#6b7280";

type WritingCommandName =
  | "textAlign"
  | "justifyLeft"
  | "justifyCenter"
  | "justifyRight"
  | "justifyFull"
  | "insertUnorderedList"
  | "insertOrderedList"
  | "toggleBulletList"
  | "toggleOrderedList"
  | "indent"
  | "outdent"
  | "lineHeight"
  | "paragraphSpacing"
  | "paragraphShading"
  | "paragraphBorder"
  | "clearParagraphFormatting"
  | "toggleParagraphMarks"
  | "openParagraphDialog"
  | "sortParagraphsAscending";

function safeRun(action: () => void) {
  try {
    action();
    return true;
  } catch (error) {
    console.warn("[KnexWriter] Falha em comando de parágrafo", error);
    return false;
  }
}

function callApplyWritingCommand(
  actions: WriterRenderActions | undefined,
  command: WritingCommandName,
  value?: string,
) {
  if (!actions?.applyWritingCommand) {
    return false;
  }

  return safeRun(() =>
    actions.applyWritingCommand(command as never, value),
  );
}

function getActiveBlockAttributes(editor?: Editor | null) {
  if (!editor) return null;
  try {
    if (editor.isActive("heading")) {
      return editor.getAttributes("heading") as Record<string, unknown>;
    }
    return editor.getAttributes("paragraph") as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseStyleText(styleText: string | null | undefined) {
  const map = new Map<string, string>();
  if (!styleText) return map;

  for (const declaration of styleText.split(";")) {
    const [rawProperty, ...rawValueParts] = declaration.split(":");
    const property = rawProperty?.trim().toLowerCase();
    const value = rawValueParts.join(":").trim();

    if (property && value) {
      map.set(property, value);
    }
  }

  return map;
}

function styleMapToText(styleMap: Map<string, string>) {
  const entries = Array.from(styleMap.entries());
  if (!entries.length) return null;
  return entries.map(([property, value]) => `${property}: ${value}`).join("; ") + ";";
}

function getCurrentTextAlignment(editor?: Editor | null): TextAlignment {
  if (!editor) return "left";
  try {
    if (editor.isActive({ textAlign: "center" })) return "center";
    if (editor.isActive({ textAlign: "right" })) return "right";
    if (editor.isActive({ textAlign: "justify" })) return "justify";
  } catch {
    return "left";
  }
  return "left";
}

function getCurrentLineSpacing(editor?: Editor | null): LineSpacingValue {
  const attributes = getActiveBlockAttributes(editor);
  const styleText = typeof attributes?.writerBlockStyle === "string"
    ? attributes.writerBlockStyle
    : "";
  const styleMap = parseStyleText(styleText);
  const lineHeight = styleMap.get("line-height");

  if (!lineHeight) return "1.5";

  const normalized = lineHeight.replace(",", ".").trim();
  if (
    normalized === "1" ||
    normalized === "1.15" ||
    normalized === "1.5" ||
    normalized === "2" ||
    normalized === "2.5" ||
    normalized === "3"
  ) {
    return normalized as LineSpacingValue;
  }

  return "custom";
}

function getCurrentParagraphSpacing(editor?: Editor | null): ParagraphSpacingPreset {
  const attributes = getActiveBlockAttributes(editor);
  const styleText = typeof attributes?.writerBlockStyle === "string"
    ? attributes.writerBlockStyle
    : "";
  const styleMap = parseStyleText(styleText);
  const marginBottom = styleMap.get("margin-bottom");
  if (!marginBottom) return "normal";

  const px = Number.parseFloat(marginBottom.replace("px", "").replace(",", "."));
  if (!Number.isFinite(px)) return "normal";

  if (px <= 1) return "none";
  if (px <= 5) return "compact";
  if (px <= 9) return "normal";
  if (px <= 13) return "open";
  if (px <= 15) return "academic";
  return "relaxed";
}

function getCurrentParagraphShading(editor?: Editor | null): ParagraphShadingColor {
  const attributes = getActiveBlockAttributes(editor);
  const styleText = typeof attributes?.writerBlockStyle === "string"
    ? attributes.writerBlockStyle
    : "";
  const styleMap = parseStyleText(styleText);
  const color = styleMap.get("background-color");
  if (!color || color === "transparent") return "transparent";

  const known = SHADING_COLORS.find((item) => item.id === color)?.id;
  return (known ?? "transparent") as ParagraphShadingColor;
}

function getCurrentParagraphBorder(editor?: Editor | null): ParagraphBorderStyle {
  const attributes = getActiveBlockAttributes(editor);
  const styleText = typeof attributes?.writerBlockStyle === "string"
    ? attributes.writerBlockStyle
    : "";
  const styleMap = parseStyleText(styleText);

  const border = styleMap.get("border");
  const borderTop = styleMap.get("border-top");
  const borderBottom = styleMap.get("border-bottom");
  const borderLeft = styleMap.get("border-left");
  const borderRight = styleMap.get("border-right");

  if (border) return "all";
  if (borderTop && borderBottom && borderLeft && borderRight) return "all";
  if (borderTop && borderBottom) return "inside";
  if (borderBottom) return "bottom";
  if (borderTop) return "top";
  if (borderLeft) return "left";
  if (borderRight) return "right";
  return "none";
}

function getIsBulletListActive(editor?: Editor | null) {
  if (!editor) return false;
  try {
    return editor.isActive("bulletList");
  } catch {
    return false;
  }
}

function getIsOrderedListActive(editor?: Editor | null) {
  if (!editor) return false;
  try {
    return editor.isActive("orderedList");
  } catch {
    return false;
  }
}

function applyParagraphStylePatch(editor: Editor, patch: Record<string, string | null>) {
  const update = (nodeType: "paragraph" | "heading") => {
    const currentAttributes = editor.getAttributes(nodeType) as Record<string, unknown>;
    const styleMap = parseStyleText(
      typeof currentAttributes.writerBlockStyle === "string"
        ? currentAttributes.writerBlockStyle
        : "",
    );

    for (const [property, value] of Object.entries(patch)) {
      if (value === null) {
        styleMap.delete(property);
      } else {
        styleMap.set(property, value);
      }
    }

    const nextStyleText = styleMapToText(styleMap);
    const chain = editor.chain().focus();
    chain.updateAttributes(nodeType, {
      ...currentAttributes,
      writerBlockStyle: nextStyleText,
    });
    chain.run();
  };

  if (editor.isActive("heading")) {
    update("heading");
    return;
  }

  update("paragraph");
}

// =====================================================
// 5. COMANDOS DO GRUPO
// =====================================================

function createParagraphCommands({
  editor,
  actions,
  fallbackCommands,
}: {
  editor?: Editor | null;
  actions?: WriterRenderActions;
  fallbackCommands?: Partial<ParagraphCommands>;
}): ParagraphCommands {
  const runEditor = (callback: (instance: Editor) => void) => {
    if (!editor) return false;
    return safeRun(() => callback(editor));
  };

  const fromFallback = <TArgs extends unknown[]>(
    key: keyof ParagraphCommands,
    ...args: TArgs
  ) => {
    const fallback = fallbackCommands?.[key];
    if (!fallback) return false;
    return safeRun(() =>
      (fallback as (...fnArgs: TArgs) => void)(...args),
    );
  };

  return {
    toggleBulletList: (style = "disc") => {
      if (fromFallback("toggleBulletList", style)) return;
      if (runEditor((instance) => instance.chain().focus().toggleBulletList().run())) return;
      callApplyWritingCommand(actions, "toggleBulletList");
      callApplyWritingCommand(actions, "insertUnorderedList");
    },
    toggleOrderedList: (style = "decimal") => {
      if (fromFallback("toggleOrderedList", style)) return;
      if (runEditor((instance) => instance.chain().focus().toggleOrderedList().run())) return;
      callApplyWritingCommand(actions, "toggleOrderedList");
      callApplyWritingCommand(actions, "insertOrderedList");
    },
    setMultilevelList: (style) => {
      if (fromFallback("setMultilevelList", style)) return;
      if (style === "none") {
        runEditor((instance) => instance.chain().focus().liftListItem("listItem").run());
        return;
      }
      if (runEditor((instance) => instance.chain().focus().toggleOrderedList().run())) return;
      callApplyWritingCommand(actions, "insertOrderedList");
    },
    decreaseIndent: () => {
      if (fromFallback("decreaseIndent")) return;
      if (callApplyWritingCommand(actions, "outdent")) return;
      runEditor((instance) => {
        const current = instance.getAttributes("paragraph");
        const styleMap = parseStyleText(
          typeof current.writerBlockStyle === "string" ? current.writerBlockStyle : "",
        );
        const left = Number.parseFloat((styleMap.get("margin-left") || "0").replace("px", "")) || 0;
        applyParagraphStylePatch(instance, {
          "margin-left": `${Math.max(0, left - 18)}px`,
        });
      });
    },
    increaseIndent: () => {
      if (fromFallback("increaseIndent")) return;
      if (callApplyWritingCommand(actions, "indent")) return;
      runEditor((instance) => {
        const current = instance.getAttributes("paragraph");
        const styleMap = parseStyleText(
          typeof current.writerBlockStyle === "string" ? current.writerBlockStyle : "",
        );
        const left = Number.parseFloat((styleMap.get("margin-left") || "0").replace("px", "")) || 0;
        applyParagraphStylePatch(instance, {
          "margin-left": `${left + 18}px`,
        });
      });
    },
    setTextAlignLeft: () => {
      if (fromFallback("setTextAlignLeft")) return;
      if (runEditor((instance) => instance.chain().focus().setTextAlign("left").run())) return;
      callApplyWritingCommand(actions, "justifyLeft");
      callApplyWritingCommand(actions, "textAlign", "left");
    },
    setTextAlignCenter: () => {
      if (fromFallback("setTextAlignCenter")) return;
      if (runEditor((instance) => instance.chain().focus().setTextAlign("center").run())) return;
      callApplyWritingCommand(actions, "justifyCenter");
      callApplyWritingCommand(actions, "textAlign", "center");
    },
    setTextAlignRight: () => {
      if (fromFallback("setTextAlignRight")) return;
      if (runEditor((instance) => instance.chain().focus().setTextAlign("right").run())) return;
      callApplyWritingCommand(actions, "justifyRight");
      callApplyWritingCommand(actions, "textAlign", "right");
    },
    setTextAlignJustify: () => {
      if (fromFallback("setTextAlignJustify")) return;
      if (runEditor((instance) => instance.chain().focus().setTextAlign("justify").run())) return;
      callApplyWritingCommand(actions, "justifyFull");
      callApplyWritingCommand(actions, "textAlign", "justify");
    },
    setTextAlign: (alignment) => {
      if (fromFallback("setTextAlign", alignment)) return;
      if (runEditor((instance) => instance.chain().focus().setTextAlign(alignment).run())) return;
      callApplyWritingCommand(actions, "textAlign", alignment);
    },
    setLineSpacing: (spacing) => {
      if (spacing === "custom") {
        if (fromFallback("openParagraphDialog")) return;
        callApplyWritingCommand(actions, "openParagraphDialog");
        return;
      }
      if (fromFallback("setLineSpacing", spacing)) return;
      if (runEditor((instance) => applyParagraphStylePatch(instance, { "line-height": spacing }))) return;
      callApplyWritingCommand(actions, "lineHeight", spacing);
    },
    setParagraphSpacing: (preset) => {
      if (fromFallback("setParagraphSpacing", preset)) return;
      const spacing = PARAGRAPH_SPACING_STYLE_MAP[preset];
      if (
        runEditor((instance) =>
          applyParagraphStylePatch(instance, {
            "margin-top": spacing.marginTop,
            "margin-bottom": spacing.marginBottom,
          }),
        )
      ) {
        return;
      }
      callApplyWritingCommand(actions, "paragraphSpacing", preset);
    },
    setParagraphShading: (color) => {
      if (fromFallback("setParagraphShading", color)) return;
      if (
        runEditor((instance) =>
          applyParagraphStylePatch(instance, {
            "background-color": color === "transparent" ? null : color,
          }),
        )
      ) {
        return;
      }
      callApplyWritingCommand(actions, "paragraphShading", color);
    },
    setParagraphBorder: (border) => {
      if (fromFallback("setParagraphBorder", border)) return;
      const patch: Record<string, string | null> = {
        border: null,
        "border-top": null,
        "border-bottom": null,
        "border-left": null,
        "border-right": null,
        padding: null,
        "padding-top": null,
        "padding-bottom": null,
        "padding-left": null,
        "padding-right": null,
      };

      if (border === "bottom") {
        patch["border-bottom"] = `1px solid ${BORDER_COLOR}`;
        patch["padding-bottom"] = "2px";
      } else if (border === "top") {
        patch["border-top"] = `1px solid ${BORDER_COLOR}`;
        patch["padding-top"] = "2px";
      } else if (border === "left") {
        patch["border-left"] = `1px solid ${BORDER_COLOR}`;
        patch["padding-left"] = "4px";
      } else if (border === "right") {
        patch["border-right"] = `1px solid ${BORDER_COLOR}`;
        patch["padding-right"] = "4px";
      } else if (border === "outside" || border === "all") {
        patch.border = `1px solid ${BORDER_COLOR}`;
        patch.padding = "3px 4px";
      } else if (border === "inside") {
        patch["border-top"] = `1px solid ${BORDER_COLOR}`;
        patch["border-bottom"] = `1px solid ${BORDER_COLOR}`;
        patch["padding-top"] = "2px";
        patch["padding-bottom"] = "2px";
      }

      if (runEditor((instance) => applyParagraphStylePatch(instance, patch))) return;
      callApplyWritingCommand(actions, "paragraphBorder", border);
    },
    sortParagraphsAscending: () => {
      if (fromFallback("sortParagraphsAscending")) return;
      if (callApplyWritingCommand(actions, "sortParagraphsAscending")) return;
      console.warn("[KnexWriter] sortParagraphsAscending ainda não implementado com segurança.");
    },
    toggleParagraphMarks: () => {
      if (fromFallback("toggleParagraphMarks")) return;
      if (callApplyWritingCommand(actions, "toggleParagraphMarks")) return;
      console.warn("[KnexWriter] toggleParagraphMarks sem suporte no editor atual.");
    },
    clearParagraphFormatting: () => {
      if (fromFallback("clearParagraphFormatting")) return;
      if (
        runEditor((instance) => {
          instance.chain().focus().setTextAlign("left").run();
          applyParagraphStylePatch(instance, {
            "line-height": null,
            "margin-top": null,
            "margin-bottom": null,
            "background-color": null,
            border: null,
            "border-top": null,
            "border-bottom": null,
            "border-left": null,
            "border-right": null,
            padding: null,
            "padding-top": null,
            "padding-bottom": null,
            "padding-left": null,
            "padding-right": null,
          });
        })
      ) {
        return;
      }
      callApplyWritingCommand(actions, "clearParagraphFormatting");
    },
    openParagraphDialog: () => {
      if (fromFallback("openParagraphDialog")) return;
      if (callApplyWritingCommand(actions, "openParagraphDialog")) return;
      console.warn("[KnexWriter] openParagraphDialog ainda não implementado.");
    },
  };
}

export function ParagraphGroup({
  editor,
  actions,
  commands,
  disabled = false,
  currentAlignment,
  currentLineSpacing,
  currentParagraphSpacing,
  currentShadingColor,
  currentBorderStyle,
  showParagraphMarks,
  isBulletListActive,
  isOrderedListActive,
}: ParagraphGroupProps = {}) {
  const computedAlignment =
    currentAlignment ?? getCurrentTextAlignment(editor);
  const computedLineSpacing =
    currentLineSpacing ?? getCurrentLineSpacing(editor);
  const computedParagraphSpacing =
    currentParagraphSpacing ?? getCurrentParagraphSpacing(editor);
  const computedShadingColor =
    currentShadingColor ?? getCurrentParagraphShading(editor);
  const computedBorderStyle =
    currentBorderStyle ?? getCurrentParagraphBorder(editor);
  const computedBulletListActive =
    isBulletListActive ?? getIsBulletListActive(editor);
  const computedOrderedListActive =
    isOrderedListActive ?? getIsOrderedListActive(editor);
  const computedParagraphMarksVisible = showParagraphMarks ?? false;

  const [alignment, setAlignment] = useState<TextAlignment>(computedAlignment);
  const [lineSpacing, setLineSpacing] = useState<LineSpacingValue>(computedLineSpacing);
  const [paragraphSpacing, setParagraphSpacing] = useState<ParagraphSpacingPreset>(computedParagraphSpacing);
  const [shadingColor, setShadingColor] = useState<ParagraphShadingColor>(computedShadingColor);
  const [borderStyle, setBorderStyle] = useState<ParagraphBorderStyle>(computedBorderStyle);
  const [paragraphMarksVisible, setParagraphMarksVisible] = useState(computedParagraphMarksVisible);

  const commandSet = useMemo(
    () =>
      createParagraphCommands({
        editor,
        actions,
        fallbackCommands: commands,
      }),
    [actions, commands, editor],
  );

  const isDisabled = disabled || !editor;

  useEffect(() => {
    setAlignment(computedAlignment);
  }, [computedAlignment]);

  useEffect(() => {
    setLineSpacing(computedLineSpacing);
  }, [computedLineSpacing]);

  useEffect(() => {
    setParagraphSpacing(computedParagraphSpacing);
  }, [computedParagraphSpacing]);

  useEffect(() => {
    setShadingColor(computedShadingColor);
  }, [computedShadingColor]);

  useEffect(() => {
    setBorderStyle(computedBorderStyle);
  }, [computedBorderStyle]);

  useEffect(() => {
    setParagraphMarksVisible(computedParagraphMarksVisible);
  }, [computedParagraphMarksVisible]);

  const applyAlignment = (nextAlignment: TextAlignment) => {
    setAlignment(nextAlignment);

    if (nextAlignment === "left") {
      commandSet.setTextAlignLeft();
      commandSet.setTextAlign("left");
      return;
    }

    if (nextAlignment === "center") {
      commandSet.setTextAlignCenter();
      commandSet.setTextAlign("center");
      return;
    }

    if (nextAlignment === "right") {
      commandSet.setTextAlignRight();
      commandSet.setTextAlign("right");
      return;
    }

    commandSet.setTextAlignJustify();
    commandSet.setTextAlign("justify");
  };

  const applyLineSpacing = (nextSpacing: LineSpacingValue) => {
    if (nextSpacing === "custom") {
      commandSet.openParagraphDialog();
      return;
    }

    setLineSpacing(nextSpacing);
    commandSet.setLineSpacing(nextSpacing);
  };

  const applyParagraphSpacing = (nextSpacing: ParagraphSpacingPreset) => {
    setParagraphSpacing(nextSpacing);
    commandSet.setParagraphSpacing(nextSpacing);
  };

  const applyShading = (nextColor: ParagraphShadingColor) => {
    setShadingColor(nextColor);
    commandSet.setParagraphShading(nextColor);
  };

  const applyBorder = (nextBorder: ParagraphBorderStyle) => {
    setBorderStyle(nextBorder);
    commandSet.setParagraphBorder(nextBorder);
  };

  const resetParagraphFormatting = () => {
    setAlignment("left");
    setLineSpacing("1.5");
    setParagraphSpacing("normal");
    setShadingColor("transparent");
    setBorderStyle("none");
    commandSet.clearParagraphFormatting();
  };

  return (
    <WriterRibbonGroup title="Parágrafo">
      <div
        className="relative"
        style={{
          minWidth: PARAGRAPH_GROUP_LAYOUT.minWidth,
          paddingLeft: PARAGRAPH_GROUP_LAYOUT.paddingX,
          paddingRight: PARAGRAPH_GROUP_LAYOUT.paddingX,
          paddingTop: PARAGRAPH_GROUP_LAYOUT.paddingTop,
          paddingBottom: PARAGRAPH_GROUP_LAYOUT.paddingBottom,
        }}
      >
        <div
          className="grid"
          style={{
            gridTemplateRows: `repeat(${PARAGRAPH_GROUP_LAYOUT.rowCount}, ${PARAGRAPH_GROUP_LAYOUT.rowHeight}px)`,
            rowGap: PARAGRAPH_GROUP_LAYOUT.rowGap,
          }}
        >
          <div className="flex items-center" style={{ columnGap: PARAGRAPH_GROUP_LAYOUT.commandGap }}>
            <DropdownButton
              label="Marcadores"
              tooltip="Criar lista com marcadores"
              active={computedBulletListActive}
              disabled={isDisabled}
              menuWidth={PARAGRAPH_GROUP_MENU_LAYOUT.bulletMenuWidth}
              icon={<List style={{ width: PARAGRAPH_GROUP_LAYOUT.iconSize, height: PARAGRAPH_GROUP_LAYOUT.iconSize }} />}
            >
              {({ close }) => (
                <BulletListMenu
                  onSelect={(style) => {
                    commandSet.toggleBulletList(style);
                    close();
                  }}
                />
              )}
            </DropdownButton>

            <DropdownButton
              label="Numeração"
              tooltip="Criar lista numerada"
              active={computedOrderedListActive}
              disabled={isDisabled}
              menuWidth={PARAGRAPH_GROUP_MENU_LAYOUT.orderedMenuWidth}
              icon={<ListOrdered style={{ width: PARAGRAPH_GROUP_LAYOUT.iconSize, height: PARAGRAPH_GROUP_LAYOUT.iconSize }} />}
            >
              {({ close }) => (
                <OrderedListMenu
                  onSelect={(style) => {
                    commandSet.toggleOrderedList(style);
                    close();
                  }}
                />
              )}
            </DropdownButton>

            <DropdownButton
              label="Lista multinível"
              tooltip="Criar lista multinível"
              disabled={isDisabled}
              menuWidth={PARAGRAPH_GROUP_MENU_LAYOUT.multilevelMenuWidth}
              icon={<span className="text-[14px] font-medium leading-none">1↳</span>}
            >
              {({ close }) => (
                <MultilevelListMenu
                  onSelect={(style) => {
                    commandSet.setMultilevelList(style);
                    close();
                  }}
                />
              )}
            </DropdownButton>

            <VerticalDivider />

            <RibbonIconButton
              label="Diminuir recuo"
              disabled={isDisabled}
              onClick={() => commandSet.decreaseIndent()}
            >
              <IndentDecrease style={{ width: PARAGRAPH_GROUP_LAYOUT.iconSize, height: PARAGRAPH_GROUP_LAYOUT.iconSize }} />
            </RibbonIconButton>

            <RibbonIconButton
              label="Aumentar recuo"
              disabled={isDisabled}
              onClick={() => commandSet.increaseIndent()}
            >
              <IndentIncrease style={{ width: PARAGRAPH_GROUP_LAYOUT.iconSize, height: PARAGRAPH_GROUP_LAYOUT.iconSize }} />
            </RibbonIconButton>

            <RibbonIconButton
              label="Classificar"
              disabled={isDisabled}
              onClick={() => commandSet.sortParagraphsAscending()}
            >
              <SortAsc style={{ width: PARAGRAPH_GROUP_LAYOUT.iconSize, height: PARAGRAPH_GROUP_LAYOUT.iconSize }} />
            </RibbonIconButton>

            <RibbonIconButton
              label="Mostrar ou ocultar marcas de parágrafo"
              active={paragraphMarksVisible}
              disabled={isDisabled}
              onClick={() => {
                setParagraphMarksVisible((current) => !current);
                commandSet.toggleParagraphMarks();
              }}
            >
              <Pilcrow style={{ width: PARAGRAPH_GROUP_LAYOUT.iconSize, height: PARAGRAPH_GROUP_LAYOUT.iconSize }} />
            </RibbonIconButton>
          </div>

          <div className="flex items-center" style={{ columnGap: PARAGRAPH_GROUP_LAYOUT.commandGap }}>
            <RibbonIconButton
              label="Alinhar à esquerda"
              active={alignment === "left"}
              disabled={isDisabled}
              onClick={() => applyAlignment("left")}
            >
              <AlignLeft style={{ width: PARAGRAPH_GROUP_LAYOUT.iconSize, height: PARAGRAPH_GROUP_LAYOUT.iconSize }} />
            </RibbonIconButton>

            <RibbonIconButton
              label="Centralizar"
              active={alignment === "center"}
              disabled={isDisabled}
              onClick={() => applyAlignment("center")}
            >
              <AlignCenter style={{ width: PARAGRAPH_GROUP_LAYOUT.iconSize, height: PARAGRAPH_GROUP_LAYOUT.iconSize }} />
            </RibbonIconButton>

            <RibbonIconButton
              label="Alinhar à direita"
              active={alignment === "right"}
              disabled={isDisabled}
              onClick={() => applyAlignment("right")}
            >
              <AlignRight style={{ width: PARAGRAPH_GROUP_LAYOUT.iconSize, height: PARAGRAPH_GROUP_LAYOUT.iconSize }} />
            </RibbonIconButton>

            <RibbonIconButton
              label="Justificar"
              active={alignment === "justify"}
              disabled={isDisabled}
              onClick={() => applyAlignment("justify")}
            >
              <AlignJustify style={{ width: PARAGRAPH_GROUP_LAYOUT.iconSize, height: PARAGRAPH_GROUP_LAYOUT.iconSize }} />
            </RibbonIconButton>

            <VerticalDivider />

            <DropdownButton
              label="Espaçamento entre linhas e parágrafos"
              tooltip={`Espaçamento atual: ${lineSpacing}`}
              disabled={isDisabled}
              menuWidth={PARAGRAPH_GROUP_MENU_LAYOUT.lineSpacingMenuWidth}
              buttonClassName=""
              buttonMinWidth={PARAGRAPH_GROUP_LAYOUT.lineSpacingButtonMinWidth}
              icon={<LineSpacingIcon />}
            >
              {({ close }) => (
                <LineSpacingMenu
                  selectedLineSpacing={lineSpacing}
                  selectedParagraphSpacing={paragraphSpacing}
                  onLineSpacingSelect={(spacing) => {
                    applyLineSpacing(spacing);
                    close();
                  }}
                  onParagraphSpacingSelect={(spacing) => {
                    applyParagraphSpacing(spacing);
                    close();
                  }}
                />
              )}
            </DropdownButton>

            <DropdownButton
              label="Sombreamento"
              tooltip="Aplicar cor de fundo ao parágrafo"
              disabled={isDisabled}
              menuWidth={PARAGRAPH_GROUP_MENU_LAYOUT.shadingMenuWidth}
              buttonMinWidth={PARAGRAPH_GROUP_LAYOUT.lineSpacingButtonMinWidth}
              icon={
                <span className="relative flex h-5 w-5 items-center justify-center">
                  <PaintBucket style={{ width: PARAGRAPH_GROUP_LAYOUT.iconSize, height: PARAGRAPH_GROUP_LAYOUT.iconSize }} />
                  <span
                    className="absolute bottom-0 h-[3px] w-4 rounded-sm border border-black/10"
                    style={{
                      backgroundColor:
                        shadingColor === "transparent" ? "#ffffff" : shadingColor,
                    }}
                  />
                </span>
              }
            >
              {({ close }) => (
                <ShadingMenu
                  selectedColor={shadingColor}
                  onSelect={(color) => {
                    applyShading(color);
                    close();
                  }}
                />
              )}
            </DropdownButton>

            <DropdownButton
              label="Bordas"
              tooltip="Adicionar ou remover bordas do parágrafo"
              disabled={isDisabled}
              menuWidth={PARAGRAPH_GROUP_MENU_LAYOUT.borderMenuWidth}
              buttonMinWidth={PARAGRAPH_GROUP_LAYOUT.lineSpacingButtonMinWidth}
              icon={<BorderPreview type={borderStyle} />}
            >
              {({ close }) => (
                <BorderMenu
                  selectedBorder={borderStyle}
                  onSelect={(border) => {
                    applyBorder(border);
                    close();
                  }}
                />
              )}
            </DropdownButton>

            <SmallCommandButton
              label="Limpar"
              tooltip="Remover formatação de parágrafo"
              disabled={isDisabled}
              icon={<RotateCcw style={{ width: PARAGRAPH_GROUP_LAYOUT.smallIconSize, height: PARAGRAPH_GROUP_LAYOUT.smallIconSize }} />}
              onClick={resetParagraphFormatting}
            />
          </div>
        </div>

        <button
          type="button"
          aria-label="Abrir configurações avançadas de parágrafo"
          title="Abrir configurações avançadas de parágrafo"
          className="absolute flex items-center justify-center rounded-sm text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900"
          style={{
            bottom: PARAGRAPH_GROUP_LAYOUT.dialogLauncherBottom,
            right: PARAGRAPH_GROUP_LAYOUT.dialogLauncherRight,
            width: PARAGRAPH_GROUP_LAYOUT.dialogLauncherSize,
            height: PARAGRAPH_GROUP_LAYOUT.dialogLauncherSize,
          }}
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            event.stopPropagation();
            commandSet.openParagraphDialog();
          }}
        >
          <span className="leading-none" style={{ fontSize: PARAGRAPH_GROUP_LAYOUT.chevronSize }}>
            ↘
          </span>
        </button>
      </div>
    </WriterRibbonGroup>
  );
}

function DropdownButton({
  label,
  tooltip,
  icon,
  active = false,
  disabled = false,
  menuWidth,
  buttonClassName = "",
  buttonMinWidth,
  children,
}: {
  label: string;
  tooltip: string;
  icon: ReactNode;
  active?: boolean;
  disabled?: boolean;
  menuWidth: number;
  buttonClassName?: string;
  buttonMinWidth?: number;
  children: (helpers: DropdownRenderProps) => ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<FloatingMenuPosition>({
    top: 0,
    left: 0,
    minWidth: menuWidth,
  });

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const updateMenuPosition = useCallback(() => {
    const buttonRect = buttonRef.current?.getBoundingClientRect();

    if (!buttonRect) {
      return;
    }

    const viewportWidth =
      typeof window === "undefined" ? menuWidth : window.innerWidth;

    const gapPx = PARAGRAPH_GROUP_LAYOUT.menuViewportGap;
    const safePaddingPx = PARAGRAPH_GROUP_LAYOUT.menuViewportPadding;

    const preferredLeft = buttonRect.left;
    const maxLeft = Math.max(
      safePaddingPx,
      viewportWidth - menuWidth - safePaddingPx,
    );

    setMenuPosition({
      top: buttonRect.bottom + gapPx,
      left: Math.min(Math.max(safePaddingPx, preferredLeft), maxLeft),
      minWidth: Math.max(menuWidth, buttonRect.width),
    });
  }, [menuWidth]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    updateMenuPosition();

    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen, updateMenuPosition]);

  useCloseOnOutsideInteraction(
    [buttonRef, menuRef],
    isOpen,
    () => setIsOpen(false),
  );

  const activeStyle = active
    ? {
        borderColor: PARAGRAPH_GROUP_COLORS.selectorBorderColor,
        backgroundColor: PARAGRAPH_GROUP_COLORS.selectorBackgroundColor,
        color: PARAGRAPH_GROUP_COLORS.selectorTextColor,
      }
    : undefined;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        title={tooltip}
        disabled={disabled}
        className={[
          "flex items-center justify-center rounded-sm border transition-colors",
          active
            ? ""
            : "border-transparent bg-transparent hover:border-zinc-300 hover:bg-white",
          disabled ? "cursor-not-allowed" : "cursor-pointer",
          buttonClassName,
        ].join(" ")}
        style={{
          ...activeStyle,
          height: PARAGRAPH_GROUP_LAYOUT.buttonHeight,
          minWidth: buttonMinWidth ?? PARAGRAPH_GROUP_LAYOUT.buttonMinWidth,
          paddingLeft: PARAGRAPH_GROUP_LAYOUT.buttonPaddingX,
          paddingRight: PARAGRAPH_GROUP_LAYOUT.buttonPaddingX,
          borderRadius: PARAGRAPH_GROUP_LAYOUT.buttonRadius,
          color: active
            ? PARAGRAPH_GROUP_COLORS.selectorTextColor
            : PARAGRAPH_GROUP_COLORS.defaultTextColor,
          opacity: disabled ? PARAGRAPH_GROUP_COLORS.disabledOpacity : 1,
        }}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          updateMenuPosition();
          setIsOpen((current) => !current);
        }}
        onMouseEnter={(event) => {
          if (!active && !disabled) {
            event.currentTarget.style.backgroundColor =
              PARAGRAPH_GROUP_COLORS.hoverBackgroundColor;
          }
        }}
        onMouseLeave={(event) => {
          if (!active) {
            event.currentTarget.style.backgroundColor = "";
          }
        }}
      >
        {icon}
        <ChevronDown
          className="ml-[1px]"
          style={{
            width: PARAGRAPH_GROUP_LAYOUT.chevronSize,
            height: PARAGRAPH_GROUP_LAYOUT.chevronSize,
          }}
        />
      </button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed rounded-md border border-zinc-300 bg-white shadow-2xl"
              style={{
                top: menuPosition.top,
                left: menuPosition.left,
                minWidth: menuPosition.minWidth,
                zIndex: PARAGRAPH_GROUP_LAYOUT.menuZIndex,
                borderColor: PARAGRAPH_GROUP_COLORS.menuBorderColor,
                borderRadius: PARAGRAPH_GROUP_MENU_LAYOUT.menuRadius,
              }}
            >
              {children({ close: () => setIsOpen(false) })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function RibbonIconButton({
  label,
  active = false,
  disabled = false,
  children,
  onClick,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  const activeStyle = active
    ? {
        borderColor: PARAGRAPH_GROUP_COLORS.selectorBorderColor,
        backgroundColor: PARAGRAPH_GROUP_COLORS.selectorBackgroundColor,
        color: PARAGRAPH_GROUP_COLORS.selectorTextColor,
      }
    : undefined;

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      className={[
        "flex items-center justify-center rounded-sm border transition-colors",
        active
          ? ""
          : "border-transparent bg-transparent hover:border-zinc-300 hover:bg-white",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
      ].join(" ")}
      style={{
        ...activeStyle,
        height: PARAGRAPH_GROUP_LAYOUT.buttonHeight,
        minWidth: PARAGRAPH_GROUP_LAYOUT.buttonMinWidth,
        paddingLeft: PARAGRAPH_GROUP_LAYOUT.buttonPaddingX,
        paddingRight: PARAGRAPH_GROUP_LAYOUT.buttonPaddingX,
        borderRadius: PARAGRAPH_GROUP_LAYOUT.buttonRadius,
        color: active
          ? PARAGRAPH_GROUP_COLORS.selectorTextColor
          : PARAGRAPH_GROUP_COLORS.defaultTextColor,
        opacity: disabled ? PARAGRAPH_GROUP_COLORS.disabledOpacity : 1,
      }}
      onMouseDown={(event: ReactMouseEvent<HTMLButtonElement>) =>
        event.preventDefault()
      }
      onMouseEnter={(event) => {
        if (!active && !disabled) {
          event.currentTarget.style.backgroundColor =
            PARAGRAPH_GROUP_COLORS.hoverBackgroundColor;
        }
      }}
      onMouseLeave={(event) => {
        if (!active) {
          event.currentTarget.style.backgroundColor = "";
        }
      }}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function SmallCommandButton({
  label,
  tooltip,
  icon,
  disabled,
  onClick,
}: {
  label: string;
  tooltip: string;
  icon: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={tooltip}
      title={tooltip}
      disabled={disabled}
      className={[
        "flex items-center justify-center rounded-sm border border-transparent text-zinc-800 hover:border-zinc-300 hover:bg-white",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
      ].join(" ")}
      style={{
        height: PARAGRAPH_GROUP_LAYOUT.buttonHeight,
        minWidth: PARAGRAPH_GROUP_LAYOUT.buttonMinWidth,
        paddingLeft: PARAGRAPH_GROUP_LAYOUT.buttonPaddingX,
        paddingRight: PARAGRAPH_GROUP_LAYOUT.buttonPaddingX,
        borderRadius: PARAGRAPH_GROUP_LAYOUT.buttonRadius,
        opacity: disabled ? PARAGRAPH_GROUP_COLORS.disabledOpacity : 1,
      }}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        {icon}
      </span>
      <span className="sr-only">{label}</span>
    </button>
  );
}

function VerticalDivider() {
  return (
    <span
      className="w-px shrink-0"
      style={{
        marginLeft: PARAGRAPH_GROUP_LAYOUT.dividerMarginX,
        marginRight: PARAGRAPH_GROUP_LAYOUT.dividerMarginX,
        height: PARAGRAPH_GROUP_LAYOUT.dividerHeight,
        backgroundColor: PARAGRAPH_GROUP_COLORS.dividerColor,
      }}
    />
  );
}

function BulletListMenu({
  onSelect,
}: {
  onSelect: (style: BulletListStyle) => void;
}) {
  return (
    <div style={{ padding: PARAGRAPH_GROUP_MENU_LAYOUT.menuPadding }}>
      <div className="mb-2 px-1 text-[11px] font-semibold text-zinc-600">
        Biblioteca de marcadores
      </div>

      <div className="grid grid-cols-3" style={{ gap: PARAGRAPH_GROUP_MENU_LAYOUT.menuGap }}>
        {BULLET_STYLES.map((style) => (
          <MenuTile
            key={style.id}
            title={style.description}
            onClick={() => onSelect(style.id)}
          >
            <div className="mb-1 flex h-8 items-center justify-center text-[18px]">
              {style.preview}
            </div>
            <div className="truncate text-center text-[10px] text-zinc-700">
              {style.label}
            </div>
          </MenuTile>
        ))}
      </div>
    </div>
  );
}

function OrderedListMenu({
  onSelect,
}: {
  onSelect: (style: OrderedListStyle) => void;
}) {
  return (
    <div style={{ padding: PARAGRAPH_GROUP_MENU_LAYOUT.menuPadding }}>
      <div className="mb-2 px-1 text-[11px] font-semibold text-zinc-600">
        Biblioteca de numeração
      </div>

      <div className="grid grid-cols-3" style={{ gap: PARAGRAPH_GROUP_MENU_LAYOUT.menuGap }}>
        {ORDERED_STYLES.map((style) => (
          <MenuTile
            key={style.id}
            title={style.description}
            onClick={() => onSelect(style.id)}
          >
            <div className="mb-1 flex h-8 items-center justify-center text-[16px]">
              {style.preview}
            </div>
            <div className="truncate text-center text-[10px] text-zinc-700">
              {style.label}
            </div>
          </MenuTile>
        ))}
      </div>
    </div>
  );
}

function MultilevelListMenu({
  onSelect,
}: {
  onSelect: (style: MultilevelListStyle) => void;
}) {
  return (
    <div style={{ padding: PARAGRAPH_GROUP_MENU_LAYOUT.menuPadding }}>
      <div className="mb-2 px-1 text-[11px] font-semibold text-zinc-600">
        Biblioteca de listas multiníveis
      </div>

      <div className="grid grid-cols-2" style={{ gap: PARAGRAPH_GROUP_MENU_LAYOUT.menuGap * 2 }}>
        {MULTILEVEL_STYLES.map((style) => (
          <MenuTile
            key={style.id}
            title={style.description}
            onClick={() => onSelect(style.id)}
          >
            <div className="mb-1 flex h-12 flex-col justify-center gap-1 text-[11px] text-zinc-700">
              {style.preview.map((item, index) => (
                <span
                  key={`${style.id}-${index}`}
                  style={{ paddingLeft: index * 12 }}
                >
                  {item || "Nenhum"}
                </span>
              ))}
            </div>

            <div className="text-[11px] font-medium text-zinc-800">
              {style.label}
            </div>

            <div className="mt-0.5 text-[10px] leading-snug text-zinc-500">
              {style.description}
            </div>
          </MenuTile>
        ))}
      </div>
    </div>
  );
}

function LineSpacingMenu({
  selectedLineSpacing,
  selectedParagraphSpacing,
  onLineSpacingSelect,
  onParagraphSpacingSelect,
}: {
  selectedLineSpacing: LineSpacingValue;
  selectedParagraphSpacing: ParagraphSpacingPreset;
  onLineSpacingSelect: (spacing: LineSpacingValue) => void;
  onParagraphSpacingSelect: (spacing: ParagraphSpacingPreset) => void;
}) {
  return (
    <div style={{ padding: PARAGRAPH_GROUP_MENU_LAYOUT.menuPadding }}>
      <div className="mb-2 px-1 text-[11px] font-semibold text-zinc-600">
        Espaçamento entre linhas
      </div>

      <div className="flex flex-col" style={{ gap: PARAGRAPH_GROUP_MENU_LAYOUT.menuGap }}>
        {LINE_SPACING_OPTIONS.map((spacing) => (
          <MenuRow
            key={spacing.id}
            selected={selectedLineSpacing === spacing.id}
            onClick={() => onLineSpacingSelect(spacing.id)}
          >
            <CheckSlot visible={selectedLineSpacing === spacing.id} />
            <span className="min-w-[34px] text-[12px] font-medium">
              {spacing.label}
            </span>
            <span className="truncate text-[10px] text-zinc-500">
              {spacing.description}
            </span>
          </MenuRow>
        ))}
      </div>

      <div className="my-2 h-px bg-zinc-200" />

      <div className="mb-2 px-1 text-[11px] font-semibold text-zinc-600">
        Espaçamento entre parágrafos
      </div>

      <div className="flex flex-col" style={{ gap: PARAGRAPH_GROUP_MENU_LAYOUT.menuGap }}>
        {PARAGRAPH_SPACING_PRESETS.map((spacing) => (
          <MenuRow
            key={spacing.id}
            selected={selectedParagraphSpacing === spacing.id}
            onClick={() => onParagraphSpacingSelect(spacing.id)}
          >
            <CheckSlot visible={selectedParagraphSpacing === spacing.id} />

            <span
              className="flex h-9 w-12 shrink-0 flex-col justify-center rounded border border-zinc-200 bg-white px-1"
              style={{ gap: spacing.previewGap / 3 }}
            >
              <span className="h-[3px] w-full rounded bg-zinc-400" />
              <span className="h-[3px] w-3/4 rounded bg-zinc-400" />
              <span className="h-[3px] w-full rounded bg-zinc-400" />
            </span>

            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[12px] font-medium">{spacing.label}</span>
              <span className="truncate text-[10px] text-zinc-500">
                {spacing.description}
              </span>
            </span>
          </MenuRow>
        ))}
      </div>
    </div>
  );
}

function ShadingMenu({
  selectedColor,
  onSelect,
}: {
  selectedColor: ParagraphShadingColor;
  onSelect: (color: ParagraphShadingColor) => void;
}) {
  return (
    <div style={{ padding: PARAGRAPH_GROUP_MENU_LAYOUT.menuPadding }}>
      <div className="mb-2 px-1 text-[11px] font-semibold text-zinc-600">
        Sombreamento do parágrafo
      </div>

      <div className="grid grid-cols-4" style={{ gap: PARAGRAPH_GROUP_MENU_LAYOUT.menuGap }}>
        {SHADING_COLORS.map((color) => (
          <button
            key={color.id}
            type="button"
            className="h-8 rounded border"
            title={color.label}
            aria-label={color.label}
            style={{
              borderColor:
                selectedColor === color.id
                  ? PARAGRAPH_GROUP_COLORS.selectorColor
                  : "#d4d4d8",
              boxShadow:
                selectedColor === color.id
                  ? `0 0 0 1px ${PARAGRAPH_GROUP_COLORS.selectorColor}`
                  : undefined,
              backgroundColor: color.id === "transparent" ? "#ffffff" : color.id,
              backgroundImage:
                color.id === "transparent"
                  ? "linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)"
                  : undefined,
              backgroundSize: color.id === "transparent" ? "8px 8px" : undefined,
              backgroundPosition:
                color.id === "transparent"
                  ? "0 0, 0 4px, 4px -4px, -4px 0px"
                  : undefined,
            }}
            onClick={() => onSelect(color.id)}
          />
        ))}
      </div>
    </div>
  );
}

function BorderMenu({
  selectedBorder,
  onSelect,
}: {
  selectedBorder: ParagraphBorderStyle;
  onSelect: (border: ParagraphBorderStyle) => void;
}) {
  return (
    <div style={{ padding: PARAGRAPH_GROUP_MENU_LAYOUT.menuPadding }}>
      <div className="mb-2 px-1 text-[11px] font-semibold text-zinc-600">
        Bordas do parágrafo
      </div>

      <div className="grid grid-cols-2" style={{ gap: PARAGRAPH_GROUP_MENU_LAYOUT.menuGap }}>
        {BORDER_STYLES.map((border) => (
          <MenuRow
            key={border.id}
            selected={selectedBorder === border.id}
            onClick={() => onSelect(border.id)}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center">
              {border.preview}
            </span>
            <span className="text-[11px] text-zinc-800">{border.label}</span>
          </MenuRow>
        ))}
      </div>
    </div>
  );
}

function MenuTile({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="rounded border border-zinc-200 bg-white text-left"
      style={{
        padding: PARAGRAPH_GROUP_MENU_LAYOUT.tilePadding,
        borderRadius: PARAGRAPH_GROUP_MENU_LAYOUT.tileRadius,
      }}
      title={title}
      onMouseEnter={(event) => {
        event.currentTarget.style.borderColor =
          PARAGRAPH_GROUP_COLORS.selectorColor;
        event.currentTarget.style.backgroundColor =
          PARAGRAPH_GROUP_COLORS.hoverBackgroundColor;
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.borderColor = "";
        event.currentTarget.style.backgroundColor = "";
      }}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function MenuRow({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left"
        style={{
        backgroundColor: selected
          ? PARAGRAPH_GROUP_COLORS.selectorBackgroundColor
          : undefined,
        color: selected
          ? PARAGRAPH_GROUP_COLORS.selectorTextColor
          : PARAGRAPH_GROUP_COLORS.defaultTextColor,
      }}
      onMouseEnter={(event) => {
        if (!selected) {
          event.currentTarget.style.backgroundColor =
            PARAGRAPH_GROUP_COLORS.hoverBackgroundColor;
        }
      }}
      onMouseLeave={(event) => {
        if (!selected) {
          event.currentTarget.style.backgroundColor = "";
        }
      }}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function LineSpacingIcon() {
  return (
    <span className="relative flex h-5 w-5 items-center justify-center">
      <span className="absolute left-[3px] top-[3px] h-[2px] w-[10px] rounded bg-current" />
      <span className="absolute left-[3px] top-[8px] h-[2px] w-[10px] rounded bg-current" />
      <span className="absolute left-[3px] top-[13px] h-[2px] w-[10px] rounded bg-current" />
      <span className="absolute right-[1px] top-[3px] text-[9px] leading-none">↕</span>
    </span>
  );
}

function BorderPreview({ type }: { type: ParagraphBorderStyle }) {
  const borderColor = "#374151";

  return (
    <span
      className="relative block h-5 w-5 rounded-sm"
      style={{
        border:
          type === "outside" || type === "all"
            ? `1.5px solid ${borderColor}`
            : "1px solid #d4d4d8",
      }}
    >
      {type === "top" || type === "all" ? (
        <span
          className="absolute left-0 right-0 top-0 h-[1.5px]"
          style={{ backgroundColor: borderColor }}
        />
      ) : null}

      {type === "bottom" || type === "all" ? (
        <span
          className="absolute bottom-0 left-0 right-0 h-[1.5px]"
          style={{ backgroundColor: borderColor }}
        />
      ) : null}

      {type === "left" || type === "all" ? (
        <span
          className="absolute bottom-0 left-0 top-0 w-[1.5px]"
          style={{ backgroundColor: borderColor }}
        />
      ) : null}

      {type === "right" || type === "all" ? (
        <span
          className="absolute bottom-0 right-0 top-0 w-[1.5px]"
          style={{ backgroundColor: borderColor }}
        />
      ) : null}

      {type === "inside" || type === "all" ? (
        <>
          <span
            className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2"
            style={{ backgroundColor: borderColor }}
          />
          <span
            className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2"
            style={{ backgroundColor: borderColor }}
          />
        </>
      ) : null}

      {type === "none" ? (
        <span className="absolute left-1/2 top-1/2 h-px w-[130%] -translate-x-1/2 -translate-y-1/2 rotate-[-35deg] bg-zinc-400" />
      ) : null}
    </span>
  );
}

function CheckSlot({ visible }: { visible: boolean }) {
  return (
    <span
      className="flex h-4 w-4 shrink-0 items-center justify-center"
      style={{
        color: PARAGRAPH_GROUP_COLORS.selectorTextColor,
      }}
    >
      {visible ? "✓" : null}
    </span>
  );
}

function useCloseOnOutsideInteraction(
  refs: Array<RefObject<HTMLElement | null>>,
  isOpen: boolean,
  onClose: () => void,
) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;

      if (
        target &&
        refs.some((ref) => ref.current && ref.current.contains(target))
      ) {
        return;
      }

      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, refs]);
}

export default ParagraphGroup;
