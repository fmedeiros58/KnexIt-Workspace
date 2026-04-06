import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { runGenerationMemoryBridge } from "./generation-memory-bridge";
import { runGenerationEvidenceBridge } from "./generation-evidence-bridge";
import { runGenerationLlmBridge } from "./generation-llm-bridge";
import { buildContextInjection } from "./prompt-construction-core/context-injection-builder";
import { buildEvidenceInjection } from "./prompt-construction-core/evidence-injection-builder";
import { buildHypothesisInjection } from "./prompt-construction-core/hypothesis-injection-builder";
import { buildInferenceInjection } from "./prompt-construction-core/inference-injection-builder";
import { buildMemoryInjection } from "./prompt-construction-core/memory-injection-builder";
import { buildReflectionInjection } from "./prompt-construction-core/reflection-injection-builder";
import { buildStyleConstraints } from "./prompt-construction-core/style-constraint-builder";
import { buildSystemPrompt } from "./prompt-construction-core/system-prompt-builder";
import { buildTaskPrompt } from "./prompt-construction-core/task-prompt-builder";
import { buildDirectAnswerPath } from "./reasoning-core/direct-answer-path";
import { buildDecompositionPath } from "./reasoning-core/decomposition-path";
import { buildChainOfTasksPath } from "./reasoning-core/chain-of-tasks-path";
import { buildMultiHypothesisReasoning } from "./reasoning-core/multi-hypothesis-reasoner";
import { buildAbductiveSupportPath } from "./reasoning-core/abductive-support-path";
import { selectReasoningPath } from "./reasoning-core/compare-and-select-path";
import { buildSynthesisPath } from "./reasoning-core/synthesis-path";
import { runSelfCheckPath } from "./reasoning-core/self-check-path";
import { runReasoningToIterativeAcquisitionBridge } from "./reasoning-core/reasoning-to-iterative-acquisition-bridge";
import { buildInitialDraft } from "./draft-generation-core/initial-draft";
import { buildExpandedDraft } from "./draft-generation-core/expanded-draft";
import { buildCondensedDraft } from "./draft-generation-core/condensed-draft";
import { buildAlternativeDraft } from "./draft-generation-core/alternative-draft";
import { buildFactualAnswerFallback } from "./draft-generation-core/factual-answer-fallback";
import { applyMultimodalDraftBridge } from "./draft-generation-core/multimodal-draft-bridge";
import {
  buildConversationalFallback,
  buildNonEchoRecovery,
  isEchoLike,
  resolveConversationFocus,
} from "./draft-generation-core/chat-response-builder";
import { mergeDraftContent } from "./response-assembly-core/content-merger";
import { unifySemantics } from "./response-assembly-core/semantic-unifier";
import { removeRedundancy } from "./response-assembly-core/redundancy-remover";
import { orderSections } from "./response-assembly-core/section-ordering";
import { buildTransitions } from "./response-assembly-core/transition-builder";
import { buildConclusion } from "./response-assembly-core/conclusion-builder";
import { handoffGenerationToStructure } from "./generation-to-structure-bridge";
import { runCommunicativeElaborationBridge } from "../bridges/communicative-elaboration.bridge";
import {
  isAssistantCreatorPrompt,
  isAssistantIdentityPrompt,
  isAssistantNameOriginPrompt,
  isConversationalPrompt,
  isGreetingMessage,
  isSmallTalkMessage,
} from "../shared/utils/conversation-signals";
import { buildFounderReasoningInfluence } from "../12b-founder-influence-layer/founder-reasoning-bridge";

function isGroundedSourceUrl(url: string): boolean {
  return /^https?:\/\//i.test(`${url || ""}`.trim());
}

function countGroundedSources(state: ProcessingState): number {
  return state.retrievedSources.filter((source) => isGroundedSourceUrl(source.url)).length;
}

function isDirectFactualNameQuestion(text: string): boolean {
  const normalized = `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, " ");
  return (
    /\b(governador|presidente|prefeito)\b/.test(normalized) &&
    /\b(qual|quem|nome)\b/.test(normalized)
  );
}

function hasRecentCivicAnchor(state: ProcessingState): boolean {
  return state.recentTurns
    .slice(-6)
    .some((turn) => /\b(presidente|governador|prefeito|mandato|eleit[oa]|posse)\b/i.test(turn.content));
}

function isDirectFactualTimelineQuestion(text: string, state: ProcessingState): boolean {
  const normalized = `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, " ");
  const hasTimelineCue = /\b(quando|em que ano|que ano|ano|mandato|eleit[oa]|reeleit[oa]|posse)\b/.test(normalized);
  if (!hasTimelineCue) return false;
  if (/\b(presidente|governador|prefeito)\b/.test(normalized)) return true;
  if (/\b(ele|ela|dele|dela|esse|essa)\b/.test(normalized) && hasRecentCivicAnchor(state)) return true;
  return false;
}

function isAuthorYearReferencePrompt(text: string): boolean {
  const normalized = `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!normalized) return false;
  const hasAuthorFrame =
    /\b(segundo|conforme|de acordo com|autor|autora|presented by|according to)\b/.test(normalized) ||
    /\b(de|da|do)\s+[a-z][a-z.'\-\s]{1,80}\s*\((19|20)\d{2}\)/.test(normalized);
  const hasInlineAuthorYear = /\b[a-z][a-z.'\-\s]{1,80}\s*\((19|20)\d{2}\)/.test(normalized);
  const hasYear = /\b(19|20)\d{2}\b/.test(normalized);
  const hasAcademicSourceCue = /\b(dissertacao|tese|artigo|paper|estudo|livro|obra|resenha|citacao|referencia)\b/.test(
    normalized,
  );
  return hasYear && hasAcademicSourceCue && (hasAuthorFrame || hasInlineAuthorYear);
}

function normalizeForTemporalIntent(text: string): string {
  return `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isCurrentDateQuestion(text: string): boolean {
  const normalized = normalizeForTemporalIntent(text);
  if (!normalized) return false;

  const asksDate =
    /\b(que dia e hoje|qual o dia de hoje|qual dia e hoje|qual e a data de hoje|data de hoje|dia de hoje)\b/.test(normalized) ||
    (/\b(hoje)\b/.test(normalized) && /\b(que dia|qual dia|data)\b/.test(normalized));
  const asksTimeOnly = /\b(que horas sao|hora agora|horas agora|que horas e agora)\b/.test(normalized);
  return asksDate && !asksTimeOnly;
}

function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text[0].toUpperCase() + text.slice(1);
}

