import { runPipelineConductor } from "../../src/00-myelinated-pipeline-core/pipeline-conductor";

async function verifyReflectiveAlwaysOn() {
  const result = await runPipelineConductor({ rawMessage: "pode me dizer que dia e hoje?" });
  const state = result.state;

  const reflectiveExecuted = state.trace.some(
    (item) => item.layer === "reflective" && item.action === "layer_executed",
  );
  if (!reflectiveExecuted) {
    throw new Error("expected reflective layer to execute");
  }

  const dateGuardExecuted = state.trace.some(
    (item) => item.layer === "generation" && item.action === "date_question_resolved_directly",
  );
  if (!dateGuardExecuted) {
    throw new Error("expected direct date guard to execute");
  }

  if (!/^Hoje [ée] /i.test(result.responseText)) {
    throw new Error("expected direct date response format");
  }
}

void verifyReflectiveAlwaysOn();
