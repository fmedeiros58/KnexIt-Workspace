/** ai-system-anm */
export function analyzeInterruptionRisk(input: { validatedDraft: string; cautionLevel: number; needsClarification: boolean }): number {
  const shortDraftRisk = input.validatedDraft.length < 40 ? 0.58 : 0.24;
  const clarificationRisk = input.needsClarification ? 0.24 : 0;
  return Math.max(0, Math.min(1, shortDraftRisk + clarificationRisk + (input.cautionLevel * 0.35)));
}
