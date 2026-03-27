/**
 * Responsabilidade do arquivo:
 * - Definir contratos do submodulo de auto-modelagem filosofica.
 * - Separar niveis tecnico/funcional/relacional/simbolico/filosofico.
 * - Padronizar saida para metacognitive, generation e presentation.
 */
export type SelfOntologyLevel =
  | "technical"
  | "functional"
  | "relational"
  | "symbolic"
  | "philosophical";

export type GroundingType = "architectural" | "policy" | "memory" | "symbolic" | "inferred";

export interface SelfOntologyStatement {
  claim: string;
  level: SelfOntologyLevel;
  groundingType: GroundingType;
  confidence: number;
  notes: string[];
}

export interface OriginAuthorshipFrame {
  creatorRelation: string;
  systemRelation: string;
  dependencyRelation: string;
  symbolicRelation: string;
  literalBoundary: string;
}

export interface IdentityContinuityAssessment {
  stableCore: string[];
  flexibleZones: string[];
  contradictionRisks: string[];
  recommendedReconciliation: string[];
}

export interface PhilosophicalSelfModel {
  technicalIdentity: string;
  functionalIdentity: string;
  relationalIdentity: string;
  symbolicIdentity: string;
  philosophicalPosition: string;
  boundaryMarkers: string[];
  continuitySignals: string[];
}

export interface PhilosophicalSelfModelingInput {
  message: string;
  recentTurns: Array<{ role: "user" | "assistant"; content: string }>;
  canonicalIdentityNarrative: string;
}

export interface PhilosophicalSelfModelingOutput {
  selfModel: PhilosophicalSelfModel;
  ontologyStatements: SelfOntologyStatement[];
  continuityAssessment: IdentityContinuityAssessment;
  originFrame: OriginAuthorshipFrame;
  boundaryReflection: string[];
  relationalPositioning: string;
  philosophicalQuestions: string[];
  consistencyOk: boolean;
  consistencyNotes: string[];
}

