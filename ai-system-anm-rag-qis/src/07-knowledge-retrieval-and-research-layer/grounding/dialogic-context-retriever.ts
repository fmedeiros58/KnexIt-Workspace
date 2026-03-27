/**
 * Responsabilidade do arquivo:
 * - Recuperar contexto dialogico relevante para co-construcao de resposta.
 * - Priorizar ultimos turnos e contexto ativo com afinidade lexical a consulta.
 * - Oferecer base conversacional sem duplicar memoria de longo prazo.
 */
import type { DeliberativeGroundingInput, DialogicContextItem } from "./grounded-evidence-packet";
import { normalizeGroundingText, scoreLexicalAffinity } from "./grounding-normalizer";

export function retrieveDialogicContext(input: DeliberativeGroundingInput, maxItems = 6): DialogicContextItem[] {
  const fromTurns = input.recentTurns
    .slice(-8)
    .map((turn, index) => ({
      id: `dialogic:turn:${index + 1}`,
      role: turn.role,
      content: normalizeGroundingText(turn.content, 280),
      relevance: scoreLexicalAffinity(input.query, turn.content),
    }));

  const fromActiveContext = input.activeContext
    .slice(-8)
    .map((content, index) => ({
      id: `dialogic:context:${index + 1}`,
      role: "system" as const,
      content: normalizeGroundingText(content, 260),
      relevance: scoreLexicalAffinity(input.query, content),
    }));

  return [...fromTurns, ...fromActiveContext]
    .filter((item) => item.content.length >= 8)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, maxItems);
}

