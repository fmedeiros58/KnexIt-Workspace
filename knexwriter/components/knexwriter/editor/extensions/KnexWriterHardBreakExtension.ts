import { Extension } from "@tiptap/core";

export const KnexWriterHardBreakExtension = Extension.create({
  name: "knexWriterHardBreak",

  addKeyboardShortcuts() {
    return {
      "Shift-Enter": () => {
        try {
          return this.editor.commands.setHardBreak();
        } catch {
          return false;
        }
      },
    };
  },
});

