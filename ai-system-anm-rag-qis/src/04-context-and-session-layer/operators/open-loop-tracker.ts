/**
 * @file open-loop-tracker.ts
 * @description Rastreia loops abertos simples a partir de perguntas e promessas de continuidade.
 * @layer 04-context-and-session-layer
 * @purpose Manter pendencias dialogicas basicas entre turnos.
 * @inputs Texto do usuario e loops anteriores.
 * @outputs Lista atualizada de loops abertos.
 * @dependsOn Nenhuma dependencia externa.
 * @usedBy dialogue-state-updater e auditoria.
 * @invariants Loops devem ser curtos e deduplicados.
 * @notes Nao substitui memoria persistente; e um resumo de sessao.
 */
export function trackOpenLoops(text: string, previousLoops: string[] = []): string[] {
  const loops = new Set(previousLoops);
  if (/\?$/.test(text.trim())) loops.add(`question:${text.trim().slice(0, 120)}`);
  if (/\b(depois|em seguida|proximo|pr[oó]ximo|mais tarde)\b/i.test(text)) loops.add("sequencing_follow_up");
  if (/\b(verifique|confirme|audite)\b/i.test(text)) loops.add("verification_pending");
  return [...loops].slice(-12);
}

