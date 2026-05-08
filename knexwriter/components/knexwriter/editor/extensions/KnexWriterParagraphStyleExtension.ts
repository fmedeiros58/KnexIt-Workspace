import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

type ParagraphStylePatch = {
  textAlign?: string | null;
  lineHeight?: string | null;
  marginTop?: string | null;
  marginBottom?: string | null;
  backgroundColor?: string | null;
  borderTop?: string | null;
  borderBottom?: string | null;
  borderLeft?: string | null;
  borderRight?: string | null;
  paddingTop?: string | null;
  paddingBottom?: string | null;
  paddingLeft?: string | null;
  paddingRight?: string | null;
};

type ParagraphSpacingInput = {
  marginTop?: string | number | null;
  marginBottom?: string | number | null;
};

type ParagraphBorderInput = {
  borderTop?: string | null;
  borderBottom?: string | null;
  borderLeft?: string | null;
  borderRight?: string | null;
  paddingTop?: string | null;
  paddingBottom?: string | null;
  paddingLeft?: string | null;
  paddingRight?: string | null;
};

const PARAGRAPH_STYLE_KEYS = [
  "text-align",
  "line-height",
  "margin-top",
  "margin-bottom",
  "background-color",
  "border-top",
  "border-bottom",
  "border-left",
  "border-right",
  "padding-top",
  "padding-bottom",
  "padding-left",
  "padding-right",
] as const;

const BLOCK_TYPES = new Set(["paragraph", "heading"]);

const styleAttrToCss: Record<keyof ParagraphStylePatch, string> = {
  textAlign: "text-align",
  lineHeight: "line-height",
  marginTop: "margin-top",
  marginBottom: "margin-bottom",
  backgroundColor: "background-color",
  borderTop: "border-top",
  borderBottom: "border-bottom",
  borderLeft: "border-left",
  borderRight: "border-right",
  paddingTop: "padding-top",
  paddingBottom: "padding-bottom",
  paddingLeft: "padding-left",
  paddingRight: "padding-right",
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    knexWriterParagraphStyle: {
      setParagraphLineHeight: (value: string | number) => ReturnType;
      setParagraphSpacing: (value: ParagraphSpacingInput) => ReturnType;
      setParagraphShading: (color: string | null) => ReturnType;
      setParagraphBorder: (borderConfig: ParagraphBorderInput | null) => ReturnType;
      clearParagraphStyle: () => ReturnType;
    };
  }
}

function parseStyleText(styleText?: string | null) {
  const styleMap = new Map<string, string>();
  if (!styleText) return styleMap;

  for (const declaration of styleText.split(";")) {
    const [rawProperty, ...rawValue] = declaration.split(":");
    const property = rawProperty?.trim().toLowerCase();
    const valueText = rawValue.join(":").trim();

    if (property && valueText) {
      styleMap.set(property, valueText);
    }
  }

  return styleMap;
}

function styleMapToText(styleMap: Map<string, string>) {
  const entries = Array.from(styleMap.entries());
  if (!entries.length) return null;
  return entries.map(([property, value]) => `${property}: ${value}`).join("; ") + ";";
}

function readAllowedStylesFromElement(element: HTMLElement) {
  const styleMap = new Map<string, string>();

  for (const property of PARAGRAPH_STYLE_KEYS) {
    const value = element.style.getPropertyValue(property)?.trim();
    if (value) styleMap.set(property, value);
  }

  return styleMapToText(styleMap);
}

function normalizeCssLength(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return `${value}px`;
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(",", ".");
  if (/^-?\d+(\.\d+)?$/.test(normalized)) {
    return `${normalized}px`;
  }

  return normalized;
}

function normalizeLineHeight(value: string | number) {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return null;
    return String(value);
  }

  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(",", ".");
}

function applyStylePatchToNode(node: ProseMirrorNode, patch: ParagraphStylePatch): Record<string, unknown> {
  const attrs: Record<string, unknown> = { ...node.attrs };
  const styleMap = parseStyleText(
    typeof attrs.writerBlockStyle === "string" ? attrs.writerBlockStyle : null,
  );

  for (const [attrName, cssName] of Object.entries(styleAttrToCss) as Array<
    [keyof ParagraphStylePatch, string]
  >) {
    if (!(attrName in patch)) continue;
    const patchValue = patch[attrName];
    if (patchValue === undefined) continue;

    attrs[attrName] = patchValue ?? null;

    if (patchValue === null) styleMap.delete(cssName);
    else styleMap.set(cssName, patchValue);
  }

  attrs.writerBlockStyle = styleMapToText(styleMap);
  return attrs;
}

function applyPatchToSelection(
  patch: ParagraphStylePatch,
  context: {
    state: { selection: { from: number; to: number }; doc: ProseMirrorNode };
    tr: any;
    dispatch?: ((tr: any) => void) | undefined;
  },
) {
  try {
    const { state, tr, dispatch } = context;
    let didUpdate = false;

    state.doc.nodesBetween(state.selection.from, state.selection.to, (node, pos) => {
      if (!BLOCK_TYPES.has(node.type.name)) return;
      const nextAttrs = applyStylePatchToNode(node, patch);
      tr.setNodeMarkup(pos, undefined, nextAttrs, node.marks);
      didUpdate = true;
    });

    if (!didUpdate) return false;
    if (dispatch) dispatch(tr);
    return true;
  } catch {
    return false;
  }
}

