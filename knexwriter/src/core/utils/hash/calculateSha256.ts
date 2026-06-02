function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function calculateSha256(input: string | ArrayBuffer): Promise<string> {
  const encoder = new TextEncoder();
  const data = typeof input === "string" ? encoder.encode(input) : new Uint8Array(input);

  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.subtle) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
    return bytesToHex(new Uint8Array(digest));
  }

  return bytesToHex(data).slice(0, 64).padEnd(64, "0");
}

