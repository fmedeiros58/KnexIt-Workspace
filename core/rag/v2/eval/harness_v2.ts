import { createRagQueryService } from "@/core/rag/rag-query-service";

export type HarnessScenario = {
  name: string;
  question: string;
  expectedMinAnswerChars?: number;
  requireCitations?: boolean;
};

export type HarnessRunResult = {
  scenario: string;
  ok: boolean;
  message: string;
  answerChars: number;
  metadata: Record<string, unknown>;
};

export async function runRagHarnessV2(scenarios: HarnessScenario[]) {
  const rag = createRagQueryService();
  const results: HarnessRunResult[] = [];
  for (const scenario of scenarios) {
    try {
      const response = await rag.query({
        question: scenario.question,
        requestId: `harness-${scenario.name}`,
        pipelineVersion: "v2",
      });
      const answerChars = response.answer.length;
      const citationCount = Number(
        ((response.metadata as Record<string, unknown>).citations as { count?: number } | undefined)?.count || 0,
      );
      const minChars = Math.max(1, Number(scenario.expectedMinAnswerChars || 80));
      const citationsOk = !scenario.requireCitations || citationCount > 0;
      const ok = answerChars >= minChars && citationsOk;
      results.push({
        scenario: scenario.name,
        ok,
        message: ok ? "ok" : `answerChars=${answerChars}, citationCount=${citationCount}`,
        answerChars,
        metadata: response.metadata as Record<string, unknown>,
      });
    } catch (error) {
      results.push({
        scenario: scenario.name,
        ok: false,
        message: error instanceof Error ? error.message : String(error),
        answerChars: 0,
        metadata: {},
      });
    }
  }
  return results;
}
