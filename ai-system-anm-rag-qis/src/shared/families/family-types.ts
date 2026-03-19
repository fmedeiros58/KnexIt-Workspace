/**
 * Responsabilidade do arquivo:
 * - Definir tipos canonicos para catalogo de familias operacionais.
 * - Padronizar camada, custo e ativacao sem acoplar execucao real.
 * - Servir como contrato de auditoria entre registry, policy e runtime resolver.
 */
export type FamilyLayer =
  | "pre-route"
  | "input"
  | "language"
  | "orchestration"
  | "knowledge"
  | "reflective"
  | "inferential"
  | "metacognitive"
  | "epistemic"
  | "generation"
  | "structure"
  | "academic"
  | "validation"
  | "observability";

export type FamilyCost =
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "very-high";

export type FamilyActivationMode =
  | "always-light"
  | "route-gated"
  | "step-gated"
  | "latency-gated"
  | "safety-gated"
  | "intent-gated"
  | "domain-gated"
  | "validation-gated";

export interface FamilyDefinition {
  id: string;
  label: string;
  layer: FamilyLayer;
  cost: FamilyCost;
  activationMode: FamilyActivationMode;
  description: string;
  preferredRoute?: Array<"minimum" | "reflective" | "inferential" | "quantum-state">;
  preferredSteps?: string[];
  tags?: string[];
}

