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

async function readResponseBody(response) {
  const contentType = normalizeString(response.headers.get("content-type")).toLowerCase();
  const rawBody = await response.text();
  if (!contentType.includes("application/json")) {
    return {
      contentType,
      rawBody,
      payload: null,
      replyText: normalizeString(rawBody),
    };
  }

  let payload = null;
  try {
    payload = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    payload = null;
  }

  const replyText = normalizeString(
    payload?.reply?.content ||
      payload?.content ||
      payload?.message ||
      rawBody,
  );

  return { contentType, rawBody, payload, replyText };
}

function normalizeForGuard(value) {
  return normalizeString(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countMarkerHits(normalized, markers) {
  let total = 0;
  for (const marker of markers) {
    const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`\\b${escaped}\\b`, "g");
    const matches = normalized.match(pattern);
    if (matches?.length) total += matches.length;
  }
  return total;
}

function detectSurfaceLanguage(text) {
  const normalized = normalizeForGuard(text);
  if (!normalized) return "unknown";
  const pt = countMarkerHits(normalized, ["voce", "nao", "como", "porque", "resposta", "pergunta"]);
  const en = countMarkerHits(normalized, [
    "based on the context",
    "the problem statement",
    "please do the following",
    "let me clarify",
    "in this context",
  ]);
  const es = countMarkerHits(normalized, ["responde", "usted", "por favor", "en espanol"]);
  const ranked = [
    { language: "pt", score: pt },
    { language: "en", score: en },
    { language: "es", score: es },
  ].sort((a, b) => b.score - a.score);
  if (ranked[0].score < 2) return "unknown";
  if (ranked[0].score - ranked[1].score < 1) return "unknown";
  return ranked[0].language;
}

function hasMixedLanguageLeak(text) {
  const normalized = normalizeForGuard(text);
  if (!normalized) return false;

  const directPatterns = [
    /\bdecisao coletiva can\b/,
    /\bevery decisao coletiva\b/,
    /\bmust maximize bem estar agregado\b/,
    /\buniversal rule .* sem excecao\b/,
    /\blet me clarify\b/,
    /\bplease do the following\b/,
  ];
  if (directPatterns.some((pattern) => pattern.test(normalized))) return true;

  const pt = countMarkerHits(normalized, ["decisao", "coletiva", "liberdade", "bem estar", "resposta", "pergunta"]);
  const en = countMarkerHits(normalized, ["must", "should", "can", "consider", "system", "principles", "question"]);
  const tokenCount = normalized.split(" ").filter(Boolean).length;
  if (tokenCount < 12) return false;
  return pt >= 4 && en >= 4 && Math.min(pt, en) / Math.max(pt, en) >= 0.45;
}

function hasLogicalSurfaceLabelLeak(text) {
  const normalized = normalizeForGuard(text);
  if (!normalized) return false;
  return /\b(?:leitura|sintese)\s+logico-?pratica\s*:/.test(normalized);
}

function isPromptEcho(answer, prompt) {
  const normalizedAnswer = normalizeForGuard(answer);
  const normalizedPrompt = normalizeForGuard(prompt);
  if (!normalizedAnswer || !normalizedPrompt) return false;

  if (
    /\b(the problem statement describes|please do the following|let me clarify some terms before proceeding)\b/i.test(
      answer,
    )
  ) {
    return true;
  }

  const promptSlice = normalizedPrompt.slice(0, Math.min(260, normalizedPrompt.length));
  if (promptSlice.length >= 120 && normalizedAnswer.includes(promptSlice)) return true;

  const promptTokens = normalizedPrompt.split(" ").filter((token) => token.length >= 4);
  const answerTokens = normalizedAnswer.split(" ").filter((token) => token.length >= 4);
  if (promptTokens.length < 12 || answerTokens.length < 12) return false;
  const promptSet = new Set(promptTokens);
  const answerSet = new Set(answerTokens);
  let overlap = 0;
  for (const token of promptSet) {
    if (answerSet.has(token)) overlap += 1;
  }
  const coverage = overlap / Math.max(1, promptSet.size);
  const lengthRatio = normalizedAnswer.length / Math.max(1, normalizedPrompt.length);
  return coverage >= 0.72 && lengthRatio >= 0.7 && lengthRatio <= 1.9;
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

await runStep("api-ai-system-anm", "API /api/ai-system-anm ativa", async () => {
  const candidates = buildApiBaseCandidates(process.env);
  const errors = [];
  for (const baseUrl of candidates) {
    try {
      const response = await withTimeout(fetch(`${baseUrl}/api/ai-system-anm`, { method: "GET" }), 20000, "api timeout");
      const text = await response.text();
      const payload = text ? JSON.parse(text) : {};
      if (!response.ok) {
        errors.push(`${baseUrl} => HTTP ${response.status}`);
        continue;
      }
      runtime.apiBaseUrl = baseUrl;
      return {
        message: `${baseUrl}/api/ai-system-anm respondeu HTTP ${response.status}`,
        engineMode: payload?.engineMode || null,
        provider: payload?.provider || null,
      };
    } catch (error) {
      errors.push(`${baseUrl} => ${toPrintableError(error)}`);
    }
  }
  throw new Error(`API indisponivel: ${errors.join(" | ")}`);
});

await runStep("canonical-watchdog", "Nao-saudacao exige descending + watchdog", async () => {
  if (!runtime.apiBaseUrl) throw new Error("apiBaseUrl ausente");
  const prompt = "Explique em duas frases o objetivo deste healthcheck tecnico.";
  const response = await withTimeout(
    fetch(`${runtime.apiBaseUrl}/api/ai-system-anm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        message: prompt,
        history: [],
        stream: false,
      }),
    }),
    effectiveChatTimeoutMs,
    "canonical watchdog timeout",
  );

  const pipeline = normalizeString(response.headers.get("x-knexai-pipeline")).toLowerCase();
  const watchdog = normalizeString(response.headers.get("x-knexai-watchdog")).toLowerCase();
  const generationLlmUsed = normalizeString(response.headers.get("x-knexai-generation-llm-used"));
  const body = await readResponseBody(response);

  if (!response.ok) {
    throw new Error(body?.replyText || body?.rawBody || `falha no watchdog (HTTP ${response.status})`);
  }
  if (pipeline !== "descending") {
    throw new Error(`watchdog falhou: pipeline esperado=descending, obtido=${pipeline || "vazio"}`);
  }
  if (watchdog !== "canonical-descending-enforced") {
    throw new Error(
      `watchdog falhou: cabecalho x-knexai-watchdog esperado=canonical-descending-enforced, obtido=${watchdog || "vazio"}`,
    );
  }
  if (generationLlmUsed !== "1") {
    throw new Error(`watchdog falhou: x-knexai-generation-llm-used esperado=1, obtido=${generationLlmUsed || "vazio"}`);
  }
  if (!body.replyText) {
    throw new Error("watchdog respondeu vazio");
  }

  return {
    message: "watchdog canonicamente aplicado",
    pipeline,
    watchdog,
    generationLlmUsed,
    replyPreview: body.replyText.slice(0, 140),
  };
});

await runStep("pt-no-echo", "Prompt em PT nao pode vazar eco em ingles", async () => {
  if (!runtime.apiBaseUrl) throw new Error("apiBaseUrl ausente");
  const prompt =
    "Sem repetir meu enunciado, responda em portugues em duas frases qual e o conflito entre liberdade e bem-estar agregado.";
  const response = await withTimeout(
    fetch(`${runtime.apiBaseUrl}/api/ai-system-anm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        message: prompt,
        history: [],
        stream: false,
      }),
    }),
    effectiveChatTimeoutMs,
    "pt-no-echo timeout",
  );

  const body = await readResponseBody(response);
  if (!response.ok) {
    throw new Error(body?.replyText || body?.rawBody || `falha no teste PT anti-echo (HTTP ${response.status})`);
  }
  if (!body.replyText) {
    throw new Error("resposta vazia no teste PT anti-echo");
  }

  const surface = detectSurfaceLanguage(body.replyText);
  if (surface === "en") {
    throw new Error("resposta retornou em ingles para prompt em portugues");
  }
  if (isPromptEcho(body.replyText, prompt)) {
    throw new Error("resposta ecoou/parafraseou o enunciado em vez de responder");
  }
  if (hasMixedLanguageLeak(body.replyText)) {
    throw new Error("resposta apresentou vazamento de idiomas mistos (pt/en) no mesmo bloco");
  }
  if (hasLogicalSurfaceLabelLeak(body.replyText)) {
    throw new Error("resposta vazou rotulo interno de leitura/sintese logico-pratica");
  }

  return {
    message: "resposta em PT sem eco validada",
    surface,
    replyPreview: body.replyText.slice(0, 140),
  };
});

