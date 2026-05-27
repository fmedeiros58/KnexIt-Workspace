export function createId(): string {
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  const rand = Math.random().toString(16).slice(2);
  return `${Date.now().toString(16)}-${rand}`;
}
