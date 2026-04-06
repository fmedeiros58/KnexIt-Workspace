import type { IntentGatePrimaryIntent } from "../intent-gate.types";

export const PRIMARY_INTENT_PATTERNS: Array<{ intent: IntentGatePrimaryIntent; patterns: RegExp[] }> = [
  {
    intent: "request_help",
    patterns: [/\b(me ajuda|pode me ajudar|me ajude|ajuda nisso|help me)\b/i],
  },
  {
    intent: "ask_validation",
    patterns: [/\b(esta certo|ta certo|faz sentido|seria isso|isso esta correto|esta correto)\b/i],
  },
  {
    intent: "ask_correction",
    patterns: [/\b(corrige|corrigir|na verdade|isso nao|nao seria|isso esta errado)\b/i],
  },
  {
    intent: "ask_comparison",
    patterns: [/\b(qual (?:e|eh)? melhor|qual fica melhor|mais adequado|pior opcao|comparar)\b/i],
  },
  {
    intent: "ask_execution",
    patterns: [/\b(faca|faz|implemente|ajuste|adicione|adiciona|coloque|coloca|execute)\b/i],
  },
  {
    intent: "ask_explanation",
    patterns: [/\b(explique|explica|como funciona|por que|porque|pq|qual a logica)\b/i],
  },
  {
    intent: "ask_information",
    patterns: [/\b(qual|quem|quando|onde|o que|que dia|me diga)\b/i],
  },
  {
    intent: "ask_refinement",
    patterns: [/\b(refina|refinar|melhora|melhorar|ajusta melhor|deixa melhor)\b/i],
  },
  {
    intent: "acknowledge",
    patterns: [/\b(ok|certo|entendi|perfeito|show|blz|beleza)\b/i],
  },
  {
    intent: "react_socially",
    patterns: [/\b(obrigado|valeu|de nada|tchau|ate mais|boa tarde|bom dia|boa noite|oi|ola)\b/i],
  },
];
