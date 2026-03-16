import { runPipelineConductor } from "../../src/00-myelinated-pipeline-core/pipeline-conductor";

async function smoke() {
  const result = await runPipelineConductor({ rawMessage: "Qual e o nome do presidente atual dos EUA?" });
  if (!result.responseText) {
    throw new Error("expected non-empty response text");
  }
}

void smoke();

