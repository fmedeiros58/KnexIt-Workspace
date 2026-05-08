export type WritingFormatCommand =
  | "bold"
  | "italic"
  | "underline"
  | "strikeThrough"
  | "subscript"
  | "superscript"
  | "insertUnorderedList"
  | "insertOrderedList"
  | "justifyLeft"
  | "justifyCenter"
  | "justifyRight"
  | "justifyFull"
  | "fontName"
  | "fontSize"
  | "foreColor"
  | "hiliteColor"
  | "increaseFontSize"
  | "decreaseFontSize"
  | "outdent"
  | "indent"
  | "removeFormat"
  | "undo"
  | "redo"
  | "formatBlock";

export type WritingPageFormat = "a4";
export type WritingNavTab = "titles" | "pages" | "results";
export type WritingRightPanelTab = "projects" | "sections" | "contexts";

export type WriterHeaderTab =
  | "file"
  | "home"
  | "insert"
  | "design"
  | "layout"
  | "references"
  | "mailings"
  | "review"
  | "view"
  | "help";

export type BackstageTab = "home" | "new" | "open" | "info" | "save" | "saveAs" | "export" | "close";

export type AnalysisStatus = "idle" | "scheduled" | "analyzing" | "error";
export type KnexWriterAnalysisSeverity = "low" | "medium" | "high";

export type KnexWriterAnalysisKind =
  | "literal_repetition"
  | "semantic_repetition"
  | "redundancy"
  | "prolixity"
  | "incoherence"
  | "contradiction"
  | "useful_recall"
  | "meaning_shift"
  | "low_argumentative_progression";

export type KnexWriterContextOccurrence = {
  id: string;
  role: "primary" | "secondary" | "tertiary" | "quaternary" | "other";
  classification: KnexWriterAnalysisKind;
  severity: KnexWriterAnalysisSeverity;
  color?: string;
  paragraphIndex?: number;
  lineStart?: number;
  lineEnd?: number;
  excerpt: string;
  suggestion?: string;
};

export type KnexWriterContextCluster = {
  id: string;
  label: string;
  summary: string;
  occurrenceCount: number;
  severity: KnexWriterAnalysisSeverity;
  occurrences: KnexWriterContextOccurrence[];
};

export type HeadingItem = {
  level: number;
  text: string;
};

export type WriterLayoutMetrics = {
  pageWidthPx: number;
  pageHeightPx: number;
  pageGapPx: number;
  pageStridePx: number;
  pagePaddingLeftPx: number;
  pagePaddingRightPx: number;
  pagePaddingTopPx: number;
  pagePaddingBottomPx: number;
  bottomClearancePx: number;
};

export type WriterPageSettings = {
  format: WritingPageFormat;
  orientation: "portrait" | "landscape";
  widthPx: number;
  heightPx: number;
  widthCm: number;
  heightCm: number;
  margins: {
    topPx: number;
    rightPx: number;
    bottomPx: number;
    leftPx: number;
  };
};

export type ImportedDocumentState = {
  fileName: string;
  fileType: string;
  fileSize: number;
  importedAt: string;
  conversionMode:
    | "plain-text"
    | "html"
    | "pdf-text-converted"
    | "docx-html-converted"
    | "legacy-doc-placeholder"
    | "unsupported";
  warning: string | null;
};

export type WriterRecentDocument = {
  id: string;
  title: string;
  subtitle?: string;
  source: "project" | "imported" | "local" | "fallback";
  updatedAt?: string;
  fileType?: string;
  previewHtml?: string;
  projectId?: string;
  sectionId?: string;
};

export type WriteEditorSessionState = {
  editorSessionId: string;
  activeProjectId: string | null;
  activeSectionId: string | null;
  loadedSections: unknown[];
  loadedChunks: unknown[];
  projectSummary: unknown;
  sectionSummary: unknown;
  currentInstruction: string;
  isSaving: boolean;
  isGenerating: boolean;
  hasUnsavedChanges: boolean;
  lastSyncedAt: string | null;
  saveError: string | null;
};

