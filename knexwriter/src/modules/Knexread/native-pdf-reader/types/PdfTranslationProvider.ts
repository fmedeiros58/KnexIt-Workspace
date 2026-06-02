import type { PdfGeoBlockType } from "./PdfGeoText";

export interface TranslationInput {
  sourceLanguage?: string;
  targetLanguage: string;
  text: string;
  context?: {
    documentId?: string;
    pageNumber?: number;
    blockType?: PdfGeoBlockType | string;
    previousBlock?: string;
    nextBlock?: string;
    terminology?: Record<string, string>;
  };
}

export interface TranslationOutput {
  translatedText: string;
  providerId: string;
  confidence?: number;
  detectedLanguage?: string;
}

export interface TranslationProvider {
  id: string;
  name: string;
  runtime: Array<"desktop" | "pwa" | "web">;
  supportsOffline: boolean;
  supportsBatch: boolean;
  translate(input: TranslationInput): Promise<TranslationOutput>;
}
