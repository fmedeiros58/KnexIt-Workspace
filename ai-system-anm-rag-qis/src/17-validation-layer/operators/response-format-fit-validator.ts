/**
 * @file response-format-fit-validator.ts
 * @description Verifica se a resposta respeita o formato esperado e o regime logico do TaskContract.
 * @layer 17-validation-layer
 * @purpose Reduzir mismatch entre classe cognitiva, forma de entrega final e prova curta sob restricoes.
 * @inputs Resposta candidata e TaskContract.
 * @outputs Achados de formato.
 * @dependsOn bridges/contracts/task-contract, bridges/contracts/validation-report.
 * @usedBy validation-layer-bridge.
 * @invariants O validador de formato nao deve exigir detalhes que o usuario proibiu.
 * @notes Para deducao fechada, privilegia conclusao/acao decisiva antes de justificativa.
 */
import type { TaskContract } from "../../bridges/contracts/task-contract";
import type { TaskClassValidationFinding } from "../../bridges/contracts/validation-report";

function normalizeValidationText(value: string): string {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function validateResponseFormatFit(answer: string, contract: TaskContract | null): TaskClassValidationFinding[] {
  if (!contract) return [];
  const findings: TaskClassValidationFinding[] = [];
  const expected = new Set(contract.expectedOutputFormat);
  const normalized = normalizeValidationText(answer);

  if (expected.has("ordered-steps") && !/(^|\n)\s*(1\.|-|\*)\s+/m.test(answer)) {
    findings.push({ validatorId: "response-format-fit-validator", severity: "warning", message: "formato esperado em passos nao foi usado" });
  }
  if (expected.has("grounded-analysis") && contract.needsRetrieval && !/\bfonte|evidencia|com base|segundo\b/.test(normalized)) {
    findings.push({ validatorId: "response-format-fit-validator", severity: "warning", message: "analise grounded sem marcador de evidencia" });
  }
  if (expected.has("conclusion-first") && !/^\s*(a resposta|resposta|solucao|portanto|logo|retire|pegue|tire)/i.test(normalized)) {
    findings.push({ validatorId: "response-format-fit-validator", severity: "warning", message: "deducao fechada nao comeca pela conclusao ou acao decisiva" });
  }

  if (
    contract.logicalAdequacy?.requiresConstraintProof &&
    !/\b(apenas|somente|uma unica|um unico|restricao|etiqueta|rotulo|deduz|logo|portanto|porque|como)\b/.test(normalized)
  ) {
    findings.push({
      validatorId: "response-format-fit-validator",
      severity: "warning",
      message: "resposta logica fechada nao torna visivel a restricao usada na prova",
    });
  }

  return findings;
}
