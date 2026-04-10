import type { ProcessingState } from "../../bridges/contracts/processing-state";

const MAX_TOPIC_CHARS = 120;
const MAX_FOLLOW_UP_CHARS = 160;

export function buildTaskPrompt(state: ProcessingState): string {
  const conversation = state.conversationState;
  const deliberative = state.generalTaskDeliberationState || state.deliberativeTaskState;
  const deliberativeActive = Boolean(deliberative?.isActive && deliberative?.reasoningContract);

  const baseDirectives = [
    "Responda ao pedido atual do usuario sem repetir, traduzir ou reorganizar o enunciado na abertura.",
    "Nao reproduza historico de conversa, memoria bruta, contexto auxiliar, rotulos como 'Usuario:' ou 'Assistente:', nem nomes de persona.",
    "Nao exponha contratos internos, estados do sistema, modulos, camadas, politicas internas ou mecanismos de orquestracao.",
    "Use apenas o que for util para responder ao pedido atual com continuidade, clareza e precisao.",
    "Mantenha o mesmo idioma da conversa e escreva em linguagem natural.",
  ];

  const conversationDirectives = buildConversationDirectives(state);
  const deliberativeDirectives = deliberativeActive ? buildDeliberativeBehavioralBrief(state) : [];
  const styleDirectives = deliberativeActive
    ? [
        "Entregue a resposta em paragrafos naturais e densos.",
        "Nao anuncie roteiro, etapas internas ou plano de resposta.",
      ]
    : [
        "Entregue diretamente a resposta.",
        "Use no maximo uma justificativa curta quando necessario.",
      ];

  return [
    "Tarefa principal:",
    ...baseDirectives.map((item) => `- ${item}`),
    "",
    "Diretrizes de resposta:",
    ...styleDirectives.map((item) => `- ${item}`),
    ...(conversationDirectives.length
      ? ["", "Diretrizes conversacionais:", ...conversationDirectives.map((item) => `- ${item}`)]
      : []),
    ...(deliberativeDirectives.length
      ? ["", "Diretrizes deliberativas:", ...deliberativeDirectives.map((item) => `- ${item}`)]
      : []),
  ].join("\n");
}

function buildDeliberativeBehavioralBrief(state: ProcessingState): string[] {
  const deliberative = state.generalTaskDeliberationState || state.deliberativeTaskState;
  if (!deliberative?.isActive || !deliberative.reasoningContract) {
    return [];
  }

  const obligationTypes = new Set((deliberative.obligationGraph ?? []).map((item) => item.type));
  const directives: string[] = [
    "Execute todas as exigencias detectadas antes da conclusao, sem expor o contrato interno.",
  ];

  if (obligationTypes.has("demonstration")) {
    directives.push("Quando houver pedido de demonstracao, mostre premissas, condicoes e derivacao explicita.");
  }

  if (obligationTypes.has("distinction")) {
    directives.push("Quando houver distincao, separe categorias proximas com criterio claro.");
  }

  if (
    obligationTypes.has("proposal") ||
    obligationTypes.has("comparison") ||
    obligationTypes.has("planning") ||
    obligationTypes.has("decision")
  ) {
    directives.push("Quando houver alternativas, explique mecanismo, trade-offs e justificativa da escolha.");
  }

  if (obligationTypes.has("objection")) {
    directives.push("Inclua a melhor objecao contra a propria solucao preferida antes do fechamento.");
  }

  if (obligationTypes.has("reformulation")) {
    directives.push("Se a tarefa exigir incerteza, reformule a conclusao com estimativa e margem de erro.");
  }

  if (obligationTypes.has("assumption_audit")) {
    directives.push("Feche com pressupostos e limites nao demonstrados quando isso for pedido.");
  }

  return directives;
}

function buildConversationDirectives(state: ProcessingState): string[] {
  const conversation = state.conversationState;
  const directives: string[] = [];

  const activeTopic = sanitizePromptFragment(conversation.activeTopic, MAX_TOPIC_CHARS);
  if (activeTopic) {
    directives.push(`Considere como topico conversacional ativo apenas esta formulacao resumida: ${activeTopic}.`);
  }

  if (conversation.needsClarification) {
    const safeFollowUp =
      sanitizePromptFragment(
        conversation.followUpPrompt,
        MAX_FOLLOW_UP_CHARS,
      ) || "Voce pode esclarecer em uma frase o objetivo principal agora?";

    directives.push(`Antes de concluir, faca uma unica pergunta curta de clarificacao: ${safeFollowUp}`);
  }

  if (conversation.rapportScore >= 0.65) {
    directives.push("Mantenha continuidade dialogal e tom cooperativo.");
  } else if (conversation.rapportScore <= 0.35) {
    directives.push("Responda de forma mais objetiva e acolhedora para reduzir friccao.");
  }

  return directives;
}

function sanitizePromptFragment(raw: string | null | undefined, maxChars: number): string | null {
  if (!raw || typeof raw !== "string") {
    return null;
  }

  let text = normalizeWhitespace(raw);
  if (!text) {
    return null;
  }

  if (isLikelyTranscript(text)) {
    return null;
  }

  text = stripRoleMarkers(text);
  text = normalizeWhitespace(text);

  if (!text || isLowValueText(text)) {
    return null;
  }

  return clampText(text, maxChars);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripRoleMarkers(value: string): string {
  return value
    .replace(
      /\b(?:usuario|usuário|user|assistente|assistant|sistema|system|let[ií]cia|humano|ai|modelo)\s*:\s*/gi,
      "",
    )
    .replace(/["'`]+/g, "")
    .trim();
}

function isLikelyTranscript(value: string): boolean {
  const markers =
    value.match(
      /\b(?:usuario|usuário|user|assistente|assistant|sistema|system|let[ií]cia|humano|ai|modelo)\s*:/gi,
    ) ?? [];

  const hasLineBreaks = /[\r\n]/.test(value);
  return markers.length >= 2 || (markers.length >= 1 && hasLineBreaks);
}

function isLowValueText(value: string): boolean {
  const normalized = value.toLowerCase();
  return normalized === "vazio" || normalized === "(vazio)" || value.length < 4;
}

function clampText(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, maxChars - 1).trimEnd()}…`;
}