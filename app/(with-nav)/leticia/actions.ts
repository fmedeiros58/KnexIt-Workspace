"use server";

import { ask } from "@/lib/leticia/engine";
import { getTurns as loadThread, pushTurn as append } from "@/lib/leticia/memory";

export async function askLeticiaNative(sessionId: string, text: string) {
  // mantém compat com sua UI
  const reply = await ask(sessionId, text);
  return { reply };
}
