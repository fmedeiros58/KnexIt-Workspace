import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function kebabToCamel(fileName: string): string {
  return fileName
    .replace(/\.ts$/, "")
    .split("-")
    .map((part, index) => (index === 0 ? part : `${part[0].toUpperCase()}${part.slice(1)}`))
    .join("");
}

const ROOT = path.resolve(process.cwd(), "src");

const COVERAGE = [
  {
    layer: "03-conversation",
    bridge: "03-conversation-layer/conversation-layer-bridge.ts",
    operators: ["topic-shift-detector.ts", "continuity-scorer.ts", "carryover-policy.ts"],
  },
  {
    layer: "04-context",
    bridge: "04-context-and-session-layer/context-layer-bridge.ts",
    operators: ["context-pruner.ts", "session-focus-updater.ts", "session-operating-mode-tracker.ts"],
  },
  {
    layer: "06-memory",
    bridge: "06-memory-and-plasticity-layer/memory-layer-bridge.ts",
    operators: ["memory-pressure-estimator.ts", "memory-read-policy.ts", "memory-write-policy.ts"],
  },
  {
    layer: "07-knowledge",
    bridge: "07-knowledge-retrieval-and-research-layer/knowledge-layer-bridge.ts",
    operators: ["retrieval-need-estimator.ts", "retrieval-intensity-resolver.ts", "evidence-ranker.ts", "contradiction-detector.ts"],
  },
  {
    layer: "10-reflective",
    bridge: "10-reflective-layer/reflective-layer-bridge.ts",
    operators: ["reflection-depth-resolver.ts", "first-pass-critique.ts", "alternative-interpretation-builder.ts"],
  },
  {
    layer: "11-inferential",
    bridge: "11-inferential-layer/inferential-layer-bridge.ts",
    operators: ["inference-depth-resolver.ts", "hypothesis-expander.ts"],
  },
  {
    layer: "13-epistemic",
    bridge: "13-epistemic-integration-layer/epistemic-integration-layer-bridge.ts",
    operators: ["evidence-confidence-scorer.ts", "claim-support-mapper.ts", "conflict-consolidator.ts"],
  },
  {
    layer: "17-validation",
    bridge: "17-validation-layer/validation-layer-bridge.ts",
    operators: ["structural-validator.ts", "epistemic-validator.ts", "confidence-checker.ts"],
  },
  {
    layer: "17b-response-behavior",
    bridge: "17b-response-behavior-layer/response-behavior-layer-bridge.ts",
    operators: ["response-behavior-selector.ts"],
  },
  {
    layer: "17c-proactivity-gate",
    bridge: "17c-proactivity-gate-layer/proactivity-gate-layer-bridge.ts",
    operators: ["proactivity-threshold-resolver.ts"],
  },
  {
    layer: "17e-humanizer",
    bridge: "17e-linguistic-humanizer-layer/linguistic-humanizer-layer-bridge.ts",
    operators: ["humanization-intensity-resolver.ts"],
  },
  {
    layer: "17f-calibration",
    bridge: "17f-response-calibration-layer/response-calibration-layer-bridge.ts",
    operators: ["response-commitment-regulator.ts", "calibration-depth-resolver.ts"],
  },
];

for (const layer of COVERAGE) {
  const bridgePath = path.join(ROOT, layer.bridge);
  const bridgeSource = readFileSync(bridgePath, "utf8");
  const operatorDir = path.join(path.dirname(bridgePath), "operators");

  for (const operatorFile of layer.operators) {
    const operatorPath = path.join(operatorDir, operatorFile);
    const importPath = `./operators/${operatorFile.replace(/\.ts$/, "")}`;
    const functionName = kebabToCamel(operatorFile);

    assert(existsSync(operatorPath), `${layer.layer} should provide operator file ${operatorFile}`);
    assert(
      bridgeSource.includes(importPath),
      `${layer.layer} bridge should import ${operatorFile}`,
    );
    assert(
      bridgeSource.includes(`${functionName}(`),
      `${layer.layer} bridge should call ${functionName}`,
    );
  }
}
