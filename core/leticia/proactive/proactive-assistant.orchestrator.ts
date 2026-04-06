import type { NextRequest } from "next/server";
import { resolveIdentityRuntimeSharedContext } from "@/core/identity/shared-memory-context";
import { logger } from "@/core/utils/logger";
import type { IdentityRuntimeSnapshot } from "@/app/api/proactive-assistant/_shared";
import {
  buildSharedIdentityRuntimePayload,
  readIdentityRuntimeStatus,
  resolveRequestOrigin,
} from "@/app/api/proactive-assistant/_shared";
import { classifyLeticiaIntent } from "../intent/intent-classifier";
import { LeticiaSituationalContextService } from "../context/situational-context.service";
import { buildLeticiaKernelOutput } from "../kernel";
import { LeticiaPersonMemoryRepository } from "../memory/person-memory.repository";
import { LeticiaMemoryExtractorService } from "../memory/memory-extractor.service";
import { LeticiaMemoryConsolidatorService } from "../memory/memory-consolidator.service";
import { createChunkedTextStream } from "../utils/stream";
import { sanitizeModelFacingText } from "../utils/text";
import { stripLeticiaMetaSpeech } from "../guardrails/meta-speech.guard";

type ChatHistoryItem = {
  role: "user" | "assistant";
  content: string;
};

type OrchestratorInput = {
  req: NextRequest;
  body: Record<string, unknown>;
  prompt: string;
  history: ChatHistoryItem[];
};

function normalizeHistory(value: unknown): ChatHistoryItem[] {
  if (!Array.isArray(value)) return [];
  const normalized: ChatHistoryItem[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const role = (row as { role?: unknown }).role;
    const content = typeof (row as { content?: unknown }).content === "string" ? `${(row as { content?: string }).content}`.trim() : "";
    if ((role === "user" || role === "assistant") && content) {
      normalized.push({ role, content });
    }
  }
  return normalized.slice(-20);
}

async function parseErrorMessage(response: Response) {
  const contentType = `${response.headers.get("content-type") || ""}`.toLowerCase();
  if (contentType.includes("application/json")) {
    const payload = (await response.json().catch(() => null)) as { message?: unknown; detail?: unknown; code?: unknown } | null;
    return `${payload?.message || payload?.detail || payload?.code || ""}`.trim();
  }
  return (await response.text().catch(() => "")).trim().slice(0, 320);
}

function resolveConversationKey(body: Record<string, unknown>, personNodeId: string | null) {
  const candidates = [body.conversationKey, body.conversation_key, body.sessionId, body.session_id, body.threadId, body.thread_id];
  for (const candidate of candidates) {
    const normalized = typeof candidate === "string" ? candidate.trim() : "";
    if (normalized) return normalized.slice(0, 160);
  }
  if (personNodeId) return `proactive:${personNodeId}`;
  return "proactive:anonymous";
}

function isSyntheticProactiveOpenerPrompt(prompt: string) {
  const normalized = prompt.trim().toLowerCase();
  return (
    normalized.startsWith("contexto de streaming em tempo real autorizado:") ||
    normalized === "faca uma saudacao proativa curta para o usuario com base no contexto visual atual. seja natural e objetivo."
  );
}

function buildSyntheticProactiveOpener(input: {
  locale: ReturnType<typeof classifyLeticiaIntent>["locale"];
  displayName: string | null;
  identityConfirmed: boolean;
}) {
  const personName = input.identityConfirmed ? `${input.displayName || ""}`.trim() : "";
  if (input.locale === "en-US") {
    return personName ? `Hello, ${personName}. How can I help?` : "Hello. How can I help?";
  }
  if (input.locale === "es-ES") {
    return personName ? `Hola, ${personName}. Como puedo ayudar?` : "Hola. Como puedo ayudar?";
  }
  return personName ? `Oi, ${personName}. Como posso ajudar?` : "Oi. Como posso ajudar?";
}

export class ProactiveAssistantOrchestrator {
  constructor(
    private readonly contextService = new LeticiaSituationalContextService(),
    private readonly repository = new LeticiaPersonMemoryRepository(),
    private readonly extractor = new LeticiaMemoryExtractorService(),
    private readonly consolidator = new LeticiaMemoryConsolidatorService(),
  ) {}

  normalizeInput(body: Record<string, unknown>) {
    const promptRaw = body.prompt ?? body.message;
    const prompt = typeof promptRaw === "string" ? promptRaw.trim() : "";
    const history = normalizeHistory(body.history);
    return { prompt, history };
  }

  async handle({ req, body, prompt, history }: OrchestratorInput) {
    const origin = resolveRequestOrigin(req);
    const [identitySnapshot, sharedIdentityContext] = await Promise.all([
      readIdentityRuntimeStatus(origin, 2_500),
      resolveIdentityRuntimeSharedContext(),
    ]);

    const intent = classifyLeticiaIntent(prompt);
    const context = await this.contextService.build({
      locale: intent.locale,
      identitySnapshot,
      sharedIdentityContext,
    });

    const conversationKey = resolveConversationKey(body, context.person?.personNodeId || null);
    return this.respond({
      origin,
      prompt,
      history,
      intent,
      context,
      identitySnapshot,
      conversationKey,
    });
  }

