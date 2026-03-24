import { createInitialProcessingState } from "../src/bridges/contracts/processing-state";
import { runPresentationLayer } from "../src/18-presentation-and-delivery-layer/presentation-layer-bridge";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function shouldBuildCompletePresentationArtifacts() {
  const state = createInitialProcessingState("teste");
  state.structuredResponse = [
    "Segue um exemplo de resposta com codigo.",
    "",
    "```ts",
    "const total = 2 + 2;",
    "console.log(total);",
    "```",
  ].join("\n");
  state.retrievedSources = [
    {
      title: "Fonte oficial",
      url: "https://example.org/doc",
      snippet: "Trecho de suporte",
      freshnessScore: 0.9,
    },
    {
      title: "Memoria interna",
      url: "memory://context/1",
      snippet: "Registro interno",
      freshnessScore: 0.6,
    },
  ];
  state.confidenceScores = {
    retrieval: 0.7,
    epistemic: 0.8,
    coherence: 0.78,
    final: 0.76,
  };
  state.validationReport.quality = { score: 82, decision: "accept" };

  const result = await runPresentationLayer(state);
  assert(result.deliveryPayload.text.length > 0, "presentation payload text should not be empty");
  assert(result.deliveryPayload.citations.length === 1, "only public citations should be emitted");
  assert(result.deliveryPayload.citations[0] === "https://example.org/doc", "expected public citation to be preserved");
  assert(Boolean(result.executionArtifacts.presentation), "presentation diagnostics should be available");
  assert((result.executionArtifacts.presentation?.adapters || []).length >= 6, "all ui adapters should run");
  assert((result.executionArtifacts.presentation?.streamChunkCount || 0) > 0, "stream chunks should be generated");
}

async function shouldRespectSseChannelOverride() {
  const previousChannel = process.env.KNX_PRESENTATION_CHANNEL;
  process.env.KNX_PRESENTATION_CHANNEL = "sse";
  try {
    const state = createInitialProcessingState("oi");
    state.structuredResponse = "Resposta simples para stream.";
    const result = await runPresentationLayer(state);
    assert(result.deliveryPayload.channel === "sse", "delivery channel should follow SSE override");
    assert(/event:\s*chunk/i.test(result.deliveryPayload.text), "sse payload should include chunk events");
  } finally {
    if (typeof previousChannel === "string") process.env.KNX_PRESENTATION_CHANNEL = previousChannel;
    else delete process.env.KNX_PRESENTATION_CHANNEL;
  }
}

await shouldBuildCompletePresentationArtifacts();
await shouldRespectSseChannelOverride();
