import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export const KnexWriterClipboardExtension = Extension.create({
  name: "knexWriterClipboard",

  addStorage() {
    return {
      pasteSanitizerReady: true,
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-c": () => false,
      "Mod-v": () => false,
      "Mod-x": () => false,
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("knexWriterClipboardPlugin"),
        props: {
          handleDOMEvents: {
            copy: () => false,
            cut: () => false,
            paste: () => false,
          },
        },
      }),
    ];
  },
});

