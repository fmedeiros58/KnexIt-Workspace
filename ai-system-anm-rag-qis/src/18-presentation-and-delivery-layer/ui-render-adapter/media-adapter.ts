import type { MediaView } from "../presentation-contracts";

export interface MediaAdapterInput {
  text: string;
  sourceUrls?: string[];
  maxItems?: number;
}

export interface MediaAdapterOutput {
  ok: boolean;
  component: string;
  score: number;
  media: MediaView[];
}

function resolveMediaType(url: string): MediaView["type"] {
  const normalized = `${url || ""}`.toLowerCase();
  if (/\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/.test(normalized)) return "image";
  if (/\.(mp3|wav|ogg|m4a)(\?|$)/.test(normalized)) return "audio";
  if (/\.(mp4|webm|mov|mkv)(\?|$)/.test(normalized)) return "video";
  if (/youtube\.com|youtu\.be|vimeo\.com/.test(normalized)) return "video";
  return "file";
}

function collectUrls(text: string): string[] {
  const matches = `${text || ""}`.match(/https?:\/\/[^\s)]+/g);
  if (!matches?.length) return [];
  return matches.map((url) => url.trim());
}

export function mediaAdapter(input: MediaAdapterInput): MediaAdapterOutput {
  const maxItems = Number.isFinite(input.maxItems) ? Math.max(1, Math.trunc(input.maxItems as number)) : 6;
  const urls = [...collectUrls(input.text), ...(input.sourceUrls || [])];
  const media: MediaView[] = [];
  const seen = new Set<string>();

  for (const candidate of urls) {
    const url = `${candidate || ""}`.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const type = resolveMediaType(url);
    if (type === "file") continue;
    media.push({ type, url });
    if (media.length >= maxItems) break;
  }

  return {
    ok: true,
    component: "media-adapter",
    score: media.length ? 0.91 : 0.44,
    media,
  };
}
