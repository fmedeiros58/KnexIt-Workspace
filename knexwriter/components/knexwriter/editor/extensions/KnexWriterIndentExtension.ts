import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

const BLOCK_TYPES = new Set(["paragraph", "heading"]);
const LIST_TYPES = new Set(["bulletList", "orderedList", "taskList", "listItem", "taskItem"]);
const INDENT_STEP_PX = 24;
const MAX_INDENT_LEVEL = 8;
const MIN_INDENT_LEVEL = 0;

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    knexWriterIndent: {
      increaseIndent: () => ReturnType;
      decreaseIndent: () => ReturnType;
      setIndentLevel: (level: number) => ReturnType;
      unsetIndent: () => ReturnType;
    };
  }
}

function clampIndentLevel(level: number) {
  if (!Number.isFinite(level)) return MIN_INDENT_LEVEL;
  return Math.min(Math.max(Math.round(level), MIN_INDENT_LEVEL), MAX_INDENT_LEVEL);
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

function extractIndentLevel(node: ProseMirrorNode) {
  const attrLevel = Number(node.attrs.indentLevel);
  if (Number.isFinite(attrLevel)) return clampIndentLevel(attrLevel);

  const marginLeft = typeof node.attrs.marginLeft === "string" ? node.attrs.marginLeft : "";
  const parsed = Number(marginLeft.replace("px", "").replace(",", ".").trim());
  if (!Number.isFinite(parsed)) return 0;
  return clampIndentLevel(parsed / INDENT_STEP_PX);
}

function resolveNextAttrs(node: ProseMirrorNode, level: number): Record<string, unknown> {
  const normalizedLevel = clampIndentLevel(level);
  const marginLeft = normalizedLevel > 0 ? `${normalizedLevel * INDENT_STEP_PX}px` : null;
  const textIndent = normalizedLevel > 0 ? "0px" : null;
  const attrs: Record<string, unknown> = { ...node.attrs };

  const styleMap = parseStyleText(
    typeof attrs.writerBlockStyle === "string" ? attrs.writerBlockStyle : null,
  );

  if (marginLeft) styleMap.set("margin-left", marginLeft);
  else styleMap.delete("margin-left");

  if (textIndent) styleMap.set("text-indent", textIndent);
  else styleMap.delete("text-indent");

  attrs.indentLevel = normalizedLevel;
  attrs.marginLeft = marginLeft;
  attrs.textIndent = textIndent;
  attrs.writerBlockStyle = styleMapToText(styleMap);

  return attrs;
}

function isSelectionInList(state: { selection: { $from: { depth: number; node: (depth: number) => ProseMirrorNode } } }) {
  try {
    const { $from } = state.selection;
    for (let depth = $from.depth; depth >= 0; depth -= 1) {
      if (LIST_TYPES.has($from.node(depth).type.name)) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}

function applyIndentLevel(
  levelResolver: (node: ProseMirrorNode) => number,
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
      const nextAttrs = resolveNextAttrs(node, levelResolver(node));
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

export const KnexWriterIndentExtension = Extension.create({
  name: "knexWriterIndent",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          indentLevel: {
            default: 0,
            parseHTML: (element: HTMLElement) => {
              const value = Number(element.getAttribute("data-indent-level"));
              return Number.isFinite(value) ? clampIndentLevel(value) : 0;
            },
            renderHTML: (attributes: { indentLevel?: number | null }) => {
              const level = Number(attributes.indentLevel);
              if (!Number.isFinite(level) || level <= 0) return {};
              return { "data-indent-level": String(clampIndentLevel(level)) };
            },
          },
          marginLeft: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.marginLeft || null,
            renderHTML: (attributes: { marginLeft?: string | null }) =>
              attributes.marginLeft ? { style: `margin-left: ${attributes.marginLeft}` } : {},
          },
          textIndent: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.textIndent || null,
            renderHTML: (attributes: { textIndent?: string | null }) =>
              attributes.textIndent ? { style: `text-indent: ${attributes.textIndent}` } : {},
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      increaseIndent:
        () =>
        ({ state, tr, dispatch, commands }) => {
          try {
            if (isSelectionInList(state)) {
              return commands.sinkListItem("listItem");
            }

            return applyIndentLevel((node) => extractIndentLevel(node) + 1, { state, tr, dispatch });
          } catch {
            return false;
          }
        },

      decreaseIndent:
        () =>
        ({ state, tr, dispatch, commands }) => {
          try {
            if (isSelectionInList(state)) {
              return commands.liftListItem("listItem");
            }

            return applyIndentLevel((node) => extractIndentLevel(node) - 1, { state, tr, dispatch });
          } catch {
            return false;
          }
        },

      setIndentLevel:
        (level) =>
        ({ state, tr, dispatch }) => {
          try {
            const clamped = clampIndentLevel(level);
            return applyIndentLevel(() => clamped, { state, tr, dispatch });
          } catch {
            return false;
          }
        },

      unsetIndent:
        () =>
        ({ state, tr, dispatch }) => {
          try {
            return applyIndentLevel(() => 0, { state, tr, dispatch });
          } catch {
            return false;
          }
        },
    };
  },
});
