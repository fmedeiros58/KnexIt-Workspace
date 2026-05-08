"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  Bold,
  ChevronDown,
  Eraser,
  Italic,
  Minus,
  Plus,
  Strikethrough,
  Subscript,
  Superscript,
  Type,
  Underline,
  X,
} from "lucide-react";
import { WriterRibbonGroup } from "../../WriterRibbonGroup";

type ChangeCaseMode =
  | "sentence"
  | "lowercase"
  | "uppercase"
  | "capitalize"
  | "toggle";

type FontStyleMode = "regular" | "italic" | "bold" | "boldItalic";

type UnderlineStyle = "none" | "single" | "double" | "dotted" | "dashed";

type WriterFontCommands = {
  setFontFamily: (fontFamily: string) => void;
  setFontSize: (fontSize: string | number) => void;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  toggleBold: () => void;
  toggleItalic: () => void;
  toggleUnderline: () => void;
  toggleStrike: () => void;
  toggleSubscript: () => void;
  toggleSuperscript: () => void;
  setTextColor: (color: string) => void;
  setHighlightColor: (color: string) => void;
  clearFormatting: () => void;
  changeCase: (mode: ChangeCaseMode) => void;
};

type WriterFontActions = {
  applyWritingCommand?: (command: string, value?: string) => void;
  [key: string]: unknown;
};

type WriterFontEditor = {
  chain?: () => any;
  commands?: Record<string, unknown>;
  isActive?: (...args: any[]) => boolean;
  getAttributes?: (...args: any[]) => Record<string, unknown>;
  [key: string]: unknown;
};

type FontGroupProps = {
  editor?: WriterFontEditor | null;
  actions?: WriterFontActions;
  state?: unknown;
  commands?: Partial<WriterFontCommands>;
  disabled?: boolean;
  currentFontFamily?: string;
  currentFontSize?: string | number;
  currentTextColor?: string;
  currentHighlightColor?: string;
  isBoldActive?: boolean;
  isItalicActive?: boolean;
  isUnderlineActive?: boolean;
  isStrikeActive?: boolean;
  isSubscriptActive?: boolean;
  isSuperscriptActive?: boolean;
  [key: string]: unknown;
};

type WriterFontSource = "academic-equivalent" | "system" | "web-free";

type FontOption = {
  label: string;
  value: string;
  cssFamily: string;
  source: WriterFontSource;
  category: "Sans-serif" | "Serif" | "Monospace" | "Display";
  note?: string;
};

type FontSizeOption = {
  label: string;
  value: number;
};

type FontDialogDraft = {
  fontFamily: string;
  fontStyle: FontStyleMode;
  fontSize: number;
  textColor: string;
  underlineStyle: UnderlineStyle;
  underlineColor: string;
  strike: boolean;
  doubleStrike: boolean;
  superscript: boolean;
  subscript: boolean;
  smallCaps: boolean;
  allCaps: boolean;
  hidden: boolean;
};

type FloatingMenuPosition = {
  top: number;
  left: number;
  minWidth: number;
};

// =====================================================
// 1. CONFIGURACAO VISUAL DO GRUPO
// =====================================================

const FONT_GROUP_LAYOUT = {
  /**
   * Ajustes centrais do layout visual do grupo Fonte.
   * Use este bloco para aproximar o grupo do desenho do Word sem procurar
   * medidas espalhadas no JSX.
   */
  minWidth: 438,
  containerPaddingX: 6,
  containerPaddingTop: 2,
  containerPaddingBottom: 16,

  rowCount: 2,
  rowHeights: [28, 30] as const,
  rowGap: 2,

  controlHeight: 26,
  familySelectWidth: 218,
  sizeSelectWidth: 64,
  selectFontSize: 12,
  selectBorderRadius: 3,

  iconButtonHeight: 29,
  iconButtonMinWidth: 29,
  iconButtonPaddingX: 3,
  iconButtonRadius: 3,
  iconSize: 19,
  smallIconSize: 13,

  colorButtonMinWidth: 37,
  colorUnderlineHeight: 3,
  colorUnderlineWidth: 16,

  commandGap: 2,
  menuViewportGap: 6,
  menuViewportPadding: 8,
  menuZIndex: 120000,
  dialogLauncherSize: 15,
  dialogLauncherBottom: 1,
  dialogLauncherRight: 1,
  dialogZIndexOffset: 20,
} as const;

const FONT_GROUP_COLORS = {
  selectorBorder: "#93c5fd",
  selectorBackground: "#dbeafe",
  selectorText: "#1e40af",
  hoverBackground: "#eff6ff",
  defaultText: "#27272a",
  disabledOpacity: 0.45,
  menuBorder: "#d4d4d8",
} as const;

const FONT_GROUP_MENU_LAYOUT = {
  colorMenuMaxHeight: "min(78vh,560px)",
  smallMenuMaxHeight: "min(70vh,420px)",
} as const;

const GOOGLE_FONTS_STYLE_ID = "knexwriter-free-academic-fonts";

const GOOGLE_FONT_FAMILIES = [
  "Arimo:wght@400;500;600;700",
  "Tinos:wght@400;700",
  "Inter:wght@400;500;600;700",
  "Roboto:wght@400;500;700",
  "Open Sans:wght@400;500;600;700",
  "Lato:wght@400;700",
  "Montserrat:wght@400;500;600;700",
  "Poppins:wght@400;500;600;700",
  "Merriweather:wght@400;700",
  "Lora:wght@400;500;600;700",
  "Noto Sans:wght@400;500;600;700",
  "Noto Serif:wght@400;500;600;700",
  "Source Sans 3:wght@400;500;600;700",
  "Source Serif 4:wght@400;500;600;700",
  "Fira Code:wght@400;500;600;700",
];

const FONT_OPTIONS: FontOption[] = [
  {
    label: "Arimo ≈ Arial",
    value: "Arimo",
    cssFamily: "Arimo, Arial, Helvetica, sans-serif",
    source: "academic-equivalent",
    category: "Sans-serif",
    note: "Arimo é uma fonte livre usada como alternativa visual à Arial. Não é a fonte Arial oficial.",
  },
  {
    label: "Tinos ≈ Times New Roman",
    value: "Tinos",
    cssFamily: 'Tinos, "Times New Roman", "Liberation Serif", Times, serif',
    source: "academic-equivalent",
    category: "Serif",
    note: "Tinos é uma fonte livre usada como alternativa visual à Times New Roman. Não é a fonte Times New Roman oficial.",
  },
  {
    label: "Arial (sistema)",
    value: "Arial",
    cssFamily: "Arial, Arimo, Helvetica, sans-serif",
    source: "system",
    category: "Sans-serif",
    note: "Usa Arial somente se ela estiver instalada no sistema do usuário.",
  },
  {
    label: "Times New Roman (sistema)",
    value: "Times New Roman",
    cssFamily: '"Times New Roman", Tinos, "Liberation Serif", Times, serif',
    source: "system",
    category: "Serif",
    note: "Usa Times New Roman somente se ela estiver instalada no sistema do usuário.",
  },
  {
    label: "Inter",
    value: "Inter",
    cssFamily: "Inter, Arial, sans-serif",
    source: "web-free",
    category: "Sans-serif",
  },
  {
    label: "Roboto",
    value: "Roboto",
    cssFamily: "Roboto, Arial, sans-serif",
    source: "web-free",
    category: "Sans-serif",
  },
  {
    label: "Open Sans",
    value: "Open Sans",
    cssFamily: '"Open Sans", Arial, sans-serif',
    source: "web-free",
    category: "Sans-serif",
  },
  {
    label: "Lato",
    value: "Lato",
    cssFamily: "Lato, Arial, sans-serif",
    source: "web-free",
    category: "Sans-serif",
  },
  {
    label: "Montserrat",
    value: "Montserrat",
    cssFamily: "Montserrat, Arial, sans-serif",
    source: "web-free",
    category: "Sans-serif",
  },
  {
    label: "Poppins",
    value: "Poppins",
    cssFamily: "Poppins, Arial, sans-serif",
    source: "web-free",
    category: "Sans-serif",
  },
  {
    label: "Noto Sans",
    value: "Noto Sans",
    cssFamily: '"Noto Sans", Arial, sans-serif',
    source: "web-free",
    category: "Sans-serif",
  },
  {
    label: "Source Sans 3",
    value: "Source Sans 3",
    cssFamily: '"Source Sans 3", Arial, sans-serif',
    source: "web-free",
    category: "Sans-serif",
  },
  {
    label: "Merriweather",
    value: "Merriweather",
    cssFamily: "Merriweather, Georgia, serif",
    source: "web-free",
    category: "Serif",
  },
  {
    label: "Lora",
    value: "Lora",
    cssFamily: "Lora, Georgia, serif",
    source: "web-free",
    category: "Serif",
  },
  {
    label: "Noto Serif",
    value: "Noto Serif",
    cssFamily: '"Noto Serif", Georgia, serif',
    source: "web-free",
    category: "Serif",
  },
  {
    label: "Source Serif 4",
    value: "Source Serif 4",
    cssFamily: '"Source Serif 4", Georgia, serif',
    source: "web-free",
    category: "Serif",
  },
  {
    label: "Fira Code",
    value: "Fira Code",
    cssFamily: '"Fira Code", Consolas, monospace',
    source: "web-free",
    category: "Monospace",
  },
  {
    label: "Georgia (sistema)",
    value: "Georgia",
    cssFamily: "Georgia, serif",
    source: "system",
    category: "Serif",
  },
  {
    label: "Verdana (sistema)",
    value: "Verdana",
    cssFamily: "Verdana, Geneva, sans-serif",
    source: "system",
    category: "Sans-serif",
  },
  {
    label: "Tahoma (sistema)",
    value: "Tahoma",
    cssFamily: "Tahoma, Geneva, sans-serif",
    source: "system",
    category: "Sans-serif",
  },
  {
    label: "Courier New (sistema)",
    value: "Courier New",
    cssFamily: '"Courier New", Courier, monospace',
    source: "system",
    category: "Monospace",
  },
  {
    label: "Consolas (sistema)",
    value: "Consolas",
    cssFamily: "Consolas, 'Courier New', monospace",
    source: "system",
    category: "Monospace",
  },
];

