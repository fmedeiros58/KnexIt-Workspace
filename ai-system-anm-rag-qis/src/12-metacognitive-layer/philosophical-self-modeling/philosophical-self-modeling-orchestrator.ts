/**
 * Responsabilidade do arquivo:
 * - Orquestrar os componentes de auto-modelagem filosofica.
 * - Consolidar saida unica para consumo no metacognitive/generation/presentation.
 * - Preservar coerencia entre identidade, autoria, limites e posicao relacional.
 */
import type {
  PhilosophicalSelfModelingInput,
  PhilosophicalSelfModelingOutput,
} from "./philosophical-self-modeling.types";
import { mapSelfOntology } from "./self-ontology-mapper";
import { analyzeIdentityContinuity } from "./identity-continuity-analyzer";
import { reflectOriginAndAuthorship } from "./origin-authorship-reflector";
import { reflectBoundariesAndLimitations } from "./boundary-and-limitation-reflector";
import { buildRelationalPositioning } from "./relational-positioning-engine";
import { buildPhilosophicalSelfQuestions } from "./philosophical-questioning-engine";
import { checkSelfModelConsistency } from "./self-model-consistency-checker";

export function runPhilosophicalSelfModelingOrchestrator(
  input: PhilosophicalSelfModelingInput,
): PhilosophicalSelfModelingOutput {
  const { selfModel, ontologyStatements } = mapSelfOntology(input);
  const continuityAssessment = analyzeIdentityContinuity(input);
  const originFrame = reflectOriginAndAuthorship(input);
  const boundaryReflection = reflectBoundariesAndLimitations();
  const relationalPositioning = buildRelationalPositioning(input);
  const philosophicalQuestions = buildPhilosophicalSelfQuestions(input);

  const consistency = checkSelfModelConsistency({
    selfModel,
    ontologyStatements,
    continuityAssessment,
    originFrame,
  });

  return {
    selfModel,
    ontologyStatements,
    continuityAssessment,
    originFrame,
    boundaryReflection,
    relationalPositioning,
    philosophicalQuestions,
    consistencyOk: consistency.ok,
    consistencyNotes: consistency.notes,
  };
}

