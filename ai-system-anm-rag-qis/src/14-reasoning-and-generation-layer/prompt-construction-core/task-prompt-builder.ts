/**
 * @file task-prompt-builder.ts
 * @description Monta as diretrizes de tarefa que entram no prompt de geração sem expor contratos internos ao usuário.
 * @layer 14-reasoning-and-generation-layer
 * @purpose Traduzir o TaskContract e o estado conversacional em comportamento de resposta adequado ao tipo cognitivo da tarefa.
 * @inputs ProcessingState com conversationState, deliberativeTaskState e taskContract.
 * @outputs Bloco textual de diretrizes para a geração da resposta.
 * @dependsOn ProcessingState e contratos cognitivos populados pela orquestração descendente.
 * @usedBy generation-layer-bridge durante a construção do prompt final.
 * @invariants As diretrizes podem orientar a resposta, mas nunca devem pedir exposição de metadados, camadas ou contratos internos.
 * @notes Para dedução fechada e raciocínio curto, prioriza solução direta e respeito estrito às restrições explícitas.
 */
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
  const cognitiveDirectives = buildCognitiveTaskDirectives(state);
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
    ...(cognitiveDirectives.length
      ? ["", "Diretrizes cognitivas da tarefa:", ...cognitiveDirectives.map((item) => `- ${item}`)]
      : []),
    ...(deliberativeDirectives.length
      ? ["", "Diretrizes deliberativas:", ...deliberativeDirectives.map((item) => `- ${item}`)]
      : []),
  ].join("\n");
}

function buildCognitiveTaskDirectives(state: ProcessingState): string[] {
  const contract = state.taskContract;
  if (!contract) {
    return [];
  }

  const directives: string[] = [];

  if (contract.explicitConstraints.length > 0) {
    directives.push(`Respeite estritamente estas restricoes do pedido: ${contract.explicitConstraints.slice(0, 5).join("; ")}.`);
  }

  if (contract.prohibitedActions.length > 0) {
    directives.push(`Nao execute nem sugira estas acoes proibidas pelo pedido: ${contract.prohibitedActions.slice(0, 5).join("; ")}.`);
  }

  if (contract.logicalAdequacy?.requiresConstraintProof) {
    directives.push(
      "Antes de formular a resposta, respeite o orcamento logico de acoes e observacoes do enunciado.",
      "Nao transforme problema fechado em exploracao; use as restricoes para deduzir, nao para propor novas tentativas.",
    );
  }

  if (contract.logicalAdequacy?.requiresPivotSelection) {
    directives.push(
      "Identifique o passo-pivo mais informativo sob a restricao antes de responder.",
      "Nao escolha uma caixa, opcao ou caminho de forma aleatoria quando houver uma escolha logicamente mais informativa.",
    );
  }

  switch (contract.cognitiveTaskType) {
    case "closed_constraint_deduction":
      directives.push(
        "Resolva a deducao fechada em vez de discutir possibilidades abertas.",
        "Comece pela acao ou conclusao correta e depois justifique em poucos passos.",
        "Nao proponha experimentos adicionais se o enunciado limitar a uma unica acao ou observacao.",
      );
      break;
    case "short_deterministic_reasoning":
      directives.push(
        "Entregue resposta curta, deterministica e verificavel.",
        "Evite explicacao longa quando a pergunta puder ser resolvida por uma inferencia direta.",
      );
      break;
    case "dialectical_counterargument":
      directives.push(
        "Contraponha de modo proporcional quando houver tese fragil, sem virar contrarianismo gratuito.",
        "Indique a premissa que precisa ser qualificada antes da conclusao.",
      );
      break;
    case "technical_analysis":
      directives.push(
        "Priorize diagnostico estrutural, causa provavel, impacto e ajuste tecnico concreto.",
        "Evite generalidades sem relacao com os artefatos do sistema.",
      );
      break;
    case "debug_and_correction":
      directives.push(
        "Foque em reproduzir o sintoma, localizar causa provavel e propor correcao verificavel.",
        "Diferencie claramente achado confirmado de hipotese tecnica.",
      );
      break;
    case "retrieval_grounded_analysis":
      directives.push(
        "Ancore afirmacoes factuais nas evidencias disponiveis.",
        "Se a evidencia recuperada for insuficiente, declare a insuficiencia em vez de completar por suposicao.",
      );
      break;
    case "pedagogical_explanation":
      directives.push(
        "Explique em progressao didatica, do ponto central para os detalhes.",
        "Use exemplo apenas se ele reduzir ambiguidade.",
      );
      break;
    case "procedural_instruction":
      directives.push(
        "Entregue passos executaveis em ordem pratica.",
        "Mencione pre-condicoes apenas quando elas bloquearem a execucao.",
      );
      break;
    case "decision_between_alternatives":
      directives.push(
        "Compare alternativas por criterio explicito e encerre com uma recomendacao.",
        "Mostre o trade-off dominante sem diluir a decisao.",
      );
      break;
    case "conversational_light":
    case "greeting_light":
      directives.push("Mantenha resposta breve e conversacional, sem expandir para analise desnecessaria.");
      break;
    default:
      break;
  }

  if (contract.expectedOutputFormat.length > 0) {
    directives.push(`Ajuste o formato de saida a: ${contract.expectedOutputFormat.slice(0, 4).join(", ")}.`);
  }

  return directives;
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
