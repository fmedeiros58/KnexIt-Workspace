/** ai-system-anm */
export function fluidizeSentences(text: string): string {
  return `${text || ""}`
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}
