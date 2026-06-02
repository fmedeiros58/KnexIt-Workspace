"use client";

/**
 * ============================================================================
 * TÍTULO DO ARQUIVO
 * ============================================================================
 * Produto: KnexWriter
 * Setor: App funcional / Editor inteligente de escrita assistida por IA
 * Arquivo: knexwriter/web/page.tsx
 * Rota pública esperada: /knexwriter/web
 *
 * ============================================================================
 * OBJETIVO DA PÁGINA
 * ============================================================================
 * Construir a página funcional do KnexWriter como produto independente.
 * Esta página não é landing page. Ela é o ambiente real de escrita.
 *
 * A página é organizada em módulos internos, dentro do mesmo arquivo:
 * 1. Header do produto
 * 2. Barra de projeto/documento
 * 3. Barra de formatação
 * 4. Aba lateral esquerda de navegação textual
 * 5. Palco central de escrita em formato A4
 * 6. Aba lateral direita de organização e contextos
 * 7. Footer com comando de IA
 * 8. Renderizador principal da interface
 *
 * ============================================================================
 * PRINCÍPIOS DE ARQUITETURA
 * ============================================================================
 * O KnexWriter cuida da experiência de escrita:
 * - documento
 * - projeto
 * - seção
 * - editor
 * - painéis
 * - estado visual
 * - preparação para análise textual dinâmica
 *
 * O KnexWriter não duplica o ai-system.
 * A IA continua sendo acessada por API, por meio do client local.
 *
 * Import obrigatório:
 * from "../../../web/client";
 *
 * ============================================================================
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent as ReactChangeEvent,
  type DragEvent as ReactDragEvent,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import { useEditor, type Editor } from "@tiptap/react";
import { Node as TiptapNode } from "@tiptap/core";
import {
  ArrowDownRight,
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Bot,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  ClipboardPaste,
  Download,
  Eraser,
  Eye,
  FilePlus2,
  FileText,
  FileUp,
  FolderOpen,
  Globe,
  Heading1,
  Heading2,
  Heading3,
  IndentDecrease,
  IndentIncrease,
  Info,
  Italic,
  List,
  ListOrdered,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  MoreHorizontal,
  MoreVertical,
  MessageSquare,
  Move,
  Check,
  LayoutGrid,
  SlidersHorizontal,
  Pencil,
  Pilcrow,
  Redo2,
  RefreshCw,
  Save,
  Search,
  Share2,
  Sparkles,
  Scissors,
  Strikethrough,
  Trash2,
  Type,
  Underline,
  Undo2,
  X,
} from "lucide-react";
import {
  createWriteProject,
  createWriteSection,
  getWriteProject,
  getWriteProjectGlobalSummary,
  getWriteSectionSummary,
  listWriteProjectSections,
  listWriteProjects,
  continueWrite,
  type WriteChunkView,
  type WriteProjectGlobalSummaryView,
  type WriteProjectListItem,
  type WriteSectionSummaryView,
  type WriteSectionView,
} from "../../../web/client";
import {
  cmToPx,
  getA4PageSize,
  type PageMargins,
  type ParagraphIndents,
  type RulerDragMode,
  type RulerSettings,
  type TabStop,
  type TabStopType,
} from "../ruler";
import { createKnexWriterExtensions } from "../editor/extensions";
import { KnexWriterStage } from "../editor/KnexWriterStage";
import type { KnexWriterMeasuredPagination } from "../editor/KnexWriterEditableBody";
import {
  LeftNavigationPanel,
  RightContextPanel,
} from "../panels";
import { WriterRibbon as ModularWriterRibbon } from "../ribbon/WriterRibbon";
import { OrganizationPanel } from "../organization/OrganizationPanel";
import {
  useOrganizationStore,
  type AddSourceFileInput,
  type OrganizationStoreController,
} from "../organization/organizationStore";
import type {
  InsertCitationFromSourceInput,
  LinkSelectedTextToReferenceInput,
  ProjectKind,
  SourceFileType,
} from "../organization/organizationTypes";
import { PROJECT_KIND_LABEL } from "../organization/organizationTypes";
import {
  buildReferenceAuditIssues,
  formatReference,
  getUsedReferences,
} from "../organization/references/referenceUtils";
import {
  appendCitation as appendEngineCitation,
  citationOutputToInstance as toEngineCitationInstance,
  createDocumentReferenceMemory as createEngineDocumentReferenceMemory,
  formatCitation as formatEngineCitation,
  parseManualInput as parseEngineManualInput,
  renderReference as renderEngineReference,
  upsertReference as upsertEngineReference,
  type BibliographicSource as EngineBibliographicSource,
  type DocumentReferenceMemory,
  type ReferenceStyle as EngineReferenceStyle,
} from "@/core/reference-engine";
import {
  createSourceCandidateFromFile,
  isFileSystemAccessSupported,
  requestProjectDirectoryAccess,
  requestSourceFilesAccess,
  type FileGuardSourceCandidate,
} from "../file-guard";
import {
  createKnexreadLaunch,
} from "../../../src/modules/Knexread/native-pdf-reader";

/**
 * ============================================================================
 * ESPECIFICAÇÕES AUDITÁVEIS DA PÁGINA
 * ============================================================================
 */

const PAGE_AUDIT = {
  title: "KnexWriter",
  sector: "Editor inteligente de escrita",
  productArea: "KnexSpace One",
  route: "/knexwriter/web",
  purpose: "Escrita assistida por IA com projetos, seções, paginação e análise textual futura.",
} as const;

/**
 * ============================================================================
 * TIPOS GERAIS
 * ============================================================================
 */

type WritingFormatCommand =
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
  | "textAlign"
  | "toggleBulletList"
  | "toggleOrderedList"
  | "lineHeight"
  | "paragraphSpacing"
  | "paragraphShading"
  | "paragraphBorder"
  | "clearParagraphFormatting"
  | "toggleParagraphMarks"
  | "openParagraphDialog"
  | "sortParagraphsAscending"
  | "removeFormat"
  | "undo"
  | "redo"
  | "formatBlock";

type WritingPageFormat =
  | "a4"
  | "letter"
  | "legal"
  | "oficio-9"
  | "folio"
  | "mexico-oficio"
  | "oficio-216-356"
  | "executive"
  | "envelope-10"
  | "8x10"
  | "5x7"
  | "4x6"
  | "3-5x5"
  | "a6"
  | "half-letter"
  | "11x17"
  | "a3"
  | "super-b"
  | "17x22";

type WritingNavTab = "titles" | "pages" | "results";

type WritingRightPanelTab = "projects" | "sections" | "contexts";


type WriterHeaderFooterTarget = "header" | "footer";

type WriterHeaderFooterState = {
  headerHtml: string;
  footerHtml: string;
  isEditing: boolean;
  activeTarget: WriterHeaderFooterTarget | null;
  activePageIndex: number | null;
};

type WriterCitationStyle = "abnt" | "apa";

type WriterSaveAsOptions = {
  projectKind: ProjectKind;
  citationStyle: WriterCitationStyle;
  includeOrganizationMetadata: boolean;
  includeReferenceAudit: boolean;
  profile: "knexwriter" | "standard";
};

type WriterHeaderTab =
  | "file"
  | "home"
  | "insert"
  | "design"
  | "layout"
  | "references"
  | "mailings"
  | "review"
  | "view"
  | "help"
  | "knexreadPdf";

type BackstageTab =
  | "home"
  | "new"
  | "open"
  | "info"
  | "save"
  | "saveAs"
  | "export"
  | "close";

type AnalysisStatus = "idle" | "scheduled" | "analyzing" | "error";

type KnexWriterAnalysisSeverity = "low" | "medium" | "high";

type KnexWriterAnalysisKind =
  | "literal_repetition"
  | "semantic_repetition"
  | "redundancy"
  | "prolixity"
  | "incoherence"
  | "contradiction"
  | "useful_recall"
  | "meaning_shift"
  | "low_argumentative_progression";

type KnexWriterContextOccurrence = {
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

type KnexWriterContextCluster = {
  id: string;
  label: string;
  summary: string;
  occurrenceCount: number;
  severity: KnexWriterAnalysisSeverity;
  occurrences: KnexWriterContextOccurrence[];
};

type WriteEditorSessionState = {
  editorSessionId: string;
  activeProjectId: string | null;
  activeSectionId: string | null;
  loadedSections: WriteSectionView[];
  loadedChunks: WriteChunkView[];
  projectSummary: WriteProjectGlobalSummaryView | null;
  sectionSummary: WriteSectionSummaryView | null;
  currentInstruction: string;
  isSaving: boolean;
  isGenerating: boolean;
  hasUnsavedChanges: boolean;
  lastSyncedAt: string | null;
  saveError: string | null;
};

type HeadingItem = {
  level: number;
  text: string;
};

type WriterLayoutMetrics = {
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

type WriterPageSettings = {
  format: WritingPageFormat;
  orientation: "portrait" | "landscape";
  widthPx: number;
  heightPx: number;
  widthCm: number;
  heightCm: number;
  margins: PageMargins;
  headerDistanceFromTopPx: number;
  footerDistanceFromBottomPx: number;
};

type WriterPageSetupChangeDetail = {
  margins?: {
    topCm?: number;
    rightCm?: number;
    bottomCm?: number;
    leftCm?: number;
    headerCm?: number;
    footerCm?: number;
    gutterCm?: number;
  };
  patch?: {
    paperSizeId?: string;
    orientation?: WriterPageSettings["orientation"];
    margins?: {
      topCm?: number;
      rightCm?: number;
      bottomCm?: number;
      leftCm?: number;
      headerCm?: number;
      footerCm?: number;
      gutterCm?: number;
    };
  };
  next?: {
    paperSizeId?: string;
    orientation?: WriterPageSettings["orientation"];
    margins?: {
      topCm?: number;
      rightCm?: number;
      bottomCm?: number;
      leftCm?: number;
      headerCm?: number;
      footerCm?: number;
      gutterCm?: number;
    };
  };
};

type WriterPaginationGeometry = {
  pageWidthPx: number;
  pageHeightPx: number;
  pageGapPx: number;
  pageStridePx: number;
  marginTopPx: number;
  marginRightPx: number;
  marginBottomPx: number;
  marginLeftPx: number;
  headerDistanceFromTopPx: number;
  footerDistanceFromBottomPx: number;
  headerTopPx: number;
  headerHeightPx: number;
  footerTopPx: number;
  footerHeightPx: number;
  bodyLeftPx: number;
  bodyRightPx: number;
  bodyTopPx: number;
  bodyBottomPx: number;
  bodyWidthPx: number;
  bodyHeightPx: number;
};

type RulerGuideState = {
  visible: boolean;
  xPx: number;
  label: string | null;
  mode?: RulerDragMode | "keyboard" | "page-margin" | "tab-stop";
};

const TIPTAP_DEFAULT_TAB_INTERVAL_PX = cmToPx(1.25);
const TIPTAP_MIN_TAB_WIDTH_PX = 8;
const TIPTAP_MAX_TAB_WIDTH_PX = cmToPx(8);

const WriterTabStopExtension = TiptapNode.create({
  name: "writerTabStop",

  group: "inline",
  inline: true,
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      widthPx: {
        default: TIPTAP_DEFAULT_TAB_INTERVAL_PX,
        parseHTML: (element: HTMLElement) => {
          const parsedWidth = Number(element.getAttribute("data-width-px"));

          if (!Number.isFinite(parsedWidth) || parsedWidth <= 0) {
            return TIPTAP_DEFAULT_TAB_INTERVAL_PX;
          }

          return Math.min(Math.max(parsedWidth, TIPTAP_MIN_TAB_WIDTH_PX), TIPTAP_MAX_TAB_WIDTH_PX);
        },
        renderHTML: (attributes: { widthPx?: number }) => {
          const widthPx = Math.min(
            Math.max(Number(attributes.widthPx) || TIPTAP_DEFAULT_TAB_INTERVAL_PX, TIPTAP_MIN_TAB_WIDTH_PX),
            TIPTAP_MAX_TAB_WIDTH_PX,
          );

          return {
            class: "knexwriter-tab-stop",
            "data-knexwriter-tab-stop": "true",
            "data-width-px": String(widthPx),
            style: `display:inline-block;width:${widthPx}px;height:1em;vertical-align:baseline;white-space:pre;`,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-knexwriter-tab-stop]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", HTMLAttributes, "\u00a0"];
  },
});

const WriterPageBreakExtension = TiptapNode.create({
  name: "writerPageBreak",

  group: "block",
  atom: true,
  selectable: false,

  parseHTML() {
    return [
      {
        tag: "div[data-knexwriter-page-break]",
      },
      {
        tag: "hr[data-knexwriter-page-break]",
      },
      {
        tag: "div[data-page-break]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const className = ["knexwriter-page-break", HTMLAttributes.class].filter(Boolean).join(" ");

    return [
      "div",
      {
        ...HTMLAttributes,
        class: className,
        "data-knexwriter-page-break": "true",
      },
    ];
  },
});

type ImportedDocumentConversionMode =
  | "plain-text"
  | "html"
  | "pdf-text-converted"
  | "docx-html-converted"
  | "legacy-doc-placeholder"
  | "unsupported";

type ImportedDocumentState = {
  fileName: string;
  fileType: string;
  fileSize: number;
  importedAt: string;
  conversionMode: ImportedDocumentConversionMode;
  warning: string | null;
};

type WriterRecentDocument = {
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

type BrowserFileHandle = {
  getFile: () => Promise<File>;
};

type BrowserWindowWithFilePicker = Window & {
  showOpenFilePicker?: (options?: unknown) => Promise<BrowserFileHandle[]>;
};

type PdfJsTextItem = {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
  hasEOL?: boolean;
};

type PdfJsPage = {
  getTextContent: (options?: {
    disableCombineTextItems?: boolean;
    normalizeWhitespace?: boolean;
  }) => Promise<{ items: PdfJsTextItem[] }>;
};

type PdfJsDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfJsPage>;
};

type PdfJsGlobal = {
  getDocument: (source: { data: Uint8Array; disableWorker?: boolean }) => { promise: Promise<PdfJsDocument> };
};

type MammothGlobal = {
  convertToHtml: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string; messages?: Array<{ message?: string }> }>;
};

type DocxPreviewGlobal = {
  renderAsync: (
    data: ArrayBuffer,
    bodyContainer: HTMLElement,
    styleContainer?: HTMLElement,
    options?: {
      inWrapper?: boolean;
      hideWrapperOnPrint?: boolean;
      ignoreWidth?: boolean;
      ignoreHeight?: boolean;
      breakPages?: boolean;
      className?: string;
      useBase64URL?: boolean;
      renderChanges?: boolean;
      renderComments?: boolean;
    },
  ) => Promise<unknown>;
};

let cachedPdfJsLoadPromise: Promise<PdfJsGlobal | null> | null = null;
let lastPdfJsLoadError: string | null = null;
let cachedDocxPreviewLoadPromise: Promise<DocxPreviewGlobal | null> | null = null;
let lastDocxPreviewLoadError: string | null = null;
let cachedMammothLoadPromise: Promise<MammothGlobal | null> | null = null;
let lastMammothLoadError: string | null = null;

const DOCX_PREVIEW_CDN_VERSION = "0.3.7";
const MAMMOTH_CDN_VERSION = "1.11.0";

/**
 * ============================================================================
 * CONSTANTES DE LAYOUT E ANÁLISE
 * ============================================================================
 */

const WRITING_NAV_MIN_WIDTH_PERCENT = 16;
const WRITING_NAV_MAX_WIDTH_PERCENT = 44;
const WRITING_NAV_DEFAULT_WIDTH_PERCENT = 24;

const WRITING_WORKS_MIN_WIDTH_PERCENT = 18;
const WRITING_WORKS_MAX_WIDTH_PERCENT = 44;
const WRITING_WORKS_DEFAULT_WIDTH_PERCENT = 24;
const WRITING_CANVAS_ZOOM_MIN_PERCENT = 50;
const WRITING_CANVAS_ZOOM_MAX_PERCENT = 400;
const WRITING_CANVAS_ZOOM_STEP_PERCENT = 5;
const KNEXWRITER_DOCUMENT_SETTINGS_STORAGE_KEY = "knexwriter_document_layout_settings_v1";
const KNEXWRITER_DOCUMENT_SETTINGS_SCHEMA_VERSION = 2;
const KNEXWRITER_HAS_EXPLICIT_HEADER_FOOTER_DISTANCES_KEY = "hasExplicitHeaderFooterDistances";

const WRITING_PAGE_FORMAT_PRESETS: Record<
  "a4",
  {
    widthPx: number;
    heightPx: number;
    gapPx: number;
    contentPaddingXPx: number;
    contentPaddingTopPx: number;
    contentPaddingBottomPx: number;
    bottomClearancePx: number;
  }
> = {
  a4: {
    widthPx: Math.round(getA4PageSize("portrait").widthPx),
    heightPx: Math.round(getA4PageSize("portrait").heightPx),
    gapPx: 22,
    contentPaddingXPx: cmToPx(3),
    contentPaddingTopPx: cmToPx(2.5),
    contentPaddingBottomPx: cmToPx(2.5),
    bottomClearancePx: 92,
  },
};

const WRITING_CSS_PX_PER_INCH = 96;
const WRITING_MM_PER_INCH = 25.4;
const WRITING_CM_PER_INCH = 2.54;

const WRITING_PAPER_SIZES: Record<
  WritingPageFormat,
  {
    widthMm: number;
    heightMm: number;
  }
> = {
  a4: {
    widthMm: 210,
    heightMm: 297,
  },
  letter: {
    widthMm: 215.9,
    heightMm: 279.4,
  },
  legal: {
    widthMm: 215.9,
    heightMm: 355.6,
  },
  "oficio-9": {
    widthMm: 215,
    heightMm: 315,
  },
  folio: {
    widthMm: 216,
    heightMm: 330,
  },
  "mexico-oficio": {
    widthMm: 216,
    heightMm: 341,
  },
  "oficio-216-356": {
    widthMm: 215.9,
    heightMm: 355.6,
  },
  executive: {
    widthMm: 184.2,
    heightMm: 266.7,
  },
  "envelope-10": {
    widthMm: 104.8,
    heightMm: 241.3,
  },
  "8x10": {
    widthMm: 203.2,
    heightMm: 254,
  },
  "5x7": {
    widthMm: 127,
    heightMm: 178,
  },
  "4x6": {
    widthMm: 101.6,
    heightMm: 152.4,
  },
  "3-5x5": {
    widthMm: 89,
    heightMm: 127,
  },
  a6: {
    widthMm: 105,
    heightMm: 148,
  },
  "half-letter": {
    widthMm: 139.7,
    heightMm: 215.9,
  },
  "11x17": {
    widthMm: 279.4,
    heightMm: 431.8,
  },
  a3: {
    widthMm: 297,
    heightMm: 420,
  },
  "super-b": {
    widthMm: 329,
    heightMm: 483,
  },
  "17x22": {
    widthMm: 431.8,
    heightMm: 558.8,
  },
};

const WRITING_PAPER_SIZE_ALIASES: Record<string, WritingPageFormat> = {
  oficio: "oficio-216-356",
};

function writingMmToPx(valueMm: number) {
  return (valueMm / WRITING_MM_PER_INCH) * WRITING_CSS_PX_PER_INCH;
}

function writingMmToCm(valueMm: number) {
  return valueMm / 10;
}

function normalizeWritingPageFormat(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const alias = WRITING_PAPER_SIZE_ALIASES[value];

  if (alias) {
    return alias;
  }

  return value in WRITING_PAPER_SIZES ? (value as WritingPageFormat) : null;
}

function getWritingPaperSize(
  format: WritingPageFormat,
  orientation: WriterPageSettings["orientation"],
) {
  const paper = WRITING_PAPER_SIZES[format] ?? WRITING_PAPER_SIZES.a4;
  const widthMm = orientation === "landscape" ? paper.heightMm : paper.widthMm;
  const heightMm = orientation === "landscape" ? paper.widthMm : paper.heightMm;

  return {
    widthCm: writingMmToCm(widthMm),
    heightCm: writingMmToCm(heightMm),
    widthPx: writingMmToPx(widthMm),
    heightPx: writingMmToPx(heightMm),
  };
}

/**
 * Distâncias padrão próprias de cabeçalho e rodapé.
 *
 * Importante: estes valores não são margens da página. Eles definem onde a
 * área branca/editável começa e termina na geometria do KnexWriter.
 */
const WRITING_HEADER_DISTANCE_FROM_TOP_PX = cmToPx(3);
const WRITING_FOOTER_DISTANCE_FROM_BOTTOM_PX = cmToPx(2);
const WRITING_HEADER_DEFAULT_HEIGHT_PX = cmToPx(3);
const WRITING_FOOTER_DEFAULT_HEIGHT_PX = cmToPx(2);
const WRITING_MIN_BODY_HEIGHT_PX = 72;

const DEFAULT_RULER_SETTINGS: RulerSettings = {
  unit: "cm",
  zoom: 1,
  showRuler: true,
  showMargins: true,
  showPrintableArea: true,
  showIndentMarkers: true,
  showTabStops: true,
};

const DEFAULT_TAB_STOP_INSERT_TYPE: TabStopType = "left";
const TAB_STOP_TYPE_SEQUENCE: TabStopType[] = [
  "left",
  "center",
  "right",
  "decimal",
  "bar",
];


const DEFAULT_HEADER_FOOTER_STATE: WriterHeaderFooterState = {
  headerHtml: "",
  footerHtml: "",
  isEditing: false,
  activeTarget: null,
  activePageIndex: null,
};

const ANALYSIS_KIND_LABEL: Record<KnexWriterAnalysisKind, string> = {
  literal_repetition: "Repetição literal",
  semantic_repetition: "Repetição semântica",
  redundancy: "Redundância",
  prolixity: "Prolixidade",
  incoherence: "Incoerência",
  contradiction: "Contradição",
  useful_recall: "Retomada útil",
  meaning_shift: "Deslocamento de sentido",
  low_argumentative_progression: "Baixa progressão argumentativa",
};

const OCCURRENCE_ROLE_LABEL: Record<KnexWriterContextOccurrence["role"], string> = {
  primary: "Menção primária",
  secondary: "Menção secundária",
  tertiary: "Menção terciária",
  quaternary: "Menção quaternária",
  other: "Outra ocorrência",
};

const SEVERITY_LABEL: Record<KnexWriterAnalysisSeverity, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

const SEVERITY_CLASS: Record<KnexWriterAnalysisSeverity, string> = {
  low: "border-sky-200 bg-sky-50 text-sky-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  high: "border-rose-200 bg-rose-50 text-rose-700",
};


const KNEXWRITER_ACCEPTED_FILE_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".txt",
  ".html",
  ".htm",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/html",
].join(",");

const KNEXWRITER_FILE_PICKER_OPTIONS = {
  multiple: false,
  excludeAcceptAllOption: false,
  types: [
    {
      description: "Documentos do KnexWriter",
      accept: {
        "application/pdf": [".pdf"],
        "application/msword": [".doc"],
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
        "text/plain": [".txt"],
        "text/html": [".html", ".htm"],
      },
    },
  ],
};

const KNEXWRITER_RECENT_DOCUMENTS_STORAGE_KEY = "knexwriter_recent_documents_v1";
const KNEXWRITER_MAX_RECENT_DOCUMENTS = 24;

const WRITER_HEADER_TABS: Array<{ value: WriterHeaderTab; label: string }> = [
  { value: "file", label: "Arquivo" },
  { value: "home", label: "Página Inicial" },
  { value: "insert", label: "Inserir" },
  { value: "design", label: "Design" },
  { value: "layout", label: "Layout" },
  { value: "references", label: "Referências" },
  { value: "mailings", label: "Correspondências" },
  { value: "review", label: "Revisão" },
  { value: "view", label: "Exibir" },
  { value: "knexreadPdf", label: "Knexread PDF" },
  { value: "help", label: "Ajuda" },
];

/**
 * ============================================================================
 * FUNÇÕES UTILITÁRIAS
 * ============================================================================
 */

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatRulerCentimeters(valuePx: number) {
  const centimeters = valuePx / cmToPx(1);
  return `${centimeters.toFixed(2).replace(".", ",")} cm`;
}

function getWritingPaginationGeometry(pageSettings: WriterPageSettings, layout: WriterLayoutMetrics): WriterPaginationGeometry {
  const marginLeftPx = pageSettings.margins.leftPx;
  const marginRightPx = pageSettings.margins.rightPx;
  const marginTopPx = pageSettings.margins.topPx;
  const marginBottomPx = pageSettings.margins.bottomPx;
  const pageHeightPx = Math.max(1, pageSettings.heightPx);

  /**
   * Cabeçalho e rodapé são tratados como distâncias próprias da folha,
   * e não como margem superior/inferior.
   *
   * A margem pode continuar existindo para outros fluxos, mas não deve
   * contaminar a faixa visual da régua vertical nem a área branca da página.
   */
  const rawFooterDistanceFromBottomPx = clampNumber(
    pageSettings.footerDistanceFromBottomPx,
    0,
    Math.max(0, pageHeightPx - WRITING_MIN_BODY_HEIGHT_PX),
  );

  const headerDistanceFromTopPx = clampNumber(
    pageSettings.headerDistanceFromTopPx,
    0,
    Math.max(
      0,
      pageHeightPx - rawFooterDistanceFromBottomPx - WRITING_MIN_BODY_HEIGHT_PX,
    ),
  );

  const footerDistanceFromBottomPx = clampNumber(
    rawFooterDistanceFromBottomPx,
    0,
    Math.max(
      0,
      pageHeightPx - headerDistanceFromTopPx - WRITING_MIN_BODY_HEIGHT_PX,
    ),
  );

  const headerTopPx = 0;
  const headerHeightPx = headerDistanceFromTopPx;

  const footerHeightPx = footerDistanceFromBottomPx;
  const footerTopPx = clampNumber(
    pageHeightPx - footerDistanceFromBottomPx,
    0,
    pageHeightPx,
  );

  const bodyTopPx = headerDistanceFromTopPx;
  const bodyBottomPx = footerDistanceFromBottomPx;
  const bodyHeightPx = Math.max(1, pageHeightPx - bodyTopPx - bodyBottomPx);

  return {
    pageWidthPx: pageSettings.widthPx,
    pageHeightPx,
    pageGapPx: layout.pageGapPx,
    pageStridePx: layout.pageStridePx,
    marginTopPx,
    marginRightPx,
    marginBottomPx,
    marginLeftPx,
    headerDistanceFromTopPx,
    footerDistanceFromBottomPx,
    headerTopPx,
    headerHeightPx,
    footerTopPx,
    footerHeightPx,
    bodyLeftPx: marginLeftPx,
    bodyRightPx: marginRightPx,
    bodyTopPx,
    bodyBottomPx,
    bodyWidthPx: Math.max(1, pageSettings.widthPx - marginLeftPx - marginRightPx),
    bodyHeightPx,
  };
}

function getMeasuredEditorContentHeightPx(editorElement: HTMLElement) {
  const proseMirror = editorElement.querySelector<HTMLElement>(".ProseMirror") ?? editorElement;
  const children = Array.from(proseMirror.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  );
  let measuredHeightPx = 0;

  for (const child of children) {
    if (child.dataset.knexwriterPageBreak !== "true" && !child.classList.contains("knexwriter-page-break")) {
      const rect = child.getBoundingClientRect();
      if (rect.height <= 0 && !child.textContent?.trim()) continue;
    }

    const computed = window.getComputedStyle(child);
    const marginBottomPx = Number.parseFloat(computed.marginBottom || "0") || 0;

    measuredHeightPx = Math.max(
      measuredHeightPx,
      Math.ceil(child.offsetTop + child.offsetHeight + marginBottomPx),
    );
  }

  return Math.max(0, Math.ceil(measuredHeightPx));
}

function buildAutomaticPageBreakOffsetsPx(pageCount: number, geometry: WriterPaginationGeometry) {
  return Array.from({ length: Math.max(0, pageCount - 1) }, (_unused, index) => {
    return (index + 1) * geometry.pageStridePx;
  });
}

function buildPageFillRatios(contentHeightPx: number, pageCount: number, geometry: WriterPaginationGeometry) {
  const visualContentBottomPx = geometry.bodyTopPx + Math.max(0, contentHeightPx);

  return Array.from({ length: pageCount }, (_unused, index) => {
    const pageBodyTopPx = index * geometry.pageStridePx + geometry.bodyTopPx;
    const pageBodyBottomPx = index * geometry.pageStridePx + geometry.pageHeightPx - geometry.bodyBottomPx;
    const visibleHeightPx = Math.min(pageBodyBottomPx, visualContentBottomPx) - pageBodyTopPx;

    return clampNumber(visibleHeightPx / geometry.bodyHeightPx, 0, 1);
  });
}

function createHiddenRulerGuide(): RulerGuideState {
  return {
    visible: false,
    xPx: 0,
    label: null,
  };
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function createEditorSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `editor-${crypto.randomUUID()}`;
  }

  return `editor-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function createLocalWriteProjectId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `local-project-${crypto.randomUUID()}`;
  }

  return `local-project-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderChunkTextAsHtml(text: string) {
  const normalized = text.replace(/\r\n/g, "\n").trim();

  if (!normalized) return "";

  return normalized
    .split(/\n{2,}/)
    .map((block: string) => `<p>${escapeHtml(block).replaceAll("\n", "<br/>")}</p>`)
    .join("");
}

function composeSectionHtml(section: WriteSectionView | null) {
  if (!section) return "<p></p>";

  const chunks = section.chunks || [];

  if (chunks.length) {
    const html = chunks
      .map((chunk: WriteChunkView) => renderChunkTextAsHtml(chunk.text))
      .filter(Boolean)
      .join("");

    if (html) return html;
  }

  if (section.content?.trim()) {
    const fallback = renderChunkTextAsHtml(section.content);

    if (fallback) return fallback;
  }

  return "<p></p>";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";

  const parsed = Date.parse(value);

  if (!Number.isFinite(parsed)) return "-";

  return new Date(parsed).toLocaleString("pt-BR");
}

function sanitizeFileName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function decodeBasicHtmlEntities(value: string) {
  return value
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function getTextFromHtml(html: string) {
  if (!html.trim()) return "";

  const withoutScriptsAndStyles = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ");

  const withBlockBreaks = withoutScriptsAndStyles
    .replace(/<\s*br\s*\/?\s*>/gi, " ")
    .replace(/<\/\s*(p|div|li|blockquote|h[1-6]|section|article|ul|ol)\s*>/gi, " ");

  const withoutTags = withBlockBreaks.replace(/<[^>]+>/g, " ");

  return decodeBasicHtmlEntities(withoutTags).replace(/\s+/g, " ").trim();
}

function getHeadingsFromHtml(html: string) {
  if (!html.trim()) return [] as HeadingItem[];

  const headingRegex = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  const headings: HeadingItem[] = [];
  let match: RegExpExecArray | null = headingRegex.exec(html);

  while (match) {
    const level = Number(match[1]);
    const text = getTextFromHtml(match[2] || "").replace(/\s+/g, " ").trim();

    if (text) {
      headings.push({
        level: Number.isFinite(level) ? level : 1,
        text,
      });
    }

    match = headingRegex.exec(html);
  }

  return headings;
}

function getWordCountFromHtml(html: string) {
  const text = getTextFromHtml(html);

  if (!text) return 0;

  return text.split(/\s+/).filter(Boolean).length;
}

function truncatePreview(text: string, maxLength = 260) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}


function getSummaryBody(value: unknown, fallback: string) {
  if (!value || typeof value !== "object") return fallback;

  const record = value as Record<string, unknown>;
  const candidates = [record.summary, record.text, record.content, record.body];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }

  return fallback;
}

function getFileExtension(fileName: string) {
  const normalized = fileName.trim().toLowerCase();
  const dotIndex = normalized.lastIndexOf(".");

  if (dotIndex < 0) return "";

  return normalized.slice(dotIndex + 1);
}

function getBaseFileName(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");

  if (dotIndex < 0) return fileName.trim() || "Documento importado";

  return fileName.slice(0, dotIndex).trim() || "Documento importado";
}

function isPdfFileCandidate(fileType: string | undefined, fileName: string) {
  const normalizedType = (fileType ?? "").toLowerCase();
  return normalizedType.includes("pdf") || getFileExtension(fileName) === "pdf";
}

function inferOrganizationSourceFileType(fileType: string, fileName?: string): SourceFileType {
  const normalized = `${fileType} ${fileName ?? ""}`.toLowerCase();

  if (normalized.includes("pdf")) return "pdf";
  if (normalized.includes("doc")) return "docx";
  if (normalized.includes("png") || normalized.includes("jpg") || normalized.includes("jpeg") || normalized.includes("image")) {
    return "image";
  }
  if (normalized.includes("xls") || normalized.includes("csv") || normalized.includes("sheet")) return "spreadsheet";

  return "other";
}

function createDefaultSaveAsOptions(projectKind: ProjectKind): WriterSaveAsOptions {
  return {
    projectKind,
    citationStyle: "abnt",
    includeOrganizationMetadata: true,
    includeReferenceAudit: true,
    profile: "knexwriter",
  };
}

function downloadBlob(blob: Blob, fileName: string) {
  if (typeof window === "undefined") return;

  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

function createSaveAsGuardReport(args: {
  title: string;
  activeProjectId: string | null;
  projectKind: ProjectKind;
  auditIssueCount: number;
  usedReferenceCount: number;
  sourceFileCount: number;
}) {
  const issues: Array<{ severity: "info" | "warning" | "error"; message: string }> = [];

  if (!args.activeProjectId) {
    issues.push({
      severity: "warning",
      message: "Nenhum projeto ativo. O arquivo será salvo, mas não ficará associado a um projeto filtrável.",
    });
  }

  if (!args.title.trim() || args.title.trim() === "Documento sem título") {
    issues.push({
      severity: "warning",
      message: "O documento ainda está sem título específico.",
    });
  }

  if (!args.projectKind) {
    issues.push({
      severity: "error",
      message: "Tipo de projeto ausente. Escolha o tipo antes de salvar no modelo KnexWriter.",
    });
  }

  if (args.sourceFileCount > 0 && args.usedReferenceCount === 0) {
    issues.push({
      severity: "info",
      message: "Há arquivos disponíveis, mas nenhuma referência usada. Eles não entrarão na bibliografia final.",
    });
  }

  if (args.auditIssueCount > 0) {
    issues.push({
      severity: "warning",
      message: `${args.auditIssueCount} pendência(s) de referência serão registradas no arquivo.`,
    });
  }

  return issues;
}

function buildSaveAsMetadataXml(args: {
  title: string;
  projectKind: ProjectKind;
  activeProjectId: string | null;
  activeSectionId: string | null;
  citationStyle: WriterCitationStyle;
  sourceFileCount: number;
  usedReferenceCount: number;
  auditIssueCount: number;
}) {
  return [
    "<knexwriterSaveGuard>",
    `<title>${escapeHtml(args.title)}</title>`,
    `<projectKind>${escapeHtml(args.projectKind)}</projectKind>`,
    `<projectKindLabel>${escapeHtml(PROJECT_KIND_LABEL[args.projectKind])}</projectKindLabel>`,
    `<activeProjectId>${escapeHtml(args.activeProjectId ?? "")}</activeProjectId>`,
    `<activeSectionId>${escapeHtml(args.activeSectionId ?? "")}</activeSectionId>`,
    `<citationStyle>${escapeHtml(args.citationStyle)}</citationStyle>`,
    `<sourceFileCount>${args.sourceFileCount}</sourceFileCount>`,
    `<usedReferenceCount>${args.usedReferenceCount}</usedReferenceCount>`,
    `<auditIssueCount>${args.auditIssueCount}</auditIssueCount>`,
    `<exportedAt>${new Date().toISOString()}</exportedAt>`,
    "</knexwriterSaveGuard>",
  ].join("");
}

function buildPrintableHtml(args: {
  title: string;
  bodyHtml: string;
  headerHtml?: string;
  footerHtml?: string;
  metadataHtml?: string;
}) {
  const hasHeader = Boolean(args.headerHtml?.trim());
  const hasFooter = Boolean(args.footerHtml?.trim());

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(args.title)}</title>
  <style>
    @page {
      size: A4;
      margin: 2.5cm;
    }

    body {
      font-family: Arial, Helvetica, sans-serif;
      line-height: 1.65;
      color: #18181b;
      background: #fff;
    }

    h1, h2, h3 {
      line-height: 1.25;
    }

    blockquote {
      border-left: 3px solid #a1a1aa;
      margin-left: 0;
      padding-left: 16px;
      color: #3f3f46;
    }

    .knexwriter-print-header,
    .knexwriter-print-footer {
      color: #52525b;
      font-size: 11px;
      line-height: 1.35;
    }

    .knexwriter-print-header {
      border-bottom: 1px solid #e4e4e7;
      margin-bottom: 18px;
      padding-bottom: 8px;
    }

    .knexwriter-print-footer {
      border-top: 1px solid #e4e4e7;
      margin-top: 18px;
      padding-top: 8px;
    }

    .knexwriter-print-body {
      max-width: 100%;
      overflow-wrap: break-word;
      word-break: normal;
    }

    .knexwriter-print-body img,
    .knexwriter-print-body table,
    .knexwriter-print-body figure {
      max-width: 100%;
    }

    .knexwriter-save-guard {
      break-before: page;
      margin-top: 32px;
      border-top: 1px solid #d4d4d8;
      padding-top: 16px;
      font-size: 12px;
      color: #52525b;
    }
  </style>
</head>
<body>
${hasHeader ? `<header class="knexwriter-print-header">${args.headerHtml}</header>` : ""}
<main class="knexwriter-print-body">
${args.bodyHtml}
</main>
${hasFooter ? `<footer class="knexwriter-print-footer">${args.footerHtml}</footer>` : ""}
${args.metadataHtml ?? ""}
</body>
</html>`;
}

function buildSaveAsMetadataHtml(args: {
  projectKind: ProjectKind;
  citationStyle: WriterCitationStyle;
  usedReferences: string[];
  guardIssues: Array<{ severity: "info" | "warning" | "error"; message: string }>;
}) {
  const referencesHtml = args.usedReferences.length
    ? `<ol>${args.usedReferences.map((reference) => `<li>${escapeHtml(reference)}</li>`).join("")}</ol>`
    : "<p>Nenhuma referência usada no texto.</p>";
  const issuesHtml = args.guardIssues.length
    ? `<ul>${args.guardIssues.map((issue) => `<li><strong>${escapeHtml(issue.severity)}:</strong> ${escapeHtml(issue.message)}</li>`).join("")}</ul>`
    : "<p>Nenhum guard acionado.</p>";

  return `<section class="knexwriter-save-guard">
  <h2>Metadados KnexWriter</h2>
  <p><strong>Tipo do projeto:</strong> ${escapeHtml(PROJECT_KIND_LABEL[args.projectKind])}</p>
  <p><strong>Estilo de referências:</strong> ${escapeHtml(args.citationStyle.toUpperCase())}</p>
  <h3>Bibliografia final filtrada</h3>
  ${referencesHtml}
  <h3>Guards do salvamento</h3>
  ${issuesHtml}
</section>`;
}

function createKnexWriterDocxBlob(args: {
  title: string;
  bodyText: string;
  metadataText: string;
}) {
  const paragraphs = `${args.bodyText}\n\n${args.metadataText}`
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs.map((paragraph) => `<w:p><w:r><w:t xml:space="preserve">${escapeHtml(paragraph)}</w:t></w:r></w:p>`).join("")}
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1701" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>
  </w:body>
</w:document>`;
  const coreXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeHtml(args.title)}</dc:title>
  <dc:creator>KnexWriter</dc:creator>
  <cp:lastModifiedBy>KnexWriter</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:modified>
</cp:coreProperties>`;
  const appXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>KnexWriter</Application>
</Properties>`;
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;
  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

  return new Blob(
    [
      createStoredZip([
        { name: "[Content_Types].xml", content: contentTypesXml },
        { name: "_rels/.rels", content: rootRelsXml },
        { name: "docProps/core.xml", content: coreXml },
        { name: "docProps/app.xml", content: appXml },
        { name: "word/document.xml", content: documentXml },
      ]),
    ],
    { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  );
}

function createStoredZip(files: Array<{ name: string; content: string }>) {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const crc = crc32(data);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localHeader.set(nameBytes, 30);
    localParts.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    offset += localHeader.length + data.length;
  });

  const centralOffset = offset;
  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, centralOffset, true);

  const output = new Uint8Array(centralOffset + centralSize + end.length);
  let cursor = 0;
  [...localParts, ...centralParts, end].forEach((part) => {
    output.set(part, cursor);
    cursor += part.length;
  });

  return output;
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";

  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isIgnorableDocxImportWarning(message: string) {
  const normalized = message.trim().toLowerCase();

  return (
    normalized.startsWith("unrecognised paragraph style:") ||
    normalized.startsWith("unrecognized paragraph style:") ||
    normalized.startsWith("unrecognised character style:") ||
    normalized.startsWith("unrecognized character style:")
  );
}

function normalizeTextToEditableHtml(text: string, title?: string) {
  const normalized = text.replace(/\r\n/g, "\n").trim();

  if (!normalized) {
    return title ? `<h1>${escapeHtml(title)}</h1><p></p>` : "<p></p>";
  }

  const blocks = normalized
    .split(/\n{2,}/)
    .map((block: string) => block.trim())
    .filter(Boolean)
    .map((block: string) => `<p>${escapeHtml(block).replaceAll("\n", "<br/>")}</p>`)
    .join("");

  return title ? `<h1>${escapeHtml(title)}</h1>${blocks}` : blocks;
}

function trimLeadingEmptyBlocksFromHtml(html: string) {
  const normalized = html.trim();

  if (!normalized) return "<p></p>";
  if (typeof document === "undefined") return normalized;

  const container = document.createElement("div");
  container.innerHTML = normalized;

  while (container.firstChild) {
    const node = container.firstChild;

    if (node.nodeType === 3 && !(node.textContent || "").trim()) {
      node.remove();
      continue;
    }

    if (node.nodeType !== 1) break;

    const element = node as HTMLElement;
    const text = getTextFromHtml(element.outerHTML);
    const hasRichContent = Boolean(
      element.querySelector("img,svg,table,hr,iframe,video,figure,ul,ol,blockquote,pre"),
    );

    if (!text && !hasRichContent) {
      element.remove();
      continue;
    }

    break;
  }

  const firstElement = container.firstElementChild as HTMLElement | null;
  if (firstElement) {
    firstElement.style.marginTop = "0";
    firstElement.style.paddingTop = "0";
  }

  const firstMeaningfulBlock = container.querySelector<HTMLElement>(
    "h1,h2,h3,h4,h5,h6,p,div,section,article,blockquote,ul,ol,table",
  );
  if (firstMeaningfulBlock) {
    firstMeaningfulBlock.style.marginTop = "0";
    firstMeaningfulBlock.style.paddingTop = "0";

    if (firstMeaningfulBlock.style.position === "absolute") {
      firstMeaningfulBlock.style.position = "static";
      firstMeaningfulBlock.style.top = "auto";
      firstMeaningfulBlock.style.left = "auto";
      firstMeaningfulBlock.style.transform = "none";
    }
  }

  return container.innerHTML.trim() || "<p></p>";
}

function convertCssLengthToPx(length: string | null | undefined) {
  if (!length) return null;

  const normalized = length.trim().toLowerCase();
  if (!normalized) return null;

  const match = normalized.match(/^(-?\d+(?:\.\d+)?)(px|pt|pc|in|cm|mm)?$/);
  if (!match) return null;

  const value = Number(match[1]);
  const unit = match[2] || "px";

  if (!Number.isFinite(value)) return null;

  if (unit === "px") return value;
  if (unit === "pt") return (value * 96) / 72;
  if (unit === "pc") return value * 16;
  if (unit === "in") return value * 96;
  if (unit === "cm") return (value * 96) / 2.54;
  if (unit === "mm") return (value * 96) / 25.4;

  return null;
}

function normalizeImportedLayoutOffsets(html: string) {
  const normalized = html.trim();
  if (!normalized) return "<p></p>";
  if (typeof document === "undefined") return normalized;

  const container = document.createElement("div");
  container.innerHTML = normalized;

  const styledNodes = Array.from(container.querySelectorAll<HTMLElement>("[style]"));
  for (const element of styledNodes) {
    const style = element.style;

    if (style.position === "absolute" || style.position === "fixed") {
      style.position = "static";
      style.top = "auto";
      style.right = "auto";
      style.bottom = "auto";
      style.left = "auto";
      if (style.transform.includes("translate")) {
        style.transform = "none";
      }
    }

    const marginTopPx = convertCssLengthToPx(style.marginTop);
    if (marginTopPx !== null && Math.abs(marginTopPx) > 96) {
      style.marginTop = "0px";
    }

    const paddingTopPx = convertCssLengthToPx(style.paddingTop);
    if (paddingTopPx !== null && Math.abs(paddingTopPx) > 120) {
      style.paddingTop = "0px";
    }
  }

  return trimLeadingEmptyBlocksFromHtml(container.innerHTML);
}

/**
 * Normaliza layout imported mas PRESERVA formatação de texto como:
 * font-size, font-family, color, text-align, font-weight, font-style, etc.
 * Apenas remove deslocamentos extremos que quebram a experiência de edição.
 */
function normalizeImportedLayoutOffsetsCarefully(html: string) {
  const normalized = html.trim();
  if (!normalized) return "<p></p>";
  if (typeof document === "undefined") return normalized;

  const container = document.createElement("div");
  container.innerHTML = normalized;

  const styledNodes = Array.from(container.querySelectorAll<HTMLElement>("[style]"));
  for (const element of styledNodes) {
    const style = element.style;

    // Remover apenas deslocamentos absolutos/fixos que quebram o layout
    if (style.position === "absolute" || style.position === "fixed") {
      style.position = "static";
      style.top = "auto";
      style.right = "auto";
      style.bottom = "auto";
      style.left = "auto";
      if (style.transform && style.transform.includes("translate")) {
        style.transform = "none";
      }
    }

    // Remover apenas margens/padding extremamente grandes
    const marginTopPx = convertCssLengthToPx(style.marginTop);
    if (marginTopPx !== null && Math.abs(marginTopPx) > 96) {
      style.marginTop = "0px";
    }

    const paddingTopPx = convertCssLengthToPx(style.paddingTop);
    if (paddingTopPx !== null && Math.abs(paddingTopPx) > 120) {
      style.paddingTop = "0px";
    }

    // PRESERVAR: font-size, font-family, color, text-align, font-weight, 
    // font-style, line-height, text-decoration, letter-spacing, etc.
    // Estas são propriedades essenciais da formatação do documento
  }

  return trimLeadingEmptyBlocksFromHtml(container.innerHTML);
}

function normalizeDocxPreviewFragmentForEditing(root: HTMLElement) {
  root.querySelectorAll("style,script,meta,link,head,title").forEach((node) => node.remove());

  const elements = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];

  for (const element of elements) {
    const style = element.style;

    if (style.position === "absolute" || style.position === "fixed") {
      style.position = "static";
      style.top = "auto";
      style.right = "auto";
      style.bottom = "auto";
      style.left = "auto";
      if (style.transform.includes("translate")) {
        style.transform = "none";
      }
    }

    const fontSizePx = convertCssLengthToPx(style.fontSize);
    if (fontSizePx !== null) {
      style.fontSize = `${clampNumber(fontSizePx, 7, 72)}px`;
    }

    const textIndentPx = convertCssLengthToPx(style.textIndent);
    if (textIndentPx !== null) {
      style.textIndent = `${clampNumber(textIndentPx, -160, 240)}px`;
    }

    const marginTopPx = convertCssLengthToPx(style.marginTop);
    if (marginTopPx !== null && Math.abs(marginTopPx) > 96) {
      style.marginTop = "0px";
    }

    const paddingTopPx = convertCssLengthToPx(style.paddingTop);
    if (paddingTopPx !== null && Math.abs(paddingTopPx) > 120) {
      style.paddingTop = "0px";
    }

    if (style.textAlign === "start") {
      style.textAlign = "left";
    } else if (style.textAlign === "end") {
      style.textAlign = "right";
    }

    const className = element.className.toString();
    if (className.includes("docx-page") || className.includes("docx-wrapper")) {
      style.width = "";
      style.height = "";
      style.minHeight = "";
      style.padding = "";
      style.boxShadow = "";
      style.background = "";
    }
  }
}

function inlineDocxPreviewComputedStyles(root: HTMLElement) {
  if (typeof window === "undefined") return;

  const editableSelector = "p,span,div,h1,h2,h3,h4,h5,h6,li,td,th,blockquote,strong,em,u,sup,sub";
  const elements = Array.from(root.querySelectorAll<HTMLElement>(editableSelector));

  for (const element of elements) {
    const computed = window.getComputedStyle(element);
    const style = element.style;
    const tagName = element.tagName.toLowerCase();
    const isBlockElement = ["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "td", "th", "blockquote"].includes(
      tagName,
    );

    if (computed.fontFamily) style.fontFamily = computed.fontFamily;
    if (computed.fontSize) style.fontSize = computed.fontSize;
    if (computed.fontWeight && computed.fontWeight !== "400") style.fontWeight = computed.fontWeight;
    if (computed.fontStyle && computed.fontStyle !== "normal") style.fontStyle = computed.fontStyle;
    if (computed.color) style.color = computed.color;
    if (computed.textDecorationLine && computed.textDecorationLine !== "none") {
      style.textDecoration = computed.textDecorationLine;
    }
    if (computed.verticalAlign && computed.verticalAlign !== "baseline") {
      style.verticalAlign = computed.verticalAlign;
    }
    if (computed.backgroundColor && !["rgba(0, 0, 0, 0)", "transparent"].includes(computed.backgroundColor)) {
      style.backgroundColor = computed.backgroundColor;
    }

    if (!isBlockElement) continue;

    if (computed.textAlign && computed.textAlign !== "start") style.textAlign = computed.textAlign;
    if (computed.lineHeight && computed.lineHeight !== "normal") style.lineHeight = computed.lineHeight;
    if (computed.textIndent && computed.textIndent !== "0px") style.textIndent = computed.textIndent;
    if (computed.marginTop && computed.marginTop !== "0px") style.marginTop = computed.marginTop;
    if (computed.marginBottom && computed.marginBottom !== "0px") style.marginBottom = computed.marginBottom;
    if (computed.marginLeft && computed.marginLeft !== "0px") style.marginLeft = computed.marginLeft;
    if (computed.marginRight && computed.marginRight !== "0px") style.marginRight = computed.marginRight;
  }
}

function extractDocxPreviewEditableHtml(renderedHtml: string, title: string) {
  const normalized = renderedHtml.trim();

  if (!normalized) {
    return normalizeTextToEditableHtml("", title);
  }

  if (typeof document === "undefined") {
    return normalized;
  }

  const root = document.createElement("div");
  root.innerHTML = normalized;
  root.querySelectorAll("style,script,meta,link,head,title").forEach((node) => node.remove());
  
  // Detectar páginas/seções. docx-preview pode gerar de várias formas:
  // - divs com classe "docx-page"
  // - divs com estilos de página
  // - seções
  const pageLikeNodes = Array.from(
    root.querySelectorAll<HTMLElement>(
      "[class*='docx-page'], [class*='docx_section'], [class*='page-break'], div[style*='page-break'], div[style*='break-after'], section[class*='docx']",
    ),
  );

  let sourceNodes: HTMLElement[] = [];

  // Se encontramos elementos de página, usá-los como separadores
  if (pageLikeNodes.length > 0) {
    sourceNodes = pageLikeNodes;
  } else {
    // Caso contrário, usar todos os children como páginas
    sourceNodes = Array.from(root.children) as HTMLElement[];
  }

  // Se não tem múltiplas páginas, usar todo o conteúdo como uma
  if (sourceNodes.length <= 1) {
    sourceNodes = [root];
  }

  const fragments: string[] = [];

  sourceNodes.forEach((sourceNode) => {
    const clone = sourceNode.cloneNode(true) as HTMLElement;

    // Remover apenas headers/footers, não estilos
    clone.querySelectorAll(".docx-header, .docx-footer, header, footer").forEach((node) => node.remove());
    clone.querySelectorAll("[style*='position: fixed']").forEach((node) => node.remove());
    normalizeDocxPreviewFragmentForEditing(clone);

    const html = clone.innerHTML.trim();
    if (!html) return;
    fragments.push(html);
  });

  // Se não temos fragmentos, tomar o HTML inteiro
  if (fragments.length === 0) {
    fragments.push(root.innerHTML);
  }

  const pageBreakStyle = '<div data-knexwriter-page-break="true"></div>';
  const combined = fragments.join(pageBreakStyle).trim();

  if (!combined) {
    return normalizeTextToEditableHtml("", title);
  }

  // Normalizar apenas deslocamentos extremos de layout, não remover formatação
  return normalizeImportedLayoutOffsetsCarefully(combined);
}

function getMedianValue(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function convertPdfItemsToPageText(items: PdfJsTextItem[]) {
  const tokens = items
    .map((item) => {
      const rawText = item.str || "";
      const text = rawText.replace(/\u0000/g, "").trim();
      if (!text) return null;

      const transform = Array.isArray(item.transform) ? item.transform : null;
      const x = transform && Number.isFinite(transform[4]) ? Number(transform[4]) : 0;
      const y = transform && Number.isFinite(transform[5]) ? Number(transform[5]) : 0;
      const transformHeight =
        transform && Number.isFinite(transform[3]) ? Math.abs(Number(transform[3])) : 0;
      const declaredHeight = Number.isFinite(item.height) ? Math.abs(Number(item.height)) : 0;
      const height = Math.max(6, declaredHeight || transformHeight || 10);
      const declaredWidth = Number.isFinite(item.width) ? Math.abs(Number(item.width)) : 0;
      const width = Math.max(4, declaredWidth || text.length * Math.max(4, height * 0.45));

      return {
        text,
        x,
        y,
        width,
        height,
        hasEOL: Boolean(item.hasEOL),
      };
    })
    .filter(
      (
        token,
      ): token is {
        text: string;
        x: number;
        y: number;
        width: number;
        height: number;
        hasEOL: boolean;
      } => Boolean(token),
    );

  if (!tokens.length) return "";

  const medianHeight = getMedianValue(tokens.map((token) => token.height)) || 10;
  const lineTolerance = Math.max(2, medianHeight * 0.55);

  const sorted = [...tokens].sort((left, right) => {
    const yDiff = Math.abs(right.y - left.y);
    if (yDiff > lineTolerance) return right.y - left.y;
    return left.x - right.x;
  });

  const groupedLines: Array<{ y: number; tokens: typeof tokens }> = [];

  for (const token of sorted) {
    const current = groupedLines[groupedLines.length - 1];

    if (!current || Math.abs(token.y - current.y) > lineTolerance) {
      groupedLines.push({ y: token.y, tokens: [token] });
      continue;
    }

    current.tokens.push(token);
    current.y = (current.y * (current.tokens.length - 1) + token.y) / current.tokens.length;
  }

  const lines: string[] = [];

  for (const line of groupedLines) {
    const lineTokens = [...line.tokens].sort((left, right) => left.x - right.x);
    let lineText = "";
    let previousEndX: number | null = null;
    let previousHasEOL = false;

    for (const token of lineTokens) {
      if (lineText) {
        const gap = previousEndX === null ? 0 : token.x - previousEndX;
        if (previousHasEOL) {
          lineText += " ";
        } else if (gap > Math.max(token.height * 2.3, 18)) {
          lineText += "   ";
        } else if (gap > Math.max(token.height * 1.1, 8)) {
          lineText += " ";
        } else if (!/[\s-]$/.test(lineText) && !/^[,.;:!?)]/.test(token.text)) {
          lineText += " ";
        }
      }

      lineText += token.text;
      previousEndX = token.x + token.width;
      previousHasEOL = token.hasEOL;
    }

    const cleanedLine = lineText.replace(/\s+/g, " ").trim();
    if (cleanedLine) {
      lines.push(cleanedLine);
    }
  }

  return lines.join("\n");
}

function getPdfJsGlobal() {
  if (typeof window === "undefined") return null;

  const candidate = (window as unknown as { pdfjsLib?: unknown }).pdfjsLib;

  if (!candidate || typeof candidate !== "object") return null;

  const pdfjs = candidate as Partial<PdfJsGlobal>;

  return typeof pdfjs.getDocument === "function" ? (pdfjs as PdfJsGlobal) : null;
}

function loadScript(url: string) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve(false);
  }

  const existing = Array.from(document.querySelectorAll("script")).find(
    (node) => node.getAttribute("src") === url,
  ) as HTMLScriptElement | undefined;

  if (existing?.dataset.loaded === "true") {
    return Promise.resolve(true);
  }

  return new Promise<boolean>((resolve) => {
    const script = existing || document.createElement("script");

    if (!existing) {
      script.src = url;
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      document.head.appendChild(script);
    }

    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve(true);
      },
      { once: true },
    );

    script.addEventListener(
      "error",
      () => {
        resolve(false);
      },
      { once: true },
    );
  });
}

async function loadPdfJsGlobal() {
  const existing = getPdfJsGlobal();
  if (existing) return existing;

  if (typeof window === "undefined") return null;
  if (cachedPdfJsLoadPromise) return cachedPdfJsLoadPromise;

  cachedPdfJsLoadPromise = (async () => {
    const errors: string[] = [];

    try {
      const pdfModule = (await import("pdfjs-dist/build/pdf.mjs")) as unknown as Partial<PdfJsGlobal>;
      if (typeof pdfModule.getDocument === "function") {
        const runtime = pdfModule as PdfJsGlobal;
        (window as unknown as { pdfjsLib?: PdfJsGlobal }).pdfjsLib = runtime;
        lastPdfJsLoadError = null;
        return runtime;
      }
      errors.push("build/pdf.mjs sem getDocument");
    } catch (error: unknown) {
      errors.push(`build/pdf.mjs: ${error instanceof Error ? error.message : "erro desconhecido"}`);
    }

    try {
      const pdfModule = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as Partial<PdfJsGlobal>;
      if (typeof pdfModule.getDocument === "function") {
        const runtime = pdfModule as PdfJsGlobal;
        (window as unknown as { pdfjsLib?: PdfJsGlobal }).pdfjsLib = runtime;
        lastPdfJsLoadError = null;
        return runtime;
      }
      errors.push("legacy/build/pdf.mjs sem getDocument");
    } catch (error: unknown) {
      errors.push(`legacy/build/pdf.mjs: ${error instanceof Error ? error.message : "erro desconhecido"}`);
    }

    const loadedByCdn = await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js");
    if (loadedByCdn) {
      const globalPdfJs = getPdfJsGlobal();
      if (globalPdfJs) {
        lastPdfJsLoadError = null;
        return globalPdfJs;
      }
      errors.push("CDN carregou, mas window.pdfjsLib não ficou disponível");
    } else {
      errors.push("falha ao carregar script CDN");
    }

    lastPdfJsLoadError = errors.join(" | ");
    return null;
  })();

  const runtime = await cachedPdfJsLoadPromise;
  if (!runtime) {
    cachedPdfJsLoadPromise = null;
  }
  return runtime;
}

function getDocxPreviewGlobal() {
  if (typeof window === "undefined") return null;

  const maybeGlobals = (window as unknown as { docxPreview?: unknown; docx?: unknown });
  const candidates: unknown[] = [maybeGlobals.docxPreview, maybeGlobals.docx];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") {
      continue;
    }

    const runtime = candidate as Partial<DocxPreviewGlobal>;
    if (typeof runtime.renderAsync === "function") {
      return runtime as DocxPreviewGlobal;
    }

    const runtimeDefault = (candidate as { default?: Partial<DocxPreviewGlobal> }).default;
    if (runtimeDefault && typeof runtimeDefault.renderAsync === "function") {
      return runtimeDefault as DocxPreviewGlobal;
    }
  }

  return null;
}

async function loadDocxPreviewGlobal() {
  const existing = getDocxPreviewGlobal();
  if (existing) return existing;
  if (typeof window === "undefined") return null;
  if (cachedDocxPreviewLoadPromise) return cachedDocxPreviewLoadPromise;

  cachedDocxPreviewLoadPromise = (async () => {
    const errors: string[] = [];
    const resolveRuntimeFromModule = (loadedModule: unknown): DocxPreviewGlobal | null => {
      if (
        loadedModule &&
        typeof loadedModule === "object" &&
        typeof (loadedModule as Partial<DocxPreviewGlobal>).renderAsync === "function"
      ) {
        return loadedModule as DocxPreviewGlobal;
      }

      const maybeDefault = (loadedModule as { default?: Partial<DocxPreviewGlobal> })?.default;
      if (maybeDefault && typeof maybeDefault.renderAsync === "function") {
        return maybeDefault as DocxPreviewGlobal;
      }

      return null;
    };

    try {
      const loadedModule = (await import("docx-preview")) as unknown;
      const runtime = resolveRuntimeFromModule(loadedModule);
      if (runtime) {
        (window as unknown as { docxPreview?: DocxPreviewGlobal }).docxPreview = runtime;
        lastDocxPreviewLoadError = null;
        return runtime;
      }
      errors.push("docx-preview carregado sem renderAsync");
    } catch (error: unknown) {
      errors.push(`docx-preview: ${error instanceof Error ? error.message : "erro desconhecido"}`);
    }

    const cdnScriptCandidates = [
      `https://cdn.jsdelivr.net/npm/docx-preview@${DOCX_PREVIEW_CDN_VERSION}/dist/docx-preview.min.js`,
      `https://cdn.jsdelivr.net/npm/docx-preview@${DOCX_PREVIEW_CDN_VERSION}/dist/docx-preview.js`,
    ];

    for (const scriptUrl of cdnScriptCandidates) {
      const loadedByCdnScript = await loadScript(scriptUrl);
      if (!loadedByCdnScript) {
        errors.push(`falha ao carregar script CDN ${scriptUrl}`);
        continue;
      }

      const runtime = getDocxPreviewGlobal();
      if (runtime) {
        (window as unknown as { docxPreview?: DocxPreviewGlobal }).docxPreview = runtime;
        lastDocxPreviewLoadError = null;
        return runtime;
      }

      errors.push(`${scriptUrl} carregado, mas docx-preview global não ficou disponível`);
    }

    lastDocxPreviewLoadError = errors.join(" | ");
    return null;
  })();

  const runtime = await cachedDocxPreviewLoadPromise;
  if (!runtime) {
    cachedDocxPreviewLoadPromise = null;
  }
  return runtime;
}

function getMammothGlobal() {
  if (typeof window === "undefined") return null;

  const candidate = (window as unknown as { mammoth?: unknown }).mammoth;

  if (!candidate || typeof candidate !== "object") return null;

  const mammoth = candidate as Partial<MammothGlobal>;

  return typeof mammoth.convertToHtml === "function" ? (mammoth as MammothGlobal) : null;
}

async function loadMammothGlobal() {
  const existing = getMammothGlobal();
  if (existing) return existing;
  if (typeof window === "undefined") return null;
  if (cachedMammothLoadPromise) return cachedMammothLoadPromise;

  cachedMammothLoadPromise = (async () => {
    const errors: string[] = [];

    try {
      const loadedModule = (await import("mammoth/mammoth.browser.min.js")) as unknown;
      const runtime =
        typeof (loadedModule as any)?.default?.convertToHtml === "function"
          ? (loadedModule as any).default
          : typeof (loadedModule as Partial<MammothGlobal>).convertToHtml === "function"
          ? (loadedModule as MammothGlobal)
          : null;

      if (runtime) {
        (window as unknown as { mammoth?: MammothGlobal }).mammoth = runtime;
        lastMammothLoadError = null;
        return runtime;
      }

      errors.push("mammoth.browser.min.js carregado sem convertToHtml");
    } catch (error: unknown) {
      errors.push(
        `mammoth.browser.min.js: ${error instanceof Error ? error.message : "erro desconhecido"}`,
      );
    }

    const cdnUrl = `https://cdn.jsdelivr.net/npm/mammoth@${MAMMOTH_CDN_VERSION}/dist/mammoth.browser.min.js`;
    const loadedByCdn = await loadScript(cdnUrl);
    if (loadedByCdn) {
      const globalMammoth = getMammothGlobal();
      if (globalMammoth) {
        lastMammothLoadError = null;
        return globalMammoth;
      }
      errors.push("CDN carregou, mas window.mammoth não ficou disponível");
    } else {
      errors.push("falha ao carregar mammoth CDN");
    }

    lastMammothLoadError = errors.join(" | ");
    return null;
  })();

  const runtime = await cachedMammothLoadPromise;
  if (!runtime) {
    cachedMammothLoadPromise = null;
  }
  return runtime;
}

async function convertPdfToEditableHtml(file: File) {
  const pdfjs = await loadPdfJsGlobal();

  if (!pdfjs) {
    const detail =
      lastPdfJsLoadError && lastPdfJsLoadError.trim()
        ? ` Detalhe técnico: ${lastPdfJsLoadError.slice(0, 360)}.`
        : "";

    return {
      html: normalizeTextToEditableHtml(
        [
          `Arquivo PDF selecionado: ${file.name}.`,
          "A página está pronta para converter PDF em documento editável, mas o conversor PDF ainda não foi carregado no navegador.",
          "Para conversão completa, registre window.pdfjsLib por meio de pdfjs-dist ou encaminhe este arquivo para um endpoint de conversão no backend.",
          detail.trim(),
        ].join("\n\n"),
        getBaseFileName(file.name),
      ),
      warning:
        `PDF selecionado. Para extrair e renderizar todo o conteúdo, carregue pdfjsLib no cliente ou use um endpoint server-side de conversão.${detail}`,
    };
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdfDocument = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer), disableWorker: true }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    const page = await pdfDocument.getPage(pageNumber);
    const content = await page.getTextContent({
      disableCombineTextItems: false,
      normalizeWhitespace: false,
    });
    const pageText = convertPdfItemsToPageText(content.items);

    pages.push(pageText ? `Página ${pageNumber}\n${pageText}` : `Página ${pageNumber}`);
  }

  const pageHtml = pages.map((pageText) => renderChunkTextAsHtml(pageText)).filter(Boolean).join(
    '<div data-knexwriter-page-break="true"></div>',
  );

  return {
    html: pageHtml || normalizeTextToEditableHtml("", getBaseFileName(file.name)),
    warning: null,
  };
}
async function convertDocxToEditableHtml(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const title = getBaseFileName(file.name);

  const docxPreview = await loadDocxPreviewGlobal();
  let docxPreviewError: string | null = null;

  if (docxPreview && typeof document !== "undefined") {
    try {
      const bodyContainer = document.createElement("div");
      const styleContainer = document.createElement("div");

      // Request docx-preview to render with page breaks and respect original
      // page sizing so we can extract per-page fragments. Previously the
      // renderer ignored width/height and disabled page breaks which flattened
      // the document into a single linear flow.
      await docxPreview.renderAsync(arrayBuffer, bodyContainer, styleContainer, {
        className: "knexwriter-docx-import",
        inWrapper: true,
        hideWrapperOnPrint: false,
        // Preserve width/height so renderer emits page wrappers/sections
        // when breakPages is enabled.
        ignoreWidth: false,
        ignoreHeight: false,
        breakPages: true,
        renderChanges: false,
        renderComments: false,
      });

      const previewHost = document.createElement("div");
      previewHost.setAttribute("aria-hidden", "true");
      previewHost.style.position = "fixed";
      previewHost.style.left = "-100000px";
      previewHost.style.top = "0";
      previewHost.style.width = "1px";
      previewHost.style.height = "1px";
      previewHost.style.overflow = "hidden";
      previewHost.style.pointerEvents = "none";

      previewHost.appendChild(styleContainer);
      previewHost.appendChild(bodyContainer);
      document.body.appendChild(previewHost);

      try {
        inlineDocxPreviewComputedStyles(bodyContainer);

        return {
          html: extractDocxPreviewEditableHtml(bodyContainer.innerHTML, title),
          warning: null,
        };
      } finally {
        previewHost.remove();
      }
    } catch (error: unknown) {
      docxPreviewError = error instanceof Error ? error.message : "erro desconhecido";
    }
  }

  const mammoth = await loadMammothGlobal();
  let mammothError: string | null = null;

  if (mammoth) {
    try {
      const result = await mammoth.convertToHtml({ arrayBuffer });
      const warnings = result.messages
        ?.map((message) => message.message)
        .filter((message): message is string => Boolean(message?.trim()))
        .filter((message) => !isIgnorableDocxImportWarning(message));

      return {
        html: normalizeImportedLayoutOffsets(
          result.value?.trim() ? result.value : normalizeTextToEditableHtml("", title),
        ),
        warning:
          docxPreviewError
            ? "DOCX aberto com renderização alternativa. A fidelidade visual pode variar."
            : warnings?.length
            ? warnings.join(" ")
            : null,
      };
    } catch (error: unknown) {
      mammothError = error instanceof Error ? error.message : "erro desconhecido";
    }
  }

  const docxDetail = docxPreviewError || lastDocxPreviewLoadError;
  const mammothDetail = mammothError || lastMammothLoadError;
  const detailParts = [docxDetail, mammothDetail].filter(
    (part): part is string => Boolean(part && part.trim()),
  );
  const detail = detailParts.length ? ` Detalhe técnico: ${detailParts.join(" | ").slice(0, 360)}.` : "";

  return {
    html: normalizeTextToEditableHtml(
      [
        `Arquivo DOCX selecionado: ${file.name}.`,
        "A página está pronta para renderizar DOCX completo, mas o conversor DOCX ainda não foi carregado no navegador.",
        "Para conversão completa, use docx-preview ou mammoth no cliente, ou um endpoint server-side de conversão.",
      ].join("\n\n"),
      title,
    ),
    warning: `DOCX selecionado. Não foi possível carregar o conversor local.${detail}`,
  };
}

async function convertImportedFileToEditableHtml(file: File): Promise<{
  html: string;
  conversionMode: ImportedDocumentConversionMode;
  warning: string | null;
}> {
  const extension = getFileExtension(file.name);

  if (extension === "txt") {
    const text = await file.text();

    return {
      html: normalizeTextToEditableHtml(text, getBaseFileName(file.name)),
      conversionMode: "plain-text",
      warning: null,
    };
  }

  if (extension === "html" || extension === "htm") {
    const html = await file.text();

    return {
      html: html.trim() || normalizeTextToEditableHtml("", getBaseFileName(file.name)),
      conversionMode: "html",
      warning: null,
    };
  }

  if (extension === "pdf") {
    const converted = await convertPdfToEditableHtml(file);

    return {
      html: converted.html,
      conversionMode: "pdf-text-converted",
      warning: converted.warning,
    };
  }

  if (extension === "docx") {
    const converted = await convertDocxToEditableHtml(file);

    return {
      html: converted.html,
      conversionMode: "docx-html-converted",
      warning: converted.warning,
    };
  }

  if (extension === "doc") {
    return {
      html: normalizeTextToEditableHtml(
        [
          `Arquivo DOC selecionado: ${file.name}.`,
          "O formato .doc antigo não possui leitura nativa segura no navegador.",
          "Para renderização completa, converta para .docx antes de importar ou encaminhe o arquivo para um endpoint backend com LibreOffice, Pandoc ou serviço equivalente.",
        ].join("\n\n"),
        getBaseFileName(file.name),
      ),
      conversionMode: "legacy-doc-placeholder",
      warning:
        "DOC antigo selecionado. Para renderização completa, converta para DOCX ou use um conversor server-side.",
    };
  }

  return {
    html: normalizeTextToEditableHtml(
      [
        `Arquivo selecionado: ${file.name}.`,
        "Formato ainda não suportado para renderização completa no palco.",
      ].join("\n\n"),
      getBaseFileName(file.name),
    ),
    conversionMode: "unsupported",
    warning: "Formato não suportado para importação completa.",
  };
}

/**
 * ============================================================================
 * COMPONENTE PRINCIPAL DA PÁGINA
 * ============================================================================
 * Este componente concentra estado, efeitos e integração com API.
 * A renderização visual fica abaixo, em KnexWriterRender.
 */

type KnexreadOpenRequest = {
  file: File;
  projectId: string;
  documentId?: string;
  sourceId?: string;
  sourceName?: string;
};

export function KnexWriterShell() {
  const writingPageFormat = "a4" as const;
  const writingPagePreset = WRITING_PAGE_FORMAT_PRESETS[writingPageFormat];

  const [writeProjects, setWriteProjects] = useState<WriteProjectListItem[]>([]);
  const [writeSession, setWriteSession] = useState<WriteEditorSessionState>({
    editorSessionId: createEditorSessionId(),
    activeProjectId: null,
    activeSectionId: null,
    loadedSections: [],
    loadedChunks: [],
    projectSummary: null,
    sectionSummary: null,
    currentInstruction: "",
    isSaving: false,
    isGenerating: false,
    hasUnsavedChanges: false,
    lastSyncedAt: null,
    saveError: null,
  });

  const [writingTitle, setWritingTitle] = useState("Documento sem título");
  const [writingPrompt, setWritingPrompt] = useState("");
  const [writingStatus, setWritingStatus] = useState<"idle" | "thinking" | "error">("idle");
  const [writingError, setWritingError] = useState<string | null>(null);
  const [writingNotice, setWritingNotice] = useState<string | null>(null);

  const [isWritingNavCollapsed, setIsWritingNavCollapsed] = useState(true);
  const [writingNavWidthPercent, setWritingNavWidthPercent] = useState(WRITING_NAV_DEFAULT_WIDTH_PERCENT);
  const [writingNavTab, setWritingNavTab] = useState<WritingNavTab>("titles");
  const [writingNavQuery, setWritingNavQuery] = useState("");

  const [isWritingWorksCollapsed, setIsWritingWorksCollapsed] = useState(true);
  const [writingWorksWidthPercent, setWritingWorksWidthPercent] = useState(WRITING_WORKS_DEFAULT_WIDTH_PERCENT);
  const [writingWorksQuery, setWritingWorksQuery] = useState("");
  const [writingRightPanelTab, setWritingRightPanelTab] = useState<WritingRightPanelTab>("projects");
  const [writingCanvasZoomPercent, setWritingCanvasZoomPercent] = useState(106);
  const [pageSettings, setPageSettings] = useState<WriterPageSettings>(() => {
    const pageSize = getWritingPaperSize("a4", "portrait");

    return {
      format: "a4",
      orientation: "portrait",
      widthCm: pageSize.widthCm,
      heightCm: pageSize.heightCm,
      widthPx: pageSize.widthPx,
      heightPx: pageSize.heightPx,
      margins: {
        topPx: cmToPx(2.5),
        rightPx: cmToPx(2.5),
        bottomPx: cmToPx(2.5),
        leftPx: cmToPx(3),
      },
      headerDistanceFromTopPx: WRITING_HEADER_DISTANCE_FROM_TOP_PX,
      footerDistanceFromBottomPx: WRITING_FOOTER_DISTANCE_FROM_BOTTOM_PX,
    };
  });
  const [paragraphIndents, setParagraphIndents] = useState<ParagraphIndents>({
    leftPx: 0,
    rightPx: 0,
    firstLinePx: cmToPx(1.25),
    hangingPx: 0,
  });
  const [tabStops, setTabStops] = useState<TabStop[]>([]);
  const [tabStopInsertType, setTabStopInsertType] = useState<TabStopType>(
    DEFAULT_TAB_STOP_INSERT_TYPE,
  );
  const [rulerSettings, setRulerSettings] = useState<RulerSettings>(DEFAULT_RULER_SETTINGS);
  const [activeHeaderTab, setActiveHeaderTab] = useState<WriterHeaderTab>("home");
  const [isFileBackstageOpen, setIsFileBackstageOpen] = useState(false);
  const [activeBackstageTab, setActiveBackstageTab] = useState<BackstageTab>("home");
  const [pendingViewportReset, setPendingViewportReset] = useState(false);
  const [backstageSearchQuery, setBackstageSearchQuery] = useState("");
  const [recentDocuments, setRecentDocuments] = useState<WriterRecentDocument[]>([]);
  const layoutMetrics: WriterLayoutMetrics = {
    pageWidthPx: pageSettings.widthPx,
    pageHeightPx: pageSettings.heightPx,
    pageGapPx: writingPagePreset.gapPx,
    pageStridePx: pageSettings.heightPx + writingPagePreset.gapPx,
    pagePaddingLeftPx: pageSettings.margins.leftPx,
    pagePaddingRightPx: pageSettings.margins.rightPx,
    pagePaddingTopPx: pageSettings.headerDistanceFromTopPx,
    pagePaddingBottomPx: pageSettings.footerDistanceFromBottomPx,
    bottomClearancePx: writingPagePreset.bottomClearancePx,
  };

  const writingPaginationGeometry = getWritingPaginationGeometry(pageSettings, layoutMetrics);

  const [contextClusters, setContextClusters] = useState<KnexWriterContextCluster[]>([]);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>("idle");
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [importedDocument, setImportedDocument] = useState<ImportedDocumentState | null>(null);
  const [isImportingDocument, setIsImportingDocument] = useState(false);
  const organization = useOrganizationStore();
  const router = useRouter();

  const [writingDraftHtml, setWritingDraftHtml] = useState(
    "<h1></h1><p></p>",
  );
  const [headerFooter, setHeaderFooter] =
    useState<WriterHeaderFooterState>(DEFAULT_HEADER_FOOTER_STATE);

  const [editorDocumentVersion, setEditorDocumentVersion] = useState(0);
  const [writingPageCount, setWritingPageCount] = useState(1);
  const [writingActivePage, setWritingActivePage] = useState(1);
  const [writingPageBreakOffsets, setWritingPageBreakOffsets] = useState<number[]>([]);
  const [writingPageFillRatios, setWritingPageFillRatios] = useState<number[]>([1]);
  const [rulerGuide, setRulerGuide] = useState<RulerGuideState>(() => createHiddenRulerGuide());

  const writingEditorRef = useRef<HTMLDivElement | null>(null);
  const writingScrollRef = useRef<HTMLDivElement | null>(null);
  const writingPageRootRef = useRef<HTMLDivElement | null>(null);
  const writingWorkspaceRef = useRef<HTMLDivElement | null>(null);
  const importedFileInputRef = useRef<HTMLInputElement | null>(null);
  const sourceFilesInputRef = useRef<HTMLInputElement | null>(null);
  const sourcePickerModeRef = useRef<"files" | "directory">("files");
  const writingNavResizeRef = useRef<{ startX: number; startWidthPercent: number } | null>(null);
  const writingWorksResizeRef = useRef<{ startX: number; startWidthPercent: number } | null>(null);
  const passiveAnalysisTimerRef = useRef<number | null>(null);
  const importedSourceRegistrationKeyRef = useRef<string | null>(null);
  const previousCanvasZoomPercentRef = useRef(106);
  const writingZoomAnchorRef = useRef<{ xPx: number; yPx: number } | null>(null);
  const hasMountedViewportResetRef = useRef(false);
  const isFileSystemAccessAvailable = useMemo(() => isFileSystemAccessSupported(), []);

  useEffect(() => {
    const activeProjectId = writeSession.activeProjectId;
    if (!activeProjectId) return;

    const activeProjectKind = organization.projectKindsById[activeProjectId];
    if (!activeProjectKind || activeProjectKind === organization.projectKind) return;

    setWriteSession((current) => ({
      ...current,
      activeProjectId: null,
      activeSectionId: null,
      loadedSections: [],
      loadedChunks: [],
      projectSummary: null,
      sectionSummary: null,
      hasUnsavedChanges: false,
      saveError: null,
    }));
    setWritingNotice("Projeto ativo limpo porque não pertence ao tipo de projeto selecionado.");
  }, [organization.projectKind, organization.projectKindsById, writeSession.activeProjectId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const rawSettings = window.localStorage.getItem(KNEXWRITER_DOCUMENT_SETTINGS_STORAGE_KEY);
    if (!rawSettings) return;

    try {
      const parsed = JSON.parse(rawSettings) as Partial<{
        schemaVersion: number;
        hasExplicitHeaderFooterDistances: boolean;
        pageSettings: WriterPageSettings;
        paragraphIndents: ParagraphIndents;
        tabStops: TabStop[];
        tabStopInsertType: TabStopType;
        rulerSettings: RulerSettings;
        zoomPercent: number;
      }>;

      if (parsed.pageSettings?.margins) {
        setPageSettings((current) => {
          const parsedPageSettings = parsed.pageSettings ?? current;
          const hasExplicitHeaderFooterDistances =
            parsed.hasExplicitHeaderFooterDistances === true ||
            parsed.schemaVersion === KNEXWRITER_DOCUMENT_SETTINGS_SCHEMA_VERSION;

          const restoredHeaderDistanceFromTopPx = hasExplicitHeaderFooterDistances
            ? parsedPageSettings.headerDistanceFromTopPx ?? current.headerDistanceFromTopPx
            : parsedPageSettings.headerDistanceFromTopPx &&
                parsedPageSettings.headerDistanceFromTopPx > 0.5
              ? parsedPageSettings.headerDistanceFromTopPx
              : WRITING_HEADER_DISTANCE_FROM_TOP_PX;

          const restoredFooterDistanceFromBottomPx = hasExplicitHeaderFooterDistances
            ? parsedPageSettings.footerDistanceFromBottomPx ?? current.footerDistanceFromBottomPx
            : parsedPageSettings.footerDistanceFromBottomPx &&
                parsedPageSettings.footerDistanceFromBottomPx > 0.5
              ? parsedPageSettings.footerDistanceFromBottomPx
              : WRITING_FOOTER_DISTANCE_FROM_BOTTOM_PX;

          const restoredFormat =
            normalizeWritingPageFormat(parsedPageSettings.format) ?? current.format;
          const restoredOrientation =
            parsedPageSettings.orientation === "landscape" ? "landscape" : "portrait";
          const restoredPageSize = getWritingPaperSize(
            restoredFormat,
            restoredOrientation,
          );

          return {
            ...current,
            ...parsedPageSettings,
            format: restoredFormat,
            orientation: restoredOrientation,
            widthCm: restoredPageSize.widthCm,
            heightCm: restoredPageSize.heightCm,
            widthPx: restoredPageSize.widthPx,
            heightPx: restoredPageSize.heightPx,
            margins: {
              ...current.margins,
              ...parsedPageSettings.margins,
            },
            headerDistanceFromTopPx: restoredHeaderDistanceFromTopPx,
            footerDistanceFromBottomPx: restoredFooterDistanceFromBottomPx,
          };
        });
      }

      if (parsed.paragraphIndents) {
        setParagraphIndents((current) => ({ ...current, ...parsed.paragraphIndents }));
      }

      if (Array.isArray(parsed.tabStops)) {
        setTabStops(parsed.tabStops);
      }

      if (
        parsed.tabStopInsertType &&
        TAB_STOP_TYPE_SEQUENCE.includes(parsed.tabStopInsertType)
      ) {
        setTabStopInsertType(parsed.tabStopInsertType);
      }

      if (parsed.rulerSettings) {
        setRulerSettings((current) => ({ ...current, ...parsed.rulerSettings }));
      }

      if (typeof parsed.zoomPercent === "number") {
        setWritingCanvasZoomPercent(
          clampNumber(parsed.zoomPercent, WRITING_CANVAS_ZOOM_MIN_PERCENT, WRITING_CANVAS_ZOOM_MAX_PERCENT),
        );
      }
    } catch {
      window.localStorage.removeItem(KNEXWRITER_DOCUMENT_SETTINGS_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    setRulerSettings((current) => ({
      ...current,
      zoom: writingCanvasZoomPercent / 100,
    }));
  }, [writingCanvasZoomPercent]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.localStorage.setItem(
      KNEXWRITER_DOCUMENT_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: KNEXWRITER_DOCUMENT_SETTINGS_SCHEMA_VERSION,
        [KNEXWRITER_HAS_EXPLICIT_HEADER_FOOTER_DISTANCES_KEY]: true,
        pageSettings,
        paragraphIndents,
        tabStops,
        tabStopInsertType,
        rulerSettings,
        zoomPercent: writingCanvasZoomPercent,
      }),
    );
  }, [
    pageSettings,
    paragraphIndents,
    rulerSettings,
    tabStops,
    tabStopInsertType,
    writingCanvasZoomPercent,
  ]);


  useEffect(() => {
    if (!rulerGuide.visible) return;

    const timeout = window.setTimeout(() => {
      setRulerGuide(createHiddenRulerGuide());
    }, 1200);

    return () => window.clearTimeout(timeout);
  }, [rulerGuide.visible, rulerGuide.xPx, rulerGuide.label]);

  const activeProject = useMemo(() => {
    return (
      writeProjects.find((project: WriteProjectListItem) => project.project_id === writeSession.activeProjectId) ||
      null
    );
  }, [writeProjects, writeSession.activeProjectId]);

  const activeSection = useMemo(() => {
    return (
      writeSession.loadedSections.find(
        (section: WriteSectionView) => section.section_id === writeSession.activeSectionId,
      ) || null
    );
  }, [writeSession.activeSectionId, writeSession.loadedSections]);

  useEffect(() => {
    if (!importedDocument || !writeSession.activeProjectId) return;

    const registrationKey = `${writeSession.activeProjectId}:${importedDocument.fileName}:${importedDocument.importedAt}`;
    if (importedSourceRegistrationKeyRef.current === registrationKey) return;

    importedSourceRegistrationKeyRef.current = registrationKey;
    organization.addSourceFile({
      projectId: writeSession.activeProjectId,
      name: importedDocument.fileName,
      type: inferOrganizationSourceFileType(importedDocument.fileType, importedDocument.fileName),
      metadataStatus: "partial",
      bibliographicMetadata: {
        title: getBaseFileName(importedDocument.fileName),
      },
    });
  }, [importedDocument, organization.addSourceFile, writeSession.activeProjectId]);

  const documentWordCount = useMemo(() => getWordCountFromHtml(writingDraftHtml), [writingDraftHtml]);

  const documentStateLabel = useMemo(() => {
    if (writeSession.isGenerating) return "Gerando com IA";
    if (writeSession.isSaving) return "Carregando";
    if (writeSession.hasUnsavedChanges) return "Alterações locais";
    return "Sincronizado";
  }, [writeSession.hasUnsavedChanges, writeSession.isGenerating, writeSession.isSaving]);

  const documentStateClass = useMemo(() => {
    if (writeSession.isGenerating) return "border-blue-300 bg-blue-50 text-blue-700";
    if (writeSession.isSaving) return "border-zinc-300 bg-zinc-50 text-zinc-700";
    if (writeSession.hasUnsavedChanges) return "border-amber-300 bg-amber-50 text-amber-700";
    return "border-emerald-300 bg-emerald-50 text-emerald-700";
  }, [writeSession.hasUnsavedChanges, writeSession.isGenerating, writeSession.isSaving]);

  const analysisStatusLabel = useMemo(() => {
    if (analysisStatus === "scheduled") return "Análise em espera";
    if (analysisStatus === "analyzing") return "Analisando";
    if (analysisStatus === "error") return "Erro na análise";
    return "Análise passiva pronta";
  }, [analysisStatus]);

  const writingHeadings = useMemo(() => getHeadingsFromHtml(writingDraftHtml), [writingDraftHtml]);

  const writingFilteredHeadings = useMemo(() => {
    const query = writingNavQuery.trim().toLowerCase();

    if (!query) return writingHeadings;

    return writingHeadings.filter((item: HeadingItem) => item.text.toLowerCase().includes(query));
  }, [writingHeadings, writingNavQuery]);

  const writingPages = useMemo(() => {
    const query = writingNavQuery.trim().toLowerCase();

    return Array.from({ length: writingPageCount }, (_: unknown, index: number) => index + 1).filter(
      (page: number) => {
        if (!query) return true;

        return `página ${page}`.includes(query) || `pagina ${page}`.includes(query) || String(page).includes(query);
      },
    );
  }, [writingNavQuery, writingPageCount]);

  const writingFilteredProjects = useMemo(() => {
    const query = writingWorksQuery.trim().toLowerCase();

    if (!query) return writeProjects;

    return writeProjects.filter((item: WriteProjectListItem) => {
      const title = item.title.toLowerCase();
      const description = (item.description || "").toLowerCase();
      const objective = (item.objective || "").toLowerCase();

      return title.includes(query) || description.includes(query) || objective.includes(query);
    });
  }, [writeProjects, writingWorksQuery]);

  const writingFilteredSections = useMemo(() => {
    const query = writingWorksQuery.trim().toLowerCase();

    if (!query) return writeSession.loadedSections;

    return writeSession.loadedSections.filter((section: WriteSectionView) => {
      const title = section.title.toLowerCase();
      const objective = (section.objective || "").toLowerCase();
      const status = (section.status || "").toLowerCase();

      return title.includes(query) || objective.includes(query) || status.includes(query);
    });
  }, [writeSession.loadedSections, writingWorksQuery]);

  const filteredContextClusters = useMemo(() => {
    const query = writingWorksQuery.trim().toLowerCase();

    if (!query) return contextClusters;

    return contextClusters.filter((cluster: KnexWriterContextCluster) => {
      const label = cluster.label.toLowerCase();
      const summary = cluster.summary.toLowerCase();

      return label.includes(query) || summary.includes(query);
    });
  }, [contextClusters, writingWorksQuery]);

  const pushRecentDocument = useCallback((document: WriterRecentDocument) => {
    setRecentDocuments((current: WriterRecentDocument[]) => {
      const next = [
        document,
        ...current.filter((item: WriterRecentDocument) => item.id !== document.id),
      ].slice(0, KNEXWRITER_MAX_RECENT_DOCUMENTS);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(KNEXWRITER_RECENT_DOCUMENTS_STORAGE_KEY, JSON.stringify(next));
      }

      return next;
    });
  }, []);

  const recommendedDocuments = useMemo(() => {
    const items: WriterRecentDocument[] = [];
    const nowIso = new Date().toISOString();

    for (const project of writeProjects.slice(0, 8)) {
      items.push({
        id: `project:${project.project_id}`,
        title: project.title,
        subtitle: project.description || project.objective || "Projeto de escrita",
        source: "project",
        updatedAt: project.updated_at,
        projectId: project.project_id,
      });
    }

    if (importedDocument) {
      items.unshift({
        id: `imported:${importedDocument.fileName}:${importedDocument.importedAt}`,
        title: importedDocument.fileName,
        subtitle: "Arquivo importado",
        source: "imported",
        updatedAt: importedDocument.importedAt,
        fileType: importedDocument.fileType,
        previewHtml: writingDraftHtml,
      });
    }

    if (activeSection) {
      items.unshift({
        id: `section:${activeSection.section_id}`,
        title: activeSection.title,
        subtitle: activeProject ? `Seção de ${activeProject.title}` : "Seção ativa",
        source: "local",
        updatedAt: nowIso,
        sectionId: activeSection.section_id,
        projectId: writeSession.activeProjectId || undefined,
        previewHtml: composeSectionHtml(activeSection),
      });
    }

    for (const recent of recentDocuments) {
      if (items.some((item) => item.id === recent.id)) continue;
      items.push(recent);
    }

    if (!items.length) {
      items.push(
        {
          id: "fallback:untitled",
          title: "Documento sem título",
          subtitle: "Comece a escrever no KnexWriter",
          source: "fallback",
          updatedAt: nowIso,
          previewHtml: "<p><br /></p>",
        },
        {
          id: "fallback:project",
          title: "Projeto atual do KnexWriter",
          subtitle: "Crie um projeto para organizar capítulos",
          source: "fallback",
          updatedAt: nowIso,
        },
        {
          id: "fallback:import",
          title: "Último arquivo importado",
          subtitle: "Abra PDF, DOCX, DOC, TXT, HTML",
          source: "fallback",
          updatedAt: nowIso,
        },
      );
    }

    return items.slice(0, KNEXWRITER_MAX_RECENT_DOCUMENTS);
  }, [
    activeProject,
    activeSection,
    importedDocument,
    recentDocuments,
    writeProjects,
    writeSession.activeProjectId,
    writingDraftHtml,
  ]);

  const filteredBackstageRecentDocuments = useMemo(() => {
    const query = backstageSearchQuery.trim().toLowerCase();

    if (!query) return recommendedDocuments;

    return recommendedDocuments.filter((document) => {
      const title = document.title.toLowerCase();
      const subtitle = (document.subtitle || "").toLowerCase();
      return title.includes(query) || subtitle.includes(query);
    });
  }, [backstageSearchQuery, recommendedDocuments]);

  const syncWritingPagination = useCallback(() => {
    const editor = writingEditorRef.current;

    if (!editor || typeof window === "undefined" || typeof document === "undefined") {
      setWritingPageCount((current) => (current === 1 ? current : 1));
      setWritingActivePage((current) => (current === 1 ? current : 1));
      setWritingPageBreakOffsets((current) => (current.length === 0 ? current : []));
      setWritingPageFillRatios((current) =>
        current.length === 1 && current[0] === 1 ? current : [1],
      );
      return;
    }

    const geometry = writingPaginationGeometry;
    const contentHeightPx = getMeasuredEditorContentHeightPx(editor);
    const visualContentBottomPx = geometry.bodyTopPx + contentHeightPx;
    const nextPageCount = Math.max(
      1,
      Math.ceil(visualContentBottomPx / geometry.pageStridePx),
    );
    const nextBreaks = buildAutomaticPageBreakOffsetsPx(nextPageCount, geometry);
    const nextFillRatios = buildPageFillRatios(contentHeightPx, nextPageCount, geometry);

    setWritingPageCount((current: number) =>
      current === nextPageCount ? current : nextPageCount,
    );

    setWritingPageBreakOffsets((current: number[]) => {
      if (
        current.length === nextBreaks.length &&
        current.every((value: number, index: number) => value === nextBreaks[index])
      ) {
        return current;
      }

      return nextBreaks;
    });

    setWritingPageFillRatios((current: number[]) => {
      if (
        current.length === nextFillRatios.length &&
        current.every((value: number, index: number) => value === nextFillRatios[index])
      ) {
        return current;
      }

      return nextFillRatios;
    });

  }, [
    writingPaginationGeometry.bodyBottomPx,
    writingPaginationGeometry.bodyHeightPx,
    writingPaginationGeometry.bodyTopPx,
    writingPaginationGeometry.pageHeightPx,
    writingPaginationGeometry.pageStridePx,
  ]);

  const syncWritingPaginationRef = useRef(syncWritingPagination);

  useEffect(() => {
    syncWritingPaginationRef.current = syncWritingPagination;
  }, [syncWritingPagination]);

  useEffect(() => {
    function handlePageSetupChange(event: Event) {
      const detail = (event as CustomEvent<WriterPageSetupChangeDetail>).detail;
      const patch = detail?.patch;
      const next = detail?.next;
      const incomingPaperSizeId = patch?.paperSizeId ?? next?.paperSizeId;
      const incomingOrientation = patch?.orientation ?? next?.orientation;
      const incomingMargins = patch?.margins ?? next?.margins ?? detail?.margins;
      const normalizedFormat = normalizeWritingPageFormat(incomingPaperSizeId);
      const normalizedOrientation =
        incomingOrientation === "landscape" || incomingOrientation === "portrait"
          ? incomingOrientation
          : null;

      if (!normalizedFormat && !normalizedOrientation && !incomingMargins) {
        return;
      }

      setPageSettings((current) => {
        const nextFormat = normalizedFormat ?? current.format;
        const nextOrientation = normalizedOrientation ?? current.orientation;
        const nextPageSize = getWritingPaperSize(nextFormat, nextOrientation);
        const desiredMargins = incomingMargins
          ? {
              topPx:
                typeof incomingMargins.topCm === "number"
                  ? cmToPx(incomingMargins.topCm)
                  : current.margins.topPx,
              rightPx:
                typeof incomingMargins.rightCm === "number"
                  ? cmToPx(incomingMargins.rightCm)
                  : current.margins.rightPx,
              bottomPx:
                typeof incomingMargins.bottomCm === "number"
                  ? cmToPx(incomingMargins.bottomCm)
                  : current.margins.bottomPx,
              leftPx:
                typeof incomingMargins.leftCm === "number"
                  ? cmToPx(incomingMargins.leftCm)
                  : current.margins.leftPx,
            }
          : current.margins;

        const maxLeftPx = Math.max(
          0,
          nextPageSize.widthPx - desiredMargins.rightPx - cmToPx(3),
        );
        const leftPx = clampNumber(desiredMargins.leftPx, 0, maxLeftPx);
        const maxRightPx = Math.max(
          0,
          nextPageSize.widthPx - leftPx - cmToPx(3),
        );
        const rightPx = clampNumber(desiredMargins.rightPx, 0, maxRightPx);
        const maxTopPx = Math.max(
          0,
          nextPageSize.heightPx - desiredMargins.bottomPx - WRITING_MIN_BODY_HEIGHT_PX,
        );
        const topPx = clampNumber(desiredMargins.topPx, 0, maxTopPx);
        const maxBottomPx = Math.max(
          0,
          nextPageSize.heightPx - topPx - WRITING_MIN_BODY_HEIGHT_PX,
        );
        const bottomPx = clampNumber(desiredMargins.bottomPx, 0, maxBottomPx);

        const desiredHeaderDistancePx =
          typeof incomingMargins?.headerCm === "number"
            ? cmToPx(incomingMargins.headerCm)
            : current.headerDistanceFromTopPx;
        const desiredFooterDistancePx =
          typeof incomingMargins?.footerCm === "number"
            ? cmToPx(incomingMargins.footerCm)
            : current.footerDistanceFromBottomPx;

        const safeHeaderSeed = clampNumber(
          desiredHeaderDistancePx,
          0,
          Math.max(0, nextPageSize.heightPx),
        );

        const maxFooterDistanceFromBottomPx = Math.max(
          0,
          nextPageSize.heightPx - safeHeaderSeed - WRITING_MIN_BODY_HEIGHT_PX,
        );
        const footerDistanceFromBottomPx = clampNumber(
          desiredFooterDistancePx,
          0,
          maxFooterDistanceFromBottomPx,
        );
        const maxHeaderDistanceFromTopPx = Math.max(
          0,
          nextPageSize.heightPx - footerDistanceFromBottomPx - WRITING_MIN_BODY_HEIGHT_PX,
        );
        const headerDistanceFromTopPx = clampNumber(
          safeHeaderSeed,
          0,
          maxHeaderDistanceFromTopPx,
        );

        return {
          ...current,
          format: nextFormat,
          orientation: nextOrientation,
          widthCm: nextPageSize.widthCm,
          heightCm: nextPageSize.heightCm,
          widthPx: nextPageSize.widthPx,
          heightPx: nextPageSize.heightPx,
          margins: {
            ...current.margins,
            topPx,
            rightPx,
            bottomPx,
            leftPx,
          },
          headerDistanceFromTopPx,
          footerDistanceFromBottomPx,
        };
      });

      window.requestAnimationFrame(() => {
        syncWritingPaginationRef.current();
      });
    }

    window.addEventListener("writer:page-setup-change", handlePageSetupChange);

    return () => {
      window.removeEventListener(
        "writer:page-setup-change",
        handlePageSetupChange,
      );
    };
  }, []);

  const handleMeasuredPaginationChange = useCallback(
    (measurement: KnexWriterMeasuredPagination) => {
      const nextPageCount = Math.max(1, Math.ceil(measurement.pageCount));
      const nextBreaks = measurement.pageBreakOffsets
        .slice(0, Math.max(0, nextPageCount - 1))
        .map((offset) => Math.max(0, Math.round(offset)));
      const nextFillRatios =
        measurement.pageFillRatios.length > 0
          ? measurement.pageFillRatios.slice(0, nextPageCount).map((ratio) => clampNumber(ratio, 0, 1))
          : [0];

      while (nextFillRatios.length < nextPageCount) {
        nextFillRatios.push(0);
      }

      setWritingPageCount((current) => {
        const stablePageCount =
          nextPageCount < current && writingActivePage > nextPageCount
            ? current
            : nextPageCount;

        return current === stablePageCount ? current : stablePageCount;
      });

      setWritingPageBreakOffsets((current) => {
        if (
          current.length === nextBreaks.length &&
          current.every((value, index) => value === nextBreaks[index])
        ) {
          return current;
        }

        return nextBreaks;
      });

      setWritingPageFillRatios((current) => {
        if (
          current.length === nextFillRatios.length &&
          current.every((value, index) => Math.abs(value - nextFillRatios[index]) < 0.001)
        ) {
          return current;
        }

        return nextFillRatios;
      });

      setWritingActivePage((current) =>
        Number.isFinite(current) && current >= 1 ? current : 1,
      );
    },
    [writingActivePage],
  );

  const handleChangeWritingActivePage = useCallback(
    (pageNumber: number) => {
      const requestedPage = Number.isFinite(pageNumber)
        ? Math.round(pageNumber)
        : 1;
      const normalizedPage = clampNumber(
        requestedPage,
        1,
        Math.max(1, writingPageCount, requestedPage),
      );

      setWritingActivePage((current) =>
        current === normalizedPage ? current : normalizedPage,
      );
    },
    [writingPageCount],
  );

  const handleChangePageMargins = useCallback(
    (nextMargins: PageMargins) => {
      const leftChanged = Math.abs(nextMargins.leftPx - pageSettings.margins.leftPx) > 0.5;
      const rightChanged = Math.abs(nextMargins.rightPx - pageSettings.margins.rightPx) > 0.5;
      const guideX = rightChanged ? pageSettings.widthPx - nextMargins.rightPx : nextMargins.leftPx;
      const guideLabel = rightChanged
        ? `Margem direita: ${formatRulerCentimeters(nextMargins.rightPx)}`
        : `Margem esquerda: ${formatRulerCentimeters(nextMargins.leftPx)}`;

      setPageSettings((current) => ({
        ...current,
        margins: nextMargins,
      }));

      if (leftChanged || rightChanged) {
        setRulerGuide({
          visible: true,
          xPx: guideX,
          label: guideLabel,
          mode: "page-margin",
        });
      }

      window.requestAnimationFrame(syncWritingPagination);
    },
    [pageSettings.margins.leftPx, pageSettings.margins.rightPx, pageSettings.widthPx, syncWritingPagination],
  );

  const handleChangeHeaderDistanceFromTop = useCallback(
    (nextDistancePx: number) => {
      const maxDistancePx = Math.max(
        0,
        pageSettings.heightPx -
          pageSettings.footerDistanceFromBottomPx -
          WRITING_MIN_BODY_HEIGHT_PX,
      );

      const clampedDistancePx = clampNumber(nextDistancePx, 0, maxDistancePx);

      setPageSettings((current) => {
        if (Math.abs(current.headerDistanceFromTopPx - clampedDistancePx) < 0.5) {
          return current;
        }

        return {
          ...current,
          headerDistanceFromTopPx: clampedDistancePx,
        };
      });

      window.requestAnimationFrame(syncWritingPagination);
    },
    [
      pageSettings.footerDistanceFromBottomPx,
      pageSettings.heightPx,
      syncWritingPagination,
    ],
  );

  const handleChangeFooterDistanceFromBottom = useCallback(
    (nextDistancePx: number) => {
      const maxDistancePx = Math.max(
        0,
        pageSettings.heightPx -
          pageSettings.headerDistanceFromTopPx -
          WRITING_MIN_BODY_HEIGHT_PX,
      );

      const clampedDistancePx = clampNumber(nextDistancePx, 0, maxDistancePx);

      setPageSettings((current) => {
        if (Math.abs(current.footerDistanceFromBottomPx - clampedDistancePx) < 0.5) {
          return current;
        }

        return {
          ...current,
          footerDistanceFromBottomPx: clampedDistancePx,
        };
      });

      window.requestAnimationFrame(syncWritingPagination);
    },
    [
      pageSettings.headerDistanceFromTopPx,
      pageSettings.heightPx,
      syncWritingPagination,
    ],
  );

  const handleChangeParagraphIndents = useCallback(
    (nextIndents: ParagraphIndents) => {
      const firstLineChanged = Math.abs(nextIndents.firstLinePx - paragraphIndents.firstLinePx) > 0.5;
      const hangingChanged = Math.abs(nextIndents.hangingPx - paragraphIndents.hangingPx) > 0.5;
      const rightChanged = Math.abs(nextIndents.rightPx - paragraphIndents.rightPx) > 0.5;
      const leftChanged = Math.abs(nextIndents.leftPx - paragraphIndents.leftPx) > 0.5;
      const currentFirstLineAnchorPx =
        paragraphIndents.leftPx + paragraphIndents.firstLinePx;
      const nextFirstLineAnchorPx = nextIndents.leftPx + nextIndents.firstLinePx;
      const isLeftIndentWithFirstLineCompensation =
        leftChanged &&
        firstLineChanged &&
        Math.abs(nextFirstLineAnchorPx - currentFirstLineAnchorPx) <= 0.75;

      let guideX = pageSettings.margins.leftPx + nextIndents.leftPx;
      let guideLabel = `Recuo esquerdo: ${formatRulerCentimeters(nextIndents.leftPx)}`;
      let mode: RulerGuideState["mode"] = "indent-left";

      if (isLeftIndentWithFirstLineCompensation) {
        guideX = pageSettings.margins.leftPx + nextIndents.leftPx;
        guideLabel = `Recuo esquerdo: ${formatRulerCentimeters(nextIndents.leftPx)}`;
        mode = "indent-left";
      } else if (firstLineChanged) {
        guideX = pageSettings.margins.leftPx + nextIndents.leftPx + nextIndents.firstLinePx;
        guideLabel = `Primeira linha: ${formatRulerCentimeters(nextIndents.firstLinePx)}`;
        mode = "indent-first-line";
      } else if (hangingChanged) {
        guideX = pageSettings.margins.leftPx + nextIndents.leftPx + nextIndents.hangingPx;
        guideLabel = `Recuo deslocado: ${formatRulerCentimeters(nextIndents.hangingPx)}`;
        mode = "indent-hanging";
      } else if (rightChanged) {
        guideX = pageSettings.widthPx - pageSettings.margins.rightPx - nextIndents.rightPx;
        guideLabel = `Recuo direito: ${formatRulerCentimeters(nextIndents.rightPx)}`;
        mode = "indent-right";
      } else if (leftChanged) {
        guideX = pageSettings.margins.leftPx + nextIndents.leftPx;
        guideLabel = `Recuo esquerdo: ${formatRulerCentimeters(nextIndents.leftPx)}`;
        mode = "indent-left";
      }

      setParagraphIndents(nextIndents);

      if (firstLineChanged || hangingChanged || rightChanged || leftChanged) {
        setRulerGuide({
          visible: true,
          xPx: guideX,
          label: guideLabel,
          mode,
        });
      }
    },
    [pageSettings.margins.leftPx, pageSettings.margins.rightPx, pageSettings.widthPx, paragraphIndents],
  );

  const handleChangeTabStops = useCallback(
    (nextTabStops: TabStop[]) => {
      const changedTabStop =
        nextTabStops.find((nextTabStop) => {
          const currentTabStop = tabStops.find((item) => item.id === nextTabStop.id);
          return !currentTabStop || Math.abs(currentTabStop.positionPx - nextTabStop.positionPx) > 0.5;
        }) || nextTabStops[nextTabStops.length - 1];

      setTabStops(nextTabStops);

      if (changedTabStop) {
        setRulerGuide({
          visible: true,
          xPx: changedTabStop.positionPx,
          label: `Tabulação: ${formatRulerCentimeters(changedTabStop.positionPx - pageSettings.margins.leftPx)}`,
          mode: "tab-stop",
        });
      }
    },
    [pageSettings.margins.leftPx, tabStops],
  );

  const handleCycleTabStopInsertType = useCallback(() => {
    setTabStopInsertType((current) => {
      const currentIndex = TAB_STOP_TYPE_SEQUENCE.indexOf(current);
      if (currentIndex < 0) {
        return DEFAULT_TAB_STOP_INSERT_TYPE;
      }

      return TAB_STOP_TYPE_SEQUENCE[(currentIndex + 1) % TAB_STOP_TYPE_SEQUENCE.length];
    });
  }, []);

  const schedulePassiveAnalysis = useCallback((html: string) => {
    if (typeof window === "undefined") return;

    if (passiveAnalysisTimerRef.current) {
      window.clearTimeout(passiveAnalysisTimerRef.current);
    }

    setAnalysisStatus("scheduled");
    setAnalysisError(null);

    passiveAnalysisTimerRef.current = window.setTimeout(() => {
      const plainText = getTextFromHtml(html);

      if (!plainText) {
        setContextClusters([]);
        setAnalysisStatus("idle");
        return;
      }

      setAnalysisStatus("idle");

      /**
       * TODO:
       * Integrar futuramente com endpoint real:
       * - analyzeWriteFragment
       * - getWriteContextMap
       * - checkWriteRepetition
       *
       * Nesta etapa, a função apenas prepara debounce seguro.
       */
    }, 900);
  }, []);

  const tiptapEditor = useEditor(
    {
      extensions: [...createKnexWriterExtensions(), WriterTabStopExtension, WriterPageBreakExtension],
      content: writingDraftHtml,
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class: "knexwriter-prosemirror min-h-full outline-none",
        },
      },
      onUpdate: ({ editor }) => {
        const html = editor.getHTML();

        setWritingDraftHtml(html);
        setWriteSession((current: WriteEditorSessionState) => ({
          ...current,
          hasUnsavedChanges: true,
          saveError: null,
        }));
        schedulePassiveAnalysis(html);
        window.requestAnimationFrame(() => syncWritingPaginationRef.current());
      },
    },
    [schedulePassiveAnalysis],
  );

  useEffect(() => {
    if (!tiptapEditor) return;

    const currentHtml = tiptapEditor.getHTML();
    if (currentHtml === writingDraftHtml) return;

    tiptapEditor.commands.setContent(writingDraftHtml, { emitUpdate: false });
    window.requestAnimationFrame(syncWritingPagination);
  }, [editorDocumentVersion, syncWritingPagination, tiptapEditor, writingDraftHtml]);

  const focusWritingEditor = useCallback(() => {
    if (!tiptapEditor) return null;

    tiptapEditor.chain().focus().run();

    return tiptapEditor;
  }, [tiptapEditor]);

  const syncEditorFromTipTap = useCallback(
    (editor: Editor) => {
      const html = editor.getHTML();
      setWritingDraftHtml(html);
      setWriteSession((current: WriteEditorSessionState) => ({
        ...current,
        hasUnsavedChanges: true,
        saveError: null,
      }));
      schedulePassiveAnalysis(html);
      window.requestAnimationFrame(syncWritingPagination);
    },
    [schedulePassiveAnalysis, syncWritingPagination],
  );

  const applyWritingCommand = useCallback(
    (command: WritingFormatCommand, value?: string) => {
      const editor = focusWritingEditor();

      if (!editor) return;

      const normalizeFontSizeValue = (rawValue?: string) => {
        if (!rawValue) return null;
        const trimmed = rawValue.trim();
        if (!trimmed) return null;

        const normalized = trimmed.replace(",", ".");
        if (/^\d+(\.\d+)?$/.test(normalized)) return `${normalized}pt`;
        if (/^\d+(\.\d+)?(pt|px|em|rem|%)$/i.test(normalized)) return normalized;
        return null;
      };

      const getCurrentFontSize = () => {
        const raw = editor.getAttributes("textStyle")?.fontSize as string | undefined;
        if (!raw) return 12;
        const parsed = Number(raw.replace("pt", "").replace("px", "").replace(",", ".").trim());
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 12;
      };

      try {
        const chain = editor.chain().focus();

        switch (command) {
          case "bold":
            chain.toggleBold().run();
            break;
          case "italic":
            chain.toggleItalic().run();
            break;
          case "underline":
            chain.toggleUnderline().run();
            break;
          case "strikeThrough":
            chain.toggleStrike().run();
            break;
          case "subscript":
            chain.toggleSubscript().run();
            break;
          case "superscript":
            chain.toggleSuperscript().run();
            break;
          case "insertUnorderedList":
          case "toggleBulletList":
            chain.toggleBulletList().run();
            break;
          case "insertOrderedList":
          case "toggleOrderedList":
            chain.toggleOrderedList().run();
            break;
          case "textAlign":
            if (
              value === "left" ||
              value === "center" ||
              value === "right" ||
              value === "justify"
            ) {
              chain.setTextAlign(value).run();
            }
            break;
          case "justifyLeft":
            chain.setTextAlign("left").run();
            break;
          case "justifyCenter":
            chain.setTextAlign("center").run();
            break;
          case "justifyRight":
            chain.setTextAlign("right").run();
            break;
          case "justifyFull":
            chain.setTextAlign("justify").run();
            break;
          case "fontName":
            if (value) chain.setFontFamily(value).run();
            break;
          case "fontSize":
            if (value) {
              const normalizedFontSize = normalizeFontSizeValue(value);
              if (normalizedFontSize) {
                if (typeof chain.setFontSize === "function") chain.setFontSize(normalizedFontSize).run();
                else chain.setMark("textStyle", { fontSize: normalizedFontSize }).run();
              }
            }
            break;
          case "foreColor":
            if (value) chain.setColor(value).run();
            break;
          case "hiliteColor":
            if (value === "transparent") chain.unsetHighlight().run();
            else if (value) chain.toggleHighlight({ color: value }).run();
            break;
          case "increaseFontSize": {
            const nextSize = Math.min(96, getCurrentFontSize() + 1);
            const normalizedFontSize = `${nextSize}pt`;
            if (typeof chain.setFontSize === "function") chain.setFontSize(normalizedFontSize).run();
            else chain.setMark("textStyle", { fontSize: normalizedFontSize }).run();
            break;
          }
          case "decreaseFontSize": {
            const nextSize = Math.max(1, getCurrentFontSize() - 1);
            const normalizedFontSize = `${nextSize}pt`;
            if (typeof chain.setFontSize === "function") chain.setFontSize(normalizedFontSize).run();
            else chain.setMark("textStyle", { fontSize: normalizedFontSize }).run();
            break;
          }
          case "outdent":
            if (typeof chain.decreaseIndent === "function") {
              chain.decreaseIndent().run();
            } else {
              setParagraphIndents((current) => ({
                ...current,
                leftPx: Math.max(0, current.leftPx - cmToPx(0.5)),
              }));
            }
            break;
          case "indent":
            if (typeof chain.increaseIndent === "function") {
              chain.increaseIndent().run();
            } else {
              setParagraphIndents((current) => ({
                ...current,
                leftPx: current.leftPx + cmToPx(0.5),
              }));
            }
            break;
          case "lineHeight":
            if (value) {
              if (typeof chain.setParagraphLineHeight === "function") chain.setParagraphLineHeight(value).run();
            }
            break;
          case "paragraphSpacing": {
            if (!value) break;

            const spacingPresets: Record<string, { marginTop: string; marginBottom: string }> = {
              none: { marginTop: "0px", marginBottom: "0px" },
              compact: { marginTop: "0px", marginBottom: "4px" },
              normal: { marginTop: "0px", marginBottom: "8px" },
              open: { marginTop: "0px", marginBottom: "12px" },
              relaxed: { marginTop: "0px", marginBottom: "16px" },
              academic: { marginTop: "0px", marginBottom: "10px" },
            }

            const spacing = spacingPresets[value];
            if (spacing && typeof chain.setParagraphSpacing === "function") {
              chain.setParagraphSpacing(spacing).run();
            }
            break;
          }
          case "paragraphShading":
            if (typeof chain.setParagraphShading === "function") {
              chain.setParagraphShading(value && value !== "transparent" ? value : null).run();
            }
            break;
          case "paragraphBorder": {
            const borderConfig: {
              borderTop?: string | null;
              borderBottom?: string | null;
              borderLeft?: string | null;
              borderRight?: string | null;
              paddingTop?: string | null;
              paddingBottom?: string | null;
              paddingLeft?: string | null;
              paddingRight?: string | null;
            } = {};

            if (value === "bottom") {
              borderConfig.borderBottom = "1px solid #6b7280";
              borderConfig.paddingBottom = "2px";
            } else if (value === "top") {
              borderConfig.borderTop = "1px solid #6b7280";
              borderConfig.paddingTop = "2px";
            } else if (value === "left") {
              borderConfig.borderLeft = "1px solid #6b7280";
              borderConfig.paddingLeft = "4px";
            } else if (value === "right") {
              borderConfig.borderRight = "1px solid #6b7280";
              borderConfig.paddingRight = "4px";
            } else if (value === "outside" || value === "all") {
              borderConfig.borderTop = "1px solid #6b7280";
              borderConfig.borderBottom = "1px solid #6b7280";
              borderConfig.borderLeft = "1px solid #6b7280";
              borderConfig.borderRight = "1px solid #6b7280";
              borderConfig.paddingTop = "3px";
              borderConfig.paddingBottom = "3px";
              borderConfig.paddingLeft = "4px";
              borderConfig.paddingRight = "4px";
            } else if (value === "inside") {
              borderConfig.borderTop = "1px solid #6b7280";
              borderConfig.borderBottom = "1px solid #6b7280";
              borderConfig.paddingTop = "2px";
              borderConfig.paddingBottom = "2px";
            }

            if (typeof chain.setParagraphBorder === "function") {
              chain.setParagraphBorder(borderConfig).run();
            }
            break;
          }
          case "clearParagraphFormatting":
            if (typeof chain.clearParagraphStyle === "function") {
              chain.clearParagraphStyle();
            }
            if (typeof chain.unsetIndent === "function") {
              chain.unsetIndent();
            }
            chain.setTextAlign("left").run();
            break;
          case "toggleParagraphMarks":
            console.warn("[KnexWriter] toggleParagraphMarks ainda não possui renderização de marcas no editor atual.");
            break;
          case "openParagraphDialog":
            console.warn("[KnexWriter] openParagraphDialog ainda não está implementado.");
            break;
          case "sortParagraphsAscending":
            console.warn("[KnexWriter] sortParagraphsAscending ainda não implementado.");
            break;
          case "removeFormat":
            chain.unsetAllMarks().clearNodes().run();
            break;
          case "undo":
            chain.undo().run();
            break;
          case "redo":
            chain.redo().run();
            break;
          case "formatBlock": {
            const normalized = (value || "<p>").replace(/[<>]/g, "").toLowerCase();

            if (normalized === "h1") chain.toggleHeading({ level: 1 }).run();
            else if (normalized === "h2") chain.toggleHeading({ level: 2 }).run();
            else if (normalized === "h3") chain.toggleHeading({ level: 3 }).run();
            else if (normalized === "blockquote") chain.toggleBlockquote().run();
            else chain.setParagraph().run();
            break;
          }
          default:
            chain.run();
        }
      } catch (error) {
        console.warn("[KnexWriter] Falha ao aplicar comando:", command, error);
      }

      syncEditorFromTipTap(editor);
    },
    [focusWritingEditor, syncEditorFromTipTap],
  );

  const insertCitationFromSource = useCallback(
    (input: InsertCitationFromSourceInput) => {
      const activeProjectId = writeSession.activeProjectId;
      if (!activeProjectId) {
        setWritingError("Selecione um projeto antes de usar uma fonte como referência.");
        return;
      }

      const result = organization.insertCitationFromSource({
        ...input,
        projectId: activeProjectId,
        sectionId: input.sectionId ?? writeSession.activeSectionId ?? undefined,
      });
      const editor = focusWritingEditor();

      if (editor) {
        const citationText =
          input.quoteText?.trim() ||
          input.citationText?.trim() ||
          `Citação vinculada a ${result.reference.title}.`;
        const citationHtml =
          input.usageType === "direct_quote"
            ? `<blockquote><p>${escapeHtml(citationText)}</p></blockquote>`
            : `<p>${escapeHtml(citationText)}</p>`;

        editor.chain().focus().insertContent(citationHtml).run();
        syncEditorFromTipTap(editor);
      }

      setWritingNotice("Fonte vinculada ao texto e adicionada às referências usadas.");
      setWritingError(null);
    },
    [
      focusWritingEditor,
      organization,
      syncEditorFromTipTap,
      writeSession.activeProjectId,
      writeSession.activeSectionId,
    ],
  );

  const linkSelectedTextToReference = useCallback(
    (input: LinkSelectedTextToReferenceInput) => {
      const activeProjectId = writeSession.activeProjectId;
      if (!activeProjectId) {
        setWritingError("Selecione um projeto antes de vincular texto a uma referência.");
        return;
      }

      organization.linkSelectedTextToReference({
        ...input,
        projectId: activeProjectId,
        sectionId: input.sectionId ?? writeSession.activeSectionId ?? undefined,
      });
      setWritingNotice("Texto selecionado vinculado à referência.");
      setWritingError(null);
    },
    [organization, writeSession.activeProjectId, writeSession.activeSectionId],
  );

  const registerSourceFileFromOrganization = useCallback(
    (input: Omit<AddSourceFileInput, "projectId">) => {
      const activeProjectId = writeSession.activeProjectId;
      if (!activeProjectId) {
        setWritingError("Selecione um projeto antes de registrar uma fonte.");
        return;
      }

      organization.addSourceFile({
        ...input,
        projectId: activeProjectId,
        status: input.status ?? "available",
        metadataStatus: input.metadataStatus ?? "partial",
        bibliographicMetadata: input.bibliographicMetadata ?? { title: getBaseFileName(input.name) },
      });
      organization.setActiveOrganizationTab("references");
      organization.setActiveReferenceFilter("available_sources");
      setWritingNotice("Arquivo registrado como fonte disponível do projeto.");
      setWritingError(null);
    },
    [organization, writeSession.activeProjectId],
  );

  const registerSourceCandidates = useCallback(
    (projectId: string, candidates: FileGuardSourceCandidate[]) => {
      const createdCount = organization.addSourceFiles(
        candidates.map((candidate) => ({
          projectId,
          name: candidate.name,
          type: candidate.type,
          fileHandleId: candidate.fileHandleId,
          directoryHandleId: candidate.directoryHandleId,
          fileName: candidate.fileName,
          sizeBytes: candidate.sizeBytes,
          mimeType: candidate.mimeType,
          lastModified: candidate.lastModified,
          rootFolderName: candidate.rootFolderName,
          status: "available",
          metadataStatus: "partial",
          bibliographicMetadata: { title: getBaseFileName(candidate.name) },
        })),
      );

      organization.setActiveOrganizationTab("references");
      organization.setActiveReferenceFilter("available_sources");

      if (createdCount > 0) {
        setWritingNotice(`${createdCount} fonte${createdCount === 1 ? "" : "s"} vinculada${createdCount === 1 ? "" : "s"} ao projeto.`);
      } else {
        setWritingNotice("As fontes selecionadas já estavam vinculadas ao projeto.");
      }
      setWritingError(null);
    },
    [organization],
  );

  const handleCopySelection = useCallback(() => {
    const editor = focusWritingEditor();
    if (!editor || typeof window === "undefined") return;

    const selectedText = window.getSelection()?.toString()?.trim() || "";
    const copied = document.execCommand("copy");

    if (copied) {
      setWritingNotice("Trecho copiado.");
      setWritingError(null);
      return;
    }

    if (!selectedText) {
      setWritingError("Selecione um trecho para copiar.");
      return;
    }

    if (navigator.clipboard?.writeText) {
      void navigator.clipboard
        .writeText(selectedText)
        .then(() => {
          setWritingNotice("Trecho copiado.");
          setWritingError(null);
        })
        .catch(() => {
          setWritingError("Não foi possível copiar o trecho selecionado.");
        });
      return;
    }

    setWritingError("Cópia indisponível neste navegador.");
  }, [focusWritingEditor]);

  const handleCutSelection = useCallback(() => {
    const editor = focusWritingEditor();
    if (!editor || typeof window === "undefined") return;

    const selectedText = window.getSelection()?.toString()?.trim() || "";
    const cut = document.execCommand("cut");

    if (cut) {
      syncEditorFromTipTap(editor);
      setWritingNotice("Trecho recortado.");
      setWritingError(null);
      return;
    }

    if (!selectedText) {
      setWritingError("Selecione um trecho para recortar.");
      return;
    }

    if (navigator.clipboard?.writeText) {
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      range?.deleteContents();

      void navigator.clipboard
        .writeText(selectedText)
        .then(() => {
          syncEditorFromTipTap(editor);
          setWritingNotice("Trecho recortado.");
          setWritingError(null);
        })
        .catch(() => {
          setWritingError("Não foi possível recortar o trecho selecionado.");
        });
      return;
    }

    setWritingError("Recorte indisponível neste navegador.");
  }, [focusWritingEditor, syncEditorFromTipTap]);

  const handlePasteFromClipboard = useCallback(async () => {
    const editor = focusWritingEditor();
    if (!editor || typeof window === "undefined") return;

    if (navigator.clipboard?.readText) {
      try {
        const clipboardText = await navigator.clipboard.readText();
        if (!clipboardText.trim()) {
          setWritingError("A área de transferência está vazia.");
          return;
        }
        editor.chain().focus().insertContent(escapeHtml(clipboardText).replace(/\n/g, "<br />")).run();
        syncEditorFromTipTap(editor);
        setWritingNotice("Texto colado.");
        setWritingError(null);
        return;
      } catch {
        // fallback abaixo
      }
    }

    const pasted = document.execCommand("paste");
    if (pasted) {
      syncEditorFromTipTap(editor);
      setWritingNotice("Texto colado.");
      setWritingError(null);
      return;
    }

    setWritingError("Não foi possível colar automaticamente. Use Ctrl+V no editor.");
  }, [focusWritingEditor, syncEditorFromTipTap]);

  const insertWritingText = useCallback(
    (text: string) => {
      const editor = focusWritingEditor();

      if (!editor) return;

      const normalized = text.trim();

      if (!normalized) return;

      editor.chain().focus().insertContent(`<p>${escapeHtml(normalized)}</p>`).run();
      const html = editor.getHTML();

      setWritingDraftHtml(html);
      schedulePassiveAnalysis(html);
      window.requestAnimationFrame(syncWritingPagination);
    },
    [focusWritingEditor, schedulePassiveAnalysis, syncWritingPagination],
  );

  const jumpToWritingPage = useCallback(
    (pageNumber: number) => {
      const scroller = writingScrollRef.current;
      const pageRoot = writingPageRootRef.current;

      if (!scroller || !pageRoot) return;

      const zoomScale = Math.max(0.5, writingCanvasZoomPercent / 100);
      const normalizedPage = clampNumber(pageNumber, 1, Math.max(1, writingPageCount));
      const top = pageRoot.offsetTop + (normalizedPage - 1) * layoutMetrics.pageStridePx * zoomScale;

      scroller.scrollTo({ top, behavior: "smooth" });
      setWritingActivePage(normalizedPage);
    },
    [layoutMetrics.pageStridePx, writingCanvasZoomPercent, writingPageCount],
  );

  const jumpToWritingHeading = useCallback((headingText: string) => {
    const editor = writingEditorRef.current;

    if (!editor) return;

    const headingNodes = Array.from(editor.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6"));
    const target = headingNodes.find((node) => (node.textContent || "").trim() === headingText);

    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    editor.focus();
  }, []);

  const resolveSafeSectionSummary = useCallback(async (sectionId: string | null) => {
    if (!sectionId) return null;

    try {
      return await getWriteSectionSummary(sectionId);
    } catch {
      return null;
    }
  }, []);

  const resolveSafeProjectSummary = useCallback(async (projectId: string | null) => {
    if (!projectId) return null;

    try {
      return await getWriteProjectGlobalSummary(projectId);
    } catch {
      return null;
    }
  }, []);

  const replaceEditorHtml = useCallback(
    (nextHtml: string) => {
      setWritingDraftHtml(nextHtml);
      setEditorDocumentVersion((current: number) => current + 1);
      schedulePassiveAnalysis(nextHtml);

      tiptapEditor?.commands.setContent(nextHtml, { emitUpdate: false });

      window.requestAnimationFrame(syncWritingPagination);
    },
    [schedulePassiveAnalysis, syncWritingPagination, tiptapEditor],
  );

  const applySectionToEditor = useCallback(
    (section: WriteSectionView | null) => {
      const nextHtml = composeSectionHtml(section);

      replaceEditorHtml(nextHtml);
      setImportedDocument(null);
    },
    [replaceEditorHtml],
  );

  const refreshWriteProjects = useCallback(async () => {
    const projects = await listWriteProjects(80);

    setWriteProjects(projects);

    return projects;
  }, []);

  const openWriteProjectSession = useCallback(
    async (projectId: string, preferredSectionId?: string | null) => {
      setWriteSession((current: WriteEditorSessionState) => ({
        ...current,
        activeProjectId: projectId,
        isSaving: true,
        saveError: null,
      }));

      setWritingError(null);
      setWritingNotice(null);

      try {
        const [project, sections] = await Promise.all([
          getWriteProject(projectId),
          listWriteProjectSections(projectId, {
            includeChunks: true,
            includeSummaries: true,
          }),
        ]);

        const sortedSections = [...sections].sort(
          (a: WriteSectionView, b: WriteSectionView) =>
            a.order - b.order || a.title.localeCompare(b.title),
        );

        const activeLoadedSection =
          sortedSections.find(
            (item: WriteSectionView) => item.section_id === (preferredSectionId || ""),
          ) ||
          sortedSections[0] ||
          null;

        const [sectionSummary, projectSummary] = await Promise.all([
          resolveSafeSectionSummary(activeLoadedSection?.section_id ?? null),
          resolveSafeProjectSummary(projectId),
        ]);

        applySectionToEditor(activeLoadedSection);
        setWritingTitle(project.title || "Documento sem título");

        setWriteSession((current: WriteEditorSessionState) => ({
          ...current,
          activeProjectId: project.project_id,
          activeSectionId: activeLoadedSection?.section_id ?? null,
          loadedSections: sortedSections,
          loadedChunks: activeLoadedSection?.chunks || [],
          sectionSummary,
          projectSummary,
          hasUnsavedChanges: false,
          isSaving: false,
          isGenerating: false,
          saveError: null,
          lastSyncedAt: new Date().toISOString(),
        }));

        pushRecentDocument({
          id: `project:${project.project_id}`,
          title: project.title || "Projeto sem título",
          subtitle: activeLoadedSection?.title || "Projeto de escrita",
          source: "project",
          updatedAt: project.updated_at || new Date().toISOString(),
          projectId: project.project_id,
          sectionId: activeLoadedSection?.section_id || undefined,
          previewHtml: activeLoadedSection ? composeSectionHtml(activeLoadedSection) : undefined,
        });

        if (!activeLoadedSection) {
          setWritingNotice("Projeto carregado sem seções. Crie a primeira seção para iniciar.");
        }
      } catch (openError: unknown) {
        const message =
          openError instanceof Error ? openError.message : "Falha ao carregar projeto de escrita.";

        setWriteSession((current: WriteEditorSessionState) => ({
          ...current,
          isSaving: false,
          saveError: message,
        }));

        setWritingError(message);
      }
    },
    [applySectionToEditor, pushRecentDocument, resolveSafeProjectSummary, resolveSafeSectionSummary],
  );

  const handleSelectWriteSection = useCallback(
    async (sectionId: string) => {
      const nextSection =
        writeSession.loadedSections.find((item: WriteSectionView) => item.section_id === sectionId) ||
        null;

      if (!nextSection) return;

      applySectionToEditor(nextSection);

      setWriteSession((current: WriteEditorSessionState) => ({
        ...current,
        activeSectionId: nextSection.section_id,
        loadedChunks: nextSection.chunks || [],
        hasUnsavedChanges: false,
        saveError: null,
        lastSyncedAt: new Date().toISOString(),
      }));

      const [sectionSummary, projectSummary] = await Promise.all([
        resolveSafeSectionSummary(nextSection.section_id),
        resolveSafeProjectSummary(nextSection.project_id),
      ]);

      setWriteSession((current: WriteEditorSessionState) => ({
        ...current,
        sectionSummary,
        projectSummary,
      }));
    },
    [
      applySectionToEditor,
      resolveSafeProjectSummary,
      resolveSafeSectionSummary,
      writeSession.loadedSections,
    ],
  );

  const handleCreateWriteProject = useCallback(async () => {
    setWriteSession((current: WriteEditorSessionState) => ({
      ...current,
      isSaving: true,
      saveError: null,
    }));

    setWritingError(null);
    setWritingNotice(null);

    try {
      const createdProject = await createWriteProject({
        title: `Projeto ${new Date().toLocaleDateString("pt-BR")}`,
        description: "",
        objective: "",
        metadata: {
          origin: "knexwriter-web",
        },
      });

      const firstSection = await createWriteSection(createdProject.project_id, {
        title: "Seção 1",
        order: 0,
        objective: "Definir objetivo desta seção.",
        outline_notes: "",
        status: "planned",
        content: "",
      });

      organization.setProjectKindForProject(createdProject.project_id, organization.projectKind);
      await refreshWriteProjects();
      await openWriteProjectSession(createdProject.project_id, firstSection.section_id);

      setIsWritingWorksCollapsed(false);
      organization.setActiveOrganizationTab("sections");
      setWritingNotice("Novo projeto de escrita criado.");
    } catch (createError: unknown) {
      const message =
        createError instanceof Error ? createError.message : "Falha ao criar projeto de escrita.";

      setWriteSession((current: WriteEditorSessionState) => ({
        ...current,
        isSaving: false,
        saveError: message,
      }));

      setWritingError(message);
    }
  }, [openWriteProjectSession, organization, refreshWriteProjects]);

  const handleCreateWriteSection = useCallback(async () => {
    const activeProjectId = writeSession.activeProjectId;

    if (!activeProjectId) {
      setWritingError("Crie ou selecione um projeto antes de criar uma seção.");
      return;
    }

    setWriteSession((current: WriteEditorSessionState) => ({
      ...current,
      isSaving: true,
      saveError: null,
    }));

    setWritingError(null);
    setWritingNotice(null);

    try {
      const nextOrder = writeSession.loadedSections.length;

      const createdSection = await createWriteSection(activeProjectId, {
        title: `Seção ${nextOrder + 1}`,
        order: nextOrder,
        objective: "Definir objetivo desta seção.",
        outline_notes: "",
        status: "planned",
        content: "",
      });

      await openWriteProjectSession(activeProjectId, createdSection.section_id);

      setWritingRightPanelTab("sections");
      setWritingNotice("Nova seção criada.");
    } catch (createError: unknown) {
      const message =
        createError instanceof Error ? createError.message : "Falha ao criar nova seção.";

      setWriteSession((current: WriteEditorSessionState) => ({
        ...current,
        isSaving: false,
        saveError: message,
      }));

      setWritingError(message);
    }
  }, [openWriteProjectSession, writeSession.activeProjectId, writeSession.loadedSections.length]);

  const handleSaveLocalDraft = useCallback(() => {
    const html = tiptapEditor?.getHTML() || writingDraftHtml;

    try {
      const key = `knexwriter_draft:${writeSession.editorSessionId}`;

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          key,
          JSON.stringify({
            version: 2,
            bodyHtml: html,
            headerHtml: headerFooter.headerHtml,
            footerHtml: headerFooter.footerHtml,
            savedAt: new Date().toISOString(),
          }),
        );
      }

      setWriteSession((current: WriteEditorSessionState) => ({
        ...current,
        hasUnsavedChanges: false,
        lastSyncedAt: new Date().toISOString(),
      }));

      pushRecentDocument({
        id: `local:draft:${writeSession.editorSessionId}`,
        title: writingTitle || "Documento sem título",
        subtitle: activeProject ? `Projeto: ${activeProject.title}` : "Rascunho local",
        source: "local",
        updatedAt: new Date().toISOString(),
        previewHtml: html,
        projectId: writeSession.activeProjectId || undefined,
        sectionId: writeSession.activeSectionId || undefined,
      });

      setWritingNotice("Rascunho salvo localmente.");
      setWritingError(null);
    } catch {
      setWritingError("Não foi possível salvar o rascunho localmente.");
    }
  }, [
    activeProject,
    pushRecentDocument,
    headerFooter.footerHtml,
    headerFooter.headerHtml,
    writeSession.activeProjectId,
    writeSession.activeSectionId,
    writeSession.editorSessionId,
    tiptapEditor,
    writingDraftHtml,
    writingTitle,
  ]);

  const buildSaveAsContext = useCallback(
    (options?: Partial<WriterSaveAsOptions>, projectIdOverride?: string | null) => {
      const resolvedOptions: WriterSaveAsOptions = {
        ...createDefaultSaveAsOptions(organization.projectKind),
        ...options,
      };
      const activeProjectId = projectIdOverride ?? writeSession.activeProjectId;
      const projectSourceFiles = activeProjectId
        ? organization.sourceFiles.filter((sourceFile) => sourceFile.projectId === activeProjectId)
        : [];
      const projectReferences = activeProjectId
        ? organization.projectReferences.filter((reference) => reference.projectId === activeProjectId)
        : [];
      const projectUsages = activeProjectId
        ? organization.referenceUsages.filter((usage) => usage.projectId === activeProjectId)
        : [];
      const auditIssues = buildReferenceAuditIssues(projectSourceFiles, projectReferences, projectUsages);
      const usedReferences = getUsedReferences(projectReferences, projectUsages);
      const formattedReferences = usedReferences.map((reference) =>
        formatReference(reference, resolvedOptions.citationStyle),
      );
      const guardIssues = createSaveAsGuardReport({
        title: writingTitle,
        activeProjectId,
        projectKind: resolvedOptions.projectKind,
        auditIssueCount: auditIssues.filter((issue) => issue.severity !== "info").length,
        usedReferenceCount: usedReferences.length,
        sourceFileCount: projectSourceFiles.length,
      });
      const metadataXml = buildSaveAsMetadataXml({
        title: writingTitle,
        projectKind: resolvedOptions.projectKind,
        activeProjectId,
        activeSectionId: writeSession.activeSectionId,
        citationStyle: resolvedOptions.citationStyle,
        sourceFileCount: projectSourceFiles.length,
        usedReferenceCount: usedReferences.length,
        auditIssueCount: auditIssues.length,
      });
      const metadataText = [
        "Metadados KnexWriter",
        `Tipo do projeto: ${PROJECT_KIND_LABEL[resolvedOptions.projectKind]}`,
        `Estilo de referências: ${resolvedOptions.citationStyle.toUpperCase()}`,
        `Arquivos disponíveis: ${projectSourceFiles.length}`,
        `Referências usadas: ${usedReferences.length}`,
        `Pendências: ${auditIssues.filter((issue) => issue.severity !== "info").length}`,
        "",
        "Bibliografia final filtrada:",
        ...(formattedReferences.length ? formattedReferences : ["Nenhuma referência usada no texto."]),
        "",
        "Guards do salvamento:",
        ...(guardIssues.length ? guardIssues.map((issue) => `${issue.severity}: ${issue.message}`) : ["Nenhum guard acionado."]),
        "",
        metadataXml,
      ].join("\n");
      const metadataHtml = buildSaveAsMetadataHtml({
        projectKind: resolvedOptions.projectKind,
        citationStyle: resolvedOptions.citationStyle,
        usedReferences: formattedReferences,
        guardIssues,
      });

      return {
        options: resolvedOptions,
        auditIssues,
        auditIssueCount: auditIssues.filter((issue) => issue.severity !== "info").length,
        guardIssues,
        sourceFileCount: projectSourceFiles.length,
        usedReferences,
        usedReferenceCount: usedReferences.length,
        formattedReferences,
        metadataHtml,
        metadataText,
      };
    },
    [
      organization.projectKind,
      organization.projectReferences,
      organization.referenceUsages,
      organization.sourceFiles,
      writeSession.activeProjectId,
      writeSession.activeSectionId,
      writingTitle,
    ],
  );

  const ensureActiveProjectForGuardedSave = useCallback(
    async (options?: Partial<WriterSaveAsOptions>) => {
      const resolvedOptions: WriterSaveAsOptions = {
        ...createDefaultSaveAsOptions(organization.projectKind),
        ...options,
      };

      if (writeSession.activeProjectId) {
        organization.setProjectKindForProject(writeSession.activeProjectId, resolvedOptions.projectKind);
        return writeSession.activeProjectId;
      }

      const html = tiptapEditor?.getHTML() || writingDraftHtml;
      const bodyText = getTextFromHtml(html);
      const documentTitle =
        writingTitle.trim() && writingTitle.trim() !== "Documento sem título"
          ? writingTitle.trim()
          : importedDocument
            ? getBaseFileName(importedDocument.fileName)
            : `Projeto ${new Date().toLocaleDateString("pt-BR")}`;

      setWriteSession((current) => ({
        ...current,
        isSaving: true,
        saveError: null,
      }));
      setWritingError(null);

      try {
        const createdProject = await createWriteProject({
          title: documentTitle,
          description: importedDocument
            ? `Projeto criado a partir do arquivo ${importedDocument.fileName}.`
            : "Projeto criado automaticamente a partir do salvamento com guard.",
          objective: "",
          metadata: {
            origin: "knexwriter-save-as",
            projectKind: resolvedOptions.projectKind,
            sourceFileName: importedDocument?.fileName,
          },
        });
        const createdSection = await createWriteSection(createdProject.project_id, {
          title: "Documento principal",
          order: 0,
          objective: "Conteúdo inicial associado ao salvamento com guard.",
          outline_notes: "",
          status: "draft",
          content: bodyText || "",
        });

        organization.setProjectKindForProject(createdProject.project_id, resolvedOptions.projectKind);
        await refreshWriteProjects();

        setWritingTitle(documentTitle);
        setWriteSession((current) => ({
          ...current,
          activeProjectId: createdProject.project_id,
          activeSectionId: createdSection.section_id,
          loadedSections: [createdSection],
          loadedChunks: createdSection.chunks || [],
          projectSummary: null,
          sectionSummary: null,
          isSaving: false,
          isGenerating: false,
          hasUnsavedChanges: false,
          saveError: null,
          lastSyncedAt: new Date().toISOString(),
        }));
        setIsWritingWorksCollapsed(false);
        organization.setActiveOrganizationTab("projects");

        return createdProject.project_id;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Falha ao criar projeto para associar o salvamento.";
        const localProjectId = createLocalWriteProjectId();
        const nowIso = new Date().toISOString();

        organization.setProjectKindForProject(localProjectId, resolvedOptions.projectKind);
        setWriteSession((current) => ({
          ...current,
          activeProjectId: localProjectId,
          activeSectionId: null,
          loadedSections: [],
          loadedChunks: [],
          projectSummary: null,
          sectionSummary: null,
          isSaving: false,
          saveError: null,
          lastSyncedAt: nowIso,
        }));
        setIsWritingWorksCollapsed(false);
        organization.setActiveOrganizationTab("projects");
        setWritingNotice(
          `Backend de projetos indisponível (${message}). O arquivo será salvo com um guard local filtrável na Organização.`,
        );
        setWritingError(null);

        return localProjectId;
      }
    },
    [
      importedDocument,
      organization,
      refreshWriteProjects,
      tiptapEditor,
      writeSession.activeProjectId,
      writingDraftHtml,
      writingTitle,
    ],
  );

  const handleExportHtml = useCallback(() => {
    if (typeof window === "undefined") return;

    const html = tiptapEditor?.getHTML() || writingDraftHtml;
    const safeTitle = sanitizeFileName(writingTitle) || "knexwriter-documento";

    const fullHtml = buildPrintableHtml({
      title: writingTitle || "Documento KnexWriter",
      bodyHtml: html,
      headerHtml: headerFooter.headerHtml,
      footerHtml: headerFooter.footerHtml,
    });

    const blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" });
    downloadBlob(blob, `${safeTitle}.html`);
    setWritingNotice("Documento exportado em HTML.");
  }, [headerFooter.footerHtml, headerFooter.headerHtml, tiptapEditor, writingDraftHtml, writingTitle]);

  const handleExportTxt = useCallback(() => {
    if (typeof window === "undefined") return;

    const plainText = [
      getTextFromHtml(headerFooter.headerHtml),
      getTextFromHtml(writingDraftHtml),
      getTextFromHtml(headerFooter.footerHtml),
    ]
      .filter(Boolean)
      .join("\n\n");
    const safeTitle = sanitizeFileName(writingTitle) || "knexwriter-documento";
    const blob = new Blob([plainText || ""], { type: "text/plain;charset=utf-8" });
    downloadBlob(blob, `${safeTitle}.txt`);
    setWritingNotice("Documento exportado em TXT.");
  }, [headerFooter.footerHtml, headerFooter.headerHtml, writingDraftHtml, writingTitle]);

  const handleExportDocx = useCallback(
    async (options?: Partial<WriterSaveAsOptions>) => {
      if (typeof window === "undefined") return;

      const html = tiptapEditor?.getHTML() || writingDraftHtml;
      const safeTitle = sanitizeFileName(writingTitle) || "knexwriter-documento";
      const saveProjectId = await ensureActiveProjectForGuardedSave(options);
      const saveContext = buildSaveAsContext(options, saveProjectId);
      const bodyText = [
        getTextFromHtml(headerFooter.headerHtml),
        getTextFromHtml(html),
        getTextFromHtml(headerFooter.footerHtml),
      ]
        .filter(Boolean)
        .join("\n\n");
      const blob = createKnexWriterDocxBlob({
        title: writingTitle || "Documento KnexWriter",
        bodyText: bodyText || "Documento vazio.",
        metadataText: saveContext.options.includeOrganizationMetadata ? saveContext.metadataText : "",
      });
      const fileName = `${safeTitle}.docx`;

      downloadBlob(blob, fileName);
      organization.addSavedDocumentGuard({
        projectId: saveProjectId,
        title: writingTitle || "Documento KnexWriter",
        fileName,
        format: "docx",
        projectKind: saveContext.options.projectKind,
        citationStyle: saveContext.options.citationStyle,
        sourceFileCount: saveContext.sourceFileCount,
        usedReferenceCount: saveContext.usedReferenceCount,
        auditIssueCount: saveContext.auditIssueCount,
        guardIssues: saveContext.guardIssues,
      });
      setWritingNotice(
        saveContext.guardIssues.some((issue) => issue.severity === "warning")
          ? "DOCX salvo com guards de revisão registrados."
          : "DOCX KnexWriter salvo com metadados estruturais.",
      );
      setWritingError(null);
    },
    [buildSaveAsContext, ensureActiveProjectForGuardedSave, headerFooter.footerHtml, headerFooter.headerHtml, organization, tiptapEditor, writingDraftHtml, writingTitle],
  );

  const handleExportPdf = useCallback(
    async (options?: Partial<WriterSaveAsOptions>) => {
      if (typeof window === "undefined") return;

      const html = tiptapEditor?.getHTML() || writingDraftHtml;
      const printWindow = window.open("", "_blank", "noopener,noreferrer");

      if (!printWindow) {
        setWritingError("Não foi possível abrir a janela de impressão para salvar em PDF.");
        return;
      }

      const saveProjectId = await ensureActiveProjectForGuardedSave(options);
      const saveContext = buildSaveAsContext(options, saveProjectId);

      const printableHtml = buildPrintableHtml({
        title: writingTitle || "Documento KnexWriter",
        bodyHtml: html,
        headerHtml: headerFooter.headerHtml,
        footerHtml: headerFooter.footerHtml,
        metadataHtml: saveContext.options.includeOrganizationMetadata ? saveContext.metadataHtml : undefined,
      });

      printWindow.document.open();
      printWindow.document.write(printableHtml);
      printWindow.document.close();
      printWindow.focus();
      window.setTimeout(() => printWindow.print(), 250);
      organization.addSavedDocumentGuard({
        projectId: saveProjectId,
        title: writingTitle || "Documento KnexWriter",
        fileName: `${sanitizeFileName(writingTitle) || "knexwriter-documento"}.pdf`,
        format: "pdf",
        projectKind: saveContext.options.projectKind,
        citationStyle: saveContext.options.citationStyle,
        sourceFileCount: saveContext.sourceFileCount,
        usedReferenceCount: saveContext.usedReferenceCount,
        auditIssueCount: saveContext.auditIssueCount,
        guardIssues: saveContext.guardIssues,
      });
      setWritingNotice("PDF preparado. Use a janela de impressão para salvar como PDF.");
      setWritingError(null);
    },
    [buildSaveAsContext, ensureActiveProjectForGuardedSave, headerFooter.footerHtml, headerFooter.headerHtml, organization, tiptapEditor, writingDraftHtml, writingTitle],
  );

  const handleExportKnexWriterBundle = useCallback(
    async (options?: Partial<WriterSaveAsOptions>) => {
      if (typeof window === "undefined") return;

      const html = tiptapEditor?.getHTML() || writingDraftHtml;
      const safeTitle = sanitizeFileName(writingTitle) || "knexwriter-documento";
      const saveProjectId = await ensureActiveProjectForGuardedSave({ ...options, profile: "knexwriter" });
      const saveContext = buildSaveAsContext({ ...options, profile: "knexwriter" }, saveProjectId);
      const payload = {
        schema: "knexwriter.document.v1",
        title: writingTitle,
        html,
        projectKind: saveContext.options.projectKind,
        citationStyle: saveContext.options.citationStyle,
        exportedAt: new Date().toISOString(),
        organization: {
          sourceFiles: organization.sourceFiles,
          projectReferences: organization.projectReferences,
          referenceUsages: organization.referenceUsages,
          usedReferences: saveContext.formattedReferences,
          guards: saveContext.guardIssues,
          auditIssues: saveContext.auditIssues,
        },
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/vnd.knexwriter.document+json;charset=utf-8",
      });
      const fileName = `${safeTitle}.knexwriter.json`;

      downloadBlob(blob, fileName);
      organization.addSavedDocumentGuard({
        projectId: saveProjectId,
        title: writingTitle || "Documento KnexWriter",
        fileName,
        format: "knexwriter",
        projectKind: saveContext.options.projectKind,
        citationStyle: saveContext.options.citationStyle,
        sourceFileCount: saveContext.sourceFileCount,
        usedReferenceCount: saveContext.usedReferenceCount,
        auditIssueCount: saveContext.auditIssueCount,
        guardIssues: saveContext.guardIssues,
      });
      setWritingNotice("Modelo KnexWriter salvo com guards, filtros e metadados estruturais.");
      setWritingError(null);
    },
    [
      buildSaveAsContext,
      ensureActiveProjectForGuardedSave,
      organization.projectReferences,
      organization.referenceUsages,
      organization.sourceFiles,
      organization,
      tiptapEditor,
      writingDraftHtml,
      writingTitle,
    ],
  );

  const handleExportStandardDocx = useCallback(async () => {
    await handleExportDocx({ profile: "standard", includeOrganizationMetadata: false, includeReferenceAudit: false });
    setWritingError(null);
  }, [handleExportDocx]);

  const handleEditorInput = useCallback(
    (html: string) => {
      setWritingDraftHtml(html);
      setWritingNotice(null);

      setWriteSession((current: WriteEditorSessionState) => ({
        ...current,
        hasUnsavedChanges: true,
        saveError: null,
      }));

      schedulePassiveAnalysis(html);
      window.requestAnimationFrame(syncWritingPagination);
    },
    [schedulePassiveAnalysis, syncWritingPagination],
  );

  const resetWritingViewportToTop = useCallback(() => {
    setWritingActivePage(1);

    if (typeof window === "undefined") return;

    const attempt = (remaining: number) => {
      const scroller = writingScrollRef.current;
      if (!scroller) {
        if (remaining > 0) {
          window.setTimeout(() => attempt(remaining - 1), 40);
        }
        return;
      }

      scroller.scrollTo({ top: 0, left: 0, behavior: "auto" });
      scroller.scrollTop = 0;

      if (remaining > 0 && scroller.scrollTop !== 0) {
        window.setTimeout(() => attempt(remaining - 1), 40);
      }
    };

    attempt(24);
  }, []);

  useEffect(() => {
    if (!pendingViewportReset || isFileBackstageOpen) return;

    resetWritingViewportToTop();
    const timer = window.setTimeout(() => {
      resetWritingViewportToTop();
      setPendingViewportReset(false);
    }, 60);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isFileBackstageOpen, pendingViewportReset, resetWritingViewportToTop]);

  useLayoutEffect(() => {
    if (isFileBackstageOpen) return;

    if (!hasMountedViewportResetRef.current) {
      hasMountedViewportResetRef.current = true;
      return;
    }

    syncWritingPagination();
    resetWritingViewportToTop();

    if (typeof window === "undefined") return;

    const timers = [30, 120, 260].map((delay) =>
      window.setTimeout(() => {
        syncWritingPagination();
        resetWritingViewportToTop();
      }, delay),
    );

    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [editorDocumentVersion, isFileBackstageOpen, resetWritingViewportToTop, syncWritingPagination]);

  const handleChangeWritingTitle = useCallback((value: string) => {
    setWritingTitle(value);
    setWritingNotice(null);

    setWriteSession((current: WriteEditorSessionState) => ({
      ...current,
      hasUnsavedChanges: true,
    }));
  }, []);

  const handleOpenHeaderFooterEditor = useCallback(
    (target: WriterHeaderFooterTarget, pageIndex = 0) => {
      setHeaderFooter((current) => ({
        ...current,
        isEditing: true,
        activeTarget: target,
        activePageIndex: Math.max(0, pageIndex),
      }));
      setWritingNotice(
        target === "header"
          ? "Cabeçalho ativado para edição."
          : "Rodapé ativado para edição.",
      );
      setWritingError(null);
    },
    [],
  );

  const handleCloseHeaderFooterEditor = useCallback(() => {
    setHeaderFooter((current) => ({
      ...current,
      isEditing: false,
      activeTarget: null,
      activePageIndex: null,
    }));
  }, []);

  const handleChangeHeaderHtml = useCallback((html: string) => {
    setHeaderFooter((current) => ({
      ...current,
      headerHtml: html,
    }));
    setWriteSession((current: WriteEditorSessionState) => ({
      ...current,
      hasUnsavedChanges: true,
      saveError: null,
    }));
  }, []);

  const handleChangeFooterHtml = useCallback((html: string) => {
    setHeaderFooter((current) => ({
      ...current,
      footerHtml: html,
    }));
    setWriteSession((current: WriteEditorSessionState) => ({
      ...current,
      hasUnsavedChanges: true,
      saveError: null,
    }));
  }, []);

  const closeFileBackstage = useCallback(() => {
    setIsFileBackstageOpen(false);
    setActiveHeaderTab("home");
  }, []);

  const handleOpenPdfInKnexread = useCallback(
    async (input: KnexreadOpenRequest) => {
      try {
        const launchId = createKnexreadLaunch({
          file: input.file,
          projectId: input.projectId,
          documentId: input.documentId,
          sourceId: input.sourceId,
          sourceName: input.sourceName,
        });

        const params = new URLSearchParams();
        params.set("launchId", launchId);
        params.set("projectId", input.projectId);
        if (input.documentId) params.set("documentId", input.documentId);
        if (input.sourceId) params.set("sourceId", input.sourceId);
        if (input.sourceName) params.set("sourceName", input.sourceName);

        setWritingError(null);
        setWritingNotice("PDF aberto no Knexread.");
        closeFileBackstage();
        router.push(`/knexread/web?${params.toString()}`);
      } catch (error) {
        setWritingNotice(null);
        setWritingError(
          error instanceof Error
            ? error.message
            : "Falha ao abrir PDF no Knexread.",
        );
      }
    },
    [closeFileBackstage, router],
  );

  const handleSelectHeaderTab = useCallback((tab: WriterHeaderTab) => {
    if (tab === "file") {
      setActiveHeaderTab("file");
      setIsFileBackstageOpen(true);
      setActiveBackstageTab("home");
      return;
    }

    setActiveHeaderTab(tab);
    setIsFileBackstageOpen(false);
  }, []);

  const handleCreateBlankDocument = useCallback(() => {
    const emptyHtml = "<p><br /></p>";

    setWritingTitle("Documento sem título");
    setWritingDraftHtml(emptyHtml);
    setHeaderFooter(DEFAULT_HEADER_FOOTER_STATE);
    setImportedDocument(null);
    setEditorDocumentVersion((current) => current + 1);
    setWritingPageCount(1);
    setWritingActivePage(1);
    setWritingPageBreakOffsets([]);
    setWritingPageFillRatios([1]);

    setWriteSession((current) => ({
      ...current,
      hasUnsavedChanges: true,
      saveError: null,
      activeProjectId: current.activeProjectId,
      activeSectionId: current.activeSectionId,
    }));

    setWritingNotice("Novo documento em branco criado.");
    setWritingError(null);
    schedulePassiveAnalysis(emptyHtml);

    if (typeof window !== "undefined") {
      window.requestAnimationFrame(syncWritingPagination);
    }
    setPendingViewportReset(true);

    pushRecentDocument({
      id: `local:blank:${Date.now()}`,
      title: "Documento sem título",
      subtitle: "Documento em branco criado",
      source: "local",
      updatedAt: new Date().toISOString(),
      previewHtml: emptyHtml,
    });

    closeFileBackstage();
  }, [closeFileBackstage, pushRecentDocument, schedulePassiveAnalysis, syncWritingPagination]);


  const handleCloseActiveEditorDocument = useCallback(() => {
    const emptyHtml = "<h1></h1><p></p>";

    setWritingTitle("Documento sem título");
    setWritingDraftHtml(emptyHtml);
    setHeaderFooter(DEFAULT_HEADER_FOOTER_STATE);
    setImportedDocument(null);
    setEditorDocumentVersion((current) => current + 1);
    setWritingPageCount(1);
    setWritingActivePage(1);
    setWritingPageBreakOffsets([]);
    setWritingPageFillRatios([1]);

    setWriteSession((current) => ({
      ...current,
      activeSectionId: null,
      loadedChunks: [],
      sectionSummary: null,
      currentInstruction: "",
      hasUnsavedChanges: false,
      saveError: null,
    }));

    setWritingNotice("Documento fechado.");
    setWritingError(null);
    setPendingViewportReset(true);

    if (typeof window !== "undefined") {
      window.requestAnimationFrame(syncWritingPagination);
    }
  }, [syncWritingPagination]);

  const importLocalDocument = useCallback(
    async (file: File) => {
      setIsImportingDocument(true);
      setWritingError(null);
      setWritingNotice(null);

      try {
        if (isPdfFileCandidate(file.type, file.name)) {
          const resolvedProjectId =
            writeSession.activeProjectId ?? `local-${organization.projectKind}`;
          const resolvedDocumentId =
            writeSession.activeSectionId ?? writeSession.editorSessionId;

          await handleOpenPdfInKnexread({
            file,
            projectId: resolvedProjectId,
            documentId: resolvedDocumentId,
            sourceName: file.name,
          });
          return;
        }

        const converted = await convertImportedFileToEditableHtml(file);
        const normalizedHtml = trimLeadingEmptyBlocksFromHtml(converted.html);
        const nextTitle = getBaseFileName(file.name);

        replaceEditorHtml(normalizedHtml);
        setWritingTitle(nextTitle);
        setImportedDocument({
          fileName: file.name,
          fileType: getFileExtension(file.name) || file.type || "desconhecido",
          fileSize: file.size,
          importedAt: new Date().toISOString(),
          conversionMode: converted.conversionMode,
          warning: converted.warning,
        });

        setWriteSession((current: WriteEditorSessionState) => ({
          ...current,
          hasUnsavedChanges: true,
          saveError: null,
          lastSyncedAt: new Date().toISOString(),
        }));

        pushRecentDocument({
          id: `imported:${file.name}:${Date.now()}`,
          title: nextTitle,
          subtitle: "Arquivo aberto do computador",
          source: "imported",
          updatedAt: new Date().toISOString(),
          fileType: getFileExtension(file.name) || file.type || "desconhecido",
          previewHtml: normalizedHtml,
        });

        setWritingNotice(
          converted.warning
            ? `Arquivo importado com aviso: ${converted.warning}`
            : "Arquivo importado e renderizado no palco como documento editável.",
        );
        setPendingViewportReset(true);
        closeFileBackstage();
      } catch (importError: unknown) {
        const message =
          importError instanceof Error ? importError.message : "Falha ao importar o arquivo selecionado.";

        setWritingError(message);
      } finally {
        setIsImportingDocument(false);
      }
    },
    [
      closeFileBackstage,
      handleOpenPdfInKnexread,
      organization.projectKind,
      pushRecentDocument,
      replaceEditorHtml,
      writeSession.activeProjectId,
      writeSession.activeSectionId,
      writeSession.editorSessionId,
    ],
  );

  const handleOpenFileFromWindows = useCallback(async () => {
    if (typeof window === "undefined") return;

    const picker = (window as BrowserWindowWithFilePicker).showOpenFilePicker;

    if (!picker) {
      importedFileInputRef.current?.click();
      return;
    }

    try {
      const handles = await picker.call(window, KNEXWRITER_FILE_PICKER_OPTIONS);
      const selectedFile = await handles[0]?.getFile();

      if (selectedFile) {
        await importLocalDocument(selectedFile);
      }
    } catch (pickerError: unknown) {
      if (pickerError instanceof DOMException && pickerError.name === "AbortError") {
        return;
      }

      importedFileInputRef.current?.click();
    }
  }, [importLocalDocument]);

  const handleHiddenFileInputChange = useCallback(
    (event: ReactChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files?.[0] || null;

      event.target.value = "";

      if (!selectedFile) return;

      void importLocalDocument(selectedFile);
    },
    [importLocalDocument],
  );

  const handleHiddenSourceFilesInputChange = useCallback(
    (event: ReactChangeEvent<HTMLInputElement>) => {
      const activeProjectId = writeSession.activeProjectId;
      const selectedFiles = Array.from(event.target.files ?? []);
      const mode = sourcePickerModeRef.current;

      event.target.value = "";
      event.target.removeAttribute("webkitdirectory");

      if (!activeProjectId) {
        setWritingError("Selecione um projeto antes de vincular fontes.");
        return;
      }

      if (!selectedFiles.length) return;

      const rootFolderName =
        mode === "directory"
          ? selectedFiles
              .map((file) => file.webkitRelativePath.split("/")[0])
              .find(Boolean)
          : undefined;

      if (mode === "directory" && rootFolderName) {
        organization.linkProjectDirectory(activeProjectId, {
          handleId: `fallback-directory-${activeProjectId}-${rootFolderName}`,
          name: rootFolderName,
        });
      }

      registerSourceCandidates(
        activeProjectId,
        selectedFiles.map((file) =>
          createSourceCandidateFromFile(file, {
            rootFolderName,
            directoryHandleId: rootFolderName ? `fallback-directory-${activeProjectId}-${rootFolderName}` : undefined,
          }),
        ),
      );
    },
    [organization, registerSourceCandidates, writeSession.activeProjectId],
  );

  const handleLinkSourceFilesFromWindows = useCallback(async () => {
    const activeProjectId = writeSession.activeProjectId;
    if (!activeProjectId) {
      setWritingError("Selecione um projeto antes de vincular fontes.");
      setIsWritingWorksCollapsed(false);
      organization.setActiveOrganizationTab("projects");
      return;
    }

    setIsWritingWorksCollapsed(false);

    if (!isFileSystemAccessSupported()) {
      sourcePickerModeRef.current = "files";
      sourceFilesInputRef.current?.click();
      return;
    }

    try {
      const candidates = await requestSourceFilesAccess(activeProjectId);
      registerSourceCandidates(activeProjectId, candidates);
    } catch (pickerError: unknown) {
      if (pickerError instanceof DOMException && pickerError.name === "AbortError") return;
      sourcePickerModeRef.current = "files";
      sourceFilesInputRef.current?.click();
    }
  }, [organization, registerSourceCandidates, writeSession.activeProjectId]);

  const handleLinkProjectDirectory = useCallback(async () => {
    const activeProjectId = writeSession.activeProjectId;
    if (!activeProjectId) {
      setWritingError("Selecione um projeto antes de vincular uma pasta de fontes.");
      setIsWritingWorksCollapsed(false);
      organization.setActiveOrganizationTab("projects");
      return;
    }

    setIsWritingWorksCollapsed(false);

    try {
      const linkedDirectory = await requestProjectDirectoryAccess(activeProjectId);
      organization.linkProjectDirectory(activeProjectId, {
        handleId: linkedDirectory.directoryHandleId,
        name: linkedDirectory.directoryName,
      });
      registerSourceCandidates(activeProjectId, linkedDirectory.sourceFiles);
    } catch (pickerError: unknown) {
      if (pickerError instanceof DOMException && pickerError.name === "AbortError") return;
      sourcePickerModeRef.current = "directory";
      sourceFilesInputRef.current?.setAttribute("webkitdirectory", "");
      sourceFilesInputRef.current?.click();
    }
  }, [organization, registerSourceCandidates, writeSession.activeProjectId]);

  const handleAddManualReference = useCallback(() => {
    setIsWritingWorksCollapsed(false);
    organization.setActiveOrganizationTab("references");
    organization.setActiveReferenceFilter("available_sources");
    setWritingNotice("Cadastro manual de referência preparado. Informe os metadados na próxima etapa.");
  }, [organization]);

  const toggleOrganizationPanel = useCallback(() => {
    setIsWritingWorksCollapsed((current) => !current);
    organization.setActiveOrganizationTab("projects");
  }, [organization]);

  const handleImportWritingFile = useCallback(
    async (file: File) => {
      await importLocalDocument(file);
    },
    [importLocalDocument],
  );

  const handleSelectBackstageTab = useCallback(
    (tab: BackstageTab) => {
      setActiveBackstageTab(tab);

      if (tab === "close") {
        closeFileBackstage();
      }
    },
    [closeFileBackstage],
  );

  const handleOpenRecentDocument = useCallback(
    async (document: WriterRecentDocument) => {
      if (document.projectId) {
        await openWriteProjectSession(document.projectId, document.sectionId ?? null);
        setPendingViewportReset(true);
        pushRecentDocument({
          ...document,
          updatedAt: new Date().toISOString(),
        });
        closeFileBackstage();
        return;
      }

      if (document.previewHtml) {
        replaceEditorHtml(document.previewHtml);
        setPendingViewportReset(true);
        setWritingTitle(document.title);
        setImportedDocument(null);
        pushRecentDocument({
          ...document,
          updatedAt: new Date().toISOString(),
        });
        closeFileBackstage();
        return;
      }

      if (document.source === "fallback") {
        handleCreateBlankDocument();
      }
    },
    [closeFileBackstage, handleCreateBlankDocument, openWriteProjectSession, pushRecentDocument, replaceEditorHtml],
  );

  const sendWritingAssist = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();

      if (!trimmed || writingStatus === "thinking" || writeSession.isGenerating) return;

      setWritingPrompt("");
      setWritingStatus("thinking");
      setWritingError(null);
      setWritingNotice(null);

      setWriteSession((current: WriteEditorSessionState) => ({
        ...current,
        currentInstruction: trimmed,
        isGenerating: true,
        saveError: null,
      }));

      const activeProjectId = writeSession.activeProjectId;
      const activeSectionId = writeSession.activeSectionId;

      if (!activeProjectId || !activeSectionId) {
        setWritingStatus("error");
        setWritingError("Crie ou selecione um projeto e uma seção antes de gerar texto.");

        setWriteSession((current: WriteEditorSessionState) => ({
          ...current,
          isGenerating: false,
          saveError: "Projeto ou seção ausente.",
        }));

        return;
      }

      try {
        const payload = (await continueWrite({
          project_id: activeProjectId,
          section_id: activeSectionId,
          instruction: trimmed,
        })) as {
          section_id?: string;
          chunk?: WriteChunkView;
          section_summary_used?: WriteSectionSummaryView | null;
          project_global_summary_used?: WriteProjectGlobalSummaryView | null;
        };

        const generatedChunk = payload.chunk;
        const targetSectionId = payload.section_id || activeSectionId;

        if (!generatedChunk?.text) {
          throw new Error("A API de escrita não retornou um bloco de texto válido.");
        }

        insertWritingText(generatedChunk.text);

        setWriteSession((current: WriteEditorSessionState) => ({
          ...current,
          loadedChunks: [...current.loadedChunks, generatedChunk],
          loadedSections: current.loadedSections.map((section: WriteSectionView) =>
            section.section_id === targetSectionId
              ? {
                  ...section,
                  chunks: [...(section.chunks || []), generatedChunk],
                }
              : section,
          ),
          sectionSummary: payload.section_summary_used || current.sectionSummary,
          projectSummary: payload.project_global_summary_used || current.projectSummary,
          isGenerating: false,
          hasUnsavedChanges: false,
          lastSyncedAt: new Date().toISOString(),
          saveError: null,
        }));

        setWritingStatus("idle");
        setWritingNotice("Novo bloco gerado com assistência de IA.");
      } catch (continueError: unknown) {
        const message =
          continueError instanceof Error ? continueError.message : "Falha ao gerar continuidade de escrita.";

        setWriteSession((current: WriteEditorSessionState) => ({
          ...current,
          isGenerating: false,
          saveError: message,
        }));

        setWritingStatus("error");
        setWritingError(message);
      }
    },
    [
      insertWritingText,
      writeSession.activeProjectId,
      writeSession.activeSectionId,
      writeSession.isGenerating,
      writingStatus,
    ],
  );

  const startWritingNavResize = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (isWritingNavCollapsed) return;

      writingNavResizeRef.current = {
        startX: event.clientX,
        startWidthPercent: writingNavWidthPercent,
      };
    },
    [isWritingNavCollapsed, writingNavWidthPercent],
  );

  const startWritingWorksResize = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (isWritingWorksCollapsed) return;

      writingWorksResizeRef.current = {
        startX: event.clientX,
        startWidthPercent: writingWorksWidthPercent,
      };
    },
    [isWritingWorksCollapsed, writingWorksWidthPercent],
  );

  const handleMouseMove = useCallback((event: MouseEvent) => {
    const workspace = writingWorkspaceRef.current;

    if (!workspace) return;

    const workspaceWidth = workspace.getBoundingClientRect().width;

    if (!workspaceWidth) return;

    const navState = writingNavResizeRef.current;

    if (navState) {
      const deltaX = event.clientX - navState.startX;
      const deltaPercent = (deltaX / workspaceWidth) * 100;

      const nextPercent = clampNumber(
        navState.startWidthPercent + deltaPercent,
        WRITING_NAV_MIN_WIDTH_PERCENT,
        WRITING_NAV_MAX_WIDTH_PERCENT,
      );

      setWritingNavWidthPercent(nextPercent);
    }

    const worksState = writingWorksResizeRef.current;

    if (worksState) {
      const deltaX = worksState.startX - event.clientX;
      const deltaPercent = (deltaX / workspaceWidth) * 100;

      const nextPercent = clampNumber(
        worksState.startWidthPercent + deltaPercent,
        WRITING_WORKS_MIN_WIDTH_PERCENT,
        WRITING_WORKS_MAX_WIDTH_PERCENT,
      );

      setWritingWorksWidthPercent(nextPercent);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    writingNavResizeRef.current = null;
    writingWorksResizeRef.current = null;
  }, []);

  const captureWritingZoomAnchor = useCallback(() => {
    const scroller = writingScrollRef.current;
    const pageRoot = writingPageRootRef.current;

    if (!scroller || !pageRoot) {
      writingZoomAnchorRef.current = null;
      return;
    }

    const zoomScale = Math.max(0.5, writingCanvasZoomPercent / 100);

    writingZoomAnchorRef.current = {
      xPx: (scroller.scrollLeft + scroller.clientWidth / 2 - pageRoot.offsetLeft) / zoomScale,
      yPx: (scroller.scrollTop + scroller.clientHeight / 2 - pageRoot.offsetTop) / zoomScale,
    };
  }, [writingCanvasZoomPercent]);

  const setWritingCanvasZoomPercentFromAction = useCallback(
    (nextValue: SetStateAction<number>) => {
      captureWritingZoomAnchor();
      setWritingCanvasZoomPercent((current) => {
        const resolvedValue =
          typeof nextValue === "function"
            ? (nextValue as (currentValue: number) => number)(current)
            : nextValue;

        return clampNumber(
          resolvedValue,
          WRITING_CANVAS_ZOOM_MIN_PERCENT,
          WRITING_CANVAS_ZOOM_MAX_PERCENT,
        );
      });
    },
    [captureWritingZoomAnchor],
  );

  const hydrateWriteWorkspace = useCallback(async () => {
    try {
      const projects = await listWriteProjects(80);

      setWriteProjects(projects);

      const targetProjectId = projects[0]?.project_id;

      if (targetProjectId) {
        await openWriteProjectSession(targetProjectId, null);
        return;
      }

      setWriteSession((current: WriteEditorSessionState) => ({
        ...current,
        activeProjectId: null,
        activeSectionId: null,
        loadedSections: [],
        loadedChunks: [],
        projectSummary: null,
        sectionSummary: null,
        hasUnsavedChanges: false,
        isSaving: false,
        saveError: null,
        lastSyncedAt: new Date().toISOString(),
      }));

      setWritingNotice("Nenhum projeto de escrita encontrado. Crie um novo para iniciar.");
    } catch (hydrateError: unknown) {
      const message =
        hydrateError instanceof Error ? hydrateError.message : "Falha ao carregar workspace de escrita.";

      setWriteSession((current: WriteEditorSessionState) => ({
        ...current,
        isSaving: false,
        saveError: message,
      }));

      setWritingError(message);
    }
  }, [openWriteProjectSession]);

  useEffect(() => {
    void hydrateWriteWorkspace();
  }, [hydrateWriteWorkspace]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(KNEXWRITER_RECENT_DOCUMENTS_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as WriterRecentDocument[];
      if (!Array.isArray(parsed)) return;

      setRecentDocuments(parsed.slice(0, KNEXWRITER_MAX_RECENT_DOCUMENTS));
    } catch {
      // Ignore malformed persisted history.
    }
  }, []);

  useLayoutEffect(() => {
    const scroller = writingScrollRef.current;
    const pageRoot = writingPageRootRef.current;
    const previousZoom = previousCanvasZoomPercentRef.current;
    const nextZoom = writingCanvasZoomPercent;

    if (!scroller || !pageRoot) {
      previousCanvasZoomPercentRef.current = nextZoom;
      writingZoomAnchorRef.current = null;
      return;
    }

    if (previousZoom === nextZoom) return;

    const previousZoomScale = Math.max(0.5, previousZoom / 100);
    const currentAnchor =
      writingZoomAnchorRef.current ?? {
        xPx: (scroller.scrollLeft + scroller.clientWidth / 2 - pageRoot.offsetLeft) / previousZoomScale,
        yPx: (scroller.scrollTop + scroller.clientHeight / 2 - pageRoot.offsetTop) / previousZoomScale,
      };
    const nextZoomScale = Math.max(0.5, nextZoom / 100);

    const repositionToZoomAnchor = () => {
      const maxScrollLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
      const maxScrollTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);

      const nextScrollLeft = clampNumber(
        pageRoot.offsetLeft + currentAnchor.xPx * nextZoomScale - scroller.clientWidth / 2,
        0,
        maxScrollLeft,
      );
      const nextScrollTop = clampNumber(
        pageRoot.offsetTop + currentAnchor.yPx * nextZoomScale - scroller.clientHeight / 2,
        0,
        maxScrollTop,
      );

      scroller.scrollTo({ left: nextScrollLeft, top: nextScrollTop });
    };

    repositionToZoomAnchor();

    previousCanvasZoomPercentRef.current = nextZoom;
    writingZoomAnchorRef.current = null;
  }, [writingCanvasZoomPercent]);

  useEffect(() => {
    const editor = writingEditorRef.current;

    if (!editor) return;

    const updatePagination = () => syncWritingPagination();

    updatePagination();

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(updatePagination) : null;

    resizeObserver?.observe(editor);

    window.addEventListener("resize", updatePagination);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updatePagination);
    };
  }, [syncWritingPagination]);

  useEffect(() => {
    const workspace = writingWorkspaceRef.current;
    const scroller = writingScrollRef.current;

    if (!workspace || !scroller) return;

    const adjustCanvasZoom = (delta: number) => {
      setWritingCanvasZoomPercentFromAction((current) =>
        clampNumber(
          current + delta,
          WRITING_CANVAS_ZOOM_MIN_PERCENT,
          WRITING_CANVAS_ZOOM_MAX_PERCENT,
        ),
      );
    };

    const handleCtrlWheelZoom = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      adjustCanvasZoom(event.deltaY < 0 ? WRITING_CANVAS_ZOOM_STEP_PERCENT : -WRITING_CANVAS_ZOOM_STEP_PERCENT);
    };

    const handleCtrlKeyZoom = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (!document.body.contains(workspace)) return;

      const key = event.key;

      if (key === "+" || key === "=") {
        event.preventDefault();
        adjustCanvasZoom(WRITING_CANVAS_ZOOM_STEP_PERCENT);
        return;
      }

      if (key === "-" || key === "_") {
        event.preventDefault();
        adjustCanvasZoom(-WRITING_CANVAS_ZOOM_STEP_PERCENT);
        return;
      }

      if (key === "0") {
        event.preventDefault();
        setWritingCanvasZoomPercentFromAction(100);
      }
    };

    scroller.addEventListener("wheel", handleCtrlWheelZoom, { passive: false });
    window.addEventListener("keydown", handleCtrlKeyZoom, { capture: true });

    return () => {
      scroller.removeEventListener("wheel", handleCtrlWheelZoom);
      window.removeEventListener("keydown", handleCtrlKeyZoom, { capture: true });
    };
  }, [setWritingCanvasZoomPercentFromAction]);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  useEffect(() => {
    return () => {
      if (passiveAnalysisTimerRef.current) {
        window.clearTimeout(passiveAnalysisTimerRef.current);
      }
    };
  }, []);

  return (
    <>
      <KnexWriterRender
        refs={{
          writingEditorRef: writingEditorRef as RefObject<HTMLDivElement>,
          writingScrollRef: writingScrollRef as RefObject<HTMLDivElement>,
          writingPageRootRef: writingPageRootRef as RefObject<HTMLDivElement>,
          writingWorkspaceRef: writingWorkspaceRef as RefObject<HTMLDivElement>,
          importedFileInputRef: importedFileInputRef as RefObject<HTMLInputElement>,
          sourceFilesInputRef: sourceFilesInputRef as RefObject<HTMLInputElement>,
        }}
        layout={layoutMetrics}
        state={{
          activeBackstageTab,
          activeHeaderTab,
          activeProject,
          activeSection,
          analysisError,
          analysisStatusLabel,
          contextClusters: filteredContextClusters,
          documentStateClass,
          documentStateLabel,
          documentWordCount,
          editor: tiptapEditor,
          editorDocumentVersion,
          importedDocument,
          headerFooter,
          isFileBackstageOpen,
          isImportingDocument,
          isFileSystemAccessAvailable,
          isWritingNavCollapsed,
          isWritingWorksCollapsed,
          organization,
          pageSettings,
          paragraphIndents,
          recentDocuments: filteredBackstageRecentDocuments,
          rulerGuide,
          rulerSettings,
          backstageSearchQuery,
          tabStops,
          tabStopInsertType,
          writingActivePage,
          writingCanvasZoomPercent,
          writingDraftHtml,
          writingError,
          writingFilteredHeadings,
          writingFilteredProjects,
          writingFilteredSections,
          writingNavQuery,
          writingNavTab,
          writingNavWidthPercent,
          writingNotice,
          writingPageBreakOffsets,
          writingPageCount,
          writingPageFillRatios,
          writingPaginationGeometry,
          writingPages,
          writingPrompt,
          writingRightPanelTab,
          writingStatus,
          writingTitle,
          writingWorksQuery,
          writingWorksWidthPercent,
          writeProjects,
          writeSession,
        }}
        actions={{
          applyWritingCommand,
          closeFileBackstage,
          handleCopySelection,
          handleCreateBlankDocument,
          handleCloseActiveEditorDocument,
          handleChangePageMargins,
          handleChangeHeaderDistanceFromTop,
          handleChangeFooterDistanceFromBottom,
          handleChangeWritingActivePage,
          handleChangeParagraphIndents,
          handleChangeTabStops,
          handleCycleTabStopInsertType,
          handleChangeWritingTitle,
          handleOpenHeaderFooterEditor,
          handleCloseHeaderFooterEditor,
          handleChangeHeaderHtml,
          handleChangeFooterHtml,
          handleCreateWriteProject,
          handleCreateWriteSection,
          handleCutSelection,
          handleEditorInput,
          handleExportDocx,
          handleExportHtml,
          handleExportKnexWriterBundle,
          handleExportPdf,
          handleExportStandardDocx,
          handleExportTxt,
          handleHiddenFileInputChange,
          handleHiddenSourceFilesInputChange,
          handleImportWritingFile,
          handleLinkProjectDirectory,
          handleLinkSourceFilesFromWindows,
          handleAddManualReference,
          handleOpenRecentDocument,
          handleOpenFileFromWindows,
          handleOpenPdfInKnexread,
          handleMeasuredPaginationChange,
          handlePasteFromClipboard,
          handleSaveLocalDraft,
          handleSelectBackstageTab,
          handleSelectHeaderTab,
          handleSelectWriteSection,
          insertCitationFromSource,
          jumpToWritingHeading,
          jumpToWritingPage,
          linkSelectedTextToReference,
          openWriteProjectSession,
          refreshWriteProjects,
          registerSourceFileFromOrganization,
          sendWritingAssist,
          setIsWritingNavCollapsed,
          setIsWritingWorksCollapsed,
          setBackstageSearchQuery,
          setWritingNavQuery,
          setWritingNavTab,
          setWritingPrompt,
          setWritingRightPanelTab,
          setWritingCanvasZoomPercent: setWritingCanvasZoomPercentFromAction,
          setWritingWorksQuery,
          startWritingNavResize,
          startWritingWorksResize,
          toggleOrganizationPanel,
        }}
      />
    </>
  );
}

/**
 * ============================================================================
 * TIPOS DA RENDERIZAÇÃO
 * ============================================================================
 */

export type WriterRefs = {
  writingEditorRef: RefObject<HTMLDivElement>;
  writingScrollRef: RefObject<HTMLDivElement>;
  writingPageRootRef: RefObject<HTMLDivElement>;
  writingWorkspaceRef: RefObject<HTMLDivElement>;
  importedFileInputRef: RefObject<HTMLInputElement>;
  sourceFilesInputRef: RefObject<HTMLInputElement>;
};

export type WriterRenderState = {
  activeBackstageTab: BackstageTab;
  activeHeaderTab: WriterHeaderTab;
  activeProject: WriteProjectListItem | null;
  activeSection: WriteSectionView | null;
  analysisError: string | null;
  analysisStatusLabel: string;
  backstageSearchQuery: string;
  contextClusters: KnexWriterContextCluster[];
  documentStateClass: string;
  documentStateLabel: string;
  documentWordCount: number;
  editor: Editor | null;
  editorDocumentVersion: number;
  importedDocument: ImportedDocumentState | null;
  headerFooter: WriterHeaderFooterState;
  isFileBackstageOpen: boolean;
  isFileSystemAccessAvailable: boolean;
  isImportingDocument: boolean;
  isWritingNavCollapsed: boolean;
  isWritingWorksCollapsed: boolean;
  organization: OrganizationStoreController;
  pageSettings: WriterPageSettings;
  paragraphIndents: ParagraphIndents;
  recentDocuments: WriterRecentDocument[];
  rulerGuide: RulerGuideState;
  rulerSettings: RulerSettings;
  tabStops: TabStop[];
  tabStopInsertType: TabStopType;
  writingActivePage: number;
  writingCanvasZoomPercent: number;
  writingDraftHtml: string;
  writingError: string | null;
  writingFilteredHeadings: HeadingItem[];
  writingFilteredProjects: WriteProjectListItem[];
  writingFilteredSections: WriteSectionView[];
  writingNavQuery: string;
  writingNavTab: WritingNavTab;
  writingNavWidthPercent: number;
  writingNotice: string | null;
  writingPageBreakOffsets: number[];
  writingPageCount: number;
  writingPageFillRatios: number[];
  writingPaginationGeometry: WriterPaginationGeometry;
  writingPages: number[];
  writingPrompt: string;
  writingRightPanelTab: WritingRightPanelTab;
  writingStatus: "idle" | "thinking" | "error";
  writingTitle: string;
  writingWorksQuery: string;
  writingWorksWidthPercent: number;
  writeProjects: WriteProjectListItem[];
  writeSession: WriteEditorSessionState;
};

export type WriterRenderActions = {
  applyWritingCommand: (command: WritingFormatCommand, value?: string) => void;
  closeFileBackstage: () => void;
  handleCopySelection: () => void;
  handleCreateBlankDocument: () => void;
  handleCloseActiveEditorDocument: () => void;
  handleChangePageMargins: (nextMargins: PageMargins) => void;
  handleChangeHeaderDistanceFromTop: (nextDistancePx: number) => void;
  handleChangeFooterDistanceFromBottom: (nextDistancePx: number) => void;
  handleChangeWritingActivePage: (pageNumber: number) => void;
  handleChangeParagraphIndents: (nextIndents: ParagraphIndents) => void;
  handleChangeTabStops: (nextTabStops: TabStop[]) => void;
  handleCycleTabStopInsertType: () => void;
  handleChangeWritingTitle: (value: string) => void;
  handleOpenHeaderFooterEditor: (target: WriterHeaderFooterTarget, pageIndex?: number) => void;
  handleCloseHeaderFooterEditor: () => void;
  handleChangeHeaderHtml: (html: string) => void;
  handleChangeFooterHtml: (html: string) => void;
  handleCreateWriteProject: () => Promise<void>;
  handleCreateWriteSection: () => Promise<void>;
  handleCutSelection: () => void;
  handleEditorInput: (html: string) => void;
  handleExportDocx: (options?: Partial<WriterSaveAsOptions>) => Promise<void>;
  handleExportHtml: () => void;
  handleExportKnexWriterBundle: (options?: Partial<WriterSaveAsOptions>) => Promise<void>;
  handleExportPdf: (options?: Partial<WriterSaveAsOptions>) => Promise<void>;
  handleExportStandardDocx: () => Promise<void>;
  handleExportTxt: () => void;
  handleHiddenFileInputChange: (event: ReactChangeEvent<HTMLInputElement>) => void;
  handleHiddenSourceFilesInputChange: (event: ReactChangeEvent<HTMLInputElement>) => void;
  handleImportWritingFile: (file: File) => Promise<void>;
  handleLinkProjectDirectory: () => Promise<void>;
  handleLinkSourceFilesFromWindows: () => Promise<void>;
  handleAddManualReference: () => void;
  handleMeasuredPaginationChange: (measurement: KnexWriterMeasuredPagination) => void;
  handleOpenRecentDocument: (document: WriterRecentDocument) => Promise<void>;
  handleOpenFileFromWindows: () => Promise<void>;
  handleOpenPdfInKnexread: (input: KnexreadOpenRequest) => Promise<void>;
  handlePasteFromClipboard: () => Promise<void>;
  handleSaveLocalDraft: () => void;
  handleSelectBackstageTab: (tab: BackstageTab) => void;
  handleSelectHeaderTab: (tab: WriterHeaderTab) => void;
  handleSelectWriteSection: (sectionId: string) => Promise<void>;
  insertCitationFromSource: (input: InsertCitationFromSourceInput) => void;
  jumpToWritingHeading: (headingText: string) => void;
  jumpToWritingPage: (pageNumber: number) => void;
  linkSelectedTextToReference: (input: LinkSelectedTextToReferenceInput) => void;
  openWriteProjectSession: (projectId: string, preferredSectionId?: string | null) => Promise<void>;
  refreshWriteProjects: () => Promise<WriteProjectListItem[]>;
  registerSourceFileFromOrganization: (input: Omit<AddSourceFileInput, "projectId">) => void;
  sendWritingAssist: (prompt: string) => Promise<void>;
  setIsWritingNavCollapsed: Dispatch<SetStateAction<boolean>>;
  setIsWritingWorksCollapsed: Dispatch<SetStateAction<boolean>>;
  setBackstageSearchQuery: Dispatch<SetStateAction<string>>;
  setWritingNavQuery: Dispatch<SetStateAction<string>>;
  setWritingNavTab: Dispatch<SetStateAction<WritingNavTab>>;
  setWritingPrompt: Dispatch<SetStateAction<string>>;
  setWritingRightPanelTab: Dispatch<SetStateAction<WritingRightPanelTab>>;
  setWritingCanvasZoomPercent: Dispatch<SetStateAction<number>>;
  setWritingWorksQuery: Dispatch<SetStateAction<string>>;
  startWritingNavResize: (event: ReactMouseEvent<HTMLDivElement>) => void;
  startWritingWorksResize: (event: ReactMouseEvent<HTMLDivElement>) => void;
  toggleOrganizationPanel: () => void;
};

export type WriterRenderProps = {
  refs: WriterRefs;
  layout: WriterLayoutMetrics;
  state: WriterRenderState;
  actions: WriterRenderActions;
};

export type WriterRibbonProps = Pick<WriterRenderProps, "state" | "actions">;

/**
 * ============================================================================
 * RENDERIZAÇÃO PRINCIPAL
 * ============================================================================
 */

function KnexWriterRender({ refs, layout, state, actions }: WriterRenderProps) {
  return (
    <main className="flex h-screen min-h-screen bg-[#f7f7f8] text-zinc-900">
      <section className="flex min-w-0 flex-1 flex-col bg-white">
        <input
          ref={refs.importedFileInputRef}
          type="file"
          accept={KNEXWRITER_ACCEPTED_FILE_EXTENSIONS}
          className="hidden"
          onChange={actions.handleHiddenFileInputChange}
          aria-hidden="true"
          tabIndex={-1}
        />
        <input
          ref={refs.sourceFilesInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={actions.handleHiddenSourceFilesInputChange}
          aria-hidden="true"
          tabIndex={-1}
        />

        <KnexWriterHeader state={state} actions={actions} />
        {!state.isFileBackstageOpen ? <KnexWriterRibbon state={state} actions={actions} /> : null}

        {state.isFileBackstageOpen ? (
          <KnexWriterFileBackstage state={state} actions={actions} />
        ) : (
          <KnexWriterWorkspaceNormal refs={refs} layout={layout} state={state} actions={actions} />
        )}

        <KnexWriterFooter state={state} actions={actions} />
      </section>
    </main>
  );
}

type WriterWorkspaceSurface = "start" | "editor";

type WriterOpenDocumentTab = {
  id: string;
  title: string;
  subtitle: string;
  dirty: boolean;
  source: "imported" | "section" | "local";
};

function getActiveEditorDocumentTab(state: WriterRenderState): WriterOpenDocumentTab {
  const hasNamedDocument =
    Boolean(state.writingTitle?.trim()) && state.writingTitle.trim() !== "Documento sem título";

  const title = state.importedDocument?.fileName?.trim()
    || state.activeSection?.title?.trim()
    || (hasNamedDocument ? state.writingTitle.trim() : "Documento sem título");

  const subtitle = state.importedDocument
    ? `${state.importedDocument.fileType.toUpperCase()} • ${formatFileSize(state.importedDocument.fileSize)}`
    : state.activeSection
      ? state.activeProject?.title
        ? `Seção do projeto: ${state.activeProject.title}`
        : "Seção em edição"
      : state.writeSession.hasUnsavedChanges || state.documentWordCount > 0 || hasNamedDocument
        ? "Documento local em edição"
        : "Documento em branco pronto para edição";

  const id = state.importedDocument
    ? `active-imported-${state.importedDocument.importedAt}-${state.importedDocument.fileName}`
    : state.activeSection
      ? `active-section-${state.activeSection.section_id}`
      : `active-local-${state.writeSession.editorSessionId}`;

  const source: WriterOpenDocumentTab["source"] = state.importedDocument
    ? "imported"
    : state.activeSection
      ? "section"
      : "local";

  return {
    id,
    title,
    subtitle,
    dirty: state.writeSession.hasUnsavedChanges,
    source,
  };
}

type KnexWriterOpenDocumentsBarProps = Pick<WriterRenderProps, "state" | "actions"> & {
  activeDocument: WriterOpenDocumentTab | null;
  surface: WriterWorkspaceSurface;
  onSelectStart: () => void;
  onSelectEditor: () => void;
};

function KnexWriterOpenDocumentsBar({
  state,
  actions,
  activeDocument,
  surface,
  onSelectStart,
  onSelectEditor,
}: KnexWriterOpenDocumentsBarProps) {
  const isStartActive = surface === "start";
  const isEditorActive = surface === "editor" && Boolean(activeDocument);

  return (
    <div
      data-knexwriter-open-documents-bar="true"
      className="shrink-0 border-b border-zinc-300 bg-[#ffffff] px-2"
    >
      <div className="flex h-8 min-w-0 items-end overflow-x-auto overflow-y-hidden pt-1">
        <button
          type="button"
          onClick={onSelectStart}
          className={`group relative flex h-7 max-w-[180px] shrink-0 items-center gap-2 rounded-t-md border px-3 text-sm shadow-[0_-1px_0_rgba(0,0,0,0.02)] ${
            isStartActive
              ? "border-zinc-300 border-b-white bg-white text-[#a83fbe]"
              : "border-zinc-200 bg-[#f8f8f9] text-zinc-600 hover:bg-white hover:text-[#a83fbe]"
          }`}
          aria-current={isStartActive ? "page" : undefined}
          title="Abrir ambiente inicial de documentos, projetos e referências"
        >
          <FileText size={13} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate text-left font-medium">Iniciar</span>
        </button>

        {activeDocument ? (
          <div
            key={activeDocument.id}
            className={`group relative ml-1 flex h-7 max-w-[320px] shrink-0 items-center gap-2 rounded-t-md border px-3 text-sm shadow-[0_-1px_0_rgba(0,0,0,0.02)] ${
              isEditorActive
                ? "border-zinc-300 border-b-white bg-white text-zinc-950"
                : "border-zinc-200 bg-[#f8f8f9] text-zinc-600 hover:bg-white hover:text-zinc-950"
            }`}
            title={`${activeDocument.title} - ${activeDocument.subtitle}`}
            aria-current={isEditorActive ? "page" : undefined}
          >
            <button
              type="button"
              onClick={onSelectEditor}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
              title="Voltar ao documento em edição"
            >
              <FileText size={13} className="shrink-0 text-[#a83fbe]" />
              <span className="min-w-0 flex-1 truncate font-medium">
                {activeDocument.title}
                {activeDocument.dirty ? (
                  <span className="ml-1 text-[#a83fbe]" aria-label="Alterações não salvas">
                    •
                  </span>
                ) : null}
              </span>
            </button>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                actions.handleCloseActiveEditorDocument();
              }}
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              title="Fechar documento atual"
              aria-label="Fechar documento atual"
            >
              <X size={13} />
            </button>
          </div>
        ) : null}

        {!activeDocument ? (
          <div className="ml-2 flex h-7 items-center text-xs text-zinc-500">
            Abra ou crie um documento para iniciar uma aba de edição.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function KnexWriterWorkspaceNormal({
  refs,
  layout,
  state,
  actions,
}: WriterRenderProps) {
  const activeDocument = useMemo(() => getActiveEditorDocumentTab(state), [
    state.activeProject?.title,
    state.activeSection,
    state.documentWordCount,
    state.editorDocumentVersion,
    state.importedDocument,
    state.writeSession.activeSectionId,
    state.writeSession.hasUnsavedChanges,
    state.writingTitle,
  ]);
  const [workspaceSurface, setWorkspaceSurface] = useState<WriterWorkspaceSurface>("editor");
  const hasOpenEditorDocument = true;

  const visibleSurface: WriterWorkspaceSurface = workspaceSurface;

  const leftPanelWidth = state.isWritingNavCollapsed
    ? "0px"
    : `clamp(260px, ${state.writingNavWidthPercent}vw, 520px)`;

  const rightPanelWidth = state.isWritingWorksCollapsed
    ? "0px"
    : `clamp(300px, ${state.writingWorksWidthPercent}vw, 560px)`;

  const openDocumentsBar = (
    <KnexWriterOpenDocumentsBar
      state={state}
      actions={actions}
      activeDocument={activeDocument}
      surface={visibleSurface}
      onSelectStart={() => setWorkspaceSurface("start")}
      onSelectEditor={() => {
        if (hasOpenEditorDocument) {
          setWorkspaceSurface("editor");
        }
      }}
    />
  );

  if (visibleSurface === "start") {
    return (
      <div
        ref={refs.writingWorkspaceRef}
        data-knexwriter-workspace="true"
        data-knexwriter-workspace-surface="start"
        className="relative flex min-h-0 flex-1 overflow-hidden bg-[#EEF0F3]"
      >
        <div
          data-knexwriter-stage-slot="true"
          className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        >
          {openDocumentsBar}
          <KnexWriterStartStoragePage state={state} actions={actions} />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={refs.writingWorkspaceRef}
      data-knexwriter-workspace="true"
      data-knexwriter-workspace-surface="editor"
      className="relative flex min-h-0 flex-1 overflow-hidden bg-[#EEF0F3]"
    >
      {!state.isWritingNavCollapsed ? (
        <div
          data-knexwriter-left-panel-slot="true"
          className="min-h-0 shrink-0 overflow-hidden"
          style={{
            width: leftPanelWidth,
          }}
        >
          <LeftNavigationPanel
            state={state}
            actions={actions}
            className="h-full w-full"
          />
        </div>
      ) : null}

      <div
        data-knexwriter-stage-slot="true"
        className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      >
        {openDocumentsBar}
        <KnexWriterStage
          key={`stage-${state.editorDocumentVersion}`}
          refs={refs}
          layout={layout}
          state={state}
          actions={actions}
        />
      </div>

      {!state.isWritingWorksCollapsed ? (
        <div
          data-knexwriter-right-panel-slot="true"
          className="min-h-0 shrink-0 overflow-hidden"
          style={{
            width: rightPanelWidth,
          }}
        >
          <RightContextPanel
            state={state}
            actions={actions}
            className="h-full w-full"
          />
        </div>
      ) : null}
    </div>
  );
}

type WriterDocumentMemoryState = {
  sources: string;
  references: string;
  directCitations: string;
  indirectCitations: string;
  footnotes: string;
  notes: string;
};

type WriterLinkedSourceFile = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  addedAt: string;
};

type WriterDocumentWorkspace = {
  sources: WriterLinkedSourceFile[];
  references: string[];
  directCitations: string[];
  indirectCitations: string[];
  sourceCitationTemplates: Record<string, {
    parenthetical: string;
    narrative: string;
  }>;
  footnotes: string[];
  notes: string[];
  referenceMemory?: DocumentReferenceMemory;
};

type BibliographicReferenceModalState = {
  documentId: string;
  sourceId: string;
  sourceName?: string;
  isStandalone?: boolean;
};

type BibliographicReferenceTab =
  | "sourceData"
  | "specificData"
  | "citations"
  | "preview"
  | "evidences"
  | "researchNotes"
  | "standaloneAttachment";

type BibliographicAuthorInput = {
  firstName: string;
  middleName: string;
  lastName: string;
};

type BibliographicCitationOccurrenceInput = {
  id: string;
  citationType: "directShort" | "directLong" | "indirect" | "citationOfCitation" | "paraphrase" | "narrativeMention";
  mode: "parenthetical" | "narrative";
  callFormat: "authorDate" | "footnote" | "numeric";
  page: string;
  pageEnd: string;
  chapter: string;
  section: string;
  paragraph: string;
  timestampStart: string;
  timestampEnd: string;
  literalExcerpt: string;
  paraphrasedExcerpt: string;
  authorComment: string;
  locationInDocument: string;
  footnoteText: string;
  includeReferenceEntry: boolean;
};

type BibliographicActionState = "idle" | "working" | "success" | "error";

type BibliographicResponsibleRole = "author" | "organizer" | "editor" | "translator";
type BibliographicResponsibleField = "authors" | "organizers" | "editors" | "translators";

const BIBLIOGRAPHIC_RESPONSIBLE_FIELD_BY_ROLE: Record<
  BibliographicResponsibleRole,
  BibliographicResponsibleField
> = {
  author: "authors",
  organizer: "organizers",
  editor: "editors",
  translator: "translators",
};

const BIBLIOGRAPHIC_RESPONSIBLE_LABEL_BY_ROLE: Record<BibliographicResponsibleRole, string> = {
  author: "autor",
  organizer: "organizador",
  editor: "editor",
  translator: "tradutor",
};

type BibliographicReferenceFormState = {
  referenceType: string;
  citationStyle: "ABNT" | "APA";
  authors: BibliographicAuthorInput[];
  organizers: BibliographicAuthorInput[];
  editors: BibliographicAuthorInput[];
  translators: BibliographicAuthorInput[];
  organizationAuthor: string;
  language: string;
  country: string;
  reliability: "scientific" | "institutional" | "journalistic" | "legal" | "informal" | "unverified" | "technical" | "governmental" | "academic" | "audiovisual" | "other";
  year: string;
  fullDate: string;
  publisher: string;
  institution: string;
  title: string;
  city: string;
  subtitle: string;
  edition: string;
  volume: string;
  issue: string;
  number: string;
  pageStart: string;
  pageEnd: string;
  containerTitle: string;
  databaseName: string;
  repositoryName: string;
  degree: string;
  workType: string;
  program: string;
  advisor: string;
  coAdvisor: string;
  lawJurisdiction: string;
  lawType: string;
  lawNumber: string;
  lawSummary: string;
  emittingBody: string;
  officialGazette: string;
  legalSection: string;
  legalPage: string;
  legalStatus: string;
  eventTitle: string;
  eventEdition: string;
  eventLocation: string;
  eventDate: string;
  proceedingsTitle: string;
  presentationPlatform: string;
  mediaDuration: string;
  socialNetwork: string;
  socialHandle: string;
  softwareVersion: string;
  softwarePlatform: string;
  datasetVersion: string;
  license: string;
  mapScale: string;
  patentNumber: string;
  patentOffice: string;
  doi: string;
  isbn: string;
  issn: string;
  digitalIdentifier: string;
  series: string;
  notes: string;
  sourceSummary: string;
  keywords: string;
  tags: string;
  citationOccurrences: BibliographicCitationOccurrenceInput[];
  citationDraft: BibliographicCitationOccurrenceInput;
  accessUrl: string;
  url: string;
  accessDate: string;
  saveInFileMemory: boolean;
  linkToCurrentDocument: boolean;
};

const KNEXWRITER_DOCUMENT_WORKSPACE_STORAGE_KEY = "knexwriter_document_workspace_v1";
const KNEXWRITER_LINKED_SOURCE_FILES_DB_NAME = "knexwriter_linked_sources_v1";
const KNEXWRITER_LINKED_SOURCE_FILES_STORE_NAME = "linked_source_files";
const KNEXWRITER_LINKED_SOURCE_FILES_DB_VERSION = 1;

const EMPTY_BIBLIOGRAPHIC_AUTHOR: BibliographicAuthorInput = {
  firstName: "",
  middleName: "",
  lastName: "",
};

const BIBLIOGRAPHIC_REFERENCE_TYPE_OPTIONS: Array<{
  label: string;
  value: string;
  engineType: EngineBibliographicSource["type"];
}> = [
  { label: "Livro impresso", value: "Livro impresso", engineType: "book" },
  { label: "Livro digital / e-book", value: "Livro digital / e-book", engineType: "book" },
  { label: "Capítulo de livro", value: "Capítulo de livro", engineType: "bookChapter" },
  { label: "Artigo de periódico científico", value: "Artigo de periódico científico", engineType: "journalArticle" },
  { label: "Artigo de jornal ou revista não científica", value: "Artigo de jornal ou revista não científica", engineType: "magazineArticle" },
  { label: "Trabalho em anais de evento", value: "Trabalho em anais de evento", engineType: "conferencePaper" },
  { label: "Resumo em evento", value: "Resumo em evento", engineType: "eventAbstract" },
  { label: "Tese", value: "Tese", engineType: "thesis" },
  { label: "Dissertação", value: "Dissertação", engineType: "dissertation" },
  { label: "TCC / monografia", value: "TCC / monografia", engineType: "monograph" },
  { label: "Relatório técnico", value: "Relatório técnico", engineType: "report" },
  { label: "Relatório institucional", value: "Relatório institucional", engineType: "report" },
  { label: "Documento governamental", value: "Documento governamental", engineType: "governmentalDocument" },
  { label: "Legislação", value: "Legislação", engineType: "legislation" },
  { label: "Constituição", value: "Constituição", engineType: "legislation" },
  { label: "Lei", value: "Lei", engineType: "law" },
  { label: "Decreto", value: "Decreto", engineType: "legislation" },
  { label: "Portaria", value: "Portaria", engineType: "legislation" },
  { label: "Resolução", value: "Resolução", engineType: "legislation" },
  { label: "Instrução normativa", value: "Instrução normativa", engineType: "legislation" },
  { label: "Edital", value: "Edital", engineType: "publicNotice" },
  { label: "Norma técnica", value: "Norma técnica", engineType: "technicalStandard" },
  { label: "Patente", value: "Patente", engineType: "patent" },
  { label: "Mapa", value: "Mapa", engineType: "map" },
  { label: "Imagem / fotografia", value: "Imagem / fotografia", engineType: "image" },
  { label: "Vídeo online", value: "Vídeo online", engineType: "video" },
  { label: "Aula / palestra / conferência", value: "Aula / palestra / conferência", engineType: "lecture" },
  { label: "Podcast", value: "Podcast", engineType: "podcast" },
  { label: "Entrevista", value: "Entrevista", engineType: "interview" },
  { label: "Verbete de dicionário ou enciclopédia", value: "Verbete de dicionário ou enciclopédia", engineType: "dictionaryEntry" },
  { label: "Página de site", value: "Página de site", engineType: "webpage" },
  { label: "Post em rede social", value: "Post em rede social", engineType: "webpage" },
  { label: "Dataset / banco de dados", value: "Dataset / banco de dados", engineType: "dataset" },
  { label: "Software / aplicativo / sistema", value: "Software / aplicativo / sistema", engineType: "software" },
  { label: "Preprint", value: "Preprint", engineType: "generic" },
  { label: "Documento não publicado", value: "Documento não publicado", engineType: "generic" },
  { label: "Material didático / apostila", value: "Material didático / apostila", engineType: "teachingMaterial" },
  { label: "Slides / apresentação", value: "Slides / apresentação", engineType: "lecture" },
  { label: "Jurisprudência / decisão judicial", value: "Jurisprudência / decisão judicial", engineType: "courtDecision" },
];

function createEmptyCitationOccurrenceDraft(): BibliographicCitationOccurrenceInput {
  return {
    id:
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? `occ-${crypto.randomUUID()}`
        : `occ-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    citationType: "indirect",
    mode: "parenthetical",
    callFormat: "authorDate",
    page: "",
    pageEnd: "",
    chapter: "",
    section: "",
    paragraph: "",
    timestampStart: "",
    timestampEnd: "",
    literalExcerpt: "",
    paraphrasedExcerpt: "",
    authorComment: "",
    locationInDocument: "",
    footnoteText: "",
    includeReferenceEntry: true,
  };
}

const DEFAULT_BIBLIOGRAPHIC_REFERENCE_FORM: BibliographicReferenceFormState = {
  referenceType: "Livro impresso",
  citationStyle: "ABNT",
  authors: [{ ...EMPTY_BIBLIOGRAPHIC_AUTHOR }],
  organizers: [{ ...EMPTY_BIBLIOGRAPHIC_AUTHOR }],
  editors: [{ ...EMPTY_BIBLIOGRAPHIC_AUTHOR }],
  translators: [{ ...EMPTY_BIBLIOGRAPHIC_AUTHOR }],
  organizationAuthor: "",
  language: "",
  country: "",
  reliability: "academic",
  year: "",
  fullDate: "",
  publisher: "",
  institution: "",
  title: "",
  city: "",
  subtitle: "",
  edition: "",
  volume: "",
  issue: "",
  number: "",
  pageStart: "",
  pageEnd: "",
  containerTitle: "",
  databaseName: "",
  repositoryName: "",
  degree: "",
  workType: "",
  program: "",
  advisor: "",
  coAdvisor: "",
  lawJurisdiction: "",
  lawType: "",
  lawNumber: "",
  lawSummary: "",
  emittingBody: "",
  officialGazette: "",
  legalSection: "",
  legalPage: "",
  legalStatus: "",
  eventTitle: "",
  eventEdition: "",
  eventLocation: "",
  eventDate: "",
  proceedingsTitle: "",
  presentationPlatform: "",
  mediaDuration: "",
  socialNetwork: "",
  socialHandle: "",
  softwareVersion: "",
  softwarePlatform: "",
  datasetVersion: "",
  license: "",
  mapScale: "",
  patentNumber: "",
  patentOffice: "",
  doi: "",
  isbn: "",
  issn: "",
  digitalIdentifier: "",
  series: "",
  notes: "",
  sourceSummary: "",
  keywords: "",
  tags: "",
  citationOccurrences: [],
  citationDraft: createEmptyCitationOccurrenceDraft(),
  accessUrl: "",
  url: "",
  accessDate: "",
  saveInFileMemory: true,
  linkToCurrentDocument: true,
};

function normalizeStoredDocumentReferenceMemory(
  value: unknown,
): DocumentReferenceMemory | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<DocumentReferenceMemory>;
  if (typeof candidate.documentId !== "string") return undefined;
  if (!Array.isArray(candidate.references)) return undefined;
  if (!Array.isArray(candidate.citations)) return undefined;
  if (candidate.selectedStyle !== "ABNT_NBR_6023_2018" && candidate.selectedStyle !== "APA_7") {
    return undefined;
  }
  return {
    documentId: candidate.documentId,
    references: candidate.references,
    citations: candidate.citations,
    attachments: Array.isArray(candidate.attachments) ? candidate.attachments : [],
    notes: Array.isArray(candidate.notes) ? candidate.notes : [],
    tags: Array.isArray(candidate.tags) ? candidate.tags : [],
    selectedStyle: candidate.selectedStyle,
    typographyConfig: candidate.typographyConfig || { abntTitleEmphasis: "none" },
  };
}

function createEmptyWriterDocumentWorkspace(): WriterDocumentWorkspace {
  return {
    sources: [],
    references: [],
    directCitations: [],
    indirectCitations: [],
    sourceCitationTemplates: {},
    footnotes: [],
    notes: [],
    referenceMemory: undefined,
  };
}

function normalizeWriterDocumentWorkspace(
  value: Partial<WriterDocumentWorkspace> | undefined,
): WriterDocumentWorkspace {
  const normalizedCitationTemplates: Record<string, { parenthetical: string; narrative: string }> = {};
  if (value?.sourceCitationTemplates && typeof value.sourceCitationTemplates === "object") {
    for (const [sourceId, citationTemplate] of Object.entries(value.sourceCitationTemplates)) {
      if (!sourceId || !citationTemplate || typeof citationTemplate !== "object") continue;
      const parenthetical =
        typeof citationTemplate.parenthetical === "string"
          ? citationTemplate.parenthetical.trim()
          : "";
      const narrative =
        typeof citationTemplate.narrative === "string"
          ? citationTemplate.narrative.trim()
          : "";
      if (!parenthetical && !narrative) continue;
      normalizedCitationTemplates[sourceId] = {
        parenthetical,
        narrative,
      };
    }
  }

  return {
    sources: Array.isArray(value?.sources)
      ? value.sources
          .filter(
            (item): item is WriterLinkedSourceFile =>
              Boolean(item)
              && typeof item.id === "string"
              && typeof item.name === "string"
              && Number.isFinite(item.size)
              && typeof item.mimeType === "string"
              && typeof item.addedAt === "string",
          )
      : [],
    references: Array.isArray(value?.references)
      ? value.references.filter((item): item is string => typeof item === "string")
      : [],
    directCitations: Array.isArray(value?.directCitations)
      ? value.directCitations.filter((item): item is string => typeof item === "string")
      : [],
    indirectCitations: Array.isArray(value?.indirectCitations)
      ? value.indirectCitations.filter((item): item is string => typeof item === "string")
      : [],
    sourceCitationTemplates: normalizedCitationTemplates,
    footnotes: Array.isArray(value?.footnotes)
      ? value.footnotes.filter((item): item is string => typeof item === "string")
      : [],
    notes: Array.isArray(value?.notes)
      ? value.notes.filter((item): item is string => typeof item === "string")
      : [],
    referenceMemory: normalizeStoredDocumentReferenceMemory(value?.referenceMemory),
  };
}

function toTitleCaseWord(rawWord: string): string {
  if (!rawWord) return "";
  return rawWord.charAt(0).toUpperCase() + rawWord.slice(1).toLowerCase();
}

function normalizeBibliographicAuthors(authors: BibliographicAuthorInput[]): BibliographicAuthorInput[] {
  return authors
    .map((author) => ({
      firstName: author.firstName.trim(),
      middleName: author.middleName.trim(),
      lastName: author.lastName.trim(),
    }))
    .filter((author) => author.firstName || author.middleName || author.lastName);
}

function formatBibliographicPersonLiteral(person: BibliographicAuthorInput): string {
  return [person.firstName, person.middleName, person.lastName]
    .map((token) => token.trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

function formatAuthorSurname(author: BibliographicAuthorInput): string {
  const rawSurname = author.lastName || author.firstName || "Autor";
  const tokens = rawSurname
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
  const particles = new Set(["de", "da", "do", "das", "dos", "e"]);

  return tokens
    .map((token, index) => {
      const lowerToken = token.toLowerCase();
      if (index > 0 && particles.has(lowerToken)) return lowerToken;
      return toTitleCaseWord(lowerToken);
    })
    .join(" ");
}

function formatReferenceAuthors(
  authors: BibliographicAuthorInput[],
  citationStyle: "ABNT" | "APA",
): string {
  const normalizedAuthors = normalizeBibliographicAuthors(authors);
  if (normalizedAuthors.length === 0) return "AUTOR DESCONHECIDO";

  if (citationStyle === "APA") {
    return normalizedAuthors
      .map((author) => {
        const surname = formatAuthorSurname(author);
        const initials = [author.firstName, author.middleName]
          .join(" ")
          .split(/\s+/)
          .map((token) => token.trim())
          .filter(Boolean)
          .map((token) => `${token.charAt(0).toUpperCase()}.`)
          .join(" ");
        return initials ? `${surname}, ${initials}` : surname;
      })
      .join("; ");
  }

  return normalizedAuthors
    .map((author) => {
      const surnameUpper = formatAuthorSurname(author).toUpperCase();
      const givenNames = [author.firstName, author.middleName]
        .map((name) => name.trim())
        .filter(Boolean)
        .map((name) => toTitleCaseWord(name))
        .join(" ");
      return givenNames ? `${surnameUpper}, ${givenNames}` : surnameUpper;
    })
    .join("; ");
}

function buildCitationTemplates(
  authors: BibliographicAuthorInput[],
  yearRaw: string,
  citationStyle: "ABNT" | "APA",
): {
  parenthetical: string;
  narrative: string;
} {
  const normalizedAuthors = normalizeBibliographicAuthors(authors);
  const year = yearRaw.trim() || "s.d.";
  if (normalizedAuthors.length === 0) {
    return {
      parenthetical: `(Autor, ${year})`,
      narrative: `Autor (${year})`,
    };
  }

  const primarySurname = formatAuthorSurname(normalizedAuthors[0]);
  if (normalizedAuthors.length > 3) {
    return {
      parenthetical: `(${primarySurname} et al., ${year})`,
      narrative: `${primarySurname} et al. (${year})`,
    };
  }

  const surnames = normalizedAuthors.map((author) => formatAuthorSurname(author));
  const parentheticalConnector = citationStyle === "APA" ? " & " : "; ";
  const parentheticalAuthors = surnames.join(parentheticalConnector);

  const narrativeAuthors =
    surnames.length === 1
      ? surnames[0]
      : `${surnames.slice(0, -1).join(", ")} e ${surnames[surnames.length - 1]}`;

  return {
    parenthetical: `(${parentheticalAuthors}, ${year})`,
    narrative: `${narrativeAuthors} (${year})`,
  };
}

function renderCitationWithItalicEtAl(citation: string): ReactNode {
  const marker = "et al.";
  const lowerCitation = citation.toLowerCase();
  const markerIndex = lowerCitation.indexOf(marker);

  if (markerIndex < 0) return citation;

  const before = citation.slice(0, markerIndex);
  const after = citation.slice(markerIndex + marker.length);

  return (
    <>
      {before}
      <em>et al.</em>
      {after}
    </>
  );
}

type FieldHelpIconProps = {
  label: string;
  help: string;
};

function FieldHelpIcon({ label, help }: FieldHelpIconProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties | null>(null);

  const updateTooltipPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const tooltipWidth = Math.min(320, Math.max(240, viewportWidth - 24));
    const estimatedTooltipHeight = 150;
    const gap = 10;

    let left = rect.right + gap;
    let top = rect.top + rect.height / 2;
    let transform = "translateY(-50%)";

    if (left + tooltipWidth > viewportWidth - 12) {
      left = rect.left - tooltipWidth - gap;
    }

    if (left < 12) {
      left = Math.max(12, rect.left);
      top = rect.bottom + gap;
      transform = "none";
    }

    if (transform === "none" && top + estimatedTooltipHeight > viewportHeight - 12) {
      top = Math.max(12, rect.top - estimatedTooltipHeight - gap);
    }

    setTooltipStyle({
      position: "fixed",
      left,
      top,
      width: tooltipWidth,
      zIndex: 2147483000,
      transform,
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    updateTooltipPosition();

    const handlePointerDown = (event: MouseEvent) => {
      const eventTarget = event.target;
      if (!(eventTarget instanceof Node)) return;
      if (containerRef.current?.contains(eventTarget)) return;
      if (tooltipRef.current?.contains(eventTarget)) return;
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    const handleReposition = () => {
      updateTooltipPosition();
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [isOpen, updateTooltipPosition]);

  return (
    <span
      ref={containerRef}
      className={`relative inline-flex ${isOpen ? "z-[9900]" : "z-[2]"}`}
    >
      <button
        ref={triggerRef}
        type="button"
        tabIndex={0}
        aria-label={`Ajuda: ${label}`}
        aria-expanded={isOpen}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsOpen((current) => {
            const next = !current;
            if (!current) {
              window.setTimeout(() => {
                updateTooltipPosition();
              }, 0);
            }
            return next;
          });
        }}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full transition"
        style={{
          border: "1px solid #dfb4bc",
          backgroundColor: "#fff1f3",
          color: "#c55364",
        }}
      >
        <Info size={10} strokeWidth={2.2} color="#c55364" />
      </button>
      {isOpen && typeof document !== "undefined" && tooltipStyle
        ? createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            style={tooltipStyle}
            className="rounded-md border border-zinc-300 bg-white p-2 text-[11px] font-normal normal-case leading-relaxed text-zinc-700 shadow-2xl"
          >
            <strong className="block font-semibold text-zinc-900">{label}</strong>
            <span>{help}</span>
          </div>,
          document.body,
        )
        : null}
    </span>
  );
}

type FieldLabelProps = {
  text: string;
  help: string;
  className?: string;
  required?: boolean;
};

function FieldLabel({ text, help, className = "text-sm font-semibold text-zinc-700", required = false }: FieldLabelProps) {
  return (
    <label className={`inline-flex items-center gap-1.5 ${className}`}>
      <span>{required ? `${text} *` : text}</span>
      <FieldHelpIcon label={text} help={help} />
    </label>
  );
}

function mapFormCitationStyleToEngineStyle(
  citationStyle: BibliographicReferenceFormState["citationStyle"],
): EngineReferenceStyle {
  return citationStyle === "APA" ? "APA_7" : "ABNT_NBR_6023_2018";
}

function mapFormReferenceTypeToEngineType(referenceType: string): EngineBibliographicSource["type"] {
  const byOption = BIBLIOGRAPHIC_REFERENCE_TYPE_OPTIONS.find((option) => option.value === referenceType);
  if (byOption) return byOption.engineType;
  const normalized = referenceType.trim().toLowerCase();
  if (normalized.includes("livro")) return "book";
  if (normalized.includes("artigo")) return "journalArticle";
  if (normalized.includes("tese")) return "thesis";
  if (normalized.includes("disserta")) return "dissertation";
  if (normalized.includes("site")) return "webpage";
  if (normalized.includes("relat")) return "report";
  if (normalized.includes("cap")) return "bookChapter";
  return "generic";
}

function buildBibliographicSourceFromForm(args: {
  sourceId: string;
  sourceName: string;
  form: BibliographicReferenceFormState;
}): EngineBibliographicSource {
  const normalizedAuthors = normalizeBibliographicAuthors(args.form.authors);
  const normalizedOrganizers = normalizeBibliographicAuthors(args.form.organizers);
  const normalizedEditors = normalizeBibliographicAuthors(args.form.editors);
  const normalizedTranslators = normalizeBibliographicAuthors(args.form.translators);
  const organizerLiteral = normalizedOrganizers.map(formatBibliographicPersonLiteral).filter(Boolean).join("; ");
  const editorLiteral = normalizedEditors.map(formatBibliographicPersonLiteral).filter(Boolean).join("; ");
  const translatorLiteral = normalizedTranslators.map(formatBibliographicPersonLiteral).filter(Boolean).join("; ");
  const contributors =
    normalizedOrganizers.length || normalizedEditors.length || normalizedTranslators.length
      ? {
        organizers: normalizedOrganizers.map((person, index) => ({
          givenNames: [person.firstName, person.middleName].filter(Boolean).join(" ").trim() || undefined,
          familyName: person.lastName.trim() || undefined,
          literal: formatBibliographicPersonLiteral(person) || undefined,
          role: "organizer" as const,
          order: index + 1,
        })),
        editors: normalizedEditors.map((person, index) => ({
          givenNames: [person.firstName, person.middleName].filter(Boolean).join(" ").trim() || undefined,
          familyName: person.lastName.trim() || undefined,
          literal: formatBibliographicPersonLiteral(person) || undefined,
          role: "editor" as const,
          order: index + 1,
        })),
        translators: normalizedTranslators.map((person, index) => ({
          givenNames: [person.firstName, person.middleName].filter(Boolean).join(" ").trim() || undefined,
          familyName: person.lastName.trim() || undefined,
          literal: formatBibliographicPersonLiteral(person) || undefined,
          role: "translator" as const,
          order: index + 1,
        })),
      }
      : undefined;
  const normalizedWorkType = args.form.workType.trim().toLowerCase();
  const mappedAcademicWorkType: "TCC" | "monografia" | "dissertação" | "tese" | "artigo de conclusão" | undefined =
    normalizedWorkType === "tcc"
      ? "TCC"
      : normalizedWorkType === "monografia"
        ? "monografia"
        : normalizedWorkType.includes("disser")
          ? "dissertação"
          : normalizedWorkType === "tese"
            ? "tese"
            : normalizedWorkType.includes("artigo")
              ? "artigo de conclusão"
              : undefined;
  const parsed = parseEngineManualInput({
    id: args.sourceId,
    type: mapFormReferenceTypeToEngineType(args.form.referenceType),
    style: mapFormCitationStyleToEngineStyle(args.form.citationStyle),
    title: args.form.title.trim() || args.sourceName.replace(/\.[^.]+$/, "").trim() || "Título não informado",
    subtitle: args.form.subtitle.trim() || undefined,
    authors: normalizedAuthors.map((author) => ({
      givenNames: [author.firstName, author.middleName].filter(Boolean).join(" ").trim() || undefined,
      familyName: author.lastName.trim() || undefined,
      role: "author",
    })),
    organizationAuthor: args.form.organizationAuthor.trim() || undefined,
    organizer: organizerLiteral || undefined,
    editor: editorLiteral || undefined,
    translator: translatorLiteral || undefined,
    publicationDate: { year: args.form.year.trim() || undefined },
    depositDate: args.form.fullDate.trim() ? { raw: args.form.fullDate.trim() } : undefined,
    publisher: args.form.publisher.trim() || undefined,
    institution: args.form.institution.trim() || undefined,
    language: args.form.language.trim() || undefined,
    country: args.form.country.trim() || undefined,
    place: args.form.city.trim() || undefined,
    edition: args.form.edition.trim() || undefined,
    volume: args.form.volume.trim() || undefined,
    issue: args.form.issue.trim() || undefined,
    number: args.form.number.trim() || undefined,
    containerTitle: args.form.containerTitle.trim() || undefined,
    pages:
      args.form.pageStart.trim() || args.form.pageEnd.trim()
        ? { start: args.form.pageStart.trim() || undefined, end: args.form.pageEnd.trim() || undefined }
        : undefined,
    doi: args.form.doi.trim() || undefined,
    isbn: args.form.isbn.trim() || undefined,
    issn: args.form.issn.trim() || undefined,
    digitalIdentifier: args.form.digitalIdentifier.trim() || undefined,
    series: args.form.series.trim() || undefined,
    url: args.form.url.trim() || args.form.accessUrl.trim() || undefined,
    accessDate: args.form.accessDate.trim() ? { raw: args.form.accessDate.trim() } : undefined,
    databaseName: args.form.databaseName.trim() || undefined,
    repositoryName: args.form.repositoryName.trim() || undefined,
    version: args.form.softwareVersion.trim() || args.form.datasetVersion.trim() || undefined,
    platform: args.form.softwarePlatform.trim() || args.form.presentationPlatform.trim() || undefined,
    license: args.form.license.trim() || undefined,
    socialHandle: args.form.socialHandle.trim() || undefined,
    event: {
      eventTitle: args.form.eventTitle.trim() || undefined,
      eventEdition: args.form.eventEdition.trim() || undefined,
      eventLocation: args.form.eventLocation.trim() || undefined,
      eventDate: args.form.eventDate.trim() ? { raw: args.form.eventDate.trim() } : undefined,
      proceedingsTitle: args.form.proceedingsTitle.trim() || undefined,
    },
    media: {
      duration: args.form.mediaDuration.trim() || undefined,
      timestampStart: args.form.citationDraft.timestampStart.trim() || undefined,
      timestampEnd: args.form.citationDraft.timestampEnd.trim() || undefined,
    },
    academicWork: {
      workType: mappedAcademicWorkType,
      degree: args.form.degree.trim() || undefined,
      course: args.form.program.trim() || undefined,
      institution: args.form.institution.trim() || undefined,
      place: args.form.city.trim() || undefined,
      advisor: args.form.advisor.trim() || undefined,
      coAdvisor: args.form.coAdvisor.trim() || undefined,
    },
    legal: {
      jurisdiction: args.form.lawJurisdiction.trim() || undefined,
      normativeType: args.form.lawType.trim() || undefined,
      lawNumber: args.form.lawNumber.trim() || undefined,
      summary: args.form.lawSummary.trim() || undefined,
      emittingBody: args.form.emittingBody.trim() || undefined,
      officialGazette: args.form.officialGazette.trim() || undefined,
      section: args.form.legalSection.trim() || undefined,
      page: args.form.legalPage.trim() || undefined,
      status:
        (args.form.legalStatus.trim().toLowerCase() as NonNullable<EngineBibliographicSource["legal"]>["status"])
        || undefined,
    },
    summary: args.form.sourceSummary.trim() || undefined,
    keywords: args.form.keywords
      .split(",")
      .map((keyword) => keyword.trim())
      .filter(Boolean),
    tags: args.form.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    internalNotes: args.form.notes.trim() || undefined,
    contributors,
    sourceQuality: {
      confidence: "medium",
      missingFields: [],
      warnings: [],
      origin: "manual",
      reliability: args.form.reliability,
    },
  });

  return {
    ...parsed,
    extra: {
      ...(parsed.extra || {}),
      notes: args.form.notes.trim(),
    },
  };
}

function buildEngineCitationTemplates(
  source: EngineBibliographicSource,
  style: EngineReferenceStyle,
): {
  parenthetical: string;
  narrative: string;
} {
  const parenthetical = formatEngineCitation(source, {
    sourceId: source.id,
    style,
    mode: "parenthetical",
  }).citation;
  const narrative = formatEngineCitation(source, {
    sourceId: source.id,
    style,
    mode: "narrative",
  }).citation;
  return { parenthetical, narrative };
}

function buildCitationLocatorFromDraft(
  draft: BibliographicCitationOccurrenceInput,
): {
  type: "page" | "paragraph" | "section" | "chapter";
  value: string;
} | undefined {
  if (draft.page.trim()) return { type: "page", value: draft.page.trim() };
  if (draft.paragraph.trim()) return { type: "paragraph", value: draft.paragraph.trim() };
  if (draft.section.trim()) return { type: "section", value: draft.section.trim() };
  if (draft.chapter.trim()) return { type: "chapter", value: draft.chapter.trim() };
  return undefined;
}

function buildFootnoteFromCitationDraft(
  baseCitation: string,
  draft: BibliographicCitationOccurrenceInput,
): string {
  const explicit = draft.footnoteText.trim();
  if (explicit) return explicit;
  const details = [
    draft.page.trim() ? `p. ${draft.page.trim()}${draft.pageEnd.trim() ? `-${draft.pageEnd.trim()}` : ""}` : "",
    draft.timestampStart.trim() ? `tempo ${draft.timestampStart.trim()}${draft.timestampEnd.trim() ? `-${draft.timestampEnd.trim()}` : ""}` : "",
    draft.authorComment.trim() ? `obs.: ${draft.authorComment.trim()}` : "",
  ].filter(Boolean);
  return details.length ? `${baseCitation}. ${details.join(" | ")}` : baseCitation;
}

function readWriterDocumentWorkspaceStore(): Record<string, WriterDocumentWorkspace> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(KNEXWRITER_DOCUMENT_WORKSPACE_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Record<string, Partial<WriterDocumentWorkspace> | undefined>;
    const normalized: Record<string, WriterDocumentWorkspace> = {};

    for (const [documentId, value] of Object.entries(parsed)) {
      if (!documentId) continue;
      normalized[documentId] = normalizeWriterDocumentWorkspace(value);
    }

    return normalized;
  } catch {
    return {};
  }
}

function writeWriterDocumentWorkspaceStore(
  store: Record<string, WriterDocumentWorkspace>,
) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      KNEXWRITER_DOCUMENT_WORKSPACE_STORAGE_KEY,
      JSON.stringify(store),
    );
  } catch {
    // O armazenamento local é opcional.
  }
}

type LinkedSourceFileRecord = {
  key: string;
  documentId: string;
  sourceId: string;
  fileName: string;
  mimeType: string;
  size: number;
  addedAt: string;
  fileBlob: Blob;
};

function buildLinkedSourceFileRecordKey(documentId: string, sourceId: string): string {
  return `${documentId}::${sourceId}`;
}

function openLinkedSourceFilesDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const request = window.indexedDB.open(
      KNEXWRITER_LINKED_SOURCE_FILES_DB_NAME,
      KNEXWRITER_LINKED_SOURCE_FILES_DB_VERSION,
    );

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(KNEXWRITER_LINKED_SOURCE_FILES_STORE_NAME)) {
        database.createObjectStore(KNEXWRITER_LINKED_SOURCE_FILES_STORE_NAME, { keyPath: "key" });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      resolve(null);
    };
  });
}

async function persistLinkedSourceFileBinary(
  documentId: string,
  source: WriterLinkedSourceFile,
  file: File,
): Promise<void> {
  const database = await openLinkedSourceFilesDatabase();
  if (!database) return;

  await new Promise<void>((resolve) => {
    try {
      const transaction = database.transaction(KNEXWRITER_LINKED_SOURCE_FILES_STORE_NAME, "readwrite");
      const store = transaction.objectStore(KNEXWRITER_LINKED_SOURCE_FILES_STORE_NAME);
      const record: LinkedSourceFileRecord = {
        key: buildLinkedSourceFileRecordKey(documentId, source.id),
        documentId,
        sourceId: source.id,
        fileName: source.name,
        mimeType: source.mimeType,
        size: source.size,
        addedAt: source.addedAt,
        fileBlob: file,
      };

      store.put(record);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    } catch {
      resolve();
    }
  });

  database.close();
}

async function readLinkedSourceFileBinary(
  documentId: string,
  source: WriterLinkedSourceFile,
): Promise<File | null> {
  const database = await openLinkedSourceFilesDatabase();
  if (!database) return null;

  const record = await new Promise<LinkedSourceFileRecord | null>((resolve) => {
    try {
      const transaction = database.transaction(KNEXWRITER_LINKED_SOURCE_FILES_STORE_NAME, "readonly");
      const store = transaction.objectStore(KNEXWRITER_LINKED_SOURCE_FILES_STORE_NAME);
      const request = store.get(buildLinkedSourceFileRecordKey(documentId, source.id));

      request.onsuccess = () => {
        resolve((request.result as LinkedSourceFileRecord | undefined) ?? null);
      };
      request.onerror = () => resolve(null);
      transaction.onabort = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  database.close();

  if (!record?.fileBlob) return null;

  return new File([record.fileBlob], source.name || record.fileName, {
    type: record.mimeType || source.mimeType || "application/octet-stream",
    lastModified: Date.parse(record.addedAt) || Date.now(),
  });
}

async function removeLinkedSourceFileBinary(documentId: string, sourceId: string): Promise<void> {
  const database = await openLinkedSourceFilesDatabase();
  if (!database) return;

  await new Promise<void>((resolve) => {
    try {
      const transaction = database.transaction(KNEXWRITER_LINKED_SOURCE_FILES_STORE_NAME, "readwrite");
      const store = transaction.objectStore(KNEXWRITER_LINKED_SOURCE_FILES_STORE_NAME);
      store.delete(buildLinkedSourceFileRecordKey(documentId, sourceId));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    } catch {
      resolve();
    }
  });

  database.close();
}

type LinkedSourceGridCardProps = {
  source: WriterLinkedSourceFile;
  documentId: string;
  isSelected: boolean;
  onSelect: () => void;
  resolveSourceFileForPreview: (documentId: string, source: WriterLinkedSourceFile) => Promise<File | null>;
  onOpenActionsMenu: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onActionsTriggerMount: (node: HTMLButtonElement | null) => void;
};

function LinkedSourceGridCard({
  source,
  documentId,
  isSelected,
  onSelect,
  resolveSourceFileForPreview,
  onOpenActionsMenu,
  onActionsTriggerMount,
}: LinkedSourceGridCardProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<"pdf" | "image" | "none">("none");
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadPreview = async () => {
      setIsPreviewLoading(true);
      try {
        const file = await resolveSourceFileForPreview(documentId, source);
        if (cancelled) return;

        const mimeType = (file?.type || source.mimeType || "").toLowerCase();
        const isPdf = mimeType.includes("application/pdf") || source.name.toLowerCase().endsWith(".pdf");
        const isImage = mimeType.startsWith("image/");

        if (!file || (!isPdf && !isImage)) {
          if (previewUrlRef.current) {
            URL.revokeObjectURL(previewUrlRef.current);
            previewUrlRef.current = null;
          }
          setPreviewUrl(null);
          setPreviewKind("none");
          return;
        }

        const objectUrl = URL.createObjectURL(file);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        if (previewUrlRef.current) {
          URL.revokeObjectURL(previewUrlRef.current);
        }
        previewUrlRef.current = objectUrl;
        setPreviewUrl(objectUrl);
        setPreviewKind(isPdf ? "pdf" : "image");
      } finally {
        if (!cancelled) setIsPreviewLoading(false);
      }
    };

    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, [
    documentId,
    resolveSourceFileForPreview,
    source.id,
    source.name,
    source.mimeType,
    source.size,
    source.addedAt,
  ]);

  const title = getBaseFileName(source.name);

  return (
    <article
      onClick={onSelect}
      className={`rounded-2xl border p-3 shadow-sm transition-colors ${
        isSelected
          ? "border-[#4e9cd2] bg-[#74b4e4]"
          : "border-zinc-200 bg-[#d7dde6] hover:bg-[#d0d6df]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#3b82f6] text-white">
            <FileText size={12} />
          </span>
          <span className="truncate text-sm font-semibold uppercase text-zinc-900">
            {title}
          </span>
        </div>
        <button
          ref={onActionsTriggerMount}
          type="button"
          data-knexwriter-source-actions-trigger="true"
          onClick={onOpenActionsMenu}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700"
          title="Mais opções"
          aria-label={`Mais opções para ${source.name}`}
        >
          <MoreVertical size={15} />
        </button>
      </div>

      <div
        className={`mt-3 overflow-hidden rounded-xl border ${
          isSelected ? "border-[#5fa3d6] bg-[#e6f2fb]" : "border-zinc-200 bg-white"
        }`}
      >
        <div className="relative aspect-[16/10] w-full">
          {previewUrl && previewKind === "pdf" ? (
            <iframe
              src={`${previewUrl}#page=1&toolbar=0&navpanes=0&scrollbar=0&zoom=page-fit`}
              title={`Prévia de ${source.name}`}
              className="pointer-events-none h-full w-full border-0"
            />
          ) : null}
          {previewUrl && previewKind === "image" ? (
            <img
              src={previewUrl}
              alt={`Prévia de ${source.name}`}
              className="h-full w-full object-cover"
            />
          ) : null}
          {!previewUrl ? (
            <div className="h-full w-full px-4 py-3 text-left">
              <p className="truncate text-[11px] font-semibold uppercase text-zinc-700">{title}</p>
              <div className="mt-2 space-y-1.5 text-[10px] leading-4 text-zinc-500">
                <p className="truncate">Prévia do conteúdo disponível após leitura do arquivo.</p>
                <p className="truncate">{source.mimeType || "application/octet-stream"} · {formatFileSize(source.size)}</p>
                <p className="truncate">Adicionado: {formatDateTime(source.addedAt)}</p>
              </div>
            </div>
          ) : null}
          {isPreviewLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70">
              <RefreshCw size={16} className="animate-spin text-zinc-500" />
            </div>
          ) : null}
          {isSelected ? (
            <div className="pointer-events-none absolute inset-0 bg-[#74b4e4]/22" />
          ) : null}
        </div>
      </div>
    </article>
  );
}

function KnexWriterStartStoragePage({ state, actions }: Pick<WriterRenderProps, "state" | "actions">) {
  const activeDocument = getActiveEditorDocumentTab(state);
  const [selectedDocumentId, setSelectedDocumentId] = useState(activeDocument.id);
  const [documentWorkspaces, setDocumentWorkspaces] = useState<Record<string, WriterDocumentWorkspace>>(
    () => readWriterDocumentWorkspaceStore(),
  );
  const [openWorkspaceModal, setOpenWorkspaceModal] = useState<{
    documentId: string;
    field: keyof WriterDocumentMemoryState;
  } | null>(null);
  const [sourceWorkspaceFilter, setSourceWorkspaceFilter] = useState<"documents" | "links">("documents");
  const [sourceWorkspaceView, setSourceWorkspaceView] = useState<"grid" | "list">("list");
  const [isSourceDropActive, setIsSourceDropActive] = useState(false);
  const [openSourceActionsMenuId, setOpenSourceActionsMenuId] = useState<string | null>(null);
  const [openSourceActionsMenuSource, setOpenSourceActionsMenuSource] =
    useState<WriterLinkedSourceFile | null>(null);
  const [openSourceReferenceMenuId, setOpenSourceReferenceMenuId] = useState<string | null>(null);
  const [openSourceCitationMenuId, setOpenSourceCitationMenuId] = useState<string | null>(null);
  const [openSourceShareMenuId, setOpenSourceShareMenuId] = useState<string | null>(null);
  const [openSourceInfoMenuId, setOpenSourceInfoMenuId] = useState<string | null>(null);
  const [isSourceSortMenuOpen, setIsSourceSortMenuOpen] = useState(false);
  const [sourceSortField, setSourceSortField] = useState<"name" | "modifiedAt" | "modifiedByMeAt" | "openedAt">("name");
  const [sourceSortDirection, setSourceSortDirection] = useState<"asc" | "desc">("asc");
  const [sourceSortFoldersMode, setSourceSortFoldersMode] = useState<"foldersFirst" | "mixed">("foldersFirst");
  const [sourceSortMenuPosition, setSourceSortMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [sourceLastOpenedAtById, setSourceLastOpenedAtById] = useState<Record<string, string>>({});
  const [sourceFocusedId, setSourceFocusedId] = useState<string | null>(null);
  const [isSourceBulkSelectionEnabled, setIsSourceBulkSelectionEnabled] = useState(false);
  const [selectedSourceIds, setSelectedSourceIds] = useState<Record<string, true>>({});
  const [isTrashConfirmOpen, setIsTrashConfirmOpen] = useState(false);
  const [filePendingTrash, setFilePendingTrash] = useState<WriterLinkedSourceFile | null>(null);
  const [bulkSourceIdsPendingTrash, setBulkSourceIdsPendingTrash] = useState<string[]>([]);
  const [isTrashConfirmSubmitting, setIsTrashConfirmSubmitting] = useState(false);
  const [trashConfirmError, setTrashConfirmError] = useState<string | null>(null);
  const [trashConfirmWidthPx, setTrashConfirmWidthPx] = useState<number | null>(null);
  const [sourceActionsMenuPosition, setSourceActionsMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [openSourceOpenWithMenuId, setOpenSourceOpenWithMenuId] = useState<string | null>(null);
  const [sourceOpenWithSubmenuSide, setSourceOpenWithSubmenuSide] = useState<"left" | "right">("left");
  const [sourceOpenWithSubmenuOffsetPx, setSourceOpenWithSubmenuOffsetPx] = useState(0);
  const [sourceShareSubmenuSide, setSourceShareSubmenuSide] = useState<"left" | "right">("left");
  const [sourceInfoSubmenuSide, setSourceInfoSubmenuSide] = useState<"left" | "right">("left");
  const [sourceShareSubmenuOffsetPx, setSourceShareSubmenuOffsetPx] = useState(0);
  const [sourceInfoSubmenuOffsetPx, setSourceInfoSubmenuOffsetPx] = useState(0);
  const [openBibliographicReferenceModal, setOpenBibliographicReferenceModal] =
    useState<BibliographicReferenceModalState | null>(null);
  const [openBibliographicResponsibleActions, setOpenBibliographicResponsibleActions] = useState<{
    role: BibliographicResponsibleRole;
    index: number;
  } | null>(null);
  const [copyReferenceActionState, setCopyReferenceActionState] = useState<BibliographicActionState>("idle");
  const [generateCitationActionState, setGenerateCitationActionState] = useState<BibliographicActionState>("idle");
  const [saveReferenceActionState, setSaveReferenceActionState] = useState<BibliographicActionState>("idle");
  const [cancelReferenceActionState, setCancelReferenceActionState] = useState<BibliographicActionState>("idle");
  const [generateCitationErrorMessage, setGenerateCitationErrorMessage] = useState<string | null>(null);
  const [standaloneAttachmentSavedNotice, setStandaloneAttachmentSavedNotice] = useState<string | null>(null);
  const [isStandaloneReferenceDropActive, setIsStandaloneReferenceDropActive] = useState(false);
  const [addResponsibleActionState, setAddResponsibleActionState] = useState<Record<
    BibliographicResponsibleRole,
    BibliographicActionState
  >>({
    author: "idle",
    organizer: "idle",
    editor: "idle",
    translator: "idle",
  });
  const [bibliographicReferenceTab, setBibliographicReferenceTab] =
    useState<BibliographicReferenceTab>("sourceData");
  const [bibliographicReferenceForm, setBibliographicReferenceForm] =
    useState<BibliographicReferenceFormState>(DEFAULT_BIBLIOGRAPHIC_REFERENCE_FORM);
  const sourceFilesInputRef = useRef<HTMLInputElement | null>(null);
  const standaloneReferenceFileInputRef = useRef<HTMLInputElement | null>(null);
  const sourcesModalSurfaceRef = useRef<HTMLDivElement | null>(null);
  const sourceSortTriggerRef = useRef<HTMLButtonElement | null>(null);
  const sourceSortMenuRef = useRef<HTMLDivElement | null>(null);
  const sourceActionsMenuRef = useRef<HTMLDivElement | null>(null);
  const sourceReferenceMenuRef = useRef<HTMLDivElement | null>(null);
  const sourceCitationMenuRef = useRef<HTMLDivElement | null>(null);
  const sourceActionsTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const bibliographicResponsibleActionsMenuRef = useRef<HTMLDivElement | null>(null);
  const bibliographicResponsibleFirstNameInputRefs = useRef<Record<
    BibliographicResponsibleRole,
    Record<number, HTMLInputElement | null>
  >>({
    author: {},
    organizer: {},
    editor: {},
    translator: {},
  });
  const sourceFileBlobStoreRef = useRef<Record<string, File>>({});

  useEffect(() => {
    setSelectedDocumentId(activeDocument.id);
  }, [activeDocument.id]);

  useEffect(() => {
    writeWriterDocumentWorkspaceStore(documentWorkspaces);
  }, [documentWorkspaces]);

  const activeProjectTitle = state.activeProject?.title || "Sem projeto vinculado";
  const projectKindLabel = PROJECT_KIND_LABEL[state.organization.projectKind];
  const memoryColumns: Array<{
    key: keyof WriterDocumentMemoryState;
    label: string;
    icon: typeof FileText;
    menuLabel: string;
  }> = [
    { key: "sources", label: "Fontes", icon: FileUp, menuLabel: "Fontes do arquivo" },
    { key: "references", label: "Referências", icon: List, menuLabel: "Referências bibliográficas" },
    { key: "directCitations", label: "Citações diretas", icon: ClipboardCopy, menuLabel: "Citações diretas" },
    { key: "indirectCitations", label: "Citações indiretas", icon: ArrowDownRight, menuLabel: "Citações indiretas" },
    { key: "footnotes", label: "Notas de rodapé", icon: Pilcrow, menuLabel: "Notas de rodapé" },
    { key: "notes", label: "Observações", icon: MessageSquare, menuLabel: "Observações do arquivo" },
  ];

  const sourceLabelByDocument = {
    imported: "Importado",
    section: "Projeto",
    local: "Local",
    project: "Projeto",
    fallback: "Sugestão",
  } as const;

  const environmentDocumentRows = useMemo(() => {
    const rows: Array<{
      id: string;
      title: string;
      subtitle: string;
      source: "project" | "imported" | "local" | "fallback" | "section";
      updatedAt?: string;
      recentDocument?: WriterRecentDocument;
    }> = [
      {
        id: activeDocument.id,
        title: activeDocument.title,
        subtitle: activeDocument.subtitle,
        source: activeDocument.source,
      },
    ];

    for (const recent of state.recentDocuments) {
      if (rows.some((row) => row.id === recent.id)) continue;
      rows.push({
        id: recent.id,
        title: recent.title,
        subtitle: recent.subtitle || "Documento de escrita",
        source: recent.source,
        updatedAt: recent.updatedAt,
        recentDocument: recent,
      });
    }

    return rows;
  }, [activeDocument.id, activeDocument.source, activeDocument.subtitle, activeDocument.title, state.recentDocuments]);

  const filteredEnvironmentRows = useMemo(() => {
    const query = state.backstageSearchQuery.trim().toLowerCase();
    if (!query) return environmentDocumentRows;

    return environmentDocumentRows.filter((row) => {
      const sourceLabel = sourceLabelByDocument[row.source]?.toLowerCase() ?? "";
      return (
        row.title.toLowerCase().includes(query)
        || row.subtitle.toLowerCase().includes(query)
        || sourceLabel.includes(query)
      );
    });
  }, [environmentDocumentRows, sourceLabelByDocument, state.backstageSearchQuery]);

  const selectedEnvironmentDocument =
    environmentDocumentRows.find((row) => row.id === selectedDocumentId) ?? environmentDocumentRows[0];

  const updateDocumentWorkspace = useCallback(
    (
      documentId: string,
      updater: (current: WriterDocumentWorkspace) => WriterDocumentWorkspace,
    ) => {
      setDocumentWorkspaces((currentStore) => {
        const currentWorkspace = currentStore[documentId] ?? createEmptyWriterDocumentWorkspace();
        const updatedWorkspace = normalizeWriterDocumentWorkspace(updater(currentWorkspace));
        return {
          ...currentStore,
          [documentId]: updatedWorkspace,
        };
      });
    },
    [],
  );

  const openWorkspaceDocument =
    openWorkspaceModal != null
      ? environmentDocumentRows.find((row) => row.id === openWorkspaceModal.documentId) ?? null
      : null;

  const openWorkspaceData =
    openWorkspaceModal != null
      ? documentWorkspaces[openWorkspaceModal.documentId] ?? createEmptyWriterDocumentWorkspace()
      : createEmptyWriterDocumentWorkspace();
  const sortedWorkspaceSources = useMemo(() => {
    const sources = [...openWorkspaceData.sources];
    const getComparableDate = (value: string | undefined) => {
      if (!value) return 0;
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const isFolderSource = (source: WriterLinkedSourceFile) => {
      const mime = source.mimeType.toLowerCase();
      const name = source.name.toLowerCase();
      return (
        mime.includes("folder")
        || name.endsWith("/")
        || name.startsWith("pasta ")
        || name.includes(" pasta")
      );
    };

    sources.sort((leftSource, rightSource) => {
      if (sourceSortFoldersMode === "foldersFirst") {
        const leftIsFolder = isFolderSource(leftSource);
        const rightIsFolder = isFolderSource(rightSource);
        if (leftIsFolder !== rightIsFolder) {
          return leftIsFolder ? -1 : 1;
        }
      }

      let comparison = 0;
      if (sourceSortField === "name") {
        comparison = leftSource.name.localeCompare(rightSource.name, "pt-BR", {
          sensitivity: "base",
        });
      } else if (sourceSortField === "openedAt") {
        comparison =
          getComparableDate(sourceLastOpenedAtById[leftSource.id])
          - getComparableDate(sourceLastOpenedAtById[rightSource.id]);
      } else if (sourceSortField === "modifiedByMeAt") {
        comparison = getComparableDate(leftSource.addedAt) - getComparableDate(rightSource.addedAt);
      } else {
        comparison = getComparableDate(leftSource.addedAt) - getComparableDate(rightSource.addedAt);
      }

      if (comparison === 0) {
        comparison = leftSource.name.localeCompare(rightSource.name, "pt-BR", {
          sensitivity: "base",
        });
      }

      return sourceSortDirection === "asc" ? comparison : -comparison;
    });

    return sources;
  }, [
    openWorkspaceData.sources,
    sourceLastOpenedAtById,
    sourceSortDirection,
    sourceSortField,
    sourceSortFoldersMode,
  ]);
  const selectedSourceCount = useMemo(
    () => sortedWorkspaceSources.filter((source) => selectedSourceIds[source.id]).length,
    [selectedSourceIds, sortedWorkspaceSources],
  );
  const allVisibleSourcesSelected =
    sortedWorkspaceSources.length > 0 && selectedSourceCount === sortedWorkspaceSources.length;
  const openBibliographicSource =
    openBibliographicReferenceModal != null
      ? (
        documentWorkspaces[openBibliographicReferenceModal.documentId]
        ?? createEmptyWriterDocumentWorkspace()
      ).sources.find((source) => source.id === openBibliographicReferenceModal.sourceId) ?? null
      : null;
  const openBibliographicWorkspace =
    openBibliographicReferenceModal != null
      ? documentWorkspaces[openBibliographicReferenceModal.documentId] ?? createEmptyWriterDocumentWorkspace()
      : createEmptyWriterDocumentWorkspace();
  const bibliographicEngineStyle = useMemo(
    () => mapFormCitationStyleToEngineStyle(bibliographicReferenceForm.citationStyle),
    [bibliographicReferenceForm.citationStyle],
  );

  const bibliographicDraftSource = useMemo(() => {
    const sourceId = openBibliographicReferenceModal?.sourceId || "draft-reference";
    const sourceName =
      openBibliographicSource?.name
      || openBibliographicReferenceModal?.sourceName
      || "Referência avulsa";
    return buildBibliographicSourceFromForm({
      sourceId,
      sourceName,
      form: bibliographicReferenceForm,
    });
  }, [
    bibliographicReferenceForm,
    openBibliographicReferenceModal?.sourceId,
    openBibliographicReferenceModal?.sourceName,
    openBibliographicSource?.name,
  ]);

  const bibliographicRenderedOutput = useMemo(
    () => renderEngineReference(bibliographicDraftSource, bibliographicEngineStyle),
    [bibliographicDraftSource, bibliographicEngineStyle],
  );

  const bibliographicFormattedReference = useMemo(
    () => bibliographicRenderedOutput.formattedReference.trim(),
    [bibliographicRenderedOutput.formattedReference],
  );

  const bibliographicCitationTemplates = useMemo(
    () => buildEngineCitationTemplates(bibliographicDraftSource, bibliographicEngineStyle),
    [bibliographicDraftSource, bibliographicEngineStyle],
  );

  const bibliographicTypeFlags = useMemo(() => {
    const type = bibliographicReferenceForm.referenceType.toLowerCase();
    return {
      isBook:
        type.includes("livro")
        || type.includes("e-book")
        || type.includes("apostila")
        || type.includes("slides"),
      isArticle:
        type.includes("artigo")
        || type.includes("periódico")
        || type.includes("jornal")
        || type.includes("revista"),
      isAcademicWork:
        type.includes("tese")
        || type.includes("dissertação")
        || type.includes("tcc")
        || type.includes("monografia"),
      isLegal:
        type.includes("lei")
        || type.includes("decreto")
        || type.includes("portaria")
        || type.includes("resolução")
        || type.includes("normativa")
        || type.includes("constituição")
        || type.includes("legislação")
        || type.includes("edital")
        || type.includes("jurisprudência"),
      isEvent:
        type.includes("evento")
        || type.includes("anais")
        || type.includes("resumo")
        || type.includes("conferência")
        || type.includes("palestra")
        || type.includes("aula"),
      isMedia:
        type.includes("vídeo")
        || type.includes("podcast")
        || type.includes("palestra")
        || type.includes("aula")
        || type.includes("entrevista")
        || type.includes("rede social"),
      isTech:
        type.includes("software")
        || type.includes("dataset")
        || type.includes("banco de dados")
        || type.includes("norma técnica")
        || type.includes("patente")
        || type.includes("mapa"),
      isOnline:
        type.includes("site")
        || type.includes("página")
        || type.includes("online")
        || type.includes("rede social")
        || type.includes("e-book"),
    };
  }, [bibliographicReferenceForm.referenceType]);

  const resetBibliographicActionState = useCallback(
    (setter: Dispatch<SetStateAction<BibliographicActionState>>, delayMs = 1400) => {
      window.setTimeout(() => {
        setter("idle");
      }, delayMs);
    },
    [],
  );

  const handleOpenSourcePicker = useCallback(() => {
    sourceFilesInputRef.current?.click();
  }, []);

  const appendSourceFilesToDocumentWorkspace = useCallback(
    (documentId: string, files: File[]) => {
      if (files.length === 0) return [] as WriterLinkedSourceFile[];

      const now = new Date().toISOString();
      const sourcesToPersist: Array<{ source: WriterLinkedSourceFile; file: File }> = [];
      const sourcesToAdd = files.map((file, index) => {
        const sourceId =
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? `source-${crypto.randomUUID()}`
            : `source-${Date.now()}-${index}-${Math.floor(Math.random() * 100000)}`;

        sourceFileBlobStoreRef.current[sourceId] = file;

        const sourceToAdd: WriterLinkedSourceFile = {
          id: sourceId,
          name: file.name,
          size: file.size,
          mimeType: file.type || "application/octet-stream",
          addedAt: now,
        };

        sourcesToPersist.push({ source: sourceToAdd, file });
        return sourceToAdd;
      });

      updateDocumentWorkspace(documentId, (currentWorkspace) => ({
        ...currentWorkspace,
        sources: [
          ...currentWorkspace.sources,
          ...sourcesToAdd,
        ],
      }));

      for (const { source, file } of sourcesToPersist) {
        void persistLinkedSourceFileBinary(documentId, source, file);
      }

      return sourcesToAdd;
    },
    [updateDocumentWorkspace],
  );

  const handleAttachSourceFiles = useCallback(
    (event: ReactChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = "";

      if (openWorkspaceModal?.field !== "sources") return;
      appendSourceFilesToDocumentWorkspace(openWorkspaceModal.documentId, files);
    },
    [appendSourceFilesToDocumentWorkspace, openWorkspaceModal],
  );

  const resolveLinkedSourceFileForPreview = useCallback(async (
    documentId: string,
    source: WriterLinkedSourceFile,
  ) => {
    const inMemoryFile = sourceFileBlobStoreRef.current[source.id];
    if (inMemoryFile) return inMemoryFile;

    const persistedFile = await readLinkedSourceFileBinary(documentId, source);
    if (persistedFile) {
      sourceFileBlobStoreRef.current[source.id] = persistedFile;
    }
    return persistedFile;
  }, []);

  const handleAttachStandaloneReferenceFiles = useCallback((files: File[]) => {
    if (files.length === 0) return;
    if (openWorkspaceModal?.field !== "sources") return;
    if (openBibliographicReferenceModal == null) return;

    const appendedSources = appendSourceFilesToDocumentWorkspace(
      openWorkspaceModal.documentId,
      files,
    );

    if (appendedSources.length === 0) return;
    const linkedSource = appendedSources[0];
    setOpenBibliographicReferenceModal((currentState) =>
      currentState == null
        ? currentState
        : {
          ...currentState,
          sourceId: linkedSource.id,
          sourceName: linkedSource.name,
          isStandalone: true,
        });
    setStandaloneAttachmentSavedNotice(
      `Arquivo salvo e vinculado: ${linkedSource.name}`,
    );
    window.setTimeout(() => {
      setStandaloneAttachmentSavedNotice((currentNotice) =>
        currentNotice?.includes(linkedSource.name) ? null : currentNotice,
      );
    }, 2600);
  }, [appendSourceFilesToDocumentWorkspace, openBibliographicReferenceModal, openWorkspaceModal]);

  const handleOpenStandaloneReferenceFilePicker = useCallback(() => {
    if (openBibliographicReferenceModal?.isStandalone !== true) return;
    standaloneReferenceFileInputRef.current?.click();
  }, [openBibliographicReferenceModal?.isStandalone]);

  const handleAttachStandaloneReferenceFileInput = useCallback(
    (event: ReactChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = "";
      handleAttachStandaloneReferenceFiles(files);
    },
    [handleAttachStandaloneReferenceFiles],
  );

  const handleRemoveLinkedSource = useCallback(
    (sourceId: string) => {
      if (openWorkspaceModal?.field !== "sources") return;

      delete sourceFileBlobStoreRef.current[sourceId];
      void removeLinkedSourceFileBinary(openWorkspaceModal.documentId, sourceId);
      setOpenSourceActionsMenuId((current) => (current === sourceId ? null : current));
      setOpenSourceActionsMenuSource((current) => (current?.id === sourceId ? null : current));
      setSourceActionsMenuPosition(null);
      setOpenSourceReferenceMenuId((current) => (current === sourceId ? null : current));
      setOpenSourceCitationMenuId((current) => (current === sourceId ? null : current));
      setOpenSourceShareMenuId((current) => (current === sourceId ? null : current));
      setOpenSourceInfoMenuId((current) => (current === sourceId ? null : current));
      setSelectedSourceIds((currentStore) => {
        if (!(sourceId in currentStore)) return currentStore;
        const nextStore = { ...currentStore };
        delete nextStore[sourceId];
        return nextStore;
      });

      updateDocumentWorkspace(openWorkspaceModal.documentId, (currentWorkspace) => ({
        ...currentWorkspace,
        sources: currentWorkspace.sources.filter((source) => source.id !== sourceId),
      }));
    },
    [openWorkspaceModal, updateDocumentWorkspace],
  );

  const handleToggleSourceBulkSelection = useCallback(() => {
    setIsSourceBulkSelectionEnabled((currentState) => {
      const nextState = !currentState;
      if (!nextState) {
        setSelectedSourceIds({});
      } else {
        const nextSelected: Record<string, true> = {};
        for (const source of sortedWorkspaceSources) {
          nextSelected[source.id] = true;
        }
        setSelectedSourceIds(nextSelected);
      }
      return nextState;
    });
  }, [sortedWorkspaceSources]);

  const handleToggleSourceSelected = useCallback((sourceId: string) => {
    setSelectedSourceIds((currentStore) => {
      const nextStore = { ...currentStore };
      if (nextStore[sourceId]) {
        delete nextStore[sourceId];
      } else {
        nextStore[sourceId] = true;
      }
      return nextStore;
    });
  }, []);

  const removeSourcesByIds = useCallback((idsToRemove: string[]) => {
    if (openWorkspaceModal?.field !== "sources") return;
    if (idsToRemove.length === 0) return;

    for (const sourceId of idsToRemove) {
      delete sourceFileBlobStoreRef.current[sourceId];
      void removeLinkedSourceFileBinary(openWorkspaceModal.documentId, sourceId);
    }

    updateDocumentWorkspace(openWorkspaceModal.documentId, (currentWorkspace) => ({
      ...currentWorkspace,
      sources: currentWorkspace.sources.filter((source) => !idsToRemove.includes(source.id)),
    }));

    setOpenSourceActionsMenuId(null);
    setOpenSourceActionsMenuSource(null);
    setSourceActionsMenuPosition(null);
    setOpenSourceReferenceMenuId(null);
    setOpenSourceCitationMenuId(null);
    setOpenSourceOpenWithMenuId(null);
    setOpenSourceShareMenuId(null);
    setOpenSourceInfoMenuId(null);
    setSelectedSourceIds({});
    setIsSourceBulkSelectionEnabled(false);
  }, [openWorkspaceModal, updateDocumentWorkspace]);

  const handleRemoveAllSelectedSources = useCallback(() => {
    if (openWorkspaceModal?.field !== "sources") return;
    const idsToRemove = sortedWorkspaceSources
      .filter((source) => selectedSourceIds[source.id])
      .map((source) => source.id);
    if (idsToRemove.length === 0) return;

    setOpenSourceActionsMenuId(null);
    setOpenSourceActionsMenuSource(null);
    setOpenSourceReferenceMenuId(null);
    setOpenSourceCitationMenuId(null);
    setOpenSourceOpenWithMenuId(null);
    setOpenSourceShareMenuId(null);
    setOpenSourceInfoMenuId(null);
    setSourceActionsMenuPosition(null);
    setTrashConfirmError(null);
    setFilePendingTrash(null);
    setBulkSourceIdsPendingTrash(idsToRemove);
    setIsTrashConfirmOpen(true);
  }, [openWorkspaceModal, selectedSourceIds, sortedWorkspaceSources]);

  const handleRenameLinkedSource = useCallback(
    (source: WriterLinkedSourceFile) => {
      if (openWorkspaceModal?.field !== "sources") return;

      const nextName = window.prompt("Novo nome do arquivo:", source.name)?.trim();
      if (!nextName || nextName === source.name) {
        setOpenSourceActionsMenuId(null);
        setOpenSourceOpenWithMenuId(null);
        setOpenSourceShareMenuId(null);
        setOpenSourceInfoMenuId(null);
        return;
      }

      updateDocumentWorkspace(openWorkspaceModal.documentId, (currentWorkspace) => ({
        ...currentWorkspace,
        sources: currentWorkspace.sources.map((currentSource) =>
          currentSource.id === source.id
            ? { ...currentSource, name: nextName }
            : currentSource,
        ),
      }));
      setOpenSourceActionsMenuId(null);
      setOpenSourceOpenWithMenuId(null);
      setOpenSourceShareMenuId(null);
      setOpenSourceInfoMenuId(null);
    },
    [openWorkspaceModal, updateDocumentWorkspace],
  );

  const handleDownloadLinkedSource = useCallback(async (source: WriterLinkedSourceFile) => {
    let sessionFile = sourceFileBlobStoreRef.current[source.id];
    if (!sessionFile && openWorkspaceModal?.field === "sources") {
      const persistedFile = await readLinkedSourceFileBinary(openWorkspaceModal.documentId, source);
      if (persistedFile) {
        sourceFileBlobStoreRef.current[source.id] = persistedFile;
        sessionFile = persistedFile;
      }
    }

    const fileBlob = sessionFile
      ? sessionFile
      : new Blob(
        [
          `Arquivo: ${source.name}\n`,
          `Tipo: ${source.mimeType}\n`,
          `Tamanho: ${formatFileSize(source.size)}\n`,
          `Adicionado em: ${formatDateTime(source.addedAt)}\n`,
          "\nEste item foi restaurado do armazenamento local da interface e não possui o binário original nesta sessão.\n",
        ],
        { type: "text/plain;charset=utf-8" },
      );
    const downloadName = sessionFile ? source.name : `${source.name}-info.txt`;
    const objectUrl = URL.createObjectURL(fileBlob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = downloadName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
    setSourceLastOpenedAtById((currentStore) => ({
      ...currentStore,
      [source.id]: new Date().toISOString(),
    }));
    setOpenSourceActionsMenuId(null);
    setOpenSourceOpenWithMenuId(null);
    setOpenSourceShareMenuId(null);
    setOpenSourceInfoMenuId(null);
    setSourceActionsMenuPosition(null);
  }, [openWorkspaceModal]);

  const handleOpenLinkedSourceWith = useCallback(async (source: WriterLinkedSourceFile) => {
    let sessionFile = sourceFileBlobStoreRef.current[source.id];
    if (!sessionFile && openWorkspaceModal?.field === "sources") {
      const persistedFile = await readLinkedSourceFileBinary(openWorkspaceModal.documentId, source);
      if (persistedFile) {
        sourceFileBlobStoreRef.current[source.id] = persistedFile;
        sessionFile = persistedFile;
      }
    }

    if (sessionFile && isPdfFileCandidate(source.mimeType, source.name)) {
      const resolvedProjectId =
        state.writeSession.activeProjectId ?? `local-${state.organization.projectKind}`;
      await actions.handleOpenPdfInKnexread({
        file: sessionFile,
        projectId: resolvedProjectId,
        documentId:
          openWorkspaceModal?.field === "sources"
            ? openWorkspaceModal.documentId
            : undefined,
        sourceId: source.id,
        sourceName: source.name,
      });
      setSourceLastOpenedAtById((currentStore) => ({
        ...currentStore,
        [source.id]: new Date().toISOString(),
      }));
      setOpenSourceActionsMenuId(null);
      setOpenSourceOpenWithMenuId(null);
      setOpenSourceShareMenuId(null);
      setOpenSourceInfoMenuId(null);
      setSourceActionsMenuPosition(null);
      return;
    }

    const fileBlob = sessionFile
      ? sessionFile
      : new Blob(
        [
          `Arquivo: ${source.name}\n`,
          `Tipo: ${source.mimeType}\n`,
          `Tamanho: ${formatFileSize(source.size)}\n`,
          `Adicionado em: ${formatDateTime(source.addedAt)}\n`,
        ],
        { type: source.mimeType || "text/plain;charset=utf-8" },
      );
    const objectUrl = URL.createObjectURL(fileBlob);
    window.open(objectUrl, "_blank", "noopener,noreferrer");
    window.setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 60000);
    setSourceLastOpenedAtById((currentStore) => ({
      ...currentStore,
      [source.id]: new Date().toISOString(),
    }));
    setOpenSourceActionsMenuId(null);
    setOpenSourceOpenWithMenuId(null);
    setOpenSourceShareMenuId(null);
    setOpenSourceInfoMenuId(null);
    setSourceActionsMenuPosition(null);
  }, [actions, openWorkspaceModal, state.organization.projectKind, state.writeSession.activeProjectId]);

  const handleOpenLinkedSourceInNewTab = useCallback(async (source: WriterLinkedSourceFile) => {
    let sessionFile = sourceFileBlobStoreRef.current[source.id];
    if (!sessionFile && openWorkspaceModal?.field === "sources") {
      const persistedFile = await readLinkedSourceFileBinary(openWorkspaceModal.documentId, source);
      if (persistedFile) {
        sourceFileBlobStoreRef.current[source.id] = persistedFile;
        sessionFile = persistedFile;
      }
    }

    const fileBlob = sessionFile
      ? sessionFile
      : new Blob(
        [
          `Arquivo: ${source.name}\n`,
          `Tipo: ${source.mimeType}\n`,
          `Tamanho: ${formatFileSize(source.size)}\n`,
          `Adicionado em: ${formatDateTime(source.addedAt)}\n`,
        ],
        { type: source.mimeType || "text/plain;charset=utf-8" },
      );
    const objectUrl = URL.createObjectURL(fileBlob);
    window.open(objectUrl, "_blank", "noopener,noreferrer");
    window.setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 60000);
    setSourceLastOpenedAtById((currentStore) => ({
      ...currentStore,
      [source.id]: new Date().toISOString(),
    }));
    setOpenSourceActionsMenuId(null);
    setOpenSourceOpenWithMenuId(null);
    setOpenSourceShareMenuId(null);
    setOpenSourceInfoMenuId(null);
    setSourceActionsMenuPosition(null);
  }, [openWorkspaceModal]);

  const handleOpenWithExternalApp = useCallback((appName: string) => {
    window.alert(`${appName} ainda nao esta integrado ao KnexWriter.`);
    setOpenSourceActionsMenuId(null);
    setOpenSourceOpenWithMenuId(null);
    setOpenSourceShareMenuId(null);
    setOpenSourceInfoMenuId(null);
    setSourceActionsMenuPosition(null);
  }, []);

  const handleDuplicateLinkedSource = useCallback(async (source: WriterLinkedSourceFile) => {
    if (openWorkspaceModal?.field !== "sources") return;

    const documentId = openWorkspaceModal.documentId;
    const currentWorkspace = documentWorkspaces[documentId] ?? createEmptyWriterDocumentWorkspace();
    const existingNames = new Set(
      currentWorkspace.sources.map((currentSource) => currentSource.name.toLowerCase()),
    );

    const extensionMatch = /(\.[^.]*)$/.exec(source.name);
    const extension = extensionMatch?.[1] ?? "";
    const baseName = extension ? source.name.slice(0, -extension.length) : source.name;
    let duplicatedName = `${baseName} - cópia${extension}`;
    let copyCounter = 2;
    while (existingNames.has(duplicatedName.toLowerCase())) {
      duplicatedName = `${baseName} - cópia (${copyCounter})${extension}`;
      copyCounter += 1;
    }

    const duplicatedSourceId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? `source-${crypto.randomUUID()}`
        : `source-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const duplicatedSource: WriterLinkedSourceFile = {
      id: duplicatedSourceId,
      name: duplicatedName,
      size: source.size,
      mimeType: source.mimeType,
      addedAt: new Date().toISOString(),
    };

    updateDocumentWorkspace(documentId, (workspace) => ({
      ...workspace,
      sources: [...workspace.sources, duplicatedSource],
    }));

    let sessionFile = sourceFileBlobStoreRef.current[source.id];
    if (!sessionFile) {
      const persistedFile = await readLinkedSourceFileBinary(documentId, source);
      if (persistedFile) {
        sourceFileBlobStoreRef.current[source.id] = persistedFile;
        sessionFile = persistedFile;
      }
    }
    if (sessionFile) {
      const duplicatedFile = new File([sessionFile], duplicatedName, {
        type: sessionFile.type || source.mimeType || "application/octet-stream",
        lastModified: Date.now(),
      });
      sourceFileBlobStoreRef.current[duplicatedSource.id] = duplicatedFile;
      void persistLinkedSourceFileBinary(documentId, duplicatedSource, duplicatedFile);
    }

    setOpenSourceActionsMenuId(null);
    setOpenSourceOpenWithMenuId(null);
    setOpenSourceShareMenuId(null);
    setOpenSourceInfoMenuId(null);
    setSourceActionsMenuPosition(null);
  }, [documentWorkspaces, openWorkspaceModal, updateDocumentWorkspace]);

  const handleShareLinkedSource = useCallback(async (source: WriterLinkedSourceFile) => {
    const shareMessage = `Arquivo: ${source.name}\nTipo: ${source.mimeType}\nTamanho: ${formatFileSize(source.size)}`;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareMessage);
      } else {
        window.prompt("Copie as informações do arquivo:", shareMessage);
      }
    } catch {
      window.prompt("Copie as informações do arquivo:", shareMessage);
    }

    setOpenSourceActionsMenuId(null);
    setOpenSourceOpenWithMenuId(null);
    setOpenSourceShareMenuId(null);
    setOpenSourceInfoMenuId(null);
  }, []);

  const handleCopyLinkedSourceLink = useCallback(async (source: WriterLinkedSourceFile) => {
    const shareLink = `knexwriter://source/${source.id}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareLink);
      } else {
        window.prompt("Copie o link do arquivo:", shareLink);
      }
    } catch {
      window.prompt("Copie o link do arquivo:", shareLink);
    }

    setOpenSourceActionsMenuId(null);
    setOpenSourceOpenWithMenuId(null);
    setOpenSourceShareMenuId(null);
    setOpenSourceInfoMenuId(null);
  }, []);

  const handleOrganizeLinkedSources = useCallback(() => {
    if (openWorkspaceModal?.field !== "sources") return;

    updateDocumentWorkspace(openWorkspaceModal.documentId, (currentWorkspace) => ({
      ...currentWorkspace,
      sources: [...currentWorkspace.sources].sort((leftSource, rightSource) =>
        leftSource.name.localeCompare(rightSource.name, "pt-BR", { sensitivity: "base" }),
      ),
    }));
    setOpenSourceActionsMenuId(null);
    setOpenSourceOpenWithMenuId(null);
    setOpenSourceShareMenuId(null);
    setOpenSourceInfoMenuId(null);
  }, [openWorkspaceModal, updateDocumentWorkspace]);

  const handleShowLinkedSourceInfo = useCallback((source: WriterLinkedSourceFile) => {
    window.alert(
      [
        `Nome: ${source.name}`,
        `Tipo: ${source.mimeType}`,
        `Tamanho: ${formatFileSize(source.size)}`,
        `Adicionado: ${formatDateTime(source.addedAt)}`,
      ].join("\n"),
    );
    setOpenSourceActionsMenuId(null);
    setOpenSourceOpenWithMenuId(null);
    setOpenSourceShareMenuId(null);
    setOpenSourceInfoMenuId(null);
  }, []);

  const handleShowLinkedSourceSecurityNotes = useCallback((source: WriterLinkedSourceFile) => {
    window.alert(
      [
        "Limitações de segurança",
        "- Este arquivo pode ter sido restaurado de sessão local sem o binário original.",
        "- Sempre valide autoria, data e integridade antes de usar em citação.",
        `Arquivo: ${source.name}`,
      ].join("\n"),
    );
    setOpenSourceActionsMenuId(null);
    setOpenSourceOpenWithMenuId(null);
    setOpenSourceShareMenuId(null);
    setOpenSourceInfoMenuId(null);
  }, []);

  const handleShowLinkedSourceActivity = useCallback((source: WriterLinkedSourceFile) => {
    window.alert(
      [
        "Atividade do arquivo",
        `Adicionado em: ${formatDateTime(source.addedAt)}`,
        `Tipo registrado: ${source.mimeType || "não informado"}`,
      ].join("\n"),
    );
    setOpenSourceActionsMenuId(null);
    setOpenSourceOpenWithMenuId(null);
    setOpenSourceShareMenuId(null);
    setOpenSourceInfoMenuId(null);
  }, []);

  const handleSearchByLinkedSourceName = useCallback((source: WriterLinkedSourceFile) => {
    const searchTerm = source.name.replace(/\.[^.]+$/, "").trim();
    window.prompt("Pesquisar por arquivo:", searchTerm);
    setOpenSourceActionsMenuId(null);
    setOpenSourceOpenWithMenuId(null);
    setOpenSourceShareMenuId(null);
    setOpenSourceInfoMenuId(null);
  }, []);

  const resolveSourceSubmenuPlacement = useCallback(
    (
      triggerElement: HTMLElement,
      submenuWidth: number,
    ): { side: "left" | "right"; offsetPx: number } => {
      const triggerBounds = triggerElement.getBoundingClientRect();
      const listViewport = triggerElement.closest(
        "[data-knexwriter-source-list-viewport='true']",
      ) as HTMLElement | null;
      const minGap = 8;
      const safePadding = 6;
      const modalSurface = triggerElement.closest(
        "[data-knexwriter-sources-modal-surface='true']",
      ) as HTMLElement | null;

      const boundaryLeft =
        listViewport?.getBoundingClientRect().left
        ?? modalSurface?.getBoundingClientRect().left
        ?? 0;
      const boundaryRight =
        listViewport?.getBoundingClientRect().right
        ?? modalSurface?.getBoundingClientRect().right
        ?? (window.innerWidth || document.documentElement.clientWidth);

      const spaceLeft = triggerBounds.left - boundaryLeft;
      const spaceRight = boundaryRight - triggerBounds.right;
      const fitsLeft = spaceLeft >= submenuWidth + minGap + safePadding;
      const fitsRight = spaceRight >= submenuWidth + minGap + safePadding;

      if (fitsLeft) return { side: "left", offsetPx: 0 };
      if (fitsRight) return { side: "right", offsetPx: 0 };

      if (spaceLeft >= spaceRight) {
        const availableLeft = Math.max(0, spaceLeft - minGap - safePadding);
        const overflowLeft = Math.max(0, submenuWidth - availableLeft);
        return { side: "left", offsetPx: overflowLeft };
      }

      const availableRight = Math.max(0, spaceRight - minGap - safePadding);
      const overflowRight = Math.max(0, submenuWidth - availableRight);
      return { side: "right", offsetPx: overflowRight };
    },
    [],
  );

  const resolveSourceActionsMenuPosition = useCallback((triggerElement: HTMLElement) => {
    const menuWidth = 420;
    const estimatedMenuHeight = 360;
    const minGap = 8;
    const triggerBounds = triggerElement.getBoundingClientRect();
    const modalSurface = triggerElement.closest(
      "[data-knexwriter-sources-modal-surface='true']",
    ) as HTMLElement | null;
    const modalBounds = modalSurface?.getBoundingClientRect();

    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

    const boundaryLeft = modalBounds ? modalBounds.left + minGap : minGap;
    const boundaryRight = modalBounds ? modalBounds.right - minGap : viewportWidth - minGap;
    const boundaryTop = modalBounds ? modalBounds.top + minGap : minGap;
    const boundaryBottom = modalBounds ? modalBounds.bottom - minGap : viewportHeight - minGap;

    let left = triggerBounds.right - menuWidth;
    left = Math.max(boundaryLeft, Math.min(left, boundaryRight - menuWidth));

    let top = triggerBounds.bottom + 6;
    if (top + estimatedMenuHeight > boundaryBottom) {
      top = triggerBounds.top - estimatedMenuHeight - 6;
    }
    top = Math.max(boundaryTop, Math.min(top, boundaryBottom - estimatedMenuHeight));

    const safeTop = Number.isFinite(top) ? top : 120;
    const safeLeft = Number.isFinite(left) ? left : 120;
    return { top: safeTop, left: safeLeft };
  }, []);

  const resolveSourceSortMenuPosition = useCallback((triggerElement: HTMLElement) => {
    const menuWidth = 320;
    const estimatedMenuHeight = 460;
    const minGap = 8;
    const triggerBounds = triggerElement.getBoundingClientRect();
    const modalSurface = triggerElement.closest(
      "[data-knexwriter-sources-modal-surface='true']",
    ) as HTMLElement | null;
    const modalBounds = modalSurface?.getBoundingClientRect();

    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

    const boundaryLeft = modalBounds ? modalBounds.left + minGap : minGap;
    const boundaryRight = modalBounds ? modalBounds.right - minGap : viewportWidth - minGap;
    const boundaryTop = modalBounds ? modalBounds.top + minGap : minGap;
    const boundaryBottom = modalBounds ? modalBounds.bottom - minGap : viewportHeight - minGap;

    let left = triggerBounds.right - menuWidth;
    left = Math.max(boundaryLeft, Math.min(left, boundaryRight - menuWidth));

    let top = triggerBounds.bottom + 8;
    if (top + estimatedMenuHeight > boundaryBottom) {
      top = triggerBounds.top - estimatedMenuHeight - 8;
    }
    top = Math.max(boundaryTop, Math.min(top, boundaryBottom - estimatedMenuHeight));

    const safeTop = Number.isFinite(top) ? top : 120;
    const safeLeft = Number.isFinite(left) ? left : 120;
    return { top: safeTop, left: safeLeft };
  }, []);

  const handleOpenSourceActionsMenuFromTrigger = useCallback(
    (source: WriterLinkedSourceFile, triggerButton: HTMLButtonElement | null) => {
      setIsSourceSortMenuOpen(false);
      setOpenSourceReferenceMenuId(null);
      setOpenSourceCitationMenuId(null);
      setOpenSourceOpenWithMenuId(null);
      setOpenSourceShareMenuId(null);
      setOpenSourceInfoMenuId(null);

      const fallbackMenuPosition = {
        top: Math.max(80, Math.round(window.innerHeight * 0.2)),
        left: Math.max(80, Math.round(window.innerWidth * 0.2)),
      };
      setSourceActionsMenuPosition(
        triggerButton
          ? resolveSourceActionsMenuPosition(triggerButton)
          : fallbackMenuPosition,
      );
      setOpenSourceActionsMenuSource(source);
      setOpenSourceActionsMenuId(source.id);
    },
    [resolveSourceActionsMenuPosition],
  );

  const handleMoveLinkedSourceToTrash = useCallback(
    (source: WriterLinkedSourceFile) => {
      setOpenSourceActionsMenuId(null);
      setOpenSourceActionsMenuSource(null);
      setOpenSourceOpenWithMenuId(null);
      setOpenSourceShareMenuId(null);
      setOpenSourceInfoMenuId(null);
      setSourceActionsMenuPosition(null);
      setTrashConfirmError(null);
      setBulkSourceIdsPendingTrash([]);
      setFilePendingTrash(source);
      setIsTrashConfirmOpen(true);
    },
    [],
  );

  const handleCloseTrashConfirm = useCallback(() => {
    if (isTrashConfirmSubmitting) return;
    setIsTrashConfirmOpen(false);
    setFilePendingTrash(null);
    setBulkSourceIdsPendingTrash([]);
    setTrashConfirmError(null);
  }, [isTrashConfirmSubmitting]);

  const handleConfirmMoveLinkedSourceToTrash = useCallback(async () => {
    const hasBulkSelection = bulkSourceIdsPendingTrash.length > 0;
    if (!filePendingTrash && !hasBulkSelection) {
      setTrashConfirmError("Nenhum arquivo selecionado para mover para a lixeira.");
      return;
    }

    setIsTrashConfirmSubmitting(true);
    setTrashConfirmError(null);

    try {
      if (hasBulkSelection) {
        await Promise.resolve(removeSourcesByIds(bulkSourceIdsPendingTrash));
      } else if (filePendingTrash) {
        await Promise.resolve(handleRemoveLinkedSource(filePendingTrash.id));
      }
      setIsTrashConfirmOpen(false);
      setFilePendingTrash(null);
      setBulkSourceIdsPendingTrash([]);
    } catch {
      setTrashConfirmError(hasBulkSelection
        ? `Não foi possível mover ${bulkSourceIdsPendingTrash.length} arquivo(s) para a lixeira. Tente novamente.`
        : `Não foi possível mover "${filePendingTrash?.name ?? "arquivo"}" para a lixeira. Tente novamente.`);
    } finally {
      setIsTrashConfirmSubmitting(false);
    }
  }, [bulkSourceIdsPendingTrash, filePendingTrash, handleRemoveLinkedSource, removeSourcesByIds]);

  const handleInsertBibliographicReference = useCallback(
    (source: WriterLinkedSourceFile) => {
      if (openWorkspaceModal?.field !== "sources") return;
      const fallbackTitle = source.name.replace(/\.[^.]+$/, "").trim();
      const defaultYear = new Date(source.addedAt).getFullYear();

      setBibliographicReferenceTab("sourceData");
      setBibliographicReferenceForm({
        ...DEFAULT_BIBLIOGRAPHIC_REFERENCE_FORM,
        title: fallbackTitle,
        year: Number.isFinite(defaultYear) ? String(defaultYear) : "",
        notes: `Fonte associada ao arquivo: ${source.name}`,
        url: "",
        accessUrl: "",
        citationDraft: createEmptyCitationOccurrenceDraft(),
        citationOccurrences: [],
      });
      setOpenBibliographicReferenceModal({
        documentId: openWorkspaceModal.documentId,
        sourceId: source.id,
        sourceName: source.name,
        isStandalone: false,
      });
      setGenerateCitationErrorMessage(null);
      setStandaloneAttachmentSavedNotice(null);
      setOpenBibliographicResponsibleActions(null);
      setOpenSourceReferenceMenuId(null);
    },
    [openWorkspaceModal],
  );

  const handleInsertStandaloneBibliographicReference = useCallback(() => {
    if (openWorkspaceModal?.field !== "sources") return;

    const sourceId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? `standalone-reference-${crypto.randomUUID()}`
        : `standalone-reference-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    setBibliographicReferenceTab("sourceData");
    setBibliographicReferenceForm({
      ...DEFAULT_BIBLIOGRAPHIC_REFERENCE_FORM,
      title: "",
      year: "",
      notes: "Referência avulsa (sem arquivo vinculado).",
      url: "",
      accessUrl: "",
      citationDraft: createEmptyCitationOccurrenceDraft(),
      citationOccurrences: [],
    });
    setOpenBibliographicReferenceModal({
      documentId: openWorkspaceModal.documentId,
      sourceId,
      sourceName: "Referência avulsa",
      isStandalone: true,
    });
    setGenerateCitationErrorMessage(null);
    setStandaloneAttachmentSavedNotice(null);
    setOpenBibliographicResponsibleActions(null);
    setOpenSourceReferenceMenuId(null);
    setOpenSourceCitationMenuId(null);
    setOpenSourceActionsMenuId(null);
    setOpenSourceActionsMenuSource(null);
    setOpenSourceOpenWithMenuId(null);
    setOpenSourceShareMenuId(null);
    setOpenSourceInfoMenuId(null);
  }, [openWorkspaceModal]);

  const handleCloseBibliographicReferenceModal = useCallback(() => {
    setOpenBibliographicReferenceModal(null);
    setOpenBibliographicResponsibleActions(null);
    setCopyReferenceActionState("idle");
    setGenerateCitationActionState("idle");
    setSaveReferenceActionState("idle");
    setCancelReferenceActionState("idle");
    setAddResponsibleActionState({
      author: "idle",
      organizer: "idle",
      editor: "idle",
      translator: "idle",
    });
    setGenerateCitationErrorMessage(null);
    setStandaloneAttachmentSavedNotice(null);
  }, []);

  const handleCopyBibliographicReference = useCallback(async () => {
    setCopyReferenceActionState("working");
    if (!bibliographicFormattedReference) {
      setCopyReferenceActionState("error");
      resetBibliographicActionState(setCopyReferenceActionState);
      window.alert("Preencha os campos principais para gerar a referência.");
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(bibliographicFormattedReference);
      } else {
        window.prompt("Copie a referência:", bibliographicFormattedReference);
      }
      setCopyReferenceActionState("success");
      resetBibliographicActionState(setCopyReferenceActionState);
    } catch {
      setCopyReferenceActionState("error");
      resetBibliographicActionState(setCopyReferenceActionState);
      window.prompt("Copie a referência:", bibliographicFormattedReference);
    }
  }, [bibliographicFormattedReference, resetBibliographicActionState]);

  const handleGenerateBibliographicCitation = useCallback(async () => {
    setGenerateCitationActionState("working");
    setGenerateCitationErrorMessage(null);
    if (openBibliographicReferenceModal == null) {
      setGenerateCitationActionState("error");
      resetBibliographicActionState(setGenerateCitationActionState);
      setGenerateCitationErrorMessage("Abra uma referência antes de gerar a citação.");
      return;
    }

    const hasPersonalAuthor = normalizeBibliographicAuthors(bibliographicReferenceForm.authors).length > 0;
    const hasInstitutionalAuthor = bibliographicReferenceForm.organizationAuthor.trim().length > 0;
    const hasReferenceTitle = bibliographicReferenceForm.title.trim().length > 0;
    const hasReferenceYear = bibliographicReferenceForm.year.trim().length > 0;

    if (
      !hasReferenceYear || !(hasPersonalAuthor || hasInstitutionalAuthor || hasReferenceTitle)
    ) {
      setGenerateCitationActionState("error");
      resetBibliographicActionState(setGenerateCitationActionState);
      setGenerateCitationErrorMessage(
        "Para gerar a citação, preencha ano e pelo menos um dos campos: autor(es), autor institucional ou título.",
      );
      return;
    }

    const activeDraft = bibliographicReferenceForm.citationDraft;
    if (
      (activeDraft.citationType === "directShort" || activeDraft.citationType === "directLong")
      && !activeDraft.page.trim()
      && !activeDraft.timestampStart.trim()
    ) {
      setGenerateCitationActionState("error");
      resetBibliographicActionState(setGenerateCitationActionState);
      setGenerateCitationErrorMessage("Para citação direta, informe página ou timestamp.");
      return;
    }

    const sourceStyle = bibliographicEngineStyle;
    const normalizedSource = {
      ...bibliographicDraftSource,
      style: sourceStyle,
    };
    const parentheticalCitationOutput = formatEngineCitation(normalizedSource, {
      sourceId: normalizedSource.id,
      style: sourceStyle,
      mode: "parenthetical",
    });
    const narrativeCitationOutput = formatEngineCitation(normalizedSource, {
      sourceId: normalizedSource.id,
      style: sourceStyle,
      mode: "narrative",
    });

    const citationVariantsText = [
      `Parentética: ${parentheticalCitationOutput.citation}`,
      `Narrativa: ${narrativeCitationOutput.citation}`,
    ].join("\n");

    updateDocumentWorkspace(openBibliographicReferenceModal.documentId, (currentWorkspace) => {
      const resolvedMode = activeDraft.mode;
      const citationForInsertion =
        resolvedMode === "narrative"
          ? narrativeCitationOutput.citation
          : parentheticalCitationOutput.citation;
      const footnote = buildFootnoteFromCitationDraft(citationForInsertion, activeDraft);

      const nextSourceCitationTemplates = {
        ...currentWorkspace.sourceCitationTemplates,
        [openBibliographicReferenceModal.sourceId]: {
          parenthetical: parentheticalCitationOutput.citation,
          narrative: narrativeCitationOutput.citation,
        },
      };

      const currentReferenceMemory =
        currentWorkspace.referenceMemory
        ?? createEngineDocumentReferenceMemory(openBibliographicReferenceModal.documentId, sourceStyle);
      const withReference = upsertEngineReference(
        {
          ...currentReferenceMemory,
          selectedStyle: sourceStyle,
        },
        normalizedSource,
      );
      const withCitation = appendEngineCitation(
        withReference,
        toEngineCitationInstance(
          openBibliographicReferenceModal.documentId,
          resolvedMode === "narrative" ? narrativeCitationOutput : parentheticalCitationOutput,
          buildCitationLocatorFromDraft(activeDraft),
          {
            occurrenceType: activeDraft.citationType,
            callFormat: activeDraft.callFormat,
            page: activeDraft.page.trim() || undefined,
            pageEnd: activeDraft.pageEnd.trim() || undefined,
            chapter: activeDraft.chapter.trim() || undefined,
            section: activeDraft.section.trim() || undefined,
            paragraph: activeDraft.paragraph.trim() || undefined,
            timestampStart: activeDraft.timestampStart.trim() || undefined,
            timestampEnd: activeDraft.timestampEnd.trim() || undefined,
            literalExcerpt: activeDraft.literalExcerpt.trim() || undefined,
            paraphrasedExcerpt: activeDraft.paraphrasedExcerpt.trim() || undefined,
            authorComment: activeDraft.authorComment.trim() || undefined,
            insertedAtBlockId: activeDraft.locationInDocument.trim() || undefined,
            footnoteText: footnote || undefined,
            isCitationInText: true,
            generateReferenceEntry: activeDraft.includeReferenceEntry,
          },
        ),
      );

      return {
        ...currentWorkspace,
        directCitations:
          activeDraft.citationType === "directShort" || activeDraft.citationType === "directLong"
            ? [
              ...currentWorkspace.directCitations,
              resolvedMode === "narrative" ? narrativeCitationOutput.citation : parentheticalCitationOutput.citation,
            ]
            : currentWorkspace.directCitations,
        indirectCitations:
          activeDraft.citationType === "indirect" || activeDraft.citationType === "paraphrase"
            ? [
              ...currentWorkspace.indirectCitations,
              resolvedMode === "narrative" ? narrativeCitationOutput.citation : parentheticalCitationOutput.citation,
            ]
            : currentWorkspace.indirectCitations,
        footnotes:
          activeDraft.callFormat === "footnote"
            ? [...currentWorkspace.footnotes, footnote]
            : currentWorkspace.footnotes,
        sourceCitationTemplates: nextSourceCitationTemplates,
        referenceMemory: withCitation,
      };
    });

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(citationVariantsText);
      } else {
        window.prompt("Citações geradas:", citationVariantsText);
      }
      setGenerateCitationActionState("success");
      resetBibliographicActionState(setGenerateCitationActionState);
      setGenerateCitationErrorMessage(null);
    } catch {
      setGenerateCitationActionState("error");
      resetBibliographicActionState(setGenerateCitationActionState);
      setGenerateCitationErrorMessage(
        `A citação foi gerada, mas não foi possível copiar automaticamente. Copie manualmente: ${citationVariantsText}`,
      );
    }
  }, [
    bibliographicDraftSource,
    bibliographicEngineStyle,
    bibliographicReferenceForm.citationDraft,
    bibliographicReferenceForm.authors,
    bibliographicReferenceForm.organizationAuthor,
    bibliographicReferenceForm.title,
    bibliographicReferenceForm.year,
    setGenerateCitationErrorMessage,
    openBibliographicReferenceModal,
    resetBibliographicActionState,
    updateDocumentWorkspace,
  ]);

  const handleSaveBibliographicReference = useCallback(() => {
    setSaveReferenceActionState("working");
    if (openBibliographicReferenceModal == null) {
      setSaveReferenceActionState("error");
      resetBibliographicActionState(setSaveReferenceActionState);
      return;
    }

    if (!bibliographicFormattedReference) {
      setSaveReferenceActionState("error");
      resetBibliographicActionState(setSaveReferenceActionState);
      window.alert("Preencha os campos principais para salvar a referência.");
      return;
    }

    updateDocumentWorkspace(openBibliographicReferenceModal.documentId, (currentWorkspace) => {
      const sourceStyle = bibliographicEngineStyle;
      const normalizedSource = {
        ...bibliographicDraftSource,
        style: sourceStyle,
      };
      const nextReferences = bibliographicReferenceForm.saveInFileMemory
        ? [...currentWorkspace.references, bibliographicFormattedReference]
        : currentWorkspace.references;

      const linkedCitationText =
        bibliographicReferenceForm.citationDraft.mode === "narrative"
          ? bibliographicCitationTemplates.narrative
          : bibliographicCitationTemplates.parenthetical;
      const linkedAsDirect =
        bibliographicReferenceForm.citationDraft.citationType === "directShort"
        || bibliographicReferenceForm.citationDraft.citationType === "directLong";
      const linkedAsIndirect = !linkedAsDirect;
      const nextDirectCitations =
        bibliographicReferenceForm.linkToCurrentDocument && linkedAsDirect
          ? [...currentWorkspace.directCitations, linkedCitationText]
          : currentWorkspace.directCitations;
      const nextIndirectCitations =
        bibliographicReferenceForm.linkToCurrentDocument && linkedAsIndirect
          ? [...currentWorkspace.indirectCitations, linkedCitationText]
          : currentWorkspace.indirectCitations;

      const nextSourceCitationTemplates = {
        ...currentWorkspace.sourceCitationTemplates,
        [openBibliographicReferenceModal.sourceId]: {
          parenthetical: bibliographicCitationTemplates.parenthetical,
          narrative: bibliographicCitationTemplates.narrative,
        },
      };
      const nextFootnotes =
        bibliographicReferenceForm.linkToCurrentDocument && bibliographicReferenceForm.citationDraft.callFormat === "footnote"
          ? [
            ...currentWorkspace.footnotes,
            buildFootnoteFromCitationDraft(linkedCitationText, bibliographicReferenceForm.citationDraft),
          ]
          : currentWorkspace.footnotes;

      const currentReferenceMemory =
        currentWorkspace.referenceMemory
        ?? createEngineDocumentReferenceMemory(openBibliographicReferenceModal.documentId, sourceStyle);

      let nextReferenceMemory = upsertEngineReference(
        {
          ...currentReferenceMemory,
          selectedStyle: sourceStyle,
        },
        normalizedSource,
      );

      if (bibliographicReferenceForm.linkToCurrentDocument) {
        const locator = buildCitationLocatorFromDraft(bibliographicReferenceForm.citationDraft);
        const citationMode = bibliographicReferenceForm.citationDraft.mode;
        const citationOutput = formatEngineCitation(normalizedSource, {
          sourceId: normalizedSource.id,
          style: sourceStyle,
          mode: citationMode,
        });
        const footnote = buildFootnoteFromCitationDraft(citationOutput.citation, bibliographicReferenceForm.citationDraft);
        nextReferenceMemory = appendEngineCitation(
          nextReferenceMemory,
          toEngineCitationInstance(
            openBibliographicReferenceModal.documentId,
            citationOutput,
            locator,
            {
              occurrenceType: bibliographicReferenceForm.citationDraft.citationType,
              callFormat: bibliographicReferenceForm.citationDraft.callFormat,
              page: bibliographicReferenceForm.citationDraft.page.trim() || undefined,
              pageEnd: bibliographicReferenceForm.citationDraft.pageEnd.trim() || undefined,
              chapter: bibliographicReferenceForm.citationDraft.chapter.trim() || undefined,
              section: bibliographicReferenceForm.citationDraft.section.trim() || undefined,
              paragraph: bibliographicReferenceForm.citationDraft.paragraph.trim() || undefined,
              timestampStart: bibliographicReferenceForm.citationDraft.timestampStart.trim() || undefined,
              timestampEnd: bibliographicReferenceForm.citationDraft.timestampEnd.trim() || undefined,
              literalExcerpt: bibliographicReferenceForm.citationDraft.literalExcerpt.trim() || undefined,
              paraphrasedExcerpt: bibliographicReferenceForm.citationDraft.paraphrasedExcerpt.trim() || undefined,
              authorComment: bibliographicReferenceForm.citationDraft.authorComment.trim() || undefined,
              insertedAtBlockId: bibliographicReferenceForm.citationDraft.locationInDocument.trim() || undefined,
              footnoteText: footnote || undefined,
              generateReferenceEntry: bibliographicReferenceForm.citationDraft.includeReferenceEntry,
            },
          ),
        );
      }

      if (bibliographicReferenceForm.citationOccurrences.length > 0) {
        for (const occurrence of bibliographicReferenceForm.citationOccurrences) {
          const output = formatEngineCitation(normalizedSource, {
            sourceId: normalizedSource.id,
            style: sourceStyle,
            mode: occurrence.mode,
          });
          const footnote = buildFootnoteFromCitationDraft(output.citation, occurrence);
          nextReferenceMemory = appendEngineCitation(
            nextReferenceMemory,
            toEngineCitationInstance(
              openBibliographicReferenceModal.documentId,
              output,
              buildCitationLocatorFromDraft(occurrence),
              {
                occurrenceType: occurrence.citationType,
                callFormat: occurrence.callFormat,
                page: occurrence.page.trim() || undefined,
                pageEnd: occurrence.pageEnd.trim() || undefined,
                chapter: occurrence.chapter.trim() || undefined,
                section: occurrence.section.trim() || undefined,
                paragraph: occurrence.paragraph.trim() || undefined,
                timestampStart: occurrence.timestampStart.trim() || undefined,
                timestampEnd: occurrence.timestampEnd.trim() || undefined,
                literalExcerpt: occurrence.literalExcerpt.trim() || undefined,
                paraphrasedExcerpt: occurrence.paraphrasedExcerpt.trim() || undefined,
                authorComment: occurrence.authorComment.trim() || undefined,
                insertedAtBlockId: occurrence.locationInDocument.trim() || undefined,
                footnoteText: footnote || undefined,
                generateReferenceEntry: occurrence.includeReferenceEntry,
              },
            ),
          );
        }
      }

      const existingAttachments = nextReferenceMemory.attachments ?? [];
      const existingNotes = nextReferenceMemory.notes ?? [];
      const existingTags = nextReferenceMemory.tags ?? [];
      const nextAttachments = openBibliographicSource
        ? [
          ...existingAttachments.filter(
            (
              attachment: NonNullable<DocumentReferenceMemory["attachments"]>[number],
            ) => attachment.sourceId !== openBibliographicSource.id,
          ),
          {
            id: `att-${openBibliographicSource.id}`,
            sourceId: openBibliographicSource.id,
            name: openBibliographicSource.name,
            mimeType: openBibliographicSource.mimeType,
          },
        ]
        : existingAttachments;
      const noteId =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? `note-${crypto.randomUUID()}`
          : `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const tags = bibliographicReferenceForm.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((tag) => ({
          id: `tag-${tag.toLowerCase()}`,
          sourceId: normalizedSource.id,
          label: tag,
        }));

      nextReferenceMemory = {
        ...nextReferenceMemory,
        attachments: nextAttachments,
        notes: bibliographicReferenceForm.notes.trim()
          ? [
            ...existingNotes,
            {
              id: noteId,
              sourceId: normalizedSource.id,
              content: bibliographicReferenceForm.notes.trim(),
            },
          ]
          : existingNotes,
        tags: [...existingTags, ...tags],
      };

      return {
        ...currentWorkspace,
        references: nextReferences,
        directCitations: nextDirectCitations,
        indirectCitations: nextIndirectCitations,
        footnotes: nextFootnotes,
        sourceCitationTemplates: nextSourceCitationTemplates,
        referenceMemory: nextReferenceMemory,
      };
    });

    setSaveReferenceActionState("success");
    resetBibliographicActionState(setSaveReferenceActionState);
    window.setTimeout(() => {
      setOpenBibliographicReferenceModal(null);
      setOpenBibliographicResponsibleActions(null);
    }, 180);
  }, [
    bibliographicCitationTemplates.narrative,
    bibliographicCitationTemplates.parenthetical,
    bibliographicDraftSource,
    bibliographicEngineStyle,
    bibliographicFormattedReference,
    bibliographicReferenceForm.citationDraft,
    bibliographicReferenceForm.citationOccurrences,
    bibliographicReferenceForm.linkToCurrentDocument,
    bibliographicReferenceForm.notes,
    bibliographicReferenceForm.saveInFileMemory,
    bibliographicReferenceForm.tags,
    openBibliographicSource,
    openBibliographicReferenceModal,
    resetBibliographicActionState,
    updateDocumentWorkspace,
  ]);

  const handleCancelBibliographicReference = useCallback(() => {
    setCancelReferenceActionState("working");
    window.setTimeout(() => {
      setCancelReferenceActionState("success");
      window.setTimeout(() => {
        setOpenBibliographicReferenceModal(null);
        setOpenBibliographicResponsibleActions(null);
        resetBibliographicActionState(setCancelReferenceActionState, 600);
      }, 120);
    }, 120);
  }, [resetBibliographicActionState]);

  const setBibliographicReferenceField = useCallback(
    <Field extends keyof BibliographicReferenceFormState>(
      field: Field,
      value: BibliographicReferenceFormState[Field],
    ) => {
      setBibliographicReferenceForm((currentForm) => ({
        ...currentForm,
        [field]: value,
      }));
    },
    [],
  );

  const setBibliographicCitationDraftField = useCallback(
    <Field extends keyof BibliographicCitationOccurrenceInput>(
      field: Field,
      value: BibliographicCitationOccurrenceInput[Field],
    ) => {
      setBibliographicReferenceForm((currentForm) => ({
        ...currentForm,
        citationDraft: {
          ...currentForm.citationDraft,
          [field]: value,
        },
      }));
    },
    [],
  );

  const handleAddCitationOccurrence = useCallback(() => {
    setBibliographicReferenceForm((currentForm) => ({
      ...currentForm,
      citationOccurrences: [...currentForm.citationOccurrences, currentForm.citationDraft],
      citationDraft: createEmptyCitationOccurrenceDraft(),
    }));
  }, []);

  const handleRemoveCitationOccurrence = useCallback((occurrenceId: string) => {
    setBibliographicReferenceForm((currentForm) => ({
      ...currentForm,
      citationOccurrences: currentForm.citationOccurrences.filter((occurrence) => occurrence.id !== occurrenceId),
    }));
  }, []);

  const setResponsibleActionState = useCallback(
    (role: BibliographicResponsibleRole, status: BibliographicActionState) => {
      setAddResponsibleActionState((current) => ({
        ...current,
        [role]: status,
      }));
    },
    [],
  );

  const handleAddBibliographicResponsible = useCallback((role: BibliographicResponsibleRole) => {
    const fieldName = BIBLIOGRAPHIC_RESPONSIBLE_FIELD_BY_ROLE[role];
    setResponsibleActionState(role, "working");
    setBibliographicReferenceForm((currentForm) => ({
      ...currentForm,
      [fieldName]: [
        ...(currentForm[fieldName] as BibliographicAuthorInput[]),
        { ...EMPTY_BIBLIOGRAPHIC_AUTHOR },
      ],
    }));
    window.setTimeout(() => {
      setResponsibleActionState(role, "idle");
    }, 320);
  }, [setResponsibleActionState]);

  const handleUpdateBibliographicResponsible = useCallback(
    (
      role: BibliographicResponsibleRole,
      responsibleIndex: number,
      field: keyof BibliographicAuthorInput,
      value: string,
    ) => {
      const fieldName = BIBLIOGRAPHIC_RESPONSIBLE_FIELD_BY_ROLE[role];
      setBibliographicReferenceForm((currentForm) => ({
        ...currentForm,
        [fieldName]: (currentForm[fieldName] as BibliographicAuthorInput[]).map((person, index) =>
          index === responsibleIndex
            ? { ...person, [field]: value }
            : person,
        ),
      }));
    },
    [],
  );

  const handleRemoveBibliographicResponsible = useCallback((role: BibliographicResponsibleRole, responsibleIndex: number) => {
    const fieldName = BIBLIOGRAPHIC_RESPONSIBLE_FIELD_BY_ROLE[role];
    setBibliographicReferenceForm((currentForm) => {
      const nextResponsibleList = (currentForm[fieldName] as BibliographicAuthorInput[]).filter(
        (_, index) => index !== responsibleIndex,
      );
      return {
        ...currentForm,
        [fieldName]: nextResponsibleList.length > 0 ? nextResponsibleList : [{ ...EMPTY_BIBLIOGRAPHIC_AUTHOR }],
      };
    });
    setOpenBibliographicResponsibleActions(null);
  }, []);

  const handleEditBibliographicResponsible = useCallback((role: BibliographicResponsibleRole, responsibleIndex: number) => {
    setOpenBibliographicResponsibleActions(null);
    const input = bibliographicResponsibleFirstNameInputRefs.current[role][responsibleIndex];
    input?.focus();
    input?.select();
  }, []);

  const handleDeleteBibliographicResponsible = useCallback((role: BibliographicResponsibleRole, responsibleIndex: number) => {
    handleRemoveBibliographicResponsible(role, responsibleIndex);
    setOpenBibliographicResponsibleActions(null);
  }, [handleRemoveBibliographicResponsible]);

  const renderResponsibleFieldGroup = (
    role: BibliographicResponsibleRole,
    label: string,
    help: string,
    required = false,
  ) => {
    const fieldName = BIBLIOGRAPHIC_RESPONSIBLE_FIELD_BY_ROLE[role];
    const roleLabel = BIBLIOGRAPHIC_RESPONSIBLE_LABEL_BY_ROLE[role];
    const responsibleList = bibliographicReferenceForm[fieldName] as BibliographicAuthorInput[];
    const actionState = addResponsibleActionState[role];

    return (
      <div className="w-full">
        <FieldLabel text={label} help={help} required={required} />
        <div className="mt-2 space-y-2">
          {responsibleList.map((person, personIndex) => {
            const isActionsOpen =
              openBibliographicResponsibleActions?.role === role
              && openBibliographicResponsibleActions.index === personIndex;

            return (
              <div
                key={`bibliographic-${role}-${personIndex}`}
                className={personIndex < responsibleList.length - 1 ? "space-y-2 border-b border-zinc-100 pb-2" : "space-y-2"}
              >
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {personIndex + 1}º {roleLabel}
                </p>
                <div
                  className="grid items-center gap-2"
                  style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) 40px" }}
                >
                  <input
                    ref={(node) => {
                      bibliographicResponsibleFirstNameInputRefs.current[role][personIndex] = node;
                    }}
                    value={person.firstName}
                    onChange={(event) =>
                      handleUpdateBibliographicResponsible(role, personIndex, "firstName", event.target.value)}
                    placeholder="Primeiro nome"
                    className="h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                  />
                  <input
                    value={person.middleName}
                    onChange={(event) =>
                      handleUpdateBibliographicResponsible(role, personIndex, "middleName", event.target.value)}
                    placeholder="Nome do meio"
                    className="h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                  />
                  <input
                    value={person.lastName}
                    onChange={(event) =>
                      handleUpdateBibliographicResponsible(role, personIndex, "lastName", event.target.value)}
                    placeholder="Sobrenome"
                    className="h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                  />
                  <div
                    className="relative flex justify-center"
                    ref={isActionsOpen ? bibliographicResponsibleActionsMenuRef : null}
                  >
                    <button
                      type="button"
                      title={`Ações do ${roleLabel}`}
                      aria-label={`Ações do ${roleLabel}`}
                      data-knexwriter-responsible-actions-trigger="true"
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpenBibliographicResponsibleActions((current) =>
                          current?.role === role && current.index === personIndex
                            ? null
                            : { role, index: personIndex });
                      }}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
                    >
                      <MoreVertical size={16} />
                    </button>

                    {isActionsOpen ? (
                      <div className="absolute right-0 top-[calc(100%+6px)] z-[4600] min-w-[240px] w-max overflow-hidden rounded-lg border border-zinc-300 bg-white shadow-xl">
                        <button
                          type="button"
                          onClick={() => handleEditBibliographicResponsible(role, personIndex)}
                          className="flex w-full items-center gap-3 border-b border-zinc-200 px-5 py-3 text-left text-sm font-medium text-sky-800 hover:bg-sky-50"
                        >
                          <Pencil size={17} className="shrink-0" />
                          <span className="whitespace-nowrap">Editar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBibliographicResponsible(role, personIndex)}
                          className="flex w-full items-center gap-3 px-5 py-3 text-left text-sm font-medium text-red-700 hover:bg-red-50"
                        >
                          <Trash2 size={17} className="shrink-0" />
                          <span className="whitespace-nowrap">Excluir</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-start">
          <button
            type="button"
            onClick={() => handleAddBibliographicResponsible(role)}
            disabled={actionState === "working"}
            className={`inline-flex min-h-8 items-center gap-1 rounded-md border border-emerald-600 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm transition-all duration-150 active:scale-95 hover:bg-emerald-50 ${
              actionState === "working" ? "cursor-wait animate-pulse" : ""
            }`}
          >
            {actionState === "working" ? (
              <RefreshCw size={12} className="animate-spin" />
            ) : (
              <Plus size={12} />
            )}
            <span>{actionState === "working" ? `Criando ${roleLabel}...` : `Adicionar ${roleLabel}`}</span>
          </button>
        </div>
      </div>
    );
  };

  const handleApplySourceCitationTemplate = useCallback(
    (
      source: WriterLinkedSourceFile,
      format: "parenthetical" | "narrative",
      targetCollection: "direct" | "indirect",
    ) => {
      if (openWorkspaceModal?.field !== "sources") return;

      const workspace = documentWorkspaces[openWorkspaceModal.documentId] ?? createEmptyWriterDocumentWorkspace();
      const savedTemplate = workspace.sourceCitationTemplates[source.id];
      const fallbackSource = parseEngineManualInput({
        id: source.id,
        type: "generic",
        title: source.name.replace(/\.[^.]+$/, "").trim() || source.name,
        authors: [{ familyName: source.name.replace(/\.[^.]+$/, "").trim(), role: "author" }],
        publicationDate: { year: new Date(source.addedAt).getFullYear().toString() },
      });
      const fallbackTemplate = buildEngineCitationTemplates(
        fallbackSource,
        "ABNT_NBR_6023_2018",
      );
      const citationText =
        format === "parenthetical"
          ? (savedTemplate?.parenthetical || fallbackTemplate.parenthetical)
          : (savedTemplate?.narrative || fallbackTemplate.narrative);

      updateDocumentWorkspace(openWorkspaceModal.documentId, (currentWorkspace) => ({
        ...currentWorkspace,
        directCitations:
          targetCollection === "direct"
            ? [...currentWorkspace.directCitations, citationText]
            : currentWorkspace.directCitations,
        indirectCitations:
          targetCollection === "indirect"
            ? [...currentWorkspace.indirectCitations, citationText]
            : currentWorkspace.indirectCitations,
      }));

      void navigator.clipboard?.writeText?.(citationText).catch(() => undefined);
      setOpenSourceCitationMenuId(null);
    },
    [documentWorkspaces, openWorkspaceModal, updateDocumentWorkspace],
  );

  const handleRegisterInternalCitation = useCallback(
    (source: WriterLinkedSourceFile, citationKind: "direct" | "indirect") => {
      if (openWorkspaceModal?.field !== "sources") return;

      const promptLabel =
        citationKind === "direct"
          ? "Registrar como citação direta em outro arquivo:"
          : "Registrar como citação indireta em outro arquivo:";
      const citationText = window.prompt(promptLabel, source.name)?.trim();
      if (!citationText) {
        setOpenSourceCitationMenuId(null);
        return;
      }

      updateDocumentWorkspace(openWorkspaceModal.documentId, (currentWorkspace) => ({
        ...currentWorkspace,
        directCitations:
          citationKind === "direct"
            ? [...currentWorkspace.directCitations, citationText]
            : currentWorkspace.directCitations,
        indirectCitations:
          citationKind === "indirect"
            ? [...currentWorkspace.indirectCitations, citationText]
            : currentWorkspace.indirectCitations,
      }));
      setOpenSourceCitationMenuId(null);
    },
    [openWorkspaceModal, updateDocumentWorkspace],
  );

  const handleShowInternalCitationSummary = useCallback(
    (source: WriterLinkedSourceFile) => {
      if (openWorkspaceModal?.field !== "sources") return;
      const workspace = documentWorkspaces[openWorkspaceModal.documentId] ?? createEmptyWriterDocumentWorkspace();
      const directCount = workspace.directCitations.length;
      const indirectCount = workspace.indirectCitations.length;
      window.alert(
        [
          `Arquivo: ${source.name}`,
          `Citações diretas registradas: ${directCount}`,
          `Citações indiretas registradas: ${indirectCount}`,
        ].join("\n"),
      );
      setOpenSourceCitationMenuId(null);
    },
    [documentWorkspaces, openWorkspaceModal],
  );

  const handleSourceDropAreaDragOver = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    if (openWorkspaceModal?.field !== "sources") return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsSourceDropActive(true);
  }, [openWorkspaceModal?.field]);

  const handleSourceDropAreaDragLeave = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    if (openWorkspaceModal?.field !== "sources") return;
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && event.currentTarget.contains(nextTarget)) return;
    setIsSourceDropActive(false);
  }, [openWorkspaceModal?.field]);

  const handleSourceDropAreaDrop = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    if (openWorkspaceModal?.field !== "sources") return;
    event.preventDefault();
    setIsSourceDropActive(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    appendSourceFilesToDocumentWorkspace(openWorkspaceModal.documentId, files);
  }, [appendSourceFilesToDocumentWorkspace, openWorkspaceModal]);

  const handleStandaloneReferenceDropAreaDragOver = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    if (openBibliographicReferenceModal?.isStandalone !== true) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsStandaloneReferenceDropActive(true);
  }, [openBibliographicReferenceModal?.isStandalone]);

  const handleStandaloneReferenceDropAreaDragLeave = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    if (openBibliographicReferenceModal?.isStandalone !== true) return;
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && event.currentTarget.contains(nextTarget)) return;
    setIsStandaloneReferenceDropActive(false);
  }, [openBibliographicReferenceModal?.isStandalone]);

  const handleStandaloneReferenceDropAreaDrop = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    if (openBibliographicReferenceModal?.isStandalone !== true) return;
    event.preventDefault();
    setIsStandaloneReferenceDropActive(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    handleAttachStandaloneReferenceFiles(files);
  }, [handleAttachStandaloneReferenceFiles, openBibliographicReferenceModal?.isStandalone]);

  useEffect(() => {
    if (openWorkspaceModal?.field !== "sources") {
      setOpenSourceActionsMenuId(null);
      setOpenSourceActionsMenuSource(null);
      setSourceActionsMenuPosition(null);
      setOpenSourceReferenceMenuId(null);
      setOpenSourceCitationMenuId(null);
      setOpenSourceOpenWithMenuId(null);
      setOpenSourceShareMenuId(null);
      setOpenSourceInfoMenuId(null);
      setIsSourceSortMenuOpen(false);
      setSourceSortMenuPosition(null);
      setIsSourceBulkSelectionEnabled(false);
      setSelectedSourceIds({});
      setIsTrashConfirmOpen(false);
      setFilePendingTrash(null);
      setBulkSourceIdsPendingTrash([]);
      setIsTrashConfirmSubmitting(false);
      setTrashConfirmError(null);
      setOpenBibliographicResponsibleActions(null);
      setOpenBibliographicReferenceModal(null);
      return;
    }
  }, [openWorkspaceModal?.field]);

  useEffect(() => {
    if (openBibliographicReferenceModal?.isStandalone !== true) {
      setIsStandaloneReferenceDropActive(false);
    }
  }, [openBibliographicReferenceModal?.isStandalone]);

  useEffect(() => {
    if (!isSourceBulkSelectionEnabled) return;
    const validIds = new Set(sortedWorkspaceSources.map((source) => source.id));
    setSelectedSourceIds((currentStore) => {
      const nextStore: Record<string, true> = {};
      let changed = false;
      for (const sourceId of Object.keys(currentStore)) {
        if (validIds.has(sourceId)) {
          nextStore[sourceId] = true;
        } else {
          changed = true;
        }
      }
      if (!changed && Object.keys(nextStore).length === Object.keys(currentStore).length) {
        return currentStore;
      }
      return nextStore;
    });
  }, [isSourceBulkSelectionEnabled, sortedWorkspaceSources]);

  useEffect(() => {
    if (
      openSourceActionsMenuId == null
      && openSourceReferenceMenuId == null
      && openSourceCitationMenuId == null
      && openSourceOpenWithMenuId == null
      && openSourceShareMenuId == null
      && openSourceInfoMenuId == null
      && !isSourceSortMenuOpen
    ) {
      setSourceActionsMenuPosition(null);
      return;
    }

    const handleGlobalPointerDown = (event: MouseEvent) => {
      const eventTarget = event.target;
      if (!(eventTarget instanceof Node)) return;

      if (sourceActionsMenuRef.current?.contains(eventTarget)) return;
      if (sourceReferenceMenuRef.current?.contains(eventTarget)) return;
      if (sourceCitationMenuRef.current?.contains(eventTarget)) return;
      if (sourceSortMenuRef.current?.contains(eventTarget)) return;
      if (sourceSortTriggerRef.current?.contains(eventTarget)) return;

      if (
        eventTarget instanceof Element
        && (
          eventTarget.closest("[data-knexwriter-source-actions-trigger='true']")
          || eventTarget.closest("[data-knexwriter-source-reference-trigger='true']")
          || eventTarget.closest("[data-knexwriter-source-citation-trigger='true']")
          || eventTarget.closest("[data-knexwriter-source-open-with-trigger='true']")
          || eventTarget.closest("[data-knexwriter-source-sort-trigger='true']")
        )
      ) {
        return;
      }

      setOpenSourceActionsMenuId(null);
      setOpenSourceActionsMenuSource(null);
      setSourceActionsMenuPosition(null);
      setOpenSourceReferenceMenuId(null);
      setOpenSourceCitationMenuId(null);
      setOpenSourceOpenWithMenuId(null);
      setOpenSourceShareMenuId(null);
      setOpenSourceInfoMenuId(null);
      setIsSourceSortMenuOpen(false);
      setSourceSortMenuPosition(null);
    };

    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenSourceActionsMenuId(null);
        setOpenSourceActionsMenuSource(null);
        setSourceActionsMenuPosition(null);
        setOpenSourceReferenceMenuId(null);
        setOpenSourceCitationMenuId(null);
        setOpenSourceOpenWithMenuId(null);
        setOpenSourceShareMenuId(null);
        setOpenSourceInfoMenuId(null);
        setIsSourceSortMenuOpen(false);
        setSourceSortMenuPosition(null);
      }
    };

    window.addEventListener("mousedown", handleGlobalPointerDown);
    window.addEventListener("keydown", handleGlobalKeyDown);

    return () => {
      window.removeEventListener("mousedown", handleGlobalPointerDown);
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [
    openSourceActionsMenuId,
    openSourceReferenceMenuId,
    openSourceCitationMenuId,
    openSourceOpenWithMenuId,
    openSourceShareMenuId,
    openSourceInfoMenuId,
    isSourceSortMenuOpen,
  ]);

  useEffect(() => {
    if (openSourceActionsMenuId == null) return;

    const syncMenuPosition = () => {
      const triggerElement = sourceActionsTriggerRefs.current[openSourceActionsMenuId];
      if (!triggerElement) return;
      setSourceActionsMenuPosition(resolveSourceActionsMenuPosition(triggerElement));
    };

    syncMenuPosition();

    const listViewport = document.querySelector(
      "[data-knexwriter-source-list-viewport='true']",
    ) as HTMLElement | null;

    window.addEventListener("resize", syncMenuPosition);
    window.addEventListener("scroll", syncMenuPosition, true);
    listViewport?.addEventListener("scroll", syncMenuPosition, { passive: true });

    return () => {
      window.removeEventListener("resize", syncMenuPosition);
      window.removeEventListener("scroll", syncMenuPosition, true);
      listViewport?.removeEventListener("scroll", syncMenuPosition);
    };
  }, [openSourceActionsMenuId, resolveSourceActionsMenuPosition]);

  useEffect(() => {
    if (!isSourceSortMenuOpen) return;

    const syncSortMenuPosition = () => {
      const triggerElement = sourceSortTriggerRef.current;
      if (!triggerElement) return;
      setSourceSortMenuPosition(resolveSourceSortMenuPosition(triggerElement));
    };

    syncSortMenuPosition();
    const listViewport = document.querySelector(
      "[data-knexwriter-source-list-viewport='true']",
    ) as HTMLElement | null;

    window.addEventListener("resize", syncSortMenuPosition);
    window.addEventListener("scroll", syncSortMenuPosition, true);
    listViewport?.addEventListener("scroll", syncSortMenuPosition, { passive: true });

    return () => {
      window.removeEventListener("resize", syncSortMenuPosition);
      window.removeEventListener("scroll", syncSortMenuPosition, true);
      listViewport?.removeEventListener("scroll", syncSortMenuPosition);
    };
  }, [isSourceSortMenuOpen, resolveSourceSortMenuPosition]);

  useEffect(() => {
    if (!isSourceSortMenuOpen || sourceSortMenuPosition != null) return;
    const fallbackTop = Math.max(96, Math.round(window.innerHeight * 0.22));
    const fallbackLeft = Math.max(96, Math.round(window.innerWidth * 0.56));
    setSourceSortMenuPosition({ top: fallbackTop, left: fallbackLeft });
  }, [isSourceSortMenuOpen, sourceSortMenuPosition]);

  useEffect(() => {
    if (!isTrashConfirmOpen) return;

    const handleTrashConfirmKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isTrashConfirmSubmitting) {
        setIsTrashConfirmOpen(false);
        setFilePendingTrash(null);
        setBulkSourceIdsPendingTrash([]);
        setTrashConfirmError(null);
      }
    };

    window.addEventListener("keydown", handleTrashConfirmKeyDown);
    return () => {
      window.removeEventListener("keydown", handleTrashConfirmKeyDown);
    };
  }, [isTrashConfirmOpen, isTrashConfirmSubmitting]);

  useEffect(() => {
    if (openWorkspaceModal?.field !== "sources") {
      setTrashConfirmWidthPx(null);
      return;
    }

    const syncTrashConfirmWidth = () => {
      const width = sourcesModalSurfaceRef.current?.getBoundingClientRect().width;
      if (typeof width === "number" && Number.isFinite(width) && width > 0) {
        setTrashConfirmWidthPx(Math.round(width));
      }
    };

    syncTrashConfirmWidth();
    window.addEventListener("resize", syncTrashConfirmWidth);

    return () => {
      window.removeEventListener("resize", syncTrashConfirmWidth);
    };
  }, [openWorkspaceModal?.field]);

  useEffect(() => {
    if (openBibliographicReferenceModal == null) return;

    const handleBibliographicEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenBibliographicReferenceModal(null);
      }
    };

    window.addEventListener("keydown", handleBibliographicEscape);
    return () => {
      window.removeEventListener("keydown", handleBibliographicEscape);
    };
  }, [openBibliographicReferenceModal]);

  useEffect(() => {
    if (openBibliographicResponsibleActions == null) return;

    const handleGlobalPointerDown = (event: MouseEvent) => {
      const eventTarget = event.target;
      if (!(eventTarget instanceof Node)) return;

      if (bibliographicResponsibleActionsMenuRef.current?.contains(eventTarget)) return;

      if (
        eventTarget instanceof Element
        && eventTarget.closest("[data-knexwriter-responsible-actions-trigger='true']")
      ) {
        return;
      }

      setOpenBibliographicResponsibleActions(null);
    };

    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenBibliographicResponsibleActions(null);
      }
    };

    window.addEventListener("mousedown", handleGlobalPointerDown);
    window.addEventListener("keydown", handleGlobalKeyDown);

    return () => {
      window.removeEventListener("mousedown", handleGlobalPointerDown);
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [openBibliographicResponsibleActions]);

  const classifySourceFile = useCallback((mimeType: string, fileName: string) => {
    const normalizedMime = mimeType.toLowerCase();
    const extension = fileName.includes(".")
      ? fileName.split(".").pop()?.toLowerCase() ?? ""
      : "";

    if (normalizedMime.includes("pdf") || extension === "pdf") return "PDF";
    if (
      normalizedMime.includes("word")
      || extension === "doc"
      || extension === "docx"
      || extension === "odt"
    ) {
      return "Documento";
    }
    if (
      normalizedMime.includes("sheet")
      || normalizedMime.includes("excel")
      || extension === "xls"
      || extension === "xlsx"
      || extension === "csv"
    ) {
      return "Planilha";
    }
    if (normalizedMime.includes("presentation") || extension === "ppt" || extension === "pptx") {
      return "Apresentação";
    }
    if (normalizedMime.startsWith("image/")) return "Imagem";
    if (normalizedMime.startsWith("video/")) return "Vídeo";
    if (normalizedMime.startsWith("audio/")) return "Áudio";
    return "Outros";
  }, []);

  const isKnexreadPreviewSource = openSourceActionsMenuSource != null
    ? isPdfFileCandidate(
      openSourceActionsMenuSource.mimeType,
      openSourceActionsMenuSource.name,
    )
    : false;

  return (
    <div
      data-knexwriter-start-storage-page="true"
      className="min-h-0 flex-1 overflow-hidden bg-[#8f1020]"
    >
      <div className="flex h-full min-h-0 p-4">
        <div className="flex h-full min-h-0 w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_20px_45px_rgba(0,0,0,0.18)]">
          <aside className="flex w-[210px] shrink-0 flex-col border-r border-zinc-200 bg-[#f8f9fc] px-2 py-4">
          <button
            type="button"
            className="flex items-center gap-2 rounded-md bg-[#e6e9f2] px-3 py-2 text-left text-sm font-semibold text-[#a83fbe]"
          >
            <FileText size={16} />
            <span>Página Inicial</span>
          </button>

          <button
            type="button"
            onClick={() => void actions.handleOpenFileFromWindows()}
            disabled={state.isImportingDocument}
            className="mt-2 flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-zinc-700 hover:bg-white disabled:opacity-60"
          >
            <FolderOpen size={16} />
            <span>{state.isImportingDocument ? "Importando..." : "Abrir arquivo"}</span>
          </button>

          <button
            type="button"
            onClick={actions.handleCreateBlankDocument}
            className="mt-1 flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-zinc-700 hover:bg-white"
          >
            <FilePlus2 size={16} />
            <span>Novo arquivo</span>
          </button>

          <button
            type="button"
            onClick={() => void actions.handleSaveLocalDraft()}
            className="mt-1 flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-zinc-700 hover:bg-white"
          >
            <Save size={16} />
            <span>Salvar rascunho</span>
          </button>

          <button
            type="button"
            onClick={() => void actions.handleExportStandardDocx()}
            className="mt-1 flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-zinc-700 hover:bg-white"
          >
            <Download size={16} />
            <span>Exportar DOCX</span>
          </button>

          <div className="mt-4 rounded-md border border-zinc-300 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Projeto ativo</p>
            <p className="mt-1 line-clamp-3 text-sm font-medium text-zinc-800">{activeProjectTitle}</p>
            <p className="mt-1 text-[11px] text-zinc-500">{projectKindLabel}</p>
          </div>

          <p className="mt-auto px-2 text-[11px] leading-relaxed text-zinc-500">
            Cada arquivo possui sua própria memória de fontes, referências, citações e notas.
          </p>
        </aside>

        <section className="min-w-0 flex-1 overflow-y-auto bg-white px-7 py-6">
          <input
            ref={sourceFilesInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleAttachSourceFiles}
          />

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-zinc-950">Ambiente de arquivos do KnexWriter</h2>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-zinc-600">
                O documento em branco permanece aberto para edição imediata. Ao abrir ou criar um arquivo, ele passa a ter uma área própria de memória para fontes, referências, citações diretas, citações indiretas, notas de rodapé e observações de trabalho.
              </p>
            </div>

            <div className="flex h-9 min-w-[260px] items-center rounded-md border border-zinc-300 bg-white px-3">
              <Search size={15} className="text-zinc-400" />
              <input
                value={state.backstageSearchQuery}
                onChange={(event) => actions.setBackstageSearchQuery(event.target.value)}
                placeholder="Pesquisar arquivo"
                className="ml-2 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
              />
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Arquivos do ambiente</p>
            </div>

            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
              <div className="overflow-x-auto">
                <div className="min-w-[1060px]">
                <div
                  className="grid gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500"
                  style={{
                    gridTemplateColumns:
                      "minmax(320px, 1.8fr) repeat(6, minmax(88px, 0.55fr))",
                  }}
                >
                  <span>Arquivo</span>
                  {memoryColumns.map((column) => (
                    <span key={`environment-header-${column.key}`} className="text-center">
                      {column.label}
                    </span>
                  ))}
                </div>

                <div className="max-h-[420px] space-y-1 overflow-y-auto pt-1 [scrollbar-gutter:stable]">
                  {filteredEnvironmentRows.map((row) => {
                    const isSelected = row.id === selectedEnvironmentDocument.id;
                    const sourceLabel = sourceLabelByDocument[row.source];

                    return (
                      <div
                        key={`environment-row-${row.id}`}
                        className={`grid items-center gap-2 rounded-md border px-4 py-1.5 ${
                          isSelected
                            ? "border-[#a83fbe]/35 bg-[#fffaff]"
                            : "border-transparent bg-transparent hover:border-zinc-200 hover:bg-white"
                        }`}
                        style={{
                          gridTemplateColumns:
                            "minmax(320px, 1.8fr) repeat(6, minmax(88px, 0.55fr))",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDocumentId(row.id);
                            if (row.recentDocument) {
                              void actions.handleOpenRecentDocument(row.recentDocument);
                            }
                          }}
                          className="flex min-w-0 items-center gap-3 rounded-md border border-transparent px-1 py-1 text-left hover:border-zinc-200 hover:bg-white"
                        >
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#f3e7f7] text-[#a83fbe]">
                            <FileText size={16} />
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-zinc-950">{row.title}</span>
                            <span className="mt-0.5 block truncate text-xs text-zinc-500">{row.subtitle}</span>
                          </span>

                          <span className="shrink-0 text-right">
                            <span className="block text-[11px] text-zinc-500">{sourceLabel}</span>
                            <span className="block text-[11px] text-zinc-500">{formatDateTime(row.updatedAt)}</span>
                          </span>
                        </button>

                        {memoryColumns.map((column) => {
                          const Icon = column.icon;
                          const isWorkspaceActive =
                            openWorkspaceModal?.documentId === row.id &&
                            openWorkspaceModal.field === column.key;

                          return (
                            <div
                              key={`environment-row-${row.id}-${column.key}`}
                              className="relative flex justify-center"
                            >
                              <button
                                type="button"
                                title={column.menuLabel}
                                aria-label={column.menuLabel}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  if (column.key !== "sources") return;
                                  setSelectedDocumentId(row.id);
                                  setSourceWorkspaceFilter("documents");
                                  setSourceWorkspaceView("list");
                                  setIsSourceDropActive(false);
                                  setOpenWorkspaceModal({
                                    documentId: row.id,
                                    field: column.key,
                                  });
                                }}
                                className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition ${
                                  isWorkspaceActive
                                    ? "border-[#7b1e3f]/45 bg-[#f7e9ee] text-[#7b1e3f]"
                                    : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-100"
                                }`}
                              >
                                <Icon size={15} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}

                  {filteredEnvironmentRows.length === 0 ? (
                    <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-500">
                      Nenhum arquivo encontrado com esse filtro.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <button
              type="button"
              onClick={() => void actions.handleLinkSourceFilesFromWindows()}
              className="rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-sm hover:border-[#a83fbe]/50 hover:bg-[#fffaff]"
            >
              <FileUp size={18} className="text-[#a83fbe]" />
              <p className="mt-3 text-sm font-semibold text-zinc-950">Adicionar fontes externas</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">Importe arquivos de apoio que poderão alimentar a memória bibliográfica deste documento.</p>
            </button>

            <button
              type="button"
              onClick={actions.toggleOrganizationPanel}
              className="rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-sm hover:border-[#a83fbe]/50 hover:bg-[#fffaff]"
            >
              <Share2 size={18} className="text-[#a83fbe]" />
              <p className="mt-3 text-sm font-semibold text-zinc-950">Abrir organização</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">Acesse o painel completo de fontes, referências, auditoria e vínculos do projeto.</p>
            </button>

            <button
              type="button"
              onClick={() => void actions.handleOpenFileFromWindows()}
              disabled={state.isImportingDocument}
              className="rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-sm hover:border-[#a83fbe]/50 hover:bg-[#fffaff] disabled:opacity-60"
            >
              <FolderOpen size={18} className="text-[#a83fbe]" />
              <p className="mt-3 text-sm font-semibold text-zinc-950">Abrir arquivo existente</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">Abra um documento já em trabalho e vincule a ele sua própria estrutura de memória.</p>
            </button>
          </div>
        </section>
        </div>
      </div>

      {openWorkspaceModal?.field === "sources" && openWorkspaceDocument != null ? (
        <div
          className={`fixed inset-0 z-[140] flex items-center justify-center bg-black/55 p-6 ${
            openBibliographicReferenceModal != null ? "pointer-events-none opacity-0" : ""
          }`}
        >
          <button
            type="button"
            aria-label="Fechar subpasta do arquivo"
            onClick={() => {
              setIsSourceDropActive(false);
              setSourceFocusedId(null);
              setOpenWorkspaceModal(null);
            }}
            className="absolute inset-0"
          />

          <div
            data-knexwriter-sources-modal-surface="true"
            ref={sourcesModalSurfaceRef}
            className="relative flex h-[820px] w-[1520px] max-h-[90vh] max-w-[96vw] flex-col overflow-hidden rounded-[26px] shadow-2xl"
            style={{ backgroundColor: "#4a69bd" }}
          >
            <div
              className="flex flex-wrap items-center justify-between gap-4 border-b px-6 py-4"
              style={{
                backgroundColor: "#4a69bd",
                borderColor: "rgba(255, 255, 255, 0.42)",
              }}
            >
              <div className="min-w-[240px]">
                <h3 className="text-[32px] font-semibold leading-none text-white">Fontes do Arquivo</h3>
                <p className="mt-1 text-sm text-white">{openWorkspaceDocument.title}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSourceWorkspaceFilter("documents")}
                  className={`border-b-2 px-1 pb-2 text-[30px] font-semibold transition ${
                    sourceWorkspaceFilter === "documents"
                      ? "text-white"
                      : "border-transparent text-white/85 hover:text-white"
                  }`}
                  style={sourceWorkspaceFilter === "documents" ? { borderColor: "rgb(255, 255, 255)" } : undefined}
                >
                  Documentos
                </button>
                <button
                  type="button"
                  onClick={() => setSourceWorkspaceFilter("links")}
                  className={`border-b-2 px-1 pb-2 text-[30px] font-semibold transition ${
                    sourceWorkspaceFilter === "links"
                      ? "text-white"
                      : "border-transparent text-white/85 hover:text-white"
                  }`}
                  style={sourceWorkspaceFilter === "links" ? { borderColor: "rgb(255, 255, 255)" } : undefined}
                >
                  Links
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/60 text-white hover:bg-white/20"
                >
                  <Search size={16} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSourceWorkspaceView((current) =>
                      current === "grid" ? "list" : "grid",
                    )
                  }
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/60 text-white hover:bg-white/20"
                >
                  {sourceWorkspaceView === "grid" ? <List size={16} /> : <LayoutGrid size={16} />}
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/60 text-white hover:bg-white/20"
                >
                  <SlidersHorizontal size={16} />
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/60 text-white hover:bg-white/20"
                >
                  <Check size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSourceDropActive(false);
                    setSourceFocusedId(null);
                    setOpenWorkspaceModal(null);
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/60 text-white hover:bg-white/20"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden p-3" style={{ backgroundColor: "#4a69bd" }}>
              <div className="flex h-full min-h-0 flex-col gap-5">
                <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
	                  <div className="flex flex-wrap items-center justify-between gap-3">
	                    <p className="text-sm text-zinc-600">
	                      Adicione documentos-base deste arquivo ou alterne para Links.
	                    </p>
	                    <div className="flex flex-wrap items-center gap-2">
	                      <button
	                        type="button"
	                        onClick={handleInsertStandaloneBibliographicReference}
	                        className="inline-flex items-center gap-2 rounded-md border border-[#2e6f62]/40 bg-[#e7f6f2] px-3 py-2 text-sm font-medium text-[#135247] hover:bg-[#d7eee8]"
	                      >
	                        <FilePlus2 size={16} />
	                        <span>Adicionar referência avulsa</span>
	                      </button>
	                      <button
	                        type="button"
	                        onClick={handleOpenSourcePicker}
	                        className="inline-flex items-center gap-2 rounded-md border border-[#a83fbe]/40 bg-[#f8ecfc] px-3 py-2 text-sm font-medium text-[#7b1e3f] hover:bg-[#f3ddfa]"
	                      >
	                        <FileUp size={16} />
	                        <span>Adicionar arquivos de fonte</span>
	                      </button>
	                    </div>
	                  </div>
	                </div>

                {sourceWorkspaceFilter === "documents" ? (
                  <div
                    onDragOver={handleSourceDropAreaDragOver}
                    onDragLeave={handleSourceDropAreaDragLeave}
                    onDrop={handleSourceDropAreaDrop}
                    className={`min-h-0 flex flex-1 flex-col rounded-2xl p-4 transition ${
                      isSourceDropActive
                        ? "border border-[#4169e1] bg-[#ecf2ff]"
                        : "bg-white"
                    }`}
                  >
                    {openWorkspaceData.sources.length > 0 ? (
                      sourceWorkspaceView === "grid" ? (
                        <div className="min-h-0 flex-1 overflow-y-auto -mr-4 pr-0">
                          <div className="grid gap-4 px-2 py-2 pr-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {sortedWorkspaceSources.map((source) => (
                              <LinkedSourceGridCard
                                key={`linked-source-${source.id}`}
                                source={source}
                                documentId={openWorkspaceModal.documentId}
                                isSelected={sourceFocusedId === source.id}
                                onSelect={() => setSourceFocusedId(source.id)}
                                resolveSourceFileForPreview={resolveLinkedSourceFileForPreview}
                                onActionsTriggerMount={(node) => {
                                  sourceActionsTriggerRefs.current[source.id] = node;
                                }}
                                onOpenActionsMenu={(event) => {
                                  event.stopPropagation();
                                  setSourceFocusedId(source.id);
                                  handleOpenSourceActionsMenuFromTrigger(
                                    source,
                                    event.currentTarget,
                                  );
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="min-h-0 flex-1 overflow-visible">
                          <div className="flex h-full min-h-0 w-full flex-col overflow-visible bg-white">
                            <div
                              className="grid items-center gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-600"
                              style={{ gridTemplateColumns: "minmax(0, 1fr) 210px 210px 96px 140px 140px" }}
                            >
                              <div className="flex min-w-0 items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={isSourceBulkSelectionEnabled}
                                    onChange={handleToggleSourceBulkSelection}
                                    className="h-4 w-4 shrink-0 accent-[#a83fbe]"
                                  />
                                  <span className="truncate">Nome do arquivo</span>
                                </div>
                                {isSourceBulkSelectionEnabled ? (
                                  <button
                                    type="button"
                                    onClick={handleRemoveAllSelectedSources}
                                    disabled={selectedSourceCount === 0}
                                    className="shrink-0 rounded-md border border-rose-300 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    Excluir todos
                                  </button>
                                ) : null}
                              </div>
                              <span className="w-full justify-self-center text-center">Tamanho do arquivo</span>
                              <span className="w-full justify-self-center text-center">Tipo de documento</span>
                              <span className="w-full justify-self-center text-center">Ref.</span>
                              <span className="w-full justify-self-center text-center leading-tight">Citação (nome/data)</span>
                              <div className="relative w-full justify-self-center text-center">
                                <div className="group relative inline-flex">
                                  <button
                                    ref={sourceSortTriggerRef}
                                    type="button"
                                    data-knexwriter-source-sort-trigger="true"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setOpenSourceActionsMenuId(null);
                                      setOpenSourceActionsMenuSource(null);
                                      setOpenSourceReferenceMenuId(null);
                                      setOpenSourceCitationMenuId(null);
                                      setOpenSourceOpenWithMenuId(null);
                                      setOpenSourceShareMenuId(null);
                                      setOpenSourceInfoMenuId(null);
                                      setIsSourceSortMenuOpen((currentState) => !currentState);
                                    }}
                                    className={`relative z-10 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[14px] font-medium normal-case tracking-normal transition-colors ${
                                      isSourceSortMenuOpen
                                        ? "bg-[#b8c6dc] text-zinc-900 ring-1 ring-[#8ca0bf]"
                                        : "bg-[#d2dae6] text-zinc-700 hover:bg-[#c8d1de]"
                                    }`}
                                  >
                                    <AlignLeft size={14} />
                                    <span>Classificado</span>
                                  </button>
                                  <div
                                    style={{ bottom: "calc(100% + 14px)" }}
                                    className={`pointer-events-none absolute left-1/2 z-[2147482700] -translate-x-1/2 whitespace-nowrap rounded bg-black px-2.5 py-1 text-[11px] font-medium normal-case tracking-normal text-white shadow-lg transition-opacity duration-150 group-active:opacity-0 ${
                                      isSourceSortMenuOpen
                                        ? "opacity-0"
                                        : "opacity-0 delay-500 group-hover:opacity-100 group-hover:delay-1000"
                                    }`}
                                  >
                                    Ver opções de ordenação
                                  </div>
                                </div>

                              </div>
                            </div>
                            <div
                              data-knexwriter-source-list-viewport="true"
                              className="min-h-0 flex-1 overflow-y-auto -mr-4 pr-0"
                            >
                              {sortedWorkspaceSources.map((source) => {
                                const sourceClassification = classifySourceFile(source.mimeType, source.name);
                                const isPdfSource = sourceClassification === "PDF";
                                const isSourceRowMenuOpen =
                                  openSourceActionsMenuId === source.id
                                  || openSourceReferenceMenuId === source.id
                                  || openSourceCitationMenuId === source.id
                                  || openSourceOpenWithMenuId === source.id
                                  || openSourceShareMenuId === source.id
                                  || openSourceInfoMenuId === source.id;
                                const sourceCitationTemplate =
                                  openWorkspaceData.sourceCitationTemplates[source.id]
                                  ?? buildCitationTemplates(
                                    [{
                                      ...EMPTY_BIBLIOGRAPHIC_AUTHOR,
                                      lastName: source.name.replace(/\.[^.]+$/, "").trim(),
                                    }],
                                    new Date(source.addedAt).getFullYear().toString(),
                                    "ABNT",
                                  );

                                return (
                                  <div
                                    key={`linked-source-list-${source.id}`}
                                    onClick={() => setSourceFocusedId(source.id)}
                                    className={`relative grid items-center gap-3 border-b border-zinc-200 px-4 py-3 text-sm transition-colors last:border-b-0 ${
                                      sourceFocusedId === source.id
                                        ? "bg-[#74b4e4]"
                                        : "hover:bg-[#d0d6df]"
                                    } ${
                                      isSourceRowMenuOpen ? "z-[2147482400]" : "z-0"
                                    }`}
                                    style={{ gridTemplateColumns: "minmax(0, 1fr) 210px 210px 96px 140px 140px" }}
                                  >
                                    <div className="flex min-w-0 items-center gap-2">
                                      {isSourceBulkSelectionEnabled ? (
                                        <input
                                          type="checkbox"
                                          checked={Boolean(selectedSourceIds[source.id])}
                                          onChange={() => handleToggleSourceSelected(source.id)}
                                          className="h-4 w-4 shrink-0 accent-[#a83fbe]"
                                        />
                                      ) : null}
                                      <span
                                        className={`inline-flex h-6 min-w-6 items-center justify-center rounded text-[9px] font-bold uppercase ${
                                          isPdfSource
                                            ? "bg-[#fde6e8] text-[#7b1e3f]"
                                            : "bg-zinc-100 text-zinc-600"
                                        }`}
                                      >
                                        {isPdfSource ? "PDF" : <FileText size={12} />}
                                      </span>
                                      <div className="group relative min-w-0 flex-1">
                                        <span className="block min-w-0 truncate font-medium text-zinc-900">
                                          {source.name}
                                        </span>
                                        <div className="pointer-events-none absolute bottom-[calc(100%+8px)] left-0 z-[2147482500] max-w-[620px] rounded bg-black px-2.5 py-1 text-[11px] font-medium normal-case tracking-normal text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                                          {source.name}
                                        </div>
                                      </div>
                                    </div>
                                    <span className="w-full justify-self-center text-center text-zinc-500">{formatFileSize(source.size)}</span>
                                    <span className="w-full justify-self-center truncate text-center text-zinc-500">{sourceClassification}</span>
                                    <div className="relative flex justify-center justify-self-center">
                                      <button
                                        type="button"
                                        title="Referência bibliográfica deste arquivo"
                                        aria-label="Referência bibliográfica deste arquivo"
                                        data-knexwriter-source-reference-trigger="true"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setIsSourceSortMenuOpen(false);
                                          setOpenSourceActionsMenuId(null);
                                          setOpenSourceActionsMenuSource(null);
                                          setOpenSourceCitationMenuId(null);
                                          setOpenSourceReferenceMenuId(null);
                                          setOpenSourceOpenWithMenuId(null);
                                          handleInsertBibliographicReference(source);
                                        }}
                                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
                                      >
                                        <List size={14} />
                                      </button>
                                    </div>

                                    <div className="relative flex justify-center justify-self-center">
                                      <button
                                        type="button"
                                        title="Como este texto é citado em outros arquivos"
                                        aria-label="Como este texto é citado em outros arquivos"
                                        data-knexwriter-source-citation-trigger="true"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setIsSourceSortMenuOpen(false);
                                          setOpenSourceActionsMenuId(null);
                                          setOpenSourceActionsMenuSource(null);
                                          setOpenSourceReferenceMenuId(null);
                                          setOpenSourceOpenWithMenuId(null);
                                          setOpenSourceCitationMenuId((currentMenuId) =>
                                            currentMenuId === source.id ? null : source.id,
                                          );
                                        }}
                                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
                                      >
                                        <ArrowDownRight size={14} />
                                      </button>

                                      {openSourceCitationMenuId === source.id ? (
                                        <div
                                          ref={sourceCitationMenuRef}
                                          className="absolute right-0 top-[calc(100%+6px)] z-[2147482500] w-[320px] overflow-hidden rounded-lg border border-zinc-300 bg-white shadow-2xl"
                                        >
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleApplySourceCitationTemplate(source, "parenthetical", "indirect")}
                                            className="flex w-full items-center gap-2 border-b border-zinc-200 px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-100"
                                          >
                                            <ClipboardCopy size={14} />
                                            <span className="truncate">
                                              Usar citação parentética: {renderCitationWithItalicEtAl(sourceCitationTemplate.parenthetical)}
                                            </span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleApplySourceCitationTemplate(source, "narrative", "direct")}
                                            className="flex w-full items-center gap-2 border-b border-zinc-200 px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-100"
                                          >
                                            <ArrowDownRight size={14} />
                                            <span className="truncate">
                                              Usar citação narrativa: {renderCitationWithItalicEtAl(sourceCitationTemplate.narrative)}
                                            </span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleRegisterInternalCitation(source, "direct")}
                                            className="flex w-full items-center gap-2 border-b border-zinc-200 px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-100"
                                          >
                                            <ClipboardCopy size={14} />
                                            <span>Registrar citação manual (direta)</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleRegisterInternalCitation(source, "indirect")}
                                            className="flex w-full items-center gap-2 border-b border-zinc-200 px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-100"
                                          >
                                            <ArrowDownRight size={14} />
                                            <span>Registrar citação manual (indireta)</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleShowInternalCitationSummary(source)}
                                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-100"
                                          >
                                            <Info size={14} />
                                            <span>Ver resumo das citações</span>
                                          </button>
                                        </div>
                                      ) : null}
                                    </div>

                                    <div className="relative flex justify-center justify-self-center">
                                      <button
                                        ref={(node) => {
                                          sourceActionsTriggerRefs.current[source.id] = node;
                                        }}
                                        type="button"
                                        title="Mais opções"
                                        aria-label="Mais opções"
                                        data-knexwriter-source-actions-trigger="true"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setOpenSourceReferenceMenuId(null);
                                          setOpenSourceCitationMenuId(null);
                                          setOpenSourceShareMenuId(null);
                                          setOpenSourceInfoMenuId(null);
                                          handleOpenSourceActionsMenuFromTrigger(
                                            source,
                                            event.currentTarget as HTMLButtonElement,
                                          );
                                        }}
                                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-zinc-300 text-zinc-600 hover:bg-zinc-100"
                                      >
                                        <MoreVertical size={14} />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl bg-white p-10 text-center">
                        <p className="text-sm font-medium text-zinc-700">Arraste arquivos para soltar aqui.</p>
                        <p className="mt-1 text-xs text-zinc-500">Ou use o botão &quot;Adicionar arquivos de fonte&quot;.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-zinc-300 bg-white p-10 text-center">
                    <p className="text-sm font-medium text-zinc-700">Área de Links desta fonte.</p>
                    <p className="mt-1 text-xs text-zinc-500">Aqui ficarão os links vinculados ao arquivo.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {openWorkspaceModal?.field === "sources"
        && isSourceSortMenuOpen
        && sourceSortMenuPosition != null
        && typeof document !== "undefined"
        ? createPortal(
          <div
            ref={sourceSortMenuRef}
            className="fixed z-[2147483646]"
            style={{
              zIndex: 2147483646,
              top: `${sourceSortMenuPosition.top}px`,
              left: `${sourceSortMenuPosition.left}px`,
            }}
          >
            <div className="w-[320px] overflow-hidden rounded-lg border border-zinc-300 bg-white text-left text-[14px] font-medium normal-case tracking-normal text-zinc-700 shadow-2xl">
              <div className="border-b border-zinc-200 px-4 py-3 text-[15px] text-zinc-600">
                Ordenar por
              </div>
              <button
                type="button"
                onClick={() => setSourceSortField("name")}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-100 ${
                  sourceSortField === "name" ? "bg-zinc-200" : ""
                }`}
              >
                <Check size={16} className={sourceSortField === "name" ? "opacity-100" : "opacity-0"} />
                <span>Nome</span>
              </button>
              <button
                type="button"
                onClick={() => setSourceSortField("modifiedAt")}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-100 ${
                  sourceSortField === "modifiedAt" ? "bg-zinc-200" : ""
                }`}
              >
                <Check size={16} className={sourceSortField === "modifiedAt" ? "opacity-100" : "opacity-0"} />
                <span>Data da modificação</span>
              </button>
              <button
                type="button"
                onClick={() => setSourceSortField("modifiedByMeAt")}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-100 ${
                  sourceSortField === "modifiedByMeAt" ? "bg-zinc-200" : ""
                }`}
              >
                <Check size={16} className={sourceSortField === "modifiedByMeAt" ? "opacity-100" : "opacity-0"} />
                <span>Data da modificação feita por mim</span>
              </button>
              <button
                type="button"
                onClick={() => setSourceSortField("openedAt")}
                className={`flex w-full items-center gap-3 border-b border-zinc-200 px-4 py-2.5 text-left hover:bg-zinc-100 ${
                  sourceSortField === "openedAt" ? "bg-zinc-200" : ""
                }`}
              >
                <Check size={16} className={sourceSortField === "openedAt" ? "opacity-100" : "opacity-0"} />
                <span>Data em que eu abri</span>
              </button>

              <div className="border-b border-zinc-200 px-4 py-3 text-[15px] text-zinc-600">
                Direção de classif.
              </div>
              <button
                type="button"
                onClick={() => setSourceSortDirection("asc")}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-100 ${
                  sourceSortDirection === "asc" ? "bg-zinc-200" : ""
                }`}
              >
                <Check size={16} className={sourceSortDirection === "asc" ? "opacity-100" : "opacity-0"} />
                <span>A a Z</span>
              </button>
              <button
                type="button"
                onClick={() => setSourceSortDirection("desc")}
                className={`flex w-full items-center gap-3 border-b border-zinc-200 px-4 py-2.5 text-left hover:bg-zinc-100 ${
                  sourceSortDirection === "desc" ? "bg-zinc-200" : ""
                }`}
              >
                <Check size={16} className={sourceSortDirection === "desc" ? "opacity-100" : "opacity-0"} />
                <span>Z a A</span>
              </button>

              <div className="px-4 py-3 text-[15px] text-zinc-600">
                Pastas
              </div>
              <button
                type="button"
                onClick={() => setSourceSortFoldersMode("foldersFirst")}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-100 ${
                  sourceSortFoldersMode === "foldersFirst" ? "bg-zinc-200" : ""
                }`}
              >
                <Check size={16} className={sourceSortFoldersMode === "foldersFirst" ? "opacity-100" : "opacity-0"} />
                <span>Acima</span>
              </button>
              <button
                type="button"
                onClick={() => setSourceSortFoldersMode("mixed")}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-100 ${
                  sourceSortFoldersMode === "mixed" ? "bg-zinc-200" : ""
                }`}
              >
                <Check size={16} className={sourceSortFoldersMode === "mixed" ? "opacity-100" : "opacity-0"} />
                <span>Misturado com arquivos</span>
              </button>
            </div>
          </div>,
          document.body,
        )
        : null}

      {openWorkspaceModal?.field === "sources"
        && openSourceActionsMenuSource != null
        && openSourceActionsMenuId != null
        && typeof document !== "undefined"
        ? createPortal(
          <div
            ref={sourceActionsMenuRef}
            className="fixed isolate z-[2147483647]"
            style={{
              zIndex: 2147483647,
              top: `${(sourceActionsMenuPosition?.top ?? 120)}px`,
              left: `${(sourceActionsMenuPosition?.left ?? 120)}px`,
            }}
          >
            <div className="w-[420px] overflow-visible rounded-lg border border-zinc-300 bg-white shadow-2xl">
              <div className="relative border-b border-zinc-200">
                <button
                  type="button"
                  data-knexwriter-source-open-with-trigger="true"
                  onClick={(event) => {
                    const placement = resolveSourceSubmenuPlacement(
                      event.currentTarget,
                      360,
                    );
                    setSourceOpenWithSubmenuSide(placement.side);
                    setSourceOpenWithSubmenuOffsetPx(placement.offsetPx);
                    setOpenSourceShareMenuId((currentMenuId) =>
                      currentMenuId === openSourceActionsMenuSource.id ? null : currentMenuId,
                    );
                    setOpenSourceInfoMenuId((currentMenuId) =>
                      currentMenuId === openSourceActionsMenuSource.id ? null : currentMenuId,
                    );
                    setOpenSourceOpenWithMenuId((currentMenuId) =>
                      currentMenuId === openSourceActionsMenuSource.id
                        ? null
                        : openSourceActionsMenuSource.id,
                    );
                  }}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm text-zinc-800 hover:bg-zinc-100 ${
                    openSourceOpenWithMenuId === openSourceActionsMenuSource.id ? "bg-zinc-100" : ""
                  }`}
                >
                  <span className="inline-flex items-center gap-3">
                    <Move size={18} className="shrink-0" />
                    <span className="whitespace-nowrap">Abrir com</span>
                  </span>
                  <ChevronRight size={16} className="text-zinc-500" />
                </button>

                {openSourceOpenWithMenuId === openSourceActionsMenuSource.id ? (
                  <div
                    className="absolute top-0 z-[2147483647] w-[360px] overflow-hidden rounded-lg border border-zinc-300 bg-white shadow-2xl"
                    style={
                      sourceOpenWithSubmenuSide === "left"
                        ? {
                          right: `calc(100% + 8px - ${sourceOpenWithSubmenuOffsetPx}px)`,
                        }
                        : {
                          left: `calc(100% + 8px - ${sourceOpenWithSubmenuOffsetPx}px)`,
                        }
                    }
                  >
                    <button
                      type="button"
                      onClick={() => {
                        void handleOpenLinkedSourceWith(openSourceActionsMenuSource);
                      }}
                      className="flex w-full items-center justify-between gap-3 border-b border-zinc-200 px-4 py-2.5 text-left text-sm text-zinc-800 hover:bg-zinc-100"
                    >
                      <span className="inline-flex items-center gap-3">
                        <Eye size={18} className="shrink-0" />
                        <span className="whitespace-nowrap">
                          {isKnexreadPreviewSource
                            ? "Visualizar com Knexread"
                            : "Visualizacao"}
                        </span>
                      </span>
                      <span className="whitespace-nowrap text-[12px] text-zinc-500">
                        Ctrl+Alt+P
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleOpenLinkedSourceInNewTab(openSourceActionsMenuSource);
                      }}
                      className="flex w-full items-center gap-3 border-b border-zinc-200 px-4 py-2.5 text-left text-sm text-zinc-800 hover:bg-zinc-100"
                    >
                      <Move size={18} className="shrink-0" />
                      <span className="whitespace-nowrap">Abrir em uma nova guia</span>
                    </button>

                    <div className="h-px bg-zinc-200" />

                    <button
                      type="button"
                      onClick={() => handleOpenWithExternalApp("Documentos Google")}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-800 hover:bg-zinc-100"
                    >
                      <FileText size={18} className="shrink-0" />
                      <span className="whitespace-nowrap">Documentos Google</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenWithExternalApp("CloudConvert")}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-800 hover:bg-zinc-100"
                    >
                      <Globe size={18} className="shrink-0" />
                      <span className="whitespace-nowrap">CloudConvert</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleCopyLinkedSourceLink(openSourceActionsMenuSource);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-800 hover:bg-zinc-100"
                    >
                      <ClipboardCopy size={18} className="shrink-0" />
                      <span className="whitespace-nowrap">Copy, URL to Google Drive</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleOpenWithExternalApp("Online Notepad for Google Drive")}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-800 hover:bg-zinc-100"
                    >
                      <FileText size={18} className="shrink-0" />
                      <span className="whitespace-nowrap">Online Notepad for Google Drive</span>
                    </button>

                    <div className="h-px bg-zinc-200" />

                    <button
                      type="button"
                      onClick={() => handleOpenWithExternalApp("Conectar mais apps")}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-800 hover:bg-zinc-100"
                    >
                      <Plus size={18} className="shrink-0" />
                      <span className="whitespace-nowrap">Conectar mais apps</span>
                    </button>
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => {
                  void handleDownloadLinkedSource(openSourceActionsMenuSource);
                }}
                className="flex w-full items-center justify-between gap-3 border-b border-zinc-200 px-4 py-2.5 text-left text-sm text-zinc-800 hover:bg-zinc-100"
              >
                <span className="inline-flex items-center gap-3">
                  <Download size={18} className="shrink-0" />
                  <span className="whitespace-nowrap">Baixar</span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleRenameLinkedSource(openSourceActionsMenuSource)}
                className="flex w-full items-center justify-between gap-3 border-b border-zinc-200 px-4 py-2.5 text-left text-sm text-zinc-800 hover:bg-zinc-100"
              >
                <span className="inline-flex items-center gap-3">
                  <Pencil size={18} className="shrink-0" />
                  <span className="whitespace-nowrap">Renomear</span>
                </span>
                <span className="text-[12px] text-zinc-500">Ctrl+Alt+E</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  void handleDuplicateLinkedSource(openSourceActionsMenuSource);
                }}
                className="flex w-full items-center justify-between gap-3 border-b border-zinc-200 px-4 py-2.5 text-left text-sm text-zinc-800 hover:bg-zinc-100"
              >
                <span className="inline-flex items-center gap-3">
                  <ClipboardCopy size={18} className="shrink-0" />
                  <span className="whitespace-nowrap">Fazer uma cópia</span>
                </span>
                <span className="text-[12px] text-zinc-500">Ctrl+C Ctrl+V</span>
              </button>

              <div className="relative border-b border-zinc-200">
                <button
                  type="button"
                  onClick={(event) => {
                    const placement = resolveSourceSubmenuPlacement(
                      event.currentTarget,
                      360,
                    );
                    setSourceShareSubmenuSide(placement.side);
                    setSourceShareSubmenuOffsetPx(placement.offsetPx);
                    setOpenSourceInfoMenuId((currentMenuId) =>
                      currentMenuId === openSourceActionsMenuSource.id ? null : currentMenuId,
                    );
                    setOpenSourceOpenWithMenuId((currentMenuId) =>
                      currentMenuId === openSourceActionsMenuSource.id ? null : currentMenuId,
                    );
                    setOpenSourceShareMenuId((currentMenuId) =>
                      currentMenuId === openSourceActionsMenuSource.id ? null : openSourceActionsMenuSource.id,
                    );
                  }}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm text-zinc-800 hover:bg-zinc-100 ${
                    openSourceShareMenuId === openSourceActionsMenuSource.id ? "bg-zinc-100" : ""
                  }`}
                >
                  <span className="inline-flex items-center gap-3">
                    <Share2 size={18} className="shrink-0" />
                    <span className="whitespace-nowrap">Compartilhar</span>
                  </span>
                  <ChevronRight size={16} className="text-zinc-500" />
                </button>

                {openSourceShareMenuId === openSourceActionsMenuSource.id ? (
                  <div
                    className="absolute top-0 z-[2147483647] w-[360px] overflow-hidden rounded-lg border border-zinc-300 bg-white shadow-2xl"
                    style={
                      sourceShareSubmenuSide === "left"
                        ? {
                          right: `calc(100% + 8px - ${sourceShareSubmenuOffsetPx}px)`,
                        }
                        : {
                          left: `calc(100% + 8px - ${sourceShareSubmenuOffsetPx}px)`,
                        }
                    }
                  >
                    <button
                      type="button"
                      onClick={() => {
                        void handleShareLinkedSource(openSourceActionsMenuSource);
                      }}
                      className="flex w-full items-center justify-between gap-3 border-b border-zinc-200 px-4 py-2.5 text-left text-sm text-zinc-800 hover:bg-zinc-100"
                    >
                      <span className="inline-flex items-center gap-3">
                        <Share2 size={18} className="shrink-0" />
                        <span className="whitespace-nowrap">Compartilhar</span>
                      </span>
                      <span className="whitespace-nowrap text-[12px] text-zinc-500">
                        Ctrl+Alt+A
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleCopyLinkedSourceLink(openSourceActionsMenuSource);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-800 hover:bg-zinc-100"
                    >
                      <ClipboardCopy size={18} className="shrink-0" />
                      <span className="whitespace-nowrap">Copiar link</span>
                    </button>
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={handleOrganizeLinkedSources}
                className="flex w-full items-center justify-between gap-3 border-b border-zinc-200 px-4 py-2.5 text-left text-sm text-zinc-800 hover:bg-zinc-100"
              >
                <span className="inline-flex items-center gap-3">
                  <FolderOpen size={18} className="shrink-0" />
                  <span className="whitespace-nowrap">Organizar</span>
                </span>
                <ChevronRight size={16} className="text-zinc-500" />
              </button>

              <div className="relative border-b border-zinc-200">
                <button
                  type="button"
                  onClick={(event) => {
                    const placement = resolveSourceSubmenuPlacement(
                      event.currentTarget,
                      420,
                    );
                    setSourceInfoSubmenuSide(placement.side);
                    setSourceInfoSubmenuOffsetPx(placement.offsetPx);
                    setOpenSourceOpenWithMenuId((currentMenuId) =>
                      currentMenuId === openSourceActionsMenuSource.id ? null : currentMenuId,
                    );
                    setOpenSourceShareMenuId((currentMenuId) =>
                      currentMenuId === openSourceActionsMenuSource.id ? null : currentMenuId,
                    );
                    setOpenSourceInfoMenuId((currentMenuId) =>
                      currentMenuId === openSourceActionsMenuSource.id ? null : openSourceActionsMenuSource.id,
                    );
                  }}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm text-zinc-800 hover:bg-zinc-100 ${
                    openSourceInfoMenuId === openSourceActionsMenuSource.id ? "bg-zinc-100" : ""
                  }`}
                >
                  <span className="inline-flex items-center gap-3">
                    <Info size={18} className="shrink-0" />
                    <span className="whitespace-nowrap">Informações do arquivo</span>
                  </span>
                  <ChevronRight size={16} className="text-zinc-500" />
                </button>

                {openSourceInfoMenuId === openSourceActionsMenuSource.id ? (
                  <div
                    className="absolute top-0 z-[2147483647] w-[420px] overflow-hidden rounded-lg border border-zinc-300 bg-white shadow-2xl"
                    style={
                      sourceInfoSubmenuSide === "left"
                        ? {
                          right: `calc(100% + 8px - ${sourceInfoSubmenuOffsetPx}px)`,
                        }
                        : {
                          left: `calc(100% + 8px - ${sourceInfoSubmenuOffsetPx}px)`,
                        }
                    }
                  >
                    <button
                      type="button"
                      onClick={() => handleShowLinkedSourceInfo(openSourceActionsMenuSource)}
                      className="flex w-full items-center justify-between gap-3 border-b border-zinc-200 px-4 py-2.5 text-left text-sm text-zinc-800 hover:bg-zinc-100"
                    >
                      <span className="inline-flex items-center gap-3">
                        <Info size={18} className="shrink-0" />
                        <span className="whitespace-nowrap">Detalhes</span>
                      </span>
                      <span className="whitespace-nowrap text-[12px] text-zinc-500">
                        Alt+V, depois D
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleShowLinkedSourceSecurityNotes(openSourceActionsMenuSource)}
                      className="flex w-full items-center gap-3 border-b border-zinc-200 px-4 py-2.5 text-left text-sm text-zinc-800 hover:bg-zinc-100"
                    >
                      <Info size={18} className="shrink-0" />
                      <span className="whitespace-nowrap">Limitações de segurança</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleShowLinkedSourceActivity(openSourceActionsMenuSource)}
                      className="flex w-full items-center justify-between gap-3 border-b border-zinc-200 px-4 py-2.5 text-left text-sm text-zinc-800 hover:bg-zinc-100"
                    >
                      <span className="inline-flex items-center gap-3">
                        <ArrowDownRight size={18} className="shrink-0" />
                        <span className="whitespace-nowrap">Atividade</span>
                      </span>
                      <span className="whitespace-nowrap text-[12px] text-zinc-500">
                        Alt+V, depois A
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSearchByLinkedSourceName(openSourceActionsMenuSource)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-800 hover:bg-zinc-100"
                    >
                      <Search size={18} className="shrink-0" />
                      <span className="whitespace-nowrap">
                        Pesquisar em {openSourceActionsMenuSource.name.replace(/\.[^.]+$/, "").trim()}
                      </span>
                    </button>
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => handleMoveLinkedSourceToTrash(openSourceActionsMenuSource)}
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm text-[#8f1020] hover:bg-[#fde6e8]"
              >
                <span className="inline-flex items-center gap-3">
                  <Trash2 size={18} className="shrink-0" />
                  <span className="whitespace-nowrap">Mover para a lixeira</span>
                </span>
                <span className="whitespace-nowrap text-[12px] text-[#8f1020]">
                  Delete
                </span>
              </button>
            </div>
          </div>,
          document.body,
        )
        : null}

      {isTrashConfirmOpen && typeof document !== "undefined"
        ? createPortal(
          <div
            className="fixed inset-0 flex items-center justify-center bg-black/40 p-6"
            style={{ zIndex: 2147483646 }}
          >
            <button
              type="button"
              aria-label="Fechar confirmação de mover para lixeira"
              onClick={handleCloseTrashConfirm}
              className="absolute inset-0"
              disabled={isTrashConfirmSubmitting}
            />

            <div
              className="relative w-full max-w-none rounded-2xl border border-zinc-300 bg-white p-6 shadow-2xl"
              style={{
                zIndex: 2147483647,
                width: trashConfirmWidthPx ? `${trashConfirmWidthPx}px` : "min(94vw, 1440px)",
              }}
            >
              <h3 className="text-xl font-semibold text-zinc-900">
                {bulkSourceIdsPendingTrash.length > 0 ? "Mover arquivos para a lixeira?" : "Mover arquivo para a lixeira?"}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-600">
                {bulkSourceIdsPendingTrash.length > 0 ? (
                  <>
                    Os <span className="font-semibold text-zinc-900">{bulkSourceIdsPendingTrash.length} arquivos selecionados</span> serão movidos para a lixeira. Você poderá restaurá-los posteriormente, se necessário.
                  </>
                ) : (
                  <>
                    O arquivo <span className="font-semibold text-zinc-900">“{filePendingTrash?.name ?? "arquivo"}”</span> será movido para a lixeira. Você poderá restaurá-lo posteriormente, se necessário.
                  </>
                )}
              </p>

              {trashConfirmError ? (
                <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {trashConfirmError}
                </p>
              ) : null}

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseTrashConfirm}
                  disabled={isTrashConfirmSubmitting}
                  className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleConfirmMoveLinkedSourceToTrash();
                  }}
                  disabled={isTrashConfirmSubmitting}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-rose-700 bg-rose-700 px-4 text-sm font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isTrashConfirmSubmitting ? <RefreshCw size={14} className="animate-spin" /> : null}
                  <span>{isTrashConfirmSubmitting ? "Movendo..." : "Mover para a lixeira"}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
        : null}

      {openBibliographicReferenceModal != null && typeof document !== "undefined"
        ? createPortal(
          <div
            className="fixed inset-0 z-[2147483000] flex items-center justify-center bg-black/45 p-6"
          >
            <button
              type="button"
              aria-label="Fechar modal de referência bibliográfica"
              onClick={handleCloseBibliographicReferenceModal}
              className="absolute inset-0"
            />

            <div className="relative z-[2147483001] isolate flex h-[820px] w-[1440px] max-h-[90vh] max-w-[94vw] flex-col overflow-hidden overflow-x-hidden rounded-[26px] border border-zinc-300 bg-white shadow-2xl">
            <div className="shrink-0 flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5">
              <div>
                <h3 className="text-2xl font-semibold leading-none text-zinc-900 sm:text-3xl md:text-[34px]">
                  Inserir referência bibliográfica
                </h3>
	                <p className="mt-2 text-sm text-zinc-500">
	                  {openBibliographicSource?.name ?? openBibliographicReferenceModal.sourceName ?? "Fonte não encontrada"}
	                </p>
	              </div>

              <button
                type="button"
                onClick={handleCloseBibliographicReferenceModal}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 text-zinc-600 hover:bg-zinc-100"
              >
                <X size={18} />
              </button>
            </div>

            <input
              ref={standaloneReferenceFileInputRef}
              type="file"
              onChange={handleAttachStandaloneReferenceFileInput}
              className="hidden"
            />

            <div
              className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pr-1 [scrollbar-gutter:stable_both-edges]"
              style={{ scrollbarGutter: "stable both-edges" }}
            >
              <div className="flex w-full min-w-0 flex-col px-6 py-4 pb-6">
                <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="min-w-0">
                    <div className="mb-1.5">
                      <FieldLabel
                        text="Tipo de referência"
                        help="Selecione a natureza da fonte consultada. Essa escolha define quais campos específicos serão exibidos e como a referência será formatada em ABNT/APA."
                        className="text-xs font-semibold uppercase tracking-wide text-zinc-600"
                        required
                      />
                    </div>
                    <div className="relative">
                      <select
                        value={bibliographicReferenceForm.referenceType}
                        onChange={(event) => setBibliographicReferenceField("referenceType", event.target.value)}
                        className="h-11 w-full appearance-none rounded-lg border border-[#a83fbe]/70 bg-white px-3 pr-10 text-sm text-zinc-800 outline-none focus:border-[#a83fbe] focus:ring-2 focus:ring-[#a83fbe]/25"
                      >
                        {BIBLIOGRAPHIC_REFERENCE_TYPE_OPTIONS.map((option) => (
                          <option key={`ref-type-option-${option.value}`} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    </div>
                  </div>

                  <div className="min-w-0 rounded-lg bg-zinc-100 px-3 py-3 text-sm text-zinc-600">
                    <p className="inline-flex items-start gap-2">
                      <Info size={14} className="mt-0.5 text-[#a83fbe]" />
                      <span>
                        Preencha os campos principais. Os campos opcionais podem ser deixados em branco.
                      </span>
                    </p>
                  </div>
                </div>

                <div className="mt-4 min-w-0 overflow-x-auto border-b border-zinc-200">
                  <div className="flex w-max min-w-full gap-6">
                  {[
                    { key: "sourceData" as const, label: "Dados da fonte", icon: FileText },
                    { key: "specificData" as const, label: "Dados específicos", icon: BookOpen },
                    { key: "citations" as const, label: "Citações usadas", icon: ClipboardCopy },
                    { key: "preview" as const, label: "Prévia", icon: Eye },
                    { key: "evidences" as const, label: "Arquivos e evidências", icon: FolderOpen },
                    { key: "researchNotes" as const, label: "Notas do pesquisador", icon: MessageSquare },
                    ...(openBibliographicReferenceModal.isStandalone
                      ? [{ key: "standaloneAttachment" as const, label: "Arquivo referenciado", icon: FileUp }]
                      : []),
                  ].map((tabItem) => {
                    const TabIcon = tabItem.icon;
                    const isTabActive = bibliographicReferenceTab === tabItem.key;
                    return (
                      <button
                        key={tabItem.key}
                        type="button"
                        onClick={() => setBibliographicReferenceTab(tabItem.key)}
                        className={`inline-flex items-center gap-2 border-b-2 px-1 py-2 text-sm font-semibold transition ${
                          isTabActive
                            ? "border-[#a83fbe] text-[#a83fbe]"
                            : "border-transparent text-zinc-600 hover:text-zinc-900"
                        }`}
                      >
                        <TabIcon size={14} />
                        <span>{tabItem.label}</span>
                      </button>
                    );
                  })}
                  </div>
                </div>

                <div
                  className="mt-4 grid w-full min-w-0 max-w-full gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]"
                  style={{ contain: "inline-size" }}
                >
                  <div className="w-full min-w-0 max-w-full overflow-x-hidden pr-1" style={{ contain: "inline-size" }}>
                    {bibliographicReferenceTab === "sourceData" ? (
                      <div className="w-full min-w-0 space-y-4">
                        {renderResponsibleFieldGroup(
                          "author",
                          "Autor(es)",
                          "Inclua cada autor em campos separados: primeiro nome, nome do meio e sobrenome. A ordem de autoria será usada na citação e na referência.",
                          true,
                        )}

                        <div className="space-y-3">
                          {renderResponsibleFieldGroup(
                            "organizer",
                            "Organizador(es)",
                            "Informe os organizadores quando a obra coletiva indicar essa função (ex.: coletâneas e livros organizados).",
                          )}
                          {renderResponsibleFieldGroup(
                            "editor",
                            "Editor(es)",
                            "Preencha os editores científicos/editoriais quando a fonte indicar essa responsabilidade explicitamente.",
                          )}
                          {renderResponsibleFieldGroup(
                            "translator",
                            "Tradutor(es)",
                            "Use quando a edição consultada for traduzida. Informe os tradutores conforme aparecem na obra.",
                          )}
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <FieldLabel
                              text="Autor institucional"
                              help="Use quando a obra não tiver autor pessoal e a responsabilidade for de órgão, universidade, ministério, tribunal, empresa ou instituição."
                            />
                            <input
                              value={bibliographicReferenceForm.organizationAuthor}
                              onChange={(event) => setBibliographicReferenceField("organizationAuthor", event.target.value)}
                              className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                            />
                          </div>
                          <div>
                            <FieldLabel
                              text="Título"
                              help="Título principal da obra ou documento consultado."
                              required
                            />
                            <input
                              value={bibliographicReferenceForm.title}
                              onChange={(event) => setBibliographicReferenceField("title", event.target.value)}
                              className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                            />
                          </div>
                          <div>
                            <FieldLabel
                              text="Subtítulo"
                              help="Complete apenas se a fonte tiver subtítulo após dois-pontos."
                            />
                            <input
                              value={bibliographicReferenceForm.subtitle}
                              onChange={(event) => setBibliographicReferenceField("subtitle", event.target.value)}
                              className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                            />
                          </div>
                          <div>
                            <FieldLabel
                              text="Ano"
                              help="Ano de publicação (ou depósito, conforme o tipo da fonte)."
                              required
                            />
                            <input
                              value={bibliographicReferenceForm.year}
                              onChange={(event) => setBibliographicReferenceField("year", event.target.value)}
                              className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                            />
                          </div>
                          <div>
                            <FieldLabel
                              text="Data completa"
                              help="Preencha quando houver dia e mês relevantes (ex.: leis, notícias, páginas web atualizadas)."
                            />
                            <input
                              value={bibliographicReferenceForm.fullDate}
                              onChange={(event) => setBibliographicReferenceField("fullDate", event.target.value)}
                              placeholder="Ex.: 14 maio 2026"
                              className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                            />
                          </div>
                          <div>
                            <FieldLabel
                              text="Local de publicação"
                              help="Cidade/local associado à publicação ou emissão do documento."
                            />
                            <input
                              value={bibliographicReferenceForm.city}
                              onChange={(event) => setBibliographicReferenceField("city", event.target.value)}
                              className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                            />
                          </div>
                          <div>
                            <FieldLabel
                              text="Editora / instituição"
                              help="Informe a editora, órgão emissor ou entidade responsável pelo material."
                            />
                            <input
                              value={bibliographicReferenceForm.publisher}
                              onChange={(event) => setBibliographicReferenceField("publisher", event.target.value)}
                              className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                            />
                          </div>
                          <div>
                            <FieldLabel
                              text="Instituição responsável"
                              help="Instituição acadêmica, governamental ou organizacional vinculada à fonte."
                            />
                            <input
                              value={bibliographicReferenceForm.institution}
                              onChange={(event) => setBibliographicReferenceField("institution", event.target.value)}
                              className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                            />
                          </div>
                          <div>
                            <FieldLabel
                              text="Idioma"
                              help="Idioma do conteúdo consultado (ex.: português, inglês, espanhol)."
                            />
                            <input
                              value={bibliographicReferenceForm.language}
                              onChange={(event) => setBibliographicReferenceField("language", event.target.value)}
                              className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                            />
                          </div>
                          <div>
                            <FieldLabel
                              text="País"
                              help="País de publicação ou da instituição emissora, quando aplicável."
                            />
                            <input
                              value={bibliographicReferenceForm.country}
                              onChange={(event) => setBibliographicReferenceField("country", event.target.value)}
                              className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                            />
                          </div>
                          <div>
                            <FieldLabel
                              text="DOI"
                              help="Identificador digital persistente. Se existir DOI, ele costuma ter prioridade sobre URL em referências acadêmicas."
                            />
                            <input
                              value={bibliographicReferenceForm.doi}
                              onChange={(event) => setBibliographicReferenceField("doi", event.target.value)}
                              className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                            />
                          </div>
                          <div>
                            <FieldLabel
                              text="ISBN"
                              help="Identificador de livros e e-books."
                            />
                            <input
                              value={bibliographicReferenceForm.isbn}
                              onChange={(event) => setBibliographicReferenceField("isbn", event.target.value)}
                              className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                            />
                          </div>
                          <div>
                            <FieldLabel
                              text="ISSN"
                              help="Identificador de periódicos, revistas e séries."
                            />
                            <input
                              value={bibliographicReferenceForm.issn}
                              onChange={(event) => setBibliographicReferenceField("issn", event.target.value)}
                              className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                            />
                          </div>
                          <div>
                            <FieldLabel
                              text="URL"
                              help="Link da fonte consultada online. Prefira o URL estável da página oficial ou repositório."
                            />
                            <input
                              value={bibliographicReferenceForm.url}
                              onChange={(event) => setBibliographicReferenceField("url", event.target.value)}
                              className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                            />
                          </div>
                          <div>
                            <FieldLabel
                              text="Data de acesso"
                              help="Data em que você acessou a fonte online. Importante para conteúdos mutáveis."
                            />
                            <input
                              value={bibliographicReferenceForm.accessDate}
                              onChange={(event) => setBibliographicReferenceField("accessDate", event.target.value)}
                              className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                            />
                          </div>
                          <div>
                            <FieldLabel
                              text="Grau de confiabilidade"
                              help="Classifique a natureza da fonte (científica, institucional, jurídica etc.) para apoiar análise de qualidade."
                            />
                            <select
                              value={bibliographicReferenceForm.reliability}
                              onChange={(event) =>
                                setBibliographicReferenceField(
                                  "reliability",
                                  event.target.value as BibliographicReferenceFormState["reliability"],
                                )}
                              className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-[#a83fbe]"
                            >
                              <option value="scientific">Científica</option>
                              <option value="institutional">Institucional</option>
                              <option value="journalistic">Jornalística</option>
                              <option value="legal">Jurídica</option>
                              <option value="informal">Informal</option>
                              <option value="unverified">Não verificada</option>
                              <option value="technical">Técnica</option>
                              <option value="governmental">Governamental</option>
                              <option value="academic">Acadêmica</option>
                              <option value="audiovisual">Audiovisual</option>
                              <option value="other">Outra</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {bibliographicReferenceTab === "specificData" ? (
                      <div className="w-full min-w-0 space-y-4">
                        <p className="text-xs text-zinc-500">
                          Campos condicionais para <strong>{bibliographicReferenceForm.referenceType}</strong>.
                        </p>

                        {(bibliographicTypeFlags.isBook || bibliographicTypeFlags.isArticle || bibliographicTypeFlags.isTech) ? (
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <FieldLabel text="Edição" help="Número da edição da obra (ex.: 2. ed., 5th ed.)." />
                              <input
                                value={bibliographicReferenceForm.edition}
                                onChange={(event) => setBibliographicReferenceField("edition", event.target.value)}
                                className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                              />
                            </div>
                            <div>
                              <FieldLabel text="Série / coleção" help="Nome da série ou coleção editorial, quando existir." />
                              <input
                                value={bibliographicReferenceForm.series}
                                onChange={(event) => setBibliographicReferenceField("series", event.target.value)}
                                className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                              />
                            </div>
                            <div>
                              <FieldLabel text="Volume" help="Volume da obra ou do periódico, quando aplicável." />
                              <input
                                value={bibliographicReferenceForm.volume}
                                onChange={(event) => setBibliographicReferenceField("volume", event.target.value)}
                                className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                              />
                            </div>
                            <div>
                              <FieldLabel text="Número / fascículo" help="Número da edição/fascículo no periódico ou série." />
                              <input
                                value={bibliographicReferenceForm.issue}
                                onChange={(event) => setBibliographicReferenceField("issue", event.target.value)}
                                className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                              />
                            </div>
                          </div>
                        ) : null}

                        {bibliographicTypeFlags.isArticle ? (
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <FieldLabel text="Periódico / contêiner" help="Título do periódico, livro, anais ou fonte hospedeira onde o item está inserido." />
                              <input
                                value={bibliographicReferenceForm.containerTitle}
                                onChange={(event) => setBibliographicReferenceField("containerTitle", event.target.value)}
                                className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                              />
                            </div>
                            <div>
                              <FieldLabel text="Base de indexação" help="Base ou repositório em que o material foi encontrado (Scielo, PubMed, CAPES etc.)." />
                              <input
                                value={bibliographicReferenceForm.databaseName}
                                onChange={(event) => setBibliographicReferenceField("databaseName", event.target.value)}
                                placeholder="Scielo, PubMed, CAPES..."
                                className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                              />
                            </div>
                            <div>
                              <FieldLabel text="Página inicial" help="Primeira página do artigo/capítulo/trecho." />
                              <input
                                value={bibliographicReferenceForm.pageStart}
                                onChange={(event) => setBibliographicReferenceField("pageStart", event.target.value)}
                                className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                              />
                            </div>
                            <div>
                              <FieldLabel text="Página final" help="Última página do artigo/capítulo/trecho." />
                              <input
                                value={bibliographicReferenceForm.pageEnd}
                                onChange={(event) => setBibliographicReferenceField("pageEnd", event.target.value)}
                                className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                              />
                            </div>
                          </div>
                        ) : null}

                        {bibliographicTypeFlags.isAcademicWork ? (
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <FieldLabel text="Tipo de trabalho" help="Classificação do trabalho acadêmico: tese, dissertação, TCC, monografia etc." />
                              <input
                                value={bibliographicReferenceForm.workType}
                                onChange={(event) => setBibliographicReferenceField("workType", event.target.value)}
                                placeholder="tese, dissertação, TCC..."
                                className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                              />
                            </div>
                            <div>
                              <FieldLabel text="Grau" help="Grau acadêmico associado (doutorado, mestrado, especialização, graduação)." />
                              <input
                                value={bibliographicReferenceForm.degree}
                                onChange={(event) => setBibliographicReferenceField("degree", event.target.value)}
                                placeholder="doutorado, mestrado..."
                                className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                              />
                            </div>
                            <div>
                              <FieldLabel text="Programa / curso" help="Programa de pós-graduação, curso ou área em que o trabalho foi defendido." />
                              <input
                                value={bibliographicReferenceForm.program}
                                onChange={(event) => setBibliographicReferenceField("program", event.target.value)}
                                className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                              />
                            </div>
                            <div>
                              <FieldLabel text="Repositório" help="Repositório institucional, biblioteca digital ou base de armazenamento do trabalho." />
                              <input
                                value={bibliographicReferenceForm.repositoryName}
                                onChange={(event) => setBibliographicReferenceField("repositoryName", event.target.value)}
                                className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                              />
                            </div>
                            <div>
                              <FieldLabel text="Orientador" help="Nome do orientador principal da pesquisa/trabalho." />
                              <input
                                value={bibliographicReferenceForm.advisor}
                                onChange={(event) => setBibliographicReferenceField("advisor", event.target.value)}
                                className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                              />
                            </div>
                            <div>
                              <FieldLabel text="Coorientador" help="Nome do coorientador, quando houver." />
                              <input
                                value={bibliographicReferenceForm.coAdvisor}
                                onChange={(event) => setBibliographicReferenceField("coAdvisor", event.target.value)}
                                className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                              />
                            </div>
                          </div>
                        ) : null}

                        {bibliographicTypeFlags.isLegal ? (
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <FieldLabel text="Ente federativo / jurisdição" help="Âmbito jurídico da norma/ato: Brasil, estado, município, tribunal etc." />
                              <input
                                value={bibliographicReferenceForm.lawJurisdiction}
                                onChange={(event) => setBibliographicReferenceField("lawJurisdiction", event.target.value)}
                                placeholder="Brasil, Estado, Município..."
                                className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                              />
                            </div>
                            <div>
                              <FieldLabel text="Tipo normativo" help="Natureza da norma: Constituição, lei, decreto, portaria, resolução, instrução normativa etc." />
                              <input
                                value={bibliographicReferenceForm.lawType}
                                onChange={(event) => setBibliographicReferenceField("lawType", event.target.value)}
                                placeholder="Lei, Decreto, Portaria..."
                                className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                              />
                            </div>
                            <div>
                              <FieldLabel text="Número" help="Número oficial da norma, processo ou documento jurídico." />
                              <input
                                value={bibliographicReferenceForm.lawNumber}
                                onChange={(event) => setBibliographicReferenceField("lawNumber", event.target.value)}
                                className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                              />
                            </div>
                            <div>
                              <FieldLabel text="Órgão emissor" help="Órgão, tribunal, ministério ou instituição que publicou o ato/documento." />
                              <input
                                value={bibliographicReferenceForm.emittingBody}
                                onChange={(event) => setBibliographicReferenceField("emittingBody", event.target.value)}
                                className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <FieldLabel text="Ementa" help="Resumo oficial do conteúdo normativo ou da decisão judicial." />
                              <textarea
                                value={bibliographicReferenceForm.lawSummary}
                                onChange={(event) => setBibliographicReferenceField("lawSummary", event.target.value)}
                                rows={2}
                                className="mt-1 w-full min-w-0 resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#a83fbe]"
                              />
                            </div>
                            <div>
                              <FieldLabel text="Diário oficial" help="Veículo oficial de publicação do ato (DOU, DOE etc.)." />
                              <input
                                value={bibliographicReferenceForm.officialGazette}
                                onChange={(event) => setBibliographicReferenceField("officialGazette", event.target.value)}
                                className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                              />
                            </div>
                            <div>
                              <FieldLabel text="Seção / página" help="Dados de localização da publicação oficial (seção e página)." />
                              <div className="mt-1 grid gap-2 grid-cols-2">
                                <input
                                  value={bibliographicReferenceForm.legalSection}
                                  onChange={(event) => setBibliographicReferenceField("legalSection", event.target.value)}
                                  placeholder="Seção"
                                  className="h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                                />
                                <input
                                  value={bibliographicReferenceForm.legalPage}
                                  onChange={(event) => setBibliographicReferenceField("legalPage", event.target.value)}
                                  placeholder="Página"
                                  className="h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                                />
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {bibliographicTypeFlags.isEvent ? (
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <FieldLabel text="Evento" help="Nome completo do congresso, simpósio, seminário, aula ou conferência." />
                              <input
                                value={bibliographicReferenceForm.eventTitle}
                                onChange={(event) => setBibliographicReferenceField("eventTitle", event.target.value)}
                                className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                              />
                            </div>
                            <div>
                              <FieldLabel text="Edição do evento" help="Número da edição do evento (ex.: 12º Congresso...)." />
                              <input
                                value={bibliographicReferenceForm.eventEdition}
                                onChange={(event) => setBibliographicReferenceField("eventEdition", event.target.value)}
                                className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                              />
                            </div>
                            <div>
                              <FieldLabel text="Local do evento" help="Cidade, país ou plataforma onde o evento ocorreu." />
                              <input
                                value={bibliographicReferenceForm.eventLocation}
                                onChange={(event) => setBibliographicReferenceField("eventLocation", event.target.value)}
                                className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                              />
                            </div>
                            <div>
                              <FieldLabel text="Data do evento" help="Data (ou período) de realização do evento." />
                              <input
                                value={bibliographicReferenceForm.eventDate}
                                onChange={(event) => setBibliographicReferenceField("eventDate", event.target.value)}
                                className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <FieldLabel text="Título dos anais" help="Título oficial dos anais onde o trabalho foi publicado." />
                              <input
                                value={bibliographicReferenceForm.proceedingsTitle}
                                onChange={(event) => setBibliographicReferenceField("proceedingsTitle", event.target.value)}
                                className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                              />
                            </div>
                          </div>
                        ) : null}

                        {(bibliographicTypeFlags.isMedia || bibliographicTypeFlags.isTech) ? (
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <FieldLabel text="Plataforma" help="Plataforma de publicação/transmissão (YouTube, Moodle, Zoom, Spotify etc.)." />
                              <input
                                value={bibliographicReferenceForm.presentationPlatform}
                                onChange={(event) => setBibliographicReferenceField("presentationPlatform", event.target.value)}
                                className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                              />
                            </div>
                            <div>
                              <FieldLabel text="Duração" help="Duração total da mídia (áudio/vídeo/palestra), quando disponível." />
                              <input
                                value={bibliographicReferenceForm.mediaDuration}
                                onChange={(event) => setBibliographicReferenceField("mediaDuration", event.target.value)}
                                placeholder="00:00:00"
                                className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                              />
                            </div>
                            <div>
                              <FieldLabel text="Versão (software/dataset)" help="Versão exata do software, aplicativo, sistema ou dataset utilizado." />
                              <input
                                value={bibliographicReferenceForm.softwareVersion}
                                onChange={(event) => setBibliographicReferenceField("softwareVersion", event.target.value)}
                                className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                              />
                            </div>
                            <div>
                              <FieldLabel text="Licença" help="Licença de uso/distribuição da fonte (MIT, GPL, CC-BY, domínio público etc.)." />
                              <input
                                value={bibliographicReferenceForm.license}
                                onChange={(event) => setBibliographicReferenceField("license", event.target.value)}
                                className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                              />
                            </div>
                          </div>
                        ) : null}

                        {bibliographicTypeFlags.isOnline ? (
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <FieldLabel text="URL de acesso" help="Link específico do recurso utilizado para consulta." />
                              <input
                                value={bibliographicReferenceForm.accessUrl}
                                onChange={(event) => setBibliographicReferenceField("accessUrl", event.target.value)}
                                className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                              />
                            </div>
                            <div>
                              <FieldLabel text="Identificador digital" help="Identificador alternativo ao DOI/ISBN/ISSN (handle, código interno, ID de plataforma)." />
                              <input
                                value={bibliographicReferenceForm.digitalIdentifier}
                                onChange={(event) => setBibliographicReferenceField("digitalIdentifier", event.target.value)}
                                className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {bibliographicReferenceTab === "citations" ? (
                      <div
                        className="w-full min-w-0 max-w-full space-y-4 overflow-x-hidden [&_*]:max-w-full [&_*]:min-w-0"
                        style={{ contain: "inline-size" }}
                      >
                        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                          <h5 className="text-sm font-semibold text-zinc-800">Nova ocorrência de citação</h5>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <div>
                              <FieldLabel
                                text="Tipo de citação"
                                help="Escolha como a fonte foi usada: direta, indireta, paráfrase, apud ou menção narrativa."
                                className="text-xs font-semibold uppercase tracking-wide text-zinc-600"
                              />
                              <select
                                value={bibliographicReferenceForm.citationDraft.citationType}
                                onChange={(event) =>
                                  setBibliographicCitationDraftField(
                                    "citationType",
                                    event.target.value as BibliographicCitationOccurrenceInput["citationType"],
                                  )}
                                className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-[#a83fbe]"
                              >
                                <option value="directShort">Direta curta</option>
                                <option value="directLong">Direta longa</option>
                                <option value="indirect">Indireta</option>
                                <option value="citationOfCitation">Citação de citação (apud)</option>
                                <option value="paraphrase">Paráfrase</option>
                                <option value="narrativeMention">Menção narrativa</option>
                              </select>
                            </div>
                            <div>
                              <FieldLabel
                                text="Formato da chamada"
                                help="Define o estilo da chamada no texto: autor-data, nota de rodapé ou numérico."
                                className="text-xs font-semibold uppercase tracking-wide text-zinc-600"
                              />
                              <select
                                value={bibliographicReferenceForm.citationDraft.callFormat}
                                onChange={(event) =>
                                  setBibliographicCitationDraftField(
                                    "callFormat",
                                    event.target.value as BibliographicCitationOccurrenceInput["callFormat"],
                                  )}
                                className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-[#a83fbe]"
                              >
                                <option value="authorDate">Autor-data</option>
                                <option value="footnote">Nota de rodapé</option>
                                <option value="numeric">Numérico</option>
                              </select>
                            </div>
                            <div>
                              <FieldLabel
                                text="Modo da citação"
                                help="Parentética: (Autor, ano). Narrativa: Autor (ano)."
                                className="text-xs font-semibold uppercase tracking-wide text-zinc-600"
                              />
                              <select
                                value={bibliographicReferenceForm.citationDraft.mode}
                                onChange={(event) =>
                                  setBibliographicCitationDraftField(
                                    "mode",
                                    event.target.value as BibliographicCitationOccurrenceInput["mode"],
                                  )}
                                className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-[#a83fbe]"
                              >
                                <option value="parenthetical">Parentética</option>
                                <option value="narrative">Narrativa</option>
                              </select>
                            </div>
                            <div>
                              <FieldLabel
                                text="Página / intervalo"
                                help="Para citação direta, informe a página inicial e final (quando houver)."
                                className="text-xs font-semibold uppercase tracking-wide text-zinc-600"
                              />
                              <div className="mt-1 grid grid-cols-2 gap-2">
                                <input
                                  value={bibliographicReferenceForm.citationDraft.page}
                                  onChange={(event) => setBibliographicCitationDraftField("page", event.target.value)}
                                  placeholder="Página"
                                  className="h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                                />
                                <input
                                  value={bibliographicReferenceForm.citationDraft.pageEnd}
                                  onChange={(event) => setBibliographicCitationDraftField("pageEnd", event.target.value)}
                                  placeholder="Página final"
                                  className="h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                                />
                              </div>
                            </div>
                            <div>
                              <FieldLabel
                                text="Capítulo / seção / parágrafo"
                                help="Localização alternativa quando página não se aplica (documentos digitais, legislações, normas)."
                                className="text-xs font-semibold uppercase tracking-wide text-zinc-600"
                              />
                              <div className="mt-1 grid grid-cols-3 gap-2">
                                <input
                                  value={bibliographicReferenceForm.citationDraft.chapter}
                                  onChange={(event) => setBibliographicCitationDraftField("chapter", event.target.value)}
                                  placeholder="Capítulo"
                                  className="h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                                />
                                <input
                                  value={bibliographicReferenceForm.citationDraft.section}
                                  onChange={(event) => setBibliographicCitationDraftField("section", event.target.value)}
                                  placeholder="Seção"
                                  className="h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                                />
                                <input
                                  value={bibliographicReferenceForm.citationDraft.paragraph}
                                  onChange={(event) => setBibliographicCitationDraftField("paragraph", event.target.value)}
                                  placeholder="Parágrafo"
                                  className="h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                                />
                              </div>
                            </div>
                            <div>
                              <FieldLabel
                                text="Timestamp (áudio/vídeo)"
                                help="Informe minuto/segundo inicial e final do trecho citado em fonte audiovisual."
                                className="text-xs font-semibold uppercase tracking-wide text-zinc-600"
                              />
                              <div className="mt-1 grid grid-cols-2 gap-2">
                                <input
                                  value={bibliographicReferenceForm.citationDraft.timestampStart}
                                  onChange={(event) => setBibliographicCitationDraftField("timestampStart", event.target.value)}
                                  placeholder="Início"
                                  className="h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                                />
                                <input
                                  value={bibliographicReferenceForm.citationDraft.timestampEnd}
                                  onChange={(event) => setBibliographicCitationDraftField("timestampEnd", event.target.value)}
                                  placeholder="Fim"
                                  className="h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                                />
                              </div>
                            </div>
                            <div className="md:col-span-2">
                              <FieldLabel
                                text="Trecho literal citado"
                                help="Trecho copiado exatamente da fonte (citação direta)."
                                className="text-xs font-semibold uppercase tracking-wide text-zinc-600"
                              />
                              <textarea
                                value={bibliographicReferenceForm.citationDraft.literalExcerpt}
                                onChange={(event) => setBibliographicCitationDraftField("literalExcerpt", event.target.value)}
                                rows={2}
                                className="mt-1 w-full min-w-0 resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#a83fbe]"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <FieldLabel
                                text="Trecho parafraseado"
                                help="Reformulação autoral da ideia da fonte (citação indireta/paráfrase)."
                                className="text-xs font-semibold uppercase tracking-wide text-zinc-600"
                              />
                              <textarea
                                value={bibliographicReferenceForm.citationDraft.paraphrasedExcerpt}
                                onChange={(event) => setBibliographicCitationDraftField("paraphrasedExcerpt", event.target.value)}
                                rows={2}
                                className="mt-1 w-full min-w-0 resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#a83fbe]"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <FieldLabel
                                text="Comentário autoral / local no documento"
                                help="Observação crítica do pesquisador e posição em que a citação foi usada no texto."
                                className="text-xs font-semibold uppercase tracking-wide text-zinc-600"
                              />
                              <div className="mt-1 grid grid-cols-2 gap-2">
                                <input
                                  value={bibliographicReferenceForm.citationDraft.authorComment}
                                  onChange={(event) => setBibliographicCitationDraftField("authorComment", event.target.value)}
                                  placeholder="Comentário do pesquisador"
                                  className="h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                                />
                                <input
                                  value={bibliographicReferenceForm.citationDraft.locationInDocument}
                                  onChange={(event) => setBibliographicCitationDraftField("locationInDocument", event.target.value)}
                                  placeholder="Capítulo / bloco de inserção"
                                  className="h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                                />
                              </div>
                            </div>
                            <div className="md:col-span-2">
                              <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
                                <input
                                  type="checkbox"
                                  checked={bibliographicReferenceForm.citationDraft.includeReferenceEntry}
                                  onChange={(event) => setBibliographicCitationDraftField("includeReferenceEntry", event.target.checked)}
                                  className="h-4 w-4 rounded border-zinc-300 text-[#a83fbe] focus:ring-[#a83fbe]"
                                />
                                <span>Gerar entrada na lista de referências</span>
                              </label>
                            </div>
                          </div>
                          <div className="mt-3">
                            <button
                              type="button"
                              onClick={handleAddCitationOccurrence}
                              className="inline-flex h-9 items-center rounded-md border border-[#a83fbe]/50 bg-white px-3 text-sm font-semibold text-[#a83fbe] hover:bg-[#fcf6ff]"
                            >
                              Adicionar ocorrência
                            </button>
                          </div>
                        </div>

                        <div className="rounded-lg border border-zinc-200 bg-white">
                          <div className="border-b border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700">
                            Citações desta fonte
                          </div>
                          <div>
                            {bibliographicReferenceForm.citationOccurrences.length === 0 ? (
                              <p className="px-3 py-3 text-sm text-zinc-500">
                                Nenhuma ocorrência adicionada ainda.
                              </p>
                            ) : (
                              bibliographicReferenceForm.citationOccurrences.map((occurrence, index) => (
                                <div key={occurrence.id} className="border-b border-zinc-100 px-3 py-2 last:border-b-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-semibold text-zinc-800">
                                      {index + 1}. {occurrence.citationType} ({occurrence.mode})
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveCitationOccurrence(occurrence.id)}
                                      className="inline-flex items-center rounded border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                                    >
                                      Remover
                                    </button>
                                  </div>
                                  <p className="mt-1 text-xs text-zinc-500">
                                    Página: {occurrence.page || "-"}{occurrence.pageEnd ? `-${occurrence.pageEnd}` : ""} ·
                                    Seção: {occurrence.section || "-"} · Timestamp: {occurrence.timestampStart || "-"}
                                  </p>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {bibliographicReferenceTab === "preview" ? (
                      <div className="w-full min-w-0 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                        <h4 className="text-base font-semibold text-zinc-800">Prévia da referência</h4>
                        <p className="mt-3 text-sm leading-relaxed text-zinc-700">
                          {bibliographicFormattedReference || "A prévia será exibida quando os campos forem preenchidos."}
                        </p>
                        <h5 className="mt-6 text-sm font-semibold text-zinc-800">Prévia de citação</h5>
                        <p className="mt-2 text-sm text-zinc-700">
                          Parentética: {renderCitationWithItalicEtAl(bibliographicCitationTemplates.parenthetical)}
                        </p>
                        <p className="mt-1 text-sm text-zinc-700">
                          Narrativa: {renderCitationWithItalicEtAl(bibliographicCitationTemplates.narrative)}
                        </p>
                      </div>
                    ) : null}

                    {bibliographicReferenceTab === "evidences" ? (
                      <div className="w-full min-w-0 space-y-3">
                        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                          <p className="text-sm font-semibold text-zinc-700">Arquivo fonte vinculado</p>
                          <p className="mt-1 text-sm text-zinc-800">{openBibliographicSource?.name || "Nenhum arquivo selecionado."}</p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {openBibliographicSource
                              ? `${classifySourceFile(openBibliographicSource.mimeType, openBibliographicSource.name)} · ${formatFileSize(openBibliographicSource.size)}`
                              : "Adicione arquivos de evidência para validar a referência."}
                          </p>
                        </div>
                        <div className="rounded-lg border border-zinc-200 bg-white">
                          <div className="border-b border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700">
                            Evidências do documento
                          </div>
                          <div>
                            {openBibliographicWorkspace.sources.length === 0 ? (
                              <p className="px-3 py-3 text-sm text-zinc-500">Nenhum arquivo anexado neste documento.</p>
                            ) : (
                              openBibliographicWorkspace.sources.map((source) => (
                                <div key={`evidence-${source.id}`} className="flex items-center justify-between gap-3 border-b border-zinc-100 px-3 py-2 last:border-b-0">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-zinc-800">{source.name}</p>
                                    <p className="text-xs text-zinc-500">{formatFileSize(source.size)} · {formatDateTime(source.addedAt)}</p>
                                  </div>
                                  <span className="inline-flex rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-[11px] font-semibold text-zinc-600">
                                    {classifySourceFile(source.mimeType, source.name)}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {bibliographicReferenceTab === "researchNotes" ? (
                      <div className="grid w-full min-w-0 gap-3">
                        <div>
                          <FieldLabel
                            text="Resumo da fonte"
                            help="Síntese analítica da fonte em linguagem própria do pesquisador."
                          />
                          <textarea
                            value={bibliographicReferenceForm.sourceSummary}
                            onChange={(event) => setBibliographicReferenceField("sourceSummary", event.target.value)}
                            rows={4}
                            className="mt-1 w-full min-w-0 resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#a83fbe]"
                          />
                        </div>
                        <div>
                          <FieldLabel
                            text="Palavras-chave (separadas por vírgula)"
                            help="Termos centrais para recuperar esta fonte rapidamente."
                          />
                          <input
                            value={bibliographicReferenceForm.keywords}
                            onChange={(event) => setBibliographicReferenceField("keywords", event.target.value)}
                            className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                          />
                        </div>
                        <div>
                          <FieldLabel
                            text="Tags temáticas (separadas por vírgula)"
                            help="Etiquetas temáticas internas do projeto/documento."
                          />
                          <input
                            value={bibliographicReferenceForm.tags}
                            onChange={(event) => setBibliographicReferenceField("tags", event.target.value)}
                            className="mt-1 h-10 w-full min-w-0 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-[#a83fbe]"
                          />
                        </div>
                        <div>
                          <FieldLabel
                            text="Observações internas / fichamento"
                            help="Notas críticas, fichamentos, conexões com capítulos e hipóteses de uso da fonte."
                          />
                          <textarea
                            value={bibliographicReferenceForm.notes}
                            onChange={(event) => setBibliographicReferenceField("notes", event.target.value)}
                            rows={5}
                            className="mt-1 w-full min-w-0 resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#a83fbe]"
                          />
                        </div>
                      </div>
                    ) : null}

                    {bibliographicReferenceTab === "standaloneAttachment" ? (
                      <div className="w-full min-w-0 space-y-4">
                        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
                          Esta aba permite anexar o arquivo da referência avulsa depois, quando você localizar o PDF,
                          imagem, recorte ou cópia digital da fonte.
                        </div>

                        <div
                          onDragOver={handleStandaloneReferenceDropAreaDragOver}
                          onDragLeave={handleStandaloneReferenceDropAreaDragLeave}
                          onDrop={handleStandaloneReferenceDropAreaDrop}
                          className={`rounded-xl border-2 border-dashed p-6 text-center transition ${
                            isStandaloneReferenceDropActive
                              ? "border-[#4169e1] bg-[#ecf2ff]"
                              : "border-zinc-300 bg-white"
                          }`}
                        >
                          <FileUp size={28} className="mx-auto text-[#7b1e3f]" />
                          <p className="mt-3 text-sm font-semibold text-zinc-800">
                            Arraste e solte o arquivo referenciado aqui
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            Ou selecione manualmente um arquivo para vincular à referência avulsa.
                          </p>
                          <button
                            type="button"
                            onClick={handleOpenStandaloneReferenceFilePicker}
                            className="mt-4 inline-flex items-center gap-2 rounded-md border border-[#a83fbe]/40 bg-[#f8ecfc] px-3 py-2 text-sm font-medium text-[#7b1e3f] hover:bg-[#f3ddfa]"
                          >
                            <FileUp size={16} />
                            <span>Selecionar arquivo referenciado</span>
                          </button>
                        </div>

                        <div className="rounded-lg border border-zinc-200 bg-white p-3">
                          <p className="text-sm font-semibold text-zinc-700">Arquivo atualmente vinculado</p>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <p className="min-w-0 truncate text-sm text-zinc-800">
                              {openBibliographicSource?.name ?? "Nenhum arquivo vinculado."}
                            </p>
                            {standaloneAttachmentSavedNotice ? (
                              <span className="inline-flex shrink-0 items-center rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                Arquivo salvo
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-zinc-500">
                            {openBibliographicSource
                              ? `${classifySourceFile(openBibliographicSource.mimeType, openBibliographicSource.name)} · ${formatFileSize(openBibliographicSource.size)}`
                              : "Quando um arquivo for anexado, ele será associado a esta referência."}
                          </p>
                          {standaloneAttachmentSavedNotice ? (
                            <p className="mt-1 text-xs text-emerald-700">
                              Também disponível no hall e no modal de Fontes do arquivo.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <aside className="flex min-h-0 w-full min-w-0 max-w-full flex-col overflow-x-hidden rounded-xl border border-zinc-200 bg-zinc-50 p-4" style={{ contain: "inline-size" }}>
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-base font-semibold text-zinc-800">Referência formatada</h4>
                      <select
                        value={bibliographicReferenceForm.citationStyle}
                        onChange={(event) =>
                          setBibliographicReferenceField(
                            "citationStyle",
                            event.target.value as BibliographicReferenceFormState["citationStyle"],
                          )}
                        className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs font-semibold text-[#a83fbe] outline-none"
                      >
                        <option value="ABNT">ABNT</option>
                        <option value="APA">APA</option>
                      </select>
                    </div>

                    <div className="mt-4 min-h-[180px] overflow-hidden rounded-lg border border-zinc-200 bg-white p-3">
                      <p className="text-sm leading-relaxed text-zinc-800 [overflow-wrap:anywhere]">
                        {bibliographicFormattedReference || "Preencha os campos para ver a referência formatada."}
                      </p>
                    </div>

                    <div className="mt-4 border-t border-zinc-200 pt-3">
                      <p className="text-sm font-semibold text-zinc-700">Estilo de citação</p>
                      <p className="mt-2 text-sm text-zinc-700 [overflow-wrap:anywhere]">
                        Parentética: {renderCitationWithItalicEtAl(bibliographicCitationTemplates.parenthetical)}
                      </p>
                      <p className="mt-1 text-sm text-zinc-700 [overflow-wrap:anywhere]">
                        Narrativa: {renderCitationWithItalicEtAl(bibliographicCitationTemplates.narrative)}
                      </p>
                    </div>

                    <div className="mt-4 border-t border-zinc-200 pt-3">
                      <p className="text-sm font-semibold text-zinc-700">
                        Confiança: {bibliographicRenderedOutput.confidence === "high"
                          ? "Alta"
                          : bibliographicRenderedOutput.confidence === "medium"
                            ? "Média"
                            : "Baixa"}
                      </p>
                      {bibliographicRenderedOutput.missingFields.length ? (
                        <p className="mt-2 text-xs text-zinc-600">
                          Campos essenciais ausentes: {bibliographicRenderedOutput.missingFields.join(", ")}
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-zinc-600">Campos essenciais completos.</p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        void handleCopyBibliographicReference();
                      }}
                      disabled={copyReferenceActionState === "working"}
                      className={`mt-4 inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition-all duration-150 active:scale-95 ${
                        copyReferenceActionState === "success"
                          ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                          : copyReferenceActionState === "error"
                            ? "border-rose-600 bg-rose-50 text-rose-700"
                            : "border-[#a83fbe]/50 bg-white text-[#a83fbe] hover:bg-[#fcf6ff]"
                      } ${copyReferenceActionState === "working" ? "cursor-wait opacity-80" : ""}`}
                    >
                      {copyReferenceActionState === "working" ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : copyReferenceActionState === "success" ? (
                        <Check size={14} />
                      ) : copyReferenceActionState === "error" ? (
                        <X size={14} />
                      ) : (
                        <ClipboardCopy size={14} />
                      )}
                      <span>
                        {copyReferenceActionState === "working"
                          ? "Copiando..."
                          : copyReferenceActionState === "success"
                            ? "Copiado"
                            : copyReferenceActionState === "error"
                              ? "Falha ao copiar"
                              : "Copiar referência"}
                      </span>
                    </button>
                  </aside>
                </div>
              </div>
            </div>

            <div className="shrink-0 flex flex-wrap items-center justify-between gap-4 border-t border-zinc-200 px-6 py-4">
              <div className="flex flex-wrap items-center gap-6">
                <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={bibliographicReferenceForm.saveInFileMemory}
                    onChange={(event) =>
                      setBibliographicReferenceField("saveInFileMemory", event.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-[#a83fbe] focus:ring-[#a83fbe]"
                  />
                  <span>Salvar na memória do arquivo</span>
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={bibliographicReferenceForm.linkToCurrentDocument}
                    onChange={(event) =>
                      setBibliographicReferenceField("linkToCurrentDocument", event.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-[#a83fbe] focus:ring-[#a83fbe]"
                  />
                  <span>Vincular ao documento atual</span>
                </label>
              </div>

	              <div className="flex flex-col items-end gap-2">
                  {generateCitationErrorMessage ? (
                    <p className="max-w-[620px] rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-right text-xs font-medium text-rose-700">
                      {generateCitationErrorMessage}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center justify-end gap-2">
	                <button
	                  type="button"
	                  onClick={handleCancelBibliographicReference}
                  disabled={cancelReferenceActionState === "working"}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-md border px-5 text-sm font-medium transition-all duration-150 active:scale-95 ${
                    cancelReferenceActionState === "success"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                      : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
                  } ${cancelReferenceActionState === "working" ? "cursor-wait opacity-80" : ""}`}
                >
                  {cancelReferenceActionState === "working" ? <RefreshCw size={14} className="animate-spin" /> : null}
                  {cancelReferenceActionState === "success" ? <Check size={14} /> : null}
                  <span>
                    {cancelReferenceActionState === "working"
                      ? "Cancelando..."
                      : cancelReferenceActionState === "success"
                        ? "Cancelado"
                        : "Cancelar"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleGenerateBibliographicCitation();
                  }}
                  disabled={generateCitationActionState === "working"}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-md border px-5 text-sm font-semibold transition-all duration-150 active:scale-95 ${
                    generateCitationActionState === "success"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                      : generateCitationActionState === "error"
                        ? "border-rose-600 bg-rose-50 text-rose-700"
                        : "border-[#a83fbe]/50 bg-white text-[#a83fbe] hover:bg-[#fcf6ff]"
                  } ${generateCitationActionState === "working" ? "cursor-wait opacity-80" : ""}`}
                >
                  {generateCitationActionState === "working" ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : generateCitationActionState === "success" ? (
                    <Check size={14} />
                  ) : generateCitationActionState === "error" ? (
                    <X size={14} />
                  ) : null}
                  <span>
                    {generateCitationActionState === "working"
                      ? "Gerando..."
                      : generateCitationActionState === "success"
                        ? "Citação salva"
                        : generateCitationActionState === "error"
                          ? "Falha ao gerar"
                          : "Gerar citação"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveBibliographicReference}
                  disabled={saveReferenceActionState === "working"}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-md px-5 text-sm font-semibold text-white transition-all duration-150 active:scale-95 ${
                    saveReferenceActionState === "success"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : saveReferenceActionState === "error"
                        ? "bg-rose-600 hover:bg-rose-700"
                        : "bg-[#a83fbe] hover:bg-[#9132a6]"
                  } ${saveReferenceActionState === "working" ? "cursor-wait opacity-80" : ""}`}
                >
                  {saveReferenceActionState === "working" ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : saveReferenceActionState === "success" ? (
                    <Check size={14} />
                  ) : saveReferenceActionState === "error" ? (
                    <X size={14} />
                  ) : (
                    <Save size={14} />
                  )}
	                  <span>
	                    {saveReferenceActionState === "working"
                      ? "Salvando..."
                      : saveReferenceActionState === "success"
                        ? "Referência salva"
                        : saveReferenceActionState === "error"
                          ? "Falha ao salvar"
                          : "Salvar referência"}
	                  </span>
	                </button>
                  </div>
	              </div>
	            </div>
            </div>
          </div>,
          document.body,
        )
        : null}
    </div>
  );
}

export function KnexWriterRibbon({ state, actions }: Pick<WriterRenderProps, "state" | "actions">) {
  return <ModularWriterRibbon state={state} actions={actions} />;
}

export function KnexWriterFileBackstage({ state, actions }: Pick<WriterRenderProps, "state" | "actions">) {
  return (
    <div className="flex min-h-0 flex-1 bg-[#f7f7f7]">
      <BackstageSidebar state={state} actions={actions} />
      <div className="min-h-0 flex-1 overflow-y-auto p-6 lg:p-8">
        {state.activeBackstageTab === "home" ? <BackstageHome state={state} actions={actions} /> : null}
        {state.activeBackstageTab === "new" ? <BackstageNew actions={actions} /> : null}
        {state.activeBackstageTab === "open" ? <BackstageOpen state={state} actions={actions} /> : null}
        {state.activeBackstageTab === "info" ? <BackstageInfo state={state} /> : null}
        {state.activeBackstageTab === "save" ? <BackstageSave actions={actions} /> : null}
        {state.activeBackstageTab === "saveAs" ? <BackstageSaveAs state={state} actions={actions} /> : null}
        {state.activeBackstageTab === "export" ? <BackstageExport actions={actions} /> : null}
      </div>
    </div>
  );
}

function BackstageSidebar({ state, actions }: Pick<WriterRenderProps, "state" | "actions">) {
  const menu = [
    { value: "home" as BackstageTab, label: "Página Inicial", icon: FileText },
    { value: "new" as BackstageTab, label: "Novo", icon: FilePlus2 },
    { value: "open" as BackstageTab, label: "Abrir", icon: FolderOpen },
    { value: "info" as BackstageTab, label: "Informações", icon: Info },
    { value: "save" as BackstageTab, label: "Salvar", icon: Save },
    { value: "saveAs" as BackstageTab, label: "Salvar como", icon: FileUp },
    { value: "export" as BackstageTab, label: "Exportar", icon: Download },
    { value: "close" as BackstageTab, label: "Fechar", icon: ChevronLeft },
  ];

  return (
    <aside className="w-[160px] shrink-0 border-r border-zinc-200 bg-[#f6f3f4] p-3">
      <div className="mb-4 rounded-md border border-[#7b1e3f]/20 bg-[#f7e9ee] px-2 py-1 text-sm font-semibold text-[#7b1e3f]">
        Arquivo
      </div>

      <div className="space-y-1.5">
        {menu.map((item) => {
          const Icon = item.icon;
          const isActive = state.activeBackstageTab === item.value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => actions.handleSelectBackstageTab(item.value)}
              className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-sm ${
                isActive
                  ? "border-[#7b1e3f] bg-[#f7e9ee] text-[#7b1e3f]"
                  : "border-transparent text-zinc-700 hover:bg-[#f3e7ec] hover:text-[#6a1835]"
              }`}
            >
              <Icon size={16} className={isActive ? "text-[#7b1e3f]" : "text-zinc-500"} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="my-4 border-t border-[#7b1e3f]/15" />

      <p className="px-2 text-[11px] font-medium uppercase tracking-wide text-[#7b1e3f]/80">KnexWriter</p>
    </aside>
  );
}

function BackstageHome({ state, actions }: Pick<WriterRenderProps, "state" | "actions">) {
  const greeting = getGreeting();
  const recommended = state.recentDocuments.slice(0, 4);
  const recentRows = state.recentDocuments.slice(0, 12);

  return (
    <section className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold text-zinc-900">{greeting}</h2>
          <p className="mt-1 text-sm text-zinc-600">Gerencie documentos, modelos e arquivos recentes do KnexWriter.</p>
        </div>
        <button type="button" onClick={() => actions.handleSelectBackstageTab("new")} className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100">Mais modelos</button>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-900">Novo</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <BlankDocumentTemplateCard actions={actions} />
          <button type="button" onClick={() => void actions.handleCreateWriteProject()} className="rounded-lg border border-zinc-200 bg-white p-4 text-left hover:bg-zinc-50">
            <p className="text-sm font-semibold text-zinc-900">Novo projeto</p>
            <p className="mt-1 text-xs text-zinc-600">Cria projeto e seção inicial para escrita longa.</p>
          </button>
          <button type="button" onClick={() => actions.handleSelectBackstageTab("open")} className="rounded-lg border border-zinc-200 bg-white p-4 text-left hover:bg-zinc-50">
            <p className="text-sm font-semibold text-zinc-900">Abrir arquivo local</p>
            <p className="mt-1 text-xs text-zinc-600">PDF, DOC, DOCX, TXT, HTML e HTM.</p>
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <h3 className="text-lg font-semibold text-zinc-900">Recomendado para você</h3>
        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {recommended.map((document) => (
            <RecentDocumentCard key={document.id} document={document} actions={actions} />
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-900">Recentes</h3>
          <div className="flex h-9 items-center rounded-md border border-zinc-300 bg-white px-2">
            <Search size={14} className="text-zinc-400" />
            <input
              value={state.backstageSearchQuery}
              onChange={(event) => actions.setBackstageSearchQuery(event.target.value)}
              placeholder="Pesquisar documentos"
              className="ml-2 w-56 bg-transparent text-sm outline-none placeholder:text-zinc-400"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[980px]">
            <div
              className="grid gap-2 border-b border-zinc-200 px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500"
              style={{
                gridTemplateColumns:
                  "minmax(320px, 1.8fr) repeat(6, minmax(88px, 0.55fr))",
              }}
            >
              <span>Arquivo</span>
              <span className="text-center">Fontes</span>
              <span className="text-center">Referências</span>
              <span className="text-center">Citações diretas</span>
              <span className="text-center">Citações indiretas</span>
              <span className="text-center">Notas de rodapé</span>
              <span className="text-center">Observações</span>
            </div>

            <div className="space-y-1 pt-1">
              {recentRows.map((document) => (
                <RecentDocumentRow key={`row-${document.id}`} document={document} actions={actions} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function BackstageNew({ actions }: Pick<WriterRenderProps, "actions">) {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold text-zinc-900">Novo</h2>
      <p className="text-sm text-zinc-600">Crie um documento em branco ou inicie um novo projeto.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <BlankDocumentTemplateCard actions={actions} />
        <button type="button" onClick={() => void actions.handleCreateWriteProject()} className="rounded-lg border border-zinc-200 bg-white p-4 text-left hover:bg-zinc-50">
          <p className="text-sm font-semibold text-zinc-900">Criar novo projeto</p>
          <p className="mt-1 text-xs text-zinc-600">Mantém seções, objetivos e chunks vinculados ao projeto.</p>
        </button>
      </div>
    </section>
  );
}

function BackstageOpen({ state, actions }: Pick<WriterRenderProps, "state" | "actions">) {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold text-zinc-900">Abrir</h2>
      <p className="text-sm text-zinc-600">Abra um documento do seu computador e continue editando no palco A4.</p>
      <button
        type="button"
        onClick={() => void actions.handleOpenFileFromWindows()}
        disabled={state.isImportingDocument}
        className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-60"
      >
        {state.isImportingDocument ? "Importando..." : "Procurar neste computador"}
      </button>
      <p className="text-xs text-zinc-500">Formatos aceitos: PDF, DOC, DOCX, TXT, HTML, HTM.</p>
    </section>
  );
}

function BackstageInfo({ state }: Pick<WriterRenderProps, "state">) {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold text-zinc-900">Informações</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <InfoCard title="Documento" body={state.writingTitle || "Documento sem título"} />
        <InfoCard title="Palavras" body={`${state.documentWordCount}`} />
        <InfoCard title="Projeto ativo" body={state.activeProject?.title || "Nenhum"} />
        <InfoCard title="Seção ativa" body={state.activeSection?.title || "Nenhuma"} />
        <InfoCard title="Última sincronização" body={formatDateTime(state.writeSession.lastSyncedAt)} />
        <InfoCard
          title="Arquivo importado"
          body={
            state.importedDocument
              ? `${state.importedDocument.fileName} ? ${formatFileSize(state.importedDocument.fileSize)}`
              : "Nenhum arquivo importado"
          }
        />
      </div>
    </section>
  );
}

function BackstageSave({ actions }: Pick<WriterRenderProps, "actions">) {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold text-zinc-900">Salvar</h2>
      <p className="text-sm text-zinc-600">Salve o rascunho local mantendo o documento atual.</p>
      <button type="button" onClick={actions.handleSaveLocalDraft} className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100">Salvar agora</button>
    </section>
  );
}

type SaveAsFormat = "knexwriterDocx" | "writerModel" | "standardDocx" | "pdf" | "html" | "txt";

function BackstageSaveAs({ state, actions }: Pick<WriterRenderProps, "state" | "actions">) {
  const [selectedFormat, setSelectedFormat] = useState<SaveAsFormat>("knexwriterDocx");
  const [options, setOptions] = useState<WriterSaveAsOptions>(() =>
    createDefaultSaveAsOptions(state.organization.projectKind),
  );
  const activeProjectId = state.writeSession.activeProjectId;
  const projectSourceFiles = activeProjectId
    ? state.organization.sourceFiles.filter((sourceFile) => sourceFile.projectId === activeProjectId)
    : [];
  const projectReferences = activeProjectId
    ? state.organization.projectReferences.filter((reference) => reference.projectId === activeProjectId)
    : [];
  const projectUsages = activeProjectId
    ? state.organization.referenceUsages.filter((usage) => usage.projectId === activeProjectId)
    : [];
  const auditIssues = buildReferenceAuditIssues(projectSourceFiles, projectReferences, projectUsages);
  const usedReferences = getUsedReferences(projectReferences, projectUsages);
  const guardIssues = createSaveAsGuardReport({
    title: state.writingTitle,
    activeProjectId,
    projectKind: options.projectKind,
    auditIssueCount: auditIssues.filter((issue) => issue.severity !== "info").length,
    usedReferenceCount: usedReferences.length,
    sourceFileCount: projectSourceFiles.length,
  });
  const usesSpecificityPanel =
    selectedFormat === "knexwriterDocx" || selectedFormat === "standardDocx" || selectedFormat === "pdf" || selectedFormat === "writerModel";

  useEffect(() => {
    setOptions((current) => ({ ...current, projectKind: state.organization.projectKind }));
  }, [state.organization.projectKind]);

  const updateOption = <K extends keyof WriterSaveAsOptions>(key: K, value: WriterSaveAsOptions[K]) => {
    setOptions((current) => ({ ...current, [key]: value }));
  };

  const handleSaveSelectedFormat = async () => {
    if (selectedFormat === "html") {
      actions.handleExportHtml();
      return;
    }

    if (selectedFormat === "txt") {
      actions.handleExportTxt();
      return;
    }

    if (selectedFormat === "pdf") {
      await actions.handleExportPdf(options);
      return;
    }

    if (selectedFormat === "standardDocx") {
      await actions.handleExportDocx({ ...options, profile: "standard", includeOrganizationMetadata: false });
      return;
    }

    if (selectedFormat === "writerModel") {
      await actions.handleExportKnexWriterBundle(options);
      return;
    }

    await actions.handleExportDocx({ ...options, profile: "knexwriter" });
  };

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-zinc-900">Salvar como</h2>
        <p className="mt-1 text-sm text-zinc-600">
          DOCX e PDF passam por uma etapa de especificidade para registrar guards, tipo de projeto e referências filtráveis.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <SaveAsFormatCard
          active={selectedFormat === "knexwriterDocx"}
          title="DOCX KnexWriter"
          description="DOCX com guards e metadados estruturais."
          onClick={() => setSelectedFormat("knexwriterDocx")}
        />
        <SaveAsFormatCard
          active={selectedFormat === "writerModel"}
          title="Modelo KnexWriter"
          description="Arquivo interno com filtros, referências e usos."
          onClick={() => setSelectedFormat("writerModel")}
        />
        <SaveAsFormatCard
          active={selectedFormat === "standardDocx"}
          title="DOCX limpo"
          description="DOCX sem apêndice de organização."
          onClick={() => setSelectedFormat("standardDocx")}
        />
        <SaveAsFormatCard
          active={selectedFormat === "pdf"}
          title="PDF"
          description="Abre impressão para salvar como PDF."
          onClick={() => setSelectedFormat("pdf")}
        />
        <SaveAsFormatCard
          active={selectedFormat === "html"}
          title="HTML"
          description="Exportação web simples."
          onClick={() => setSelectedFormat("html")}
        />
        <SaveAsFormatCard
          active={selectedFormat === "txt"}
          title="TXT"
          description="Texto puro sem formatação."
          onClick={() => setSelectedFormat("txt")}
        />
      </div>

      {usesSpecificityPanel ? (
        <div className="grid gap-4 rounded-xl border border-zinc-200 bg-white p-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">Especificidade do salvamento</h3>
              <p className="mt-1 text-xs text-zinc-500">
                Esses critérios alimentam os filtros da Organização quando o arquivo volta ao fluxo do KnexWriter.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-xs font-medium text-zinc-600">
                Tipo de projeto/documento
                <select
                  value={options.projectKind}
                  onChange={(event) => updateOption("projectKind", event.target.value as ProjectKind)}
                  className="h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-800 outline-none"
                >
                  {(Object.entries(PROJECT_KIND_LABEL) as Array<[ProjectKind, string]>).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-xs font-medium text-zinc-600">
                Estilo bibliográfico
                <select
                  value={options.citationStyle}
                  onChange={(event) => updateOption("citationStyle", event.target.value as WriterCitationStyle)}
                  className="h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-800 outline-none"
                >
                  <option value="abnt">ABNT</option>
                  <option value="apa">APA</option>
                </select>
              </label>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <label className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={options.includeOrganizationMetadata}
                  onChange={(event) => updateOption("includeOrganizationMetadata", event.target.checked)}
                />
                Incluir metadados de organização
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={options.includeReferenceAudit}
                  onChange={(event) => updateOption("includeReferenceAudit", event.target.checked)}
                />
                Incluir guards de referências
              </label>
            </div>

            <div className="grid gap-2 text-xs md:grid-cols-4">
              <InfoCard title="Arquivos" body={`${projectSourceFiles.length}`} />
              <InfoCard title="Referências usadas" body={`${usedReferences.length}`} />
              <InfoCard title="Pendências" body={`${auditIssues.filter((issue) => issue.severity !== "info").length}`} />
              <InfoCard title="Projeto" body={PROJECT_KIND_LABEL[options.projectKind]} />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <h3 className="text-sm font-semibold text-zinc-900">Guards do arquivo salvo</h3>
            {guardIssues.length ? (
              <div className="space-y-2">
                {guardIssues.map((issue) => (
                  <div
                    key={issue.message}
                    className={`rounded-md border px-2 py-1.5 text-xs ${
                      issue.severity === "error"
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : issue.severity === "warning"
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-blue-200 bg-blue-50 text-blue-700"
                    }`}
                  >
                    {issue.message}
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs text-emerald-700">
                Nenhum guard bloqueante detectado.
              </p>
            )}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void handleSaveSelectedFormat()}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
      >
        Salvar no formato selecionado
      </button>
    </section>
  );
}

function SaveAsFormatCard({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border p-3 text-left transition ${
        active ? "border-zinc-900 bg-white shadow-sm" : "border-zinc-200 bg-white hover:bg-zinc-50"
      }`}
    >
      <p className="text-sm font-semibold text-zinc-900">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-zinc-500">{description}</p>
    </button>
  );
}

function BackstageExport({ actions }: Pick<WriterRenderProps, "actions">) {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold text-zinc-900">Exportar</h2>
      <div className="grid gap-3 md:grid-cols-4">
        <button type="button" onClick={actions.handleExportHtml} className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100">Exportar HTML</button>
        <button type="button" onClick={() => void actions.handleExportStandardDocx()} className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100">Exportar DOCX</button>
        <button type="button" onClick={actions.handleExportTxt} className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100">Exportar TXT</button>
        <button type="button" onClick={() => void actions.handleExportPdf({ includeOrganizationMetadata: false })} className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100">Exportar PDF</button>
      </div>
    </section>
  );
}

function RecentDocumentCard({ document, actions }: { document: WriterRecentDocument; actions: WriterRenderActions }) {
  const sourceLabel: Record<WriterRecentDocument["source"], string> = {
    project: "Projeto",
    imported: "Importado",
    local: "Local",
    fallback: "Sugestão",
  };

  return (
    <button
      type="button"
      onClick={() => void actions.handleOpenRecentDocument(document)}
      className="rounded-lg border border-zinc-200 bg-white p-3 text-left hover:bg-zinc-50"
    >
      <div className="mb-3 h-20 rounded-md border border-zinc-200 bg-[#f8f8f8]" />
      <p className="line-clamp-1 text-sm font-semibold text-zinc-900">{document.title}</p>
      <p className="mt-1 line-clamp-2 text-xs text-zinc-600">{document.subtitle || "Documento de escrita"}</p>
      <p className="mt-2 text-[11px] text-zinc-500">
        {sourceLabel[document.source]} • {formatDateTime(document.updatedAt)}
      </p>
    </button>
  );
}

function RecentDocumentRow({ document, actions }: { document: WriterRecentDocument; actions: WriterRenderActions }) {
  const sourceLabel: Record<WriterRecentDocument["source"], string> = {
    project: "Projeto",
    imported: "Importado",
    local: "Local",
    fallback: "Sugestão",
  };

  const iconColumns = [
    {
      key: "sources",
      label: "Fontes do arquivo",
      icon: FileUp,
      menuLabel: "Menu de fontes",
    },
    {
      key: "references",
      label: "Referências",
      icon: List,
      menuLabel: "Menu de referências",
    },
    {
      key: "direct-citations",
      label: "Citações diretas",
      icon: ClipboardCopy,
      menuLabel: "Menu de citações diretas",
    },
    {
      key: "indirect-citations",
      label: "Citações indiretas",
      icon: ArrowDownRight,
      menuLabel: "Menu de citações indiretas",
    },
    {
      key: "footnotes",
      label: "Notas de rodapé",
      icon: Pilcrow,
      menuLabel: "Menu de notas de rodapé",
    },
    {
      key: "notes",
      label: "Observações do arquivo",
      icon: MessageSquare,
      menuLabel: "Menu de observações",
    },
  ] as const;

  type IconColumnKey = (typeof iconColumns)[number]["key"];
  const [openMenuColumn, setOpenMenuColumn] = useState<IconColumnKey | null>(
    null,
  );

  return (
    <div
      className="grid items-center gap-2 rounded-md border border-transparent px-2 py-1.5 hover:border-zinc-200 hover:bg-zinc-50"
      style={{
        gridTemplateColumns:
          "minmax(320px, 1.8fr) repeat(6, minmax(88px, 0.55fr))",
      }}
      onMouseLeave={() => setOpenMenuColumn(null)}
    >
      <button
        type="button"
        onClick={() => void actions.handleOpenRecentDocument(document)}
        className="flex min-w-0 items-center gap-3 rounded-md border border-transparent px-1 py-1 text-left hover:border-zinc-200 hover:bg-white"
      >
        <FileText size={16} className="shrink-0 text-zinc-500" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-900">{document.title}</p>
          <p className="truncate text-xs text-zinc-500">{document.subtitle || "Documento"}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] text-zinc-500">{sourceLabel[document.source]}</p>
          <p className="text-[11px] text-zinc-500">{formatDateTime(document.updatedAt)}</p>
        </div>
      </button>

      {iconColumns.map((column) => {
        const Icon = column.icon;
        const isOpen = openMenuColumn === column.key;

        return (
          <div key={`${document.id}-${column.key}`} className="relative flex justify-center">
            <button
              type="button"
              aria-label={column.label}
              title={column.label}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setOpenMenuColumn((current) =>
                  current === column.key ? null : column.key,
                );
              }}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-md border text-zinc-700 transition ${
                isOpen
                  ? "border-[#7b1e3f]/45 bg-[#f7e9ee] text-[#7b1e3f]"
                  : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-100"
              }`}
            >
              <Icon size={15} />
            </button>

            {isOpen ? (
              <div className="absolute left-1/2 top-full z-40 mt-1 w-52 -translate-x-1/2 rounded-md border border-zinc-200 bg-white p-2 shadow-lg">
                <p className="text-xs font-semibold text-zinc-800">{column.menuLabel}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">
                  Estrutura pronta. Aqui entra o menu flutuante completo desta
                  coluna.
                </p>
                <button
                  type="button"
                  onClick={() => void actions.handleOpenRecentDocument(document)}
                  className="mt-2 inline-flex w-full items-center justify-center rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100"
                >
                  Abrir arquivo
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function BlankDocumentTemplateCard({ actions }: { actions: WriterRenderActions }) {
  return (
    <button
      type="button"
      onClick={actions.handleCreateBlankDocument}
      className="rounded-lg border border-zinc-200 bg-white p-4 text-left hover:bg-zinc-50"
    >
      <div className="mb-3 h-20 rounded-md border border-zinc-200 bg-white" />
      <p className="text-sm font-semibold text-zinc-900">Documento em branco</p>
      <p className="mt-1 text-xs text-zinc-600">Crie um documento vazio e comece a escrever.</p>
    </button>
  );
}

/**
 * ============================================================================
 * HEADER DO PRODUTO
 * ============================================================================
 */

export function KnexWriterHeader({ state, actions }: Pick<WriterRenderProps, "state" | "actions">) {
  const hasNamedDocument =
    Boolean(state.writingTitle?.trim()) && state.writingTitle.trim() !== "Documento sem título";
  const centeredDocumentLabel = state.importedDocument
    ? `${state.importedDocument.fileName} • ${state.importedDocument.fileType.toUpperCase()} • ${formatFileSize(state.importedDocument.fileSize)}`
    : hasNamedDocument
      ? state.writingTitle.trim()
      : "";

  const handleMinimizeWindow = () => {
    if (typeof window === "undefined") return;
    window.blur();
  };

  const handleToggleMaximizeWindow = async () => {
    if (typeof document === "undefined") return;
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(() => undefined);
      return;
    }
    await document.exitFullscreen().catch(() => undefined);
  };

  const handleCloseWindow = () => {
    if (typeof window === "undefined") return;
    window.close();
  };

  return (
    <header
      className="shrink-0 border-b"
      style={{
        borderColor: "#8a319c",
        backgroundColor: "#a83fbe",
      }}
    >
      <div className="relative flex h-11 items-center gap-2 px-3 lg:px-4">
        <div className="flex shrink-0 items-center gap-2">
          <FileText size={18} className="text-white" />
          <span className="text-sm font-semibold text-white">{PAGE_AUDIT.title}</span>
        </div>

        {centeredDocumentLabel ? (
          <div className="pointer-events-none absolute inset-x-0 flex justify-center px-40">
            <div className="max-w-full truncate rounded-full border border-white/35 bg-white/15 px-3 py-1 text-xs font-medium text-white">
              {centeredDocumentLabel}
            </div>
          </div>
        ) : null}

        <div className="ml-2 flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={actions.handleSaveLocalDraft}
            className="inline-flex h-8 items-center justify-center rounded-md border border-white/55 bg-white px-2 text-[#a83fbe] hover:bg-white/90"
            title="Salvar"
          >
            <Save size={14} />
          </button>
          <button
            type="button"
            onClick={() => actions.applyWritingCommand("undo")}
            className="inline-flex h-8 items-center justify-center rounded-md border border-white/55 bg-white px-2 text-[#a83fbe] hover:bg-white/90"
            title="Desfazer"
          >
            <Undo2 size={14} />
          </button>
          <button
            type="button"
            onClick={() => actions.applyWritingCommand("redo")}
            className="inline-flex h-8 items-center justify-center rounded-md border border-white/55 bg-white px-2 text-[#a83fbe] hover:bg-white/90"
            title="Refazer"
          >
            <Redo2 size={14} />
          </button>
          <button
            type="button"
            onClick={actions.handleCreateBlankDocument}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-white/55 bg-white px-2 text-xs font-medium text-[#a83fbe] hover:bg-white/90"
            title="Novo documento"
          >
            <FilePlus2 size={14} />
            <span className="hidden sm:inline">Novo</span>
          </button>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={handleMinimizeWindow}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/40 bg-white/10 text-white hover:bg-white/20"
            title="Minimizar"
            aria-label="Minimizar janela"
          >
            <Minimize2 size={13} />
          </button>
          <button
            type="button"
            onClick={() => void handleToggleMaximizeWindow()}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/40 bg-white/10 text-white hover:bg-white/20"
            title="Maximizar"
            aria-label="Maximizar janela"
          >
            <Maximize2 size={13} />
          </button>
          <button
            type="button"
            onClick={handleCloseWindow}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/40 bg-white/10 text-white hover:bg-red-500/70"
            title="Fechar"
            aria-label="Fechar janela"
          >
            <X size={13} />
          </button>
        </div>
      </div>

            <nav
        className="flex h-10 items-center gap-2 border-t px-2"
        style={{ borderColor: "rgba(255,255,255,0.18)", backgroundColor: "#a83fbe" }}
      >
        <div className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex w-max items-center gap-1 pr-1">
            {WRITER_HEADER_TABS.map((tab) => {
              const isActive = state.activeHeaderTab === tab.value;
              const isFileTabActive = tab.value === "file" && state.isFileBackstageOpen;

              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => actions.handleSelectHeaderTab(tab.value)}
                  className={`inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-md border px-3 text-sm font-medium ${
                    isActive || isFileTabActive
                      ? "border-[#a83fbe] bg-white text-[#a83fbe]"
                      : "border-transparent text-white/90 hover:bg-white/15"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <span className={`hidden rounded-full border px-2 py-0.5 text-[11px] font-semibold xl:inline-flex ${state.documentStateClass}`}>
            {state.documentStateLabel}
          </span>
          <div className="hidden h-8 items-center rounded-md border border-white/35 bg-white/10 px-2 md:flex">
            <Search size={14} className="text-white/70" />
            <input
              value={state.backstageSearchQuery}
              onChange={(event) => actions.setBackstageSearchQuery(event.target.value)}
              placeholder="Pesquisar documento"
              className="ml-2 w-40 bg-transparent text-xs text-white outline-none placeholder:text-white/70 lg:w-56"
            />
          </div>
          <button
            type="button"
            className="hidden h-8 items-center justify-center rounded-md border border-white/40 bg-white/15 px-2 text-white hover:bg-white/25 sm:inline-flex"
            title="Comentários"
          >
            <MessageSquare size={14} />
          </button>
          <button
            type="button"
            className="hidden h-8 items-center rounded-md border border-white/40 bg-white/15 px-2 text-xs font-medium text-white hover:bg-white/25 md:inline-flex"
          >
            Editando
          </button>
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1 rounded-md bg-white px-2 text-xs font-semibold text-[#a83fbe] hover:bg-white/90"
          >
            <Share2 size={14} />
            <span className="hidden sm:inline">Compartilhar</span>
          </button>
          <Link href="/knexai/web" className="hidden rounded-md px-2 py-1 text-xs text-white/85 hover:bg-white/15 lg:inline-flex">
            Voltar ao KnexAI
          </Link>
        </div>
      </nav>
    </header>
  );
}

/**
 * ============================================================================
 * RIBBON - PÁGINA INICIAL
 * ============================================================================
 */

export function KnexWriterHomeRibbon({ state, actions }: Pick<WriterRenderProps, "state" | "actions">) {
  const iconButtonClass =
    "inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100";
  const activeIconButtonClass =
    "inline-flex h-8 w-8 items-center justify-center rounded-md border border-blue-500 bg-blue-50 text-blue-700";
  const fontCommandButtonClass =
    "inline-flex h-7 min-w-[28px] items-center justify-center rounded-sm border border-transparent bg-transparent px-1 text-[13px] font-medium text-zinc-700 hover:border-zinc-300 hover:bg-white";
  const fontCommandButtonActiveClass =
    "inline-flex h-7 min-w-[28px] items-center justify-center rounded-sm border border-zinc-400 bg-white px-1 text-[13px] font-medium text-zinc-900";

  const fontFamilies = [
    "Arial",
    "Calibri",
    "Times New Roman",
    "Georgia",
    "Verdana",
    "Trebuchet MS",
  ] as const;

  const fontSizesPx = [10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 26, 28] as const;
  const [selectedFontFamily, setSelectedFontFamily] = useState<(typeof fontFamilies)[number]>("Arial");
  const [selectedFontSize, setSelectedFontSize] = useState<number>(13);
  const [selectedTextColor, setSelectedTextColor] = useState("#2563eb");
  const [selectedHighlightColor, setSelectedHighlightColor] = useState("#fde047");

  const isCommandActive = (command: Exclude<WritingFormatCommand, "formatBlock">) => {
    const editor = state.editor;
    if (!editor) return false;

    const activeMap: Partial<Record<WritingFormatCommand, boolean>> = {
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      underline: editor.isActive("underline"),
      strikeThrough: editor.isActive("strike"),
      subscript: editor.isActive("subscript"),
      superscript: editor.isActive("superscript"),
      insertUnorderedList: editor.isActive("bulletList"),
      insertOrderedList: editor.isActive("orderedList"),
      justifyLeft: editor.isActive({ textAlign: "left" }),
      justifyCenter: editor.isActive({ textAlign: "center" }),
      justifyRight: editor.isActive({ textAlign: "right" }),
      justifyFull: editor.isActive({ textAlign: "justify" }),
    };

    return Boolean(activeMap[command]);
  };

  const activeBlockTag = (() => {
    const editor = state.editor;
    if (!editor) return "p";
    if (editor.isActive("heading", { level: 1 })) return "h1";
    if (editor.isActive("heading", { level: 2 })) return "h2";
    if (editor.isActive("heading", { level: 3 })) return "h3";
    if (editor.isActive("blockquote")) return "blockquote";
    return "p";
  })();

  return (
    <div className="border-b border-zinc-300 bg-[#f4f4f5] px-3 py-2">
      <div className="flex items-stretch gap-3 overflow-x-auto pb-1">
        <div className="order-1 flex h-[112px] shrink-0 flex-col justify-between border-r border-zinc-300 pr-3">
          <div className="flex min-h-[84px] items-start gap-1 pt-1">
            <button
              type="button"
              onClick={() => void actions.handlePasteFromClipboard()}
              className={iconButtonClass}
              title="Colar"
            >
              <ClipboardPaste size={14} />
            </button>
            <button
              type="button"
              onClick={actions.handleCutSelection}
              className={iconButtonClass}
              title="Recortar"
            >
              <Scissors size={14} />
            </button>
            <button
              type="button"
              onClick={actions.handleCopySelection}
              className={iconButtonClass}
              title="Copiar"
            >
              <ClipboardCopy size={14} />
            </button>
            <button
              type="button"
              onClick={actions.handleSaveLocalDraft}
              className={iconButtonClass}
              title="Salvar"
            >
              <Save size={14} />
            </button>
          </div>
          <span className="text-center text-[11px] text-zinc-600">Área de transferência</span>
        </div>

        <div className="order-2 relative flex h-[112px] shrink-0 flex-col justify-between border-r border-zinc-300 pr-3">
          <div className="flex min-h-[84px] flex-col gap-1 pt-1">
            <div className="flex items-center gap-1">
            <select
              value={selectedFontFamily}
              onChange={(event) => {
                const nextFont = event.target.value as (typeof fontFamilies)[number];
                setSelectedFontFamily(nextFont);
                actions.applyWritingCommand("fontName", nextFont);
              }}
              className="h-7 min-w-[150px] rounded-sm border border-zinc-300 bg-white px-2 text-[13px] text-zinc-700"
              aria-label="Família da fonte"
            >
              {fontFamilies.map((fontFamily) => (
                <option key={fontFamily} value={fontFamily}>
                  {fontFamily}
                </option>
              ))}
            </select>

            <select
              value={selectedFontSize}
              onChange={(event) => {
                const nextSize = Number(event.target.value);
                setSelectedFontSize(nextSize);
                actions.applyWritingCommand("fontSize", `${nextSize}px`);
              }}
              className="h-7 min-w-[64px] rounded-sm border border-zinc-300 bg-white px-2 text-[13px] text-zinc-700"
              aria-label="Tamanho da fonte"
            >
              {fontSizesPx.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            </div>

            <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => actions.applyWritingCommand("bold")}
              className={isCommandActive("bold") ? fontCommandButtonActiveClass : fontCommandButtonClass}
              title="Negrito"
              aria-label="Negrito"
            >
              <Bold size={15} />
            </button>
            <button
              type="button"
              onClick={() => actions.applyWritingCommand("italic")}
              className={isCommandActive("italic") ? fontCommandButtonActiveClass : fontCommandButtonClass}
              title="Itálico"
              aria-label="Itálico"
            >
              <Italic size={15} />
            </button>
            <button
              type="button"
              onClick={() => actions.applyWritingCommand("underline")}
              className={isCommandActive("underline") ? fontCommandButtonActiveClass : fontCommandButtonClass}
              title="Sublinhado"
              aria-label="Sublinhado"
            >
              <Underline size={15} />
            </button>
            <button
              type="button"
              onClick={() => actions.applyWritingCommand("strikeThrough")}
              className={isCommandActive("strikeThrough") ? fontCommandButtonActiveClass : fontCommandButtonClass}
              title="Tachado"
              aria-label="Tachado"
            >
              <Strikethrough size={15} />
            </button>
            <button
              type="button"
              onClick={() => actions.applyWritingCommand("subscript")}
              className={isCommandActive("subscript") ? fontCommandButtonActiveClass : fontCommandButtonClass}
              title="Subscrito"
              aria-label="Subscrito"
            >
              x2
            </button>
            <button
              type="button"
              onClick={() => actions.applyWritingCommand("superscript")}
              className={isCommandActive("superscript") ? fontCommandButtonActiveClass : fontCommandButtonClass}
              title="Sobrescrito"
              aria-label="Sobrescrito"
            >
              x²
            </button>
            </div>

            <div className="mb-1 flex items-center gap-0.5">
            <label className={`${fontCommandButtonClass} cursor-pointer gap-1`} title="Cor da fonte">
              <span className="text-[15px] leading-none">A</span>
              <span className="h-[2px] w-4 rounded-sm" style={{ backgroundColor: selectedTextColor }} />
              <input
                type="color"
                value={selectedTextColor}
                onChange={(event) => {
                  const nextColor = event.target.value;
                  setSelectedTextColor(nextColor);
                  actions.applyWritingCommand("foreColor", nextColor);
                }}
                className="h-0 w-0 opacity-0"
                aria-label="Selecionar cor da fonte"
              />
            </label>

            <label className={`${fontCommandButtonClass} cursor-pointer gap-1`} title="Cor de realce">
              <span className="text-[13px] leading-none">H</span>
              <span className="h-[2px] w-4 rounded-sm" style={{ backgroundColor: selectedHighlightColor }} />
              <input
                type="color"
                value={selectedHighlightColor}
                onChange={(event) => {
                  const nextColor = event.target.value;
                  setSelectedHighlightColor(nextColor);
                  actions.applyWritingCommand("hiliteColor", nextColor);
                }}
                className="h-0 w-0 opacity-0"
                aria-label="Selecionar cor de realce"
              />
            </label>

            <button
              type="button"
              onClick={() => actions.applyWritingCommand("removeFormat")}
              className={fontCommandButtonClass}
              title="Limpar formatação"
              aria-label="Limpar formatação"
            >
              <Eraser size={15} />
            </button>
            <button
              type="button"
              onClick={() => actions.applyWritingCommand("increaseFontSize")}
              className={fontCommandButtonClass}
              title="Aumentar fonte"
              aria-label="Aumentar fonte"
            >
              A^
            </button>
            <button
              type="button"
              onClick={() => actions.applyWritingCommand("decreaseFontSize")}
              className={fontCommandButtonClass}
              title="Diminuir fonte"
              aria-label="Diminuir fonte"
            >
              A?
            </button>
            <button
              type="button"
              onClick={() => actions.applyWritingCommand("formatBlock", "<p>")}
              className={fontCommandButtonClass}
              title="Parágrafo padrão"
              aria-label="Parágrafo padrão"
            >
              Aa
            </button>
            </div>
          </div>
          <div className="relative h-5">
            <span className="block text-center text-[11px] text-zinc-600">Fonte</span>
            <ArrowDownRight
              size={12}
              strokeWidth={2.1}
              className="absolute right-0 top-1/2 -translate-y-1/2 text-[#a83fbe]"
              aria-hidden="true"
            />
          </div>
        </div>

        <div className="relative flex h-[112px] shrink-0 flex-col justify-between border-r border-zinc-300 pr-3">
          <div className="grid min-h-[84px] grid-cols-4 content-start gap-1 pt-1">
            <button
              type="button"
              onClick={() => actions.applyWritingCommand("insertUnorderedList")}
              className={isCommandActive("insertUnorderedList") ? activeIconButtonClass : iconButtonClass}
              title="Lista com marcadores"
              aria-label="Lista com marcadores"
            >
              <List size={14} />
            </button>
            <button
              type="button"
              onClick={() => actions.applyWritingCommand("insertOrderedList")}
              className={isCommandActive("insertOrderedList") ? activeIconButtonClass : iconButtonClass}
              title="Lista numerada"
              aria-label="Lista numerada"
            >
              <ListOrdered size={14} />
            </button>
            <button
              type="button"
              onClick={() => actions.applyWritingCommand("outdent")}
              className={iconButtonClass}
              title="Diminuir recuo"
              aria-label="Diminuir recuo"
            >
              <IndentDecrease size={14} />
            </button>
            <button
              type="button"
              onClick={() => actions.applyWritingCommand("indent")}
              className={iconButtonClass}
              title="Aumentar recuo"
              aria-label="Aumentar recuo"
            >
              <IndentIncrease size={14} />
            </button>
            <button
              type="button"
              onClick={() => actions.applyWritingCommand("justifyLeft")}
              className={isCommandActive("justifyLeft") ? activeIconButtonClass : iconButtonClass}
              title="Alinhar à esquerda"
              aria-label="Alinhar à esquerda"
            >
              <AlignLeft size={14} />
            </button>
            <button
              type="button"
              onClick={() => actions.applyWritingCommand("justifyCenter")}
              className={isCommandActive("justifyCenter") ? activeIconButtonClass : iconButtonClass}
              title="Centralizar"
              aria-label="Centralizar"
            >
              <AlignCenter size={14} />
            </button>
            <button
              type="button"
              onClick={() => actions.applyWritingCommand("justifyRight")}
              className={isCommandActive("justifyRight") ? activeIconButtonClass : iconButtonClass}
              title="Alinhar à direita"
              aria-label="Alinhar à direita"
            >
              <AlignRight size={14} />
            </button>
            <button
              type="button"
              onClick={() => actions.applyWritingCommand("justifyFull")}
              className={isCommandActive("justifyFull") ? activeIconButtonClass : iconButtonClass}
              title="Justificar"
              aria-label="Justificar"
            >
              <AlignJustify size={14} />
            </button>
          </div>
          <div className="relative h-5">
            <span className="block text-center text-[11px] text-zinc-600">Parágrafo</span>
            <ArrowDownRight
              size={12}
              strokeWidth={2.1}
              className="absolute right-0 top-1/2 -translate-y-1/2 text-[#a83fbe]"
              aria-hidden="true"
            />
          </div>
        </div>

        <div className="flex h-[112px] shrink-0 flex-col justify-between border-r border-zinc-300 pr-3">
          <div className="flex min-h-[84px] items-start gap-1 pt-1">
            <button
              type="button"
              onClick={() => actions.applyWritingCommand("undo")}
              className={iconButtonClass}
              title="Desfazer"
              aria-label="Desfazer"
            >
              <Undo2 size={14} />
            </button>
            <button
              type="button"
              onClick={() => actions.applyWritingCommand("redo")}
              className={iconButtonClass}
              title="Refazer"
              aria-label="Refazer"
            >
              <Redo2 size={14} />
            </button>
            <button
              type="button"
              onClick={() => actions.applyWritingCommand("formatBlock", "<h1>")}
              className={iconButtonClass}
              title="Aplicar título 1"
              aria-label="Aplicar título 1"
            >
              <Heading1 size={14} />
            </button>
            <button
              type="button"
              onClick={() => actions.applyWritingCommand("formatBlock", "<h2>")}
              className={iconButtonClass}
              title="Aplicar título 2"
              aria-label="Aplicar título 2"
            >
              <Heading2 size={14} />
            </button>
            <button
              type="button"
              onClick={() => actions.applyWritingCommand("formatBlock", "<h3>")}
              className={iconButtonClass}
              title="Aplicar título 3"
              aria-label="Aplicar título 3"
            >
              <Heading3 size={14} />
            </button>
            <button
              type="button"
              onClick={() => actions.applyWritingCommand("formatBlock", "<p>")}
              className={iconButtonClass}
              title="Aplicar parágrafo"
              aria-label="Aplicar parágrafo"
            >
              <Type size={14} />
            </button>
            <select
              value={activeBlockTag}
              onChange={(event) => {
                const tag = event.target.value;
                const valueMap: Record<string, string> = {
                  p: "<p>",
                  h1: "<h1>",
                  h2: "<h2>",
                  h3: "<h3>",
                  blockquote: "<blockquote>",
                };
                actions.applyWritingCommand("formatBlock", valueMap[tag] || "<p>");
              }}
              className="h-8 min-w-[130px] rounded-md border border-zinc-300 bg-white px-2 text-xs text-zinc-700"
              aria-label="Estilo de texto"
            >
              <option value="p">Parágrafo</option>
              <option value="h1">Título 1</option>
              <option value="h2">Título 2</option>
              <option value="h3">Título 3</option>
              <option value="blockquote">Citação</option>
            </select>
          </div>
          <span className="text-center text-[11px] text-zinc-600">Estilos</span>
        </div>

        <div className="flex h-[112px] shrink-0 flex-col justify-between border-r border-zinc-300 pr-3">
          <div className="flex min-h-[84px] items-start gap-1 pt-1">
            <button
              type="button"
              onClick={() => void actions.handleCreateWriteProject()}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
              title="Novo projeto"
            >
              <FilePlus2 size={14} />
              Novo projeto
            </button>
            <button
              type="button"
              onClick={() => void actions.handleCreateWriteSection()}
              disabled={!state.writeSession.activeProjectId}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
              title="Nova seção"
            >
              <Pilcrow size={14} />
              Nova seção
            </button>
            <button
              type="button"
              onClick={() => void actions.handleOpenFileFromWindows()}
              disabled={state.isImportingDocument}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60"
              title="Inserir arquivo local"
            >
              <FolderOpen size={14} />
              {state.isImportingDocument ? "Importando..." : "Inserir arquivo"}
            </button>
          </div>
          <span className="text-center text-[11px] text-zinc-600">Documento</span>
        </div>

        <div className="flex h-[112px] shrink-0 flex-col justify-between border-r border-zinc-300 pr-3">
          <div className="flex min-h-[84px] items-start gap-1 pt-1">
            <select
              value={state.writeSession.activeProjectId ?? ""}
              onChange={(event) => {
                const nextProjectId = event.target.value;
                if (!nextProjectId) return;
                void actions.openWriteProjectSession(nextProjectId, null);
              }}
              className="h-8 min-w-[190px] rounded-md border border-zinc-300 bg-white px-2 text-xs text-zinc-700"
              aria-label="Selecionar projeto de escrita"
            >
              {!state.writeProjects.length ? <option value="">Sem projetos</option> : null}
              {state.writeProjects.map((project: WriteProjectListItem) => (
                <option key={project.project_id} value={project.project_id}>
                  {project.title}
                </option>
              ))}
            </select>
            <select
              value={state.writeSession.activeSectionId ?? ""}
              onChange={(event) => {
                const nextSectionId = event.target.value;
                if (!nextSectionId) return;
                void actions.handleSelectWriteSection(nextSectionId);
              }}
              className="h-8 min-w-[170px] rounded-md border border-zinc-300 bg-white px-2 text-xs text-zinc-700"
              aria-label="Selecionar seção ativa"
              disabled={!state.writeSession.loadedSections.length}
            >
              {!state.writeSession.loadedSections.length ? <option value="">Sem seções</option> : null}
              {state.writeSession.loadedSections.map((section: WriteSectionView) => (
                <option key={section.section_id} value={section.section_id}>
                  {section.order + 1}. {section.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void actions.refreshWriteProjects()}
              className={iconButtonClass}
              aria-label="Atualizar projetos"
              title="Atualizar projetos"
            >
              <RefreshCw size={14} />
            </button>
          </div>
          <span className="text-center text-[11px] text-zinc-600">Projeto e seção</span>
        </div>

        <div className="ml-auto hidden items-center gap-2 self-start pt-1 text-xs md:flex">
          <span className={`rounded-full border px-2 py-0.5 font-medium ${state.documentStateClass}`}>
            {state.documentStateLabel}
          </span>
          {state.importedDocument ? (
            <span
              className="max-w-[240px] truncate rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 font-medium text-blue-700"
              title={`${state.importedDocument.fileName} • ${formatFileSize(state.importedDocument.fileSize)}`}
            >
              <FileUp size={12} className="mr-1 inline" />
              {state.importedDocument.fileName}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * ============================================================================
 * BARRA DE FORMATAÇÃO LEGADO (RESERVA)
 * ============================================================================
 */

function KnexWriterFormatToolbar({ state, actions }: Pick<WriterRenderProps, "state" | "actions">) {
  return (
    <div className="flex h-12 items-center border-b border-zinc-300 bg-white px-5 lg:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => actions.applyWritingCommand("formatBlock", "<h1>")}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-zinc-300 px-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
        >
          <Heading1 size={14} />
          Título
        </button>

        <button
          type="button"
          onClick={() => actions.applyWritingCommand("bold")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 text-zinc-700 hover:bg-zinc-100"
          aria-label="Negrito"
        >
          <Bold size={14} />
        </button>

        <button
          type="button"
          onClick={() => actions.applyWritingCommand("italic")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 text-zinc-700 hover:bg-zinc-100"
          aria-label="Itálico"
        >
          <Italic size={14} />
        </button>

        <button
          type="button"
          onClick={() => actions.applyWritingCommand("underline")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 text-zinc-700 hover:bg-zinc-100"
          aria-label="Sublinhado"
        >
          <Underline size={14} />
        </button>

        <button
          type="button"
          onClick={() => actions.applyWritingCommand("insertUnorderedList")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 text-zinc-700 hover:bg-zinc-100"
          aria-label="Lista"
        >
          <List size={14} />
        </button>

        <button
          type="button"
          onClick={() => actions.applyWritingCommand("insertOrderedList")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 text-zinc-700 hover:bg-zinc-100"
          aria-label="Lista numerada"
        >
          <ListOrdered size={14} />
        </button>

        <button
          type="button"
          onClick={() => actions.applyWritingCommand("formatBlock", "<blockquote>")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 text-zinc-700 hover:bg-zinc-100"
          aria-label="Bloco de citação"
        >
          <Minus size={14} />
        </button>
      </div>

      <div className="ml-auto hidden items-center gap-2 text-xs text-zinc-500 lg:flex">
        <Sparkles size={14} />
        <span>{state.analysisStatusLabel}</span>
      </div>
    </div>
  );
}

/**
 * ============================================================================
 * ABA LATERAL ESQUERDA
 * ============================================================================
 */

export function KnexWriterLeftSidebar({ state, actions }: Pick<WriterRenderProps, "state" | "actions">) {
  if (state.isWritingNavCollapsed) {
    return (
      <button
        type="button"
        onClick={() => actions.setIsWritingNavCollapsed(false)}
        className="flex w-9 shrink-0 items-center justify-center border-r border-zinc-300 bg-[#f7f7f8] hover:bg-zinc-200"
        aria-label="Expandir navegação"
      >
        <ChevronRight size={16} />
      </button>
    );
  }

  return (
    <aside
      className="relative flex min-h-0 shrink-0 flex-col border-r border-zinc-300 bg-[#f7f7f8]"
      style={{ width: `${state.writingNavWidthPercent}%` }}
    >
      <div className="flex h-11 items-center justify-between border-b border-zinc-300 px-3">
        <span className="text-sm font-semibold text-zinc-700">Navegação textual</span>

        <button
          type="button"
          onClick={() => actions.setIsWritingNavCollapsed(true)}
          className="rounded-md p-1 hover:bg-zinc-200"
          aria-label="Recolher navegação"
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      <div className="flex gap-1 border-b border-zinc-300 p-2">
        {[
          { value: "titles", label: "Títulos" },
          { value: "pages", label: "Páginas" },
          { value: "results", label: "IA" },
        ].map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => actions.setWritingNavTab(tab.value as WritingNavTab)}
            className={`flex-1 rounded-md px-2 py-1 text-xs font-medium ${
              state.writingNavTab === tab.value ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-2">
        <div className="flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-2">
          <Search size={14} className="text-zinc-400" />
          <input
            value={state.writingNavQuery}
            onChange={(event) => actions.setWritingNavQuery(event.target.value)}
            placeholder="Buscar..."
            className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {state.writingNavTab === "titles" ? (
          state.writingFilteredHeadings.length ? (
            <div className="space-y-1">
              {state.writingFilteredHeadings.map((heading: HeadingItem, index: number) => (
                <button
                  key={`${heading.text}-${index}`}
                  type="button"
                  onClick={() => actions.jumpToWritingHeading(heading.text)}
                  className="block w-full rounded-md px-2 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-200"
                  style={{ paddingLeft: `${Math.min(24, heading.level * 8)}px` }}
                >
                  {heading.text}
                </button>
              ))}
            </div>
          ) : (
            <EmptyPanel
              title="Nenhum título encontrado ainda."
              description="Digite títulos no editor para navegar pela estrutura."
            />
          )
        ) : null}

        {state.writingNavTab === "pages" ? (
          <div className="space-y-1">
            {state.writingPages.map((page: number) => (
              <button
                key={`page-${page}`}
                type="button"
                onClick={() => actions.jumpToWritingPage(page)}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm ${
                  state.writingActivePage === page
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                <span>Página {page}</span>
                <span className="text-xs opacity-70">
                  {Math.round((state.writingPageFillRatios[page - 1] ?? 0) * 100)}%
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {state.writingNavTab === "results" ? (
          <div className="space-y-3 text-sm text-zinc-600">
            <InfoCard
              title="Instrução atual"
              body={state.writeSession.currentInstruction || "Nenhuma instrução enviada ainda."}
            />

            <InfoCard
              title="Resumo da seção"
              body={
                getSummaryBody(
                  state.writeSession.sectionSummary,
                  "O resumo da seção aparecerá aqui quando disponível.",
                )
              }
            />

            <InfoCard
              title="Resumo global"
              body={
                getSummaryBody(
                  state.writeSession.projectSummary,
                  "O resumo global do projeto aparecerá aqui quando disponível.",
                )
              }
            />
          </div>
        ) : null}
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={actions.startWritingNavResize}
        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-300"
      />
    </aside>
  );
}

/**
 * ============================================================================
 * ABA LATERAL DIREITA
 * ============================================================================
 */

export function KnexWriterRightSidebar({ state, actions }: Pick<WriterRenderProps, "state" | "actions">) {
  if (state.isWritingWorksCollapsed) {
    return null;
  }

  return (
    <OrganizationPanel
      widthPercent={state.writingWorksWidthPercent}
      organization={state.organization}
      projects={state.writeProjects}
      sections={state.writeSession.loadedSections}
      contexts={state.contextClusters}
      activeProjectId={state.writeSession.activeProjectId}
      activeSectionId={state.writeSession.activeSectionId}
      importedDocument={state.importedDocument}
      onCollapse={() => actions.setIsWritingWorksCollapsed(true)}
      onResizeStart={actions.startWritingWorksResize}
      onOpenProject={(projectId) => {
        state.organization.setProjectKindForProject(projectId, state.organization.projectKind);
        void actions.openWriteProjectSession(projectId, null);
      }}
      onOpenSection={(sectionId) => void actions.handleSelectWriteSection(sectionId)}
      onOpenFilePicker={() => void actions.handleOpenFileFromWindows()}
      onLinkProjectDirectory={() => void actions.handleLinkProjectDirectory()}
      onLinkSourceFiles={() => void actions.handleLinkSourceFilesFromWindows()}
      onAddManualReference={actions.handleAddManualReference}
      isFileSystemAccessAvailable={state.isFileSystemAccessAvailable}
      onInsertCitationFromSource={actions.insertCitationFromSource}
      onRegisterSourceFile={actions.registerSourceFileFromOrganization}
    />
  );
}

function RightProjects({ state, actions }: Pick<WriterRenderProps, "state" | "actions">) {
  if (!state.writingFilteredProjects.length) {
    return (
      <EmptyPanel
        title="Nenhum projeto encontrado."
        description="Crie um novo projeto para iniciar sua escrita."
      />
    );
  }

  return (
    <div className="space-y-2">
      {state.writingFilteredProjects.map((project: WriteProjectListItem) => (
        <button
          key={project.project_id}
          type="button"
          onClick={() => void actions.openWriteProjectSession(project.project_id, null)}
          className={`block w-full rounded-lg border p-3 text-left text-sm ${
            state.writeSession.activeProjectId === project.project_id
              ? "border-zinc-900 bg-white"
              : "border-zinc-300 bg-white hover:bg-zinc-100"
          }`}
        >
          <p className="font-medium text-zinc-900">{project.title}</p>

          {project.description ? (
            <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{project.description}</p>
          ) : null}

          <p className="mt-2 text-[11px] text-zinc-400">
            Atualizado: {formatDateTime(project.updated_at)}
          </p>
        </button>
      ))}
    </div>
  );
}

function RightSections({ state, actions }: Pick<WriterRenderProps, "state" | "actions">) {
  if (!state.writingFilteredSections.length) {
    return (
      <EmptyPanel
        title="Nenhuma seção encontrada."
        description="Crie uma seção para começar a organizar o documento."
      />
    );
  }

  return (
    <div className="space-y-2">
      {state.writingFilteredSections.map((section: WriteSectionView) => {
        const isActive = section.section_id === state.writeSession.activeSectionId;
        const chunkCount = section.chunks?.length || 0;

        return (
          <button
            key={section.section_id}
            type="button"
            onClick={() => void actions.handleSelectWriteSection(section.section_id)}
            className={`block w-full rounded-lg border p-3 text-left text-sm ${
              isActive ? "border-zinc-900 bg-white" : "border-zinc-300 bg-white hover:bg-zinc-100"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-zinc-900">
                {section.order + 1}. {section.title}
              </p>

              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
                {section.status || "planned"}
              </span>
            </div>

            {section.objective ? (
              <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{section.objective}</p>
            ) : null}

            <p className="mt-2 text-[11px] text-zinc-400">
              {chunkCount} bloco{chunkCount === 1 ? "" : "s"} gerado{chunkCount === 1 ? "" : "s"}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function RightContexts({ state }: Pick<WriterRenderProps, "state">) {
  if (!state.contextClusters.length) {
    return (
      <div className="space-y-3">
        <EmptyPanel
          title="Contextos recorrentes"
          description="Os contextos recorrentes detectados no texto aparecerão aqui."
        />

        <div className="rounded-lg border border-zinc-200 bg-white p-3 text-xs leading-relaxed text-zinc-500">
          <p className="font-semibold text-zinc-700">Preparado para detectar:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Repetição literal e semântica</li>
            <li>Redundância e prolixidade</li>
            <li>Incoerência e contradição</li>
            <li>Retomada útil de ideias</li>
            <li>Baixa progressão argumentativa</li>
          </ul>
        </div>

        {state.analysisError ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {state.analysisError}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {state.contextClusters.map((cluster: KnexWriterContextCluster) => (
        <article key={cluster.id} className="rounded-lg border border-zinc-300 bg-white p-3 text-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-zinc-900">{cluster.label}</h3>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">{cluster.summary}</p>
            </div>

            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${SEVERITY_CLASS[cluster.severity]}`}>
              {SEVERITY_LABEL[cluster.severity]}
            </span>
          </div>

          <p className="mt-2 text-[11px] font-medium text-zinc-500">
            Ocorrências: {cluster.occurrenceCount}
          </p>

          <div className="mt-3 space-y-2">
            {cluster.occurrences.map((occurrence: KnexWriterContextOccurrence) => (
              <div key={occurrence.id} className="rounded-md border border-zinc-200 bg-zinc-50 p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-zinc-700">
                    {OCCURRENCE_ROLE_LABEL[occurrence.role]}
                  </span>

                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${SEVERITY_CLASS[occurrence.severity]}`}>
                    {SEVERITY_LABEL[occurrence.severity]}
                  </span>
                </div>

                <p className="mt-1 text-[11px] text-zinc-500">
                  {ANALYSIS_KIND_LABEL[occurrence.classification]}
                  {occurrence.lineStart ? ` ? Linha ${occurrence.lineStart}` : ""}
                </p>

                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-zinc-600">
                  {occurrence.excerpt}
                </p>

                {occurrence.suggestion ? (
                  <p className="mt-2 text-xs font-medium text-blue-700">
                    Sugestão: {occurrence.suggestion}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

/**
 * ============================================================================
 * FOOTER COM COMANDO DE IA
 * ============================================================================
 */

export function KnexWriterFooter({ state, actions }: Pick<WriterRenderProps, "state" | "actions">) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  const isGenerateDisabled =
    state.writingStatus === "thinking" ||
    !state.writingPrompt.trim() ||
    !state.writeSession.activeProjectId ||
    !state.writeSession.activeSectionId;

  const handleSendWritingAssist = () => {
    if (isGenerateDisabled) return;

    void actions.sendWritingAssist(state.writingPrompt);
  };

  return (
    <div className="shrink-0">
      <div
        className={`overflow-hidden border-t border-zinc-300 bg-[#ececef] transition-all duration-300 ${
          isCollapsed ? "max-h-0 opacity-0" : "max-h-64 opacity-100"
        }`}
        aria-hidden={isCollapsed}
      >
        <div className="px-6 py-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <label htmlFor="writing-assist-input" className="text-sm font-medium text-zinc-700">
              Assistente de IA para escrita
            </label>

            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-medium ${
                  state.writingStatus === "thinking"
                    ? "border border-blue-300 bg-blue-50 px-2 py-0.5 text-blue-700"
                    : "text-zinc-500"
                }`}
              >
                {state.writingStatus === "thinking" ? "Pensando..." : state.analysisStatusLabel}
              </span>

              <button
                type="button"
                className="inline-flex h-7 items-center rounded-md border border-zinc-300 bg-white px-2 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-50"
                onClick={() => setIsCollapsed(true)}
              >
                Fechar
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              id="writing-assist-input"
              type="text"
              value={state.writingPrompt}
              onChange={(event) => actions.setWritingPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleSendWritingAssist();
                }
              }}
              placeholder="Ex: reescreva com tom acadêmico, organize a ideia ou melhore a coesão..."
              className="h-10 min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-800 outline-none transition placeholder:text-zinc-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />

            <button
              type="button"
              onClick={handleSendWritingAssist}
              disabled={isGenerateDisabled}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-900 bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:border-zinc-300 disabled:bg-zinc-200 disabled:text-zinc-500"
            >
              {state.writingStatus === "thinking" ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Enviar
            </button>
          </div>

          {!state.writeSession.activeProjectId || !state.writeSession.activeSectionId ? (
            <p className="mt-2 text-xs text-amber-700">
              Abra ou crie um projeto e uma seção para usar o assistente de escrita com salvamento contextual.
            </p>
          ) : null}

          {state.writingNotice ? <p className="mt-2 text-sm text-emerald-700">{state.writingNotice}</p> : null}
          {state.writingError ? <p className="mt-2 text-sm text-rose-600">{state.writingError}</p> : null}
          {state.writeSession.saveError ? (
            <p className="mt-2 text-sm text-rose-600">{state.writeSession.saveError}</p>
          ) : null}
        </div>
      </div>

      <div className="flex h-9 items-center justify-between border-t border-zinc-300 bg-[#e2e2e4] px-4 text-sm text-zinc-700">
        <div className="flex min-w-0 items-center gap-6">
          <button
            type="button"
            onClick={() => setIsCollapsed((current) => !current)}
            className="inline-flex items-center gap-1 text-zinc-700 hover:text-zinc-900"
            title={isCollapsed ? "Abrir assistente de IA" : "Recolher assistente de IA"}
          >
            {isCollapsed ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            <span className="hidden sm:inline">Assistente de IA</span>
          </button>

          <span suppressHydrationWarning>
            Página {state.writingActivePage} de {state.writingPageCount}
          </span>
          <span suppressHydrationWarning>{state.documentWordCount} palavras</span>
          <span>Português (Brasil)</span>
          <span className="hidden md:inline">Previsões de texto: ativado</span>
          <span className="hidden lg:inline">Acessibilidade: tudo certo</span>
        </div>

        <div className="flex shrink-0 items-center gap-5 text-zinc-700">
          <button type="button" className="hidden hover:text-zinc-900 md:inline">
            Exibir Configurações
          </button>
          <button type="button" className="hidden hover:text-zinc-900 md:inline">
            Foco
          </button>
          <span className="hidden items-center gap-2 md:inline-flex">
            <button
              type="button"
              onClick={() =>
                actions.setWritingCanvasZoomPercent((current) =>
                  clampNumber(
                    current - WRITING_CANVAS_ZOOM_STEP_PERCENT,
                    WRITING_CANVAS_ZOOM_MIN_PERCENT,
                    WRITING_CANVAS_ZOOM_MAX_PERCENT,
                  ),
                )
              }
              className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-300 bg-white hover:bg-zinc-100"
              aria-label="Diminuir zoom da página"
            >
              <Minus size={12} />
            </button>
            <input
              type="range"
              min={WRITING_CANVAS_ZOOM_MIN_PERCENT}
              max={WRITING_CANVAS_ZOOM_MAX_PERCENT}
              step={WRITING_CANVAS_ZOOM_STEP_PERCENT}
              value={state.writingCanvasZoomPercent}
              onChange={(event) =>
                actions.setWritingCanvasZoomPercent(
                  clampNumber(
                    Number(event.currentTarget.value),
                    WRITING_CANVAS_ZOOM_MIN_PERCENT,
                    WRITING_CANVAS_ZOOM_MAX_PERCENT,
                  ),
                )
              }
              className="w-24 accent-zinc-600"
              aria-label="Zoom da página do editor"
            />
            <button
              type="button"
              onClick={() =>
                actions.setWritingCanvasZoomPercent((current) =>
                  clampNumber(
                    current + WRITING_CANVAS_ZOOM_STEP_PERCENT,
                    WRITING_CANVAS_ZOOM_MIN_PERCENT,
                    WRITING_CANVAS_ZOOM_MAX_PERCENT,
                  ),
                )
              }
              className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-300 bg-white hover:bg-zinc-100"
              aria-label="Aumentar zoom da página"
            >
              <Plus size={12} />
            </button>
            <span>{state.writingCanvasZoomPercent}%</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * ============================================================================
 * COMPONENTES AUXILIARES
 * ============================================================================
 */

function EmptyPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-3 text-sm text-zinc-500">
      <p className="font-medium text-zinc-700">{title}</p>
      <p className="mt-1">{description}</p>
    </div>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-zinc-300 bg-white p-3">
      <p className="font-medium text-zinc-800">{title}</p>
      <p className="mt-1">{body}</p>
    </div>
  );
}



