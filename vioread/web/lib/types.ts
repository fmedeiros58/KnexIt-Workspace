export type DocumentKind = "pdf";

export type DocumentDescriptor = {
  id: string;
  name: string;
  kind: DocumentKind;
  hash: string;
  pageCount: number;
};

export type RecentDocumentEntry = {
  id: string;
  hash: string;
  name: string;
  pageCount: number;
  sizeBytes: number | null;
  lastModified: number | null;
  openedAt: number;
  sourceLabel: string;
};

export type DocumentPage = {
  number: number;
  width: number;
  height: number;
  backgroundColor: string;
};

export type TextBlock = {
  id: string;
  pageNumber: number;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: "normal" | "italic";
  color: string;
  align: "left" | "center" | "right";
  lineHeight: number;
  letterSpacing: number;
  readingOrder: number;
};

export type LayoutBlock = TextBlock & {
  lineIndex: number;
  paragraphIndex: number;
};

export type TranslationPair = {
  blockId: string;
  originalText: string;
  translatedText: string;
};

export type PageMapping = {
  page: DocumentPage;
  blocks: LayoutBlock[];
};

export type SelectionMapping = {
  pageNumber: number;
  blockId: string;
  side: "original" | "translated";
};

export type CitationPayload = {
  pageNumber: number;
  mode: "direct" | "indirect";
  sourceLanguage: string;
  targetLanguage: string;
  original: string;
  translated: string;
  citationText: string;
};

export type ReaderState = {
  document: DocumentDescriptor | null;
  pageNumber: number;
  pageCount: number;
  sourceLanguage: string;
  targetLanguage: string;
  selected: SelectionMapping | null;
  translationCache: Record<string, TranslationPair[]>;
  recentDocuments: RecentDocumentEntry[];
  setDocument: (document: DocumentDescriptor | null) => void;
  setPageNumber: (pageNumber: number) => void;
  setPageCount: (pageCount: number) => void;
  setSourceLanguage: (sourceLanguage: string) => void;
  setTargetLanguage: (targetLanguage: string) => void;
  setSelected: (selected: SelectionMapping | null) => void;
  setCachedTranslation: (key: string, pairs: TranslationPair[]) => void;
  addRecentDocument: (entry: {
    descriptor: DocumentDescriptor;
    sizeBytes?: number | null;
    lastModified?: number | null;
    sourceLabel?: string;
  }) => void;
  hydrateRecentDocuments: () => void;
  clearRecentDocuments: () => void;
  clearForNewDocument: () => void;
};

export type TranslationRequestPayload = {
  documentHash: string;
  pageNumber: number;
  sourceLanguage: string;
  targetLanguage: string;
  blocks: Array<{ id: string; text: string }>;
};

export type TranslationResponsePayload = {
  pageNumber: number;
  pairs: TranslationPair[];
  cached: boolean;
};

export type ReaderFitMode = "fit-pane" | "actual-size";

