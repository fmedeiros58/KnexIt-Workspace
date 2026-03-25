import { detectContinuityMode, resolveActiveSubtopic, resolveActiveTopic } from "./active-topic.resolver";
import { resolveActiveTextReference } from "./active-text.resolver";
import { resolveInstructionPersistence } from "./instruction-persistence.layer";
import type {
  ConversationPerceptionInput,
  ConversationPerceptionState,
  PersistentInstructionState,
} from "./types";

const STATE_TTL_MS = 2 * 60 * 60 * 1000;
const stateStore = new Map<string, ConversationPerceptionState>();

function compactText(value: string, maxChars = 220) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) return "";
  if (compact.length <= maxChars) return compact;
  return `${compact.slice(0, Math.max(40, maxChars - 3)).trimEnd()}...`;
}

function cleanupExpiredStates(now: number) {
  for (const [key, state] of stateStore.entries()) {
    if (now - state.updated_at > STATE_TTL_MS) {
      stateStore.delete(key);
    }
  }
}

function resolveActiveTask(prompt: string, continuityMode: "continue" | "adjust" | "replace", previousTask: string) {
  const normalized = prompt.toLowerCase();
  if (/(reescrev|ajust|melhor|corrig)/i.test(normalized)) return "refinar conteudo em andamento";
  if (/(resum|sintetiz)/i.test(normalized)) return "resumir o objeto ativo";
  if (/(explique|detalh|aprofund|analis)/i.test(normalized)) return "explicar com aprofundamento";
  if (/(implemente|codigo|patch|refator)/i.test(normalized)) return "implementacao tecnica";
  if (continuityMode !== "replace" && previousTask) return previousTask;
  return "responder ao objetivo imediato do usuario";
}

function resolveContinuityAnchor(input: {
  previousAnchor: string;
  activeTopic: string;
  activeTask: string;
  continuityMode: "continue" | "adjust" | "replace";
}) {
  const candidate = compactText(`${input.activeTopic} :: ${input.activeTask}`, 160);
  if (input.continuityMode === "replace") return candidate;
  if (input.previousAnchor) return input.previousAnchor;
  return candidate;
}

function resolveLastContextDecision(input: {
  continuityMode: "continue" | "adjust" | "replace";
  activeTopic: string;
  activeTask: string;
}) {
  if (input.continuityMode === "replace") {
    return compactText(`Escopo substituido para o tema '${input.activeTopic}' com foco em '${input.activeTask}'.`, 180);
  }
  if (input.continuityMode === "adjust") {
    return compactText(`Escopo mantido com ajuste incremental na tarefa '${input.activeTask}'.`, 180);
  }
  return compactText(`Escopo preservado: continuidade no tema '${input.activeTopic}'.`, 180);
}

function resolveUnresolvedPendingPoint(prompt: string, previousPending: string, continuityMode: "continue" | "adjust" | "replace") {
  const normalized = prompt.toLowerCase();
  if (/(duvida|d[úu]vida|pergunta|quest[aã]o)/i.test(normalized)) {
    return compactText(prompt, 180);
  }
  if (continuityMode !== "replace" && previousPending) return previousPending;
  return "";
}

function toPersistentInstructionState(state: ConversationPerceptionState | undefined): PersistentInstructionState | null {
  if (!state) return null;
  return {
    requiredStyle: state.required_style,
    userConstraints: state.user_constraints,
    responseMode: state.response_mode,
  };
}

export function rebuildConversationState(input: ConversationPerceptionInput): ConversationPerceptionState {
  const now = Date.now();
  cleanupExpiredStates(now);
  const previous = stateStore.get(input.conversationKey);
  const continuityMode = detectContinuityMode(input.prompt, previous?.active_topic || "");
  const activeTopic = resolveActiveTopic({
    prompt: input.prompt,
    history: input.history,
    previousTopic: previous?.active_topic || "",
  });
  const activeSubtopic = resolveActiveSubtopic({
    prompt: input.prompt,
    previousSubtopic: previous?.active_subtopic || "",
    continuityMode,
  });
  const activeTask = resolveActiveTask(input.prompt, continuityMode, previous?.active_task || "");
  const activeTextReference = resolveActiveTextReference({
    prompt: input.prompt,
    history: input.history,
    previousActiveTextReference: previous?.active_text_reference || "",
    continuityMode,
  });
  const instructionState = resolveInstructionPersistence({
    prompt: input.prompt,
    history: input.history,
    previous: toPersistentInstructionState(previous),
  });
  const continuityAnchor = resolveContinuityAnchor({
    previousAnchor: previous?.continuity_anchor || "",
    activeTopic,
    activeTask,
    continuityMode,
  });
  const nextState: ConversationPerceptionState = {
    active_topic: activeTopic || "conversa em andamento",
    active_subtopic: activeSubtopic,
    active_task: activeTask,
    active_text_reference: activeTextReference,
    user_constraints: instructionState.userConstraints,
    required_style: instructionState.requiredStyle,
    response_mode: instructionState.responseMode,
    unresolved_pending_point: resolveUnresolvedPendingPoint(
      input.prompt,
      previous?.unresolved_pending_point || "",
      continuityMode,
    ),
    last_contextual_decision: resolveLastContextDecision({
      continuityMode,
      activeTopic: activeTopic || "conversa em andamento",
      activeTask,
    }),
    continuity_anchor: continuityAnchor,
    continuity_mode: continuityMode,
    updated_at: now,
  };
  stateStore.set(input.conversationKey, nextState);
  return nextState;
}

function formatList(values: string[], fallback = "nenhuma") {
  if (!values.length) return fallback;
  return values.map((value) => compactText(value, 120)).join(" | ");
}

export function buildConversationStateSummaryBlock(state: ConversationPerceptionState) {
  return [
    "[conversation_state]",
    `active_topic: ${compactText(state.active_topic, 160) || "conversa em andamento"}`,
    `active_subtopic: ${compactText(state.active_subtopic, 140) || "-"}`,
    `active_task: ${compactText(state.active_task, 160) || "-"}`,
    `active_text_reference: ${compactText(state.active_text_reference, 180) || "-"}`,
    `user_constraints: ${formatList(state.user_constraints)}`,
    `required_style: ${compactText(state.required_style, 140) || "resposta contextualizada e natural"}`,
    `response_mode: ${compactText(state.response_mode, 80) || "conversation"}`,
    `unresolved_pending_point: ${compactText(state.unresolved_pending_point, 160) || "-"}`,
    `last_contextual_decision: ${compactText(state.last_contextual_decision, 160) || "-"}`,
    `continuity_anchor: ${compactText(state.continuity_anchor, 160) || "-"}`,
    `continuity_mode: ${state.continuity_mode}`,
    "[/conversation_state]",
  ].join("\n");
}

export function injectConversationStatePrompt(prompt: string, conversationStateBlock: string) {
  const trimmedPrompt = prompt.trim();
  const trimmedState = conversationStateBlock.trim();
  if (!trimmedState) return trimmedPrompt;
  return [trimmedState, "", "Mensagem atual do usuario:", trimmedPrompt].join("\n");
}

