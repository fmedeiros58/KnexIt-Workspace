export type KnexPdfEngineLogLevel = "debug" | "info" | "warn" | "error";

export type KnexPdfEngineLogger = {
  log: (level: KnexPdfEngineLogLevel, message: string, context?: unknown) => void;
};

export const silentKnexPdfLogger: KnexPdfEngineLogger = {
  log: () => {},
};

export const consoleKnexPdfLogger: KnexPdfEngineLogger = {
  log(level, message, context) {
    if (process.env.NODE_ENV === "production" && level === "debug") return;
    const payload = context === undefined ? [message] : [message, context];
    console[level === "debug" ? "debug" : level](...payload);
  },
};