const FONT_SIZE_OPTIONS: FontSizeOption[] = [
  { label: "8", value: 8 },
  { label: "9", value: 9 },
  { label: "10", value: 10 },
  { label: "10,5", value: 10.5 },
  { label: "11", value: 11 },
  { label: "12", value: 12 },
  { label: "13", value: 13 },
  { label: "14", value: 14 },
  { label: "16", value: 16 },
  { label: "18", value: 18 },
  { label: "20", value: 20 },
  { label: "22", value: 22 },
  { label: "24", value: 24 },
  { label: "26", value: 26 },
  { label: "28", value: 28 },
  { label: "36", value: 36 },
  { label: "48", value: 48 },
  { label: "72", value: 72 },
];

const FONT_STYLE_OPTIONS: Array<{ label: string; value: FontStyleMode }> = [
  { label: "Regular", value: "regular" },
  { label: "Itálico", value: "italic" },
  { label: "Negrito", value: "bold" },
  { label: "Negrito Itálico", value: "boldItalic" },
];

const TEXT_COLORS = [
  { label: "Automático", value: "#000000" },
  { label: "Preto", value: "#000000" },
  { label: "Cinza", value: "#444444" },
  { label: "Vermelho", value: "#dc2626" },
  { label: "Laranja", value: "#ea580c" },
  { label: "Amarelo", value: "#ca8a04" },
  { label: "Verde", value: "#16a34a" },
  { label: "Azul", value: "#2563eb" },
  { label: "Roxo", value: "#7c3aed" },
];

const HIGHLIGHT_COLORS = [
  { label: "Sem realce", value: "transparent" },
  { label: "Amarelo", value: "#ffff00" },
  { label: "Verde", value: "#00ff00" },
  { label: "Ciano", value: "#00ffff" },
  { label: "Magenta", value: "#ff00ff" },
  { label: "Vermelho claro", value: "#ff9999" },
  { label: "Laranja claro", value: "#ffd966" },
  { label: "Azul claro", value: "#cfe2f3" },
  { label: "Verde claro", value: "#d9ead3" },
];

const UNDERLINE_STYLE_OPTIONS: Array<{ label: string; value: UnderlineStyle }> = [
  { label: "(nenhum)", value: "none" },
  { label: "Simples", value: "single" },
  { label: "Duplo", value: "double" },
  { label: "Pontilhado", value: "dotted" },
  { label: "Tracejado", value: "dashed" },
];

const CHANGE_CASE_OPTIONS: Array<{ label: string; value: ChangeCaseMode }> = [
  { label: "Tipo frase", value: "sentence" },
  { label: "minúsculas", value: "lowercase" },
  { label: "MAIÚSCULAS", value: "uppercase" },
  { label: "Colocar Cada Palavra Em Maiúscula", value: "capitalize" },
  { label: "aLTERNAR mAIÚSC./mINÚSC.", value: "toggle" },
];

const THEME_COLOR_ROWS = [
  ["#FFFFFF", "#000000", "#EEECE1", "#1F497D", "#4F81BD", "#C0504D", "#9BBB59", "#8064A2", "#4BACC6", "#F79646"],
  ["#F2F2F2", "#7F7F7F", "#DDD9C3", "#C6D9F0", "#DCE6F1", "#F2DCDB", "#EBF1DD", "#E5E0EC", "#DBEEF3", "#FDEADA"],
  ["#D9D9D9", "#595959", "#C4BD97", "#95B3D7", "#B8CCE4", "#E5B9B7", "#D7E3BC", "#CCC1D9", "#B7DEE8", "#FBD5B5"],
  ["#BFBFBF", "#3F3F3F", "#938953", "#366092", "#95B3D7", "#D99694", "#C3D69B", "#B2A2C7", "#93CDDD", "#FAC08F"],
  ["#A5A5A5", "#262626", "#494429", "#244061", "#366092", "#953734", "#76923C", "#604A7B", "#31859B", "#E46C0A"],
  ["#7F7F7F", "#0F0F0F", "#1D1B10", "#17375E", "#1F497D", "#632423", "#4F6228", "#403152", "#205867", "#9A4800"],
];

const STANDARD_COLORS = [
  "#C00000",
  "#FF0000",
  "#FFC000",
  "#FFFF00",
  "#92D050",
  "#00B050",
  "#00B0F0",
  "#0070C0",
  "#002060",
  "#7030A0",
];

function createGoogleFontsHref() {
  const familyQuery = GOOGLE_FONT_FAMILIES.map(
    (family) => `family=${encodeURIComponent(family).replace(/%20/g, "+")}`,
  ).join("&");

  return `https://fonts.googleapis.com/css2?${familyQuery}&display=swap`;
}

function ensureAcademicFreeFontsLoaded() {
  if (typeof document === "undefined") {
    return;
  }

  if (document.getElementById(GOOGLE_FONTS_STYLE_ID)) {
    return;
  }

  const preconnectGoogle = document.createElement("link");
  preconnectGoogle.rel = "preconnect";
  preconnectGoogle.href = "https://fonts.googleapis.com";
  document.head.appendChild(preconnectGoogle);

  const preconnectGstatic = document.createElement("link");
  preconnectGstatic.rel = "preconnect";
  preconnectGstatic.href = "https://fonts.gstatic.com";
  preconnectGstatic.crossOrigin = "anonymous";
  document.head.appendChild(preconnectGstatic);

  const link = document.createElement("link");
  link.id = GOOGLE_FONTS_STYLE_ID;
  link.rel = "stylesheet";
  link.href = createGoogleFontsHref();
  document.head.appendChild(link);
}

function getFontOption(value: string) {
  const direct = FONT_OPTIONS.find((font) => font.value === value);

  if (direct) {
    return direct;
  }

  const byLabel = FONT_OPTIONS.find(
    (font) => font.label.toLowerCase() === value.toLowerCase(),
  );

  if (byLabel) {
    return byLabel;
  }

  const normalized = value.toLowerCase();

  if (normalized.includes("arial")) {
    return FONT_OPTIONS.find((font) => font.value === "Arimo") || FONT_OPTIONS[0];
  }

  if (normalized.includes("times")) {
    return FONT_OPTIONS.find((font) => font.value === "Tinos") || FONT_OPTIONS[0];
  }

  return FONT_OPTIONS[0];
}

function normalizeFontSize(value: string | number | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace("pt", "").replace("px", "").replace(",", ".").trim();
    const parsed = Number(normalized);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 12;
}

