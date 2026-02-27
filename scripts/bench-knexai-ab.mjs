import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

const MODES = [
  { key: "anm", url: process.env.BENCH_ANM_URL || "http://localhost:3000/api/knexai" },
  { key: "direct", url: process.env.BENCH_DIRECT_URL || "http://localhost:3010/api/knexai" },
];

const ITERATIONS = Number(process.env.BENCH_ITERATIONS || 2);
const TIMEOUT_MS = Number(process.env.BENCH_TIMEOUT_MS || 90_000);

const CASES = [
  {
    id: "capital_br",
    prompt: "Qual é a capital do Brasil?",
    checks: [
      { type: "includesAny", values: ["brasília", "brasilia"] },
      { type: "maxWords", value: 14 },
    ],
  },
  {
    id: "math_12x13",
    prompt: "Quanto é 12 x 13? Responda apenas o resultado.",
    checks: [
      { type: "includes", value: "156" },
      { type: "maxWords", value: 8 },
    ],
  },
  {
    id: "translate_bom_dia",
    prompt: "Traduza para inglês: bom dia.",
    checks: [
      { type: "includesAny", values: ["good morning"] },
      { type: "maxWords", value: 5 },
    ],
  },
  {
    id: "synonym_fast",
    prompt: "Dê um sinônimo de rápido em português.",
    checks: [
      { type: "minChars", value: 3 },
      { type: "maxWords", value: 16 },
    ],
  },
  {
    id: "http_https",
    prompt: "Explique a diferença entre HTTP e HTTPS em 3 tópicos curtos.",
    checks: [
      { type: "includes", value: "http" },
      { type: "includes", value: "https" },
    ],
  },
  {
    id: "git_branch",
    prompt: "Passo a passo para criar uma branch no git.",
    checks: [{ type: "includes", value: "git" }],
  },
  {
    id: "micro_social",
    prompt: "oi",
    checks: [{ type: "maxWords", value: 18 }],
  },
  {
    id: "strict_ok",
    prompt: "Responda apenas com: ok",
    checks: [{ type: "exactAny", values: ["ok", "ok."] }],
  },
];

function percentile(sortedValues, p) {
  if (!sortedValues.length) return 0;
  const idx = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil((p / 100) * sortedValues.length) - 1));
  return sortedValues[idx];
}

function evaluate(text, checks) {
  const normalized = String(text || "").trim();
  const lowered = normalized.toLowerCase();
  for (const check of checks) {
    if (check.type === "includes") {
      if (!lowered.includes(String(check.value).toLowerCase())) return false;
      continue;
    }
    if (check.type === "includesAny") {
      const ok = (check.values || []).some((candidate) => lowered.includes(String(candidate).toLowerCase()));
      if (!ok) return false;
      continue;
    }
    if (check.type === "minChars") {
      if (normalized.length < Number(check.value || 0)) return false;
      continue;
    }
    if (check.type === "maxWords") {
      const words = normalized.split(/\s+/).filter(Boolean);
      if (words.length > Number(check.value || 0)) return false;
      continue;
    }
    if (check.type === "exactAny") {
      const ok = (check.values || []).some((candidate) => lowered === String(candidate).toLowerCase());
      if (!ok) return false;
      continue;
    }
  }
  return true;
}

async function readStreamText(res) {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let firstChunkMs = null;
  const started = performance.now();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (firstChunkMs == null) {
      firstChunkMs = Math.round(performance.now() - started);
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return { text, firstChunkMs: firstChunkMs ?? Math.round(performance.now() - started) };
}

async function runCase(mode, testCase, iteration) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = performance.now();
  try {
    const res = await fetch(mode.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: testCase.prompt, history: [] }),
      signal: controller.signal,
    });
    const status = res.status;
    const headerMs = Math.round(performance.now() - started);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        mode: mode.key,
        caseId: testCase.id,
        iteration,
        ok: false,
        status,
        headerMs,
        firstChunkMs: null,
        totalMs: Math.round(performance.now() - started),
        chars: 0,
        qualityPass: false,
        error: body.slice(0, 300) || `HTTP_${status}`,
      };
    }

    const { text, firstChunkMs } = await readStreamText(res);
    const totalMs = Math.round(performance.now() - started);
    const qualityPass = evaluate(text, testCase.checks);
    return {
      mode: mode.key,
      caseId: testCase.id,
      iteration,
      ok: true,
      status,
      headerMs,
      firstChunkMs,
      totalMs,
      chars: text.length,
      qualityPass,
      error: null,
      responsePreview: text.slice(0, 220),
    };
  } catch (error) {
    const isAbort = error instanceof DOMException && error.name === "AbortError";
    return {
      mode: mode.key,
      caseId: testCase.id,
      iteration,
      ok: false,
      status: isAbort ? 504 : 0,
      headerMs: null,
      firstChunkMs: null,
      totalMs: Math.round(performance.now() - started),
      chars: 0,
      qualityPass: false,
      error: isAbort ? "TIMEOUT" : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function summarize(modeKey, entries) {
  const total = entries.length;
  const success = entries.filter((entry) => entry.ok);
  const errors = total - success.length;
  const qualityPasses = success.filter((entry) => entry.qualityPass).length;
  const firstChunkValues = success.map((entry) => entry.firstChunkMs).filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  const totalValues = success.map((entry) => entry.totalMs).filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  const charsValues = success.map((entry) => entry.chars).sort((a, b) => a - b);

  return {
    mode: modeKey,
    requests: total,
    success: success.length,
    errorRatePct: total ? Number(((errors / total) * 100).toFixed(2)) : 0,
    qualityPassRatePct: success.length ? Number(((qualityPasses / success.length) * 100).toFixed(2)) : 0,
    firstChunkP50Ms: Math.round(percentile(firstChunkValues, 50)),
    firstChunkP95Ms: Math.round(percentile(firstChunkValues, 95)),
    totalP50Ms: Math.round(percentile(totalValues, 50)),
    totalP95Ms: Math.round(percentile(totalValues, 95)),
    charsMedian: Math.round(percentile(charsValues, 50)),
  };
}

async function main() {
  const startedAt = new Date().toISOString();
  const results = [];

  for (const mode of MODES) {
    // Warmup
    await runCase(mode, CASES[0], 0);
    for (const testCase of CASES) {
      for (let iteration = 1; iteration <= ITERATIONS; iteration += 1) {
        // eslint-disable-next-line no-await-in-loop
        const entry = await runCase(mode, testCase, iteration);
        results.push(entry);
      }
    }
  }

  const summary = MODES.map((mode) => summarize(mode.key, results.filter((entry) => entry.mode === mode.key)));
  const output = {
    startedAt,
    finishedAt: new Date().toISOString(),
    iterations: ITERATIONS,
    urls: Object.fromEntries(MODES.map((mode) => [mode.key, mode.url])),
    summary,
    cases: CASES.map((item) => ({ id: item.id, prompt: item.prompt })),
    results,
  };

  const resultsDir = path.join(process.cwd(), "bench", "results");
  fs.mkdirSync(resultsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = path.join(resultsDir, `knexai_ab_${stamp}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(output, null, 2)}\n`, "utf-8");

  console.log(`RESULT_FILE=${filePath}`);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("BENCH_FAILED", error);
  process.exit(1);
});
