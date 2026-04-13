/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 03-conversation-layer
 * Module: conversation-to-context-bridge
 * Responsibility: Validate and sanitize the handoff from conversation layer to context/session layer.
 * Primary Inputs: ProcessingState after local conversational consolidation.
 * Primary Outputs: ProcessingState safe for context/session processing.
 * Upstream Dependencies: conversation-layer state updates, handoff contract assertion.
 * Downstream Dependencies: 04-context-and-session-layer.
 * Invariants: Handoff must preserve recentTurns, activeContext, inputSignals, conversationState and languageState.
 * Failure Modes: Dirty transcript fragments must be sanitized before context carryover.
 * Audit Events: conversation_context_handoff_validated
 * Notes: This bridge does not create history; it only validates and hardens the payload before the next layer.
 */
import { assertHandoffContract } from "../bridges/contracts/layer-handoff-contract";
import type { ProcessingState } from "../bridges/contracts/processing-state";

const CONVERSATION_TO_CONTEXT_CONTRACT = {
  from: "conversation",
  to: "context",
  requiredFields: ["recentTurns", "activeContext", "inputSignals", "conversationState", "languageState"],
} as const;

type TurnRole = "user" | "assistant";

function repairCommonMojibake(value: string): string {
  return `${value || ""}`
    .replace(/Ã¡/g, "á")
    .replace(/Ã /g, "à")
    .replace(/Ã¢/g, "â")
    .replace(/Ã£/g, "ã")
    .replace(/Ã¤/g, "ä")
    .replace(/Ã©/g, "é")
    .replace(/Ã¨/g, "è")
    .replace(/Ãª/g, "ê")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ã´/g, "ô")
    .replace(/Ãµ/g, "õ")
    .replace(/Ãº/g, "ú")
    .replace(/Ã§/g, "ç")
    .replace(/Ã\u0081/g, "Á")
    .replace(/Ã\u0089/g, "É")
    .replace(/Ã\u008D/g, "Í")
    .replace(/Ã\u0093/g, "Ó")
    .replace(/Ã\u009A/g, "Ú")
    .replace(/Ã\u0087/g, "Ç")
    .replace(/intelig[\uFFFD]ncia/gi, "inteligencia")
    .replace(/informa[\uFFFD]{1,2}es/gi, "informacoes")
    .replace(/fa[\uFFFD]a/gi, "faca")
    .replace(/d[\uFFFD]vida/gi, "duvida")
    .replace(/o que [\uFFFD]/gi, "o que e")
    .replace(/let[\uFFFD]cia/gi, "Leticia")
    .replace(/usu[\uFFFD]rio/gi, "Usuario")
    .replace(/\uFFFD+/g, "");
}

function collapseWhitespace(value: string): string {
  return `${value || ""}`.replace(/\s+/g, " ").trim();
}

function stripDialogueLabels(value: string): string {
  return `${value || ""}`
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*:\s*/gi, "\n")
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*-\s*/gi, "\n")
    .trim();
}

function sanitizeHandoffText(value: string): string {
  return collapseWhitespace(stripDialogueLabels(repairCommonMojibake(value)));
}

function sanitizeRecentTurns(
  turns: Array<{ role: "user" | "assistant"; content: string }>,
): Array<{ role: "user" | "assistant"; content: string }> {
  const sanitized: Array<{ role: "user" | "assistant"; content: string }> = [];

  for (const turn of turns || []) {
    const role: TurnRole = turn.role === "assistant" ? "assistant" : "user";
    const content = sanitizeHandoffText(turn.content);

    if (!content) continue;

    sanitized.push({
      role,
      content,
    });
  }

  return sanitized.slice(-16);
}

function sanitizeActiveContext(activeContext: string[]): string[] {
  return (activeContext || [])
    .map((item) => sanitizeHandoffText(item))
    .filter(Boolean)
    .slice(-24);
}

export function handoffConversationToContext(state: ProcessingState): ProcessingState {
  assertHandoffContract(state, CONVERSATION_TO_CONTEXT_CONTRACT);

  state.recentTurns = sanitizeRecentTurns(state.recentTurns);
  state.activeContext = sanitizeActiveContext(state.activeContext);
  state.conversationState.activeTopic =
    sanitizeHandoffText(state.conversationState.activeTopic) || "general";
  state.conversationState.followUpPrompt = state.conversationState.followUpPrompt
    ? sanitizeHandoffText(state.conversationState.followUpPrompt)
    : null;

  return state;
}