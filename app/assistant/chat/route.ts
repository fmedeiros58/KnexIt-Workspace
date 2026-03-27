import { createChatRouteHandlers } from "@/app/api/_shared/chat-route-handler";

export const runtime = "nodejs";

const handlers = createChatRouteHandlers({
  routeLabel: "/assistant/chat",
  requireApiKey: true,
  includeRequestMetaInLog: true,
  includeAnswerCharsInSuccessLog: true,
  includeKnownErrorMessageInLog: false,
  enablePipelineModeOverride: false,
  logEvents: {
    request: "ASSISTANT_CHAT_REQUEST",
    historySanitized: "ASSISTANT_CHAT_HISTORY_SANITIZED",
    streamOpen: "ASSISTANT_CHAT_STREAM_OPEN",
    success: "ASSISTANT_CHAT_SUCCESS",
    knownError: "ASSISTANT_CHAT_ERROR",
    internalError: "ASSISTANT_CHAT_INTERNAL_ERROR",
  },
  codes: {
    messageRequired: "ASSISTANT_MESSAGE_REQUIRED",
    messageTooLong: "ASSISTANT_CHAT_MESSAGE_TOO_LONG",
    streamMissing: "ASSISTANT_STREAM_MISSING",
    internalError: "ASSISTANT_CHAT_INTERNAL_ERROR",
  },
});

export const OPTIONS = handlers.OPTIONS;
export const POST = handlers.POST;
