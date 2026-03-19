/**
 * Responsabilidade do arquivo:
 * - Mapear IDs de familias para camadas do pipeline de forma auditavel.
 * - Facilitar verificacao rapida de cobertura por camada.
 * - Evitar acoplamento de map hardcoded espalhado em bridges.
 */
export const FAMILY_TO_LAYER_MAP = {
  "pre-route": [
    "greeting_minimum",
    "verifiable_fact",
    "recency_signal",
    "quick_safety",
  ],
  input: [
    "input_intent",
    "input_domain",
    "input_urgency",
  ],
  language: [
    "pragmatic_signals",
    "surface_semantics",
    "discourse_form",
  ],
  orchestration: [
    "mode_selection",
    "step_planning",
  ],
  knowledge: [
    "knowledge_retrieval",
    "web_fact_verification",
  ],
  reflective: [
    "critical_reflection",
  ],
  inferential: [
    "inferential_projection",
  ],
  academic: [
    "academic_normalization",
  ],
  validation: [
    "validation_factual",
    "validation_policy",
  ],
  observability: [
    "observability_metrics",
  ],
} as const;

