import { NextRequest } from "next/server";

import { createPublicApiContext, handlePublicApiPreflight, jsonWithCors } from "@/app/api/_shared/public-api";
import { logger } from "@/core/utils/logger";

export const runtime = "nodejs";

const ROUTE_OPTIONS = { methods: ["GET"], requireApiKey: false } as const;

export async function OPTIONS(req: NextRequest) {
  return handlePublicApiPreflight(req, ROUTE_OPTIONS);
}

export async function GET(req: NextRequest) {
  const context = createPublicApiContext(req);
  logger.info("PUBLIC_HEALTH_CHECK", {
    requestId: context.requestId,
    path: context.path,
    forwardedHeadersPresent: context.forwardedHeadersPresent,
  });
  return jsonWithCors(
    context,
    {
      ok: true,
      status: "healthy",
      service: "knexspace-api",
      time: new Date().toISOString(),
      request: {
        requestId: context.requestId,
        clientIp: context.clientIp,
        forwardedProto: context.forwardedProto,
        forwardedHost: context.forwardedHost,
        publicBaseUrl: context.publicBaseUrl,
        forwardedHeadersPresent: context.forwardedHeadersPresent,
      },
    },
    200,
    { methods: ROUTE_OPTIONS.methods },
  );
}
