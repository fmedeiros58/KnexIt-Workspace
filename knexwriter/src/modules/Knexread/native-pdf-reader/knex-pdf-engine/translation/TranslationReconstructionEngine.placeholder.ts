export const TRANSLATION_RECONSTRUCTION_ENGINE_EXTENSION_POINT = {
  id: "translation-reconstruction-engine",
  status: "reserved-extension-point",
  reason:
    "Reserved for future reconstruction of translated text onto independent translation pages.",
} as const;

export type TranslationReconstructionEngineExtensionPoint =
  typeof TRANSLATION_RECONSTRUCTION_ENGINE_EXTENSION_POINT;