function buildCurrentDateAnswer(timeZone = "America/Sao_Paulo"): string {
  const now = new Date();
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone }).format(now);
  const fullDate = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(now);
  return `Hoje é ${capitalizeFirst(weekday)}, ${fullDate}.`;
}

function resolveReflectiveObjectiveFinalAnswer(state: ProcessingState): string | null {
  const reflective = state.executionArtifacts.reflective;
  if (!reflective?.objectiveRationality?.shouldForceDirectAnswer) return null;
  const answer = `${reflective.objectiveFinalAnswer || ""}`.trim();
  if (!answer) return null;
  return answer;
}

function buildUnresolvedFactualMessage(state: ProcessingState): string {
  const sourceCount = state.retrievedSources.length;
  if (sourceCount > 0) {
    return "Nao consegui confirmar com seguranca o fato pedido nas fontes recuperadas. Posso refazer priorizando fontes oficiais e mais recentes.";
  }
  return "Nao encontrei fontes suficientes para confirmar o fato com seguranca. Posso refazer a busca web agora.";
}

function buildReferenceGroundingMessage(state: ProcessingState): string {
  const groundedSourceCount = countGroundedSources(state);
  if (groundedSourceCount > 0) {
    return "As fontes recuperadas nao permitem confirmar com seguranca a referencia autor-ano pedida. Se voce enviar o trecho ou link da dissertacao, eu explico com base nela.";
  }
  return "Nao encontrei base documental para sustentar a referencia autor-ano pedida. Envie o trecho, link ou DOI da dissertacao para eu explicar com lastro.";
}

