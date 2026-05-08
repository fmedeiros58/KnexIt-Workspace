"use client";

/**
 * ============================================================================
 * TÃTULO DO ARQUIVO
 * ============================================================================
 * Produto: KnexWriter
 * Setor: App funcional / Editor inteligente de escrita assistida por IA
 * Arquivo: knexwriter/web/page.tsx
 * Rota pÃºblica esperada: /knexwriter/web
 *
 * ============================================================================
 * OBJETIVO DA PÃGINA
 * ============================================================================
 * Construir a pÃ¡gina funcional do KnexWriter como produto independente.
 * Esta pÃ¡gina nÃ£o Ã© landing page. Ela Ã© o ambiente real de escrita.
 *
 * A pÃ¡gina Ã© organizada em mÃ³dulos internos, dentro do mesmo arquivo:
 * 1. Header do produto
 * 2. Barra de projeto/documento
 * 3. Barra de formataÃ§Ã£o
 * 4. Aba lateral esquerda de navegaÃ§Ã£o textual
 * 5. Palco central de escrita em formato A4
 * 6. Aba lateral direita de organizaÃ§Ã£o e contextos
 * 7. Footer com comando de IA
 * 8. Renderizador principal da interface
 *
 * ============================================================================
 * PRINCÃPIOS DE ARQUITETURA
 * ============================================================================
 * O KnexWriter cuida da experiÃªncia de escrita:
 * - documento
 * - projeto
 * - seÃ§Ã£o
 * - editor
 * - painÃ©is
 * - estado visual
 * - preparaÃ§Ã£o para anÃ¡lise textual dinÃ¢mica
 *
 * O KnexWriter nÃ£o duplica o ai-system.
 * A IA continua sendo acessada por API, por meio do client local.
 *
 * Import obrigatÃ³rio:
 * from "../../../web/client";
 *
 * ============================================================================
 */

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent as ReactChangeEvent,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
  type SetStateAction,
} from "react";
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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  ClipboardPaste,
  Download,
  Eraser,
  FilePlus2,
  FileText,
  FileUp,
  FolderOpen,
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
  MessageSquare,
  Pilcrow,
  Redo2,
  RefreshCw,
  Save,
  Search,
  Share2,
  Sparkles,
  Scissors,
  Strikethrough,
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
  createSourceCandidateFromFile,
  isFileSystemAccessSupported,
  requestProjectDirectoryAccess,
  requestSourceFilesAccess,
  type FileGuardSourceCandidate,
} from "../file-guard";

/**
 * ============================================================================
 * ESPECIFICAÃ‡Ã•ES AUDITÃVEIS DA PÃGINA
 * ============================================================================
 */

