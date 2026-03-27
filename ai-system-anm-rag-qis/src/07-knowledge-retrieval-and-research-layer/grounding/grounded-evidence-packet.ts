/**
 * Responsabilidade do arquivo:
 * - Definir contratos tipados para grounding deliberativo reutilizavel.
 * - Normalizar como evidencias de suporte/contraste/lacuna sao transportadas.
 * - Permitir consumo uniforme por modulos comunicativo, epistemico e filosofico.
 */
import type { RetrievedSource } from "../../bridges/contracts/processing-state";

export type GroundingStance = "supporting" | "contrasting" | "gap" | "dialogic_context";

export interface GroundedEvidenceItem {
  id: string;
  stance: GroundingStance;
  sourceType: "retrieved_source" | "retrieved_evidence" | "active_context" | "recent_turn";
  title: string;
  snippet: string;
  url: string;
  score: number;
  tags: string[];
}

export interface DialogicContextItem {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  relevance: number;
}

export interface GroundingGap {
  id: string;
  label: string;
  reason: string;
  severity: "low" | "medium" | "high";
}

export interface GroundedEvidencePacket {
  query: string;
  supporting: GroundedEvidenceItem[];
  contrasting: GroundedEvidenceItem[];
  gaps: GroundingGap[];
  dialogicContext: DialogicContextItem[];
  confidence: number;
  conflictLevel: number;
  summary: string;
  createdAt: string;
}

export interface DeliberativeGroundingInput {
  query: string;
  retrievedSources: RetrievedSource[];
  retrievedEvidence: string[];
  activeContext: string[];
  recentTurns: Array<{ role: "user" | "assistant"; content: string }>;
  hypothesisSet: Array<{ id: string; claim: string; supportingSources: string[]; contradictorySources: string[] }>;
}

