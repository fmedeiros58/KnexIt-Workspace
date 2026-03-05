import { NextRequest } from "next/server";

import {
  buildResponseHeadersWithCors,
  enforcePublicApiRequest,
  handlePublicApiPreflight,
  jsonWithCors,
  sanitizePublicErrorMessage,
} from "@/app/api/_shared/public-api";
import { progressEventStore } from "@/core/rag/v2/progress/event_store";

export const runtime = "nodejs";

const ROUTE_OPTIONS = { methods: ["GET"], requireApiKey: true } as const;

function normalizeRunId(value: string | string[] | undefined) {
  if (Array.isArray(value)) return `${value[0] || ""}`.trim();
  return `${value || ""}`.trim();
}

function parseOptionalPositiveInt(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function createSseFrame(event: string, data: Record<string, unknown>) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function OPTIONS(req: NextRequest) {
  return handlePublicApiPreflight(req, ROUTE_OPTIONS);
}

export async function GET(
  req: NextRequest,
  contextArg: {
    params: { runId: string };
  },
) {
  const { context, response } = enforcePublicApiRequest(req, ROUTE_OPTIONS);
  if (response) return response;

  try {
    const params = contextArg.params;
    const runId = normalizeRunId(params?.runId);
    if (!runId) {
      return jsonWithCors(
        context,
        { ok: false, code: "RUN_ID_REQUIRED", message: "Informe run_id para consultar progresso." },
        400,
        { methods: ROUTE_OPTIONS.methods },
      );
    }

    const mode = `${req.nextUrl.searchParams.get("mode") || ""}`.trim().toLowerCase();
    const latestOnly = mode === "latest" || req.nextUrl.searchParams.get("latest") === "1";
    const limit = parseOptionalPositiveInt(req.nextUrl.searchParams.get("limit"), 80, 1, 500);
    const afterElapsedMs = parseOptionalPositiveInt(req.nextUrl.searchParams.get("after_elapsed_ms"), -1, -1, 86_400_000);

    if (latestOnly) {
      const latest = progressEventStore.latest(runId);
      const events = progressEventStore.list(runId, {
        limit,
        afterElapsedMs: afterElapsedMs >= 0 ? afterElapsedMs : undefined,
      });
      return jsonWithCors(
        context,
        {
          ok: true,
          runId,
          latest,
          events,
        },
        200,
        { methods: ROUTE_OPTIONS.methods },
      );
    }

    const encoder = new TextEncoder();
    const backlog = progressEventStore.list(runId, {
      limit,
      afterElapsedMs: afterElapsedMs >= 0 ? afterElapsedMs : undefined,
    });

    let cleanup = () => undefined;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const emit = (name: string, payload: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(createSseFrame(name, payload)));
        };

        emit("ready", {
          ok: true,
          runId,
          replayed: backlog.length,
        });
        for (const row of backlog) {
          emit("progress", row as unknown as Record<string, unknown>);
        }

        const unsubscribe = progressEventStore.subscribe(runId, (event) => {
          emit("progress", event as unknown as Record<string, unknown>);
          if (event.type === "final" || event.type === "error") {
            emit("done", {
              runId,
              ts: new Date().toISOString(),
            });
          }
        });

        const heartbeat = setInterval(() => {
          emit("ping", {
            runId,
            ts: new Date().toISOString(),
          });
        }, 15_000);

        cleanup = () => {
          clearInterval(heartbeat);
          unsubscribe();
        };
      },
      cancel() {
        cleanup();
      },
    });

    const headers = buildResponseHeadersWithCors(context, { methods: ROUTE_OPTIONS.methods }, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    return new Response(stream, { status: 200, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao consultar progresso.";
    return jsonWithCors(
      context,
      {
        ok: false,
        code: "PROGRESS_STREAM_INTERNAL_ERROR",
        message: sanitizePublicErrorMessage(message, "Falha ao consultar progresso."),
      },
      500,
      { methods: ROUTE_OPTIONS.methods },
    );
  }
}