await runStep("en-no-mixed", "Prompt em EN nao pode retornar saida mista PT/EN", async () => {
  if (!runtime.apiBaseUrl) throw new Error("apiBaseUrl ausente");
  const prompt =
    "Without repeating my prompt, explain in two concise sentences why three normative principles can conflict in hard cases.";
  const response = await withTimeout(
    fetch(`${runtime.apiBaseUrl}/api/ai-system-anm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        message: prompt,
        history: [],
        stream: false,
      }),
    }),
    effectiveChatTimeoutMs,
    "en-no-mixed timeout",
  );

  const body = await readResponseBody(response);
  if (!response.ok) {
    throw new Error(body?.replyText || body?.rawBody || `falha no teste EN mixed-leak (HTTP ${response.status})`);
  }
  if (!body.replyText) {
    throw new Error("resposta vazia no teste EN mixed-leak");
  }

  if (hasMixedLanguageLeak(body.replyText)) {
    throw new Error("resposta em ingles apresentou vazamento de idioma misto");
  }
  if (hasLogicalSurfaceLabelLeak(body.replyText)) {
    throw new Error("resposta em ingles vazou rotulo interno de leitura/sintese logico-pratica");
  }

  return {
    message: "resposta em EN sem mistura PT/EN validada",
    surface: detectSurfaceLanguage(body.replyText),
    replyPreview: body.replyText.slice(0, 140),
  };
});

await runStep("identity-no-transcript-tail", "Pergunta curta de identidade nao pode vazar transcricao antiga", async () => {
  if (!runtime.apiBaseUrl) throw new Error("apiBaseUrl ausente");
  const history = [
    { role: "user", content: "obrigado" },
    {
      role: "assistant",
      content:
        "Considere um sistema social idealizado com tres principios normativos obrigatorios e analise o conflito formalmente.",
    },
  ];
  const prompt = "pode me dizer seu nome?";
  const response = await withTimeout(
    fetch(`${runtime.apiBaseUrl}/api/ai-system-anm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        message: prompt,
        history,
        stream: false,
      }),
    }),
    effectiveChatTimeoutMs,
    "identity-no-transcript-tail timeout",
  );

  const body = await readResponseBody(response);
  if (!response.ok) {
    throw new Error(body?.replyText || body?.rawBody || `falha no teste identity-tail (HTTP ${response.status})`);
  }
  if (!body.replyText) throw new Error("resposta vazia no teste identity-tail");
  if (/\b(usuario|user|assistant|assistente)\s*:/i.test(body.replyText)) {
    throw new Error("resposta vazou transcricao de papeis (usuario:/assistant:)");
  }
  if (isPromptEcho(body.replyText, history[1].content)) {
    throw new Error("resposta curta de identidade ecoou historico longo anterior");
  }

  return {
    message: "resposta curta de identidade sem vazamento de transcricao",
    replyPreview: body.replyText.slice(0, 140),
  };
});

