import { spawn } from "child_process";
import { setTimeout as sleep } from "timers/promises";

import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseCsv(value) {
  return normalizeString(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniq(values) {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    const normalized = normalizeString(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function parseBoolean(value, fallback = false) {
  const normalized = normalizeString(value).toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parsePositiveInt(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function maskConnectionString(raw) {
  try {
    const parsed = new URL(raw);
    if (parsed.password) parsed.password = "***";
    return parsed.toString();
  } catch {
    return raw;
  }
}

function buildVectorDbCandidatesFromEnv(raw = process.env) {
  const explicit = normalizeString(raw.VECTOR_DATABASE_URL);
  const fallback = normalizeString(raw.DATABASE_URL);
  const fallbackUrls = parseCsv(raw.VECTOR_DATABASE_URL_FALLBACKS);
  const fromParts = `postgresql://${encodeURIComponent(raw.VECTOR_DB_USER || "postgres")}:${encodeURIComponent(
    raw.VECTOR_DB_PASSWORD || "",
  )}@${raw.VECTOR_DB_HOST || "127.0.0.1"}:${raw.VECTOR_DB_PORT || "5432"}/${raw.VECTOR_DB_NAME || "postgres"}`;
  return uniq([explicit, fallback, ...fallbackUrls, fromParts]);
}

function buildApiBaseCandidates(raw = process.env) {
  const fromEnv = [
    normalizeString(raw.PUBLIC_API_BASE_URL),
    normalizeString(raw.NEXT_PUBLIC_APP_URL),
    "http://127.0.0.1:3004",
    "http://127.0.0.1:3000",
  ]
    .map((row) => row.replace(/\/+$/, ""))
    .filter(Boolean);
  return uniq(fromEnv);
}

function runCommand(command, args, timeoutMs = 12000) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timeout = false;
    const timer = setTimeout(() => {
      timeout = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        code: null,
        timeout: false,
        stdout,
        stderr: `${stderr}\n${error.message}`.trim(),
      });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        ok: !timeout && code === 0,
        code,
        timeout,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });
  });
}

async function withTimeout(promise, timeoutMs, label) {
  const timeoutPromise = new Promise((_, reject) => {
    const timer = setTimeout(() => reject(new Error(label)), timeoutMs);
    promise.finally(() => clearTimeout(timer)).catch(() => undefined);
  });
  return Promise.race([promise, timeoutPromise]);
}

function toPrintableError(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

const report = {
  startedAt: new Date().toISOString(),
  host: process.env.COMPUTERNAME || process.env.HOSTNAME || "unknown-host",
  steps: [],
};

const chatTimeoutMs = Number.parseInt(`${process.env.CHAT_PIPELINE_CHAT_TIMEOUT_MS || "90000"}`, 10);
const effectiveChatTimeoutMs = Number.isFinite(chatTimeoutMs) && chatTimeoutMs >= 30_000 ? chatTimeoutMs : 90_000;

const runtime = {
  apiBaseUrl: null,
  documentId: null,
  validationToken: null,
};

async function runStep(id, label, action, options = {}) {
  const critical = options.critical !== false;
  const step = {
    id,
    label,
    critical,
    ok: false,
    durationMs: 0,
    details: {},
  };
  const startedAt = Date.now();
  try {
    const details = await action();
    step.ok = true;
    step.details = details || {};
  } catch (error) {
    step.ok = false;
    step.details = {
      error: toPrintableError(error),
      ...(error && typeof error === "object" && "details" in error ? error.details : {}),
    };
  } finally {
    step.durationMs = Date.now() - startedAt;
    report.steps.push(step);
    const icon = step.ok ? "OK" : step.critical ? "FAIL" : "WARN";
    const headline = `${icon} | ${step.id} | ${step.label} | ${step.durationMs}ms`;
    const detail = step.ok
      ? normalizeString(step.details.message) || ""
      : normalizeString(step.details.error) || "erro nao detalhado";
    console.log(detail ? `${headline} | ${detail}` : headline);
  }
}

await runStep(
  "docker",
  "Docker Engine responsivo",
  async () => {
    const version = await runCommand("docker", ["version", "--format", "{{.Server.Version}}"], 15000);
    if (!version.ok) {
      throw new Error(version.timeout ? "docker version timeout" : version.stderr || "docker version falhou");
    }
    return { message: `docker server version ${version.stdout || "(desconhecida)"}` };
  },
  { critical: false },
);

await runStep("vector-db", "Conexao com banco vetorial", async () => {
  const sslEnabled = parseBoolean(process.env.VECTOR_DB_SSL, false);
  const connectTimeoutMs = parsePositiveInt(process.env.VECTOR_DB_CONNECT_TIMEOUT_MS, 5000, 500, 120000);
  const queryTimeoutMs = parsePositiveInt(process.env.VECTOR_DB_QUERY_TIMEOUT_MS, 6000, 500, 120000);
  const candidates = buildVectorDbCandidatesFromEnv(process.env);
  const errors = [];

  for (const connectionString of candidates) {
    const client = new Client({
      connectionString,
      ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: connectTimeoutMs,
    });
    try {
      await client.connect();
      const ping = await withTimeout(client.query("select 1 as ok"), queryTimeoutMs, "db query timeout");
      const regclass = await withTimeout(
        client.query("select to_regclass('vector_store.documents') as documents_table"),
        queryTimeoutMs,
        "db schema timeout",
      );
      const documentsTable = regclass.rows[0]?.documents_table || null;
      runtime.dbUrl = connectionString;
      await client.end();
      return {
        message: `conectado em ${maskConnectionString(connectionString)}`,
        ping: ping.rows[0]?.ok === 1,
        documentsTable,
      };
    } catch (error) {
      errors.push(`${maskConnectionString(connectionString)} => ${toPrintableError(error)}`);
      await client.end().catch(() => null);
    }
  }
  throw new Error(`sem conexao no banco vetorial: ${errors.join(" | ")}`);
});

await runStep("api-knexai", "API /api/knexai ativa", async () => {
  const candidates = buildApiBaseCandidates(process.env);
  const errors = [];
  for (const baseUrl of candidates) {
    try {
      const response = await withTimeout(fetch(`${baseUrl}/api/knexai`, { method: "GET" }), 8000, "api timeout");
      const text = await response.text();
      const payload = text ? JSON.parse(text) : {};
      if (!response.ok) {
        errors.push(`${baseUrl} => HTTP ${response.status}`);
        continue;
      }
      runtime.apiBaseUrl = baseUrl;
      return {
        message: `${baseUrl}/api/knexai respondeu HTTP ${response.status}`,
        engineMode: payload?.engineMode || null,
        provider: payload?.provider || null,
      };
    } catch (error) {
      errors.push(`${baseUrl} => ${toPrintableError(error)}`);
    }
  }
  throw new Error(`API indisponivel: ${errors.join(" | ")}`);
});

await runStep("ingest", "Ingestao de documento de teste", async () => {
  if (!runtime.apiBaseUrl) throw new Error("apiBaseUrl ausente");
  const token = `PIPELINE-${Date.now()}`;
  runtime.validationToken = token;
  const text = [
    "Documento de healthcheck do pipeline.",
    `Token de validacao: ${token}.`,
    "Este token deve ser recuperado pela resposta do chat.",
  ].join("\n");

  const formData = new FormData();
  formData.append("file", new Blob([text], { type: "text/plain" }), "healthcheck-pipeline.txt");
  formData.append("sessionId", `healthcheck-${Date.now()}`);
  formData.append("sourceType", "healthcheck");

  const response = await withTimeout(
    fetch(`${runtime.apiBaseUrl}/api/ingest`, { method: "POST", body: formData }),
    20_000,
    "ingest timeout",
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok || !payload?.result?.documentId) {
    throw new Error(payload?.message || `falha no ingest (HTTP ${response.status})`);
  }

  runtime.documentId = Number(payload.result.documentId);
  return {
    message: `documentId ${runtime.documentId} criado`,
    embeddingStatus: payload?.result?.embeddingStatus || null,
  };
});

await runStep("document", "Documento indexado e consultavel", async () => {
  if (!runtime.apiBaseUrl || !runtime.documentId) throw new Error("documentId ausente");
  const timeoutMs = 90_000;
  const pollMs = 2_500;
  const startedAt = Date.now();
  let latest = null;

  while (Date.now() - startedAt < timeoutMs) {
    const response = await withTimeout(
      fetch(`${runtime.apiBaseUrl}/api/documents/${runtime.documentId}?limit=1&offset=0`, { method: "GET" }),
      10_000,
      "document lookup timeout",
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok || !payload?.document) {
      throw new Error(payload?.message || `falha no lookup (HTTP ${response.status})`);
    }
    latest = payload.document;
    const ragReady = Boolean(payload.document.ragReady);
    const embeddingStatus = `${payload.document.embeddingStatus || ""}`.toLowerCase();
    if (ragReady || embeddingStatus === "completed") {
      return {
        message: `document ${runtime.documentId} pronto para retrieval`,
        ragReady,
        embeddingStatus,
        totalChunks: payload.document.totalChunks ?? null,
        embeddedChunks: payload.document.embeddedChunks ?? null,
      };
    }
    await sleep(pollMs);
  }

  throw new Error(
    `documento ${runtime.documentId} nao ficou pronto em ${Math.round(timeoutMs / 1000)}s (ultimo status: ${JSON.stringify(latest || {})})`,
  );
});

await runStep("chat", "Chat recupera token do documento", async () => {
  if (!runtime.apiBaseUrl || !runtime.documentId || !runtime.validationToken) {
    throw new Error("estado incompleto para teste de chat");
  }
  const prompt = `Com base somente no documento anexado, responda apenas com o token de validacao exato.`;
  const response = await withTimeout(
    fetch(`${runtime.apiBaseUrl}/api/knexai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        message: prompt,
        history: [],
        stream: false,
        forceRag: true,
        maxResponseTokens: 128,
        documentId: runtime.documentId,
        documentIds: [runtime.documentId],
        composerBound: true,
        composerAttachmentIds: [runtime.documentId],
      }),
    }),
    effectiveChatTimeoutMs,
    "chat timeout",
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || `falha no chat (HTTP ${response.status})`);
  }
  const rawReply = `${payload?.reply?.content || ""}`.trim();
  if (!rawReply) throw new Error("chat retornou resposta vazia");

  const normalizedReply = rawReply.toLowerCase();
  const normalizedToken = runtime.validationToken.toLowerCase();
  const tokenMatched = normalizedReply.includes(normalizedToken);
  if (!tokenMatched) {
    throw new Error(`chat nao recuperou token esperado (${runtime.validationToken}). resposta: ${rawReply}`);
  }
  return {
    message: "token recuperado com sucesso",
    replyPreview: rawReply.slice(0, 200),
    tokenMatched,
  };
});

const failedCritical = report.steps.filter((step) => !step.ok && step.critical);
report.finishedAt = new Date().toISOString();
report.ok = failedCritical.length === 0;
report.failedCriticalSteps = failedCritical.map((step) => step.id);

console.log("\nResumo final:");
console.log(JSON.stringify(report, null, 2));

if (!report.ok) {
  process.exitCode = 1;
}
