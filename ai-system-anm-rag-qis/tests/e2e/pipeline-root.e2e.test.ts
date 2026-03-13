import { runPipelineRootBridge } from "../../src/00-myelinated-pipeline-core/pipeline-root-bridge";

const result = await runPipelineRootBridge({ rawMessage: "oi" });
if (!result.state.deliveryPayload.text) {
  throw new Error("delivery payload should not be empty");
}