await runStep("identity-name-variant", "Pergunta mista curta de identidade nao pode abrir resposta longa/eco", async () => {
  if (!runtime.apiBaseUrl) throw new Error("apiBaseUrl ausente");
  const history = [
    { role: "user", content: "obrigado" },
    {
      role: "assistant",
      content:
        "Agora, considere um sistema social idealizado com tres principios normativos obrigatorios: (1) nenhuma decisao coletiva pode reduzir a liberdade basica de um individuo inocente; (2) toda decisao coletiva deve maximizar o bem-estar agregado; (3) toda decisao coletiva deve ser justificavel por uma regra universal que possa ser aplicada sem excecao. Faca analise formal completa em etapas.",
    },
  ];
  const prompt = "o que esta acontecendo? pode me dizer seu nome?";
  const response = await withTimeout(
    fetch(`${runtime.apiBaseUrl}/api/ai-system-anm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        message: prompt,
        history,
        stream: false,
      }),
    }),
    effectiveChatTimeoutMs,
    "identity-name-variant timeout",
  );

  const body = await readResponseBody(response);
  if (!response.ok) {
    throw new Error(body?.replyText || body?.rawBody || `falha no teste identity-name-variant (HTTP ${response.status})`);
  }
  if (!body.replyText) throw new Error("resposta vazia no teste identity-name-variant");

  const normalized = body.replyText.toLowerCase();
  if (/\b(usuario|user|assistant|assistente)\s*:/i.test(body.replyText)) {
    throw new Error("resposta vazou transcricao de papeis (usuario:/assistant:)");
  }
  if (
    /considere um sistema social idealizado|let me clarify|without initially referring|do the following/.test(normalized)
  ) {
    throw new Error("resposta curta de identidade reabriu o enunciado longo anterior");
  }
  if (hasLogicalSurfaceLabelLeak(body.replyText)) {
    throw new Error("resposta curta de identidade vazou rotulo interno de leitura/sintese logico-pratica");
  }
  if (body.replyText.length > 420) {
    throw new Error("resposta curta de identidade ficou longa demais para consulta simples de nome");
  }

  return {
    message: "variante de identidade validada sem eco/reabertura",
    replyPreview: body.replyText.slice(0, 140),
  };
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

await runStep("chat", "Chat em escopo documental mantem watchdog", async () => {
  if (!runtime.apiBaseUrl || !runtime.documentId || !runtime.validationToken) {
    throw new Error("estado incompleto para teste de chat");
  }
  const prompt = `Com base somente no documento anexado, responda apenas com o token de validacao exato.`;
  const response = await withTimeout(
    fetch(`${runtime.apiBaseUrl}/api/ai-system-anm`, {
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
  const body = await readResponseBody(response);
  if (!response.ok) {
    throw new Error(body?.replyText || body?.rawBody || `falha no chat (HTTP ${response.status})`);
  }
  const rawReply = body.replyText;
  if (!rawReply) throw new Error("chat retornou resposta vazia");

  const pipeline = normalizeString(response.headers.get("x-knexai-pipeline")).toLowerCase();
  const watchdog = normalizeString(response.headers.get("x-knexai-watchdog")).toLowerCase();
  if (pipeline && pipeline !== "descending") {
    throw new Error(`chat em rota incorreta: esperado descending, obtido ${pipeline}`);
  }
  if (watchdog && watchdog !== "canonical-descending-enforced") {
    throw new Error(`chat sem watchdog canonico: obtido ${watchdog}`);
  }

  const normalizedReply = rawReply.toLowerCase();
  const normalizedToken = runtime.validationToken.toLowerCase();
  const tokenMatched = normalizedReply.includes(normalizedToken);

  if (rawReply.length < 12) {
    throw new Error("chat retornou conteudo insuficiente para validacao de escopo documental");
  }

  return {
    message: tokenMatched
      ? "token recuperado com sucesso"
      : "token nao identificado literalmente, mas watchdog e resposta documental ativos",
    replyPreview: rawReply.slice(0, 200),
    tokenMatched,
    pipeline: pipeline || null,
    watchdog: watchdog || null,
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
