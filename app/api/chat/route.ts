import { createChatRouteHandlers } from "@/app/api/_shared/chat-route-handler";

export const runtime = "nodejs";

const handlers = createChatRouteHandlers({
  routeLabel: "/api/chat",
  requireApiKey: process.env.NODE_ENV === "production",
  proxyThroughKnexAi: true,
  includeRequestMetaInLog: false,
  includeAnswerCharsInSuccessLog: false,
  includeKnownErrorMessageInLog: true,
  enablePipelineModeOverride: true,
  logEvents: {
    request: "RAG_CHAT_API_REQUEST",
    historySanitized: "RAG_CHAT_HISTORY_SANITIZED",
    streamOpen: "RAG_CHAT_API_STREAM_OPEN",
    success: "RAG_CHAT_API_SUCCESS",
    knownError: "RAG_CHAT_API_ERROR",
    internalError: "RAG_CHAT_API_INTERNAL_ERROR",
  },
  codes: {
    messageRequired: "RAG_MESSAGE_REQUIRED",
    messageTooLong: "RAG_CHAT_MESSAGE_TOO_LONG",
    streamMissing: "ASSISTANT_STREAM_MISSING",
    internalError: "RAG_CHAT_INTERNAL_ERROR",
  },
});

export const OPTIONS = handlers.OPTIONS;
export const POST = handlers.POST;
