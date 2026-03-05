#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

import dotenv from "dotenv";
import pg from "pg";

const { Client } = pg;

dotenv.config({ path: ".env.local", override: false });
dotenv.config({ path: ".env", override: false });

function toInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function toBool(value, fallback = false) {
  const normalized = `${value ?? ""}`.trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function normalizeText(text) {
  return `${text || ""}`.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\u0000/g, "");
}

function countApproxTokens(text) {
  const terms = `${text || ""}`.trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return null;
  return terms.length;
}

function findSplitPoint(text, start, hardEnd) {
  if (hardEnd >= text.length) return text.length;
  const minSoftEnd = start + Math.floor((hardEnd - start) * 0.65);
  for (let idx = hardEnd; idx > minSoftEnd; idx -= 1) {
    const ch = text[idx - 1];
    if (ch === "\n") return idx;
  }
  for (let idx = hardEnd; idx > minSoftEnd; idx -= 1) {
    const ch = text[idx - 1];
    if (/\s/.test(ch)) return idx;
  }
  return hardEnd;
}

function trimChunkBounds(text, start, end) {
  let left = start;
  let right = end;
  while (left < right && /\s/.test(text[left])) left += 1;
  while (right > left && /\s/.test(text[right - 1])) right -= 1;
  return { left, right };
}

