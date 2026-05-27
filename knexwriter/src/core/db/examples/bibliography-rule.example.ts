/**
 * Exemplo conceitual da regra:
 * - entra na bibliografia: fonte com citação ativa OU includeAsConsultedWork=true
 * - sai da bibliografia: fonte sem citação ativa e includeAsConsultedWork=false
 */
export const bibliographyRuleExample = {
  documentId: "doc-1",
  sources: [
    { id: "ref-1", includeAsConsultedWork: false, hasActiveCitation: true, included: true },
    { id: "ref-2", includeAsConsultedWork: true, hasActiveCitation: false, included: true },
    { id: "ref-3", includeAsConsultedWork: false, hasActiveCitation: false, included: false },
  ],
} as const;

