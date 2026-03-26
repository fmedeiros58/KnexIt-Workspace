/**
 * Responsabilidade do arquivo:
 * - Planejar progressao dialogal da resposta em vez de monologo frio.
 * - Equilibrar objetividade com elaboracao conjunta das ideias.
 * - Limitar perguntas proativas para evitar interrogatorio.
 */
import type {
  CoConstructionPlan,
  ConceptDecomposition,
  DialogicalTension,
  IdeaSeed,
} from "./communicative-elaboration.types";

export function buildCoConstructionPlan(
  seed: IdeaSeed,
  decomposition: ConceptDecomposition,
  tensions: DialogicalTension[],
): CoConstructionPlan {
  const openingMove =
    `Leitura inicial: ${seed.coreClaim}. Vou desenvolver isso com voce de forma progressiva,` +
    " separando o que esta mais consolidado do que ainda precisa de teste.";

  const reasoningMoves = [
    `1) Delimitar o nucleo conceitual (${decomposition.rootConcepts.slice(0, 3).join(", ") || "nucleo_em_aberto"}).`,
    `2) Tornar explicitos os pressupostos (${decomposition.implicitAssumptions.slice(0, 2).join(", ")}).`,
    `3) Explorar tensoes produtivas (${tensions.slice(0, 2).map((t) => `${t.poleA} x ${t.poleB}`).join("; ") || "sem_tensao_explicita"}).`,
    "4) Fechar com sintese orientada por evidencias e limites epistemicos.",
  ];

  const optionalClarifyingQuestion =
    seed.ambiguityNotes.length > 0
      ? "Para calibrar melhor: voce quer uma resposta mais sintetica ou uma elaboracao mais densa com hipoteses alternativas?"
      : null;

  const closureMove =
    "Fecho com uma sintese objetiva e, se houver lacunas, deixo explicito o que precisa de evidencia adicional.";

  return {
    openingMove,
    reasoningMoves,
    optionalClarifyingQuestion,
    closureMove,
  };
}