export const KnexWriterParagraphStyleExtension = Extension.create({
  name: "knexWriterParagraphStyle",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          writerBlockStyle: {
            default: null,
            parseHTML: (element: HTMLElement) => readAllowedStylesFromElement(element),
            renderHTML: (attributes: { writerBlockStyle?: string | null }) => {
              if (!attributes.writerBlockStyle) return {};
              return { style: attributes.writerBlockStyle };
            },
          },
          textAlign: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.textAlign || null,
            renderHTML: (attributes: { textAlign?: string | null }) =>
              attributes.textAlign ? { style: `text-align: ${attributes.textAlign}` } : {},
          },
          lineHeight: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.lineHeight || null,
            renderHTML: (attributes: { lineHeight?: string | null }) =>
              attributes.lineHeight ? { style: `line-height: ${attributes.lineHeight}` } : {},
          },
          marginTop: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.marginTop || null,
            renderHTML: (attributes: { marginTop?: string | null }) =>
              attributes.marginTop ? { style: `margin-top: ${attributes.marginTop}` } : {},
          },
          marginBottom: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.marginBottom || null,
            renderHTML: (attributes: { marginBottom?: string | null }) =>
              attributes.marginBottom ? { style: `margin-bottom: ${attributes.marginBottom}` } : {},
          },
          backgroundColor: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.backgroundColor || null,
            renderHTML: (attributes: { backgroundColor?: string | null }) =>
              attributes.backgroundColor ? { style: `background-color: ${attributes.backgroundColor}` } : {},
          },
          borderTop: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.borderTop || null,
            renderHTML: (attributes: { borderTop?: string | null }) =>
              attributes.borderTop ? { style: `border-top: ${attributes.borderTop}` } : {},
          },
          borderBottom: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.borderBottom || null,
            renderHTML: (attributes: { borderBottom?: string | null }) =>
              attributes.borderBottom ? { style: `border-bottom: ${attributes.borderBottom}` } : {},
          },
          borderLeft: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.borderLeft || null,
            renderHTML: (attributes: { borderLeft?: string | null }) =>
              attributes.borderLeft ? { style: `border-left: ${attributes.borderLeft}` } : {},
          },
          borderRight: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.borderRight || null,
            renderHTML: (attributes: { borderRight?: string | null }) =>
              attributes.borderRight ? { style: `border-right: ${attributes.borderRight}` } : {},
          },
          paddingTop: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.paddingTop || null,
            renderHTML: (attributes: { paddingTop?: string | null }) =>
              attributes.paddingTop ? { style: `padding-top: ${attributes.paddingTop}` } : {},
          },
          paddingBottom: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.paddingBottom || null,
            renderHTML: (attributes: { paddingBottom?: string | null }) =>
              attributes.paddingBottom ? { style: `padding-bottom: ${attributes.paddingBottom}` } : {},
          },
          paddingLeft: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.paddingLeft || null,
            renderHTML: (attributes: { paddingLeft?: string | null }) =>
              attributes.paddingLeft ? { style: `padding-left: ${attributes.paddingLeft}` } : {},
          },
          paddingRight: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.paddingRight || null,
            renderHTML: (attributes: { paddingRight?: string | null }) =>
              attributes.paddingRight ? { style: `padding-right: ${attributes.paddingRight}` } : {},
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setParagraphLineHeight:
        (value) =>
        ({ state, tr, dispatch }) => {
          try {
            const normalized = normalizeLineHeight(value);
            if (!normalized) return false;
            return applyPatchToSelection({ lineHeight: normalized }, { state, tr, dispatch });
          } catch {
            return false;
          }
        },

      setParagraphSpacing:
        (value) =>
        ({ state, tr, dispatch }) => {
          try {
            return applyPatchToSelection(
              {
                marginTop: normalizeCssLength(value.marginTop),
                marginBottom: normalizeCssLength(value.marginBottom),
              },
              { state, tr, dispatch },
            );
          } catch {
            return false;
          }
        },

      setParagraphShading:
        (color) =>
        ({ state, tr, dispatch }) => {
          try {
            const normalized = color?.trim();
            return applyPatchToSelection(
              { backgroundColor: normalized && normalized !== "transparent" ? normalized : null },
              { state, tr, dispatch },
            );
          } catch {
            return false;
          }
        },

      setParagraphBorder:
        (borderConfig) =>
        ({ state, tr, dispatch }) => {
          try {
            const patch: ParagraphStylePatch = {
              borderTop: null,
              borderBottom: null,
              borderLeft: null,
              borderRight: null,
              paddingTop: null,
              paddingBottom: null,
              paddingLeft: null,
              paddingRight: null,
            };

            if (borderConfig) {
              patch.borderTop = borderConfig.borderTop ?? null;
              patch.borderBottom = borderConfig.borderBottom ?? null;
              patch.borderLeft = borderConfig.borderLeft ?? null;
              patch.borderRight = borderConfig.borderRight ?? null;
              patch.paddingTop = borderConfig.paddingTop ?? null;
              patch.paddingBottom = borderConfig.paddingBottom ?? null;
              patch.paddingLeft = borderConfig.paddingLeft ?? null;
              patch.paddingRight = borderConfig.paddingRight ?? null;
            }

            return applyPatchToSelection(patch, { state, tr, dispatch });
          } catch {
            return false;
          }
        },

      clearParagraphStyle:
        () =>
        ({ state, tr, dispatch }) => {
          try {
            return applyPatchToSelection(
              {
                textAlign: null,
                lineHeight: null,
                marginTop: null,
                marginBottom: null,
                backgroundColor: null,
                borderTop: null,
                borderBottom: null,
                borderLeft: null,
                borderRight: null,
                paddingTop: null,
                paddingBottom: null,
                paddingLeft: null,
                paddingRight: null,
              },
              { state, tr, dispatch },
            );
          } catch {
            return false;
          }
        },
    };
  },
});
