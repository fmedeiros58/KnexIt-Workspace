/**
 * ANM ARCHITECTURAL SPEC
 * Layer: shared/text-processing
 * Module: mojibake-core
 * Responsibility: Provide the shared low-level mojibake decoding heuristics reused by structure and presentation layers.
 * Primary Inputs: Arbitrary text surfaces.
 * Primary Outputs: Text with likely UTF-8/Latin-1 mojibake decoded when the candidate result is objectively better.
 * Upstream Dependencies: none
 * Downstream Dependencies: structure-engine, presentation-layer
 * Invariants: The helper is conservative and only applies decodes that reduce mojibake score without introducing replacement chars.
 * Failure Modes: Unknown corruption patterns degrade to pass-through text.
 * Audit Events: none
 * Notes: This is intentionally low-level; presentation-specific lexical repairs stay outside this module.
 */
function countAccentChars(value: string): number {
  return (value.match(/[Ã¡Ã©Ã­Ã³ÃºÃ Ã¢Ã£ÃªÃ´ÃµÃ§ÃÃ‰ÃÃ“ÃšÃ€Ã‚ÃƒÃŠÃ”Ã•Ã‡]/g) || []).length;
}

export function mojibakeScore(value: string): number {
  const chunks = value.match(/(?:Ãƒ.|Ã‚.|Ã¢[â‚¬â„¢â€œâ€â€“â€”])/g);
  return chunks ? chunks.length : 0;
}

export function decodeLikelyMojibake(value: string): string {
  if (mojibakeScore(value) === 0) return value;
  try {
    const bytes = Uint8Array.from(Array.from(value).map((char) => char.charCodeAt(0) & 0xff));
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const decodedMojibake = mojibakeScore(decoded);
    const originalMojibake = mojibakeScore(value);
    const decodedAccents = countAccentChars(decoded);
    const originalAccents = countAccentChars(value);
    const decodedHasReplacementChar = decoded.includes("\uFFFD");

    const isBetter =
      decodedMojibake < originalMojibake ||
      (decodedMojibake === originalMojibake && decodedAccents > originalAccents);

    if (isBetter && !decodedHasReplacementChar) return decoded;
    return value;
  } catch {
    return value;
  }
}