  async respond(input: {
    origin: string;
    prompt: string;
    history: ChatHistoryItem[];
    intent: ReturnType<typeof classifyLeticiaIntent>;
    context: Awaited<ReturnType<LeticiaSituationalContextService["build"]>>;
    identitySnapshot: IdentityRuntimeSnapshot | null;
    conversationKey: string;
  }) {
    const safePrompt = sanitizeModelFacingText(input.prompt);
    if (isSyntheticProactiveOpenerPrompt(safePrompt)) {
      const reply = buildSyntheticProactiveOpener({
        locale: input.intent.locale,
        displayName: input.context.person?.displayName || input.context.identity.displayName || input.context.identity.nominalName,
        identityConfirmed: input.context.identity.identityConfirmed,
      });
      return new Response(createChunkedTextStream(reply), {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      });
    }

    const extracted = this.extractor.extractFromUserText(safePrompt);
    let personNodeId = input.context.person?.personNodeId || null;
    if (!personNodeId) {
      const declaredName = extracted.find(
        (candidate) => candidate.memoryKind === "identity" && typeof candidate.metadata.value === "string",
      );
      const displayName = typeof declaredName?.metadata.value === "string" ? declaredName.metadata.value.trim() : "";
      if (displayName) {
        const resolved = await this.repository.resolveOrCreatePerson({
          displayName,
          canonicalName: displayName,
          entityKey: input.context.identity.entityKey,
          identityPersonId: input.context.identity.identityPersistent ? input.context.identity.identityPersonId : null,
          nominalName: input.context.identity.nominalName || displayName,
          linkConfidence: input.context.identity.confidence,
          metadata: {
            source: "self_identified_text",
            identityConfirmed: input.context.identity.identityConfirmed,
            identityScope: input.context.identity.identityScope,
            identityPersistent: input.context.identity.identityPersistent,
          },
        });
        personNodeId = resolved?.personNodeId || null;
      }
    }

    const userTurnId = personNodeId
      ? await this.repository.insertDialogueTurn({
          personNodeId,
          conversationKey: input.conversationKey,
          role: "user",
          content: safePrompt,
          locale: input.intent.locale,
          metadata: {
            intent: input.intent.name,
            identityConfirmed: input.context.identity.identityConfirmed,
            identityPersonId: input.context.identity.identityPersonId,
            identityEntityKey: input.context.identity.entityKey,
            identityScope: input.context.identity.identityScope,
            identityPersistent: input.context.identity.identityPersistent,
          },
        })
      : null;

    if (personNodeId && input.context.identity.someoneInFrame) {
      await this.repository.insertObservation({
        personNodeId,
        identityEntityKey: input.context.identity.entityKey,
        identityPersonId: input.context.identity.identityPersonId,
        observationKind: "visual_presence",
        content:
          input.context.visual.sceneSummary ||
          `Pessoa em quadro: ${input.context.person?.displayName || input.context.identity.label || "interlocutor"} (confianca ${input.context.identity.confidence.toFixed(2)}).`,
        confidence: input.context.identity.confidence,
        payload: {
          visualSource: input.context.identity.visualSource,
          identityConfirmed: input.context.identity.identityConfirmed,
          canonicalIdentityPersonId: input.context.identity.identityPersonId,
          identityScope: input.context.identity.identityScope,
          identityPersistent: input.context.identity.identityPersistent,
          visualContext: input.context.visual,
        },
      });
    }

    if (personNodeId && userTurnId) {
      if (extracted.length) {
        await this.consolidator.consolidate(personNodeId, userTurnId, extracted);
      }
    }

    const kernel = buildLeticiaKernelOutput(input.intent, input.context, safePrompt);
    if (kernel.plan.directReply) {
      const reply = stripLeticiaMetaSpeech(kernel.plan.directReply);
      if (personNodeId) {
        await this.repository.insertDialogueTurn({
          personNodeId,
          conversationKey: input.conversationKey,
          role: "assistant",
          content: reply,
          locale: input.intent.locale,
          metadata: { mode: kernel.plan.mode, direct: true },
        });
      }
      return new Response(createChunkedTextStream(reply), {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      });
    }

    const upstream = await fetch(`${input.origin}/api/ai-system-anm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        prompt: kernel.enrichedPrompt,
        history: input.history,
        sharedIdentityRuntime: buildSharedIdentityRuntimePayload(input.identitySnapshot) || undefined,
      }),
    });

    if (!upstream.ok) {
      const detail = await parseErrorMessage(upstream);
      return Response.json(
        {
          ok: false,
          code: "PROACTIVE_UPSTREAM_ERROR",
          message: detail || `Falha ao consultar o motor proativo (HTTP ${upstream.status}).`,
        },
        { status: upstream.status >= 500 ? 502 : upstream.status },
      );
    }

    const fullText = await upstream.text();
    const cleaned =
      stripLeticiaMetaSpeech(fullText) ||
      (input.intent.locale === "en-US"
        ? "I can answer that more directly."
        : input.intent.locale === "es-ES"
          ? "Puedo responder eso de forma mas directa."
          : "Posso responder isso de forma mais direta.");
    if (personNodeId && cleaned) {
      try {
        await this.repository.insertDialogueTurn({
          personNodeId,
          conversationKey: input.conversationKey,
          role: "assistant",
          content: cleaned,
          locale: input.intent.locale,
          metadata: { mode: kernel.plan.mode, direct: false },
        });
      } catch (error) {
        logger.warn("LETICIA_ASSISTANT_TURN_PERSIST_WARN", {
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return new Response(createChunkedTextStream(cleaned), {
      status: upstream.status,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }
}
