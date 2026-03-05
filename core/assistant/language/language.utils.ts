import { franc, francAll } from "franc-min";

export type DetectedLanguage = {
  iso3: string;
  tag: string;
  confidence: number;
};

const ISO3_TO_TAG: Record<string, string> = {
  por: "pt-BR",
  eng: "en",
  spa: "es",
  fra: "fr",
  deu: "de",
  ita: "it",
  nld: "nl",
  pol: "pl",
  tur: "tr",
  rus: "ru",
  ukr: "uk",
  ara: "ar",
  heb: "he",
  hin: "hi",
  ben: "bn",
  urd: "ur",
  cmn: "zh-CN",
  zho: "zh-CN",
  jpn: "ja",
  kor: "ko",
  vie: "vi",
  ind: "id",
};

const SHORT_TEXT_MIN_CHARS = 24;
const DOMINANT_MAX_ITEMS = 5;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeText(value: string) {
  return `${value || ""}`.replace(/\s+/g, " ").trim();
}

function splitUsableTexts(values: string[]) {
  return values
    .map((row) => normalizeText(row))
    .filter(Boolean)
    .slice(-DOMINANT_MAX_ITEMS);
}

function resolveIso3Tag(iso3: string) {
  if (!iso3 || iso3 === "und") return "und";
  return ISO3_TO_TAG[iso3] || iso3;
}

function resolvePtFallback() {
  const configuredDefault = `${process.env.RAG_DEFAULT_RESPONSE_LANGUAGE_ID || ""}`.trim().toLowerCase();
  if (!configuredDefault || configuredDefault.startsWith("pt")) {
    return { iso3: "por", tag: "pt-BR", confidence: 0.5 };
  }
  return { iso3: "eng", tag: "en", confidence: 0.45 };
}

function resolveConfidenceFromFrancAll(inputText: string, iso3: string) {
  const ranked = francAll(inputText, { minLength: SHORT_TEXT_MIN_CHARS });
  if (!Array.isArray(ranked) || ranked.length <= 0) return 0.35;
  const first = ranked[0];
  if (!Array.isArray(first) || first[0] !== iso3) return 0.35;
  const topScore = Number(first[1]);
  const secondScore = ranked.length > 1 && Array.isArray(ranked[1]) ? Number(ranked[1][1]) : NaN;
  if (Number.isFinite(topScore) && topScore >= 0 && topScore <= 1) {
    return clamp(topScore, 0.05, 0.99);
  }
  if (Number.isFinite(topScore) && Number.isFinite(secondScore) && topScore > 0 && secondScore > 0) {
    const distanceGap = (secondScore - topScore) / secondScore;
    return clamp(distanceGap, 0.1, 0.95);
  }
  return 0.35;
}

export function detectLanguage(text: string): DetectedLanguage {
  const normalized = normalizeText(text);
  if (!normalized || normalized.length < SHORT_TEXT_MIN_CHARS) {
    const fallback = resolvePtFallback();
    return { iso3: "und", tag: fallback.tag, confidence: 0.25 };
  }

  const iso3 = franc(normalized, { minLength: SHORT_TEXT_MIN_CHARS });
  if (!iso3 || iso3 === "und") {
    const fallback = resolvePtFallback();
    return { iso3: "und", tag: fallback.tag, confidence: 0.3 };
  }

  return {
    iso3,
    tag: resolveIso3Tag(iso3),
    confidence: resolveConfidenceFromFrancAll(normalized, iso3),
  };
}

export function dominantLanguageFromTexts(texts: string[]): DetectedLanguage {
  const usable = splitUsableTexts(texts);
  if (!usable.length) {
    return resolvePtFallback();
  }

  const votes = new Map<string, { count: number; score: number; tag: string }>();
  for (const text of usable) {
    const detected = detectLanguage(text);
    const key = detected.iso3 || "und";
    const current = votes.get(key) || { count: 0, score: 0, tag: detected.tag || resolveIso3Tag(key) };
    votes.set(key, {
      count: current.count + 1,
      score: current.score + detected.confidence,
      tag: current.tag || detected.tag,
    });
  }

  let bestIso3 = "und";
  let bestCount = -1;
  let bestScore = -1;
  let bestTag = "und";
  for (const [iso3, bucket] of votes.entries()) {
    if (bucket.count > bestCount || (bucket.count === bestCount && bucket.score > bestScore)) {
      bestIso3 = iso3;
      bestCount = bucket.count;
      bestScore = bucket.score;
      bestTag = bucket.tag || resolveIso3Tag(iso3);
    }
  }

  const confidence = clamp(bestScore / Math.max(1, usable.length), 0.05, 0.99);
  if (bestIso3 === "und" || confidence < 0.4) {
    return resolvePtFallback();
  }
  return {
    iso3: bestIso3,
    tag: bestTag || resolveIso3Tag(bestIso3),
    confidence,
  };
}

