export type ResponseLanguageSource = "question" | "explicit_override" | "default";

export type ComposerLanguageDecision = {
  id: string;
  name: string;
  source: ResponseLanguageSource;
  explicitOverride: boolean;
  isTranslationIntent: boolean;
};

type LanguageDefinition = {
  id: string;
  name: string;
  aliases: string[];
  stopwords: string[];
};

const LANGUAGE_DEFINITIONS: LanguageDefinition[] = [
  {
    id: "pt-BR",
    name: "portugues brasileiro",
    aliases: ["pt", "pt-br", "portugues", "portuguese", "brasil", "brazilian portuguese"],
    stopwords: ["de", "do", "da", "dos", "das", "para", "como", "que", "uma", "um", "resposta", "analise", "texto", "obra"],
  },
  {
    id: "en-US",
    name: "ingles",
    aliases: ["en", "en-us", "english", "ingles", "american english"],
    stopwords: ["the", "and", "with", "what", "which", "that", "this", "answer", "analysis", "text", "review"],
  },
  {
    id: "es-ES",
    name: "espanhol",
    aliases: ["es", "es-es", "spanish", "espanol", "español", "castellano"],
    stopwords: ["de", "del", "la", "el", "para", "como", "que", "una", "un", "respuesta", "analisis", "texto"],
  },
  {
    id: "fr-FR",
    name: "frances",
    aliases: ["fr", "fr-fr", "french", "francais", "français"],
    stopwords: ["de", "du", "la", "le", "pour", "comme", "que", "une", "un", "reponse", "analyse", "texte"],
  },
  {
    id: "de-DE",
    name: "alemao",
    aliases: ["de", "de-de", "german", "deutsch", "alemao", "aleman"],
    stopwords: ["der", "die", "das", "und", "mit", "fur", "wie", "eine", "ein", "antwort", "analyse", "text"],
  },
  {
    id: "it-IT",
    name: "italiano",
    aliases: ["it", "it-it", "italian", "italiano"],
    stopwords: ["di", "del", "della", "il", "la", "per", "come", "che", "una", "un", "risposta", "analisi", "testo"],
  },
  {
    id: "nl-NL",
    name: "holandes",
    aliases: ["nl", "nl-nl", "dutch", "nederlands", "holandes"],
    stopwords: ["de", "het", "een", "en", "met", "voor", "hoe", "antwoord", "analyse", "tekst"],
  },
  {
    id: "pl-PL",
    name: "polones",
    aliases: ["pl", "pl-pl", "polish", "polski", "polones"],
    stopwords: ["i", "w", "na", "do", "jak", "to", "odpowiedz", "analiza", "tekst"],
  },
  {
    id: "tr-TR",
    name: "turco",
    aliases: ["tr", "tr-tr", "turkish", "turkce", "türkçe", "turco"],
    stopwords: ["ve", "bir", "icin", "ile", "nasil", "cevap", "analiz", "metin"],
  },
  {
    id: "ru-RU",
    name: "russo",
    aliases: ["ru", "ru-ru", "russian", "russkiy", "русский", "russo"],
    stopwords: ["и", "в", "на", "как", "это", "ответ", "анализ", "текст"],
  },
  {
    id: "uk-UA",
    name: "ucraniano",
    aliases: ["uk", "uk-ua", "ukrainian", "українська", "ucraniano"],
    stopwords: ["і", "в", "на", "як", "це", "відповідь", "аналіз", "текст"],
  },
  {
    id: "ar-SA",
    name: "arabe",
    aliases: ["ar", "ar-sa", "arabic", "العربية", "arabe"],
    stopwords: ["من", "في", "على", "كيف", "هذا", "الرد", "تحليل", "نص"],
  },
  {
    id: "he-IL",
    name: "hebraico",
    aliases: ["he", "he-il", "hebrew", "עברית", "hebraico"],
    stopwords: ["של", "עם", "על", "איך", "זה", "תשובה", "ניתוח", "טקסט"],
  },
  {
    id: "hi-IN",
    name: "hindi",
    aliases: ["hi", "hi-in", "hindi", "हिन्दी", "हिंदी"],
    stopwords: ["और", "का", "के", "में", "पर", "कैसे", "उत्तर", "विश्लेषण", "पाठ"],
  },
  {
    id: "bn-BD",
    name: "bengali",
    aliases: ["bn", "bn-bd", "bengali", "bangla", "বাংলা"],
    stopwords: ["এবং", "এর", "এই", "কিভাবে", "উত্তর", "বিশ্লেষণ", "পাঠ্য"],
  },
  {
    id: "ur-PK",
    name: "urdu",
    aliases: ["ur", "ur-pk", "urdu", "اردو"],
    stopwords: ["اور", "میں", "پر", "کیسے", "جواب", "تجزیہ", "متن"],
  },
  {
    id: "zh-CN",
    name: "chines simplificado",
    aliases: ["zh", "zh-cn", "chinese", "mandarin", "中文", "简体中文"],
    stopwords: ["的", "了", "在", "和", "如何", "回答", "分析", "文本"],
  },
  {
    id: "ja-JP",
    name: "japones",
    aliases: ["ja", "ja-jp", "japanese", "日本語", "japones"],
    stopwords: ["の", "に", "は", "を", "で", "どう", "回答", "分析", "テキスト"],
  },
  {
    id: "ko-KR",
    name: "coreano",
    aliases: ["ko", "ko-kr", "korean", "한국어", "coreano"],
    stopwords: ["의", "에", "를", "은", "는", "어떻게", "응답", "분석", "텍스트"],
  },
  {
    id: "vi-VN",
    name: "vietnamita",
    aliases: ["vi", "vi-vn", "vietnamese", "tiếng việt", "vietnamita"],
    stopwords: ["va", "cua", "la", "trong", "nhu", "tra loi", "phan tich", "van ban"],
  },
  {
    id: "id-ID",
    name: "indonesio",
    aliases: ["id", "id-id", "indonesian", "bahasa indonesia", "indonesio"],
    stopwords: ["dan", "yang", "di", "ke", "untuk", "bagaimana", "jawaban", "analisis", "teks"],
  },
];

