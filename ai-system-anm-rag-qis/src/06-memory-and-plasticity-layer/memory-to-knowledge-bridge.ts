/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 06-memory-and-plasticity-layer
 * Module: memory-to-knowledge-bridge
 * Responsibility: Validate and sanitize the handoff from memory layer to knowledge layer.
 * Primary Inputs: ProcessingState after memory retrieval/plasticity.
 * Primary Outputs: ProcessingState safe for knowledge grounding and retrieval.
 * Upstream Dependencies: memory layer state updates, handoff contract assertion.
 * Downstream Dependencies: 07-knowledge-retrieval-and-research-layer.
 * Invariants: memorySnapshot must remain intact as canonical memory state.
 * Failure Modes: Dirty memory text, active context or constraints may contaminate knowledge retrieval if not normalized here.
 * Audit Events: memory_knowledge_handoff_validated
 * Notes: This bridge is a hardening checkpoint, not a memory mutation engine.
 */
import { assertHandoffContract } from "../bridges/contracts/layer-handoff-contract";
import type { ProcessingState } from "../bridges/contracts/processing-state";

const MEMORY_TO_KNOWLEDGE_CONTRACT = {
  from: "memory",
  to: "knowledge",
  requiredFields: ["memorySnapshot"],
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

export function handoffMemoryToKnowledge(state: ProcessingState): ProcessingState {
  assertHandoffContract(state, MEMORY_TO_KNOWLEDGE_CONTRACT);

  state.normalizedMessage = sanitizeText(state.normalizedMessage || state.rawMessage);
  state.activeContext = sanitizeStringArray(state.activeContext, 20);
  state.activeConstraints = sanitizeStringArray(state.activeConstraints, 32);
  state.recentTurns = sanitizeRecentTurns(state.recentTurns, 16);

  state.memorySnapshot.records = (state.memorySnapshot.records || [])
    .map((record) => ({
      ...record,
      content: sanitizeText(record.content),
    }))
    .filter((record) => Boolean(record.content))
    .slice(-64);

  state.memorySnapshot.globalNamespaces = {
    ...state.memorySnapshot.globalNamespaces,
    identity: sanitizeStringArray(state.memorySnapshot.globalNamespaces.identity || [], 16),
    semantic: sanitizeStringArray(state.memorySnapshot.globalNamespaces.semantic || [], 16),
    procedural: sanitizeStringArray(state.memorySnapshot.globalNamespaces.procedural || [], 16),
    social: sanitizeStringArray(state.memorySnapshot.globalNamespaces.social || [], 16),
    value: sanitizeStringArray(state.memorySnapshot.globalNamespaces.value || [], 16),
    attention: sanitizeStringArray(state.memorySnapshot.globalNamespaces.attention || [], 16),
    metacognitive: sanitizeStringArray(state.memorySnapshot.globalNamespaces.metacognitive || [], 16),
    prospective: sanitizeStringArray(state.memorySnapshot.globalNamespaces.prospective || [], 16),
    perceptual: sanitizeStringArray(state.memorySnapshot.globalNamespaces.perceptual || [], 16),
  };

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