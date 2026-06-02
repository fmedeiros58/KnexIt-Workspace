import type {
  TranslationInput,
  TranslationOutput,
  TranslationProvider,
} from "../../types";

async function translate(input: TranslationInput): Promise<TranslationOutput> {
  const prefix = input.targetLanguage.toUpperCase().slice(0, 5);
  return {
    translatedText: `[${prefix}] ${input.text}`,
    providerId: "online-api-mock",
    confidence: 0.74,
    detectedLanguage: input.sourceLanguage,
  };
}

export const onlineTranslationProvider: TranslationProvider = {
  id: "online-api-mock",
  name: "Online API Mock",
  runtime: ["desktop", "pwa", "web"],
  supportsOffline: false,
  supportsBatch: true,
  translate,
};
