/**
 * Responsabilidade do arquivo:
 * - Definir limite maximo de retries por categoria de erro.
 * - Impedir retries indevidos em erros de seguranca/memoria.
 * - Fornecer politica simples e deterministica para o conductor.
 */
import type { PipelineErrorCategory } from "./pipeline-error-classifier";

export function resolveRetryAttemptsByCategory(category: PipelineErrorCategory) {
  if (category === "timeout") return 1;
  if (category === "validation") return 1;
  if (category === "tooling") return 1;
  if (category === "knowledge") return 1;
  if (category === "memory") return 0;
  if (category === "safety") return 0;
  return 0;
}