function getFontSizeLabel(value: number) {
  const option = FONT_SIZE_OPTIONS.find((item) => item.value === value);

  if (option) {
    return option.label;
  }

  return String(value).replace(".", ",");
}

function getInitialFontStyle({
  isBoldActive,
  isItalicActive,
}: {
  isBoldActive: boolean;
  isItalicActive: boolean;
}): FontStyleMode {
  if (isBoldActive && isItalicActive) {
    return "boldItalic";
  }

  if (isBoldActive) {
    return "bold";
  }

  if (isItalicActive) {
    return "italic";
  }

  return "regular";
}

function getFontStyleFlags(fontStyle: FontStyleMode) {
  return {
    bold: fontStyle === "bold" || fontStyle === "boldItalic",
    italic: fontStyle === "italic" || fontStyle === "boldItalic",
  };
}

function warnFontCommand(command: string, error?: unknown) {
  if (typeof console === "undefined") {
    return;
  }

  if (error) {
    console.warn(`[KnexWriter] Falha ao executar comando de fonte: ${command}`, error);
    return;
  }

  console.warn(`[KnexWriter] Comando de fonte ainda não disponível: ${command}`);
}

function tryExternalFontCommand<K extends keyof WriterFontCommands>(
  fallbackCommands: Partial<WriterFontCommands> | undefined,
  commandName: K,
  ...args: Parameters<WriterFontCommands[K]>
) {
  const command = fallbackCommands?.[commandName] as
    | ((...innerArgs: Parameters<WriterFontCommands[K]>) => void)
    | undefined;

  if (typeof command !== "function") {
    return false;
  }

  command(...args);
  return true;
}

function runFontChain(
  editor: WriterFontEditor | null | undefined,
  commandName: string,
  runner: (chain: any) => boolean,
) {
  try {
    const chain = editor?.chain?.();

    if (!chain) {
      return false;
    }

    const focusedChain = typeof chain.focus === "function" ? chain.focus() : chain;
    return runner(focusedChain);
  } catch (error) {
    warnFontCommand(commandName, error);
    return false;
  }
}

function runFontAction(
  actions: WriterFontActions | undefined,
  command: string,
  value?: string,
) {
  try {
    if (typeof actions?.applyWritingCommand !== "function") {
      return false;
    }

    actions.applyWritingCommand(command, value);
    return true;
  } catch (error) {
    warnFontCommand(command, error);
    return false;
  }
}

function createFontGroupCommands({
  editor,
  actions,
  fallbackCommands,
}: {
  editor?: WriterFontEditor | null;
  actions?: WriterFontActions;
  fallbackCommands?: Partial<WriterFontCommands>;
}): WriterFontCommands {
  return {
    setFontFamily: (fontFamily) => {
      if (tryExternalFontCommand(fallbackCommands, "setFontFamily", fontFamily)) return;

      const didRun = runFontChain(editor, "setFontFamily", (chain) => {
        if (typeof chain.setFontFamily === "function") {
          chain.setFontFamily(fontFamily).run?.();
          return true;
        }

        if (typeof chain.setMark === "function") {
          chain.setMark("textStyle", { fontFamily }).run?.();
          return true;
        }

        return false;
      });

      if (!didRun && !runFontAction(actions, "fontName", String(fontFamily))) {
        warnFontCommand("setFontFamily");
      }
    },

    setFontSize: (fontSize) => {
      const value = typeof fontSize === "number" ? `${fontSize}pt` : String(fontSize);

      if (tryExternalFontCommand(fallbackCommands, "setFontSize", value)) return;

      const didRun = runFontChain(editor, "setFontSize", (chain) => {
        if (typeof chain.setFontSize === "function") {
          chain.setFontSize(value).run?.();
          return true;
        }

        if (typeof chain.setMark === "function") {
          chain.setMark("textStyle", { fontSize: value }).run?.();
          return true;
        }

        return false;
      });

      if (!didRun && !runFontAction(actions, "fontSize", value)) {
        warnFontCommand("setFontSize");
      }
    },

    increaseFontSize: () => {
      if (tryExternalFontCommand(fallbackCommands, "increaseFontSize")) return;

      const didRun = runFontChain(editor, "increaseFontSize", (chain) => {
        if (typeof chain.increaseFontSize === "function") {
          chain.increaseFontSize().run?.();
          return true;
        }

        return false;
      });

      if (!didRun) {
        runFontAction(actions, "increaseFontSize");
      }
    },

    decreaseFontSize: () => {
      if (tryExternalFontCommand(fallbackCommands, "decreaseFontSize")) return;

      const didRun = runFontChain(editor, "decreaseFontSize", (chain) => {
        if (typeof chain.decreaseFontSize === "function") {
          chain.decreaseFontSize().run?.();
          return true;
        }

        return false;
      });

      if (!didRun) {
        runFontAction(actions, "decreaseFontSize");
      }
    },

    toggleBold: () => {
      if (tryExternalFontCommand(fallbackCommands, "toggleBold")) return;

      const didRun = runFontChain(editor, "toggleBold", (chain) => {
        if (typeof chain.toggleBold === "function") {
          chain.toggleBold().run?.();
          return true;
        }

        return false;
      });

      if (!didRun) runFontAction(actions, "bold");
    },

    toggleItalic: () => {
      if (tryExternalFontCommand(fallbackCommands, "toggleItalic")) return;

      const didRun = runFontChain(editor, "toggleItalic", (chain) => {
        if (typeof chain.toggleItalic === "function") {
          chain.toggleItalic().run?.();
          return true;
        }

        return false;
      });

      if (!didRun) runFontAction(actions, "italic");
    },

    toggleUnderline: () => {
      if (tryExternalFontCommand(fallbackCommands, "toggleUnderline")) return;

      const didRun = runFontChain(editor, "toggleUnderline", (chain) => {
        if (typeof chain.toggleUnderline === "function") {
          chain.toggleUnderline().run?.();
          return true;
        }

        return false;
      });

      if (!didRun) runFontAction(actions, "underline");
    },

    toggleStrike: () => {
      if (tryExternalFontCommand(fallbackCommands, "toggleStrike")) return;

      const didRun = runFontChain(editor, "toggleStrike", (chain) => {
        if (typeof chain.toggleStrike === "function") {
          chain.toggleStrike().run?.();
          return true;
        }

        return false;
      });

      if (!didRun) runFontAction(actions, "strikeThrough");
    },

    toggleSubscript: () => {
      if (tryExternalFontCommand(fallbackCommands, "toggleSubscript")) return;

      const didRun = runFontChain(editor, "toggleSubscript", (chain) => {
        if (typeof chain.toggleSubscript === "function") {
          chain.toggleSubscript().run?.();
          return true;
        }

        return false;
      });

      if (!didRun) runFontAction(actions, "subscript");
    },

    toggleSuperscript: () => {
      if (tryExternalFontCommand(fallbackCommands, "toggleSuperscript")) return;

      const didRun = runFontChain(editor, "toggleSuperscript", (chain) => {
        if (typeof chain.toggleSuperscript === "function") {
          chain.toggleSuperscript().run?.();
          return true;
        }

        return false;
      });

      if (!didRun) runFontAction(actions, "superscript");
    },

    setTextColor: (color) => {
      if (tryExternalFontCommand(fallbackCommands, "setTextColor", color)) return;

      const didRun = runFontChain(editor, "setTextColor", (chain) => {
        if (typeof chain.setColor === "function") {
          chain.setColor(color).run?.();
          return true;
        }

        if (typeof chain.setTextColor === "function") {
          chain.setTextColor(color).run?.();
          return true;
        }

        if (typeof chain.setMark === "function") {
          chain.setMark("textStyle", { color }).run?.();
          return true;
        }

        return false;
      });

      if (!didRun && !runFontAction(actions, "foreColor", color)) {
        warnFontCommand("setTextColor");
      }
    },

    setHighlightColor: (color) => {
      if (tryExternalFontCommand(fallbackCommands, "setHighlightColor", color)) return;

      const didRun = runFontChain(editor, "setHighlightColor", (chain) => {
        if (color === "transparent" && typeof chain.unsetHighlight === "function") {
          chain.unsetHighlight().run?.();
          return true;
        }

        if (typeof chain.setHighlight === "function") {
          try {
            chain.setHighlight({ color }).run?.();
          } catch {
            chain.setHighlight(color).run?.();
          }
          return true;
        }

        if (typeof chain.setMark === "function") {
          chain.setMark("highlight", { color }).run?.();
          return true;
        }

        return false;
      });

      if (!didRun && !runFontAction(actions, "hiliteColor", color)) {
        warnFontCommand("setHighlightColor");
      }
    },

    clearFormatting: () => {
      if (tryExternalFontCommand(fallbackCommands, "clearFormatting")) return;

      const didRun = runFontChain(editor, "clearFormatting", (chain) => {
        if (typeof chain.unsetAllMarks === "function" && typeof chain.clearNodes === "function") {
          chain.unsetAllMarks().clearNodes().run?.();
          return true;
        }

        if (typeof chain.unsetAllMarks === "function") {
          chain.unsetAllMarks().run?.();
          return true;
        }

        return false;
      });

      if (!didRun) runFontAction(actions, "removeFormat");
    },

    changeCase: (mode) => {
      if (tryExternalFontCommand(fallbackCommands, "changeCase", mode)) return;

      if (!runFontAction(actions, "changeCase", mode)) {
        warnFontCommand("changeCase");
      }
    },
  };
}

