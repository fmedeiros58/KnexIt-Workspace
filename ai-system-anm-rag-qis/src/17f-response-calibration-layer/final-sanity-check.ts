/** ai-system-anm */
export function runFinalSanityCheck(text: string): { ok: boolean; text: string } {
  const cleaned = `${text || ""}`.replace(/\u0000/g, "").trim();
  if (!cleaned) return { ok: false, text: "Não consegui montar uma resposta válida neste turno." };
  return { ok: true, text: cleaned };
}
