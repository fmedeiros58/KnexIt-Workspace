import type { ProcessingState } from "../../bridges/contracts/processing-state";
import type { CitationRequestContext, CitationStyle, ReferenceListStyle } from "../presentation-contracts";

function normalize(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAbntRequest(prompt: string) {
  const normalized = normalize(prompt);
  if (!normalized) return false;
  return /\b(abnt|nbr\s*6023|nbr\s*10520|norma brasileira)\b/.test(normalized);
}

function hasInlineCitationRequest(prompt: string) {
  const normalized = normalize(prompt);
  if (!normalized) return false;
  return /\b(citacao no corpo|cite no texto|citacao parentetica|citacao narrativa|apud|et al)\b/.test(normalized) ||
    /\b(cite|citacao)\b/.test(normalized);
}

function hasReferenceListRequest(prompt: string) {
  const normalized = normalize(prompt);
  if (!normalized) return false;
  return /\b(lista de referencias|referencias bibliograficas|liste as referencias|referencias ao final)\b/.test(normalized) ||
    /\b(referencias)\b/.test(normalized);
}

function resolveConversationHints(state: ProcessingState) {
  const style = normalize(state.academicNormalizationState?.style || "");
  const conversationStateLike = state.conversationState as unknown as Record<string, unknown>;
  const requiredStyle = normalize(
    typeof conversationStateLike?.requiredStyle === "string" ? conversationStateLike.requiredStyle : "",
  );
  const responseMode = normalize(
    typeof conversationStateLike?.responseMode === "string" ? conversationStateLike.responseMode : "",
  );
  return { style, requiredStyle, responseMode };
}

function resolveAcademicMode(state: ProcessingState) {
  const { style, requiredStyle, responseMode } = resolveConversationHints(state);
  return (
    state.academicNormalizationState?.applied === true ||
    style === "abnt" ||
    normalize(state.selectedMode || "") === "research" ||
    /\b(academico|cientifico|formal|abnt)\b/.test(requiredStyle) ||
    /\b(analysis|research)\b/.test(responseMode)
  );
}

export function resolveCitationRequestContext(state: ProcessingState): CitationRequestContext {
  const prompt = `${state.normalizedMessage || state.rawMessage || ""}`.trim();
  const academicMode = resolveAcademicMode(state);
  const hints = resolveConversationHints(state);
  const abntRequested =
    hasAbntRequest(prompt) || hints.style === "abnt" || /\babnt\b/.test(hints.requiredStyle);
  const requestedInlineCitation = hasInlineCitationRequest(prompt);
  const requestedReferenceList = hasReferenceListRequest(prompt) || (academicMode && abntRequested);

  const citationStyle: CitationStyle = abntRequested ? "abnt" : "default";
  const referenceListStyle: ReferenceListStyle = abntRequested ? "abnt" : "default";

  return {
    citationStyle,
    referenceListStyle,
    isAcademicMode: academicMode,
    requestedInlineCitation,
    requestedReferenceList,
  };
}
