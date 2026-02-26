export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function px(value: number) {
  return `${Math.max(0, value).toFixed(2)}px`;
}

export function getSafeArrayBuffer(file: File) {
  return file.arrayBuffer();
}

export function makeCacheKey(parts: Array<string | number>) {
  return parts.join("::");
}

export function toHexColor(rgb: [number, number, number]) {
  return `#${rgb.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

