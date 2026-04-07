import { runPipelineConductor } from "../../src/00-myelinated-pipeline-core/pipeline-conductor";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function shouldRunDeepPipelineForNonGreetingTurns(): Promise<void> {
  const result = await runPipelineConductor({
    rawMessage:
      "Explique, de forma inferencial e reflexiva, a relação entre linguagem, cognição e identidade na arquitetura da Letícia.",
  });

  const executedLayers = new Set(
    result.state.trace
      .filter((event) => event.action === "layer_executed")
      .map((event) => event.layer),
  );

  const requiredDeepLayers = [
    "reflective",
    "inferential",
    "metacognitive",
    "epistemic-integration",
    "generation",
    "structure",
    "response-behavior",
    "presentation",
  ];

  for (const layer of requiredDeepLayers) {
    assert(executedLayers.has(layer), `expected deep layer to execute: ${layer}`);
  }

  const generationFallbackLeak = result.state.trace.some((event) =>
    event.layer === "generation" &&
    /chat_fallback_generated|chat_fallback_priority_generated|chat_clarification_fallback_generated/i.test(
      event.action || "",
    ),
  );
  assert(!generationFallbackLeak, "non-greeting deep turn should not use conversational fallback");

  const normalizedResponse = `${result.responseText || ""}`.toLowerCase().trim();
  assert(normalizedResponse.length >= 30, "deep non-greeting response should not be empty");
}

void shouldRunDeepPipelineForNonGreetingTurns();
