import { Extension } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    knexWriterFontSize: {
      setFontSize: (fontSize: string | number) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

function normalizeFontSizeValue(value: string | number): string | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return null;
    return `${value}pt`;
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(",", ".");
  if (/^\d+(\.\d+)?$/.test(normalized)) {
    return `${normalized}pt`;
  }

  if (/^\d+(\.\d+)?(pt|px|em|rem|%)$/i.test(normalized)) {
    return normalized;
  }

  return null;
}

export const KnexWriterFontSizeExtension = Extension.create({
  name: "knexWriterFontSize",

  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize || null,
            renderHTML: (attributes: { fontSize?: string | null }) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize) =>
        ({ chain }) => {
          try {
            const normalized = normalizeFontSizeValue(fontSize);
            if (!normalized) return false;

            return chain().setMark("textStyle", { fontSize: normalized }).run();
          } catch {
            return false;
          }
        },

      unsetFontSize:
        () =>
        ({ chain }) => {
          try {
            return chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run();
          } catch {
            return false;
          }
        },
    };
  },
});

