import { normalizePdfText } from "../utils";
import type { PdfMetadataRecord, PdfSourceCandidate } from "../types";
import type { NativePdfSession } from "./pdfLoader.service";

const DOI_REGEX = /\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/i;
const ISBN_REGEX =
  /\b(?:97[89][-\s]?)?(?:\d[-\s]?){9,12}[\dX]\b/i;

export async function extractPdfMetadata(
  session: NativePdfSession,
): Promise<PdfMetadataRecord> {
  const metadataResult = await session.pdf.getMetadata?.();
  const info = metadataResult?.info ?? {};

  const probeText = await extractProbeText(session, 3);

  const possibleDoi = findFirstMatch(probeText, DOI_REGEX);
  const possibleIsbn = findFirstMatch(probeText, ISBN_REGEX);
  const possibleInstitution = inferInstitutionFromText(probeText);

  return {
    title: asString(info.Title) || asString(info.title),
    author: asString(info.Author) || asString(info.author),
    subject: asString(info.Subject) || asString(info.subject),
    keywords: asString(info.Keywords)?.split(/[,;]+/).map((item) => item.trim()).filter(Boolean),
    producer: asString(info.Producer) || asString(info.producer),
    creator: asString(info.Creator) || asString(info.creator),
    creationDate: asString(info.CreationDate),
    modificationDate: asString(info.ModDate),
    totalPages: session.pageCount,
    possibleDoi,
    possibleIsbn,
    possibleInstitution,
  };
}

export function buildPdfSourceCandidate(input: {
  pdfFileId: string;
  metadata: PdfMetadataRecord;
}): PdfSourceCandidate {
  const year =
    extractYearFromDate(input.metadata.creationDate) ||
    extractYearFromDate(input.metadata.modificationDate);
  const missingFields = [
    !input.metadata.title ? "title" : "",
    !input.metadata.author ? "author" : "",
    !year ? "year" : "",
  ].filter(Boolean);

  const warnings: string[] = [];
  if (!input.metadata.possibleDoi && !input.metadata.possibleIsbn) {
    warnings.push("DOI/ISBN não identificado automaticamente.");
  }
  if (!input.metadata.author) {
    warnings.push("Autor não encontrado nos metadados do PDF.");
  }

  const confidence: "high" | "medium" | "low" =
    missingFields.length === 0 ? "high" : missingFields.length <= 2 ? "medium" : "low";

  return {
    pdfFileId: input.pdfFileId,
    sourceCandidate: {
      sourceType: "pdf",
      title: input.metadata.title,
      author: input.metadata.author,
      year: year ?? undefined,
      doi: input.metadata.possibleDoi,
      isbn: input.metadata.possibleIsbn,
      institution: input.metadata.possibleInstitution,
    },
    confidence,
    missingFields,
    warnings,
  };
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : undefined;
}

function findFirstMatch(text: string, pattern: RegExp) {
  const match = text.match(pattern);
  return match?.[0]?.trim();
}

function inferInstitutionFromText(text: string) {
  const candidates = [
    "universidade",
    "university",
    "instituto",
    "institute",
    "faculdade",
    "federal",
  ];

  const lines = text.split(/\n+/).map((line) => normalizePdfText(line));
  for (const line of lines) {
    const lowered = line.toLowerCase();
    if (candidates.some((item) => lowered.includes(item))) {
      return line;
    }
  }
  return undefined;
}

function extractYearFromDate(value?: string) {
  if (!value) return undefined;
  const match = value.match(/(19|20)\d{2}/);
  return match?.[0];
}

async function extractProbeText(session: NativePdfSession, maxPages: number) {
  const textParts: string[] = [];
  const limit = Math.min(session.pageCount, Math.max(1, maxPages));
  for (let pageNumber = 1; pageNumber <= limit; pageNumber += 1) {
    const page = await session.pdf.getPage(pageNumber);
    const content = await page.getTextContent({
      disableCombineTextItems: false,
      normalizeWhitespace: false,
    });
    const text = (content.items ?? [])
      .map((item) => (typeof item.str === "string" ? item.str : ""))
      .join(" ");
    textParts.push(normalizePdfText(text));
  }
  return textParts.join("\n");
}

