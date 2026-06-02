export type KnexPdfAnnotationKind =
  | "highlight"
  | "comment"
  | "note"
  | "bookmark"
  | "underline";

export interface KnexPdfAnnotationRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface KnexPdfAnnotationStyle {
  color?: string;
  opacity?: number;
  borderColor?: string;
  borderWidth?: number;
}

export interface KnexPdfAnnotationMetadata {
  source?: "selection" | "import" | "manual";
  textQuote?: string;
  [key: string]: unknown;
}

export interface KnexPdfAnnotationBase {
  id: string;
  documentId: string;
  pageIndex: number;
  type: KnexPdfAnnotationKind;
  pdfRects: KnexPdfAnnotationRect[];
  style?: KnexPdfAnnotationStyle;
  content?: string;
  authorId?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: KnexPdfAnnotationMetadata;
}

export interface KnexPdfHighlightAnnotation extends KnexPdfAnnotationBase {
  type: "highlight";
}

export interface KnexPdfCommentAnnotation extends KnexPdfAnnotationBase {
  type: "comment";
  content: string;
}

export interface KnexPdfNoteAnnotation extends KnexPdfAnnotationBase {
  type: "note";
  content: string;
}

export interface KnexPdfBookmarkAnnotation extends KnexPdfAnnotationBase {
  type: "bookmark";
}

export interface KnexPdfUnderlineAnnotation extends KnexPdfAnnotationBase {
  type: "underline";
}

export type KnexPdfAnnotationRecord =
  | KnexPdfHighlightAnnotation
  | KnexPdfCommentAnnotation
  | KnexPdfNoteAnnotation
  | KnexPdfBookmarkAnnotation
  | KnexPdfUnderlineAnnotation;

export type KnexPdfAnnotationDraft = Omit<
  KnexPdfAnnotationRecord,
  "id" | "createdAt" | "updatedAt"
>;
