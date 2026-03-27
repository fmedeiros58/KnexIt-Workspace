import { createChatRouteHandlers } from "@/app/api/_shared/chat-route-handler";

export const runtime = "nodejs";

const handlers = createChatRouteHandlers({
  routeLabel: "/chat",
  requireApiKey: true,
  includeRequestMetaInLog: true,
  includeAnswerCharsInSuccessLog: true,
  includeKnownErrorMessageInLog: false,
  enablePipelineModeOverride: false,
  logEvents: {
    request: "PUBLIC_CHAT_REQUEST",
    historySanitized: "PUBLIC_CHAT_HISTORY_SANITIZED",
    streamOpen: "PUBLIC_CHAT_STREAM_OPEN",
    success: "PUBLIC_CHAT_SUCCESS",
    knownError: "PUBLIC_CHAT_ERROR",
    internalError: "PUBLIC_CHAT_INTERNAL_ERROR",
  },
  codes: {
    messageRequired: "RAG_MESSAGE_REQUIRED",
    messageTooLong: "PUBLIC_CHAT_MESSAGE_TOO_LONG",
    streamMissing: "ASSISTANT_STREAM_MISSING",
    internalError: "RAG_CHAT_INTERNAL_ERROR",
  },
});

export const OPTIONS = handlers.OPTIONS;
export const POST = handlers.POST;
