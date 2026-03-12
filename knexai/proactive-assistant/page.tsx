"use client";

import { detectLanguage } from "@/core/assistant/language/language.utils";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Camera, MessageSquareText, Mic, MicOff, Sparkles, Volume2, VolumeX } from "lucide-react";

type ChatRole = "user" | "assistant" | "system";
type SupportedLocale = "pt-BR" | "en-US" | "es-ES";

type AssistantMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  source?: "user" | "proactive" | "event";
  locale?: SupportedLocale;
};

type PresencePayload = {
  status?: string;
  someone_in_frame?: boolean;
  identity_confirmed?: boolean;
  awareness_state?: Record<string, unknown>;
  current_identity?: Record<string, unknown> | null;
  visual_context?: Record<string, unknown>;
  recent_scene_events?: Array<Record<string, unknown>>;
  at?: string;
};

type SendOptions = {
  hiddenUser?: boolean;
  source?: "user" | "proactive";
  locale?: SupportedLocale;
};

type SendPromptFn = (rawPrompt: string, options?: SendOptions) => Promise<void>;

type SiriWaveInstance = {
  start: () => void;
  stop: () => void;
  dispose: () => void;
  set: (property: "amplitude" | "speed", value: number) => void;
  setSpeed: (value: number) => void;
  setAmplitude: (value: number) => void;
};

type SpeechRecognitionAlternativeLike = {
  transcript: string;
  confidence?: number;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionResultListLike = {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
};

type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
};

