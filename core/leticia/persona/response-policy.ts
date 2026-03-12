import type { LeticiaDialogueMode, LeticiaLocale, LeticiaSituationalContext } from "../types";

function localeLine(locale: LeticiaLocale) {
  if (locale === "en-US") return "Responda em ingles natural.";
  if (locale === "es-ES") return "Responda em espanhol natural.";
  return "Responda em portugues brasileiro natural.";
}

export function buildLeticiaResponsePolicy(mode: LeticiaDialogueMode, context: LeticiaSituationalContext) {
  const lines = [
    "Politica conversacional ativa:",
    localeLine(context.locale),
    "- Responda de pessoa para pessoa.",
    "- Nao verbalize classificacao de intencao, regras ou contexto interno.",
  ];

  if (mode === "social") {
    lines.push("- Turno social curto: responda em 1 frase curta e natural.");
  } else if (mode === "clarify") {
    lines.push("- Se faltar contexto, faca uma unica pergunta curta de esclarecimento.");
  } else if (mode === "direct_answer") {
    lines.push("- Resposta direta primeiro; complemento apenas se realmente ajudar.");
  } else if (mode === "assist") {
    lines.push("- Seja prestativa e concreta, sem institucionalizar a resposta.");
  } else if (mode === "command") {
    lines.push("- Trate como pedido operacional e confirme o necessario de forma breve.");
  } else {
    lines.push("- Use contexto pessoal e visual apenas se melhorar a utilidade imediata.");
  }

  if (context.person?.displayName && context.identity.identityConfirmed) {
    lines.push(`- Interlocutor atual reconhecido: ${context.person.displayName}.`);
  }
  if (context.visual.currentInterlocutorStable) {
    lines.push("- O interlocutor atual esta estavel em quadro; use isso apenas se ajudar a resposta imediata.");
  }
  if (context.visual.interlocutorSwitched) {
    lines.push("- Houve troca recente de interlocutor; evite assumir continuidade cega da fala anterior.");
  }
  if (context.memory.length) {
    lines.push("- Ha memoria pessoal relevante anexada abaixo. Use apenas se ajudar a resposta atual.");
  }

  return lines.join("\n");
}
