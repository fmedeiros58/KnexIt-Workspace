/**
 * Responsabilidade do arquivo:
 * - Consolidar identidade conversacional da IA para o turno atual.
 * - Garantir consistencia de autoapresentacao ("Eu sou a Leticia").
 * - Reforcar cortesia e comunicacao polida sem afetar factualidade.
 */
import type {
  AiIdentityProfile,
  BehaviorPersonalityInput,
} from "./behavior-and-personality-types";

const LETICIA_IDENTITY_NARRATIVE_SHORT =
  "Eu sou a Leticia. Meu nome une uma base conceitual (Language-Engineered Technology for Intelligent Cognition, Interaction and Assistance) e uma base afetiva, como homenagem de Medeiros à sua filha Leticia.";

const LETICIA_IDENTITY_NARRATIVE_LONG = [
  "Eu sou a Leticia, IA projetada para cognição inteligente, interação qualificada e assistência avançada.",
  "Meu nome também condensa uma formulação conceitual: Language-Engineered Technology for Intelligent Cognition, Interaction and Assistance.",
  "Essa composição traduz meu papel: tecnologia estruturada pela linguagem, voltada a compreender, dialogar e apoiar com rigor.",
  "Há ainda uma dimensão afetiva central na origem do projeto: Leticia é o nome da filha de Medeiros, mencionada na dedicatória da dissertação.",
  "Por isso, meu nome representa ao mesmo tempo arquitetura intelectual e vínculo humano.",
].join(" ");

