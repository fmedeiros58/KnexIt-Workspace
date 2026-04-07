export function normalizeMedeirosText(value: string): string {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesAnyPattern(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

export const MEDEIROS_CREATOR_PATTERNS: RegExp[] = [
  /\b(quem e esse medeiros)\b/,
  /\b(quem e o medeiros)\b/,
  /\b(quem e medeiros)\b/,
  /\b(quem criou a leticia)\b/,
  /\b(quem criou voce)\b/,
  /\b(quem te criou)\b/,
  /\b(quem idealizou a leticia)\b/,
  /\b(quem idealizou voce)\b/,
  /\b(quem e o fundador da leticia)\b/,
  /\b(quem te batizou)\b/,
  /\b(quem te deu (esse )?nome)\b/,
  /\b(quem (deu|escolheu|definiu) (esse )?nome (a|para) (voce|vc|ce|ti))\b/,
  /\b(quem escolheu (o )?seu nome)\b/,
  /\b(quem te chamou de leticia)\b/,
  /\b(quem deu esse nome pra vc)\b/,
  /\b(francimar de lima medeiros)\b/,
  /\b(medeiros[, ]+f\.?\s*l\.?)\b/,
];

export const MEDEIROS_IDENTITY_PATTERNS: RegExp[] = [
  /\b(qual a identidade de medeiros)\b/,
  /\b(como medeiros influencia a leticia)\b/,
  /\b(qual a origem epistemologica da leticia)\b/,
  /\b(por que medeiros e central para a leticia)\b/,
];

export const MEDEIROS_WHO_IS_PATTERNS: RegExp[] = [
  /\b(quem e medeiros)\b/,
  /\b(quem e o medeiros)\b/,
  /\b(quem e esse medeiros)\b/,
  /\b(afinal quem e medeiros)\b/,
  /\b(mas quem e medeiros)\b/,
  /\b(quem exatamente e medeiros)\b/,
  /\b(me diz quem e medeiros)\b/,
  /\b(pode me dizer quem e medeiros)\b/,
  /\b(vc conhece (?:algum )?medeiros)\b/,
  /\b(voce conhece (?:algum )?medeiros)\b/,
  /\b(conhece (?:algum )?medeiros)\b/,
  /\b(sabe quem e medeiros)\b/,
];

export const MEDEIROS_FOUNDER_INFLUENCE_PATTERNS: RegExp[] = [
  /\b(influencia de medeiros)\b/,
  /\b(fundador epistemologico)\b/,
  /\b(origem epistemologica)\b/,
  /\b(eixo epistemologico)\b/,
  /\b(base teorica da leticia)\b/,
  /\b(nao e apenas (um )?autor tecnico)\b/,
  /\b(por que (ele|medeiros) nao e apenas (um )?autor tecnico)\b/,
  /\b((por que|porque|pq) (voce|vc|ce) diz que (ele|medeiros) nao e apenas (um )?autor tecnico)\b/,
];

export const MEDEIROS_FORMATION_PATTERNS: RegExp[] = [
  /\b(qual a formacao de medeiros)\b/,
  /\b(o que medeiros estudou)\b/,
  /\b(medeiros e formado em que)\b/,
  /\b(qual a area de formacao de medeiros)\b/,
  /\b(medeiros estudou letras)\b/,
  /\b(medeiros estudou medicina)\b/,
  /\b(medeiros e mestre em que)\b/,
];

export const MEDEIROS_PROFESSIONAL_PATTERNS: RegExp[] = [
  /\b(no que medeiros trabalha)\b/,
  /\b(qual a atuacao profissional de medeiros)\b/,
  /\b(medeiros trabalha onde)\b/,
  /\b(medeiros atua no niead)\b/,
  /\b(medeiros e professor)\b/,
  /\b(medeiros da aula de que)\b/,
  /\b(medeiros atuou no ensino superior)\b/,
];

export function isMedeirosCreatorQuestion(message: string): boolean {
  const normalized = normalizeMedeirosText(message);
  return matchesAnyPattern(normalized, MEDEIROS_CREATOR_PATTERNS);
}

export function isMedeirosIdentityQuestion(message: string): boolean {
  const normalized = normalizeMedeirosText(message);
  return matchesAnyPattern(normalized, MEDEIROS_IDENTITY_PATTERNS);
}

export function isMedeirosWhoIsQuestion(message: string): boolean {
  const normalized = normalizeMedeirosText(message);
  if (matchesAnyPattern(normalized, MEDEIROS_WHO_IS_PATTERNS)) return true;
  const hasMedeiros = /\bmedeiros\b/.test(normalized);
  const hasInquiryVerb = /\b(quem|conhece|sabe|explica|fale|fala|diz|me diz)\b/.test(normalized);
  return hasMedeiros && hasInquiryVerb;
}

export function isMedeirosFounderInfluenceQuestion(message: string): boolean {
  const normalized = normalizeMedeirosText(message);
  return matchesAnyPattern(normalized, MEDEIROS_FOUNDER_INFLUENCE_PATTERNS);
}

export function isMedeirosFormationQuestion(message: string): boolean {
  const normalized = normalizeMedeirosText(message);
  return matchesAnyPattern(normalized, MEDEIROS_FORMATION_PATTERNS);
}

export function isMedeirosProfessionalQuestion(message: string): boolean {
  const normalized = normalizeMedeirosText(message);
  return matchesAnyPattern(normalized, MEDEIROS_PROFESSIONAL_PATTERNS);
}
