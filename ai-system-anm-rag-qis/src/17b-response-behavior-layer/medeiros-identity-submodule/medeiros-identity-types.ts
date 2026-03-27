export type MedeirosNarrativeMode = "short" | "long";

export type MedeirosNarrativeBank = {
  openings: string[];
  founderRoleLeads: string[];
  existentialLeads: string[];
  epistemicLeads: string[];
  influenceLeads: string[];
  closings: string[];
  creatorAnswersShort: string[];
  identityAnswersShort: string[];
  influenceAnswersShort: string[];
};

export type MedeirosIdentityProfile = {
  canonicalName: string;
  systemRole: string;
  preferredReference: string;
  identityQuestionDetected: boolean;
  creatorQuestionDetected: boolean;
  founderInfluenceQuestionDetected: boolean;
  formationQuestionDetected: boolean;
  professionalQuestionDetected: boolean;
  shouldExplainMedeiros: boolean;
  shortNarrative: string;
  longNarrative: string;
  groundingFacts: string[];
  epistemicAxes: string[];
  existentialAxes: string[];
  styleDirectives: string[];
};