const DEFAULT_LANGUAGE_ID = "pt-BR";
const LANGUAGE_ALIAS_LOOKUP = new Map<string, LanguageDefinition>();
for (const definition of LANGUAGE_DEFINITIONS) {
  for (const alias of definition.aliases) {
    LANGUAGE_ALIAS_LOOKUP.set(alias.toLowerCase(), definition);
  }
}

function normalize(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeToken(value: string) {
  return normalize(value).replace(/[^a-z0-9\u0400-\u04FF\u0600-\u06FF\u0590-\u05FF\u0900-\u097F\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]+/g, "");
}

function tokensOf(value: string) {
  return normalize(value)
    .split(/[^a-z0-9\u0400-\u04FF\u0600-\u06FF\u0590-\u05FF\u0900-\u097F\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]+/g)
    .map((token) => token.trim())
    .filter(Boolean);
}

function resolveByAlias(raw: string) {
  const token = normalize(raw);
  if (!token) return null;
  return LANGUAGE_ALIAS_LOOKUP.get(token) || null;
}

function resolveDefaultLanguageDefinition() {
  const rawId = `${process.env.RAG_DEFAULT_RESPONSE_LANGUAGE_ID || ""}`.trim().toLowerCase();
  const byId = LANGUAGE_DEFINITIONS.find((item) => item.id.toLowerCase() === rawId);
  if (byId) return byId;
  const byAlias = resolveByAlias(rawId);
  if (byAlias) return byAlias;
  const rawName = `${process.env.RAG_DEFAULT_RESPONSE_LANGUAGE || ""}`.trim();
  const byName = resolveByAlias(rawName);
  if (byName) return byName;
  return LANGUAGE_DEFINITIONS.find((item) => item.id === DEFAULT_LANGUAGE_ID) || LANGUAGE_DEFINITIONS[0];
}

function detectByScript(prompt: string): LanguageDefinition | null {
  if (/[\u4E00-\u9FFF]/.test(prompt)) return LANGUAGE_ALIAS_LOOKUP.get("zh") || null;
  if (/[\u3040-\u30FF]/.test(prompt)) return LANGUAGE_ALIAS_LOOKUP.get("ja") || null;
  if (/[\uAC00-\uD7AF]/.test(prompt)) return LANGUAGE_ALIAS_LOOKUP.get("ko") || null;
  if (/[\u0600-\u06FF]/.test(prompt)) return LANGUAGE_ALIAS_LOOKUP.get("ar") || null;
  if (/[\u0590-\u05FF]/.test(prompt)) return LANGUAGE_ALIAS_LOOKUP.get("he") || null;
  if (/[\u0900-\u097F]/.test(prompt)) return LANGUAGE_ALIAS_LOOKUP.get("hi") || null;
  if (/[\u0980-\u09FF]/.test(prompt)) return LANGUAGE_ALIAS_LOOKUP.get("bn") || null;
  if (/[\u0400-\u04FF]/.test(prompt)) {
    const lower = prompt.toLowerCase();
    if (/[іїєґ]/.test(lower)) return LANGUAGE_ALIAS_LOOKUP.get("uk") || null;
    return LANGUAGE_ALIAS_LOOKUP.get("ru") || null;
  }
  return null;
}

function detectByStopwords(prompt: string): LanguageDefinition | null {
  const tokens = tokensOf(prompt);
  if (!tokens.length) return null;
  let best: { definition: LanguageDefinition; score: number } | null = null;
  for (const definition of LANGUAGE_DEFINITIONS) {
    if (!definition.stopwords.length) continue;
    let score = 0;
    for (const stopword of definition.stopwords) {
      const token = normalizeToken(stopword);
      if (!token) continue;
      if (tokens.includes(token)) score += 1;
    }
    if (!best || score > best.score) {
      best = { definition, score };
    }
  }
  if (!best || best.score <= 0) return null;
  return best.definition;
}

function resolveExplicitOverride(prompt: string): { language: LanguageDefinition; translation: boolean } | null {
  const normalized = normalize(prompt);
  if (!normalized) return null;

  const overridePattern =
    /\b(responda|responder|escreva|fale|retorne|answer|reply|respond|write)\s+(em|in|no idioma)\s+([a-z\u00C0-\u017F\u0400-\u04FF\u0600-\u06FF\u0590-\u05FF\u0900-\u097F\u0980-\u09FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF\- ]{2,48})\b/;
  const overrideMatch = overridePattern.exec(normalized);
  if (overrideMatch) {
    const candidate = resolveByAlias(overrideMatch[3]);
    if (candidate) return { language: candidate, translation: false };
  }

  const translatePattern =
    /\b(traduzir|traduza|traducao|translate|translation)\s+(para|to)\s+([a-z\u00C0-\u017F\u0400-\u04FF\u0600-\u06FF\u0590-\u05FF\u0900-\u097F\u0980-\u09FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF\- ]{2,48})\b/;
  const translateMatch = translatePattern.exec(normalized);
  if (translateMatch) {
    const candidate = resolveByAlias(translateMatch[3]);
    if (candidate) return { language: candidate, translation: true };
  }

  const compactPatterns = [
    /\b(in english|em ingles)\b/,
    /\b(in portuguese|em portugues)\b/,
    /\b(en espanol|em espanhol)\b/,
    /\b(en francais|em frances)\b/,
    /\b(auf deutsch|em alemao)\b/,
  ];
  for (const pattern of compactPatterns) {
    const match = pattern.exec(normalized);
    if (!match) continue;
    const phrase = match[1];
    if (/english|ingles/.test(phrase)) return { language: LANGUAGE_ALIAS_LOOKUP.get("en") as LanguageDefinition, translation: false };
    if (/portuguese|portugues/.test(phrase)) return { language: LANGUAGE_ALIAS_LOOKUP.get("pt") as LanguageDefinition, translation: false };
    if (/espanol|espanhol/.test(phrase)) return { language: LANGUAGE_ALIAS_LOOKUP.get("es") as LanguageDefinition, translation: false };
    if (/francais|frances/.test(phrase)) return { language: LANGUAGE_ALIAS_LOOKUP.get("fr") as LanguageDefinition, translation: false };
    if (/deutsch|alemao/.test(phrase)) return { language: LANGUAGE_ALIAS_LOOKUP.get("de") as LanguageDefinition, translation: false };
  }

  return null;
}

function toDecision(definition: LanguageDefinition, source: ResponseLanguageSource, explicitOverride: boolean, isTranslationIntent: boolean) {
  return {
    id: definition.id,
    name: definition.name,
    source,
    explicitOverride,
    isTranslationIntent,
  };
}

export function resolveComposerLanguageDecision(prompt: string): ComposerLanguageDecision {
  const explicit = resolveExplicitOverride(prompt);
  if (explicit) {
    return toDecision(explicit.language, "explicit_override", true, explicit.translation);
  }

  const byScript = detectByScript(prompt);
  if (byScript) {
    return toDecision(byScript, "question", false, false);
  }

  const byStopwords = detectByStopwords(prompt);
  if (byStopwords) {
    return toDecision(byStopwords, "question", false, false);
  }

  return toDecision(resolveDefaultLanguageDefinition(), "default", false, false);
}

export function inferLanguageFromText(text: string): { id: string; name: string } | null {
  const byScript = detectByScript(text);
  if (byScript) {
    return { id: byScript.id, name: byScript.name };
  }
  const byStopwords = detectByStopwords(text);
  if (byStopwords) {
    return { id: byStopwords.id, name: byStopwords.name };
  }
  return null;
}

export function resolveLanguageById(value: string): { id: string; name: string } | null {
  const normalized = `${value || ""}`.trim().toLowerCase();
  if (!normalized) return null;
  const byId = LANGUAGE_DEFINITIONS.find((item) => item.id.toLowerCase() === normalized);
  if (byId) return { id: byId.id, name: byId.name };
  const byAlias = resolveByAlias(normalized);
  if (byAlias) return { id: byAlias.id, name: byAlias.name };
  return null;
}
