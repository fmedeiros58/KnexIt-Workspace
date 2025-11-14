// lib/leticia/memory.ts

export type Msg = {
  role: "user" | "assistant";
  content: string;
  ts?: number; // timestamp opcional
};

export type Turn = Msg;

// armazenamento em memória (reinicia a cada deploy/restart)
const STORE = new Map<string, Msg[]>();

/** ----- API básica ----- */
export async function getTurns(sessionId: string): Promise<Msg[]> {
  return STORE.get(sessionId) ?? [];
}

export async function pushTurn(sessionId: string, turn: Msg): Promise<void> {
  const list = STORE.get(sessionId) ?? [];
  list.push({ ts: Date.now(), ...turn });
  STORE.set(sessionId, list);
}

/** ----- Aliases esperados por engine.ts ----- */
// Agora aceita um segundo argumento opcional `limit`
export async function loadThread(sessionId: string, limit?: number): Promise<Msg[]> {
  const list = STORE.get(sessionId) ?? [];
  if (typeof limit === "number" && limit > 0) {
    return list.slice(-limit);
  }
  return list;
}

export const append = pushTurn;

/** utilitário opcional */
export async function clearTurns(sessionId: string): Promise<void> {
  STORE.delete(sessionId);
}
