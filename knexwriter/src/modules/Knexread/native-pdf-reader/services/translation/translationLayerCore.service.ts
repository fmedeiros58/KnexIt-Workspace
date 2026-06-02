import { pdfReaderRepository } from "../../db/pdfReader.repository";
import type {
  PdfGeoTextBlockRecord,
  PdfReaderPreferencesRecord,
  PdfTranslationBlockRecord,
  PdfTranslationBlockStatus,
  PdfTranslationRevisionRecord,
  PdfTranslationRuntime,
  PdfTranslationStrategy,
} from "../../types";
import { translationProviderRouter } from "./translationProviderRouter.service";

function createLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildTranslationBlockId(input: {
  pdfFileId: string;
  pageNumber: number;
  blockId: string;
  targetLanguage: string;
}) {
  return `tr-${input.pdfFileId}-${input.pageNumber}-${input.targetLanguage}-${input.blockId}`.replace(/[^a-zA-Z0-9-_]/g, "_");
}

function buildPreferencesId(projectId: string, documentId?: string) {
  return documentId ? `pref-${projectId}-${documentId}` : `pref-${projectId}-global`;
}

function toRevision(input: {
  block: PdfTranslationBlockRecord;
  nextText: string;
  reason: PdfTranslationRevisionRecord["reason"];
}) {
  const now = new Date().toISOString();
  return {
    id: createLocalId("tr-rev"),
    translationBlockId: input.block.id,
    pdfFileId: input.block.pdfFileId,
    documentId: input.block.documentId,
    pageNumber: input.block.pageNumber,
    previousText: input.block.translatedText,
    nextText: input.nextText,
    reason: input.reason,
    createdAt: now,
  } satisfies PdfTranslationRevisionRecord;
}

export async function ensureTranslationLayerForPage(input: {
  pdfFileId: string;
  projectId: string;
  documentId: string;
  pageNumber: number;
  sourceLanguage: string;
  targetLanguage: string;
  geoBlocks: PdfGeoTextBlockRecord[];
}) {
  const now = new Date().toISOString();
  const existing = await pdfReaderRepository.listTranslationBlocksByPdfFileAndPage(
    input.pdfFileId,
    input.pageNumber,
  );
  const existingByBlockId = new Map(existing.map((item) => [item.blockId, item]));

  const merged: PdfTranslationBlockRecord[] = input.geoBlocks.map((geoBlock) => {
    const current = existingByBlockId.get(geoBlock.blockId);
    const id =
      current?.id ??
      buildTranslationBlockId({
        pdfFileId: input.pdfFileId,
        pageNumber: input.pageNumber,
        blockId: geoBlock.blockId,
        targetLanguage: input.targetLanguage,
      });
    return {
      id,
      documentId: input.documentId,
      projectId: input.projectId,
      pdfFileId: input.pdfFileId,
      pageNumber: input.pageNumber,
      blockId: geoBlock.blockId,
      originalText: geoBlock.originalText,
      translatedText: current?.translatedText ?? geoBlock.originalText,
      sourceLanguage: current?.sourceLanguage ?? input.sourceLanguage,
      targetLanguage: current?.targetLanguage ?? input.targetLanguage,
      bbox: geoBlock.bbox,
      style: geoBlock.style,
      blockType: geoBlock.blockType,
      status: current?.status ?? "pending",
      revision: current?.revision,
      providerId: current?.providerId,
      confidence: current?.confidence,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    };
  });

  await pdfReaderRepository.putTranslationBlocks(merged);
  return merged.sort((a, b) => a.pageNumber - b.pageNumber || a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x);
}

export async function listTranslationBlocksForPdf(pdfFileId: string) {
  const blocks = await pdfReaderRepository.listTranslationBlocksByPdfFile(pdfFileId);
  return blocks.sort((a, b) => a.pageNumber - b.pageNumber || a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x);
}

