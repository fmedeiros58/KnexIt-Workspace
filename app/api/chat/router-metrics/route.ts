import { NextRequest } from "next/server";

import {
  enforcePublicApiRequest,
  handlePublicApiPreflight,
  jsonWithCors,
  readJsonBodyWithLimit,
} from "@/app/api/_shared/public-api";
import { getRagRouterStatsSnapshot, resetRagRouterStats } from "@/core/rag/rag-query-service";
import { logger } from "@/core/utils/logger";

export const runtime = "nodejs";

const ROUTE_OPTIONS = { methods: ["GET", "POST"], requireApiKey: true } as const;
const METRICS_ROUTE_OPTIONS = {
  methods: ROUTE_OPTIONS.methods,
  requireApiKey: process.env.NODE_ENV === "production",
} as const;

function parseResetFlag(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["1", "true", "yes", "on"].includes(normalized);
  }
  return false;
}

export async function GET(req: NextRequest) {
  const { context, response } = enforcePublicApiRequest(req, METRICS_ROUTE_OPTIONS);
  if (response) return response;
  const snapshot = getRagRouterStatsSnapshot();
  return jsonWithCors(
    context,
    {
      ok: true,
      router: snapshot,
    },
    200,
    { methods: METRICS_ROUTE_OPTIONS.methods },
  );
}

export async function POST(req: NextRequest) {
  const { context, response } = enforcePublicApiRequest(req, METRICS_ROUTE_OPTIONS);
  if (response) return response;
  const parsed = await readJsonBodyWithLimit(req, context, { methods: METRICS_ROUTE_OPTIONS.methods });
  if (parsed.response) return parsed.response;
  const body = parsed.body || {};
  const reset = parseResetFlag(body?.reset);
  const snapshot = reset ? resetRagRouterStats() : getRagRouterStatsSnapshot();
  if (reset) {
    logger.info("RAG_ROUTER_STATS_RESET", { requestId: context.requestId });
  }
  return jsonWithCors(
    context,
    {
      ok: true,
      reset,
      router: snapshot,
    },
    200,
    { methods: METRICS_ROUTE_OPTIONS.methods },
  );
}

export async function OPTIONS(req: NextRequest) {
  return handlePublicApiPreflight(req, METRICS_ROUTE_OPTIONS);
}
