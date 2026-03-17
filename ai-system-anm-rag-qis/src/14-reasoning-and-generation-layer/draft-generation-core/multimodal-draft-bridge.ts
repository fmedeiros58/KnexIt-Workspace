export function applyMultimodalDraftBridge(text: string, mode: "text" | "voice" | "api" = "text"): string {
  if (mode === "voice") return text.replace(/\n\n/g, "\n");
  return text;
}
