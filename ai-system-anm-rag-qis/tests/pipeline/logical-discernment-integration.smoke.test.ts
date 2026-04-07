import { runPipelineConductor } from "../../src/00-myelinated-pipeline-core/pipeline-conductor";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function normalize(value: string): string {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function shouldRunLogicalDiscernmentAndInfluenceDeepOutput(): Promise<void> {
  const prevLlmRuntime = process.env.AI_SYSTEM_ENABLE_LLM_RUNTIME;
  process.env.AI_SYSTEM_ENABLE_LLM_RUNTIME = "0";
  try {
    const result = await runPipelineConductor({
      rawMessage:
        "qual o melhor, se eu tenho um carro pra lavar e o posto fica ao lado da minha casa. o que eu faco para gastar menos gasolina e ainda assim ter meu carro lavado no posto. o principio aqui e a economia.",
    });

    assert(result.route === "inferential", "practical optimization prompt should route to deep inferential path");
    assert(Boolean(result.state.logicalFrame), "logical frame should be present in pipeline state");
    assert(result.state.logicalFrame?.dominantPrinciple === "economy", "dominant principle should be economy");
    assert(
      (result.state.logicalFrame?.recommendedAction || "").includes("acoplar a lavagem"),
      "recommended practical action should be captured in state",
    );

    const traceActions = result.state.trace.map((event) => `${event.layer}:${event.action}`);
    assert(
      traceActions.some((item) => item === "logical-discernment:logical_discernment_started"),
      "logical discernment start trace should exist",
    );
    assert(
      traceActions.some((item) => item === "logical-discernment:logical_frame_built"),
      "logical frame built trace should exist",
    );
    assert(
      traceActions.some((item) => item === "logical-output-audit:logical_output_audit_started"),
      "logical output audit trace should exist",
    );

    const normalizedResponse = normalize(result.responseText);
    assert(
      normalizedResponse.includes("acao") || normalizedResponse.includes("acao pratica"),
      "response should include practical action framing",
    );
    assert(
      !/\bola, usuario\b/.test(normalizedResponse),
      "continuation-hostile greeting artifact should not leak to final output",
    );
  } finally {
    process.env.AI_SYSTEM_ENABLE_LLM_RUNTIME = prevLlmRuntime;
  }
}

void shouldRunLogicalDiscernmentAndInfluenceDeepOutput();