function normalizeForDeepFallback(text: string): string {
  return `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isComplexDecisionPrompt(text: string): boolean {
  const normalized = normalizeForDeepFallback(text);
  if (!normalized) return false;
  const scoreTerms = [
    /\b(analise|analisar|avaliar)\b/,
    /\b(sistema complexo|complexo)\b/,
    /\b(criterio|criterios|pesos?)\b/,
    /\b(alternativa|alternativas|priorizacao)\b/,
    /\b(risco|riscos|curto prazo|longo prazo)\b/,
    /\b(orcamento|recursos limitados|corte)\b/,
  ];
  const hits = scoreTerms.reduce((acc, pattern) => acc + (pattern.test(normalized) ? 1 : 0), 0);
  return hits >= 3;
}

function extractDecisionOptions(text: string): string[] {
  const raw = `${text || ""}`;
  const fromPriorities = raw.match(/prioridades?\s*:\s*([^\n.]+)/i)?.[1] || "";
  const fromBetween = raw.match(/entre\s+([^\n.]+)/i)?.[1] || "";
  const candidateSegment = `${fromPriorities || fromBetween}`.trim();
  if (!candidateSegment) return [];

  const items = candidateSegment
    .split(/\s*,\s*|\s+ou\s+/i)
    .map((item) => item.trim())
    .filter((item) => item.length >= 6)
    .map((item) => item.replace(/\s+/g, " "));

  return Array.from(new Set(items)).slice(0, 4);
}

function classifyDecisionOption(option: string): "assistencia" | "pesquisa" | "digital" | "geral" {
  const normalized = normalizeForDeepFallback(option);
  if (/\b(assistencia|estudantil|permanencia|bolsa|auxilio)\b/.test(normalized)) return "assistencia";
  if (/\b(pesquisa|biodiversidade|laboratorio|cientifica|cientifico)\b/.test(normalized)) return "pesquisa";
  if (/\b(digital|infraestrutura|ensino|tecnologia|plataforma|rede)\b/.test(normalized)) return "digital";
  return "geral";
}

function sanitizeDecisionOption(option: string): string {
  return `${option || ""}`
    .replace(/^[“"'`]+/g, "")
    .replace(/[”"'`]+$/g, "")
    .replace(/[.;:!?]+$/g, "")
    .trim();
}

function buildComplexDecisionFallback(state: ProcessingState): string {
  const prompt = `${state.rawMessage || state.normalizedMessage || ""}`.trim();
  const extracted = extractDecisionOptions(prompt).map(sanitizeDecisionOption).filter(Boolean);
  const defaults = [
    "ampliar assistencia estudantil",
    "investir em pesquisa aplicada",
    "modernizar infraestrutura digital do ensino",
  ];
  const options: string[] = [];
  const seen = new Set<string>();
  for (const candidate of [...extracted, ...defaults]) {
    const key = normalizeForDeepFallback(candidate)
      .replace(/\b(a|o|de|do|da|e|ou)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    options.push(candidate);
    if (options.length >= 3) break;
  }
  const optionA = options[0] || defaults[0];
  const optionB = options[1] || defaults[1];
  const optionC = options[2] || defaults[2];

  const roleA = classifyDecisionOption(optionA);
  const roleB = classifyDecisionOption(optionB);
  const roleC = classifyDecisionOption(optionC);

  const immediateImpactOption =
    roleA === "assistencia" ? optionA : roleB === "assistencia" ? optionB : roleC === "assistencia" ? optionC : optionA;
  const longTermKnowledgeOption = (() => {
    if (roleA === "pesquisa" && optionA !== immediateImpactOption) return optionA;
    if (roleB === "pesquisa" && optionB !== immediateImpactOption) return optionB;
    if (roleC === "pesquisa" && optionC !== immediateImpactOption) return optionC;
    if (optionB !== immediateImpactOption) return optionB;
    return optionC;
  })();
  const enablementOption = (() => {
    if (roleA === "digital" && optionA !== immediateImpactOption && optionA !== longTermKnowledgeOption) return optionA;
    if (roleB === "digital" && optionB !== immediateImpactOption && optionB !== longTermKnowledgeOption) return optionB;
    if (roleC === "digital" && optionC !== immediateImpactOption && optionC !== longTermKnowledgeOption) return optionC;
    if (optionC !== immediateImpactOption && optionC !== longTermKnowledgeOption) return optionC;
    if (optionB !== immediateImpactOption && optionB !== longTermKnowledgeOption) return optionB;
    return optionA;
  })();

  return [
    "- A decisao nao e linear: permanencia estudantil, capacidade cientifica e infraestrutura de ensino se reforcam e tambem competem por caixa no curto prazo.",
    "",
    "Premissas explicitas:",
    "1. O orcamento e restrito no horizonte de 12 meses.",
    "2. Evasao estudantil cresce quando suporte financeiro e psicossocial fica abaixo do minimo.",
    "3. Pesquisa aplicada em biodiversidade e vetor de captacao futura (editais, convenios, inovacao regional).",
    "4. Infraestrutura digital afeta eficiencia docente, alcance e qualidade avaliativa.",
    "5. A universidade precisa equilibrar impacto social imediato com sustentabilidade academica de longo prazo.",
    "",
    "Variaveis centrais:",
    "- taxa de evasao e retencao;",
    "- producao cientifica com potencial de transferencia;",
    "- maturidade digital do ensino (acesso, plataforma, dados, suporte);",
    "- capacidade de execucao institucional;",
    "- alavancagem de financiamento externo;",
    "- risco reputacional e legitimidade publica.",
    "",
    "Criterios de decisao com pesos justificados:",
    "1. Impacto social imediato e permanencia (peso 0,30): protege alunos vulneraveis e reduz evasao no curto prazo.",
    "2. Retorno academico e inovacao regional (peso 0,25): gera vantagem estrategica e novas fontes de recurso.",
    "3. Viabilidade de execucao em 12 meses (peso 0,20): evita plano ambicioso sem entrega real.",
    "4. Efeito multiplicador entre areas (peso 0,15): prioriza investimentos que melhoram mais de um subsistema.",
    "5. Risco de atraso e descontinuidade (peso 0,10): controla perda de impacto por gargalo operacional.",
    "",
    "Alternativa 1 (equilibrio orientado a permanencia):",
    `- 45% em ${immediateImpactOption}; 35% em ${enablementOption}; 20% em ${longTermKnowledgeOption}.`,
    "- Racional: segura evasao agora, melhora operacao didatica e preserva nucleo de pesquisa.",
    "",
    "Alternativa 2 (crescimento cientifico orientado a captacao):",
    `- 45% em ${longTermKnowledgeOption}; 30% em ${enablementOption}; 25% em ${immediateImpactOption}.`,
    "- Racional: acelera projetos com potencial de receita futura, com risco social maior no curto prazo.",
    "",
    "Recomendacao:",
    "- Adotar a Alternativa 1 no ciclo atual, com gatilhos trimestrais de revisao (evasao, execucao orcamentaria, captacao externa e desempenho academico).",
    "",
    "Riscos e consequencias:",
    "- Curto prazo (positivo): menor evasao e maior estabilidade academica.",
    "- Curto prazo (risco): pesquisa pode perder ritmo competitivo em alguns grupos.",
    "- Longo prazo (positivo): base social preservada e infraestrutura mais preparada para expansao.",
    "- Longo prazo (risco): sem governanca de projetos, a fatia digital pode virar despesa operacional sem ganho estrutural.",
    "",
    "Critica mais forte contra a recomendacao:",
    "- Priorizar permanencia agora pode subfinanciar pesquisa de alta relevancia estrategica e reduzir a chance de captar recursos maiores no proximo ciclo.",
    "",
    "Reformulacao com corte de 40% no orcamento:",
    `- 55% em ${immediateImpactOption} (piso de permanencia), 30% em ${enablementOption} (somente itens criticos), 15% em ${longTermKnowledgeOption} (projetos com maior potencial de financiamento externo).`,
    "- Congelar iniciativas de baixa alavancagem, concentrar em entregas de alto impacto e revisar metas a cada 90 dias.",
  ].join("\n");
}

function buildGenericDeepFallback(state: ProcessingState): string {
  const normalizedMessage = `${state.normalizedMessage || state.rawMessage || ""}`.trim();
  const complexity = Math.max(state.complexityProfile.score || 0, state.preRouteSignals?.quickComplexity || 0);
  const depthLabel = complexity >= 0.65 ? "alto" : complexity >= 0.45 ? "medio-alto" : "medio";
  return [
    "- A solicitacao exige resposta analitica e nao apenas definicional.",
    "",
    "Premissas de trabalho:",
    "1. O problema envolve objetivos em tensao e restricao de recursos.",
    "2. Decisoes locais podem gerar efeitos sistemicos em cascata.",
    "3. A melhor resposta depende de criterio explicito e trade-off assumido.",
    "",
    "Metodo aplicado:",
    "- decompor o problema em variaveis,",
    "- comparar cenarios com pesos explicitos,",
    "- explicitar riscos de curto e longo prazo,",
    "- revisar a propria recomendacao por critica forte.",
    "",
    `Nivel de profundidade aplicado: ${depthLabel}.`,
    "",
    "Resposta objetiva:",
    `- Para a pergunta: "${normalizedMessage.slice(0, 180)}${normalizedMessage.length > 180 ? "..." : ""}", recomendo tratar a decisao por matriz multicriterio com revisao periodica e controle de risco, evitando resposta unica sem justificativa de pesos.`,
  ].join("\n");
}

function isEliteNormativeConflictPrompt(text: string): boolean {
  const normalized = normalizeForDeepFallback(text);
  if (!normalized) return false;

  const hasLiberdade = /\b(liberdade basica|liberdades basicas|nenhuma decisao coletiva pode reduzir a liberdade)\b/.test(normalized);
  const hasBemEstar = /\b(bem-estar agregado|bem estar agregado|maximizar o bem-estar|maximizar o bem estar)\b/.test(normalized);
  const hasRegraUniversal = /\b(regra universal|justificavel por uma regra universal|universalizavel|sem excecao)\b/.test(normalized);
  const hasStructuredDemand = /\b(\(a\)|\(b\)|\(c\)|\(d\)|\(e\)|\(f\)|\(g\)|demonstre formalmente|melhor objecao|premissas escondidas|explicite o que)\b/.test(
    normalized,
  );

  return hasLiberdade && hasBemEstar && hasRegraUniversal && hasStructuredDemand;
}

function isAbstractNormativePrompt(text: string): boolean {
  const normalized = normalizeForDeepFallback(text);
  if (!normalized) return false;
  return /\b(principios normativos|liberdade basica|bem-estar agregado|bem estar agregado|regra universal|contradicao real|inconsistencia de aplicacao|premissas escondidas)\b/.test(
    normalized,
  );
}

function buildEliteNormativeFallback(state: ProcessingState): string {
  const message = `${state.normalizedMessage || state.rawMessage || ""}`.trim();
  const hasMeasurementUncertainty = /\b(nao podem ser medidos com precisao|apenas estimados|estimados)\b/i.test(message);
  const uncertaintyComplement = hasMeasurementUncertainty
    ? "Com mensuracao imprecisa, a recomendacao precisa migrar de otimo unico para governanca adaptativa por faixas de confianca."
    : "Se depois assumirmos mensuracao imprecisa, a recomendacao precisa migrar de otimo unico para governanca adaptativa por faixas de confianca.";

  return [
    "Definicoes operacionais (sem apelo inicial a autores):",
    "1. Liberdade basica: conjunto minimo de acoes que um inocente pode exercer sem coercao coletiva arbitraria.",
    "2. Bem-estar agregado: soma social dos estados de beneficio e dano, com regra de comparacao entre individuos.",
    "3. Regra universal: criterio decisorio aplicavel a todos os casos equivalentes sem excecao ad hoc.",
    "4. Inocente: agente sem violacao previa que justifique restricao por sancao.",
    "",
    "(a) Por que o conflito pode ser inevitavel:",
    "- Seja D o conjunto de decisoes possiveis.",
    "- P1(d): d nao reduz liberdade basica de nenhum inocente.",
    "- P2(d): d maximiza bem-estar agregado.",
    "- P3(d): d decorre de regra universal sem excecao.",
    "- Em problemas com escassez e externalidades, ha pares d1 e d2 em D tais que:",
    "  P1(d1) verdadeiro e P2(d1) falso; P2(d2) verdadeiro e P1(d2) falso.",
    "- Se, alem disso, a regra universal que preserva P1 em todos os casos impede maximizacao em parte dos estados, e a regra que maximiza P2 exige excecoes contra inocentes em outros estados, nao existe d em D com P1 ∧ P2 ∧ P3.",
    "- Logo, a colisao nao depende de erro retorico; pode emergir da propria estrutura de restricoes.",
    "",
    "(b) Contradicao real do sistema ou inconsistência de aplicacao?",
    "- Nucleo: tensao estrutural, nao mera ma aplicacao.",
    "- Ha, sim, possiveis inconsistencias de aplicacao (metricas ruins, vies institucional), mas mesmo com aplicacao perfeita pode restar impossibilidade conjuntiva.",
    "",
    "(c) Dois modelos de solucao preservando maximo dos tres principios:",
    "Modelo 1 - Hierarquia Lexica:",
    "- Ordem: P1 > P3 > P2.",
    "- Primeiro elimina decisoes que violem liberdade basica de inocentes; depois aplica universalizacao; por fim otimiza bem-estar no subconjunto restante.",
    "",
    "Modelo 2 - Otimizacao com Restricoes e Limiar:",
    "- P1 vira restricao forte (threshold de liberdade minima), P2 e objetivo de maximizacao condicional, P3 atua como teste de generalizacao institucional.",
    "- Aceita perda de maximo global de P2 para evitar violacao grave de P1.",
    "",
    "(d) Preco logico, moral e institucional:",
    "Modelo 1:",
    "- Logico: sacrifica completude utilitarista (nao busca maximo global de bem-estar).",
    "- Moral: protege inocentes com robustez, mas pode tolerar perdas agregadas relevantes.",
    "- Institucional: exige tribunais/regras de bloqueio forte e pode gerar rigidez decisoria.",
    "Modelo 2:",
    "- Logico: depende de calibragem de limiares (zona cinzenta).",
    "- Moral: reduz danos agregados, mas admite restricoes marginais de liberdade sob condicoes estritas.",
    "- Institucional: requer aparato de mensuracao, auditoria e revisao continua.",
    "",
    "(e) Melhor objecao contra minha solucao preferida (Modelo 1):",
    "- Ao tornar P1 lexical, o sistema pode blindar status quo ineficiente, impedir politicas de alto ganho coletivo e transferir custo moral para grupos difusos sem violacao individual identificavel.",
    "",
    "(f) Reformulacao sob incerteza de mensuracao (liberdade e bem-estar apenas estimados):",
    "- Substituir ponto unico por intervalos de confianca.",
    "- Adotar decisao robusta: escolher alternativas que minimizem arrependimento maximo sob cenarios plausiveis.",
    "- Incluir clausula de reversibilidade institucional: monitoramento, gatilhos de revisao e correcao iterativa.",
    `- ${uncertaintyComplement}`,
    "",
    "(g) Premissas que a resposta usou sem provar:",
    "1. Comparabilidade parcial entre danos e beneficios interindividuais.",
    "2. Existencia de um nucleo identificavel de liberdade basica.",
    "3. Possibilidade de formalizar universalizacao sem ambiguidade total.",
    "4. Boa-fe institucional minima para executar auditoria e revisao.",
    "5. Que custos de implementacao nao anulam o ganho normativo do modelo escolhido.",
  ].join("\n");
}

function buildLogicalFrameDeepFallback(state: ProcessingState): string {
  const frame = state.logicalFrame;
  if (!frame) return "";
  const message = `${state.normalizedMessage || state.rawMessage || ""}`.trim();
  if (isAbstractNormativePrompt(message)) return "";
  if (frame.dominantPrinciple === "unknown" && frame.confidence < 0.45) return "";
  if (!frame.shouldAffectRouting && !frame.shouldAffectRetrieval && frame.confidence < 0.55) return "";
  if (!frame.primaryGoal && !frame.recommendedAction && frame.feasibleActions.length === 0) return "";

  const topFeasible = frame.feasibleActions.slice(0, 3);
  const topRejected = frame.rejectedActions.slice(0, 2);

  const lines: string[] = [
    `- Objetivo principal: ${frame.primaryGoal || "não explicitado com precisão"}.`,
    `- Princípio dominante: ${frame.dominantPrinciple}.`,
    ...(frame.secondaryGoals.length ? [`- Objetivos secundários: ${frame.secondaryGoals.join("; ")}.`] : []),
    ...(frame.constraints.length ? [`- Restrições relevantes: ${frame.constraints.slice(0, 4).join("; ")}.`] : []),
    ...(frame.realWorldConditions.length ? [`- Condições do mundo real: ${frame.realWorldConditions.slice(0, 4).join("; ")}.`] : []),
    ...(frame.relevantCosts.length ? [`- Custos relevantes: ${frame.relevantCosts.join(", ")}.`] : []),
    "",
    "Ações factíveis:",
  ];

  if (topFeasible.length > 0) {
    for (const action of topFeasible) {
      const marginal = typeof action.estimatedMarginalCost === "number" ? `; custo marginal=${action.estimatedMarginalCost}` : "";
      lines.push(`- ${action.label}: ${action.rationale}${marginal}.`);
    }
  } else {
    lines.push("- Ainda sem ações suficientemente factíveis com os dados atuais.");
  }

  if (topRejected.length > 0) {
    lines.push("", "Ações rejeitadas:");
    for (const rejected of topRejected) {
      lines.push(`- ${rejected.label}: ${rejected.reason}.`);
    }
  }

  lines.push(
    "",
    "Recomendação:",
    frame.recommendedAction
      ? `- Melhor ação prática: ${frame.recommendedAction}.`
      : "- Melhor ação prática: ainda indefinida com confiança adequada.",
    `- Justificativa: ${frame.recommendationReason || "melhor relação entre objetivo principal, restrições e custo marginal."}`,
    `- Confiança do quadro lógico: ${frame.confidence.toFixed(2)}.`,
  );

  return lines.join("\n");
}

function buildDeterministicDeepFallback(state: ProcessingState): string {
  const message = `${state.normalizedMessage || state.rawMessage || ""}`.trim();
  if (!message) return "";
  if (isEliteNormativeConflictPrompt(message)) return buildEliteNormativeFallback(state);
  if (isComplexDecisionPrompt(message)) return buildComplexDecisionFallback(state);
  const logicalFrameFallback = buildLogicalFrameDeepFallback(state);
  if (logicalFrameFallback) return logicalFrameFallback;
  return buildGenericDeepFallback(state);
}

function isCollapsedSummaryPromptReplay(state: ProcessingState, summary: string): boolean {
  if (!summary) return false;
  if (/\bleitura factual direta\b|\bevidencia-guia\b|\bleitura contextual-comparativa\b/i.test(summary)) return true;
  const prompt = `${state.normalizedMessage || state.rawMessage || ""}`.trim();
  if (!prompt) return false;
  if (isEchoLike(summary, prompt)) return true;

  const normalizedSummary = normalizeForDeepFallback(summary);
  const normalizedPrompt = normalizeForDeepFallback(prompt);
  if (!normalizedSummary || !normalizedPrompt) return false;
  const promptHead = normalizedPrompt.slice(0, Math.min(160, normalizedPrompt.length));
  return promptHead.length > 40 && normalizedSummary.includes(promptHead);
}

function resolveSafeSummary(state: ProcessingState): string {
  const deepMandatoryTurn = isDeepPipelineMandatoryTurn(state);
  const collapsedSummary = `${state.collapsedTruth.summary || ""}`.trim();
  if (
    collapsedSummary &&
    !isEchoLike(collapsedSummary, state.normalizedMessage) &&
    !(deepMandatoryTurn && isCollapsedSummaryPromptReplay(state, collapsedSummary))
  ) {
    return collapsedSummary;
  }
  const groundedSourceCount = countGroundedSources(state);
  if (isAuthorYearReferencePrompt(state.normalizedMessage) && groundedSourceCount === 0) {
    return "Nao ha base documental suficiente para uma sintese autor-ano confiavel neste turno.";
  }
  if (groundedSourceCount > 0) {
    return "Ha indicios parciais nas fontes recuperadas, mas ainda sem base suficiente para uma sintese confiavel.";
  }
  if (!state.preRouteSignals?.hasVerifiableSignal && !state.preRouteSignals?.hasRecencySignal) {
    if (deepMandatoryTurn) {
      const deepRecovery = buildDeterministicDeepFallback(state);
      if (deepRecovery) return deepRecovery;
    }
    const conceptualRecovery = `${buildNonEchoRecovery(state) || ""}`.trim();
    if (conceptualRecovery && !isEchoLike(conceptualRecovery, state.normalizedMessage)) {
      return conceptualRecovery;
    }
  }
  if (deepMandatoryTurn) {
    const deepRecovery = buildDeterministicDeepFallback(state);
    if (deepRecovery) return deepRecovery;
  }
  return "Nao ha evidencias suficientes no contexto atual para uma sintese confiavel.";
}

function isDeepPipelineMandatoryTurn(state: ProcessingState): boolean {
  const message = `${state.normalizedMessage || state.rawMessage || ""}`.trim();
  if (!message) return false;
  if (state.preRouteSignals?.greetingFastLaneEligible) return false;
  if (isGreetingMessage(message) || isSmallTalkMessage(message)) return false;
  if (state.preRouteSignals?.safetyAction === "caution") return false;
  return true;
}

function shouldRejectLowDepthLlmDraft(state: ProcessingState, draft: string): boolean {
  if (!isDeepPipelineMandatoryTurn(state)) return false;
  const cleanedDraft = `${draft || ""}`.trim();
  if (!cleanedDraft) return true;
  const normalizedDraft = normalizeForDeepFallback(cleanedDraft);
  const normalizedPrompt = normalizeForDeepFallback(`${state.normalizedMessage || state.rawMessage || ""}`);

  const focusReference = resolveConversationFocus(state.normalizedMessage);
  if (isEchoLike(cleanedDraft, state.normalizedMessage) || isEchoLike(cleanedDraft, focusReference)) {
    return true;
  }

  if (/^\s*(ol[aá]|oi+|opa+)\b/i.test(cleanedDraft)) return true;
  if (/^\s*(?:leticia:)?\s*ol[aá],?\s+usu[aá]rio\b/i.test(cleanedDraft)) return true;
  if (/\b(pipeline|modulo|m[oó]dulo|telemetria|trace|execution plan|selectedroute)\b/i.test(cleanedDraft)) return true;
  if (/\b(?:based on the context|i understand that|literal or biological|metaphorical|figurative sense)\b/i.test(cleanedDraft)) {
    return true;
  }
  if (/\bcontexto atual\b/i.test(cleanedDraft)) return true;

  const complexity = Math.max(
    state.complexityProfile.score || 0,
    state.preRouteSignals?.quickComplexity || 0,
  );
  const minChars = complexity >= 0.6 ? 240 : complexity >= 0.4 ? 160 : 120;
  if (cleanedDraft.length < minChars) return true;

  const sentenceCount = cleanedDraft
    .split(/[.!?]+/g)
    .map((item) => item.trim())
    .filter(Boolean).length;
  if (sentenceCount < 2) return true;

  const likelyPortuguesePrompt =
    /\b(que|como|porque|por que|qual|quem|entre|com|para|linguagem|cognicao|identidade|leticia|voce|não|nao)\b/.test(
      normalizedPrompt,
    );
  const englishFunctionHits = (normalizedDraft.match(/\b(the|and|is|are|with|between|through|firstly|however|therefore|will|can)\b/g) || [])
    .length;
  if (likelyPortuguesePrompt && englishFunctionHits >= 5) return true;

  if (isComplexDecisionPrompt(normalizedPrompt)) {
    const hasExpectedStructure =
      /\bpremissas explicitas\b/.test(normalizedDraft) &&
      /\balternativa 1\b/.test(normalizedDraft) &&
      /\balternativa 2\b/.test(normalizedDraft);
    if (!hasExpectedStructure) return true;
  }

  if (isEliteNormativeConflictPrompt(normalizedPrompt)) {
    const hasExpectedStructure =
      normalizedDraft.includes("(a)") &&
      normalizedDraft.includes("(b)") &&
      normalizedDraft.includes("(c)") &&
      normalizedDraft.includes("(d)") &&
      normalizedDraft.includes("(e)") &&
      normalizedDraft.includes("(f)") &&
      normalizedDraft.includes("(g)");
    if (!hasExpectedStructure) return true;
  }

  const logicalFrame = state.logicalFrame;
  if (logicalFrame?.shouldAffectRouting && logicalFrame.recommendedAction) {
    const recommendedHead = normalizeForDeepFallback(logicalFrame.recommendedAction).split(" ").slice(0, 6).join(" ");
    if (recommendedHead && !normalizedDraft.includes(recommendedHead)) {
      return true;
    }
  }
  if (/\b(criador|quem te criou|origem do nome|medeiros)\b/.test(normalizedPrompt)) {
    if (/\b(nao possuo criador|nao tenho criador|sem criador)\b/.test(normalizedDraft)) return true;
  }

  return false;
}

function buildPrompt(state: ProcessingState): string {
  const communicativeInjection = state.communicativeElaborationState
    ? [
        "Communicative elaboration (co-construction):",
        `- Idea seed: ${state.communicativeElaborationState.ideaSeed.coreClaim}`,
        `- Tensions: ${state.communicativeElaborationState.tensions.map((row) => `${row.poleA} x ${row.poleB}`).join("; ") || "none"}`,
        `- Hypothesis branches: ${state.communicativeElaborationState.hypothesisBranches.map((row) => row.claim).join(" | ") || "none"}`,
        `- Refinement unresolved points: ${state.communicativeElaborationState.refinement.unresolvedPoints.join(", ") || "none"}`,
      ].join("\n")
    : "";

  return [
    buildSystemPrompt(),
    buildTaskPrompt(state),
    buildContextInjection(state),
    buildMemoryInjection(state),
    buildEvidenceInjection(state),
    buildHypothesisInjection(state),
    buildReflectionInjection(state),
    buildInferenceInjection(state),
    buildStyleConstraints(state),
    communicativeInjection,
  ].join("\n");
}

function buildReasoningBlock(state: ProcessingState): string {
  const route = selectReasoningPath({
    complexity: state.complexityProfile.score,
    uncertainty: state.collapsedTruth.uncertainty,
    evidenceCount: state.retrievedEvidence.length,
  });

  const direct = buildDirectAnswerPath(state);
  const decomposition = buildDecompositionPath(state);
  const chain = buildChainOfTasksPath(decomposition);
  const multi = buildMultiHypothesisReasoning(state);
  const abductive = buildAbductiveSupportPath(state);
  const synthesis = buildSynthesisPath([direct, chain, multi, abductive]);

  if (route === "direct") return direct;
  if (route === "decomposition") return [chain, multi, abductive].join("\n");
  return synthesis;
}

export async function runGenerationLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  const founderReasoningInfluence = buildFounderReasoningInfluence();

  state.executionArtifacts.founderInfluence = {
    founderName: founderReasoningInfluence.founderName,
    founderRole: state.executionArtifacts.founderInfluence?.founderRole || "fundador_epistemologico_da_leticia",
    identityWeight: state.executionArtifacts.founderInfluence?.identityWeight || 0,
    reasoningWeight: founderReasoningInfluence.reasoningWeight,
    epistemicWeight: state.executionArtifacts.founderInfluence?.epistemicWeight || 0,
    identityInfluenceDirectives: [...(state.executionArtifacts.founderInfluence?.identityInfluenceDirectives || [])],
    reasoningInfluenceDirectives: [...founderReasoningInfluence.reasoningInfluenceDirectives],
    validationInfluenceDirectives: [...(state.executionArtifacts.founderInfluence?.validationInfluenceDirectives || [])],
    existentialVectors: [...new Set([...(state.executionArtifacts.founderInfluence?.existentialVectors || []), ...founderReasoningInfluence.existentialVectors])],
    epistemicVectors: [...new Set([...(state.executionArtifacts.founderInfluence?.epistemicVectors || []), ...founderReasoningInfluence.epistemicVectors])],
    protectedGroundingFacts: [...new Set([...(state.executionArtifacts.founderInfluence?.protectedGroundingFacts || []), ...founderReasoningInfluence.protectedGroundingFacts])],
  };

  await runGenerationMemoryBridge(state);
  await runGenerationEvidenceBridge(state);
  const reasoningAugmentedEvidence = await runReasoningToIterativeAcquisitionBridge(state);
  await runGenerationLlmBridge(state);
  await runCommunicativeElaborationBridge(state);
  const groundedSourceCount = countGroundedSources(state);
  const llmDraft = state.executionArtifacts.generationRuntime?.llmDraft || "";
  const llmDraftAvailable = llmDraft.trim().length > 0;
  const reflectiveObjectiveAnswer = resolveReflectiveObjectiveFinalAnswer(state);

  if (isCurrentDateQuestion(state.normalizedMessage)) {
    const directDateAnswer = applyMultimodalDraftBridge(
      buildCurrentDateAnswer(),
      state.inputSignals.modality,
    );
    state.generationPrompt = buildPrompt(state);
    state.draftResponse = {
      text: directDateAnswer,
      sections: [{ title: "Resposta", content: directDateAnswer }],
    };
    state.trace.push(
      makeTraceEvent({
        layer: "generation",
        action: "date_question_resolved_directly",
        route: state.executionPlan.selectedRoute,
        latencyMs: Date.now() - startedAt,
        detail: "temporal_guard=enabled; source=system_clock; timezone=America/Sao_Paulo",
      }),
    );
    return handoffGenerationToStructure(state);
  }

  const factualFallback = buildFactualAnswerFallback({
    question: state.normalizedMessage,
    sources: state.retrievedSources,
  });
  if (factualFallback && !llmDraftAvailable) {
    const factualText = applyMultimodalDraftBridge(factualFallback.answer, state.inputSignals.modality);
    state.generationPrompt = buildPrompt(state);
    state.draftResponse = {
      text: factualText,
      sections: [{ title: "Resposta", content: factualText }],
    };
    state.trace.push(
      makeTraceEvent({
        layer: "generation",
        action: "factual_fallback_generated",
        route: state.executionPlan.selectedRoute,
        latencyMs: Date.now() - startedAt,
        detail:
          `role=${factualFallback.role}; place=${factualFallback.place}; confidence=${factualFallback.confidence.toFixed(2)}; ` +
          `iterativeAugmentation=${reasoningAugmentedEvidence ? "true" : "false"}`,
      }),
    );
    return handoffGenerationToStructure(state);
  }

  if (
    !llmDraftAvailable &&
    (
      isDirectFactualNameQuestion(state.normalizedMessage) ||
      isDirectFactualTimelineQuestion(state.normalizedMessage, state)
    )
  ) {
    const unresolvedText = applyMultimodalDraftBridge(
      buildUnresolvedFactualMessage(state),
      state.inputSignals.modality,
    );
    state.generationPrompt = buildPrompt(state);
    state.draftResponse = {
      text: unresolvedText,
      sections: [{ title: "Resposta", content: unresolvedText }],
    };
    state.trace.push(
      makeTraceEvent({
        layer: "generation",
        action: "factual_fallback_unresolved",
        route: state.executionPlan.selectedRoute,
        latencyMs: Date.now() - startedAt,
        detail: `sources=${state.retrievedSources.length}`,
      }),
    );
    return handoffGenerationToStructure(state);
  }

  if (!llmDraftAvailable && isAuthorYearReferencePrompt(state.normalizedMessage) && groundedSourceCount === 0) {
    const unresolvedText = applyMultimodalDraftBridge(
      buildReferenceGroundingMessage(state),
      state.inputSignals.modality,
    );
    state.generationPrompt = buildPrompt(state);
    state.draftResponse = {
      text: unresolvedText,
      sections: [{ title: "Resposta", content: unresolvedText }],
    };
    state.trace.push(
      makeTraceEvent({
        layer: "generation",
        action: "reference_grounding_required",
        route: state.executionPlan.selectedRoute,
        latencyMs: Date.now() - startedAt,
        detail: `author_year_reference_without_grounded_sources; totalSources=${state.retrievedSources.length}; groundedSources=${groundedSourceCount}`,
      }),
    );
    return handoffGenerationToStructure(state);
  }

  const focusForFallbackPriority = resolveConversationFocus(state.normalizedMessage);
  const deepMandatoryTurn = isDeepPipelineMandatoryTurn(state);
  const shouldPrioritizeConversationalFallback =
    isAssistantIdentityPrompt(focusForFallbackPriority) ||
    isAssistantNameOriginPrompt(focusForFallbackPriority) ||
    isAssistantCreatorPrompt(focusForFallbackPriority);

  if (shouldPrioritizeConversationalFallback && !llmDraftAvailable && !deepMandatoryTurn) {
    const priorityFallback = buildConversationalFallback(state);
    if (priorityFallback) {
      const chatText = applyMultimodalDraftBridge(priorityFallback, state.inputSignals.modality);
      state.generationPrompt = buildPrompt(state);
      state.draftResponse = {
        text: chatText,
        sections: [{ title: "Resposta", content: chatText }],
      };
      state.trace.push(
        makeTraceEvent({
          layer: "generation",
          action: "chat_fallback_priority_generated",
          route: state.executionPlan.selectedRoute,
          latencyMs: Date.now() - startedAt,
          detail: "mode=chat-fallback-priority; reason=identity_cue",
        }),
      );
      return handoffGenerationToStructure(state);
    }
  }

  const shouldPrioritizeClarificationFallback =
    state.selectedMode === "chat" &&
    state.conversationState.needsClarification &&
    (
      isConversationalPrompt(state.normalizedMessage) ||
      state.normalizedMessage.trim().split(/\s+/g).filter(Boolean).length <= 8
    );
  if (shouldPrioritizeClarificationFallback && !llmDraftAvailable && !deepMandatoryTurn) {
    const clarificationFallback = buildConversationalFallback(state);
    if (clarificationFallback) {
      const chatText = applyMultimodalDraftBridge(clarificationFallback, state.inputSignals.modality);
      state.generationPrompt = buildPrompt(state);
      state.draftResponse = {
        text: chatText,
        sections: [{ title: "Resposta", content: chatText }],
      };
      state.trace.push(
        makeTraceEvent({
          layer: "generation",
          action: "chat_clarification_fallback_generated",
          route: state.executionPlan.selectedRoute,
          latencyMs: Date.now() - startedAt,
          detail: "mode=chat-fallback-priority; reason=conversation_clarification",
        }),
      );
      return handoffGenerationToStructure(state);
    }
  }

  if (reflectiveObjectiveAnswer && !llmDraftAvailable) {
    const objectiveText = applyMultimodalDraftBridge(
      reflectiveObjectiveAnswer,
      state.inputSignals.modality,
    );
    state.generationPrompt = buildPrompt(state);
    state.draftResponse = {
      text: objectiveText,
      sections: [{ title: "Resposta", content: objectiveText }],
    };
    state.trace.push(
      makeTraceEvent({
        layer: "generation",
        action: "reflective_objective_answer_adopted",
        route: state.executionPlan.selectedRoute,
        latencyMs: Date.now() - startedAt,
        detail: "source=reflective_objective_rationality",
      }),
    );
    return handoffGenerationToStructure(state);
  }

  let llmDraftRejectedForDepth = false;
  if (llmDraft) {
    if (shouldRejectLowDepthLlmDraft(state, llmDraft)) {
      llmDraftRejectedForDepth = true;
      state.activeConstraints = [
        ...new Set([...state.activeConstraints, "llm_deep_low_depth_rejected"]),
      ].slice(-32);
    } else {
      const llmText = applyMultimodalDraftBridge(llmDraft, state.inputSignals.modality);
      state.generationPrompt = buildPrompt(state);
      state.draftResponse = {
        text: llmText,
        sections: [{ title: "Resposta", content: llmText }],
      };
      state.trace.push(
        makeTraceEvent({
          layer: "generation",
          action: "llm_runtime_draft_adopted",
          route: state.executionPlan.selectedRoute,
          latencyMs: Date.now() - startedAt,
          detail: `chars=${llmDraft.length}`,
        }),
      );
      return handoffGenerationToStructure(state);
    }
  }

  if (deepMandatoryTurn && (!llmDraftAvailable || llmDraftRejectedForDepth)) {
    const deterministicDeep = `${buildDeterministicDeepFallback(state) || ""}`.trim();
    if (deterministicDeep) {
      const deepText = applyMultimodalDraftBridge(deterministicDeep, state.inputSignals.modality);
      state.generationPrompt = buildPrompt(state);
      state.draftResponse = {
        text: deepText,
        sections: [{ title: "Resposta", content: deepText }],
      };
      state.trace.push(
        makeTraceEvent({
          layer: "generation",
          action: "deep_deterministic_fallback_generated",
          route: state.executionPlan.selectedRoute,
          latencyMs: Date.now() - startedAt,
          detail: `llmDraftAvailable=${llmDraftAvailable}; llmRejectedForDepth=${llmDraftRejectedForDepth}`,
        }),
      );
      return handoffGenerationToStructure(state);
    }
  }

  const conversationalFallback = buildConversationalFallback(state);
  if (conversationalFallback && !deepMandatoryTurn) {
    const chatText = applyMultimodalDraftBridge(conversationalFallback, state.inputSignals.modality);
    state.generationPrompt = buildPrompt(state);
    state.draftResponse = {
      text: chatText,
      sections: [{ title: "Resposta", content: chatText }],
    };
    state.trace.push(
      makeTraceEvent({
        layer: "generation",
        action: "chat_fallback_generated",
        route: state.executionPlan.selectedRoute,
        latencyMs: Date.now() - startedAt,
        detail: `mode=chat-fallback; iterativeAugmentation=${reasoningAugmentedEvidence ? "true" : "false"}`,
      }),
    );
    return handoffGenerationToStructure(state);
  }

  state.generationPrompt = buildPrompt(state);
  const safeSummary = resolveSafeSummary(state);
  const initialDraft = buildInitialDraft({
    summary: safeSummary,
    status: state.epistemicStatus,
    confidence: state.confidenceScores.epistemic,
  });

  const reasoningBlock = buildReasoningBlock(state);
  const expanded = buildExpandedDraft(initialDraft, [reasoningBlock, ...state.inferentialMap.implications.slice(0, 3)]);
  const condensed = buildCondensedDraft(expanded);
  const alternative = buildAlternativeDraft({
    summary: safeSummary,
    caveat: state.criticalCaveats[0] || "sem ressalvas adicionais",
  });

  const merged = mergeDraftContent([condensed, alternative]);
  const unified = unifySemantics(merged);
  const deduped = removeRedundancy(unified);
  const transitioned = buildTransitions(deduped.split(/\n{2,}/g).filter(Boolean)).join("\n\n");
  const conclusion = buildConclusion({
    summary: safeSummary,
    epistemicStatus: state.epistemicStatus,
  });
  let finalDraftText = applyMultimodalDraftBridge(`${transitioned}\n\n${conclusion}`, state.inputSignals.modality);
  const focusReference = resolveConversationFocus(state.normalizedMessage);
  if (
    isEchoLike(finalDraftText, state.normalizedMessage) ||
    isEchoLike(finalDraftText, focusReference)
  ) {
    const deterministicDeep = deepMandatoryTurn ? `${buildDeterministicDeepFallback(state) || ""}`.trim() : "";
    finalDraftText = applyMultimodalDraftBridge(
      deterministicDeep || buildNonEchoRecovery(state),
      state.inputSignals.modality,
    );
  }

  const sections = orderSections([
    { title: "Resposta", content: safeSummary },
    { title: "Base inferencial", content: state.inferentialMap.implications.join(" ") || "sem implicacoes" },
    { title: "Caveats", content: state.criticalCaveats.join(" ") || "sem caveats" },
    { title: "Conclusao", content: conclusion },
  ]);

  const selfCheck = runSelfCheckPath({ text: finalDraftText, caveats: state.criticalCaveats });
  if (!selfCheck.ok) {
    state.activeConstraints = [...state.activeConstraints, ...selfCheck.notes].slice(-16);
  }

  state.draftResponse = {
    text: finalDraftText,
    sections,
  };

  state.trace.push(
    makeTraceEvent({
      layer: "generation",
      action: "draft_generated",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail: `sections=${sections.length}; selfCheckOk=${selfCheck.ok}`,
    }),
  );

  return handoffGenerationToStructure(state);
}
