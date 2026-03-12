import type { LeticiaIntent, LeticiaLocale, LeticiaTurnPlan } from "../types";
import { resolveLeticiaDialogueMode } from "./mode-resolver";

type ReplyKind = "gratitude" | "farewell" | "confirmation" | "negation" | "clarify" | "help";

function greetingReplyByLocale(locale: LeticiaLocale, normalizedText: string) {
  const value = normalizedText.trim();
  if (locale === "en-US") {
    if (value.startsWith("good morning")) return "Good morning. How can I help?";
    if (value.startsWith("good afternoon")) return "Good afternoon. How can I help?";
    if (value.startsWith("good evening")) return "Good evening. How can I help?";
    return "Hello. How can I help?";
  }
  if (locale === "es-ES") {
    if (value.startsWith("buenos dias")) return "Buenos dias. Como puedo ayudar?";
    if (value.startsWith("buenas tardes")) return "Buenas tardes. Como puedo ayudar?";
    if (value.startsWith("buenas noches")) return "Buenas noches. Como puedo ayudar?";
    return "Hola. Como puedo ayudar?";
  }
  if (value.startsWith("bom dia")) return "Bom dia. Como posso ajudar?";
  if (value.startsWith("boa tarde")) return "Boa tarde. Como posso ajudar?";
  if (value.startsWith("boa noite")) return "Boa noite. Como posso ajudar?";
  return "Oi. Como posso ajudar?";
}

function replyByLocale(locale: LeticiaLocale, kind: ReplyKind) {
  const replies: Record<LeticiaLocale, Record<ReplyKind, string>> = {
    "pt-BR": {
      gratitude: "Por nada.",
      farewell: "Ate mais.",
      confirmation: "Certo.",
      negation: "Tudo bem.",
      clarify: "Pode me dizer com mais clareza o que voce precisa?",
      help: "Claro. Me diga no que voce precisa de ajuda.",
    },
    "en-US": {
      gratitude: "You're welcome.",
      farewell: "See you later.",
      confirmation: "Alright.",
      negation: "Okay.",
      clarify: "Can you tell me more clearly what you need?",
      help: "Sure. Tell me what you need help with.",
    },
    "es-ES": {
      gratitude: "De nada.",
      farewell: "Hasta luego.",
      confirmation: "De acuerdo.",
      negation: "Esta bien.",
      clarify: "Puedes decirme con mas claridad que necesitas?",
      help: "Claro. Dime en que necesitas ayuda.",
    },
  };
  return replies[locale][kind];
}

export function planLeticiaTurn(intent: LeticiaIntent): LeticiaTurnPlan {
  const mode = resolveLeticiaDialogueMode(intent);
  if (intent.name === "greeting") {
    return { mode, directReply: greetingReplyByLocale(intent.locale, intent.normalizedText), promptPrefix: "" };
  }
  if (intent.name === "gratitude") {
    return { mode, directReply: replyByLocale(intent.locale, "gratitude"), promptPrefix: "" };
  }
  if (intent.name === "farewell") {
    return { mode, directReply: replyByLocale(intent.locale, "farewell"), promptPrefix: "" };
  }
  if (intent.name === "confirmation") {
    return { mode, directReply: replyByLocale(intent.locale, "confirmation"), promptPrefix: "" };
  }
  if (intent.name === "negation") {
    return { mode, directReply: replyByLocale(intent.locale, "negation"), promptPrefix: "" };
  }
  if (intent.name === "help_request" && intent.isMicroTurn) {
    return { mode, directReply: replyByLocale(intent.locale, "help"), promptPrefix: "" };
  }
  if (intent.name === "ambiguous") {
    return { mode, directReply: replyByLocale(intent.locale, "clarify"), promptPrefix: "" };
  }

  return {
    mode,
    directReply: null,
    promptPrefix: "Responda ao usuario de forma conversacional, direta e natural.",
  };
}
