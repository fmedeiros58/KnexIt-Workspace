/**
 * Responsabilidade do arquivo:
 * - Classificar erros do pipeline por categoria operacional.
 * - Definir se erro e retryable e qual estrategia de fallback aplicar.
 * - Padronizar base de decisao para fallback/retry governados.
 */
export type PipelineErrorCategory =
  | "timeout"
  | "validation"
  | "tooling"
  | "knowledge"
  | "memory"
  | "safety"
  | "unknown";

export interface PipelineErrorClassification {
  category: PipelineErrorCategory;
  retryable: boolean;
  fallbackStrategy: string;
}

export function classifyPipelineError(errorMessage: string): PipelineErrorClassification {
  const message = (errorMessage || "").toLowerCase();

  if (/timeout|timed out|deadline/i.test(message)) {
    return {
      category: "timeout",
      retryable: true,
      fallbackStrategy: "degrade_complexity_and_retry",
    };
  }

  if (/validation|unsupported|hallucination|trace/i.test(message)) {
    return {
      category: "validation",
      retryable: true,
      fallbackStrategy: "retry_with_stricter_validation",
    };
  }

  if (/tool|adapter|connector|fetch|api/i.test(message)) {
    return {
      category: "tooling",
      retryable: true,
      fallbackStrategy: "tool_bypass_or_local_fallback",
    };
  }

  if (/retriev|evidence|citation|web search|knowledge/i.test(message)) {
    return {
      category: "knowledge",
      retryable: true,
      fallbackStrategy: "local_evidence_only",
    };
  }

  if (/memory|regulatory|context/i.test(message)) {
    return {
      category: "memory",
      retryable: false,
      fallbackStrategy: "memory_light_mode",
    };
  }

  if (/safety|policy|restricted|harmful|malicious/i.test(message)) {
    return {
      category: "safety",
      retryable: false,
      fallbackStrategy: "safe_refusal_mode",
    };
  }

  return {
    category: "unknown",
    retryable: false,
    fallbackStrategy: "minimum_safe_fallback",
  };
}
