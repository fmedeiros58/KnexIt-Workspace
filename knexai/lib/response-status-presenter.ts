import type { StreamProgressEvent } from "./client";

export type ResponseTransientStage = "sending" | "analyzing" | "retrieving" | "composing" | "finalizing";

const TRANSIENT_STAGE_ORDER: ResponseTransientStage[] = [
  "sending",
  "analyzing",
  "retrieving",
  "composing",
  "finalizing",
];

const TRANSIENT_STAGE_LABELS: Record<ResponseTransientStage, string> = {
  sending: "Enviando solicitacao...",
  analyzing: "Analisando contexto...",
  retrieving: "Recuperando trechos relevantes...",
  composing: "Organizando a resposta...",
  finalizing: "Finalizando resposta...",
};

const LONG_WAIT_TRANSIENT_MESSAGES = [
  "Estamos processando os dados para entregar a melhor resposta. Aguarde mais um instante...",
  "Agora estou cruzando contexto, evidencias e escopo para manter precisao...",
  "Estou refinando a resposta final com base no material recuperado...",
];

const BACKEND_STAGE_MAP: Record<string, ResponseTransientStage> = {
  ingest: "analyzing",
  parse: "analyzing",
  structure: "analyzing",
  ocr: "analyzing",
  chunk: "retrieving",
  embed: "retrieving",
  retrieve: "retrieving",
  rerank: "retrieving",
  pack: "retrieving",
  draft: "composing",
  cite_audit: "finalizing",
  merge: "finalizing",
  finalize: "finalizing",
  final: "finalizing",
  thinking: "analyzing",
  planning: "analyzing",
  genre: "analyzing",
  section_start: "retrieving",
  section_done: "composing",
  merge_start: "finalizing",
  merge_done: "finalizing",
  elapsed: "finalizing",
  progress: "analyzing",
};

const RETRIEVING_HINTS = ["recuper", "evidenc", "trecho", "chunk", "documento"];
const FINALIZING_HINTS = ["merge", "final", "conclu", "elapsed"];

function normalizeString(value: unknown) {
  return `${value || ""}`.trim();
}

function normalizeKey(value: unknown) {
  return normalizeString(value).toLowerCase();
}

function includesAnyHint(sourceText: string, hints: string[]) {
  const normalized = normalizeKey(sourceText);
  if (!normalized) return false;
  return hints.some((hint) => normalized.includes(hint));
}

function resolveStageFromText(text: string): ResponseTransientStage | null {
  if (!text) return null;
  if (includesAnyHint(text, RETRIEVING_HINTS)) return "retrieving";
  if (includesAnyHint(text, FINALIZING_HINTS)) return "finalizing";
  return null;
}

function resolveSectionPrefix(event: StreamProgressEvent) {
  const sectionIndex = Number(event.sectionIndex);
  const sectionTotal = Number(event.sectionTotal);
  if (!Number.isFinite(sectionIndex) || !Number.isFinite(sectionTotal)) return "";
  if (sectionIndex <= 0 || sectionTotal <= 0) return "";
  return `[${Math.round(sectionIndex)}/${Math.round(sectionTotal)}] `;
}

function resolveSectionSuffix(event: StreamProgressEvent) {
  const title = normalizeString(event.sectionTitle);
  return title ? ` (${title})` : "";
}

function resolveTargetSuffix(event: StreamProgressEvent) {
  const target = event.target;
  if (!target) return "";
  const labels: string[] = [];
  if (target.docName) labels.push(target.docName);
  if (Number.isFinite(Number(target.pageCurrent)) && Number.isFinite(Number(target.pageTotal))) {
    labels.push(`p.${Math.round(Number(target.pageCurrent))}/${Math.round(Number(target.pageTotal))}`);
  }
  if (Number.isFinite(Number(target.chunkCurrent)) && Number.isFinite(Number(target.chunkTotal))) {
    labels.push(`chunks ${Math.round(Number(target.chunkCurrent))}/${Math.round(Number(target.chunkTotal))}`);
  }
  if (target.section) labels.push(target.section);
  if (!labels.length) return "";
  return ` (${labels.join(" | ")})`;
}

export function getTransientStageLabel(stage: ResponseTransientStage) {
  return TRANSIENT_STAGE_LABELS[stage];
}

export function getTransientStageCursor(stage: ResponseTransientStage) {
  return TRANSIENT_STAGE_ORDER.indexOf(stage);
}

export function getTransientStageMenu() {
  return TRANSIENT_STAGE_ORDER.map((stage) => TRANSIENT_STAGE_LABELS[stage]);
}

export function getNextTransientDisplayCursor(currentCursor: number) {
  const menu = getTransientStageMenu();
  if (!menu.length) {
    return {
      cursor: 0,
      text: "",
    };
  }
  const baseCursor = Number.isFinite(currentCursor) ? Math.trunc(currentCursor) : 0;
  const nextCursor = ((baseCursor % menu.length) + menu.length + 1) % menu.length;
  return {
    cursor: nextCursor,
    text: menu[nextCursor],
  };
}

export function getLongWaitTransientMessage(elapsedMs: number) {
  const safeElapsedMs = Number.isFinite(elapsedMs) ? Math.max(0, Math.trunc(elapsedMs)) : 0;
  const bucket = Math.floor(safeElapsedMs / 4000);
  return LONG_WAIT_TRANSIENT_MESSAGES[bucket % LONG_WAIT_TRANSIENT_MESSAGES.length];
}

export function createInitialTransientStatus() {
  const stage: ResponseTransientStage = "sending";
  return {
    stage,
    text: TRANSIENT_STAGE_LABELS[stage],
    progressMenu: getTransientStageMenu(),
    progressCursor: getTransientStageCursor(stage),
  };
}

export function resolveTransientStageFromProgressEvent(event: StreamProgressEvent): ResponseTransientStage {
  const mapped = BACKEND_STAGE_MAP[normalizeKey(event.stage)];
  if (mapped) return mapped;
  const hinted = resolveStageFromText(normalizeString(event.text));
  return hinted || "analyzing";
}

export function buildTransientStatusFromProgressEvent(event: StreamProgressEvent) {
  const stage = resolveTransientStageFromProgressEvent(event);
  const baseText = TRANSIENT_STAGE_LABELS[stage];
  const eventText = normalizeString(event.text);
  const text = (eventText || `${resolveSectionPrefix(event)}${baseText}${resolveSectionSuffix(event)}`) + resolveTargetSuffix(event);
  return {
    stage,
    text: text.trim(),
    progressMenu: getTransientStageMenu(),
    progressCursor: getTransientStageCursor(stage),
  };
}
