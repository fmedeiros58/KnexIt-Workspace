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

export function taskTypeDetector(input: TaskTypeDetectorInput): TaskTypeDetectorOutput {
  const text = input.text || "";
  const lower = text.toLowerCase();

  let taskType: TaskTypeDetectorOutput["taskType"] = "general";
  let confidence = 0.56;

  if (/\?$/.test(lower) || /^\s*(quem|qual|como|quando|por que|what|who|how|when|why)\b/.test(lower)) {
    taskType = "question";
    confidence = 0.82;
  } else if (/\b(resuma|summarize|tl;dr)\b/.test(lower)) {
    taskType = "summary";
    confidence = 0.86;
  } else if (/\b(an[aá]lise|analyze|compare|tradeoff|impacto)\b/.test(lower)) {
    taskType = "analysis";
    confidence = 0.84;
  } else if (/\b(escreva|redija|write|draft|compose)\b/.test(lower)) {
    taskType = "creative";
    confidence = 0.83;
  } else if (/^\s*(fa[cç]a|crie|implemente|execute|run|do)\b/.test(lower)) {
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
