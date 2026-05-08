import type { WriterRibbonProps } from "../../../shell/KnexWriterShell";
import { RibbonTabLayout } from "../../shared/RibbonTabLayout";
import { ClipboardGroup } from "./ClipboardGroup";
import { DocumentGroup } from "./DocumentGroup";
import { FontGroup } from "./FontGroup";
import { ParagraphGroup } from "./ParagraphGroup";
import { ProjectSectionGroup } from "./ProjectSectionGroup";
import { StylesGroup } from "./StylesGroup";

function getFontSizeFromEditor(editor: WriterRibbonProps["state"]["editor"]): number | undefined {
  if (!editor) return undefined;

  const raw = editor.getAttributes("textStyle")?.fontSize as string | undefined;
  if (!raw) return undefined;

  const parsed = Number(String(raw).replace("pt", "").replace("px", "").trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function HomeRibbonTab({ state, actions }: WriterRibbonProps) {
  const editor = state.editor;

  return (
    <RibbonTabLayout>
      <ClipboardGroup />

      <FontGroup
        disabled={!editor}
        currentFontFamily={(editor?.getAttributes("textStyle")?.fontFamily as string | undefined) ?? "Arimo"}
        currentFontSize={getFontSizeFromEditor(editor) ?? 12}
        currentTextColor={(editor?.getAttributes("textStyle")?.color as string | undefined) ?? "#000000"}
        currentHighlightColor={(editor?.getAttributes("highlight")?.color as string | undefined) ?? "#ffff00"}
        isBoldActive={Boolean(editor?.isActive("bold"))}
        isItalicActive={Boolean(editor?.isActive("italic"))}
        isUnderlineActive={Boolean(editor?.isActive("underline"))}
        isStrikeActive={Boolean(editor?.isActive("strike"))}
        isSubscriptActive={Boolean(editor?.isActive("subscript"))}
        isSuperscriptActive={Boolean(editor?.isActive("superscript"))}
        commands={{
          setFontFamily: (fontFamily) => actions.applyWritingCommand("fontName", fontFamily),
          setFontSize: (fontSize) => actions.applyWritingCommand("fontSize", String(fontSize)),
          increaseFontSize: () => actions.applyWritingCommand("increaseFontSize"),
          decreaseFontSize: () => actions.applyWritingCommand("decreaseFontSize"),
          toggleBold: () => actions.applyWritingCommand("bold"),
          toggleItalic: () => actions.applyWritingCommand("italic"),
          toggleUnderline: () => actions.applyWritingCommand("underline"),
          toggleStrike: () => actions.applyWritingCommand("strikeThrough"),
          toggleSubscript: () => actions.applyWritingCommand("subscript"),
          toggleSuperscript: () => actions.applyWritingCommand("superscript"),
          setTextColor: (color) => actions.applyWritingCommand("foreColor", color),
          setHighlightColor: (color) => actions.applyWritingCommand("hiliteColor", color),
          clearFormatting: () => actions.applyWritingCommand("removeFormat"),
          changeCase: () => {
            // Placeholder: command ainda não implementado na camada TipTap atual.
          },
        }}
      />

      <ParagraphGroup editor={editor} actions={actions} disabled={!editor} />
      <StylesGroup />
      <DocumentGroup />
      <ProjectSectionGroup state={state} actions={actions} />
    </RibbonTabLayout>
  );
}
