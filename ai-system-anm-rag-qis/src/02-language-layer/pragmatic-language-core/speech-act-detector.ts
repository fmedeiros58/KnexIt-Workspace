/**
 * Responsabilidade do arquivo:
 * - Classificar ato de fala de superficie (pergunta, pedido, instrucao, correcao etc.).
 * - Nao resolver intencao conversacional profunda; apenas acao comunicativa imediata.
 * - Entregar sinal base para o agregador pragmatico.
 */
import type { SpeechActType } from "../types/language-signal-types";
import { clamp01, safeLower } from "../utils/normalization-utils";

export interface SpeechActDetectionInput {
  text: string;
}

export interface SpeechActDetection {
  speechAct: SpeechActType;
  politeness: number;
}

function estimatePoliteness(text: string): number {
  const positive = (text.match(/\b(por favor|please|obrigado|thanks|gentileza)\b/g) || []).length;
  const negative = (text.match(/\b(agora|imediato|urgente|sem desculpa)\b/g) || []).length;
  const score = 0.46 + positive * 0.14 - negative * 0.08 + (/\?/.test(text) ? 0.06 : 0);
  return clamp01(score);
}

export function speechActDetector(input: SpeechActDetectionInput): SpeechActDetection {
  const text = safeLower(input.text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  const isGreeting = /^(oi|ola|hello|hi|hey)\b/.test(text);
  const isCorrection = /\b(corrigindo|na verdade|retificando|correcao)\b/.test(text);
  const isObjection = /\b(discordo|nao concordo|isso nao|obje(c|s)ao)\b/.test(text);
  const isInstruction = /\b(implemente|crie|ajuste|corrija|refatore|remova|adicione|execute|faca|faz|refaca|continue|prossiga|siga|pesquise|busque)\b/.test(text);
  const isRequest = /\b(pode|poderia|consegue|please|por favor|gostaria que|tem como|vc pode|voce pode)\b/.test(text);
  const isQuestion = /\?$/.test(text) || /\b(como|qual|quem|quando|por que|porque|why|what|how)\b/.test(text);
  const isConfirmation = /\b(ok|beleza|confirmo|entendi|combinado)\b/.test(text);

  let speechAct: SpeechActType = "statement";
  if (isGreeting) speechAct = "greeting";
  else if (isCorrection) speechAct = "correction";
  else if (isObjection) speechAct = "objection";
  else if (isInstruction) speechAct = "instruction";
  else if (isRequest) speechAct = "request";
  else if (isQuestion) speechAct = "question";
  else if (isConfirmation) speechAct = "confirmation";

  return {
    speechAct,
    politeness: estimatePoliteness(text),
  };
}

