import { RagPipelineError } from "@/core/rag/rag-errors";
import { resolveLanguageById } from "@/core/rag/language/language_intent";

export type ComposerRagContractInput = {
  question: string;
  documentId?: number;
  documentIds?: number[];
  composerBound?: boolean;
  composerAttachmentIds?: number[];
  preferredResponseLanguageId?: string;
  strictDocumentGrounding?: boolean;
};

export type ComposerScopeMode = "global_rag" | "request_document_scope" | "composer_strict" | "composer_plus_rag";

export type ComposerRagContract = {
  question: string;
  composerBound: boolean;
  documentId?: number;
  documentIds: number[];
  priorityDocumentIds: number[];
  hasDocumentScope: boolean;
  strictDocumentGrounding: boolean;
  preferredResponseLanguageId?: string;
  scopeMode: ComposerScopeMode;
  scopeSource: "composer_attachments" | "request_document_scope" | "none";
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePositiveInt(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  const rounded = Math.round(parsed);
  return rounded > 0 ? rounded : undefined;
}

function normalizePositiveIntArray(value: unknown, maxItems = 64) {
  if (!Array.isArray(value)) return [] as number[];
  const normalized: number[] = [];
  const seen = new Set<number>();
  for (const raw of value) {
    const parsed = normalizePositiveInt(raw);
    if (!parsed || seen.has(parsed)) continue;
    seen.add(parsed);
    normalized.push(parsed);
    if (normalized.length >= maxItems) break;
  }
  return normalized;
}

function mergeDocumentScope(primary?: number, others: number[] = []) {
  const merged = [...others];
  if (primary && !merged.includes(primary)) merged.unshift(primary);
  return merged;
}

function hasStrictScopeIntent(question: string) {
  const normalized = normalizeText(question)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  if (!normalized) return false;
  return (
    /\b(apenas|somente|exclusivamente|estritamente|s[oó] este|s[oó] esses|s[oó] nestes)\b/.test(normalized) &&
    /\b(arquivo|documento|anexo|anexado|pdf|doc)\b/.test(normalized)
  );
}

function hasBlendScopeIntent(question: string) {
  const normalized = normalizeText(question)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  if (!normalized) return false;
  return /\b(tambem|alem|anteriores|outros documentos|base rag|na rag|todos os documentos|todo acervo)\b/.test(
    normalized,
  );
}

function hasDeicticDocumentReference(question: string) {
  const normalized = normalizeText(question)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  if (!normalized) return false;
  const hasDocumentNoun = /\b(arquivo|documento|anexo|anexado|pdf|obra|texto|material)\b/.test(normalized);
  if (!hasDocumentNoun) return false;
  return /\b(esse|essa|este|esta|deste|desta|desse|dessa|anexo|anexado)\b/.test(normalized);
}

export function buildComposerRagContract(input: ComposerRagContractInput): ComposerRagContract {
  const question = normalizeText(input.question);
  if (!question) {
    throw new RagPipelineError(400, "RAG_QUESTION_REQUIRED", "Campo question e obrigatorio.");
  }

  const primaryDocumentId = normalizePositiveInt(input.documentId);
  const requestDocumentIds = normalizePositiveIntArray(input.documentIds);
  const composerAttachmentIds = normalizePositiveIntArray(input.composerAttachmentIds);
  const composerBound = input.composerBound === true || composerAttachmentIds.length > 0;
  const explicitStrictIntent = hasStrictScopeIntent(question);
  const explicitBlendIntent = hasBlendScopeIntent(question);

  let scopeMode: ComposerScopeMode = "global_rag";
  let documentIds: number[] = [];
  let priorityDocumentIds: number[] = [];
  let scopeSource: ComposerRagContract["scopeSource"] = "none";
  if (composerAttachmentIds.length > 0) {
    const strictFromInput = typeof input.strictDocumentGrounding === "boolean" ? input.strictDocumentGrounding : undefined;
    const strictByIntent = explicitStrictIntent && !explicitBlendIntent;
    const strictByReference = hasDeicticDocumentReference(question) && !explicitBlendIntent;
    const useStrictComposerScope =
      strictFromInput === true || (strictFromInput === undefined && (strictByIntent || strictByReference));
    priorityDocumentIds = [...composerAttachmentIds];
    documentIds = [...composerAttachmentIds];
    if (useStrictComposerScope) {
      scopeMode = "composer_strict";
      scopeSource = "composer_attachments";
    } else {
      scopeMode = "composer_plus_rag";
      scopeSource = "composer_attachments";
    }
  } else {
    documentIds = mergeDocumentScope(primaryDocumentId, requestDocumentIds);
    if (documentIds.length > 0) {
      scopeMode = "request_document_scope";
      priorityDocumentIds = [...documentIds];
      scopeSource = "request_document_scope";
    }
  }

  const hasDocumentScope = documentIds.length > 0;
  const strictDocumentGrounding = (() => {
    if (typeof input.strictDocumentGrounding === "boolean") return input.strictDocumentGrounding;
    if (scopeMode === "composer_strict") return true;
    if (scopeMode === "request_document_scope") return true;
    return false;
  })();
  if (strictDocumentGrounding && !hasDocumentScope) {
    throw new RagPipelineError(
      422,
      "RAG_COMPOSER_SCOPE_REQUIRED",
      "Composer vinculado sem documento selecionado. Reanexe o arquivo antes de enviar.",
    );
  }

  const preferredLanguage = resolveLanguageById(normalizeText(input.preferredResponseLanguageId));
  const preferredResponseLanguageId = preferredLanguage?.id;

  return {
    question,
    composerBound,
    documentId: documentIds.length === 1 ? documentIds[0] : undefined,
    documentIds,
    priorityDocumentIds,
    hasDocumentScope,
    strictDocumentGrounding,
    preferredResponseLanguageId,
    scopeMode,
    scopeSource,
  };
}
