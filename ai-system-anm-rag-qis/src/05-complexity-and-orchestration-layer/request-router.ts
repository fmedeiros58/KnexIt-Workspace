/**
 * Responsabilidade do arquivo:
 * - Derivar route hint de alto nivel para a orchestracao.
 * - Combinar sinais de preRouteScan, complexidade e verificabilidade.
 * - Evitar rotas profundas em situacoes de risco/safety.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import type { PipelineRoute } from "../shared/enums/pipeline-enums";

const THRESHOLDS = {
  inferentialScore: 0.50,
  inferentialAmbiguity: 0.48,
  reflectiveScore: 0.36,
  quantumVerifiableScore: 0.55,
};

function normalize(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
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
    /\b((por que|porque|pq) (voce|vc|ce) (tem|usa) (esse )?nome|qual a origem do seu nome|de onde vem o nome leticia)\b/,
    /\b(o que significa leticia|qual o significado( do nome)?( de)? leticia|leticia significa o que|o que quer dizer leticia)\b/,
    /\b(quem (e|eh) (o )?medeiros|quem te criou|quem criou voce|quem e seu criador|quem idealizou voce|quem desenvolveu voce)\b/,
  ];
  return identityFamilies.some((pattern) => pattern.test(normalized));
}

export function routeRequest(state: ProcessingState): PipelineRoute {
  const intent = state.inputSignals.intent || state.preRouteSignals?.quickIntent || "chat";
  const urgency = state.inputSignals.urgency || state.preRouteSignals?.quickUrgency || "low";
  const safetyFlags = state.inputSignals.safetyFlags || [];
  const score = state.complexityProfile.score || state.preRouteSignals?.quickComplexity || 0;
  const ambiguity = state.complexityProfile.ambiguity || state.preRouteSignals?.quickAmbiguity || 0;
  const tokenCount = state.textAnalysisSnapshot?.tokenCount || state.preRouteSignals?.tokenCount || 0;
  const message = `${state.normalizedMessage || state.rawMessage || ""}`.trim();
  const snapshot = state.textAnalysisSnapshot;
  const hasVerifiableSignal = snapshot?.hasVerifiableSignal || Boolean(state.preRouteSignals?.hasVerifiableSignal);
  const communicativeCue = isCommunicativeElaborationPrompt(message);
  const epistemicCue = isEpistemicAuditPrompt(message);
  const philosophicalCue = isPhilosophicalSelfModelingPrompt(message);
  const identityFamilyCue = isAssistantIdentityFamilyPrompt(message);
  const hasSafetyRestriction =
    state.preRouteSignals?.safetyAction === "caution" ||
    safetyFlags.some((flag) => /block|malicious|prompt_injection|harmful/i.test(flag));

  if (hasSafetyRestriction) return "minimum";
  if (philosophicalCue) return "inferential";
  if (identityFamilyCue) return "inferential";
  if (epistemicCue && hasVerifiableSignal) return "quantum-state";
  if (communicativeCue && score >= THRESHOLDS.reflectiveScore) return "reflective";
  if (hasVerifiableSignal && score >= THRESHOLDS.quantumVerifiableScore) return "quantum-state";
  if (intent === "research") return "quantum-state";
  if (intent === "analysis") return "inferential";
  if (intent === "technical") {
    // Short technical imperatives usually need scope clarification before deep reasoning.
    if (tokenCount <= 5 && !/\?/.test(message)) return "reflective";
    return "inferential";
  }
  if (ambiguity >= THRESHOLDS.inferentialAmbiguity || score >= THRESHOLDS.inferentialScore) return "inferential";
  if (score >= THRESHOLDS.reflectiveScore || urgency === "medium") return "reflective";
  return "reflective";
}