export async function listTranslationBlocksForPage(pdfFileId: string, pageNumber: number) {
  const blocks = await pdfReaderRepository.listTranslationBlocksByPdfFileAndPage(
    pdfFileId,
    pageNumber,
  );
  return blocks.sort((a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x);
}

export async function updateTranslationBlockText(input: {
  translationBlockId: string;
  text: string;
  reason?: PdfTranslationRevisionRecord["reason"];
  status?: PdfTranslationBlockStatus;
  reviewedBy?: string;
  notes?: string;
}) {
  const current = await pdfReaderRepository.getTranslationBlockById(input.translationBlockId);
  if (!current) return null;

  const nextText = input.text.trim();
  const now = new Date().toISOString();

  if (nextText !== current.translatedText) {
    const revision = toRevision({
      block: current,
      nextText,
      reason: input.reason ?? "manual-edit",
    });
    await pdfReaderRepository.putTranslationRevision(revision);
  }

  const next = await pdfReaderRepository.updateTranslationBlock(current.id, {
    translatedText: nextText,
    status: input.status ?? "edited",
    revision:
      input.reviewedBy || input.notes
        ? {
            reviewedBy: input.reviewedBy,
            notes: input.notes,
            reviewedAt: now,
          }
        : current.revision,
  });

  return next;
}

export async function loadOrCreateReaderPreferences(input: {
  projectId: string;
  documentId?: string;
}) {
  const id = buildPreferencesId(input.projectId, input.documentId);
  const now = new Date().toISOString();
  const defaults: Omit<PdfReaderPreferencesRecord, "id" | "projectId" | "documentId" | "createdAt" | "updatedAt"> = {
    zoomMode: "manual",
    renderQuality: "extreme",
    sourceLanguage: "auto",
    targetLanguage: "pt-BR",
    translationStrategy: "local-first",
    translationViewMode: "normal",
    maskOpacity: 0.92,
    showBlockBounds: false,
    showMask: false,
    showTextLayer: false,
    showRuler: true,
    showMargins: true,
    showViewportCenter: false,
    showPageCenter: false,
    enableOcrLayer: false,
    showOcrDebugBoxes: false,
  };

  const existing = await pdfReaderRepository.getReaderPreferencesById(id);
  if (existing) {
    const hydrated: PdfReaderPreferencesRecord = {
      ...defaults,
      ...existing,
      id: existing.id,
      projectId: existing.projectId,
      documentId: existing.documentId,
      createdAt: existing.createdAt,
      updatedAt: existing.updatedAt ?? now,
    };
    await pdfReaderRepository.putReaderPreferences(hydrated);
    return hydrated;
  }

  const created: PdfReaderPreferencesRecord = {
    id,
    projectId: input.projectId,
    documentId: input.documentId,
    ...defaults,
    createdAt: now,
    updatedAt: now,
  };
  await pdfReaderRepository.putReaderPreferences(created);
  return created;
}

export async function updateReaderPreferences(input: {
  projectId: string;
  documentId?: string;
  patch: Partial<PdfReaderPreferencesRecord>;
}) {
  const current = await loadOrCreateReaderPreferences({
    projectId: input.projectId,
    documentId: input.documentId,
  });
  const next: PdfReaderPreferencesRecord = {
    ...current,
    ...input.patch,
    id: current.id,
    projectId: current.projectId,
    documentId: current.documentId,
    updatedAt: new Date().toISOString(),
  };
  await pdfReaderRepository.putReaderPreferences(next);
  return next;
}

export async function translatePageBlocks(input: {
  pdfFileId: string;
  pageNumber: number;
  strategy: PdfTranslationStrategy;
  runtime?: PdfTranslationRuntime;
  preferredProviderId?: string;
  targetLanguage: string;
  sourceLanguage?: string;
  onlyPending?: boolean;
}) {
  const blocks = await listTranslationBlocksForPage(input.pdfFileId, input.pageNumber);
  const targetBlocks = input.onlyPending
    ? blocks.filter((block) => block.status === "pending" || block.status === "error")
    : blocks;

  const updated: PdfTranslationBlockRecord[] = [];
  for (const block of targetBlocks) {
    try {
      const output = await translationProviderRouter.translate(
        {
          sourceLanguage: input.sourceLanguage ?? block.sourceLanguage,
          targetLanguage: input.targetLanguage,
          text: block.originalText,
          context: {
            pageNumber: block.pageNumber,
            blockType: block.blockType,
            documentId: block.documentId,
          },
        },
        {
          strategy: input.strategy,
          runtime: input.runtime,
          preferredProviderId: input.preferredProviderId,
        },
      );

      if (output.translatedText !== block.translatedText) {
        await pdfReaderRepository.putTranslationRevision(
          toRevision({
            block,
            nextText: output.translatedText,
            reason: "provider",
          }),
        );
      }

      const next = await pdfReaderRepository.updateTranslationBlock(block.id, {
        translatedText: output.translatedText,
        providerId: output.providerId,
        confidence: output.confidence,
        sourceLanguage: input.sourceLanguage ?? block.sourceLanguage,
        targetLanguage: input.targetLanguage,
        status: "translated",
      });
      if (next) updated.push(next);
    } catch {
      const errored = await pdfReaderRepository.updateTranslationBlock(block.id, {
        status: "error",
      });
      if (errored) updated.push(errored);
    }
  }

  return updated;
}

export async function translateDocumentBlocks(input: {
  pdfFileId: string;
  strategy: PdfTranslationStrategy;
  runtime?: PdfTranslationRuntime;
  preferredProviderId?: string;
  targetLanguage: string;
  sourceLanguage?: string;
  onlyPending?: boolean;
}) {
  const blocks = await listTranslationBlocksForPdf(input.pdfFileId);
  const pages = Array.from(new Set(blocks.map((block) => block.pageNumber))).sort((a, b) => a - b);
  const updated: PdfTranslationBlockRecord[] = [];
  for (const pageNumber of pages) {
    const pageUpdated = await translatePageBlocks({
      pdfFileId: input.pdfFileId,
      pageNumber,
      strategy: input.strategy,
      runtime: input.runtime,
      preferredProviderId: input.preferredProviderId,
      targetLanguage: input.targetLanguage,
      sourceLanguage: input.sourceLanguage,
      onlyPending: input.onlyPending,
    });
    updated.push(...pageUpdated);
  }
  return updated;
}