export function FontGroup({
  editor,
  actions,
  commands,
  disabled = false,
  currentFontFamily = "Arimo",
  currentFontSize = 12,
  currentTextColor = "#000000",
  currentHighlightColor = "#ffff00",
  isBoldActive = false,
  isItalicActive = false,
  isUnderlineActive = false,
  isStrikeActive = false,
  isSubscriptActive = false,
  isSuperscriptActive = false,
}: FontGroupProps = {}) {
  const [fontFamily, setFontFamily] = useState(getFontOption(currentFontFamily).value);
  const [fontSize, setFontSize] = useState(normalizeFontSize(currentFontSize));
  const [textColor, setTextColor] = useState(currentTextColor);
  const [highlightColor, setHighlightColor] = useState(currentHighlightColor);
  const [underlineStyle, setUnderlineStyle] = useState<UnderlineStyle>(
    isUnderlineActive ? "single" : "none",
  );

  const [activeState, setActiveState] = useState({
    bold: isBoldActive,
    italic: isItalicActive,
    underline: isUnderlineActive,
    strike: isStrikeActive,
    subscript: isSubscriptActive,
    superscript: isSuperscriptActive,
  });

  const [isFontDialogOpen, setIsFontDialogOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const resolveWriterStageCenter = useCallback(() => {
    if (typeof window === "undefined") {
      return { left: 0, top: 0 };
    }

    const editorSurface = document.querySelector<HTMLElement>(".knexwriter-editor");

    if (editorSurface) {
      const rect = editorSurface.getBoundingClientRect();
      const visibleLeft = Math.max(0, rect.left);
      const visibleRight = Math.min(window.innerWidth, rect.right);
      const visibleTop = Math.max(0, rect.top);
      const visibleBottom = Math.min(window.innerHeight, rect.bottom);

      const visibleWidth = Math.max(1, visibleRight - visibleLeft);
      const visibleHeight = Math.max(1, visibleBottom - visibleTop);

      return {
        left: visibleLeft + visibleWidth / 2,
        top: visibleTop + visibleHeight / 2,
      };
    }

    return {
      left: window.innerWidth / 2,
      top: window.innerHeight / 2,
    };
  }, []);

  useEffect(() => {
    ensureAcademicFreeFontsLoaded();
  }, []);

  useEffect(() => {
    setFontFamily(getFontOption(currentFontFamily).value);
  }, [currentFontFamily]);

  useEffect(() => {
    setFontSize(normalizeFontSize(currentFontSize));
  }, [currentFontSize]);

  useEffect(() => {
    setTextColor(currentTextColor);
  }, [currentTextColor]);

  useEffect(() => {
    setHighlightColor(currentHighlightColor);
  }, [currentHighlightColor]);

  useEffect(() => {
    setActiveState({
      bold: isBoldActive,
      italic: isItalicActive,
      underline: isUnderlineActive,
      strike: isStrikeActive,
      subscript: isSubscriptActive,
      superscript: isSuperscriptActive,
    });
    setUnderlineStyle(isUnderlineActive ? "single" : "none");
  }, [
    isBoldActive,
    isItalicActive,
    isStrikeActive,
    isSubscriptActive,
    isSuperscriptActive,
    isUnderlineActive,
  ]);

  useEffect(() => {
    if (!isFontDialogOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFontDialogOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFontDialogOpen]);

  const selectedFont = getFontOption(fontFamily);

  const resolvedCommands = createFontGroupCommands({
    editor,
    actions,
    fallbackCommands: commands,
  });

  const handleFontFamilyChange = (nextFontFamily: string) => {
    const nextFont = getFontOption(nextFontFamily);

    setFontFamily(nextFont.value);
    resolvedCommands.setFontFamily?.(nextFont.cssFamily);
  };

  const handleFontSizeChange = (nextFontSize: number) => {
    setFontSize(nextFontSize);
    resolvedCommands.setFontSize?.(`${nextFontSize}pt`);
  };

  const handleIncreaseFontSize = () => {
    const currentIndex = FONT_SIZE_OPTIONS.findIndex((item) => item.value === fontSize);
    const nextSize =
      currentIndex >= 0 && currentIndex < FONT_SIZE_OPTIONS.length - 1
        ? FONT_SIZE_OPTIONS[currentIndex + 1].value
        : fontSize + 1;

    setFontSize(nextSize);
    resolvedCommands.increaseFontSize?.();
    resolvedCommands.setFontSize?.(`${nextSize}pt`);
  };

  const handleDecreaseFontSize = () => {
    const currentIndex = FONT_SIZE_OPTIONS.findIndex((item) => item.value === fontSize);
    const nextSize =
      currentIndex > 0 ? FONT_SIZE_OPTIONS[currentIndex - 1].value : Math.max(1, fontSize - 1);

    setFontSize(nextSize);
    resolvedCommands.decreaseFontSize?.();
    resolvedCommands.setFontSize?.(`${nextSize}pt`);
  };

  const toggleLocalActiveState = (key: keyof typeof activeState) => {
    setActiveState((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const handleTextColorChange = (color: string) => {
    setTextColor(color);
    resolvedCommands.setTextColor?.(color);
  };

  const handleHighlightColorChange = (color: string) => {
    setHighlightColor(color);
    resolvedCommands.setHighlightColor?.(color);
  };

  const handleClearFormatting = () => {
    setActiveState({
      bold: false,
      italic: false,
      underline: false,
      strike: false,
      subscript: false,
      superscript: false,
    });
    setUnderlineStyle("none");
    resolvedCommands.clearFormatting?.();
  };

  const handleApplyFontDialog = (draft: FontDialogDraft) => {
    const nextFont = getFontOption(draft.fontFamily);
    const styleFlags = getFontStyleFlags(draft.fontStyle);
    const nextUnderlineActive = draft.underlineStyle !== "none";
    const nextStrikeActive = draft.strike || draft.doubleStrike;

    setFontFamily(nextFont.value);
    setFontSize(draft.fontSize);
    setTextColor(draft.textColor);
    setUnderlineStyle(draft.underlineStyle);

    resolvedCommands.setFontFamily?.(nextFont.cssFamily);
    resolvedCommands.setFontSize?.(`${draft.fontSize}pt`);
    resolvedCommands.setTextColor?.(draft.textColor);

    if (styleFlags.bold !== activeState.bold) {
      resolvedCommands.toggleBold?.();
    }

    if (styleFlags.italic !== activeState.italic) {
      resolvedCommands.toggleItalic?.();
    }

    if (nextUnderlineActive !== activeState.underline) {
      resolvedCommands.toggleUnderline?.();
    }

    if (nextStrikeActive !== activeState.strike) {
      resolvedCommands.toggleStrike?.();
    }

    if (draft.subscript !== activeState.subscript) {
      resolvedCommands.toggleSubscript?.();
    }

    if (draft.superscript !== activeState.superscript) {
      resolvedCommands.toggleSuperscript?.();
    }

    setActiveState({
      bold: styleFlags.bold,
      italic: styleFlags.italic,
      underline: nextUnderlineActive,
      strike: nextStrikeActive,
      subscript: draft.subscript,
      superscript: draft.superscript,
    });

    setIsFontDialogOpen(false);
  };

  return (
    <WriterRibbonGroup title="Fonte">
      <div
        className="relative grid"
        style={{
          minWidth: FONT_GROUP_LAYOUT.minWidth,
          gridTemplateRows: FONT_GROUP_LAYOUT.rowHeights
            .map((value) => `${value}px`)
            .join(" "),
          gap: FONT_GROUP_LAYOUT.rowGap,
          paddingTop: FONT_GROUP_LAYOUT.containerPaddingTop,
          paddingLeft: FONT_GROUP_LAYOUT.containerPaddingX,
          paddingRight: FONT_GROUP_LAYOUT.containerPaddingX,
          paddingBottom: FONT_GROUP_LAYOUT.containerPaddingBottom,
        }}
      >
        <div
          className="flex items-center"
          style={{ gap: FONT_GROUP_LAYOUT.commandGap }}
        >
          <select
            value={fontFamily}
            disabled={disabled}
            title={selectedFont.note || "Fonte"}
            aria-label="Fonte"
            className="border border-zinc-300 bg-white px-1 text-zinc-900 outline-none hover:border-zinc-400 focus:border-blue-500"
            style={{
              height: FONT_GROUP_LAYOUT.controlHeight,
              width: FONT_GROUP_LAYOUT.familySelectWidth,
              borderRadius: FONT_GROUP_LAYOUT.selectBorderRadius,
              fontSize: FONT_GROUP_LAYOUT.selectFontSize,
              fontFamily: selectedFont.cssFamily,
            }}
            onChange={(event) => handleFontFamilyChange(event.target.value)}
          >
            <optgroup label="Equivalentes livres">
              {FONT_OPTIONS.filter((font) => font.source === "academic-equivalent").map((font) => (
                <option
                  key={font.value}
                  value={font.value}
                  style={{ fontFamily: font.cssFamily }}
                  title={font.note}
                >
                  {font.label}
                </option>
              ))}
            </optgroup>

            <optgroup label="Fontes livres">
              {FONT_OPTIONS.filter((font) => font.source === "web-free").map((font) => (
                <option
                  key={font.value}
                  value={font.value}
                  style={{ fontFamily: font.cssFamily }}
                >
                  {font.label}
                </option>
              ))}
            </optgroup>

            <optgroup label="Fontes do sistema">
              {FONT_OPTIONS.filter((font) => font.source === "system").map((font) => (
                <option
                  key={font.value}
                  value={font.value}
                  style={{ fontFamily: font.cssFamily }}
                  title={font.note}
                >
                  {font.label}
                </option>
              ))}
            </optgroup>
          </select>

          <select
            value={fontSize}
            disabled={disabled}
            title="Tamanho da fonte"
            aria-label="Tamanho da fonte"
            className="border border-zinc-300 bg-white px-1 text-zinc-900 outline-none hover:border-zinc-400 focus:border-blue-500"
            style={{
              height: FONT_GROUP_LAYOUT.controlHeight,
              width: FONT_GROUP_LAYOUT.sizeSelectWidth,
              borderRadius: FONT_GROUP_LAYOUT.selectBorderRadius,
              fontSize: FONT_GROUP_LAYOUT.selectFontSize,
            }}
            onChange={(event) => handleFontSizeChange(Number(event.target.value))}
          >
            {FONT_SIZE_OPTIONS.map((size) => (
              <option key={size.value} value={size.value}>
                {size.label}
              </option>
            ))}
          </select>
        </div>

        <div
          className="flex items-center"
          style={{ gap: FONT_GROUP_LAYOUT.commandGap }}
        >
          <RibbonFontIconButton
            label="Aumentar fonte"
            disabled={disabled}
            onClick={handleIncreaseFontSize}
          >
            <span className="relative text-[16px] leading-none">
              A
              <Plus className="absolute -right-2 -top-1" style={{ width: FONT_GROUP_LAYOUT.smallIconSize, height: FONT_GROUP_LAYOUT.smallIconSize }} />
            </span>
          </RibbonFontIconButton>

          <RibbonFontIconButton
            label="Diminuir fonte"
            disabled={disabled}
            onClick={handleDecreaseFontSize}
          >
            <span className="relative text-[16px] leading-none">
              A
              <Minus className="absolute -right-2 -top-1" style={{ width: FONT_GROUP_LAYOUT.smallIconSize, height: FONT_GROUP_LAYOUT.smallIconSize }} />
            </span>
          </RibbonFontIconButton>

          <ChangeCaseDropdown
            disabled={disabled}
            onChange={(mode) => resolvedCommands.changeCase?.(mode)}
          />

          <RibbonFontIconButton
            label="Limpar toda a formatação"
            disabled={disabled}
            onClick={handleClearFormatting}
          >
            <Eraser style={{ width: FONT_GROUP_LAYOUT.iconSize, height: FONT_GROUP_LAYOUT.iconSize }} />
          </RibbonFontIconButton>

          <RibbonFontIconButton
            label="Negrito"
            shortcut="Ctrl+B"
            active={activeState.bold}
            disabled={disabled}
            onClick={() => {
              toggleLocalActiveState("bold");
              resolvedCommands.toggleBold?.();
            }}
          >
            <Bold style={{ width: FONT_GROUP_LAYOUT.iconSize, height: FONT_GROUP_LAYOUT.iconSize }} />
          </RibbonFontIconButton>

          <RibbonFontIconButton
            label="Itálico"
            shortcut="Ctrl+I"
            active={activeState.italic}
            disabled={disabled}
            onClick={() => {
              toggleLocalActiveState("italic");
              resolvedCommands.toggleItalic?.();
            }}
          >
            <Italic style={{ width: FONT_GROUP_LAYOUT.iconSize, height: FONT_GROUP_LAYOUT.iconSize }} />
          </RibbonFontIconButton>

          <RibbonFontIconButton
            label="Sublinhado"
            shortcut="Ctrl+U"
            active={activeState.underline}
            disabled={disabled}
            onClick={() => {
              toggleLocalActiveState("underline");
              setUnderlineStyle((current) => (current === "none" ? "single" : "none"));
              resolvedCommands.toggleUnderline?.();
            }}
          >
            <span className="flex items-center gap-[1px]">
              <Underline style={{ width: FONT_GROUP_LAYOUT.iconSize, height: FONT_GROUP_LAYOUT.iconSize }} />
              <ChevronDown style={{ width: FONT_GROUP_LAYOUT.smallIconSize, height: FONT_GROUP_LAYOUT.smallIconSize }} />
            </span>
          </RibbonFontIconButton>

          <RibbonFontIconButton
            label="Tachado"
            active={activeState.strike}
            disabled={disabled}
            onClick={() => {
              toggleLocalActiveState("strike");
              resolvedCommands.toggleStrike?.();
            }}
          >
            <Strikethrough style={{ width: FONT_GROUP_LAYOUT.iconSize, height: FONT_GROUP_LAYOUT.iconSize }} />
          </RibbonFontIconButton>

          <RibbonFontIconButton
            label="Subscrito"
            active={activeState.subscript}
            disabled={disabled}
            onClick={() => {
              toggleLocalActiveState("subscript");
              resolvedCommands.toggleSubscript?.();
            }}
          >
            <Subscript style={{ width: FONT_GROUP_LAYOUT.iconSize, height: FONT_GROUP_LAYOUT.iconSize }} />
          </RibbonFontIconButton>

          <RibbonFontIconButton
            label="Sobrescrito"
            active={activeState.superscript}
            disabled={disabled}
            onClick={() => {
              toggleLocalActiveState("superscript");
              resolvedCommands.toggleSuperscript?.();
            }}
          >
            <Superscript style={{ width: FONT_GROUP_LAYOUT.iconSize, height: FONT_GROUP_LAYOUT.iconSize }} />
          </RibbonFontIconButton>

          <RibbonFontIconButton
            label="Efeitos de texto e tipografia"
            disabled={disabled}
            onClick={() => setIsFontDialogOpen(true)}
          >
            <span className="text-[17px] font-semibold leading-none text-blue-600">
              A
            </span>
          </RibbonFontIconButton>

          <ColorDropdown
            label="Cor de realce do texto"
            value={highlightColor}
            disabled={disabled}
            colors={HIGHLIGHT_COLORS}
            icon={<span className="text-[14px] font-semibold leading-none">ab</span>}
            underlineColor={highlightColor}
            onChange={handleHighlightColorChange}
          />

          <ColorDropdown
            label="Cor da fonte"
            value={textColor}
            disabled={disabled}
            colors={TEXT_COLORS}
            icon={<Type style={{ width: FONT_GROUP_LAYOUT.iconSize, height: FONT_GROUP_LAYOUT.iconSize }} />}
            underlineColor={textColor}
            onChange={handleTextColorChange}
          />
        </div>

        <button
          type="button"
          aria-label="Abrir configurações avançadas de fonte"
          title="Abrir configurações avançadas de fonte"
          className="absolute flex items-center justify-center rounded-sm text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900"
          style={{
            right: FONT_GROUP_LAYOUT.dialogLauncherRight,
            bottom: FONT_GROUP_LAYOUT.dialogLauncherBottom,
            width: FONT_GROUP_LAYOUT.dialogLauncherSize,
            height: FONT_GROUP_LAYOUT.dialogLauncherSize,
          }}
          onClick={(event) => {
            event.stopPropagation();
            setIsFontDialogOpen(true);
          }}
        >
          <span className="text-[11px] leading-none">↘</span>
        </button>

        {isFontDialogOpen ? (
          <FontDialogPopover
            dialogRef={dialogRef}
            fontFamily={fontFamily}
            fontSize={fontSize}
            fontStyle={getInitialFontStyle({
              isBoldActive: activeState.bold,
              isItalicActive: activeState.italic,
            })}
            textColor={textColor}
            underlineStyle={underlineStyle}
            underlineColor={textColor}
            activeState={activeState}
            disabled={disabled}
            resolveCenter={resolveWriterStageCenter}
            onApply={handleApplyFontDialog}
            onCancel={() => setIsFontDialogOpen(false)}
          />
        ) : null}
      </div>
    </WriterRibbonGroup>
  );
}

function RibbonFontIconButton({
  label,
  shortcut,
  active = false,
  disabled = false,
  style,
  children,
  onClick,
}: {
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  style?: CSSProperties;
  children: ReactNode;
  onClick: () => void;
}) {
  const title = shortcut ? `${label} (${shortcut})` : label;

  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      disabled={disabled}
      onMouseDown={(event: ReactMouseEvent<HTMLButtonElement>) =>
        event.preventDefault()
      }
      onClick={onClick}
      className={[
        "flex items-center justify-center border text-[12px] transition-colors",
        active
          ? "border-blue-300 bg-blue-100 text-blue-800"
          : "border-transparent bg-transparent text-zinc-800 hover:border-zinc-300 hover:bg-white",
        disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer",
      ].join(" ")}
      style={{
        height: FONT_GROUP_LAYOUT.iconButtonHeight,
        minWidth: FONT_GROUP_LAYOUT.iconButtonMinWidth,
        paddingLeft: FONT_GROUP_LAYOUT.iconButtonPaddingX,
        paddingRight: FONT_GROUP_LAYOUT.iconButtonPaddingX,
        borderRadius: FONT_GROUP_LAYOUT.iconButtonRadius,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function ColorDropdown({
  label,
  value,
  colors,
  icon,
  underlineColor,
  disabled = false,
  onChange,
}: {
  label: string;
  value: string;
  colors: Array<{ label: string; value: string }>;
  icon: ReactNode;
  underlineColor: string;
  disabled?: boolean;
  onChange: (color: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<FloatingMenuPosition>({
    top: 0,
    left: 0,
    minWidth: 280,
  });

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const colorMenuWidthPx = 280;

  const updateMenuPosition = useCallback(() => {
    const buttonRect = buttonRef.current?.getBoundingClientRect();

    if (!buttonRect || typeof window === "undefined") {
      return;
    }

    const gapPx = FONT_GROUP_LAYOUT.menuViewportGap;
    const safePaddingPx = FONT_GROUP_LAYOUT.menuViewportPadding;
    const viewportWidth = window.innerWidth;

    const maxLeft = Math.max(
      safePaddingPx,
      viewportWidth - colorMenuWidthPx - safePaddingPx,
    );

    setMenuPosition({
      top: buttonRect.bottom + gapPx,
      left: Math.min(Math.max(safePaddingPx, buttonRect.left), maxLeft),
      minWidth: colorMenuWidthPx,
    });
  }, []);

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

  const automaticColor = colors[0]?.value ?? "#000000";

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        title={label}
        disabled={disabled}
        className={[
          "flex items-center justify-center gap-0.5 border border-transparent bg-transparent hover:border-zinc-300 hover:bg-white",
          disabled ? "cursor-not-allowed" : "cursor-pointer",
        ].join(" ")}
        style={{
          height: FONT_GROUP_LAYOUT.iconButtonHeight,
          minWidth: FONT_GROUP_LAYOUT.colorButtonMinWidth,
          paddingLeft: FONT_GROUP_LAYOUT.iconButtonPaddingX,
          paddingRight: FONT_GROUP_LAYOUT.iconButtonPaddingX,
          borderRadius: FONT_GROUP_LAYOUT.iconButtonRadius,
          color: FONT_GROUP_COLORS.defaultText,
          opacity: disabled ? FONT_GROUP_COLORS.disabledOpacity : 1,
        }}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          updateMenuPosition();
          setIsOpen((current) => !current);
        }}
      >
        <span className="relative flex h-5 w-5 items-center justify-center">
          {icon}
          <span
            className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-sm border border-black/10"
            style={{
              backgroundColor: underlineColor === "transparent" ? "#ffffff" : underlineColor,
              height: FONT_GROUP_LAYOUT.colorUnderlineHeight,
              width: FONT_GROUP_LAYOUT.colorUnderlineWidth,
            }}
          />
        </span>
        <ChevronDown style={{ width: FONT_GROUP_LAYOUT.smallIconSize, height: FONT_GROUP_LAYOUT.smallIconSize }} />
      </button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed overflow-auto rounded-sm border border-zinc-400 bg-[#efefef] shadow-2xl"
              style={{
                left: menuPosition.left,
                top: menuPosition.top,
                width: menuPosition.minWidth,
                maxHeight: FONT_GROUP_MENU_LAYOUT.colorMenuMaxHeight,
                zIndex: FONT_GROUP_LAYOUT.menuZIndex,
              }}
            >
              <button
                type="button"
                className="flex w-full items-center gap-2 border-b border-zinc-300 bg-[#dddddd] px-3 py-2 text-left text-[13px] text-zinc-900 hover:bg-[#d2d2d2]"
                onClick={() => {
                  onChange(automaticColor);
                  setIsOpen(false);
                }}
              >
                <span className="inline-block h-4 w-4 border border-zinc-500 bg-black" />
                <span className="underline underline-offset-2">Automático</span>
              </button>

              <div className="px-3 pb-2 pt-2">
                <div className="mb-2 text-[12px] font-semibold text-zinc-800">
                  Cores do Tema
                </div>

                <div className="grid grid-cols-10 gap-1">
                  {THEME_COLOR_ROWS[0].map((color, index) => (
                    <ColorSwatch
                      key={`theme-top-${color}-${index}`}
                      color={color}
                      selectedColor={value}
                      label={`Cor do tema ${index + 1}`}
                      onSelect={(nextColor) => {
                        onChange(nextColor);
                        setIsOpen(false);
                      }}
                    />
                  ))}
                </div>

                <div className="mt-1 grid grid-cols-10 gap-1">
                  {THEME_COLOR_ROWS.slice(1).flatMap((row, rowIndex) =>
                    row.map((color, colIndex) => (
                      <ColorSwatch
                        key={`theme-tone-${rowIndex}-${colIndex}-${color}`}
                        color={color}
                        selectedColor={value}
                        label={`Tom ${rowIndex + 1}-${colIndex + 1}`}
                        onSelect={(nextColor) => {
                          onChange(nextColor);
                          setIsOpen(false);
                        }}
                      />
                    )),
                  )}
                </div>
              </div>

              <div className="border-t border-zinc-300 px-3 pb-2 pt-2">
                <div className="mb-2 text-[12px] font-semibold text-zinc-800">
                  Cores Padrão
                </div>

                <div className="grid grid-cols-10 gap-1">
                  {STANDARD_COLORS.map((color, index) => (
                    <ColorSwatch
                      key={`standard-${color}-${index}`}
                      color={color}
                      selectedColor={value}
                      label={`Cor padrão ${index + 1}`}
                      onSelect={(nextColor) => {
                        onChange(nextColor);
                        setIsOpen(false);
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="border-t border-zinc-300 bg-[#f5f5f5] px-3 py-1.5">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[12px] text-zinc-900 hover:bg-zinc-200"
                  onClick={() => setIsOpen(false)}
                >
                  <span className="inline-block h-4 w-4 rounded-full border border-zinc-500 bg-[conic-gradient(#ef4444,#f59e0b,#eab308,#22c55e,#06b6d4,#3b82f6,#8b5cf6,#ef4444)]" />
                  <span>Mais Cores...</span>
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function ChangeCaseDropdown({
  disabled = false,
  onChange,
}: {
  disabled?: boolean;
  onChange: (mode: ChangeCaseMode) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<FloatingMenuPosition>({
    top: 0,
    left: 0,
    minWidth: 268,
  });

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const menuWidthPx = 268;

  const updateMenuPosition = useCallback(() => {
    const buttonRect = buttonRef.current?.getBoundingClientRect();

    if (!buttonRect || typeof window === "undefined") {
      return;
    }

    const gapPx = FONT_GROUP_LAYOUT.menuViewportGap;
    const safePaddingPx = FONT_GROUP_LAYOUT.menuViewportPadding;
    const viewportWidth = window.innerWidth;
    const maxLeft = Math.max(safePaddingPx, viewportWidth - menuWidthPx - safePaddingPx);

    setMenuPosition({
      top: buttonRect.bottom + gapPx,
      left: Math.min(Math.max(safePaddingPx, buttonRect.left), maxLeft),
      minWidth: menuWidthPx,
    });
  }, []);

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

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Alterar maiúsculas e minúsculas"
        title="Alterar maiúsculas e minúsculas"
        disabled={disabled}
        className={[
          "flex items-center justify-center gap-0.5 border border-transparent bg-transparent hover:border-zinc-300 hover:bg-white",
          disabled ? "cursor-not-allowed" : "cursor-pointer",
        ].join(" ")}
        style={{
          height: FONT_GROUP_LAYOUT.iconButtonHeight,
          minWidth: 36,
          paddingLeft: FONT_GROUP_LAYOUT.iconButtonPaddingX,
          paddingRight: FONT_GROUP_LAYOUT.iconButtonPaddingX,
          borderRadius: FONT_GROUP_LAYOUT.iconButtonRadius,
          color: FONT_GROUP_COLORS.defaultText,
          opacity: disabled ? FONT_GROUP_COLORS.disabledOpacity : 1,
        }}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          updateMenuPosition();
          setIsOpen((current) => !current);
        }}
      >
        <span className="text-[14px] font-medium leading-none">Aa</span>
        <ChevronDown style={{ width: FONT_GROUP_LAYOUT.smallIconSize, height: FONT_GROUP_LAYOUT.smallIconSize }} />
      </button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed overflow-auto rounded-md border border-zinc-300 bg-white py-1 shadow-2xl"
              style={{
                top: menuPosition.top,
                left: menuPosition.left,
                minWidth: menuPosition.minWidth,
                maxHeight: FONT_GROUP_MENU_LAYOUT.smallMenuMaxHeight,
                zIndex: FONT_GROUP_LAYOUT.menuZIndex,
              }}
            >
              {CHANGE_CASE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="flex w-full items-center px-3 py-1.5 text-left text-[12px] text-zinc-800 hover:bg-blue-50"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function FontDialogPopover({
  dialogRef,
  fontFamily,
  fontSize,
  fontStyle,
  textColor,
  underlineStyle,
  underlineColor,
  activeState,
  disabled,
  resolveCenter,
  onApply,
  onCancel,
}: {
  dialogRef: Ref<HTMLDivElement>;
  fontFamily: string;
  fontSize: number;
  fontStyle: FontStyleMode;
  textColor: string;
  underlineStyle: UnderlineStyle;
  underlineColor: string;
  activeState: {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strike: boolean;
    subscript: boolean;
    superscript: boolean;
  };
  disabled: boolean;
  resolveCenter: () => { left: number; top: number };
  onApply: (draft: FontDialogDraft) => void;
  onCancel: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"font" | "advanced">("font");
  const [dialogCenter, setDialogCenter] = useState<{ left: number; top: number }>(() =>
    resolveCenter(),
  );

  const [draft, setDraft] = useState<FontDialogDraft>({
    fontFamily,
    fontStyle,
    fontSize,
    textColor,
    underlineStyle,
    underlineColor,
    strike: activeState.strike,
    doubleStrike: false,
    superscript: activeState.superscript,
    subscript: activeState.subscript,
    smallCaps: false,
    allCaps: false,
    hidden: false,
  });

  const selectedFont = getFontOption(draft.fontFamily);
  const selectedStyleFlags = getFontStyleFlags(draft.fontStyle);

  useEffect(() => {
    const applyPosition = () => {
      setDialogCenter(resolveCenter());
    };

    applyPosition();
    window.addEventListener("resize", applyPosition);
    window.addEventListener("scroll", applyPosition, true);

    return () => {
      window.removeEventListener("resize", applyPosition);
      window.removeEventListener("scroll", applyPosition, true);
    };
  }, [resolveCenter]);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0"
      style={{
        zIndex:
          FONT_GROUP_LAYOUT.menuZIndex + FONT_GROUP_LAYOUT.dialogZIndexOffset,
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="false"
        aria-label="Fonte"
        className="absolute max-h-[calc(100vh-24px)] w-[min(470px,calc(100vw-24px))] overflow-auto rounded-sm border border-zinc-500 bg-[#f3f3f3] text-zinc-900 shadow-2xl"
        style={{
          left: dialogCenter.left,
          top: dialogCenter.top,
          transform: "translate(-50%, -50%)",
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex h-8 items-center justify-between border-b border-zinc-300 bg-white px-3">
          <div className="text-[12px] font-medium">Fonte</div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded text-[13px] hover:bg-zinc-100"
              title="Ajuda"
              aria-label="Ajuda"
              onClick={() => undefined}
            >
              ?
            </button>

            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded hover:bg-red-50 hover:text-red-700"
              title="Fechar"
              aria-label="Fechar"
              onClick={onCancel}
            >
              <X style={{ width: FONT_GROUP_LAYOUT.iconSize, height: FONT_GROUP_LAYOUT.iconSize }} />
            </button>
          </div>
        </div>

        <div className="p-2">
          <div className="flex">
            <button
              type="button"
              className={[
                "h-7 border border-b-0 px-4 text-[12px]",
                activeTab === "font"
                  ? "border-zinc-300 bg-white"
                  : "border-transparent bg-[#e8e8e8] text-zinc-600",
              ].join(" ")}
              onClick={() => setActiveTab("font")}
            >
              Fonte
            </button>

            <button
              type="button"
              className={[
                "h-7 border border-b-0 px-4 text-[12px]",
                activeTab === "advanced"
                  ? "border-zinc-300 bg-white"
                  : "border-transparent bg-[#e8e8e8] text-zinc-600",
              ].join(" ")}
              onClick={() => setActiveTab("advanced")}
            >
              Avançado
            </button>
          </div>

          <div className="border border-zinc-300 bg-white p-5">
            {activeTab === "font" ? (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px_96px]">
                  <label className="flex flex-col gap-1">
                    <span className="text-[12px]">Fonte:</span>

                    <input
                      value={getFontOption(draft.fontFamily).label}
                      readOnly
                      className="h-6 border border-zinc-300 px-1 text-[12px] outline-none"
                      style={{ fontFamily: selectedFont.cssFamily }}
                    />

                    <select
                      value={draft.fontFamily}
                      size={6}
                      disabled={disabled}
                      className="h-[92px] border border-zinc-300 bg-white text-[12px] outline-none"
                      style={{ fontFamily: selectedFont.cssFamily }}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          fontFamily: event.target.value,
                        }))
                      }
                    >
                      <optgroup label="Equivalentes livres">
                        {FONT_OPTIONS.filter(
                          (font) => font.source === "academic-equivalent",
                        ).map((font) => (
                          <option
                            key={font.value}
                            value={font.value}
                            style={{ fontFamily: font.cssFamily }}
                            title={font.note}
                          >
                            {font.label}
                          </option>
                        ))}
                      </optgroup>

                      <optgroup label="Fontes livres">
                        {FONT_OPTIONS.filter((font) => font.source === "web-free").map(
                          (font) => (
                            <option
                              key={font.value}
                              value={font.value}
                              style={{ fontFamily: font.cssFamily }}
                            >
                              {font.label}
                            </option>
                          ),
                        )}
                      </optgroup>

                      <optgroup label="Sistema">
                        {FONT_OPTIONS.filter((font) => font.source === "system").map(
                          (font) => (
                            <option
                              key={font.value}
                              value={font.value}
                              style={{ fontFamily: font.cssFamily }}
                              title={font.note}
                            >
                              {font.label}
                            </option>
                          ),
                        )}
                      </optgroup>
                    </select>
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[12px]">Estilo da fonte:</span>

                    <input
                      value={
                        FONT_STYLE_OPTIONS.find((item) => item.value === draft.fontStyle)
                          ?.label || "Regular"
                      }
                      readOnly
                      className="h-6 border border-zinc-300 px-1 text-[12px] outline-none"
                    />

                    <select
                      value={draft.fontStyle}
                      size={6}
                      disabled={disabled}
                      className="h-[92px] border border-zinc-300 bg-white text-[12px] outline-none"
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          fontStyle: event.target.value as FontStyleMode,
                        }))
                      }
                    >
                      {FONT_STYLE_OPTIONS.map((style) => (
                        <option key={style.value} value={style.value}>
                          {style.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[12px]">Tamanho:</span>

                    <input
                      value={getFontSizeLabel(draft.fontSize)}
                      readOnly
                      className="h-6 border border-zinc-300 px-1 text-[12px] outline-none"
                    />

                    <select
                      value={draft.fontSize}
                      size={6}
                      disabled={disabled}
                      className="h-[92px] border border-zinc-300 bg-white text-[12px] outline-none"
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          fontSize: Number(event.target.value),
                        }))
                      }
                    >
                      {FONT_SIZE_OPTIONS.map((size) => (
                        <option key={size.value} value={size.value}>
                          {size.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[112px_1fr_112px]">
                  <label className="flex flex-col gap-1">
                    <span className="text-[12px]">Cor da fonte:</span>
                    <select
                      value={draft.textColor}
                      disabled={disabled}
                      className="h-7 border border-zinc-300 bg-white px-1 text-[12px]"
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          textColor: event.target.value,
                        }))
                      }
                    >
                      {TEXT_COLORS.map((color) => (
                        <option key={color.value} value={color.value}>
                          {color.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[12px]">Estilo de sublinhado:</span>
                    <select
                      value={draft.underlineStyle}
                      disabled={disabled}
                      className="h-7 border border-zinc-300 bg-white px-1 text-[12px]"
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          underlineStyle: event.target.value as UnderlineStyle,
                        }))
                      }
                    >
                      {UNDERLINE_STYLE_OPTIONS.map((style) => (
                        <option key={style.value} value={style.value}>
                          {style.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[12px] text-zinc-500">
                      Cor do sublinhado:
                    </span>
                    <select
                      value={draft.underlineColor}
                      disabled={disabled || draft.underlineStyle === "none"}
                      className="h-7 border border-zinc-300 bg-white px-1 text-[12px] disabled:bg-zinc-100 disabled:text-zinc-400"
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          underlineColor: event.target.value,
                        }))
                      }
                    >
                      {TEXT_COLORS.map((color) => (
                        <option key={color.value} value={color.value}>
                          {color.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-4">
                  <div className="mb-2 text-[12px]">Efeitos</div>

                  <div className="grid grid-cols-1 gap-x-12 gap-y-1 text-[12px] sm:grid-cols-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={draft.strike}
                        disabled={disabled}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            strike: event.target.checked,
                          }))
                        }
                      />
                      Tachado
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={draft.smallCaps}
                        disabled={disabled}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            smallCaps: event.target.checked,
                          }))
                        }
                      />
                      Versalete
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={draft.doubleStrike}
                        disabled={disabled}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            doubleStrike: event.target.checked,
                          }))
                        }
                      />
                      Tachado duplo
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={draft.allCaps}
                        disabled={disabled}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            allCaps: event.target.checked,
                          }))
                        }
                      />
                      Todas em maiúsculas
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={draft.superscript}
                        disabled={disabled || draft.subscript}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            superscript: event.target.checked,
                            subscript: event.target.checked ? false : current.subscript,
                          }))
                        }
                      />
                      Sobrescrito
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={draft.hidden}
                        disabled={disabled}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            hidden: event.target.checked,
                          }))
                        }
                      />
                      Oculto
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={draft.subscript}
                        disabled={disabled || draft.superscript}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            subscript: event.target.checked,
                            superscript: event.target.checked ? false : current.superscript,
                          }))
                        }
                      />
                      Subscrito
                    </label>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="mb-1 text-[12px]">Visualização</div>

                  <div className="border-t border-zinc-300 pt-2">
                    <div className="flex h-[54px] items-center justify-center border border-zinc-400 bg-white px-4">
                      <div className="h-px flex-1 bg-zinc-500" />

                      <div
                        className="mx-4 min-w-[130px] text-center"
                        style={{
                          fontFamily: selectedFont.cssFamily,
                          fontSize: `${Math.min(Math.max(draft.fontSize, 10), 22)}px`,
                          color: draft.textColor,
                          fontWeight: selectedStyleFlags.bold ? 700 : 400,
                          fontStyle: selectedStyleFlags.italic ? "italic" : "normal",
                          textDecorationLine:
                            draft.strike || draft.doubleStrike
                              ? "line-through"
                              : draft.underlineStyle !== "none"
                                ? "underline"
                                : "none",
                          textDecorationStyle:
                            draft.underlineStyle === "double"
                              ? "double"
                              : draft.underlineStyle === "dotted"
                                ? "dotted"
                                : draft.underlineStyle === "dashed"
                                  ? "dashed"
                                  : "solid",
                          textTransform: draft.allCaps ? "uppercase" : "none",
                          fontVariant: draft.smallCaps ? "small-caps" : "normal",
                          opacity: draft.hidden ? 0.3 : 1,
                        }}
                      >
                        {selectedFont.value}
                      </div>

                      <div className="h-px flex-1 bg-zinc-500" />
                    </div>

                    <div className="mt-2 text-[11px] leading-snug text-zinc-700">
                      {selectedFont.note ||
                        "Esta fonte será usada na tela e, quando disponível, também na impressão."}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="min-h-[330px] text-[12px] text-zinc-700">
                <div className="mb-3 font-medium">Avançado</div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    Espaçamento entre caracteres
                    <select className="h-7 border border-zinc-300 bg-white px-1 text-[12px]">
                      <option>Normal</option>
                      <option>Expandido</option>
                      <option>Condensado</option>
                    </select>
                  </label>

                  <label className="flex flex-col gap-1">
                    Posição
                    <select className="h-7 border border-zinc-300 bg-white px-1 text-[12px]">
                      <option>Normal</option>
                      <option>Elevado</option>
                      <option>Rebaixado</option>
                    </select>
                  </label>
                </div>

                <div className="mt-4 rounded border border-zinc-200 bg-zinc-50 p-3 text-[11px] leading-relaxed">
                  Esta área está preparada para receber espaçamento, escala,
                  kerning e recursos tipográficos avançados em uma etapa posterior.
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-zinc-300 bg-[#f3f3f3] px-2 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="h-7 rounded border border-zinc-300 bg-[#e9e9e9] px-3 text-[12px] hover:bg-white"
              onClick={() => undefined}
            >
              Definir como Padrão
            </button>

            <button
              type="button"
              className="h-7 rounded border border-zinc-300 bg-[#e9e9e9] px-3 text-[12px] hover:bg-white"
              onClick={() => undefined}
            >
              Efeitos do Texto
            </button>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              className="h-7 min-w-[88px] rounded border border-blue-600 bg-white px-4 text-[12px] hover:bg-blue-50"
              onClick={() => onApply(draft)}
            >
              OK
            </button>

            <button
              type="button"
              className="h-7 min-w-[88px] rounded border border-zinc-300 bg-[#e9e9e9] px-4 text-[12px] hover:bg-white"
              onClick={onCancel}
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ColorSwatch({
  color,
  selectedColor,
  label,
  onSelect,
}: {
  color: string;
  selectedColor: string;
  label: string;
  onSelect: (color: string) => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={[
        "h-6 w-6 border",
        selectedColor.toLowerCase() === color.toLowerCase()
          ? "border-blue-600 ring-1 ring-blue-300"
          : "border-zinc-300",
      ].join(" ")}
      style={{ backgroundColor: color }}
      onClick={() => onSelect(color)}
    />
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
