export type PdfGeoBlockType =
  | "title"
  | "subtitle"
  | "paragraph"
  | "caption"
  | "footnote"
  | "header"
  | "footer"
  | "table-cell"
  | "list-item"
  | "unknown";

export type PdfGeoTextStyle = {
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  lineHeight?: number;
  alignment?: "left" | "center" | "right" | "justify";
  color?: string;
};

export type PdfGeoTextBlockRecord = {
  id: string;
  pdfFileId: string;
  projectId: string;
  documentId?: string;
  pageNumber: number;
  blockId: string;
  originalText: string;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  style: PdfGeoTextStyle;
  blockType: PdfGeoBlockType;
  readingOrder: number;
  lineIndex: number;
  paragraphIndex: number;
  createdAt: string;
  updatedAt: string;
};
