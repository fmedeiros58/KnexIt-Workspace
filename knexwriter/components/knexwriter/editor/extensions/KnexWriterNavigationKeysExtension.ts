import { Extension } from "@tiptap/core";

export const KnexWriterNavigationKeysExtension = Extension.create({
  name: "knexWriterNavigationKeys",

  addStorage() {
    return {
      futurePaginationIntegration: true,
    };
  },

  addKeyboardShortcuts() {
    return {
      ArrowUp: () => false,
      ArrowDown: () => false,
      ArrowLeft: () => false,
      ArrowRight: () => false,
      Home: () => false,
      End: () => false,
      PageUp: () => false,
      PageDown: () => false,
    };
  },
});

