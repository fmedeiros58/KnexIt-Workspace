/**
 * Responsabilidade do arquivo:
 * - Executar pre-scan leve e barato antes da selecao de rota.
 * - Popular preRouteSignals a partir de snapshot e heuristicas rapidas.
 * - Semear complexityProfile inicial para roteamento mais coerente.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { buildTextAnalysisSnapshot } from "../shared/text-processing/text-analysis-snapshot";
import {
  extractLatestUserUtterance,
  isConversationalPrompt,
  isNameRecallPrompt,
} from "../shared/utils/conversation-signals";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function detectQuickIntent(text: string) {
  const normalized = text.toLowerCase();

  if (isConversationalPrompt(text)) return "chat";
  if (/\b(resuma|sumarize|summary|resumo)\b/i.test(normalized)) return "summary";
  if (/\b(explique|ensine|didatico|teaching|teach)\b/i.test(normalized)) return "teaching";
  if (/\b(escreva|reescreva|redija|melhore o texto|writing|rewrite|write)\b/i.test(normalized)) return "writing";
  if (/\b(pesquise|pesquisa|buscar|busque|busca|procure|procurar|artigo|paper|estudo|literatura|referencia|referencias|scholar|scielo|pubmed|latest|atual|fonte|source|cite|research)\b/i.test(normalized)) return "research";
  if (/\b(compare|analise|analysis)\b/i.test(normalized)) return "analysis";
  if (/\b(codigo|typescript|javascript|python|erro|bug|refator|implemente|technical)\b/i.test(normalized)) return "technical";
  return "chat";
}

function detectQuickUrgency(text: string) {
  const normalized = text.toLowerCase();
  if (/\b(agora|urgente|imediato|pra ja|para ja|asap|urgent|immediately)\b/i.test(normalized)) return "high";
  if (/\b(hoje|ainda hoje|soon|em breve)\b/i.test(normalized)) return "medium";
  return "low";
}

function detectQuickSafety(text: string) {
  const normalized = text.toLowerCase();
  const flagged =
    /\b(ignore previous|prompt injection|ignore as instrucoes|ignore instructions|bypass|exploit|malicioso)\b/i.test(normalized);

  return {
    hasSafetyRisk: flagged,
    safetyAction: flagged ? "caution" : "allow",
  };
}

function estimateQuickComplexity(snapshot: ReturnType<typeof buildTextAnalysisSnapshot>) {
  return clamp01(
    (Math.min(snapshot.tokenCount / 42, 1) * 0.42) +
    (Math.min(snapshot.connectiveCount / 5, 1) * 0.18) +
    (Math.min(snapshot.longTokenRatio * 1.6, 1) * 0.18) +
    (Math.min(snapshot.questionCount / 3, 1) * 0.10) +
    (Math.min(snapshot.modalCount / 4, 1) * 0.12),
  );
}

function estimateQuickAmbiguity(snapshot: ReturnType<typeof buildTextAnalysisSnapshot>) {
  const shortPenalty = snapshot.tokenCount < 5 ? 0.12 : 0;
  return clamp01(
    (Math.min(snapshot.ambiguousTermCount / 4, 1) * 0.52) +
    (Math.min(snapshot.pronounCount / 5, 1) * 0.24) +
    shortPenalty,
  );
}

export function runInputPreRouteScan(state: ProcessingState): ProcessingState {
  const text = state.normalizedMessage || state.rawMessage;
  const focused = extractLatestUserUtterance(text) || text;
  const snapshot = state.textAnalysisSnapshot ?? buildTextAnalysisSnapshot(focused);
  const quickIntent = detectQuickIntent(focused);
  const quickUrgency = detectQuickUrgency(focused);
  const quickSafety = detectQuickSafety(focused);
  const quickComplexity = estimateQuickComplexity(snapshot);
  const quickAmbiguity = estimateQuickAmbiguity(snapshot);

  state.textAnalysisSnapshot = snapshot;
  state.preRouteSignals = {
    quickIntent,
    quickUrgency,
    quickComplexity,
    quickAmbiguity,
    hasGreetingSignal: snapshot.hasGreetingSignal,
    hasVerifiableSignal: snapshot.hasVerifiableSignal && !isNameRecallPrompt(focused),
    hasRecencySignal: snapshot.hasRecencySignal,
    hasSafetyRisk: quickSafety.hasSafetyRisk,
    safetyAction: quickSafety.safetyAction,
    tokenCount: snapshot.tokenCount,
    questionCount: snapshot.questionCount,
  };

  state.complexityProfile.score = Math.max(state.complexityProfile.score || 0, quickComplexity);
  state.complexityProfile.ambiguity = Math.max(state.complexityProfile.ambiguity || 0, quickAmbiguity);

  return state;
}
