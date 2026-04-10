/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 04-context-and-session-layer
 * Module: context-to-orchestration-bridge
 * Responsibility: Validate and sanitize the handoff from context/session layer to orchestration layer.
 * Primary Inputs: ProcessingState after context/session consolidation.
 * Primary Outputs: ProcessingState safe for orchestration intake.
 * Upstream Dependencies: context layer state updates, handoff contract assertion.
 * Downstream Dependencies: 05-complexity-and-orchestration-layer.
 * Invariants: activeContext, activeConstraints and selectedMode must be preserved in sanitized form.
 * Failure Modes: Transcript-like fragments or mojibake may contaminate orchestration if not normalized here.
 * Audit Events: context_orchestration_handoff_validated
 * Notes: This bridge is a hardening checkpoint, not the origin of session history.
 */
import { assertHandoffContract } from "../bridges/contracts/layer-handoff-contract";
import type { ProcessingState } from "../bridges/contracts/processing-state";

const CONTEXT_TO_ORCHESTRATION_CONTRACT = {
  from: "context",
  to: "orchestration",
  requiredFields: ["activeContext", "activeConstraints", "selectedMode"],
} as const;

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

function sanitizeStringArray(values: string[], limit: number): string[] {
  return (values || [])
    .map((item) => sanitizeHandoffText(item))
    .filter(Boolean)
    .slice(-limit);
}

export function handoffContextToOrchestration(state: ProcessingState): ProcessingState {
  assertHandoffContract(state, CONTEXT_TO_ORCHESTRATION_CONTRACT);

  state.activeContext = sanitizeStringArray(state.activeContext, 16);
  state.activeConstraints = sanitizeStringArray(state.activeConstraints, 32);

  if (state.userProfile && typeof state.userProfile === "object") {
    const sessionFocus = state.userProfile.sessionFocus;
    if (typeof sessionFocus === "string") {
      state.userProfile = {
        ...state.userProfile,
        sessionFocus: sanitizeHandoffText(sessionFocus),
      };
    }
  }

  return state;
}