function chunkTextDeterministic({ text, chunkSizeChars, chunkOverlapChars, maxChunksPerDocument }) {
  const normalizedText = normalizeText(text);
  const size = Math.max(128, Math.trunc(chunkSizeChars));
  const overlap = Math.min(Math.max(0, Math.trunc(chunkOverlapChars)), size - 1);
  const maxChunks = Math.max(1, Math.trunc(maxChunksPerDocument));
  const chunks = [];

  if (!normalizedText.trim()) return chunks;

  let start = 0;
  while (start < normalizedText.length) {
    if (chunks.length >= maxChunks) {
      throw new Error(`Limite de chunks excedido: max=${maxChunks}.`);
    }
    const hardEnd = Math.min(normalizedText.length, start + size);
    const splitEnd = findSplitPoint(normalizedText, start, hardEnd);
    const end = splitEnd > start ? splitEnd : hardEnd;
    const bounds = trimChunkBounds(normalizedText, start, end);
    if (bounds.right > bounds.left) {
      const chunkText = normalizedText.slice(bounds.left, bounds.right);
      chunks.push({
        chunkIndex: chunks.length,
        text: chunkText,
        tokenCount: countApproxTokens(chunkText),
        charStart: bounds.left,
        charEnd: bounds.right,
      });
    }
    if (end >= normalizedText.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

function vectorLiteral(vector) {
  return `[${vector.join(",")}]`;
}

function resolveDbConfig() {
  const explicit = `${process.env.VECTOR_DATABASE_URL || ""}`.trim() || `${process.env.DATABASE_URL || ""}`.trim();
  if (explicit) {
    return {
      connectionString: explicit,
      ssl: toBool(process.env.VECTOR_DB_SSL, false) ? { rejectUnauthorized: false } : undefined,
    };
  }
  return {
    host: process.env.VECTOR_DB_HOST || "127.0.0.1",
    port: toInt(process.env.VECTOR_DB_PORT, 5432),
    database: process.env.VECTOR_DB_NAME || "postgres",
    user: process.env.VECTOR_DB_USER || "postgres",
    password: process.env.VECTOR_DB_PASSWORD || "",
    ssl: toBool(process.env.VECTOR_DB_SSL, false) ? { rejectUnauthorized: false } : undefined,
  };
}

function resolveEmbeddingConfig() {
  const primary = `${process.env.EMBEDDING_BASE_URL || "http://127.0.0.1:8001/v1"}`.trim().replace(/\/+$/, "");
  const rawFallbacks = `${process.env.EMBEDDING_BASE_URL_FALLBACKS || ""}`
    .split(",")
    .map((item) => item.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  const dynamicFallbacks = resolveEmbeddingDynamicFallbacks([primary, ...rawFallbacks]);
  const urls = Array.from(new Set([primary, ...rawFallbacks, ...dynamicFallbacks]));
  return {
    urls,
    model: `${process.env.EMBEDDING_MODEL_NAME || "intfloat/multilingual-e5-base"}`.trim(),
    apiKey: `${process.env.EMBEDDING_API_KEY || "token-local"}`.trim(),
    timeoutMs: Math.max(5_000, toInt(process.env.EMBEDDING_TIMEOUT_MS, 45_000)),
    expectedDimension: Math.max(32, toInt(process.env.EMBEDDING_DIMENSION, 768)),
  };
}

function resolveEmbeddingDynamicFallbacks(seedUrls) {
  const enabled = toBool(process.env.EMBEDDING_WSL_DISCOVERY_ENABLED, true);
  if (!enabled) return [];
  if (process.platform !== "win32") return [];

  const configuredHost = `${process.env.EMBEDDING_WSL_HOST_IP || ""}`.trim();
  let host = configuredHost;
  if (!host) {
    try {
      host = execFileSync("wsl.exe", ["-e", "bash", "-lc", "hostname -I 2>/dev/null | awk '{print $1}'"], {
        encoding: "utf8",
        timeout: 1500,
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      host = "";
    }
  }
  if (!host || !/^\d+\.\d+\.\d+\.\d+$/.test(host)) return [];

  const dynamic = [];
  for (const seed of seedUrls) {
    if (!seed) continue;
    try {
      const parsed = new URL(seed);
      const normalizedHost = `${parsed.hostname || ""}`.trim().toLowerCase();
      if (normalizedHost !== "127.0.0.1" && normalizedHost !== "localhost") continue;
      parsed.hostname = host;
      dynamic.push(parsed.toString().replace(/\/+$/, ""));
    } catch {
      // noop
    }
  }
  return Array.from(new Set(dynamic));
}

function parseDocumentIds(argv) {
  const arg = argv.find((item) => item.startsWith("--document-ids="));
  if (!arg) return [];
  return Array.from(
    new Set(
      arg
        .slice("--document-ids=".length)
        .split(",")
        .map((item) => toInt(item, 0))
        .filter((item) => item > 0),
    ),
  );
}

function hasFlag(argv, flag) {
  return argv.includes(flag);
}

async function embedTexts(config, texts) {
  const payload = {
    model: config.model,
    input: texts,
    encoding_format: "float",
  };
  const errors = [];
  for (const baseUrl of config.urls) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await fetch(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        errors.push(`HTTP ${response.status} em ${baseUrl}: ${body.slice(0, 160)}`);
        continue;
      }
      const json = await response.json();
      const rows = Array.isArray(json?.data) ? json.data : [];
      const vectors = rows.map((row) => row?.embedding).filter((value) => Array.isArray(value));
      if (vectors.length !== texts.length) {
        errors.push(`Quantidade de embeddings divergente em ${baseUrl}: ${vectors.length} != ${texts.length}`);
        continue;
      }
      for (const vector of vectors) {
        if (!Array.isArray(vector) || !vector.every((item) => Number.isFinite(item))) {
          throw new Error(`Embedding invalido retornado por ${baseUrl}.`);
        }
        if (vector.length !== config.expectedDimension) {
          throw new Error(
            `Dimensao invalida em ${baseUrl}: recebido=${vector.length}, esperado=${config.expectedDimension}.`,
          );
        }
      }
      return { vectors, model: `${json?.model || config.model}`.trim() || config.model, baseUrl };
    } catch (error) {
      errors.push(`${baseUrl}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`Falha em todos endpoints de embedding: ${errors.join(" | ")}`);
}

function resolveWorkspacePath(candidatePath) {
  if (!candidatePath || typeof candidatePath !== "string") return "";
  const candidate = candidatePath.trim();
  if (!candidate) return "";
  const absolute = path.isAbsolute(candidate) ? path.resolve(candidate) : path.resolve(process.cwd(), candidate);
  const relative = path.relative(process.cwd(), absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return "";
  return absolute;
}

async function readTextForDocument(client, docRow) {
  const metadata = docRow.metadata && typeof docRow.metadata === "object" ? docRow.metadata : {};
  const ingestion = metadata.ingestion && typeof metadata.ingestion === "object" ? metadata.ingestion : {};
  const extractedPathRaw = `${ingestion.extracted_text_path || ""}`.trim();
  const extractedPath = resolveWorkspacePath(extractedPathRaw);
  if (extractedPath) {
    try {
      const content = await fs.readFile(extractedPath, { encoding: "utf8" });
      if (`${content}`.trim()) {
        return { text: content, source: "extracted_text_file", extractedPath };
      }
    } catch {
      // fallback para reconstruir pelos chunks
    }
  }

  const chunkQuery = await client.query(
    `
    select text
    from vector_store.document_chunks
    where document_id = $1
    order by chunk_index asc
    `,
    [docRow.id],
  );
  const rebuilt = chunkQuery.rows.map((row) => `${row.text || ""}`.trim()).filter(Boolean).join("\n");
  if (!rebuilt.trim()) {
    throw new Error(`Documento ${docRow.id} sem texto extraido e sem chunks legiveis.`);
  }
  return { text: rebuilt, source: "document_chunks", extractedPath: null };
}

async function getGapStats(client, documentId) {
  const result = await client.query(
    `
    with ordered as (
      select
        chunk_index,
        char_start,
        char_end,
        lag(char_end) over(order by chunk_index) as prev_end
      from vector_store.document_chunks
      where document_id = $1
    )
    select
      count(*) filter (where prev_end is not null and char_start > prev_end) as gaps,
      count(*) filter (where prev_end is not null and char_start < prev_end) as overlaps,
      count(*) as total
    from ordered
    `,
    [documentId],
  );
  const row = result.rows[0] || {};
  return {
    gaps: toInt(row.gaps, 0),
    overlaps: toInt(row.overlaps, 0),
    total: toInt(row.total, 0),
  };
}

async function detectDocumentIdsWithGaps(client, limit) {
  const result = await client.query(
    `
    with ordered as (
      select
        document_id,
        chunk_index,
        char_start,
        char_end,
        lag(char_end) over(partition by document_id order by chunk_index) as prev_end
      from vector_store.document_chunks
    ),
    grouped as (
      select
        document_id,
        count(*) filter (where prev_end is not null and char_start > prev_end) as gaps
      from ordered
      group by document_id
    )
    select document_id
    from grouped
    where gaps > 0
    order by document_id asc
    limit $1
    `,
    [Math.max(1, limit)],
  );
  return result.rows.map((row) => toInt(row.document_id, 0)).filter((id) => id > 0);
}

async function reindexDocument({
  client,
  embeddingConfig,
  documentId,
  chunkSizeChars,
  chunkOverlapChars,
  maxChunksPerDocument,
  embeddingBatchSize,
  requireEmbeddings,
  dryRun,
}) {
  const docResult = await client.query(
    `
    select id, title, status, metadata
    from vector_store.documents
    where id = $1
    limit 1
    `,
    [documentId],
  );
  if (!docResult.rows.length) {
    throw new Error(`Documento ${documentId} nao encontrado.`);
  }
  const doc = docResult.rows[0];
  const beforeStats = await getGapStats(client, documentId);
  const textSource = await readTextForDocument(client, doc);
  const chunks = chunkTextDeterministic({
    text: textSource.text,
    chunkSizeChars,
    chunkOverlapChars,
    maxChunksPerDocument,
  });
  if (!chunks.length) {
    throw new Error(`Documento ${documentId} gerou 0 chunks no rechunk.`);
  }

  if (dryRun) {
    return {
      documentId,
      title: doc.title || null,
      dryRun: true,
      beforeStats,
      afterStats: null,
      chunkCount: chunks.length,
      embeddingStatus: "skipped",
      textSource: textSource.source,
    };
  }

  await client.query("begin");
  try {
    await client.query(
      `
      update vector_store.documents
      set
        status = 'processing',
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'embedding_status', 'pending',
          'reindex_started_at', now()
        )
      where id = $1
      `,
      [documentId],
    );

    await client.query("delete from vector_store.document_chunks where document_id = $1", [documentId]);

    const payload = chunks.map((chunk) => ({
      chunk_index: chunk.chunkIndex,
      text: chunk.text,
      token_count: chunk.tokenCount,
      char_start: chunk.charStart,
      char_end: chunk.charEnd,
    }));
    await client.query(
      `
      insert into vector_store.document_chunks (
        document_id,
        chunk_index,
        text,
        token_count,
        char_start,
        char_end
      )
      select
        $1,
        c.chunk_index,
        c.text,
        c.token_count,
        c.char_start,
        c.char_end
      from jsonb_to_recordset($2::jsonb) as c(
        chunk_index int,
        text text,
        token_count int,
        char_start int,
        char_end int
      )
      `,
      [documentId, JSON.stringify(payload)],
    );

    await client.query(
      `
      update vector_store.documents
      set
        status = 'processed',
        metadata =
          coalesce(metadata, '{}'::jsonb) ||
          jsonb_build_object(
            'embedding_status', 'pending',
            'chunk_count', $2::int,
            'reindexed_at', now()
          ) ||
          jsonb_build_object(
            'ingestion',
            coalesce(metadata->'ingestion', '{}'::jsonb) ||
            jsonb_build_object(
              'chunk_size_chars', $3::int,
              'chunk_overlap_chars', $4::int,
              'chunk_count', $2::int,
              'reindexed_at', now()
            )
          )
      where id = $1
      `,
      [documentId, chunks.length, chunkSizeChars, chunkOverlapChars],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }

  let embeddingStatus = "completed";
  let embeddedChunks = 0;
  let failedChunks = 0;
  let embeddingModel = embeddingConfig.model;

  const pendingRowsQuery = () =>
    client.query(
      `
      select dc.id as chunk_id, dc.text
      from vector_store.document_chunks dc
      left join vector_store.chunk_embeddings ce on ce.chunk_id = dc.id
      where dc.document_id = $1
        and ce.chunk_id is null
      order by dc.chunk_index asc
      `,
      [documentId],
    );

  const pendingInitial = await pendingRowsQuery();
  const pending = pendingInitial.rows;
  for (let cursor = 0; cursor < pending.length; cursor += embeddingBatchSize) {
    const batch = pending.slice(cursor, cursor + embeddingBatchSize);
    try {
      const result = await embedTexts(
        embeddingConfig,
        batch.map((row) => `${row.text || ""}`),
      );
      embeddingModel = result.model || embeddingModel;
      await client.query("begin");
      try {
        for (let idx = 0; idx < batch.length; idx += 1) {
          const chunkId = toInt(batch[idx].chunk_id, 0);
          const literal = vectorLiteral(result.vectors[idx]);
          await client.query(
            `
            insert into vector_store.chunk_embeddings (chunk_id, embedding, embedding_model, created_at)
            values ($1, $2::vector, $3, now())
            on conflict (chunk_id)
            do update set
              embedding = excluded.embedding,
              embedding_model = excluded.embedding_model,
              created_at = now()
            `,
            [chunkId, literal, embeddingModel],
          );
        }
        await client.query("commit");
        embeddedChunks += batch.length;
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    } catch (error) {
      failedChunks += batch.length;
      embeddingStatus = "failed";
      console.error(
        `[doc ${documentId}] falha no batch de embeddings (${cursor}-${cursor + batch.length - 1}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  if (failedChunks > 0 && requireEmbeddings) {
    throw new Error(`Documento ${documentId}: embeddings falharam em ${failedChunks} chunks e sao obrigatorios.`);
  }

  const totalChunksAfter = chunks.length;
  const pendingChunksAfter = Math.max(0, totalChunksAfter - embeddedChunks);
  await client.query(
    `
    update vector_store.documents
    set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'embedding_status', $2::text,
      'embedding_indexed_at', now(),
      'embedded_chunks', $3::int,
      'pending_chunks', $4::int,
      'failed_chunks', $5::int,
      'embedding_model', $6::text
    )
    where id = $1
    `,
    [documentId, failedChunks > 0 ? "failed" : "completed", embeddedChunks, pendingChunksAfter, failedChunks, embeddingModel],
  );

  const afterStats = await getGapStats(client, documentId);
  return {
    documentId,
    title: doc.title || null,
    dryRun: false,
    beforeStats,
    afterStats,
    chunkCount: chunks.length,
    embeddingStatus: failedChunks > 0 ? "failed" : "completed",
    textSource: textSource.source,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = hasFlag(argv, "--dry-run");
  const autoGaps = hasFlag(argv, "--auto-gaps");
  const limitArg = argv.find((item) => item.startsWith("--limit="));
  const limit = Math.max(1, toInt(limitArg ? limitArg.slice("--limit=".length) : 200, 200));
  const explicitDocumentIds = parseDocumentIds(argv);
  const chunkSizeChars = Math.max(128, toInt(process.env.RAG_CHUNK_SIZE_CHARS, 1200));
  const chunkOverlapChars = Math.min(Math.max(0, toInt(process.env.RAG_CHUNK_OVERLAP_CHARS, 180)), chunkSizeChars - 1);
  const maxChunksPerDocument = Math.max(1, toInt(process.env.RAG_MAX_CHUNKS_PER_DOC, 5000));
  const embeddingBatchSize = Math.max(1, Math.min(256, toInt(process.env.RAG_INGEST_EMBED_BATCH_SIZE, 16)));
  const requireEmbeddings = toBool(process.env.RAG_INGEST_EMBED_REQUIRED, false);

  const client = new Client(resolveDbConfig());
  await client.connect();

  try {
    let documentIds = explicitDocumentIds;
    if (!documentIds.length && autoGaps) {
      documentIds = await detectDocumentIdsWithGaps(client, limit);
    }
    if (!documentIds.length) {
      throw new Error(
        "Nenhum documento selecionado. Use --document-ids=13,14 ou --auto-gaps (opcional com --limit=100).",
      );
    }

    const embeddingConfig = resolveEmbeddingConfig();
    const results = [];
    for (const documentId of documentIds) {
      console.log(`\n[reindex] documento ${documentId} ...`);
      const result = await reindexDocument({
        client,
        embeddingConfig,
        documentId,
        chunkSizeChars,
        chunkOverlapChars,
        maxChunksPerDocument,
        embeddingBatchSize,
        requireEmbeddings,
        dryRun,
      });
      results.push(result);
      console.log(
        `[ok] doc=${result.documentId} chunks=${result.chunkCount} embeddings=${result.embeddingStatus} ` +
          `gaps_before=${result.beforeStats.gaps} gaps_after=${result.afterStats?.gaps ?? "n/a"} source=${result.textSource}`,
      );
    }

    console.log("\nResumo:");
    for (const row of results) {
      console.log(
        `- doc ${row.documentId}: gaps ${row.beforeStats.gaps} -> ${row.afterStats?.gaps ?? "n/a"}, ` +
          `overlaps ${row.beforeStats.overlaps} -> ${row.afterStats?.overlaps ?? "n/a"}, embeddings=${row.embeddingStatus}`,
      );
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
