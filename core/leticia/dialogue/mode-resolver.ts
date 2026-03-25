import type { LeticiaDialogueMode, LeticiaIntent } from "../types";

export function resolveLeticiaDialogueMode(intent: LeticiaIntent): LeticiaDialogueMode {
  switch (intent.name) {
    case "greeting":
    case "gratitude":
    case "farewell":
    case "confirmation":
    case "negation":
      return "social";
    case "help_request":
      return "assist";
    case "command":
      return "command";
    case "question":
      return "direct_answer";
    case "ambiguous":
      return "clarify";
    default:
      return intent.isMicroTurn ? "clarify" : "contextual";
  }
}