const PAGE_AUDIT = {
  title: "KnexWriter",
  sector: "Editor inteligente de escrita",
  productArea: "KnexSpace One",
  route: "/knexwriter/web",
  purpose: "Escrita assistida por IA com projetos, seÃ§Ãµes, paginaÃ§Ã£o e anÃ¡lise textual futura.",
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

type WritingPageFormat = "a4";

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
  | "help";

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

async function importModuleFromUrl<T = unknown>(url: string): Promise<T | null> {
  if (typeof window === "undefined") return null;

  try {
    return (await import(/* webpackIgnore: true */ url)) as T;
  } catch {
    return null;
  }
}

/**
 * ============================================================================
 * CONSTANTES DE LAYOUT E ANÃLISE
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

const WRITING_PAGE_FORMAT_PRESETS: Record<
  WritingPageFormat,
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

const WRITING_HEADER_DISTANCE_FROM_TOP_PX = 0;
const WRITING_FOOTER_DISTANCE_FROM_BOTTOM_PX = 0;
const WRITING_HEADER_DEFAULT_HEIGHT_PX = cmToPx(3);
const WRITING_FOOTER_DEFAULT_HEIGHT_PX = cmToPx(2);

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
  literal_repetition: "RepetiÃ§Ã£o literal",
  semantic_repetition: "RepetiÃ§Ã£o semÃ¢ntica",
  redundancy: "RedundÃ¢ncia",
  prolixity: "Prolixidade",
  incoherence: "IncoerÃªncia",
  contradiction: "ContradiÃ§Ã£o",
  useful_recall: "Retomada Ãºtil",
  meaning_shift: "Deslocamento de sentido",
  low_argumentative_progression: "Baixa progressÃ£o argumentativa",
};

const OCCURRENCE_ROLE_LABEL: Record<KnexWriterContextOccurrence["role"], string> = {
  primary: "MenÃ§Ã£o primÃ¡ria",
  secondary: "MenÃ§Ã£o secundÃ¡ria",
  tertiary: "MenÃ§Ã£o terciÃ¡ria",
  quaternary: "MenÃ§Ã£o quaternÃ¡ria",
  other: "Outra ocorrÃªncia",
};

const SEVERITY_LABEL: Record<KnexWriterAnalysisSeverity, string> = {
  low: "Baixa",
  medium: "MÃ©dia",
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
  { value: "home", label: "PÃ¡gina Inicial" },
  { value: "insert", label: "Inserir" },
  { value: "design", label: "Design" },
  { value: "layout", label: "Layout" },
  { value: "references", label: "ReferÃªncias" },
  { value: "mailings", label: "CorrespondÃªncias" },
  { value: "review", label: "RevisÃ£o" },
  { value: "view", label: "Exibir" },
  { value: "help", label: "Ajuda" },
];

/**
 * ============================================================================
 * FUNÃ‡Ã•ES UTILITÃRIAS
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

  const headerTopPx = clampNumber(WRITING_HEADER_DISTANCE_FROM_TOP_PX, 0, Math.max(0, pageSettings.heightPx - 1));
  const headerHeightPx = clampNumber(
    WRITING_HEADER_DEFAULT_HEIGHT_PX,
    1,
    Math.max(1, pageSettings.heightPx - headerTopPx),
  );

  const footerHeightPx = clampNumber(
    WRITING_FOOTER_DEFAULT_HEIGHT_PX,
    1,
    Math.max(1, pageSettings.heightPx - 1),
  );
  const footerTopPx = clampNumber(
    pageSettings.heightPx - WRITING_FOOTER_DISTANCE_FROM_BOTTOM_PX - footerHeightPx,
    0,
    Math.max(0, pageSettings.heightPx - footerHeightPx),
  );

  const bodyTopPx = Math.max(marginTopPx, headerTopPx + headerHeightPx);
  const footerBodyLimitPx = Math.min(
    pageSettings.heightPx - marginBottomPx,
    footerTopPx,
  );
  const bodyBottomPx = Math.max(
    marginBottomPx,
    pageSettings.heightPx - footerBodyLimitPx,
  );
  const bodyHeightPx = Math.max(1, pageSettings.heightPx - bodyTopPx - bodyBottomPx);

  return {
    pageWidthPx: pageSettings.widthPx,
    pageHeightPx: pageSettings.heightPx,
    pageGapPx: layout.pageGapPx,
    pageStridePx: layout.pageStridePx,
    marginTopPx,
    marginRightPx,
    marginBottomPx,
    marginLeftPx,
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
      message: "Nenhum projeto ativo. O arquivo serÃ¡ salvo, mas nÃ£o ficarÃ¡ associado a um projeto filtrÃ¡vel.",
    });
  }

  if (!args.title.trim() || args.title.trim() === "Documento sem tÃ­tulo") {
    issues.push({
      severity: "warning",
      message: "O documento ainda estÃ¡ sem tÃ­tulo especÃ­fico.",
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
      message: "HÃ¡ arquivos disponÃ­veis, mas nenhuma referÃªncia usada. Eles nÃ£o entrarÃ£o na bibliografia final.",
    });
  }

  if (args.auditIssueCount > 0) {
    issues.push({
      severity: "warning",
      message: `${args.auditIssueCount} pendÃªncia(s) de referÃªncia serÃ£o registradas no arquivo.`,
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
    : "<p>Nenhuma referÃªncia usada no texto.</p>";
  const issuesHtml = args.guardIssues.length
    ? `<ul>${args.guardIssues.map((issue) => `<li><strong>${escapeHtml(issue.severity)}:</strong> ${escapeHtml(issue.message)}</li>`).join("")}</ul>`
    : "<p>Nenhum guard acionado.</p>";

  return `<section class="knexwriter-save-guard">
  <h2>Metadados KnexWriter</h2>
  <p><strong>Tipo do projeto:</strong> ${escapeHtml(PROJECT_KIND_LABEL[args.projectKind])}</p>
  <p><strong>Estilo de referÃªncias:</strong> ${escapeHtml(args.citationStyle.toUpperCase())}</p>
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
 * Normaliza layout imported mas PRESERVA formataÃ§Ã£o de texto como:
 * font-size, font-family, color, text-align, font-weight, font-style, etc.
 * Apenas remove deslocamentos extremos que quebram a experiÃªncia de ediÃ§Ã£o.
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
    // Estas sÃ£o propriedades essenciais da formataÃ§Ã£o do documento
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
  
  // Detectar pÃ¡ginas/seÃ§Ãµes. docx-preview pode gerar de vÃ¡rias formas:
  // - divs com classe "docx-page"
  // - divs com estilos de pÃ¡gina
  // - seÃ§Ãµes
  const pageLikeNodes = Array.from(
    root.querySelectorAll<HTMLElement>(
      "[class*='docx-page'], [class*='docx_section'], [class*='page-break'], div[style*='page-break'], div[style*='break-after'], section[class*='docx']",
    ),
  );

  let sourceNodes: HTMLElement[] = [];

  // Se encontramos elementos de pÃ¡gina, usÃ¡-los como separadores
  if (pageLikeNodes.length > 0) {
    sourceNodes = pageLikeNodes;
  } else {
    // Caso contrÃ¡rio, usar todos os children como pÃ¡ginas
    sourceNodes = Array.from(root.children) as HTMLElement[];
  }

  // Se nÃ£o tem mÃºltiplas pÃ¡ginas, usar todo o conteÃºdo como uma
  if (sourceNodes.length <= 1) {
    sourceNodes = [root];
  }

  const fragments: string[] = [];

  sourceNodes.forEach((sourceNode) => {
    const clone = sourceNode.cloneNode(true) as HTMLElement;

    // Remover apenas headers/footers, nÃ£o estilos
    clone.querySelectorAll(".docx-header, .docx-footer, header, footer").forEach((node) => node.remove());
    clone.querySelectorAll("[style*='position: fixed']").forEach((node) => node.remove());
    normalizeDocxPreviewFragmentForEditing(clone);

    const html = clone.innerHTML.trim();
    if (!html) return;
    fragments.push(html);
  });

  // Se nÃ£o temos fragmentos, tomar o HTML inteiro
  if (fragments.length === 0) {
    fragments.push(root.innerHTML);
  }

  const pageBreakStyle = '<div data-knexwriter-page-break="true"></div>';
  const combined = fragments.join(pageBreakStyle).trim();

  if (!combined) {
    return normalizeTextToEditableHtml("", title);
  }

  // Normalizar apenas deslocamentos extremos de layout, nÃ£o remover formataÃ§Ã£o
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
      errors.push("CDN carregou, mas window.pdfjsLib nÃ£o ficou disponÃ­vel");
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

  const candidate = (window as unknown as { docxPreview?: unknown }).docxPreview;
  if (!candidate || typeof candidate !== "object") return null;

  const runtime = candidate as Partial<DocxPreviewGlobal>;
  return typeof runtime.renderAsync === "function" ? (runtime as DocxPreviewGlobal) : null;
}

async function loadDocxPreviewGlobal() {
  const existing = getDocxPreviewGlobal();
  if (existing) return existing;
  if (typeof window === "undefined") return null;
  if (cachedDocxPreviewLoadPromise) return cachedDocxPreviewLoadPromise;

  cachedDocxPreviewLoadPromise = (async () => {
    const errors: string[] = [];

    const tryImport = async (importPath: string) => {
      try {
        const loadedModule = (await import(importPath)) as unknown;
        const runtime =
          typeof (loadedModule as Partial<DocxPreviewGlobal>).renderAsync === "function"
            ? (loadedModule as DocxPreviewGlobal)
            : typeof (loadedModule as any)?.default?.renderAsync === "function"
            ? (loadedModule as any).default
            : null;

        if (runtime) {
          return runtime;
        }

        errors.push(`${importPath} carregado sem renderAsync`);
      } catch (error: unknown) {
        errors.push(
          `${importPath}: ${error instanceof Error ? error.message : "erro desconhecido"}`,
        );
      }
      return null;
    };

    const modulePaths = [
      "docx-preview/dist/docx-preview.mjs",
      "docx-preview/dist/docx-preview.min.mjs",
      "docx-preview",
    ];

    for (const path of modulePaths) {
      const runtime = await tryImport(path);
      if (runtime) {
        (window as unknown as { docxPreview?: DocxPreviewGlobal }).docxPreview = runtime;
        lastDocxPreviewLoadError = null;
        return runtime;
      }
    }

    const remoteUrl = `https://cdn.jsdelivr.net/npm/docx-preview@${DOCX_PREVIEW_CDN_VERSION}/dist/docx-preview.mjs`;
    const remoteModule = await importModuleFromUrl<Partial<DocxPreviewGlobal>>(remoteUrl);
    if (remoteModule) {
      const runtime =
        typeof (remoteModule as Partial<DocxPreviewGlobal>).renderAsync === "function"
          ? (remoteModule as DocxPreviewGlobal)
          : typeof (remoteModule as any)?.default?.renderAsync === "function"
          ? (remoteModule as any).default
          : null;

      if (runtime) {
        (window as unknown as { docxPreview?: DocxPreviewGlobal }).docxPreview = runtime;
        lastDocxPreviewLoadError = null;
        return runtime;
      }

      errors.push(`${remoteUrl} carregado sem renderAsync`);
    } else {
      errors.push(`${remoteUrl} nÃ£o pÃ´de ser importado via CDN`);
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
      errors.push("CDN carregou, mas window.mammoth nÃ£o ficou disponÃ­vel");
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
        ? ` Detalhe tÃ©cnico: ${lastPdfJsLoadError.slice(0, 360)}.`
        : "";

    return {
      html: normalizeTextToEditableHtml(
        [
          `Arquivo PDF selecionado: ${file.name}.`,
          "A pÃ¡gina estÃ¡ pronta para converter PDF em documento editÃ¡vel, mas o conversor PDF ainda nÃ£o foi carregado no navegador.",
          "Para conversÃ£o completa, registre window.pdfjsLib por meio de pdfjs-dist ou encaminhe este arquivo para um endpoint de conversÃ£o no backend.",
          detail.trim(),
        ].join("\n\n"),
        getBaseFileName(file.name),
      ),
      warning:
        `PDF selecionado. Para extrair e renderizar todo o conteÃºdo, carregue pdfjsLib no cliente ou use um endpoint server-side de conversÃ£o.${detail}`,
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

    pages.push(pageText ? `PÃ¡gina ${pageNumber}\n${pageText}` : `PÃ¡gina ${pageNumber}`);
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
            ? "DOCX aberto com renderizaÃ§Ã£o alternativa. A fidelidade visual pode variar."
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
  const detail = detailParts.length ? ` Detalhe tÃ©cnico: ${detailParts.join(" | ").slice(0, 360)}.` : "";

  return {
    html: normalizeTextToEditableHtml(
      [
        `Arquivo DOCX selecionado: ${file.name}.`,
        "A pÃ¡gina estÃ¡ pronta para renderizar DOCX completo, mas o conversor DOCX ainda nÃ£o foi carregado no navegador.",
        "Para conversÃ£o completa, use docx-preview ou mammoth no cliente, ou um endpoint server-side de conversÃ£o.",
      ].join("\n\n"),
      title,
    ),
    warning: `DOCX selecionado. NÃ£o foi possÃ­vel carregar o conversor local.${detail}`,
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
          "O formato .doc antigo nÃ£o possui leitura nativa segura no navegador.",
          "Para renderizaÃ§Ã£o completa, converta para .docx antes de importar ou encaminhe o arquivo para um endpoint backend com LibreOffice, Pandoc ou serviÃ§o equivalente.",
        ].join("\n\n"),
        getBaseFileName(file.name),
      ),
      conversionMode: "legacy-doc-placeholder",
      warning:
        "DOC antigo selecionado. Para renderizaÃ§Ã£o completa, converta para DOCX ou use um conversor server-side.",
    };
  }

  return {
    html: normalizeTextToEditableHtml(
      [
        `Arquivo selecionado: ${file.name}.`,
        "Formato ainda nÃ£o suportado para renderizaÃ§Ã£o completa no palco.",
      ].join("\n\n"),
      getBaseFileName(file.name),
    ),
    conversionMode: "unsupported",
    warning: "Formato nÃ£o suportado para importaÃ§Ã£o completa.",
  };
}

/**
 * ============================================================================
 * COMPONENTE PRINCIPAL DA PÃGINA
 * ============================================================================
 * Este componente concentra estado, efeitos e integraÃ§Ã£o com API.
 * A renderizaÃ§Ã£o visual fica abaixo, em KnexWriterRender.
 */

export function KnexWriterShell() {
  const writingPageFormat = "a4" as WritingPageFormat;
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

  const [writingTitle, setWritingTitle] = useState("Documento sem tÃ­tulo");
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
    const pageSize = getA4PageSize("portrait");

    return {
      format: "a4",
      orientation: "portrait",
      widthCm: pageSize.widthCm,
      heightCm: pageSize.heightCm,
      widthPx: writingPagePreset.widthPx,
      heightPx: writingPagePreset.heightPx,
      margins: {
        topPx: cmToPx(2.5),
        rightPx: cmToPx(2.5),
        bottomPx: cmToPx(2.5),
        leftPx: cmToPx(3),
      },
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
    pagePaddingTopPx: pageSettings.margins.topPx,
    pagePaddingBottomPx: pageSettings.margins.bottomPx,
    bottomClearancePx: writingPagePreset.bottomClearancePx,
  };

  const writingPaginationGeometry = getWritingPaginationGeometry(pageSettings, layoutMetrics);

  const [contextClusters, setContextClusters] = useState<KnexWriterContextCluster[]>([]);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>("idle");
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [importedDocument, setImportedDocument] = useState<ImportedDocumentState | null>(null);
  const [isImportingDocument, setIsImportingDocument] = useState(false);
  const organization = useOrganizationStore();

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
    setWritingNotice("Projeto ativo limpo porque nÃ£o pertence ao tipo de projeto selecionado.");
  }, [organization.projectKind, organization.projectKindsById, writeSession.activeProjectId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const rawSettings = window.localStorage.getItem(KNEXWRITER_DOCUMENT_SETTINGS_STORAGE_KEY);
    if (!rawSettings) return;

    try {
      const parsed = JSON.parse(rawSettings) as Partial<{
        pageSettings: WriterPageSettings;
        paragraphIndents: ParagraphIndents;
        tabStops: TabStop[];
        tabStopInsertType: TabStopType;
        rulerSettings: RulerSettings;
        zoomPercent: number;
      }>;

      if (parsed.pageSettings?.margins) {
        setPageSettings((current) => ({
          ...current,
          ...parsed.pageSettings,
          margins: {
            ...current.margins,
            ...parsed.pageSettings?.margins,
          },
        }));
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
    if (writeSession.hasUnsavedChanges) return "AlteraÃ§Ãµes locais";
    return "Sincronizado";
  }, [writeSession.hasUnsavedChanges, writeSession.isGenerating, writeSession.isSaving]);

  const documentStateClass = useMemo(() => {
    if (writeSession.isGenerating) return "border-blue-300 bg-blue-50 text-blue-700";
    if (writeSession.isSaving) return "border-zinc-300 bg-zinc-50 text-zinc-700";
    if (writeSession.hasUnsavedChanges) return "border-amber-300 bg-amber-50 text-amber-700";
    return "border-emerald-300 bg-emerald-50 text-emerald-700";
  }, [writeSession.hasUnsavedChanges, writeSession.isGenerating, writeSession.isSaving]);

  const analysisStatusLabel = useMemo(() => {
    if (analysisStatus === "scheduled") return "AnÃ¡lise em espera";
    if (analysisStatus === "analyzing") return "Analisando";
    if (analysisStatus === "error") return "Erro na anÃ¡lise";
    return "AnÃ¡lise passiva pronta";
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

        return `pÃ¡gina ${page}`.includes(query) || `pagina ${page}`.includes(query) || String(page).includes(query);
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
        subtitle: activeProject ? `SeÃ§Ã£o de ${activeProject.title}` : "SeÃ§Ã£o ativa",
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
          title: "Documento sem tÃ­tulo",
          subtitle: "Comece a escrever no KnexWriter",
          source: "fallback",
          updatedAt: nowIso,
          previewHtml: "<p><br /></p>",
        },
        {
          id: "fallback:project",
          title: "Projeto atual do KnexWriter",
          subtitle: "Crie um projeto para organizar capÃ­tulos",
          source: "fallback",
          updatedAt: nowIso,
        },
        {
          id: "fallback:import",
          title: "Ãšltimo arquivo importado",
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

    if (!writingScrollRef.current || !writingPageRootRef.current) return;

    const zoomScale = Math.max(0.5, writingCanvasZoomPercent / 100);
    const relativeTop = Math.max(
      0,
      (writingScrollRef.current.scrollTop - writingPageRootRef.current.offsetTop) / zoomScale,
    );

    const visiblePage = clampNumber(
      Math.floor(relativeTop / geometry.pageStridePx) + 1,
      1,
      nextPageCount,
    );

    setWritingActivePage((current: number) =>
      current === visiblePage ? current : visiblePage,
    );
  }, [
    writingCanvasZoomPercent,
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

      setWritingPageCount((current) =>
        current === nextPageCount ? current : nextPageCount,
      );

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

      setWritingActivePage((current) => clampNumber(current, 1, nextPageCount));
    },
    [],
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

  const handleChangeParagraphIndents = useCallback(
    (nextIndents: ParagraphIndents) => {
      const firstLineChanged = Math.abs(nextIndents.firstLinePx - paragraphIndents.firstLinePx) > 0.5;
      const hangingChanged = Math.abs(nextIndents.hangingPx - paragraphIndents.hangingPx) > 0.5;
      const rightChanged = Math.abs(nextIndents.rightPx - paragraphIndents.rightPx) > 0.5;
      const leftChanged = Math.abs(nextIndents.leftPx - paragraphIndents.leftPx) > 0.5;

      let guideX = pageSettings.margins.leftPx + nextIndents.leftPx;
      let guideLabel = `Recuo esquerdo: ${formatRulerCentimeters(nextIndents.leftPx)}`;
      let mode: RulerGuideState["mode"] = "indent-left";

      if (firstLineChanged) {
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
          label: `TabulaÃ§Ã£o: ${formatRulerCentimeters(changedTabStop.positionPx - pageSettings.margins.leftPx)}`,
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
       * Nesta etapa, a funÃ§Ã£o apenas prepara debounce seguro.
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
            console.warn("[KnexWriter] toggleParagraphMarks ainda nÃ£o possui renderizaÃ§Ã£o de marcas no editor atual.");
            break;
          case "openParagraphDialog":
            console.warn("[KnexWriter] openParagraphDialog ainda nÃ£o estÃ¡ implementado.");
            break;
          case "sortParagraphsAscending":
            console.warn("[KnexWriter] sortParagraphsAscending ainda nÃ£o implementado.");
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
        setWritingError("Selecione um projeto antes de usar uma fonte como referÃªncia.");
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
          `CitaÃ§Ã£o vinculada a ${result.reference.title}.`;
        const citationHtml =
          input.usageType === "direct_quote"
            ? `<blockquote><p>${escapeHtml(citationText)}</p></blockquote>`
            : `<p>${escapeHtml(citationText)}</p>`;

        editor.chain().focus().insertContent(citationHtml).run();
        syncEditorFromTipTap(editor);
      }

      setWritingNotice("Fonte vinculada ao texto e adicionada Ã s referÃªncias usadas.");
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
        setWritingError("Selecione um projeto antes de vincular texto a uma referÃªncia.");
        return;
      }

      organization.linkSelectedTextToReference({
        ...input,
        projectId: activeProjectId,
        sectionId: input.sectionId ?? writeSession.activeSectionId ?? undefined,
      });
      setWritingNotice("Texto selecionado vinculado Ã  referÃªncia.");
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
      setWritingNotice("Arquivo registrado como fonte disponÃ­vel do projeto.");
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
        setWritingNotice("As fontes selecionadas jÃ¡ estavam vinculadas ao projeto.");
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
          setWritingError("NÃ£o foi possÃ­vel copiar o trecho selecionado.");
        });
      return;
    }

    setWritingError("CÃ³pia indisponÃ­vel neste navegador.");
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
          setWritingError("NÃ£o foi possÃ­vel recortar o trecho selecionado.");
        });
      return;
    }

    setWritingError("Recorte indisponÃ­vel neste navegador.");
  }, [focusWritingEditor, syncEditorFromTipTap]);

  const handlePasteFromClipboard = useCallback(async () => {
    const editor = focusWritingEditor();
    if (!editor || typeof window === "undefined") return;

    if (navigator.clipboard?.readText) {
      try {
        const clipboardText = await navigator.clipboard.readText();
        if (!clipboardText.trim()) {
          setWritingError("A Ã¡rea de transferÃªncia estÃ¡ vazia.");
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

    setWritingError("NÃ£o foi possÃ­vel colar automaticamente. Use Ctrl+V no editor.");
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
        setWritingTitle(project.title || "Documento sem tÃ­tulo");

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
          title: project.title || "Projeto sem tÃ­tulo",
          subtitle: activeLoadedSection?.title || "Projeto de escrita",
          source: "project",
          updatedAt: project.updated_at || new Date().toISOString(),
          projectId: project.project_id,
          sectionId: activeLoadedSection?.section_id || undefined,
          previewHtml: activeLoadedSection ? composeSectionHtml(activeLoadedSection) : undefined,
        });

        if (!activeLoadedSection) {
          setWritingNotice("Projeto carregado sem seÃ§Ãµes. Crie a primeira seÃ§Ã£o para iniciar.");
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
        title: "SeÃ§Ã£o 1",
        order: 0,
        objective: "Definir objetivo desta seÃ§Ã£o.",
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
      setWritingError("Crie ou selecione um projeto antes de criar uma seÃ§Ã£o.");
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
        title: `SeÃ§Ã£o ${nextOrder + 1}`,
        order: nextOrder,
        objective: "Definir objetivo desta seÃ§Ã£o.",
        outline_notes: "",
        status: "planned",
        content: "",
      });

      await openWriteProjectSession(activeProjectId, createdSection.section_id);

      setWritingRightPanelTab("sections");
      setWritingNotice("Nova seÃ§Ã£o criada.");
    } catch (createError: unknown) {
      const message =
        createError instanceof Error ? createError.message : "Falha ao criar nova seÃ§Ã£o.";

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
        title: writingTitle || "Documento sem tÃ­tulo",
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
      setWritingError("NÃ£o foi possÃ­vel salvar o rascunho localmente.");
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
        `Estilo de referÃªncias: ${resolvedOptions.citationStyle.toUpperCase()}`,
        `Arquivos disponÃ­veis: ${projectSourceFiles.length}`,
        `ReferÃªncias usadas: ${usedReferences.length}`,
        `PendÃªncias: ${auditIssues.filter((issue) => issue.severity !== "info").length}`,
        "",
        "Bibliografia final filtrada:",
        ...(formattedReferences.length ? formattedReferences : ["Nenhuma referÃªncia usada no texto."]),
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
        writingTitle.trim() && writingTitle.trim() !== "Documento sem tÃ­tulo"
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
          objective: "ConteÃºdo inicial associado ao salvamento com guard.",
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
          `Backend de projetos indisponÃ­vel (${message}). O arquivo serÃ¡ salvo com um guard local filtrÃ¡vel na OrganizaÃ§Ã£o.`,
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
          ? "DOCX salvo com guards de revisÃ£o registrados."
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
        setWritingError("NÃ£o foi possÃ­vel abrir a janela de impressÃ£o para salvar em PDF.");
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
      setWritingNotice("PDF preparado. Use a janela de impressÃ£o para salvar como PDF.");
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
          ? "CabeÃ§alho ativado para ediÃ§Ã£o."
          : "RodapÃ© ativado para ediÃ§Ã£o.",
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

    setWritingTitle("Documento sem tÃ­tulo");
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
      title: "Documento sem tÃ­tulo",
      subtitle: "Documento em branco criado",
      source: "local",
      updatedAt: new Date().toISOString(),
      previewHtml: emptyHtml,
    });

    closeFileBackstage();
  }, [closeFileBackstage, pushRecentDocument, schedulePassiveAnalysis, syncWritingPagination]);

  const importLocalDocument = useCallback(
    async (file: File) => {
      setIsImportingDocument(true);
      setWritingError(null);
      setWritingNotice(null);

      try {
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
            : "Arquivo importado e renderizado no palco como documento editÃ¡vel.",
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
    [closeFileBackstage, pushRecentDocument, replaceEditorHtml],
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
    setWritingNotice("Cadastro manual de referÃªncia preparado. Informe os metadados na prÃ³xima etapa.");
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
        setWritingError("Crie ou selecione um projeto e uma seÃ§Ã£o antes de gerar texto.");

        setWriteSession((current: WriteEditorSessionState) => ({
          ...current,
          isGenerating: false,
          saveError: "Projeto ou seÃ§Ã£o ausente.",
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
          throw new Error("A API de escrita nÃ£o retornou um bloco de texto vÃ¡lido.");
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
        setWritingNotice("Novo bloco gerado com assistÃªncia de IA.");
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
    const scroller = writingScrollRef.current;

    if (!editor || !scroller) return;

    const updatePagination = () => syncWritingPagination();
    const handleScroll = () => syncWritingPagination();

    updatePagination();

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(updatePagination) : null;

    resizeObserver?.observe(editor);

    scroller.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", updatePagination);

    return () => {
      resizeObserver?.disconnect();
      scroller.removeEventListener("scroll", handleScroll);
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
        handleChangePageMargins,
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
  );
}

/**
 * ============================================================================
 * TIPOS DA RENDERIZAÃ‡ÃƒO
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
  handleChangePageMargins: (nextMargins: PageMargins) => void;
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
 * RENDERIZAÃ‡ÃƒO PRINCIPAL
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
        {!state.isFileBackstageOpen ? (
          <KnexWriterRibbon state={state} actions={actions} />
        ) : null}

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

function KnexWriterWorkspaceNormal({
  refs,
  layout,
  state,
  actions,
}: WriterRenderProps) {
  const leftPanelWidth = state.isWritingNavCollapsed
    ? "0px"
    : `clamp(260px, ${state.writingNavWidthPercent}vw, 520px)`;

  const rightPanelWidth = state.isWritingWorksCollapsed
    ? "0px"
    : `clamp(300px, ${state.writingWorksWidthPercent}vw, 560px)`;

  return (
    <div
      ref={refs.writingWorkspaceRef}
      data-knexwriter-workspace="true"
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
        className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden"
      >
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
    { value: "home" as BackstageTab, label: "PÃ¡gina Inicial", icon: FileText },
    { value: "new" as BackstageTab, label: "Novo", icon: FilePlus2 },
    { value: "open" as BackstageTab, label: "Abrir", icon: FolderOpen },
    { value: "info" as BackstageTab, label: "InformaÃ§Ãµes", icon: Info },
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
            <p className="mt-1 text-xs text-zinc-600">Cria projeto e seÃ§Ã£o inicial para escrita longa.</p>
          </button>
          <button type="button" onClick={() => actions.handleSelectBackstageTab("open")} className="rounded-lg border border-zinc-200 bg-white p-4 text-left hover:bg-zinc-50">
            <p className="text-sm font-semibold text-zinc-900">Abrir arquivo local</p>
            <p className="mt-1 text-xs text-zinc-600">PDF, DOC, DOCX, TXT, HTML e HTM.</p>
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <h3 className="text-lg font-semibold text-zinc-900">Recomendado para vocÃª</h3>
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

        <div className="space-y-1">
          {recentRows.map((document) => (
            <RecentDocumentRow key={`row-${document.id}`} document={document} actions={actions} />
          ))}
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
          <p className="mt-1 text-xs text-zinc-600">MantÃ©m seÃ§Ãµes, objetivos e chunks vinculados ao projeto.</p>
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
      <h2 className="text-2xl font-semibold text-zinc-900">InformaÃ§Ãµes</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <InfoCard title="Documento" body={state.writingTitle || "Documento sem tÃ­tulo"} />
        <InfoCard title="Palavras" body={`${state.documentWordCount}`} />
        <InfoCard title="Projeto ativo" body={state.activeProject?.title || "Nenhum"} />
        <InfoCard title="SeÃ§Ã£o ativa" body={state.activeSection?.title || "Nenhuma"} />
        <InfoCard title="Ãšltima sincronizaÃ§Ã£o" body={formatDateTime(state.writeSession.lastSyncedAt)} />
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
          DOCX e PDF passam por uma etapa de especificidade para registrar guards, tipo de projeto e referÃªncias filtrÃ¡veis.
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
          description="Arquivo interno com filtros, referÃªncias e usos."
          onClick={() => setSelectedFormat("writerModel")}
        />
        <SaveAsFormatCard
          active={selectedFormat === "standardDocx"}
          title="DOCX limpo"
          description="DOCX sem apÃªndice de organizaÃ§Ã£o."
          onClick={() => setSelectedFormat("standardDocx")}
        />
        <SaveAsFormatCard
          active={selectedFormat === "pdf"}
          title="PDF"
          description="Abre impressÃ£o para salvar como PDF."
          onClick={() => setSelectedFormat("pdf")}
        />
        <SaveAsFormatCard
          active={selectedFormat === "html"}
          title="HTML"
          description="ExportaÃ§Ã£o web simples."
          onClick={() => setSelectedFormat("html")}
        />
        <SaveAsFormatCard
          active={selectedFormat === "txt"}
          title="TXT"
          description="Texto puro sem formataÃ§Ã£o."
          onClick={() => setSelectedFormat("txt")}
        />
      </div>

      {usesSpecificityPanel ? (
        <div className="grid gap-4 rounded-xl border border-zinc-200 bg-white p-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">Especificidade do salvamento</h3>
              <p className="mt-1 text-xs text-zinc-500">
                Esses critÃ©rios alimentam os filtros da OrganizaÃ§Ã£o quando o arquivo volta ao fluxo do KnexWriter.
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
                Estilo bibliogrÃ¡fico
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
                Incluir metadados de organizaÃ§Ã£o
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={options.includeReferenceAudit}
                  onChange={(event) => updateOption("includeReferenceAudit", event.target.checked)}
                />
                Incluir guards de referÃªncias
              </label>
            </div>

            <div className="grid gap-2 text-xs md:grid-cols-4">
              <InfoCard title="Arquivos" body={`${projectSourceFiles.length}`} />
              <InfoCard title="ReferÃªncias usadas" body={`${usedReferences.length}`} />
              <InfoCard title="PendÃªncias" body={`${auditIssues.filter((issue) => issue.severity !== "info").length}`} />
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
    fallback: "SugestÃ£o",
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
        {sourceLabel[document.source]} â€¢ {formatDateTime(document.updatedAt)}
      </p>
    </button>
  );
}

function RecentDocumentRow({ document, actions }: { document: WriterRecentDocument; actions: WriterRenderActions }) {
  const sourceLabel: Record<WriterRecentDocument["source"], string> = {
    project: "Projeto",
    imported: "Importado",
    local: "Local",
    fallback: "SugestÃ£o",
  };

  return (
    <button
      type="button"
      onClick={() => void actions.handleOpenRecentDocument(document)}
      className="flex w-full items-center gap-3 rounded-md border border-transparent px-2 py-2 text-left hover:border-zinc-200 hover:bg-zinc-50"
    >
      <FileText size={16} className="shrink-0 text-zinc-500" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-900">{document.title}</p>
        <p className="truncate text-xs text-zinc-500">{document.subtitle || "Documento"}</p>
      </div>
      <span className="text-xs text-zinc-500">{sourceLabel[document.source]}</span>
      <span className="text-xs text-zinc-500">{formatDateTime(document.updatedAt)}</span>
    </button>
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
    Boolean(state.writingTitle?.trim()) && state.writingTitle.trim() !== "Documento sem tÃ­tulo";
  const centeredDocumentLabel = state.importedDocument
    ? `${state.importedDocument.fileName} â€¢ ${state.importedDocument.fileType.toUpperCase()} â€¢ ${formatFileSize(state.importedDocument.fileSize)}`
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
 * RIBBON - PÃGINA INICIAL
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
          <span className="text-center text-[11px] text-zinc-600">Ãrea de transferÃªncia</span>
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
              aria-label="FamÃ­lia da fonte"
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
              title="ItÃ¡lico"
              aria-label="ItÃ¡lico"
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
              xÂ²
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
              title="Limpar formataÃ§Ã£o"
              aria-label="Limpar formataÃ§Ã£o"
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
              title="ParÃ¡grafo padrÃ£o"
              aria-label="ParÃ¡grafo padrÃ£o"
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
              title="Alinhar Ã  esquerda"
              aria-label="Alinhar Ã  esquerda"
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
              title="Alinhar Ã  direita"
              aria-label="Alinhar Ã  direita"
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
            <span className="block text-center text-[11px] text-zinc-600">ParÃ¡grafo</span>
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
              title="Aplicar tÃ­tulo 1"
              aria-label="Aplicar tÃ­tulo 1"
            >
              <Heading1 size={14} />
            </button>
            <button
              type="button"
              onClick={() => actions.applyWritingCommand("formatBlock", "<h2>")}
              className={iconButtonClass}
              title="Aplicar tÃ­tulo 2"
              aria-label="Aplicar tÃ­tulo 2"
            >
              <Heading2 size={14} />
            </button>
            <button
              type="button"
              onClick={() => actions.applyWritingCommand("formatBlock", "<h3>")}
              className={iconButtonClass}
              title="Aplicar tÃ­tulo 3"
              aria-label="Aplicar tÃ­tulo 3"
            >
              <Heading3 size={14} />
            </button>
            <button
              type="button"
              onClick={() => actions.applyWritingCommand("formatBlock", "<p>")}
              className={iconButtonClass}
              title="Aplicar parÃ¡grafo"
              aria-label="Aplicar parÃ¡grafo"
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
              <option value="p">ParÃ¡grafo</option>
              <option value="h1">TÃ­tulo 1</option>
              <option value="h2">TÃ­tulo 2</option>
              <option value="h3">TÃ­tulo 3</option>
              <option value="blockquote">CitaÃ§Ã£o</option>
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
              title="Nova seÃ§Ã£o"
            >
              <Pilcrow size={14} />
              Nova seÃ§Ã£o
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
              aria-label="Selecionar seÃ§Ã£o ativa"
              disabled={!state.writeSession.loadedSections.length}
            >
              {!state.writeSession.loadedSections.length ? <option value="">Sem seÃ§Ãµes</option> : null}
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
          <span className="text-center text-[11px] text-zinc-600">Projeto e seÃ§Ã£o</span>
        </div>

        <div className="ml-auto hidden items-center gap-2 self-start pt-1 text-xs md:flex">
          <span className={`rounded-full border px-2 py-0.5 font-medium ${state.documentStateClass}`}>
            {state.documentStateLabel}
          </span>
          {state.importedDocument ? (
            <span
              className="max-w-[240px] truncate rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 font-medium text-blue-700"
              title={`${state.importedDocument.fileName} â€¢ ${formatFileSize(state.importedDocument.fileSize)}`}
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
 * BARRA DE FORMATAÃ‡ÃƒO LEGADO (RESERVA)
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
          TÃ­tulo
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
          aria-label="ItÃ¡lico"
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
          aria-label="Bloco de citaÃ§Ã£o"
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
        aria-label="Expandir navegaÃ§Ã£o"
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
        <span className="text-sm font-semibold text-zinc-700">NavegaÃ§Ã£o textual</span>

        <button
          type="button"
          onClick={() => actions.setIsWritingNavCollapsed(true)}
          className="rounded-md p-1 hover:bg-zinc-200"
          aria-label="Recolher navegaÃ§Ã£o"
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      <div className="flex gap-1 border-b border-zinc-300 p-2">
        {[
          { value: "titles", label: "TÃ­tulos" },
          { value: "pages", label: "PÃ¡ginas" },
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
              title="Nenhum tÃ­tulo encontrado ainda."
              description="Digite tÃ­tulos no editor para navegar pela estrutura."
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
                <span>PÃ¡gina {page}</span>
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
              title="InstruÃ§Ã£o atual"
              body={state.writeSession.currentInstruction || "Nenhuma instruÃ§Ã£o enviada ainda."}
            />

            <InfoCard
              title="Resumo da seÃ§Ã£o"
              body={
                getSummaryBody(
                  state.writeSession.sectionSummary,
                  "O resumo da seÃ§Ã£o aparecerÃ¡ aqui quando disponÃ­vel.",
                )
              }
            />

            <InfoCard
              title="Resumo global"
              body={
                getSummaryBody(
                  state.writeSession.projectSummary,
                  "O resumo global do projeto aparecerÃ¡ aqui quando disponÃ­vel.",
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
        title="Nenhuma seÃ§Ã£o encontrada."
        description="Crie uma seÃ§Ã£o para comeÃ§ar a organizar o documento."
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
          description="Os contextos recorrentes detectados no texto aparecerÃ£o aqui."
        />

        <div className="rounded-lg border border-zinc-200 bg-white p-3 text-xs leading-relaxed text-zinc-500">
          <p className="font-semibold text-zinc-700">Preparado para detectar:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>RepetiÃ§Ã£o literal e semÃ¢ntica</li>
            <li>RedundÃ¢ncia e prolixidade</li>
            <li>IncoerÃªncia e contradiÃ§Ã£o</li>
            <li>Retomada Ãºtil de ideias</li>
            <li>Baixa progressÃ£o argumentativa</li>
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
            OcorrÃªncias: {cluster.occurrenceCount}
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
                    SugestÃ£o: {occurrence.suggestion}
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
              placeholder="Ex: reescreva com tom acadÃªmico, organize a ideia ou melhore a coesÃ£o..."
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
              Abra ou crie um projeto e uma seÃ§Ã£o para usar o assistente de escrita com salvamento contextual.
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
            PÃ¡gina {state.writingActivePage} de {state.writingPageCount}
          </span>
          <span suppressHydrationWarning>{state.documentWordCount} palavras</span>
          <span>PortuguÃªs (Brasil)</span>
          <span className="hidden md:inline">PrevisÃµes de texto: ativado</span>
          <span className="hidden lg:inline">Acessibilidade: tudo certo</span>
        </div>

        <div className="flex shrink-0 items-center gap-5 text-zinc-700">
          <button type="button" className="hidden hover:text-zinc-900 md:inline">
            Exibir ConfiguraÃ§Ãµes
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
              aria-label="Diminuir zoom da pÃ¡gina"
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
              aria-label="Zoom da pÃ¡gina do editor"
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
              aria-label="Aumentar zoom da pÃ¡gina"
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