type SpeechRecognitionErrorEventLike = Event & {
  error?: string;
  message?: string;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: ((event: Event) => void) | null;
  onend: ((event: Event) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type BrowserSpeechRecognitionCtor = new () => BrowserSpeechRecognition;

type VoiceStyle = "neutral" | "focused" | "warm" | "dynamic";

type VoiceProfile = {
  rate: number;
  pitch: number;
  volume: number;
  pauseMs: number;
  style: VoiceStyle;
};

const PROACTIVE_COOLDOWN_MS = 45_000;
const PROACTIVE_USER_GRACE_MS = 20_000;
const VOICE_PROFILE_STORAGE_KEY = "knexai.proactive.voice.profile.v1";
const CONVERSATION_KEY_STORAGE_KEY = "knexai.proactive.conversation.v1";
const BACKGROUND_VISION_STORAGE_KEY = "knexai.proactive.background-vision.v1";
const CAMERA_PREVIEW_STORAGE_KEY = "knexai.proactive.camera-preview.v1";
const MAX_ASSISTANT_VOLUME = 1;
const DEFAULT_INPUT_LOCALE: SupportedLocale = "pt-BR";

const DEFAULT_VOICE_PROFILE: VoiceProfile = {
  rate: 1,
  pitch: 1,
  volume: MAX_ASSISTANT_VOLUME,
  pauseMs: 140,
  style: "neutral",
};

const QUICK_ACTION_PROMPTS = {
  greeting:
    "Faca uma saudacao proativa curta para o usuario com base no contexto visual atual. Seja natural e objetivo.",
  support:
    "Faca uma pergunta curta para entender como voce pode ajudar agora, sem ser generico.",
  summary:
    "Resuma em uma frase o estado de presenca e identidade para orientar a conversa proativa.",
} as const;

function makeMessageId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function makeConversationKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `proactive-${crypto.randomUUID()}`;
  }
  return `proactive-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function extractIdentityLabel(payload: PresencePayload) {
  const identity = payload.current_identity;
  if (!identity || typeof identity !== "object") return "visitante";
  const nominalName = typeof identity.nominal_name === "string" ? identity.nominal_name.trim() : "";
  if (nominalName) return nominalName;
  const label = typeof identity.label === "string" ? identity.label.trim() : "";
  if (label) return label;
  return "visitante";
}

function readVisualContext(payload: PresencePayload | null | undefined) {
  if (!payload || !payload.visual_context || typeof payload.visual_context !== "object") return {};
  return payload.visual_context;
}

function readRecentSceneEvents(payload: PresencePayload | null | undefined) {
  if (!payload || !Array.isArray(payload.recent_scene_events)) return [];
  return payload.recent_scene_events.filter((item) => item && typeof item === "object");
}

function readVisualString(payload: PresencePayload | null | undefined, key: string) {
  const visual = readVisualContext(payload);
  const value = visual[key];
  return typeof value === "string" ? value.trim() : "";
}

function readVisualBoolean(payload: PresencePayload | null | undefined, key: string) {
  return Boolean(readVisualContext(payload)[key]);
}

function extractSceneSummary(payload: PresencePayload | null | undefined) {
  return readVisualString(payload, "scene_summary");
}

function extractCurrentInterlocutorLabel(payload: PresencePayload | null | undefined) {
  const visual = readVisualContext(payload);
  const labelCandidates = [
    visual.current_interlocutor_label,
    visual.current_interlocutor_display_name,
    visual.current_interlocutor_entity_id,
  ];
  for (const candidate of labelCandidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return "";
}

function extractRecentSceneHeadline(payload: PresencePayload | null | undefined) {
  const recentEvents = readRecentSceneEvents(payload);
  const topEvent = recentEvents[0];
  if (!topEvent) return "";
  const eventType = typeof topEvent.event_type === "string" ? topEvent.event_type.trim() : "";
  if (!eventType) return "";
  const detail =
    (typeof topEvent.detail === "string" && topEvent.detail.trim()) ||
    (typeof topEvent.summary === "string" && topEvent.summary.trim()) ||
    (typeof topEvent.label === "string" && topEvent.label.trim()) ||
    "";
  return detail ? `${eventType}: ${detail}` : eventType;
}

function readStoredBoolean(key: string, fallback: boolean) {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (raw === "1" || raw === "true") return true;
  if (raw === "0" || raw === "false") return false;
  return fallback;
}

async function parseErrorMessage(response: Response) {
  const contentType = `${response.headers.get("content-type") || ""}`.toLowerCase();
  if (contentType.includes("application/json")) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: unknown; detail?: unknown; code?: unknown }
      | null;
    const msg =
      (typeof payload?.message === "string" && payload.message.trim()) ||
      (typeof payload?.detail === "string" && payload.detail.trim()) ||
      "";
    if (msg) return msg;
    const code = typeof payload?.code === "string" ? payload.code.trim() : "";
    if (code) return code;
    return "";
  }
  return (await response.text().catch(() => "")).trim();
}

function buildHistoryForApi(messages: AssistantMessage[]) {
  return messages
    .filter((row) => row.role === "user" || row.role === "assistant")
    .map((row) => ({
      role: row.role as "user" | "assistant",
      content: row.content,
    }))
    .slice(-16);
}

function normalizeMicrophoneError(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") return "Permissao do microfone negada.";
    if (error.name === "NotFoundError") return "Nenhum microfone encontrado.";
    if (error.name === "NotReadableError") return "Microfone em uso por outro aplicativo.";
    if (error.name === "SecurityError") return "Microfone bloqueado por politica de seguranca.";
    return error.message || "Falha ao ativar microfone.";
  }
  if (error instanceof Error) return error.message || "Falha ao ativar microfone.";
  return "Falha ao ativar microfone.";
}

function normalizeAssistantVoiceError(error: unknown) {
  if (error instanceof DOMException) return error.message || "Falha na sintese de voz.";
  if (error instanceof Error) return error.message || "Falha na sintese de voz.";
  return "Falha na sintese de voz.";
}

function normalizeLocaleTag(value: string | null | undefined): SupportedLocale {
  const normalized = `${value || ""}`.trim().toLowerCase();
  if (normalized.startsWith("en")) return "en-US";
  if (normalized.startsWith("es")) return "es-ES";
  return "pt-BR";
}

function resolveBrowserLocale(): SupportedLocale {
  if (typeof navigator === "undefined") return DEFAULT_INPUT_LOCALE;
  const candidates = Array.isArray(navigator.languages) && navigator.languages.length ? navigator.languages : [navigator.language];
  for (const candidate of candidates) {
    const normalized = `${candidate || ""}`.trim().toLowerCase();
    if (normalized.startsWith("pt") || normalized.startsWith("en") || normalized.startsWith("es")) {
      return normalizeLocaleTag(normalized);
    }
  }
  return DEFAULT_INPUT_LOCALE;
}

function detectShortTextLocale(text: string, fallback: SupportedLocale) {
  const raw = `${text || ""}`.trim();
  if (!raw) return fallback;
  if (/[ãõç]/i.test(raw)) return "pt-BR";
  if (/[ñ¿¡]/i.test(raw)) return "es-ES";

  const normalized = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return fallback;

  const tokens = new Set(normalized.split(" ").filter(Boolean));
  const score = (terms: string[]) => terms.reduce((acc, term) => acc + (tokens.has(term) ? 1 : 0), 0);

  const ptScore = score(["voce", "ola", "obrigado", "preciso", "ajuda", "agora", "como", "quero", "resposta", "fale"]);
  const enScore = score(["hello", "please", "thanks", "need", "help", "what", "how", "answer", "speak", "today"]);
  const esScore = score(["hola", "gracias", "necesito", "ayuda", "ahora", "como", "quiero", "respuesta", "habla", "por"]);

  if (ptScore > enScore && ptScore > esScore) return "pt-BR";
  if (enScore > ptScore && enScore > esScore) return "en-US";
  if (esScore > ptScore && esScore > enScore) return "es-ES";
  return fallback;
}

function detectConversationLocale(text: string, fallback: SupportedLocale = DEFAULT_INPUT_LOCALE) {
  const normalized = `${text || ""}`.replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;

  const detected = detectLanguage(normalized);
  if (detected.iso3 !== "und" && detected.confidence >= 0.45) {
    return normalizeLocaleTag(detected.tag);
  }
  return detectShortTextLocale(normalized, fallback);
}

function resolveSpeechRecognitionCtor(): BrowserSpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as Window & {
    SpeechRecognition?: BrowserSpeechRecognitionCtor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionCtor;
  };
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null;
}

function normalizeSpeechRecognitionError(error: string | null | undefined) {
  const code = `${error || ""}`.trim().toLowerCase();
  if (!code) return "Falha no reconhecimento de voz.";
  if (code === "not-allowed" || code === "service-not-allowed") return "Permissao de voz negada pelo navegador.";
  if (code === "audio-capture") return "Captura de voz indisponivel no dispositivo.";
  if (code === "network") return "Falha de rede no reconhecimento de voz.";
  if (code === "language-not-supported") return "Idioma de voz nao suportado neste navegador.";
  if (code === "no-speech") return "";
  if (code === "aborted") return "";
  return `Falha no reconhecimento de voz (${code}).`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(value: number) {
  const clamped = clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function normalizeVoiceProfile(value: Partial<VoiceProfile> | null | undefined): VoiceProfile {
  return {
    rate: clamp(Number(value?.rate ?? DEFAULT_VOICE_PROFILE.rate) || DEFAULT_VOICE_PROFILE.rate, 0.75, 1.35),
    pitch: clamp(Number(value?.pitch ?? DEFAULT_VOICE_PROFILE.pitch) || DEFAULT_VOICE_PROFILE.pitch, 0.7, 1.35),
    volume: MAX_ASSISTANT_VOLUME,
    pauseMs: Math.round(clamp(Number(value?.pauseMs ?? DEFAULT_VOICE_PROFILE.pauseMs) || DEFAULT_VOICE_PROFILE.pauseMs, 0, 700)),
    style:
      value?.style === "focused" || value?.style === "warm" || value?.style === "dynamic" || value?.style === "neutral"
        ? value.style
        : DEFAULT_VOICE_PROFILE.style,
  };
}

function speechStyleModifiers(style: VoiceStyle) {
  if (style === "focused") return { rateMul: 0.95, pitchMul: 0.92 };
  if (style === "warm") return { rateMul: 0.98, pitchMul: 1.08 };
  if (style === "dynamic") return { rateMul: 1.08, pitchMul: 1.02 };
  return { rateMul: 1, pitchMul: 1 };
}

function applySpeechStyle(text: string, style: VoiceStyle) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  if (style === "focused") {
    return clean.replace(/\.\s+/g, ". ").replace(/,\s+/g, ", ");
  }
  if (style === "warm") {
    return clean.replace(/!/g, ".").replace(/\?/g, "? ");
  }
  if (style === "dynamic") {
    return clean.replace(/\.\s+/g, "! ");
  }
  return clean;
}

export default function ProactiveAssistantPage() {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "sending">("idle");
  const [error, setError] = useState("");
  const [conversationLocale, setConversationLocale] = useState<SupportedLocale>(DEFAULT_INPUT_LOCALE);
  const [streamStatus, setStreamStatus] = useState("Conectando...");
  const [proactiveEnabled, setProactiveEnabled] = useState(true);
  const [backgroundVisionEnabled, setBackgroundVisionEnabled] = useState(true);
  const [showCameraPane, setShowCameraPane] = useState(true);
  const [presenceState, setPresenceState] = useState<PresencePayload | null>(null);
  const [sceneState, setSceneState] = useState<PresencePayload | null>(null);
  const [scenePulseOn, setScenePulseOn] = useState(false);
  const [microphoneState, setMicrophoneState] = useState<"off" | "starting" | "on" | "error">("off");
  const [microphoneError, setMicrophoneError] = useState("");
  const [microphoneTranscript, setMicrophoneTranscript] = useState("");
  const [assistantVoiceEnabled, setAssistantVoiceEnabled] = useState(false);
  const [assistantVoiceError, setAssistantVoiceError] = useState("");
  const [assistantSpeaking, setAssistantSpeaking] = useState(false);
  const [voiceProfile, setVoiceProfile] = useState<VoiceProfile>(DEFAULT_VOICE_PROFILE);
  const [composerFocused, setComposerFocused] = useState(false);
  const [inactiveComposerBlinkOn, setInactiveComposerBlinkOn] = useState(true);
  const [stageLoadingDotIndex, setStageLoadingDotIndex] = useState(0);

  const messagesRef = useRef(messages);
  const statusRef = useRef(status);
  const conversationLocaleRef = useRef<SupportedLocale>(conversationLocale);
  const assistantVoiceEnabledRef = useRef(assistantVoiceEnabled);
  const voiceProfileRef = useRef<VoiceProfile>(voiceProfile);
  const conversationKeyRef = useRef("");
  const lastProactiveAtRef = useRef(0);
  const lastUserInteractionAtRef = useRef(0);
  const commandInputRef = useRef<HTMLInputElement | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const speechRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const speechRestartTimeoutRef = useRef<number | null>(null);
  const speechCommitTimeoutRef = useRef<number | null>(null);
  const scenePulseTimeoutRef = useRef<number | null>(null);
  const speechBufferedTranscriptRef = useRef("");
  const sendPromptRef = useRef<SendPromptFn | null>(null);
  const microphoneManuallyStoppedRef = useRef(false);
  const voiceWaveHostRef = useRef<HTMLDivElement | null>(null);
  const voiceWaveRef = useRef<SiriWaveInstance | null>(null);
  const voiceWavePulseIntervalRef = useRef<number | null>(null);
  const assistantVoiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const assistantVoiceAudioObjectUrlRef = useRef("");
  const assistantVoiceFetchAbortRef = useRef<AbortController | null>(null);
  const cameraStageRef = useRef<HTMLDivElement | null>(null);
  const stageTextViewportRef = useRef<HTMLDivElement | null>(null);
  const stageTextRef = useRef<HTMLParagraphElement | null>(null);
  const [cameraStageSize, setCameraStageSize] = useState({ width: 0, height: 0 });
  const [stageTextLiftPx, setStageTextLiftPx] = useState(0);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    conversationLocaleRef.current = conversationLocale;
  }, [conversationLocale]);

  useEffect(() => {
    assistantVoiceEnabledRef.current = assistantVoiceEnabled;
  }, [assistantVoiceEnabled]);

  useEffect(() => {
    voiceProfileRef.current = voiceProfile;
  }, [voiceProfile]);

  useEffect(() => {
    setConversationLocale(resolveBrowserLocale());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(CONVERSATION_KEY_STORAGE_KEY)?.trim() || "";
    const next = stored || makeConversationKey();
    conversationKeyRef.current = next;
    window.localStorage.setItem(CONVERSATION_KEY_STORAGE_KEY, next);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setBackgroundVisionEnabled(readStoredBoolean(BACKGROUND_VISION_STORAGE_KEY, true));
    setShowCameraPane(readStoredBoolean(CAMERA_PREVIEW_STORAGE_KEY, true));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(VOICE_PROFILE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<VoiceProfile>;
      setVoiceProfile(normalizeVoiceProfile(parsed));
    } catch {
      // Ignore storage parsing errors.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(VOICE_PROFILE_STORAGE_KEY, JSON.stringify(voiceProfile));
    } catch {
      // Ignore storage write errors.
    }
  }, [voiceProfile]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(BACKGROUND_VISION_STORAGE_KEY, backgroundVisionEnabled ? "1" : "0");
    } catch {
      // Ignore storage write errors.
    }
  }, [backgroundVisionEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(CAMERA_PREVIEW_STORAGE_KEY, showCameraPane ? "1" : "0");
    } catch {
      // Ignore storage write errors.
    }
  }, [showCameraPane]);

  const forceComposerFocus = useCallback(() => {
    const inputEl = commandInputRef.current;
    if (!inputEl) return;
    if (document.activeElement !== inputEl) {
      inputEl.focus({ preventScroll: true });
    }
    const cursorPos = inputEl.value.length;
    try {
      inputEl.setSelectionRange(cursorPos, cursorPos);
    } catch {
      // Ignore selection errors for unsupported input states.
    }
  }, []);

  useEffect(() => {
    forceComposerFocus();
  }, [forceComposerFocus]);

  useEffect(() => {
    if (backgroundVisionEnabled) return;
    setShowCameraPane(false);
    setPresenceState(null);
    setSceneState(null);
    setStreamStatus("Olhos pausados");
  }, [backgroundVisionEnabled]);

  useEffect(
    () => () => {
      if (scenePulseTimeoutRef.current !== null) {
        window.clearTimeout(scenePulseTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!showCameraPane) {
      setCameraStageSize({ width: 0, height: 0 });
      return;
    }
    const stageEl = cameraStageRef.current;
    if (!stageEl) return;

    const updateSize = () => {
      const nextWidth = Math.max(0, Math.floor(stageEl.clientWidth));
      const nextHeight = Math.max(0, Math.floor(stageEl.clientHeight));
      setCameraStageSize((current) =>
        current.width === nextWidth && current.height === nextHeight
          ? current
          : { width: nextWidth, height: nextHeight },
      );
    };

    updateSize();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateSize) : null;
    observer?.observe(stageEl);
    window.addEventListener("resize", updateSize);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, [showCameraPane]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setInactiveComposerBlinkOn((current) => !current);
    }, 520);
    return () => window.clearInterval(timer);
  }, []);

  const pushSystemMessage = useCallback((content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: makeMessageId(),
        role: "system",
        source: "event",
        content,
        createdAt: Date.now(),
      },
    ]);
  }, []);

  const upsertAssistantMessage = useCallback((assistantId: string, nextContent: string) => {
    setMessages((prev) => prev.map((row) => (row.id === assistantId ? { ...row, content: nextContent } : row)));
  }, []);

  const clearSpeechRestartTimeout = useCallback(() => {
    if (speechRestartTimeoutRef.current !== null) {
      window.clearTimeout(speechRestartTimeoutRef.current);
      speechRestartTimeoutRef.current = null;
    }
  }, []);

  const flashScenePulse = useCallback(() => {
    if (scenePulseTimeoutRef.current !== null) {
      window.clearTimeout(scenePulseTimeoutRef.current);
    }
    setScenePulseOn(true);
    scenePulseTimeoutRef.current = window.setTimeout(() => {
      setScenePulseOn(false);
      scenePulseTimeoutRef.current = null;
    }, 900);
  }, []);

  const toggleBackgroundVision = useCallback(() => {
    setBackgroundVisionEnabled((current) => !current);
  }, []);

  const clearSpeechCommitTimeout = useCallback(() => {
    if (speechCommitTimeoutRef.current !== null) {
      window.clearTimeout(speechCommitTimeoutRef.current);
      speechCommitTimeoutRef.current = null;
    }
  }, []);

  const stopSpeechRecognition = useCallback(
    (mode: "stop" | "abort" = "abort") => {
      clearSpeechRestartTimeout();
      const recognition = speechRecognitionRef.current;
      speechRecognitionRef.current = null;
      if (!recognition) return;
      recognition.onstart = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.onresult = null;
      try {
        if (mode === "stop") {
          recognition.stop();
        } else {
          recognition.abort();
        }
      } catch {
        // Ignore repeated stop/abort attempts.
      }
    },
    [clearSpeechRestartTimeout],
  );

  const commitMicrophoneTranscriptRef = useRef<(() => void) | null>(null);
  const scheduleMicrophoneTranscriptCommit = useCallback(
    (delayMs = 900) => {
      clearSpeechCommitTimeout();
      speechCommitTimeoutRef.current = window.setTimeout(() => {
        speechCommitTimeoutRef.current = null;
        commitMicrophoneTranscriptRef.current?.();
      }, delayMs);
    },
    [clearSpeechCommitTimeout],
  );

  const commitMicrophoneTranscript = useCallback(() => {
    clearSpeechCommitTimeout();
    const transcript = (speechBufferedTranscriptRef.current || microphoneTranscript).replace(/\s+/g, " ").trim();
    if (!transcript) {
      setMicrophoneTranscript("");
      return;
    }
    if (statusRef.current === "sending" || !sendPromptRef.current) {
      scheduleMicrophoneTranscriptCommit(680);
      return;
    }
    const nextLocale = detectConversationLocale(transcript, conversationLocaleRef.current);
    speechBufferedTranscriptRef.current = "";
    setMicrophoneTranscript("");
    setConversationLocale(nextLocale);
    void sendPromptRef.current(transcript, { source: "user", locale: nextLocale });
  }, [clearSpeechCommitTimeout, microphoneTranscript, scheduleMicrophoneTranscriptCommit]);

  useEffect(() => {
    commitMicrophoneTranscriptRef.current = commitMicrophoneTranscript;
  }, [commitMicrophoneTranscript]);

  const startSpeechRecognitionRef = useRef<((locale: SupportedLocale) => void) | null>(null);
  const startSpeechRecognition = useCallback(
    (locale: SupportedLocale) => {
      const RecognitionCtor = resolveSpeechRecognitionCtor();
      if (!RecognitionCtor) {
        const detail = "Reconhecimento de voz indisponivel neste navegador.";
        setMicrophoneError(detail);
        setMicrophoneState("error");
        return;
      }

      stopSpeechRecognition("abort");

      const recognition = new RecognitionCtor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.lang = locale;

      recognition.onresult = (event) => {
        let bufferedTranscript = speechBufferedTranscriptRef.current;
        let interimTranscript = "";
        let receivedFinalResult = false;

        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const transcript = `${result?.[0]?.transcript || ""}`.replace(/\s+/g, " ").trim();
          if (!transcript) continue;
          if (result.isFinal) {
            bufferedTranscript = `${bufferedTranscript} ${transcript}`.replace(/\s+/g, " ").trim();
            receivedFinalResult = true;
          } else {
            interimTranscript = `${interimTranscript} ${transcript}`.replace(/\s+/g, " ").trim();
          }
        }

        speechBufferedTranscriptRef.current = bufferedTranscript;
        setMicrophoneTranscript([bufferedTranscript, interimTranscript].filter(Boolean).join(" ").trim());

        if (receivedFinalResult && bufferedTranscript) {
          scheduleMicrophoneTranscriptCommit(1_050);
        }
      };

      recognition.onerror = (event) => {
        const detail = normalizeSpeechRecognitionError(event.error);
        if (!detail) return;
        setMicrophoneError(detail);
        setMicrophoneState("error");
        pushSystemMessage(detail);
      };

      recognition.onend = () => {
        speechRecognitionRef.current = null;
        if (microphoneManuallyStoppedRef.current || !microphoneStreamRef.current) return;
        clearSpeechRestartTimeout();
        speechRestartTimeoutRef.current = window.setTimeout(() => {
          speechRestartTimeoutRef.current = null;
          startSpeechRecognitionRef.current?.(conversationLocaleRef.current);
        }, 280);
      };

      speechRecognitionRef.current = recognition;
      recognition.start();
    },
    [clearSpeechRestartTimeout, pushSystemMessage, scheduleMicrophoneTranscriptCommit, stopSpeechRecognition],
  );

  useEffect(() => {
    startSpeechRecognitionRef.current = startSpeechRecognition;
  }, [startSpeechRecognition]);

  const disableMicrophone = useCallback(
    (options?: { silent?: boolean; flushTranscript?: boolean }) => {
      microphoneManuallyStoppedRef.current = true;
      clearSpeechRestartTimeout();
      if (options?.flushTranscript !== false) {
        commitMicrophoneTranscriptRef.current?.();
      } else {
        clearSpeechCommitTimeout();
        speechBufferedTranscriptRef.current = "";
        setMicrophoneTranscript("");
      }
      stopSpeechRecognition("stop");
      const stream = microphoneStreamRef.current;
      microphoneStreamRef.current = null;
      if (stream) {
        for (const track of stream.getTracks()) {
          track.onended = null;
          track.stop();
        }
      }
      setMicrophoneState("off");
      setMicrophoneError("");
      if (!options?.silent) {
        pushSystemMessage("Microfone desativado.");
      }
    },
    [clearSpeechCommitTimeout, clearSpeechRestartTimeout, pushSystemMessage, stopSpeechRecognition],
  );

  const enableMicrophone = useCallback(async () => {
    if (microphoneState === "starting" || microphoneState === "on") return;
    if (!navigator?.mediaDevices?.getUserMedia) {
      const detail = "Microfone indisponivel neste navegador.";
      setMicrophoneError(detail);
      setMicrophoneState("error");
      pushSystemMessage(detail);
      return;
    }
    if (!resolveSpeechRecognitionCtor()) {
      const detail = "Reconhecimento de voz indisponivel neste navegador.";
      setMicrophoneError(detail);
      setMicrophoneState("error");
      pushSystemMessage(detail);
      return;
    }

    setMicrophoneError("");
    setMicrophoneState("starting");
    try {
      microphoneManuallyStoppedRef.current = false;
      speechBufferedTranscriptRef.current = "";
      setMicrophoneTranscript("");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      const audioTracks = stream.getAudioTracks();
      if (!audioTracks.length) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        throw new Error("Nenhuma trilha de audio retornada.");
      }
      for (const track of audioTracks) {
        track.enabled = true;
        track.onended = () => {
          if (microphoneStreamRef.current !== stream) return;
          microphoneStreamRef.current = null;
          disableMicrophone({ silent: true, flushTranscript: false });
          pushSystemMessage("Microfone desativado pelo sistema.");
        };
      }
      microphoneStreamRef.current = stream;
      startSpeechRecognition(conversationLocaleRef.current);
      setMicrophoneState("on");
      setMicrophoneError("");
      pushSystemMessage(`Microfone ativado com transcricao direta em ${conversationLocaleRef.current}.`);
    } catch (err) {
      const detail = normalizeMicrophoneError(err);
      setMicrophoneState("error");
      setMicrophoneError(detail);
      pushSystemMessage(detail);
    }
  }, [disableMicrophone, microphoneState, pushSystemMessage, startSpeechRecognition]);

  const toggleMicrophone = useCallback(async () => {
    if (microphoneState === "starting") return;
    if (microphoneState === "on") {
      disableMicrophone();
      return;
    }
    await enableMicrophone();
  }, [disableMicrophone, enableMicrophone, microphoneState]);

  useEffect(
    () => () => {
      disableMicrophone({ silent: true, flushTranscript: false });
    },
    [disableMicrophone],
  );

  useEffect(() => {
    if (microphoneState !== "on") return;
    const recognition = speechRecognitionRef.current;
    if (!recognition) return;
    if (normalizeLocaleTag(recognition.lang) === conversationLocale) return;
    startSpeechRecognition(conversationLocale);
  }, [conversationLocale, microphoneState, startSpeechRecognition]);

  const setVoiceWaveBaseLevel = useCallback((amplitude: number, speed: number) => {
    const wave = voiceWaveRef.current;
    if (!wave) return;
    wave.setAmplitude(amplitude);
    wave.setSpeed(speed);
  }, []);

  const stopVoiceWavePulse = useCallback(() => {
    if (voiceWavePulseIntervalRef.current !== null) {
      window.clearInterval(voiceWavePulseIntervalRef.current);
      voiceWavePulseIntervalRef.current = null;
    }
    setAssistantSpeaking(false);
    setVoiceWaveBaseLevel(0.35, 0.07);
  }, [setVoiceWaveBaseLevel]);

  const startVoiceWavePulse = useCallback(() => {
    stopVoiceWavePulse();
    setAssistantSpeaking(true);
    setVoiceWaveBaseLevel(0.95, 0.24);
    voiceWavePulseIntervalRef.current = window.setInterval(() => {
      setVoiceWaveBaseLevel(0.65 + Math.random() * 0.65, 0.16 + Math.random() * 0.22);
    }, 170);
  }, [setVoiceWaveBaseLevel, stopVoiceWavePulse]);

  const clearAssistantVoiceAudio = useCallback(() => {
    if (assistantVoiceFetchAbortRef.current) {
      assistantVoiceFetchAbortRef.current.abort();
      assistantVoiceFetchAbortRef.current = null;
    }
    const audio = assistantVoiceAudioRef.current;
    if (audio) {
      audio.onplay = null;
      audio.onended = null;
      audio.onerror = null;
      try {
        audio.pause();
      } catch {
        // Ignore pause failures for already-finished audio.
      }
      audio.removeAttribute("src");
      assistantVoiceAudioRef.current = null;
    }
    const objectUrl = assistantVoiceAudioObjectUrlRef.current;
    if (objectUrl && typeof URL !== "undefined") {
      URL.revokeObjectURL(objectUrl);
    }
    assistantVoiceAudioObjectUrlRef.current = "";
  }, []);

  const stopAssistantVoice = useCallback(() => {
    clearAssistantVoiceAudio();
    stopVoiceWavePulse();
  }, [clearAssistantVoiceAudio, stopVoiceWavePulse]);

  useEffect(() => {
    let disposed = false;
    const host = voiceWaveHostRef.current;

    const mountWave = async () => {
      if (!assistantVoiceEnabled) return;
      if (!host) return;

      const siriWaveModule = await import("siriwave");
      if (disposed || !host) return;

      const SiriWaveCtor = siriWaveModule.default;
      const width = Math.max(560, Math.floor(host.clientWidth || window.innerWidth * 0.86));
      const height = Math.max(240, Math.min(460, Math.floor(width * 0.42)));
      const wave = new SiriWaveCtor({
        container: host,
        style: "ios9",
        color: "#ffffff",
        autostart: true,
        amplitude: 0.35,
        speed: 0.07,
        frequency: 4,
        width,
        height,
      }) as unknown as SiriWaveInstance;

      voiceWaveRef.current = wave;
      setVoiceWaveBaseLevel(0.35, 0.07);
    };

    void mountWave();

    return () => {
      disposed = true;
      stopVoiceWavePulse();
      const wave = voiceWaveRef.current;
      voiceWaveRef.current = null;
      if (wave) {
        wave.stop();
        wave.dispose();
      }
      if (host) {
        host.innerHTML = "";
      }
    };
  }, [assistantVoiceEnabled, setVoiceWaveBaseLevel, stopVoiceWavePulse]);

  const speakAssistantReply = useCallback(
    (rawText: string, locale: SupportedLocale) => {
      const text = rawText.trim();
      if (!text || !assistantVoiceEnabledRef.current) return;
      const profile = voiceProfileRef.current;
      const styledText = applySpeechStyle(text, profile.style);
      if (!styledText) return;

      void (async () => {
        stopAssistantVoice();
        const style = speechStyleModifiers(profile.style);
        const resolvedRate = clamp(profile.rate * style.rateMul, 0.75, 1.35);
        const resolvedPitch = clamp(profile.pitch * style.pitchMul, 0.7, 1.35);
        const controller = new AbortController();
        assistantVoiceFetchAbortRef.current = controller;

        try {
          const response = await fetch("/api/proactive-assistant/voice/synthesize", {
            method: "POST",
            headers: { "content-type": "application/json" },
            cache: "no-store",
            signal: controller.signal,
            body: JSON.stringify({
              text: styledText,
              locale_hint: locale,
              voice_id: "pt-BR-BrendaNeural",
              rate: resolvedRate,
              pitch: resolvedPitch,
              style: profile.style,
            }),
          });

          if (!response.ok) {
            const detail = await parseErrorMessage(response);
            throw new Error(detail || `Falha de sintese no servidor (HTTP ${response.status}).`);
          }

          const contentType = `${response.headers.get("content-type") || ""}`.toLowerCase();
          if (!contentType.includes("audio")) {
            throw new Error("Payload de voz invalido do servidor.");
          }

          const audioBlob = await response.blob();
          if (!audioBlob.size) {
            throw new Error("Audio vazio recebido do servidor.");
          }

          const objectUrl = URL.createObjectURL(audioBlob);
          assistantVoiceAudioObjectUrlRef.current = objectUrl;
          const audio = new Audio(objectUrl);
          audio.volume = MAX_ASSISTANT_VOLUME;
          audio.onplay = () => {
            startVoiceWavePulse();
          };
          audio.onended = () => {
            clearAssistantVoiceAudio();
            stopVoiceWavePulse();
          };
          audio.onerror = () => {
            clearAssistantVoiceAudio();
            stopVoiceWavePulse();
            setAssistantVoiceError("Falha ao reproduzir audio de voz.");
          };
          assistantVoiceAudioRef.current = audio;
          setAssistantVoiceError("");
          await audio.play();
        } catch (voiceError) {
          if (controller.signal.aborted) return;
          clearAssistantVoiceAudio();
          stopVoiceWavePulse();
          setAssistantVoiceError(normalizeAssistantVoiceError(voiceError));
        } finally {
          if (assistantVoiceFetchAbortRef.current === controller) {
            assistantVoiceFetchAbortRef.current = null;
          }
        }
      })();
    },
    [clearAssistantVoiceAudio, startVoiceWavePulse, stopAssistantVoice, stopVoiceWavePulse],
  );

  const disableAssistantVoice = useCallback(
    (options?: { silent?: boolean }) => {
      stopAssistantVoice();
      setAssistantVoiceEnabled(false);
      assistantVoiceEnabledRef.current = false;
      setAssistantVoiceError("");
      setAssistantSpeaking(false);
      setShowCameraPane(false);
      if (!options?.silent) {
        pushSystemMessage("Voz da IA desativada. Resposta em texto no palco.");
      }
    },
    [pushSystemMessage, stopAssistantVoice],
  );

  const enableAssistantVoice = useCallback(
    (options?: { silent?: boolean }) => {
      if (typeof window === "undefined" || typeof Audio === "undefined") {
        const detail = "Audio indisponivel neste navegador.";
        setAssistantVoiceError(detail);
        pushSystemMessage(detail);
        return false;
      }
      setAssistantVoiceError("");
      setAssistantVoiceEnabled(true);
      assistantVoiceEnabledRef.current = true;
      setAssistantSpeaking(false);
      setShowCameraPane(false);
      if (!options?.silent) {
        pushSystemMessage("Voz da IA ativada. Camera substituida por emissor de voz.");
      }
      return true;
    },
    [pushSystemMessage],
  );

  const toggleAssistantVoice = useCallback(() => {
    if (assistantVoiceEnabled) {
      disableAssistantVoice();
      return;
    }
    enableAssistantVoice();
  }, [assistantVoiceEnabled, disableAssistantVoice, enableAssistantVoice]);

  useEffect(
    () => () => {
      stopAssistantVoice();
    },
    [stopAssistantVoice],
  );

  const sendPrompt = useCallback(
    async (rawPrompt: string, options: SendOptions = {}) => {
      const prompt = rawPrompt.trim();
      if (!prompt || statusRef.current === "sending") return;
      setShowCameraPane(false);

      const nextSource = options.source || "user";
      const nextLocale = options.locale || detectConversationLocale(prompt, conversationLocaleRef.current);
      const currentHistory = buildHistoryForApi(messagesRef.current);
      const assistantId = makeMessageId();
      if (nextSource === "user") {
        lastUserInteractionAtRef.current = Date.now();
      }
      setConversationLocale(nextLocale);

      if (options.hiddenUser) {
        setMessages((prev) => [
          ...prev,
          {
            id: makeMessageId(),
            role: "system",
            source: "event",
            content: "Evento proativo autorizado recebido. Gerando resposta em tempo real.",
            createdAt: Date.now(),
          },
          {
            id: assistantId,
            role: "assistant",
            source: nextSource,
            content: "",
            createdAt: Date.now(),
            locale: nextLocale,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: makeMessageId(),
            role: "user",
            source: "user",
            content: prompt,
            createdAt: Date.now(),
            locale: nextLocale,
          },
          {
            id: assistantId,
            role: "assistant",
            source: nextSource,
            content: "",
            createdAt: Date.now(),
            locale: nextLocale,
          },
        ]);
      }

      setStatus("sending");
      setError("");
      try {
        const response = await fetch("/api/proactive-assistant/chat", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          cache: "no-store",
          body: JSON.stringify({
            prompt,
            history: currentHistory,
            conversationKey: conversationKeyRef.current || makeConversationKey(),
            localeHint: nextLocale,
            locale: nextLocale,
          }),
        });
        if (!response.ok) {
          const detail = await parseErrorMessage(response);
          throw new Error(detail || `CHAT_HTTP_${response.status}`);
        }
        if (!response.body) {
          const fallback = (await response.text().catch(() => "")).trim();
          const nextContent = fallback || "Sem conteudo retornado.";
          upsertAssistantMessage(assistantId, nextContent);
          speakAssistantReply(nextContent, nextLocale);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          if (!chunk) continue;
          accumulated += chunk;
          upsertAssistantMessage(assistantId, accumulated);
        }
        const tail = decoder.decode();
        if (tail) {
          accumulated += tail;
          upsertAssistantMessage(assistantId, accumulated);
        }
        if (!accumulated.trim()) {
          upsertAssistantMessage(assistantId, "Resposta vazia recebida.");
        } else {
          speakAssistantReply(accumulated, nextLocale);
        }
      } catch (sendError) {
        const detail = sendError instanceof Error ? sendError.message : "Falha ao gerar resposta.";
        upsertAssistantMessage(assistantId, `Erro: ${detail}`);
        setError(detail);
      } finally {
        setStatus("idle");
      }
    },
    [speakAssistantReply, upsertAssistantMessage],
  );

  useEffect(() => {
    sendPromptRef.current = sendPrompt;
  }, [sendPrompt]);

  const runQuickAction = useCallback(
    (prompt: string) => {
      void sendPrompt(prompt, {
        hiddenUser: true,
        source: "proactive",
        locale: conversationLocaleRef.current,
      });
    },
    [sendPrompt],
  );

  const triggerProactiveReply = useCallback(
    (payload: PresencePayload) => {
      if (!backgroundVisionEnabled) return;
      if (!proactiveEnabled) return;
      if (!payload.someone_in_frame) return;
      if (statusRef.current !== "idle") return;

      const now = Date.now();
      if (now - lastUserInteractionAtRef.current < PROACTIVE_USER_GRACE_MS) return;
      if (now - lastProactiveAtRef.current < PROACTIVE_COOLDOWN_MS) return;
      lastProactiveAtRef.current = now;

      const identityLabel = extractIdentityLabel(payload);
      const sceneSummary = extractSceneSummary(payload);
      const interlocutorLabel = extractCurrentInterlocutorLabel(payload);
      const recentSceneHeadline = extractRecentSceneHeadline(payload);
      const stableInterlocutor = readVisualBoolean(payload, "current_interlocutor_stable");
      const proactivePrompt = [
        "Contexto de streaming em tempo real autorizado:",
        "- Presenca detectada: sim",
        `- Identidade confirmada: ${payload.identity_confirmed ? "sim" : "nao"}`,
        `- Rotulo observado: ${identityLabel}`,
        sceneSummary ? `- Cena atual: ${sceneSummary}` : "",
        interlocutorLabel ? `- Interlocutor atual: ${interlocutorLabel}` : "",
        stableInterlocutor ? "- Interlocutor atual estavel no quadro: sim" : "",
        recentSceneHeadline ? `- Evento recente: ${recentSceneHeadline}` : "",
        "",
        "Gere uma mensagem curta, natural e proativa para abrir conversa com o usuario agora.",
        "Nao mencione regras internas.",
      ]
        .filter(Boolean)
        .join("\n");

      void sendPrompt(proactivePrompt, {
        hiddenUser: true,
        source: "proactive",
        locale: conversationLocaleRef.current,
      });
    },
    [backgroundVisionEnabled, proactiveEnabled, sendPrompt],
  );

  const executeTerminalCommand = useCallback(
    (rawValue: string) => {
      const normalized = rawValue.trim().toLowerCase();
      if (!normalized.startsWith("/")) return false;

      if (normalized === "/help") {
        pushSystemMessage(
          "Comandos: /help | /olhos on|off|toggle | /camera on|off|toggle | /microfone on|off|toggle | /voz on|off|toggle | /proativo on|off|toggle | /saudacao | /apoio | /resumo | /clear",
        );
        return true;
      }

      if (normalized === "/clear") {
        const nextConversationKey = makeConversationKey();
        conversationKeyRef.current = nextConversationKey;
        if (typeof window !== "undefined") {
          window.localStorage.setItem(CONVERSATION_KEY_STORAGE_KEY, nextConversationKey);
        }
        setMessages((prev) =>
          prev.filter((row) => row.role === "assistant").slice(-1).length
            ? [prev.filter((row) => row.role === "assistant").slice(-1)[0]]
            : [
                {
                  id: makeMessageId(),
                  role: "assistant",
                  source: "proactive",
                  content: "Historico limpo. Prompt pronto para novos comandos.",
                  createdAt: Date.now(),
                },
              ],
        );
        return true;
      }

      if (normalized === "/olhos on") {
        setBackgroundVisionEnabled(true);
        pushSystemMessage("Olhos ativos: ON");
        return true;
      }
      if (normalized === "/olhos off") {
        setBackgroundVisionEnabled(false);
        pushSystemMessage("Olhos ativos: OFF");
        return true;
      }
      if (normalized === "/olhos toggle") {
        setBackgroundVisionEnabled((current) => !current);
        pushSystemMessage("Olhos ativos: alternados.");
        return true;
      }

      if (normalized === "/camera on") {
        if (!backgroundVisionEnabled) {
          pushSystemMessage("Ative os olhos da Leticia antes de expor o preview. Use /olhos on.");
          return true;
        }
        if (assistantVoiceEnabled) {
          pushSystemMessage("Preview bloqueado enquanto a Voz IA estiver ativa. Use /voz off para liberar.");
          return true;
        }
        setShowCameraPane(true);
        pushSystemMessage("Preview de camera: ON");
        return true;
      }
      if (normalized === "/camera off") {
        setShowCameraPane(false);
        pushSystemMessage("Preview de camera: OFF");
        return true;
      }
      if (normalized === "/camera toggle") {
        if (!backgroundVisionEnabled) {
          pushSystemMessage("Ative os olhos da Leticia antes de expor o preview. Use /olhos on.");
          return true;
        }
        if (assistantVoiceEnabled) {
          pushSystemMessage("Preview bloqueado enquanto a Voz IA estiver ativa. Use /voz off para liberar.");
          return true;
        }
        setShowCameraPane((current) => !current);
        pushSystemMessage("Preview de camera: alternado.");
        return true;
      }

      if (normalized === "/microfone on") {
        void enableMicrophone();
        return true;
      }
      if (normalized === "/microfone off") {
        disableMicrophone();
        return true;
      }
      if (normalized === "/microfone toggle") {
        void toggleMicrophone();
        return true;
      }

      if (normalized === "/voz on") {
        enableAssistantVoice();
        return true;
      }
      if (normalized === "/voz off") {
        disableAssistantVoice();
        return true;
      }
      if (normalized === "/voz toggle") {
        toggleAssistantVoice();
        return true;
      }

      if (normalized === "/proativo on") {
        setProactiveEnabled(true);
        pushSystemMessage("Proatividade: ON");
        return true;
      }
      if (normalized === "/proativo off") {
        setProactiveEnabled(false);
        pushSystemMessage("Proatividade: OFF");
        return true;
      }
      if (normalized === "/proativo toggle") {
        setProactiveEnabled((current) => !current);
        pushSystemMessage("Proatividade: alternada.");
        return true;
      }

      if (normalized === "/saudacao") {
        runQuickAction(QUICK_ACTION_PROMPTS.greeting);
        return true;
      }
      if (normalized === "/apoio") {
        runQuickAction(QUICK_ACTION_PROMPTS.support);
        return true;
      }
      if (normalized === "/resumo") {
        runQuickAction(QUICK_ACTION_PROMPTS.summary);
        return true;
      }

      pushSystemMessage(`Comando nao reconhecido: ${rawValue}`);
      return true;
    },
    [
      assistantVoiceEnabled,
      backgroundVisionEnabled,
      disableAssistantVoice,
      disableMicrophone,
      enableAssistantVoice,
      enableMicrophone,
      pushSystemMessage,
      runQuickAction,
      toggleAssistantVoice,
      toggleMicrophone,
    ],
  );

  useEffect(() => {
    if (!backgroundVisionEnabled) {
      setStreamStatus("Olhos pausados");
      return;
    }

    const eventSource = new EventSource("/api/proactive-assistant/events");

    const parsePayload = (event: Event) => {
      const messageEvent = event as MessageEvent;
      try {
        return JSON.parse(`${messageEvent.data || "{}"}`) as PresencePayload;
      } catch {
        return null;
      }
    };

    const onReady = () => setStreamStatus("Conectado");
    const onError = () => setStreamStatus("Desconectado");
    const onState = (event: Event) => {
      const payload = parsePayload(event);
      if (!payload) return;
      setPresenceState(payload);
      setSceneState(payload);
    };
    const onPresenceChanged = (event: Event) => {
      const payload = parsePayload(event);
      if (!payload) return;
      setPresenceState(payload);
      setSceneState(payload);
      triggerProactiveReply(payload);
    };
    const onIdentityChanged = (event: Event) => {
      const payload = parsePayload(event);
      if (!payload) return;
      setPresenceState(payload);
      setSceneState(payload);
    };
    const onSceneChanged = (event: Event) => {
      const payload = parsePayload(event);
      if (!payload) return;
      setPresenceState(payload);
      setSceneState(payload);
      flashScenePulse();
    };

    eventSource.addEventListener("ready", onReady);
    eventSource.addEventListener("state", onState);
    eventSource.addEventListener("presence_changed", onPresenceChanged);
    eventSource.addEventListener("identity_changed", onIdentityChanged);
    eventSource.addEventListener("scene_changed", onSceneChanged);
    eventSource.addEventListener("error", onError);

    return () => {
      eventSource.removeEventListener("ready", onReady);
      eventSource.removeEventListener("state", onState);
      eventSource.removeEventListener("presence_changed", onPresenceChanged);
      eventSource.removeEventListener("identity_changed", onIdentityChanged);
      eventSource.removeEventListener("scene_changed", onSceneChanged);
      eventSource.removeEventListener("error", onError);
      eventSource.close();
    };
  }, [backgroundVisionEnabled, flashScenePulse, triggerProactiveReply]);

  const latestAssistantMessage = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === "assistant") return messages[index];
    }
    return null;
  }, [messages]);
  const stageLocale = latestAssistantMessage?.locale || conversationLocale;
  const hasStageAssistantContent = Boolean(latestAssistantMessage?.content?.trim());
  const stageText = useMemo(() => {
    const content = latestAssistantMessage?.content?.trim() || "";
    if (!content) return "";
    return content.toLocaleUpperCase(stageLocale);
  }, [latestAssistantMessage, stageLocale]);
  const stageTextFontSize = useMemo(() => {
    if (!stageText) return "clamp(1.35rem, 2.5vw, 2.7rem)";

    const textLength = stageText.replace(/\s+/g, " ").trim().length;
    const shortTextThreshold = 28;
    const longTextThreshold = 260;
    const progress = smoothstep((textLength - shortTextThreshold) / (longTextThreshold - shortTextThreshold));
    const emphasis = 1 - progress;

    const minRem = 1.35 + 0.55 * emphasis;
    const fluidVw = 2.5 + 1.25 * emphasis;
    const maxRem = 2.7 + 1.35 * emphasis;

    return `clamp(${minRem.toFixed(2)}rem, ${fluidVw.toFixed(2)}vw, ${maxRem.toFixed(2)}rem)`;
  }, [stageText]);
  const showStageLoadingIndicator = status === "sending" && !hasStageAssistantContent;
  const effectivePresenceState = sceneState || presenceState;
  const sceneSummary = useMemo(() => extractSceneSummary(effectivePresenceState), [effectivePresenceState]);
  const sceneHeadline = useMemo(() => extractRecentSceneHeadline(effectivePresenceState), [effectivePresenceState]);
  const sceneInterlocutorLabel = useMemo(
    () => extractCurrentInterlocutorLabel(effectivePresenceState) || extractIdentityLabel(effectivePresenceState || {}),
    [effectivePresenceState],
  );
  const sceneInterlocutorStable = useMemo(
    () => readVisualBoolean(effectivePresenceState, "current_interlocutor_stable"),
    [effectivePresenceState],
  );
  const eyesStatusLabel = backgroundVisionEnabled ? streamStatus : "Olhos pausados";
  const eyesStatusToneClass = backgroundVisionEnabled
    ? scenePulseOn
      ? "text-white"
      : "text-white/78"
    : "text-white/42";
  const showVisionRuntime = backgroundVisionEnabled;

  useEffect(() => {
    if (assistantVoiceEnabled || !stageText) {
      setStageTextLiftPx(0);
      return;
    }

    const computeLift = () => {
      const viewport = stageTextViewportRef.current;
      const textNode = stageTextRef.current;
      if (!viewport || !textNode) return;

      const viewportHeight = Math.max(1, viewport.clientHeight);
      const textHeight = Math.max(1, textNode.scrollHeight);
      const overflow = Math.max(0, textHeight - viewportHeight);
      const nextLift = overflow <= 0 ? 0 : overflow * 0.6;
      setStageTextLiftPx((current) => (Math.abs(current - nextLift) < 1 ? current : nextLift));
    };

    computeLift();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(computeLift) : null;
    if (stageTextViewportRef.current) observer?.observe(stageTextViewportRef.current);
    if (stageTextRef.current) observer?.observe(stageTextRef.current);
    window.addEventListener("resize", computeLift);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", computeLift);
    };
  }, [assistantVoiceEnabled, stageText]);

  useEffect(() => {
    if (!showStageLoadingIndicator) {
      setStageLoadingDotIndex(0);
      return;
    }
    const timer = window.setInterval(() => {
      setStageLoadingDotIndex((current) => (current + 1) % 3);
    }, 240);
    return () => window.clearInterval(timer);
  }, [showStageLoadingIndicator]);

  const cameraTargetAspectRatio = useMemo(() => {
    if (!cameraStageSize.width || !cameraStageSize.height) return 16 / 9;
    const viewportRatio = cameraStageSize.width / cameraStageSize.height;
    if (viewportRatio >= 1.7) return 16 / 9;
    if (viewportRatio >= 1.45) return 3 / 2;
    return 4 / 3;
  }, [cameraStageSize.height, cameraStageSize.width]);
  const cameraFrameSize = useMemo(() => {
    const viewportWidth = cameraStageSize.width;
    const viewportHeight = cameraStageSize.height;
    if (!viewportWidth || !viewportHeight) return { width: 1, height: 1 };

    let frameWidth = viewportWidth;
    let frameHeight = frameWidth / cameraTargetAspectRatio;
    if (frameHeight > viewportHeight) {
      frameHeight = viewportHeight;
      frameWidth = frameHeight * cameraTargetAspectRatio;
    }

    return {
      width: Math.max(1, Math.floor(frameWidth)),
      height: Math.max(1, Math.floor(frameHeight)),
    };
  }, [cameraStageSize.height, cameraStageSize.width, cameraTargetAspectRatio]);

  const submitPrompt = useCallback(() => {
    const value = input.trim();
    if (!value || status === "sending") return;
    setInput("");
    if (executeTerminalCommand(value)) return;
    void sendPrompt(value, { source: "user" });
  }, [executeTerminalCommand, input, sendPrompt, status]);

  const showVoiceStage = assistantVoiceEnabled;
  const showVideoStage = !showVoiceStage && backgroundVisionEnabled && showCameraPane;

  return (
    <main className="h-[100dvh] overflow-hidden bg-black font-mono text-white">
      <div className="flex h-full w-full flex-col overflow-hidden">
        <section
          className={`relative flex-1 overflow-hidden ${showVideoStage ? "bg-black" : "bg-black/95"}`}
          onClick={() => {
            forceComposerFocus();
          }}
        >
          <div className="pointer-events-none absolute left-1 top-2 z-20 flex items-center gap-2 bg-transparent px-2 py-1 text-sm font-semibold uppercase tracking-[0.14em] text-white/90 md:text-base">
            {showVoiceStage ? (
              <>
                <Volume2 size={16} className="text-white/85" />
                Ambiente de Voz
              </>
            ) : showVideoStage ? (
              <>
                <Camera size={16} className="text-white/85" />
                Ambiente de Streaming
              </>
            ) : (
              <>
                <MessageSquareText size={16} className="text-white/85" />
                Ambiente de Conversa
              </>
            )}
          </div>
          <div
            className={`pointer-events-none absolute right-1 top-2 z-20 flex max-w-[min(52vw,32rem)] items-center gap-2 px-2 py-1 text-right text-[11px] font-semibold uppercase tracking-[0.12em] md:text-sm ${eyesStatusToneClass}`}
          >
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full transition-all duration-300 ${
                backgroundVisionEnabled ? (scenePulseOn ? "bg-white shadow-[0_0_18px_rgba(255,255,255,0.85)]" : "bg-white/70") : "bg-white/25"
              }`}
            />
            <span className="truncate">
              {backgroundVisionEnabled ? (showVideoStage ? "Olhos expostos" : "Olhos em segundo plano") : "Olhos pausados"}
              {" | "}
              {eyesStatusLabel}
            </span>
          </div>
          {showVisionRuntime ? (
            <div
              ref={cameraStageRef}
              aria-hidden={!showVideoStage}
              className={
                showVideoStage
                  ? "absolute inset-0 flex items-center justify-center overflow-hidden"
                  : "pointer-events-none absolute -left-[10000px] top-0 h-px w-px overflow-hidden opacity-0"
              }
            >
              <div
                className="overflow-hidden border-0 bg-black outline-none ring-0 shadow-none"
                style={{
                  width: showVideoStage ? `${cameraFrameSize.width}px` : "1px",
                  height: showVideoStage ? `${cameraFrameSize.height}px` : "1px",
                }}
              >
                <iframe
                  title="Streaming de camera para identificacao"
                  src="/knexai/identity-runtime?embedded=1&view=stream"
                  className="block h-full w-full border-0 bg-black outline-none ring-0 shadow-none"
                  allow="camera; microphone; autoplay; clipboard-read; clipboard-write"
                  scrolling="no"
                />
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 bg-black/95" />
          )}
          <div className={`absolute inset-0 ${showVideoStage ? "bg-black/68" : "bg-transparent"}`} />
          <div className="absolute inset-0 z-10">
            {showVoiceStage ? (
              <div className="relative h-full w-full">
                <div className="absolute inset-0 flex items-center justify-center px-2">
                  <div className="w-full max-w-5xl">
                    <div className="mx-auto flex w-full items-center justify-center overflow-hidden">
                      <div ref={voiceWaveHostRef} className="h-[380px] w-full" />
                    </div>
                  </div>
                </div>
                {assistantSpeaking ? (
                  <p className="pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2 text-center text-sm font-semibold uppercase tracking-[0.18em] text-white/80 md:text-base">
                    Emissao de Voz Ativa
                  </p>
                ) : null}
              </div>
            ) : null}
            {!showVoiceStage && stageText ? (
              <div ref={stageTextViewportRef} className="absolute inset-0 overflow-hidden px-6 py-10 text-center">
                <div
                  className="absolute left-1/2 top-1/2 w-full text-center transition-transform duration-200 ease-out"
                  style={{
                    transform: `translate(-50%, calc(-50% - ${stageTextLiftPx}px))`,
                  }}
                >
                  <p
                    ref={stageTextRef}
                    className="mx-auto inline-block max-w-[min(88vw,1200px)] whitespace-pre-wrap break-words text-center font-semibold uppercase leading-[1.12] tracking-[0.08em] text-white"
                    style={{ fontSize: stageTextFontSize }}
                  >
                    {stageText}
                  </p>
                </div>
              </div>
            ) : null}
            {!showVoiceStage && showStageLoadingIndicator ? (
              <div className="absolute inset-0 flex items-center justify-center px-6 py-10 text-center">
                <p
                  aria-label="Gerando resposta"
                  className="select-none text-[clamp(2rem,5vw,4.6rem)] font-semibold leading-none tracking-[0.45em] text-white"
                >
                  {[0, 1, 2].map((dotIndex) => (
                    <span
                      key={dotIndex}
                      className="inline-block transition-opacity duration-150"
                      style={{ opacity: stageLoadingDotIndex === dotIndex ? 1 : 0.14 }}
                    >
                      .
                    </span>
                  ))}
                </p>
              </div>
            ) : null}
          </div>
        </section>

        <footer className="bg-black/95 px-3 py-3 md:px-5 md:py-4">
          {error ? <p className="mb-2 text-sm uppercase tracking-[0.12em] text-rose-400 md:text-base">{error}</p> : null}
          {microphoneError ? <p className="mb-2 text-sm uppercase tracking-[0.12em] text-amber-300 md:text-base">{microphoneError}</p> : null}
          {microphoneState === "on" && microphoneTranscript ? (
            <p className="mb-2 text-sm text-white/72 md:text-base">
              Captacao: {microphoneTranscript}
            </p>
          ) : null}
          {assistantVoiceError ? (
            <p className="mb-2 text-sm uppercase tracking-[0.12em] text-amber-300 md:text-base">{assistantVoiceError}</p>
          ) : null}

          <form
            className="bg-black px-3 py-3"
            onSubmit={(event) => {
              event.preventDefault();
              submitPrompt();
            }}
          >
            <div className="flex items-center gap-2">
              {!composerFocused ? (
                <span
                  aria-hidden
                  className="inline-block h-9 w-3.5 shrink-0 rounded-sm bg-white transition-opacity md:h-10"
                  style={{ opacity: inactiveComposerBlinkOn ? 1 : 0.15 }}
                  title="Composer inativo"
                />
              ) : null}
              <input
                ref={commandInputRef}
                value={input}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setInput(nextValue);
                  if (nextValue.trim()) {
                    setConversationLocale(detectConversationLocale(nextValue, conversationLocaleRef.current));
                  }
                }}
                onFocus={() => setComposerFocused(true)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  submitPrompt();
                }}
                onBlur={() => setComposerFocused(false)}
                placeholder=""
                className="h-10 flex-1 bg-transparent text-[1.05rem] text-white caret-white outline-none placeholder:text-white/35 md:h-12 md:text-[1.45rem]"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </form>

          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/knexai/web"
                className="inline-flex items-center gap-2 bg-black px-3 py-1.5 text-sm font-semibold uppercase tracking-[0.12em] text-white/85 hover:text-white md:text-base"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar
              </Link>
              <button
                type="button"
                onClick={() => setProactiveEnabled((current) => !current)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold uppercase tracking-[0.12em] md:text-base ${
                  proactiveEnabled ? "text-white" : "text-white/55"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {proactiveEnabled ? "Proatividade on" : "Proatividade off"}
              </button>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  void toggleMicrophone();
                }}
                title={
                  microphoneState === "on"
                    ? "Desativar microfone"
                    : microphoneState === "starting"
                      ? "Ativando microfone"
                      : microphoneState === "error"
                        ? "Tentar ativar microfone"
                        : "Ativar microfone"
                }
                className={`inline-flex items-center justify-center gap-2 px-2.5 py-1.5 transition ${
                  microphoneState === "on"
                    ? "text-white"
                    : microphoneState === "starting"
                      ? "text-amber-300"
                      : microphoneState === "error"
                        ? "text-rose-300 hover:text-rose-200"
                        : "text-white/70 hover:text-white"
                }`}
              >
                {microphoneState === "on" ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                <span className="text-sm font-semibold uppercase tracking-[0.12em] md:text-base">
                  {microphoneState === "on"
                    ? "Mic on"
                    : microphoneState === "starting"
                      ? "Mic..."
                      : microphoneState === "error"
                        ? "Mic erro"
                        : "Mic off"}
                </span>
              </button>
              <button
                type="button"
                onClick={toggleBackgroundVision}
                title={backgroundVisionEnabled ? "Desativar olhos em segundo plano" : "Ativar olhos em segundo plano"}
                className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold uppercase tracking-[0.12em] transition md:text-base ${
                  backgroundVisionEnabled
                    ? scenePulseOn
                      ? "text-white"
                      : "text-white"
                    : "text-white/55 hover:text-white"
                }`}
              >
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full transition-all duration-300 ${
                    backgroundVisionEnabled
                      ? scenePulseOn
                        ? "bg-white shadow-[0_0_18px_rgba(255,255,255,0.85)]"
                        : "bg-white/75"
                      : "bg-white/25"
                  }`}
                />
                {backgroundVisionEnabled ? "Olhos on" : "Olhos off"}
              </button>
              <button
                type="button"
                onClick={toggleAssistantVoice}
                title={assistantVoiceEnabled ? "Desativar voz da IA" : "Ativar voz da IA"}
                className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold uppercase tracking-[0.12em] md:text-base ${
                  assistantVoiceEnabled ? "text-white" : "text-white/55 hover:text-white"
                }`}
              >
                {assistantVoiceEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                {assistantVoiceEnabled ? "Voz IA on" : "Voz IA off"}
              </button>
              <button
                type="button"
                onClick={() => setShowCameraPane((current) => !current)}
                disabled={assistantVoiceEnabled || !backgroundVisionEnabled}
                title={
                  !backgroundVisionEnabled
                    ? "Ative os olhos da Leticia para liberar o preview"
                    : assistantVoiceEnabled
                      ? "Desative a voz da IA para habilitar o preview"
                      : showCameraPane
                        ? "Ocultar preview da camera"
                        : "Exibir preview da camera"
                }
                className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold uppercase tracking-[0.12em] transition md:text-base ${
                  !backgroundVisionEnabled || assistantVoiceEnabled
                    ? "cursor-not-allowed text-white/35"
                    : showCameraPane
                      ? "text-white"
                      : "text-white/55 hover:text-white"
                }`}
              >
                <Camera className="h-3.5 w-3.5" />
                {!backgroundVisionEnabled
                  ? "Preview bloqueado"
                  : assistantVoiceEnabled
                    ? "Preview bloqueado"
                    : showCameraPane
                      ? "Preview on"
                      : "Preview off"}
              </button>
            </div>
            <div className="flex items-center justify-end px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-white/45 md:text-sm">
              Idioma {conversationLocale} | Voz pt-BR-BrendaNeural
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}


