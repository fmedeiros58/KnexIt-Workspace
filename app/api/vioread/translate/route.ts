import { NextResponse } from "next/server";
import { getCachedPageTranslation, setCachedPageTranslation } from "@/vioread/web/services/cache.service";
import { translateTextBlocks } from "@/vioread/web/services/translation.service";
import { makeCacheKey } from "@/vioread/web/lib/utils";
import type { TranslationRequestPayload, TranslationResponsePayload } from "@/vioread/web/lib/types";

export const runtime = "nodejs";

type TranslationInputBlock = TranslationRequestPayload["blocks"][number];

function validatePayload(payload: unknown): payload is TranslationRequestPayload {
  if (!payload || typeof payload !== "object") return false;
  const candidate = payload as Record<string, unknown>;

  if (typeof candidate.documentHash !== "string" || !candidate.documentHash.trim()) return false;
  if (typeof candidate.pageNumber !== "number" || !Number.isFinite(candidate.pageNumber) || candidate.pageNumber < 1) return false;
  if (typeof candidate.sourceLanguage !== "string" || !candidate.sourceLanguage.trim()) return false;
  if (typeof candidate.targetLanguage !== "string" || !candidate.targetLanguage.trim()) return false;
  if (!Array.isArray(candidate.blocks)) return false;

  return candidate.blocks.every((block: unknown) => {
    if (!block || typeof block !== "object") return false;
    const input = block as TranslationInputBlock;
    return typeof input.id === "string" && typeof input.text === "string";
  });
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as TranslationRequestPayload | null;

  if (!validatePayload(payload)) {
    return NextResponse.json({ error: "Payload inválido para tradução de página." }, { status: 400 });
  }

  const cacheKey = makeCacheKey([payload.documentHash, payload.pageNumber, payload.targetLanguage]);
  const cached = getCachedPageTranslation(cacheKey);

  if (cached) {
    const response: TranslationResponsePayload = {
      pageNumber: payload.pageNumber,
      pairs: cached,
      cached: true,
    };
    return NextResponse.json(response);
  }

  try {
    const pairs = await translateTextBlocks({
      sourceLanguage: payload.sourceLanguage,
      targetLanguage: payload.targetLanguage,
      blocks: payload.blocks,
    });

    setCachedPageTranslation(cacheKey, pairs);

    const response: TranslationResponsePayload = {
      pageNumber: payload.pageNumber,
      pairs,
      cached: false,
    };

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao traduzir página.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
