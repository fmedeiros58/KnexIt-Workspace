import { NextRequest } from "next/server";
import { resolveIdentityRuntimeSharedContext } from "@/core/identity/shared-memory-context";
import { LeticiaSituationalContextService } from "@/core/leticia/context/situational-context.service";
import { detectLocaleFromText } from "@/core/leticia/utils/text";
import { readIdentityRuntimeStatus, resolveRequestOrigin } from "../_shared";

export const runtime = "nodejs";

const contextService = new LeticiaSituationalContextService();

export async function GET(req: NextRequest) {
  const origin = resolveRequestOrigin(req);
  const prompt = typeof req.nextUrl.searchParams.get("prompt") === "string" ? `${req.nextUrl.searchParams.get("prompt")}` : "";
  const locale = detectLocaleFromText(prompt);

  const [identitySnapshot, sharedIdentityContext] = await Promise.all([
    readIdentityRuntimeStatus(origin, 2_500),
    resolveIdentityRuntimeSharedContext(),
  ]);

  const context = await contextService.build({
    locale,
    identitySnapshot,
    sharedIdentityContext,
  });

  return Response.json(
    {
      ok: true,
      locale,
      context,
    },
    { status: 200 },
  );
}

