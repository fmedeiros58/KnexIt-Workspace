/** ai-system-anm */
export function applyAntiRoboticRewrite(text: string): string {
  let output = `${text || ""}`;
  output = output.replace(/\bde forma geral,\s*/gi, "");
  output = output.replace(/\bcomo ia,\s*/gi, "");
  output = output.replace(/\bportanto, portanto,\s*/gi, "portanto, ");
  return output.trim();
}
