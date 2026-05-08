import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Typography from "@tiptap/extension-typography";
import CharacterCount from "@tiptap/extension-character-count";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import type { AnyExtension } from "@tiptap/core";
import { KnexWriterKeyboardShortcuts } from "./KnexWriterKeyboardShortcuts";
import { KnexWriterParagraphStyleExtension } from "./KnexWriterParagraphStyleExtension";
import { KnexWriterFontSizeExtension } from "./KnexWriterFontSizeExtension";
import { KnexWriterIndentExtension } from "./KnexWriterIndentExtension";
import { KnexWriterClipboardExtension } from "./KnexWriterClipboardExtension";
import { KnexWriterNavigationKeysExtension } from "./KnexWriterNavigationKeysExtension";
import { KnexWriterHardBreakExtension } from "./KnexWriterHardBreakExtension";

export function createKnexWriterExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({
      undoRedo: {
        depth: 100,
        newGroupDelay: 500,
      },
      link: false,
      underline: false,
      bulletList: {
        keepMarks: true,
        keepAttributes: true,
      },
      orderedList: {
        keepMarks: true,
        keepAttributes: true,
      },
    }),

    TextAlign.configure({
      types: ["heading", "paragraph"],
    }),

    Underline,
    Subscript,
    Superscript,
    TextStyle,
    KnexWriterFontSizeExtension,
    KnexWriterParagraphStyleExtension,
    KnexWriterIndentExtension,
    Color,
    FontFamily.configure({
      types: ["textStyle"],
    }),
    Highlight.configure({
      multicolor: true,
    }),

    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      HTMLAttributes: {
        rel: "noopener noreferrer",
        target: "_blank",
      },
    }),
    Image.configure({
      inline: false,
      allowBase64: true,
    }),

    Table.configure({
      resizable: true,
    }),
    TableRow,
    TableHeader,
    TableCell,

    TaskList,
    TaskItem.configure({
      nested: true,
    }),

    Typography,
    CharacterCount,

    Placeholder.configure({
      placeholder: "Digite seu texto...",
    }),

    KnexWriterHardBreakExtension,
    KnexWriterClipboardExtension,
    KnexWriterNavigationKeysExtension,
    KnexWriterKeyboardShortcuts,
  ];
}
