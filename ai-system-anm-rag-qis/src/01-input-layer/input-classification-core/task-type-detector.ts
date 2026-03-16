export interface TaskTypeDetectorInput {
  text: string;
}

export interface TaskTypeDetectorOutput {
  taskType: "question" | "instruction" | "creative" | "analysis" | "summary" | "general";
  confidence: number;
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

function normalize(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function taskTypeDetector(input: TaskTypeDetectorInput): TaskTypeDetectorOutput {
  const text = input.text || "";
  const normalized = normalize(text);

  let taskType: TaskTypeDetectorOutput["taskType"] = "general";
  let confidence = 0.56;

  if (/\?$/.test(normalized) || /^\s*(quem|qual|como|quando|por que|what|who|how|when|why)\b/.test(normalized)) {
    taskType = "question";
    confidence = 0.82;
  } else if (/\b(resuma|summarize|tl;dr)\b/.test(normalized)) {
    taskType = "summary";
    confidence = 0.86;
  } else if (/\b(analise|analyze|compare|tradeoff|impacto)\b/.test(normalized)) {
    taskType = "analysis";
    confidence = 0.84;
  } else if (/\b(escreva|redija|write|draft|compose)\b/.test(normalized)) {
    taskType = "creative";
    confidence = 0.83;
  } else if (/^\s*(faca|crie|implemente|execute|run|do)\b/.test(normalized)) {
    taskType = "instruction";
    confidence = 0.78;
  }

  return {
    taskType,
    confidence: Number(confidence.toFixed(4)),
    ok: true,
    component: "task-type-detector",
    score: Number(confidence.toFixed(4)),
    detail: taskType,
    context: {
      length: text.length,
    },
  };
}
