import type { DeliveryChannel, DeliveryFormat } from "../shared/enums/delivery-enums";
import type { ConfidenceScores, ProcessingTraceEvent } from "../shared/types/common-types";
import type { RetrievedSource, ValidationReport } from "../bridges/contracts/processing-state";
import type { ResponseLayoutPlan, TextualAudit } from "./textual-layout-engine/response-layout-types";

export type { DeliveryChannel, DeliveryFormat };

export type ConfidenceBand = "low" | "medium" | "high";
export type CitationStyle = "default" | "abnt";
export type ReferenceListStyle = "default" | "abnt";

export type BibliographicEntry = {
  authors?: string[];
  title?: string;
  subtitle?: string;
  journal?: string;
  place?: string;
  publisher?: string;
  year?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  edition?: string;
  doi?: string;
  url?: string;
  accessDate?: string;
  sourceType?: "book" | "article" | "chapter" | "thesis" | "website" | "report" | "unknown";
};

export type CitationRequestContext = {
  citationStyle: CitationStyle;
  referenceListStyle: ReferenceListStyle;
  isAcademicMode: boolean;
  requestedInlineCitation: boolean;
  requestedReferenceList: boolean;
};

export interface CitationView {
  url: string;
  title: string;
  snippet: string;
  freshnessScore: number;
  trustHint: "verified" | "unverified";
  inlineCitation?: string;
  referenceText?: string;
  bibliographicEntry?: BibliographicEntry;
}

export interface CodeBlockView {
  language: string;
  code: string;
  inline: boolean;
}

export interface DocumentView {
  title: string;
  source: string;
  snippet: string;
  kind: "web" | "memory" | "internal" | "unknown";
  bibliographicEntry?: BibliographicEntry;
  referenceText?: string;
}

export interface MediaView {
  type: "image" | "audio" | "video" | "file";
  url: string;
}

export interface ChatBubbleView {
  role: "assistant";
  text: string;
  paragraphs: string[];
  paragraphCount: number;
  charCount: number;
}

export interface ConfidenceView {
  score: number;
  band: ConfidenceBand;
  label: string;
  qualityDecision: "accept" | "retry";
}

export interface PresentationRenderModel {
  channel: DeliveryChannel;
  format: DeliveryFormat;
  text: string;
  bubble: ChatBubbleView;
  citations: CitationView[];
  referenceList: string[];
  referenceEntries: BibliographicEntry[];
  citationRequestContext: CitationRequestContext;
  codeBlocks: CodeBlockView[];
  documents: DocumentView[];
  media: MediaView[];
  confidence: ConfidenceView;
  responseLayoutPlan?: ResponseLayoutPlan;
  textualAudit?: TextualAudit;
  longFormDiscourse?: {
    isActive: boolean;
    pendingObligations: string[];
    completedObligations: string[];
    paragraphHistory: string[];
    transitionPlan: string[];
    usesWorkingMemory: boolean;
  };
}

export interface SerializedPresentation {
  format: DeliveryFormat;
  text: string;
  payload: Record<string, unknown>;
  score: number;
  rhetoricalShape?: string;
  layoutNotes?: string[];
  textualAudit?: TextualAudit;
}

export interface StreamChunk {
  index: number;
  delta: string;
  cumulativeText: string;
  done: boolean;
}

export interface DeliveryBuildResult {
  channel: DeliveryChannel;
  format: DeliveryFormat;
  text: string;
  payload: Record<string, unknown>;
  retryPolicy: {
    maxAttempts: number;
    baseBackoffMs: number;
    jitterMs: number;
  };
}

export interface PresentationDiagnostics {
  adapters: string[];
  serializers: string[];
  streamControllers: string[];
  utf8Repaired: boolean;
}

export interface BaseRenderInput {
  text: string;
  sources: RetrievedSource[];
  confidenceScores: ConfidenceScores;
  validationReport: ValidationReport;
  trace: ProcessingTraceEvent[];
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function toPlainText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return `${value}`;
}

export function collapseWhitespace(value: string): string {
  return `${value || ""}`.replace(/\s+/g, " ").trim();
}

export function normalizeText(value: string): string {
  return `${value || ""}`.replace(/\r/g, "").trim();
}

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(`${value || ""}`.trim());
}

export function classifySourceKind(source: string): "web" | "memory" | "internal" | "unknown" {
  const normalized = `${source || ""}`.trim().toLowerCase();
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) return "web";
  if (normalized.startsWith("memory://")) return "memory";
  if (normalized.startsWith("internal://")) return "internal";
  return "unknown";
}