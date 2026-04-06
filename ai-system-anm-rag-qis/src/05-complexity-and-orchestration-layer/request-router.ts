/**
 * Responsabilidade do arquivo:
 * - Derivar route hint de alto nivel para a orchestracao.
 * - Combinar sinais de preRouteScan, complexidade e verificabilidade.
 * - Evitar rotas profundas em situacoes de risco/safety.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import type { PipelineRoute } from "../shared/enums/pipeline-enums";
import { textNormalizationService } from "../shared/text-processing/text-normalization.service";
import {
  hasIntentGateEvaluation,
  resolveIntentGateRoute,
} from "../shared/routing/intent-gate-route-resolver";

const THRESHOLDS = {
  inferentialScore: 0.50,
  inferentialAmbiguity: 0.48,
};

function normalize(value: string) {
  return textNormalizationService
    .expandContractions(value || "")
    .trim();
}

export function isCommunicativeElaborationPrompt(message: string) {
  const normalized = normalize(message);
  return /\b(refine|refinar|aprofundar|explorar|elaborar|desenvolver|co construir|co-construir|debater|analise|analitico|analitica|resenha|critica|dissertacao|dissertação)\b/.test(normalized);
}

export function isEpistemicAuditPrompt(message: string) {
  const normalized = normalize(message);
  return /\b(evidencia|evidencias|fonte|fontes|lastro|fato|hipotese|especulacao|incerteza|validar|validacao)\b/.test(
    normalized,
  );
}

export function isPhilosophicalSelfModelingPrompt(message: string) {
  const normalized = normalize(message);
  return /\b(quem e voce|quem e vc|origem|criador|autoria|existencia|consciencia|limites ontologicos|quem sou eu|quem e leticia)\b/.test(
    normalized,
  );
}

export function isAssistantIdentityFamilyPrompt(message: string) {
  const normalized = normalize(message).replace(/[!?.,;:"]/g, " ");
  const identityFamilies: RegExp[] = [
    /\b(qual(?: (?:e|eh))? (?:o )?(seu|teu) nome|me diga (?:o )?seu nome|me diz (?:o )?seu nome|diga (?:o )?seu nome)\b/,
    /\b(como (voce|vc|ce) se chama|e o seu)\b/,
    /\b((por que|porque|pq) (voce|vc|ce) (tem|usa) (esse )?nome|qual a origem do seu nome|de onde vem o nome leticia|de onde surgiu o nome leticia|como surgiu o nome leticia|(?:por que|porque|pq) (?:voce|vc|ce) se chama assim|(?:por que|porque|pq) (?:te|tte) chamam assim|te chamam assim|se chama assim)\b/,
    /\b(o que significa leticia|qual o significado( do nome)?( de)? leticia|leticia significa o que|o que quer dizer leticia|qual o sentido do nome leticia)\b/,
    /\b(qual o conceito de leticia|conceito de leticia|qual a definicao de leticia|definicao de leticia|base conceitual do nome leticia|qual a ideia por tras do nome leticia)\b/,
    /\b(quem (e|eh) (o )?medeiros|quem te criou|quem criou voce|quem e seu criador|quem idealizou voce|quem desenvolveu voce)\b/,
    /\b(foi ele que te criou|ele te criou|voce e (?:filha|filho) dele|vc e (?:filha|filho) dele)\b/,
  ];
  return identityFamilies.some((pattern) => pattern.test(normalized));
}

function isAssistantIdentityChallengePrompt(message: string) {
  const normalized = normalize(message);
  const hasChallengeMarker =
    /\b(mas|porem|porém|so que|só que|nao concordo|não concordo|nao faz sentido|não faz sentido|contradiz|contradicao|contradição|inconsistente|tem certeza|certeza disso|explique melhor|aprofunde|detalhe melhor|justifique)\b/.test(
      normalized,
    );
  if (!hasChallengeMarker) return false;

  const hasIdentityAnchor =
    isAssistantIdentityFamilyPrompt(message) ||
    /\b(leticia|medeiros|nome da ia|origem do nome|se chama assim|quem te criou)\b/.test(normalized);

  return hasIdentityAnchor;
}

function requiresRepositoryOrDataAccess(message: string): boolean {
  const normalized = normalize(message);
  const hasDataCue =
    /\b(rag|reposit[oó]rio|repositorio|repo|sql|database|banco de dados|db|nvme|lattes|fonte|fontes|evidencia|evidencias|documento|documentos|cache|memoria)\b/.test(
      normalized,
    );
  if (!hasDataCue) return false;

  const hasAccessVerb =
    /\b(busque|buscar|consulte|consulta|recupere|recuperar|verifique|verificar|puxe|puxar|carregue|carregar|query|select|lookup|checar)\b/.test(
      normalized,
    );
  const hasDirective =
    /\b(preciso|necessario|necessária|necessario|quero|me diga|me mostre|diga)\b/.test(normalized);

  return hasAccessVerb || hasDirective;
}

export function routeRequest(state: ProcessingState): PipelineRoute {
  const intent = state.inputSignals.intent || state.preRouteSignals?.quickIntent || "chat";
  const urgency = state.inputSignals.urgency || state.preRouteSignals?.quickUrgency || "low";
  const safetyFlags = state.inputSignals.safetyFlags || [];
  const score = state.complexityProfile.score || state.preRouteSignals?.quickComplexity || 0;
  const ambiguity = state.complexityProfile.ambiguity || state.preRouteSignals?.quickAmbiguity || 0;
  const message = `${state.normalizedMessage || state.rawMessage || ""}`.trim();
  const snapshot = state.textAnalysisSnapshot;
  const hasVerifiableSignal = snapshot?.hasVerifiableSignal || Boolean(state.preRouteSignals?.hasVerifiableSignal);
  const intentGateRoute = resolveIntentGateRoute({
    routingRecommendation: state.preRouteSignals?.intentGateRoutingRecommendation,
    shouldEscalateToDeepPipeline: state.preRouteSignals?.intentGateShouldEscalateToDeepPipeline,
    hasVerifiableSignal,
  });
  const communicativeCue = isCommunicativeElaborationPrompt(message);
  const epistemicCue = isEpistemicAuditPrompt(message);
  const philosophicalCue = isPhilosophicalSelfModelingPrompt(message);
  const identityFamilyCue = isAssistantIdentityFamilyPrompt(message);
  const repositoryOrDataAccessCue = requiresRepositoryOrDataAccess(message);
  const hasSafetyRestriction =
    state.preRouteSignals?.safetyAction === "caution" ||
    safetyFlags.some((flag) => /block|malicious|prompt_injection|harmful/i.test(flag));
  const greetingFastLaneEligible = Boolean(state.preRouteSignals?.greetingFastLaneEligible);
  const deepDefaultRoute: PipelineRoute = "inferential";
  const hasIntentGateEvaluationSignal = hasIntentGateEvaluation({
    intentGateConfidence: state.preRouteSignals?.intentGateConfidence,
    intentGateDebugTrace: state.preRouteSignals?.intentGateDebugTrace,
  });
  const normalizedIntentGateRoute =
    intentGateRoute === "minimum" ? "minimum" : intentGateRoute ? "inferential" : null;
  const logicalFrame = state.logicalFrame;

  if (hasSafetyRestriction) return "minimum";
  if (greetingFastLaneEligible) return "minimum";
  if (logicalFrame?.shouldAffectRouting) return "inferential";
  if (hasIntentGateEvaluationSignal && normalizedIntentGateRoute === "inferential") return "inferential";
  if (repositoryOrDataAccessCue) return deepDefaultRoute;
  if (philosophicalCue) return deepDefaultRoute;
  if (identityFamilyCue) return deepDefaultRoute;
  if (epistemicCue && hasVerifiableSignal) return deepDefaultRoute;
  if (communicativeCue) return "inferential";
  if (intent === "research") return "inferential";
  if (intent === "analysis") return "inferential";
  if (intent === "technical") return "inferential";
  if (hasVerifiableSignal) return "inferential";
  if (ambiguity >= THRESHOLDS.inferentialAmbiguity || score >= THRESHOLDS.inferentialScore || urgency !== "low") {
    return "inferential";
  }
  return "inferential";
}
