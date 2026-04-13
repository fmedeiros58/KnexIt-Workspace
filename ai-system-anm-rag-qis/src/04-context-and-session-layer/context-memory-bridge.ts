/**
 * ANM ARCHITECTURAL SPEC
 * Layer: memory-bridge
 * Module: load-context-memory-bridge
 * Responsibility: Harden and pass forward context-bearing state before memory operations.
 * Primary Inputs: ProcessingState after orchestration/context preparation.
 * Primary Outputs: Sanitized ProcessingState safe for memory layer consumption.
 * Upstream Dependencies: bridges/contracts/processing-state
 * Downstream Dependencies: memory-and-plasticity-layer
 * Invariants: This bridge does not create memory records; it only normalizes state surfaces.
 * Failure Modes: Dirty transcript fragments or mojibake may contaminate memory selection if not normalized here.
 * Audit Events: context_memory_bridge_hardened
 * Notes: This is a non-destructive checkpoint.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";

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

function sanitizeText(value: string): string {
  return collapseWhitespace(stripDialogueLabels(repairCommonMojibake(value)));
}

function sanitizeStringArray(values: string[], limit: number): string[] {
  return (values || [])
    .map((item) => sanitizeText(item))
    .filter(Boolean)
    .slice(-limit);
}

function sanitizeRecentTurns(
  turns: Array<{ role: "user" | "assistant"; content: string }>,
  limit = 16,
): Array<{ role: "user" | "assistant"; content: string }> {
  const sanitized: Array<{ role: "user" | "assistant"; content: string }> = [];

  for (const turn of turns || []) {
    const role: TurnRole = turn.role === "assistant" ? "assistant" : "user";
    const content = sanitizeText(turn.content);
    if (!content) continue;

    sanitized.push({
      role,
      content,
    });
  }

  return sanitized.slice(-limit);
}

export async function loadContextMemoryBridge(state: ProcessingState): Promise<ProcessingState> {
  state.recentTurns = sanitizeRecentTurns(state.recentTurns, 16);
  state.activeContext = sanitizeStringArray(state.activeContext, 20);
  state.activeConstraints = sanitizeStringArray(state.activeConstraints, 32);
  state.normalizedMessage = sanitizeText(state.normalizedMessage || state.rawMessage);

  if (state.userProfile && typeof state.userProfile === "object") {
    const sessionFocus = state.userProfile.sessionFocus;
    if (typeof sessionFocus === "string") {
      state.userProfile = {
        ...state.userProfile,
        sessionFocus: sanitizeText(sessionFocus),
      };
    }
  }

  return state;
}