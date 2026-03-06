import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

const CHAT_URL = process.env.BENCH_CHAT_URL || "http://localhost:3000/api/chat";
const METRICS_URL = process.env.BENCH_METRICS_URL || "http://localhost:3000/api/chat/router-metrics";
const API_KEY = process.env.BENCH_API_KEY || process.env.PUBLIC_API_KEY || "";
const ITERATIONS = Number(process.env.BENCH_ROUTER_ITERATIONS || 2);
const TIMEOUT_MS = Number(process.env.BENCH_ROUTER_TIMEOUT_MS || 45_000);

if (!API_KEY) {
  console.error("BENCH_FAILED missing API key: defina BENCH_API_KEY (ou PUBLIC_API_KEY).");
  process.exit(1);
}

const CASES = [
  { id: "micro_oi", message: "oi" },
  { id: "ack_ok", message: "ok" },
  { id: "short_question", message: "qual a capital do brasil?" },
  { id: "direct_request", message: "resuma em 1 paragrafo o conceito de cache" },
  { id: "complex_plan", message: "analise esse fluxo e crie um plano passo a passo com checklist" },
  { id: "code_patch", message: "implemente um patch no endpoint para tratar timeout e retries" },
  { id: "error_log", message: "analise este erro de timeout ECONNREFUSED e diga causa provavel" },
];

const PHASES = [
  { id: "before_full", pipelineMode: "full" },
  { id: "after_auto", pipelineMode: "auto" },
];

function percentile(sortedValues, p) {
  if (!sortedValues.length) return 0;
  const idx = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil((p / 100) * sortedValues.length) - 1));
  return sortedValues[idx];
}

function classifyError(status, errorText) {
  if (status === 504 || /timeout/i.test(errorText || "")) return "TIMEOUT";
  if (status >= 500 && status <= 599) return "HTTP_5XX";
  if (status >= 400 && status <= 499) return "HTTP_4XX";
  if (!status) return "NETWORK";
  return "OTHER";
}

async function httpJson(url, init, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { ok: response.ok, status: response.status, json, text };
  } catch (error) {
    const isAbort = error instanceof DOMException && error.name === "AbortError";
    return {
      ok: false,
      status: isAbort ? 504 : 0,
      json: null,
      text: isAbort ? "TIMEOUT" : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function resetMetrics() {
  await httpJson(
    METRICS_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify({ reset: true }),
    },
    10_000,
  );
}

async function getMetrics() {
  const response = await httpJson(
    METRICS_URL,
    {
      method: "GET",
      headers: {
        "x-api-key": API_KEY,
      },
    },
    10_000,
  );
  if (!response.ok || !response.json?.router) {
    return null;
  }
  return response.json.router;
}

async function runCase(phase, testCase, iteration) {
  const started = performance.now();
  const response = await httpJson(
    CHAT_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify({
        message: testCase.message,
        history: [],
        stream: false,
        pipelineMode: phase.pipelineMode,
      }),
    },
    TIMEOUT_MS,
  );
  const totalMs = Math.round(performance.now() - started);
  if (!response.ok) {
    return {
      phase: phase.id,
      pipelineMode: phase.pipelineMode,
      caseId: testCase.id,
      iteration,
      ok: false,
      status: response.status,
      totalMs,
      errorClass: classifyError(response.status, response.text),
      error: (response.json?.message || response.text || "").slice(0, 300),
      chars: 0,
    };
  }
  const content = `${response.json?.reply?.content || ""}`;
  return {
    phase: phase.id,
    pipelineMode: phase.pipelineMode,
    caseId: testCase.id,
    iteration,
    ok: true,
    status: response.status,
    totalMs,
    errorClass: null,
    error: null,
    chars: content.length,
    preview: content.slice(0, 180),
  };
}

function summarizePhase(phaseId, entries, metrics) {
  const phaseRows = entries.filter((item) => item.phase === phaseId);
  const okRows = phaseRows.filter((item) => item.ok);
  const total = phaseRows.length;
  const totalMsSorted = okRows.map((item) => item.totalMs).sort((a, b) => a - b);
  const errorHistogram = {};
  for (const row of phaseRows) {
    if (row.ok) continue;
    errorHistogram[row.errorClass] = (errorHistogram[row.errorClass] || 0) + 1;
  }
  return {
    phase: phaseId,
    requests: total,
    success: okRows.length,
    errorRatePct: total ? Number((((total - okRows.length) / total) * 100).toFixed(2)) : 0,
    latencyMs: {
      p50: Math.round(percentile(totalMsSorted, 50)),
      p95: Math.round(percentile(totalMsSorted, 95)),
      avg: okRows.length
        ? Math.round(okRows.reduce((sum, row) => sum + row.totalMs, 0) / okRows.length)
        : 0,
    },
    router: metrics || null,
    errorHistogram,
  };
}

async function runPhase(phase) {
  await resetMetrics();
  const rows = [];
  for (const testCase of CASES) {
    for (let iteration = 1; iteration <= ITERATIONS; iteration += 1) {
      // eslint-disable-next-line no-await-in-loop
      const row = await runCase(phase, testCase, iteration);
      rows.push(row);
    }
  }
  const metrics = await getMetrics();
  return { rows, metrics };
}

async function main() {
  const startedAt = new Date().toISOString();
  const allRows = [];
  const phaseSummaries = [];

  for (const phase of PHASES) {
    // eslint-disable-next-line no-await-in-loop
    const { rows, metrics } = await runPhase(phase);
    allRows.push(...rows);
    phaseSummaries.push(summarizePhase(phase.id, rows, metrics));
  }

  const output = {
    startedAt,
    finishedAt: new Date().toISOString(),
    target: {
      chatUrl: CHAT_URL,
      metricsUrl: METRICS_URL,
    },
    iterations: ITERATIONS,
    cases: CASES,
    phases: PHASES,
    summary: phaseSummaries,
    rows: allRows,
  };

  const resultsDir = path.join(process.cwd(), "bench", "results");
  fs.mkdirSync(resultsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(resultsDir, `rag_router_benchmark_${stamp}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf-8");
  console.log(`RESULT_FILE=${outputPath}`);
  console.log(JSON.stringify(phaseSummaries, null, 2));
}

main().catch((error) => {
  console.error("BENCH_FAILED", error);
  process.exit(1);
});