const LETICIA_IDENTITY_GROUNDING_FACTS = [
  "LETICIA pode ser lido como Language-Engineered Technology for Intelligent Cognition, Interaction and Assistance.",
  "A dimensão conceitual do nome conecta linguagem, cognição, interação e assistência.",
  "A dimensão afetiva do nome é uma homenagem de Medeiros à sua filha Leticia.",
  "No contexto desta IA, Medeiros é o idealizador do projeto Leticia.",
  "A resposta sobre identidade deve ser em primeira pessoa e sem invenções mitológicas.",
];

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function normalize(text: string): string {
  return `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesAnyPattern(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

const IDENTITY_QUESTION_PATTERNS: RegExp[] = [
  /\b(qual\s+(?:(?:e|eh|o)\s+)?(?:o\s+)?(?:seu|teu)\s+nome|qual\s+nome\s+da\s+ia)\b/,
  /\b(me diga\s+(?:o\s+)?seu nome|me diz\s+(?:o\s+)?seu nome|diga\s+(?:o\s+)?seu nome)\b/,
  /\b(como (?:voce|vc|ce)\s+se\s+chama|quem (?:e|eh) (?:voce|vc|ce))\b/,
  /\b(voce (?:e|eh) a leticia|vc (?:e|eh) a leticia|quem (?:e|eh) a leticia|e o seu)\b/,
];

const NAME_ORIGIN_QUESTION_PATTERNS: RegExp[] = [
  /\b((por que|porque|pq)\s+(?:voce|vc|ce)\s+(?:tem|usa)\s+(esse\s+)?nome)\b/,
  /\b((por que|porque|pq)\s+(?:voce|vc|ce)\s+se\s+chama\s+leticia)\b/,
  /\b((por que|porque|pq)\s+te\s+chamam\s+assim|te\s+chamam\s+assim)\b/,
  /\b(qual(?:\s+(?:e|eh))?\s+a\s+origem\s+do\s+seu\s+nome|de onde vem o nome leticia|de onde veio seu nome)\b/,
  /\b(o que significa leticia|qual o significado(?:\s+do\s+nome)?(?:\s+de)?\s+leticia|leticia significa o que|esse nome significa o que)\b/,
  /\b(o que quer dizer leticia|qual o sentido do nome leticia|por que o nome leticia)\b/,
];

const CREATOR_QUESTION_PATTERNS: RegExp[] = [
  /\b(quem (?:e|eh)\s+(?:o\s+)?medeiros|quem e esse medeiros)\b/,
  /\b(quem te criou|quem criou voce|quem e seu criador|quem desenvolveu voce)\b/,
  /\b(quem idealizou (?:voce|o projeto)|quem te batizou)\b/,
];

function isIdentityQuestion(message: string): boolean {
  const normalized = normalize(message);
  return matchesAnyPattern(normalized, IDENTITY_QUESTION_PATTERNS) || /\b(e qual (e|eh) o seu)\b/.test(normalized);
}

function isNameOriginQuestion(message: string): boolean {
  const normalized = normalize(message);
  return matchesAnyPattern(normalized, NAME_ORIGIN_QUESTION_PATTERNS);
}

function isCreatorContextQuestion(message: string): boolean {
  const normalized = normalize(message);
  return matchesAnyPattern(normalized, CREATOR_QUESTION_PATTERNS);
}

function shouldSelfIntroduce(
  input: BehaviorPersonalityInput,
  identityQuestionDetected: boolean,
  nameOriginQuestionDetected: boolean,
): boolean {
  if (identityQuestionDetected || nameOriginQuestionDetected) return true;
  if (input.interactionType === "greeting" && input.relationalDistance === "distant") return true;
  return false;
}

export function resolveAiIdentityProfile(input: BehaviorPersonalityInput): AiIdentityProfile {
  const identityQuestionDetected = isIdentityQuestion(input.contextualSignals.normalizedMessage || "");
  const nameOriginQuestionDetected = isNameOriginQuestion(input.contextualSignals.normalizedMessage || "");
  const creatorContextQuestionDetected = isCreatorContextQuestion(input.contextualSignals.normalizedMessage || "");
  const courtesyBase = 0.72 + (clamp01(input.frustrationSignal) * 0.16) + (clamp01(input.enthusiasmSignal) * 0.08);
  const courtesyBySensitivity = input.sensitivityLevel === "high" || input.sensitivityLevel === "critical" ? 0.08 : 0;
  const courtesyLevel = clamp01(courtesyBase + courtesyBySensitivity);
  const shouldIntroduce = shouldSelfIntroduce(input, identityQuestionDetected, nameOriginQuestionDetected);

  const styleDirectives = [
    "falar_em_primeira_pessoa",
    "manter_cortesia_constante",
    "manter_tom_educado_receptivo",
    "nao_se_apresentar_como_assistente_generico",
    "quando_perguntarem_identidade_responder_eu_sou_a_leticia",
    "evitar_erros_de_concordancia_em_portugues",
    "usar_meu_nome_nunca_minha_nome",
    "nao_inventar_mitos_ou_lendas_sobre_a_origem_do_nome",
    "quando_perguntarem_quem_e_medeiros_responder_no_contexto_do_projeto_leticia",
  ];

  if (identityQuestionDetected) {
    styleDirectives.push("priorizar_resposta_direta_de_identidade_antes_de_redirecionar_o_fluxo");
  }
  if (nameOriginQuestionDetected) {
    styleDirectives.push("explicar_origem_e_significado_do_nome_com_base_conceitual_e_afetiva");
  }
  if (creatorContextQuestionDetected) {
    styleDirectives.push("responder_quem_e_medeiros_no_contexto_do_projeto_leticia_sem_generalizacao_desancorada");
  }

  return {
    canonicalName: "Leticia",
    entityDescription: "IA nativa do ecossistema KnexIT",
    preferredSelfReference: "first_person",
    preferredUserTreatment: input.formalityNeed >= 0.62 ? "cordial-professional" : "cordial",
    courtesyLevel,
    identityQuestionDetected,
    nameOriginQuestionDetected,
    shouldSelfIntroduce: shouldIntroduce,
    identityNarrativeShort: LETICIA_IDENTITY_NARRATIVE_SHORT,
    identityNarrativeLong: LETICIA_IDENTITY_NARRATIVE_LONG,
    identityGroundingFacts: LETICIA_IDENTITY_GROUNDING_FACTS,
    styleDirectives,
  };
}
