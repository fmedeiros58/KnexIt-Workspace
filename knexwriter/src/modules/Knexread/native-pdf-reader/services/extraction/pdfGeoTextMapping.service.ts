import type { PdfGeoBlockType, PdfGeoTextBlockRecord } from "../../types";
import type { KnexPdfTextBlock as PdfTextBlock } from "../../knex-pdf-engine";
import { pdfReaderRepository } from "../../db/pdfReader.repository";

function createGeoRecordId(input: { pdfFileId: string; pageNumber: number; blockId: string }) {
  return `geo-${input.pdfFileId}-${input.pageNumber}-${input.blockId}`.replace(/[^a-zA-Z0-9-_]/g, "_");
}

function inferBlockType(input: {
  block: PdfTextBlock;
  medianFont: number;
  pageHeight: number;
}): PdfGeoBlockType {
  const text = input.block.text.trim();
  const lowered = text.toLowerCase();
  const isListLike = /^(\d+[\.\)]\s+|[-*]\s+)/.test(text);
  const isFooterArea = input.block.y > input.pageHeight * 0.9;
  const isHeaderArea = input.block.y < input.pageHeight * 0.1;
  const isTiny = input.block.fontSize < input.medianFont * 0.84;
  const isBig = input.block.fontSize > input.medianFont * 1.25;
  const shortLine = text.length < 64;

  if (isHeaderArea && shortLine) return "header";
  if (isFooterArea && shortLine) return isTiny ? "footnote" : "footer";
  if (isListLike) return "list-item";
  if (lowered.includes("tabela") || lowered.includes("table")) return "table-cell";
  if (lowered.includes("figura") || lowered.includes("figure")) return "caption";
  if (isBig && shortLine) return text.length < 34 ? "title" : "subtitle";
  if (isTiny && text.length < 90) return "footnote";
  return "paragraph";
}

function median(values: number[]) {
  if (!values.length) return 12;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function mapPdfTextBlocksToGeoRecords(input: {
  pdfFileId: string;
  projectId: string;
  documentId?: string;
  pageNumber: number;
  pageHeight: number;
  blocks: PdfTextBlock[];
}): PdfGeoTextBlockRecord[] {
  const now = new Date().toISOString();
  const medianFont = median(input.blocks.map((item) => item.fontSize));

  return input.blocks.map((block, index) => {
    const blockType = inferBlockType({
      block,
      medianFont,
      pageHeight: input.pageHeight,
    });
    return {
      id: createGeoRecordId({
        pdfFileId: input.pdfFileId,
        pageNumber: input.pageNumber,
        blockId: block.id,
      }),
      pdfFileId: input.pdfFileId,
      projectId: input.projectId,
      documentId: input.documentId,
      pageNumber: input.pageNumber,
      blockId: block.id,
      originalText: block.text,
      bbox: {
        x: block.x,
        y: block.y,
        width: block.width,
        height: block.height,
      },
      style: {
        fontSize: block.fontSize,
        fontFamily: block.fontFamily,
        fontWeight: block.fontWeight,
        fontStyle: block.fontStyle,
        lineHeight: block.lineHeight,
        alignment: block.align,
        color: block.color,
      },
      blockType,
      readingOrder: block.readingOrder ?? index,
      lineIndex: block.lineIndex ?? index,
      paragraphIndex: block.paragraphIndex ?? index,
      createdAt: now,
      updatedAt: now,
    };
  });
}

export async function persistGeoTextBlocks(input: {
  pdfFileId: string;
  projectId: string;
  documentId?: string;
  pageNumber: number;
  pageHeight: number;
  blocks: PdfTextBlock[];
}) {
  const records = mapPdfTextBlocksToGeoRecords(input);
  await pdfReaderRepository.putGeoTextBlocks(records);
  return records;
}
