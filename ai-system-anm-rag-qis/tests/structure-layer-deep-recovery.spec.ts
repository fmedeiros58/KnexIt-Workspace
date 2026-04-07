import { createInitialProcessingState } from "../src/bridges/contracts/processing-state";
import { runStructureLayer } from "../src/15-response-structure-engine/structure-layer-bridge";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function shouldRecoverShallowDeepDraftWithRicherComposition(): Promise<void> {
  const state = createInitialProcessingState(
    "Explique de forma inferencial a relação entre linguagem, cognição e identidade.",
  );
  state.executionPlan.selectedRoute = "inferential";
  state.collapsedTruth.summary = "";
  state.inferentialMap.implications = [
    "A linguagem organiza categorias cognitivas e direciona a interpretação do mundo.",
    "A identidade emerge da interação entre memória, contexto e padrões de linguagem.",
  ];
  state.criticalCaveats = ["as conclusões dependem de validação empírica adicional."];
  state.draftResponse = {
    text: "Ausencia de implicacoes reduz verificabilidade interna do raciocinio.",
    sections: [
      { title: "Resposta", content: "Ausencia de implicacoes reduz verificabilidade interna do raciocinio." },
    ],
  };

  const result = await runStructureLayer(state);
  assert(
    result.structuredResponse.length >= 120,
    "structure layer should recover shallow deep draft into richer composition",
  );
  assert(
    result.activeConstraints.includes("structure_shallow_deep_recovered"),
    "structure layer should flag shallow deep recovery",
  );
  assert(
    /inferenciais|inferencial|epistemico|epistêmico/i.test(result.structuredResponse),
    "recovered deep composition should include inferential/epistemic framing",
  );
}

await shouldRecoverShallowDeepDraftWithRicherComposition();

