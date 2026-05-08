import { Extension } from "@tiptap/core";

function runSafely(action: () => boolean) {
  try {
    return action();
  } catch {
    return false;
  }
}

export const KnexWriterKeyboardShortcuts = Extension.create({
  name: "knexWriterKeyboardShortcuts",

  addKeyboardShortcuts() {
    return {
      "Mod-b": () => runSafely(() => this.editor.commands.toggleBold()),
      "Mod-i": () => runSafely(() => this.editor.commands.toggleItalic()),
      "Mod-u": () => runSafely(() => this.editor.commands.toggleUnderline()),
      "Mod-z": () => runSafely(() => this.editor.commands.undo()),
      "Mod-y": () => runSafely(() => this.editor.commands.redo()),
      "Mod-Shift-z": () => runSafely(() => this.editor.commands.redo()),

      "Mod-a": () => false,
      "Mod-c": () => false,
      "Mod-v": () => false,
      "Mod-x": () => false,

      Enter: () => false,
      "Shift-Enter": () => runSafely(() => this.editor.commands.setHardBreak()),

      Backspace: () => false,
      Delete: () => false,

      ArrowUp: () => false,
      ArrowDown: () => false,
      ArrowLeft: () => false,
      ArrowRight: () => false,
      Home: () => false,
      End: () => false,
      PageUp: () => false,
      PageDown: () => false,

      Tab: () =>
        runSafely(() => {
          if (this.editor.isActive("bulletList") || this.editor.isActive("orderedList") || this.editor.isActive("taskList")) {
            const sank = this.editor.commands.sinkListItem("listItem");
            if (sank) return true;
          }

          if (typeof this.editor.commands.increaseIndent === "function") {
            return this.editor.commands.increaseIndent();
          }

          return false;
        }),

      "Shift-Tab": () =>
        runSafely(() => {
          if (this.editor.isActive("bulletList") || this.editor.isActive("orderedList") || this.editor.isActive("taskList")) {
            const lifted = this.editor.commands.liftListItem("listItem");
            if (lifted) return true;
          }

          if (typeof this.editor.commands.decreaseIndent === "function") {
            return this.editor.commands.decreaseIndent();
          }

          return false;
        }),
    };
  },
});

