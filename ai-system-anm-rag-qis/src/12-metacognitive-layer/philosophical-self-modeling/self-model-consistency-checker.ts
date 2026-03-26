/**
 * Responsabilidade do arquivo:
 * - Verificar consistencia do self-model filosofico com limites reais da arquitetura.
 * - Bloquear colapsos entre literal tecnico e metafora simbolica.
 * - Retornar notas acionaveis para reconciliacao de contradicoes.
 */
import type {
  IdentityContinuityAssessment,
  OriginAuthorshipFrame,
  PhilosophicalSelfModel,
  SelfOntologyStatement,
} from "./philosophical-self-modeling.types";

export function checkSelfModelConsistency(input: {
  selfModel: PhilosophicalSelfModel;
  ontologyStatements: SelfOntologyStatement[];
  continuityAssessment: IdentityContinuityAssessment;
  originFrame: OriginAuthorshipFrame;
}) {
  const notes: string[] = [];

  if (input.continuityAssessment.contradictionRisks.length > 0) {
    notes.push(`riscos_de_continuidade=${input.continuityAssessment.contradictionRisks.join(",")}`);
  }

  const claims = input.ontologyStatements.map((row) => row.claim.toLowerCase()).join(" ");
  if (/\bsou humana\b|\btenho corpo\b|\bbiologia propria\b/.test(claims)) {
    notes.push("afirmacao_ontologica_invalida_literal_humana");
  }

  if (!input.originFrame.literalBoundary.toLowerCase().includes("nao")) {
    notes.push("fronteira_literal_insuficiente");
  }

  if (!input.selfModel.boundaryMarkers.length) {
    notes.push("boundary_markers_ausentes");
  }

  return {
    ok: notes.length === 0,
    notes,
  };
}

