"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Camera, MessageSquareText, Mic, MicOff, Sparkles, Volume2, VolumeX } from "lucide-react";

type ChatRole = "user" | "assistant" | "system";

type AssistantMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  source?: "user" | "proactive" | "event";
};

type PresencePayload = {
  status?: string;
  someone_in_frame?: boolean;
  identity_confirmed?: boolean;
  awareness_state?: Record<string, unknown>;
  current_identity?: Record<string, unknown> | null;
  at?: string;
};

type SendOptions = {
  hiddenUser?: boolean;
  source?: "user" | "proactive";
};

type SiriWaveInstance = {
  start: () => void;
  stop: () => void;
  dispose: () => void;
  set: (property: "amplitude" | "speed", value: number) => void;
  setSpeed: (value: number) => void;
  setAmplitude: (value: number) => void;
};

type VoiceOption = {
  id: string;
  name: string;
  lang: string;
};

type VoiceStyle = "neutral" | "focused" | "warm" | "dynamic";

type VoiceProfile = {
  rate: number;
  pitch: number;
  volume: number;
  pauseMs: number;
  style: VoiceStyle;
};

const PROACTIVE_COOLDOWN_MS = 45_000;
const VOICE_PROFILE_STORAGE_KEY = "knexai.proactive.voice.profile.v1";

const DEFAULT_VOICE_PROFILE: VoiceProfile = {
  rate: 1,
  pitch: 1,
  volume: 1,
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

function extractIdentityLabel(payload: PresencePayload) {
  const identity = payload.current_identity;
  if (!identity || typeof identity !== "object") return "visitante";
  const nominalName = typeof identity.nominal_name === "string" ? identity.nominal_name.trim() : "";
  if (nominalName) return nominalName;
  const label = typeof identity.label === "string" ? identity.label.trim() : "";
  if (label) return label;
  return "visitante";
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

function sanitizeVoiceLabel(name: string) {
  return name
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreVoiceQuality(voice: VoiceOption) {
  const lowerName = voice.name.toLowerCase();
  const lowerLang = voice.lang.toLowerCase();
  let score = 0;
  if (lowerLang === "pt-br" || lowerLang === "pt_br") score += 120;
  if (lowerLang.startsWith("pt")) score += 60;
  if (lowerName.includes("natural")) score += 80;
  if (lowerName.includes("neural")) score += 70;
  if (lowerName.includes("online")) score += 40;
  if (lowerName.includes("premium")) score += 30;
  if (lowerName.includes("wavenet")) score += 30;
  if (lowerName.includes("google")) score += 20;
  if (lowerName.includes("microsoft")) score += 20;
  if (lowerName.includes("aria") || lowerName.includes("jenny") || lowerName.includes("sofia")) score += 24;
  if (lowerName.includes("female") || lowerName.includes("feminina")) score += 12;
  return score;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeVoiceProfile(value: Partial<VoiceProfile> | null | undefined): VoiceProfile {
  return {
    rate: clamp(Number(value?.rate ?? DEFAULT_VOICE_PROFILE.rate) || DEFAULT_VOICE_PROFILE.rate, 0.75, 1.35),
    pitch: clamp(Number(value?.pitch ?? DEFAULT_VOICE_PROFILE.pitch) || DEFAULT_VOICE_PROFILE.pitch, 0.7, 1.35),
    volume: clamp(Number(value?.volume ?? DEFAULT_VOICE_PROFILE.volume) || DEFAULT_VOICE_PROFILE.volume, 0.2, 1),
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

function splitSpeechSegments(text: string) {
  const normalized = text.trim();
  if (!normalized) return [] as string[];
  const segments = normalized
    .split(/(?<=[.!?;:])\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  return segments.length ? segments : [normalized];
}

export default function ProactiveAssistantPage() {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "sending">("idle");
  const [error, setError] = useState("");
  const [streamStatus, setStreamStatus] = useState("Conectando...");
  const [proactiveEnabled, setProactiveEnabled] = useState(true);
  const [showCameraPane, setShowCameraPane] = useState(true);
  const [presenceState, setPresenceState] = useState<PresencePayload | null>(null);
  const [microphoneState, setMicrophoneState] = useState<"off" | "starting" | "on" | "error">("off");
  const [microphoneError, setMicrophoneError] = useState("");
  const [assistantVoiceEnabled, setAssistantVoiceEnabled] = useState(false);
  const [assistantVoiceError, setAssistantVoiceError] = useState("");
  const [assistantSpeaking, setAssistantSpeaking] = useState(false);
  const [voiceProfile, setVoiceProfile] = useState<VoiceProfile>(DEFAULT_VOICE_PROFILE);
  const [selectedVoiceId, setSelectedVoiceId] = useState("auto");
  const [availableVoices, setAvailableVoices] = useState<VoiceOption[]>([]);
  const [voiceMenuOpen, setVoiceMenuOpen] = useState(false);
  const [composerFocused, setComposerFocused] = useState(false);
  const [inactiveComposerBlinkOn, setInactiveComposerBlinkOn] = useState(true);

  const messagesRef = useRef(messages);
  const statusRef = useRef(status);
  const assistantVoiceEnabledRef = useRef(assistantVoiceEnabled);
  const voiceProfileRef = useRef<VoiceProfile>(voiceProfile);
  const selectedVoiceIdRef = useRef(selectedVoiceId);
  const lastProactiveAtRef = useRef(0);
  const commandInputRef = useRef<HTMLInputElement | null>(null);
  const voiceMenuRef = useRef<HTMLDivElement | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const voiceWaveHostRef = useRef<HTMLDivElement | null>(null);
  const voiceWaveRef = useRef<SiriWaveInstance | null>(null);
  const voiceWavePulseIntervalRef = useRef<number | null>(null);
  const voiceVisualTestTimeoutRef = useRef<number | null>(null);
  const voiceBetweenSegmentsTimeoutRef = useRef<number | null>(null);
  const assistantVoiceUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
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
    assistantVoiceEnabledRef.current = assistantVoiceEnabled;
  }, [assistantVoiceEnabled]);

  useEffect(() => {
    selectedVoiceIdRef.current = selectedVoiceId;
  }, [selectedVoiceId]);

  useEffect(() => {
    voiceProfileRef.current = voiceProfile;
  }, [voiceProfile]);

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
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;

    const readVoices = () => {
      const voices = synth.getVoices();
      const normalized = voices
        .map((voice) => ({
          id: voice.voiceURI || `${voice.name}-${voice.lang}`,
          name: voice.name,
          lang: voice.lang,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      setAvailableVoices(normalized);
      if (selectedVoiceIdRef.current !== "auto" && !normalized.some((voice) => voice.id === selectedVoiceIdRef.current)) {
        setSelectedVoiceId("auto");
      }
    };

    readVoices();

    const onVoicesChanged = () => readVoices();
    synth.addEventListener?.("voiceschanged", onVoicesChanged);
    return () => {
      synth.removeEventListener?.("voiceschanged", onVoicesChanged);
    };
  }, []);

  const rankedVoices = useMemo(() => {
    return [...availableVoices].sort((a, b) => scoreVoiceQuality(b) - scoreVoiceQuality(a) || a.name.localeCompare(b.name, "pt-BR"));
  }, [availableVoices]);

  const bestVoices = useMemo(() => {
    const preferred = rankedVoices.filter((voice) => scoreVoiceQuality(voice) >= 90);
    const source = preferred.length ? preferred : rankedVoices;
    return source.slice(0, 8);
  }, [rankedVoices]);

  useEffect(() => {
    if (!voiceMenuOpen) return;

    const closeOnOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!voiceMenuRef.current || !target) return;
      if (!voiceMenuRef.current.contains(target)) {
        setVoiceMenuOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setVoiceMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", closeOnOutside);
    window.addEventListener("touchstart", closeOnOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("mousedown", closeOnOutside);
      window.removeEventListener("touchstart", closeOnOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [voiceMenuOpen]);

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

  const updateVoiceProfile = useCallback((partial: Partial<VoiceProfile>) => {
    setVoiceProfile((current) => normalizeVoiceProfile({ ...current, ...partial }));
  }, []);

  useEffect(() => {
    forceComposerFocus();
  }, [forceComposerFocus]);

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

  const disableMicrophone = useCallback(
    (options?: { silent?: boolean }) => {
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
    [pushSystemMessage],
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

    setMicrophoneError("");
    setMicrophoneState("starting");
    try {
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
          setMicrophoneState("off");
          setMicrophoneError("");
          pushSystemMessage("Microfone desativado pelo sistema.");
        };
      }
      microphoneStreamRef.current = stream;
      setMicrophoneState("on");
      setMicrophoneError("");
      pushSystemMessage("Microfone ativado.");
    } catch (err) {
      const detail = normalizeMicrophoneError(err);
      setMicrophoneState("error");
      setMicrophoneError(detail);
      pushSystemMessage(detail);
    }
  }, [microphoneState, pushSystemMessage]);

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
      disableMicrophone({ silent: true });
    },
    [disableMicrophone],
  );

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

  const stopAssistantVoice = useCallback(() => {
    if (voiceVisualTestTimeoutRef.current !== null) {
      window.clearTimeout(voiceVisualTestTimeoutRef.current);
      voiceVisualTestTimeoutRef.current = null;
    }
    if (voiceBetweenSegmentsTimeoutRef.current !== null) {
      window.clearTimeout(voiceBetweenSegmentsTimeoutRef.current);
      voiceBetweenSegmentsTimeoutRef.current = null;
    }
    if (assistantVoiceUtteranceRef.current) {
      assistantVoiceUtteranceRef.current.onstart = null;
      assistantVoiceUtteranceRef.current.onend = null;
      assistantVoiceUtteranceRef.current.onerror = null;
      assistantVoiceUtteranceRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    stopVoiceWavePulse();
  }, [stopVoiceWavePulse]);

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
    (rawText: string) => {
      const text = rawText.trim();
      if (!text || !assistantVoiceEnabledRef.current) return;
      if (typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
        setAssistantVoiceError("Sintese de voz indisponivel neste navegador.");
        return;
      }
      try {
        const profile = voiceProfileRef.current;
        const styledText = applySpeechStyle(text, profile.style);
        const segments = splitSpeechSegments(styledText);
        if (!segments.length) return;

        const synth = window.speechSynthesis;
        stopAssistantVoice();
        const voices = synth.getVoices();
        const selectedVoice = voices.find(
          (voice) => (voice.voiceURI || `${voice.name}-${voice.lang}`) === selectedVoiceIdRef.current,
        );
        const preferredVoice =
          voices.find((voice) => /^pt[-_]br$/i.test(voice.lang)) || voices.find((voice) => voice.lang.toLowerCase().startsWith("pt"));
        const resolvedVoice = selectedVoiceIdRef.current === "auto" ? preferredVoice : selectedVoice || preferredVoice;
        const style = speechStyleModifiers(profile.style);
        const resolvedRate = clamp(profile.rate * style.rateMul, 0.75, 1.35);
        const resolvedPitch = clamp(profile.pitch * style.pitchMul, 0.7, 1.35);
        const resolvedVolume = clamp(profile.volume, 0.2, 1);
        const interSegmentPause = Math.max(0, profile.pauseMs);

        const speakSegment = (index: number) => {
          if (index >= segments.length) {
            stopVoiceWavePulse();
            assistantVoiceUtteranceRef.current = null;
            return;
          }

          const utterance = new SpeechSynthesisUtterance(segments[index]);
          utterance.lang = "pt-BR";
          utterance.rate = resolvedRate;
          utterance.pitch = resolvedPitch;
          utterance.volume = resolvedVolume;
          if (resolvedVoice) {
            utterance.voice = resolvedVoice;
          }

          utterance.onstart = () => {
            startVoiceWavePulse();
          };
          utterance.onend = () => {
            assistantVoiceUtteranceRef.current = null;
            if (index >= segments.length - 1) {
              stopVoiceWavePulse();
              return;
            }
            voiceBetweenSegmentsTimeoutRef.current = window.setTimeout(() => {
              voiceBetweenSegmentsTimeoutRef.current = null;
              speakSegment(index + 1);
            }, interSegmentPause);
          };
          utterance.onerror = (event) => {
            stopVoiceWavePulse();
            assistantVoiceUtteranceRef.current = null;
            setAssistantVoiceError(normalizeAssistantVoiceError((event as SpeechSynthesisErrorEvent).error));
          };

          assistantVoiceUtteranceRef.current = utterance;
          setAssistantVoiceError("");
          synth.speak(utterance);
        };

        speakSegment(0);
      } catch (voiceError) {
        stopVoiceWavePulse();
        setAssistantVoiceError(normalizeAssistantVoiceError(voiceError));
      }
    },
    [startVoiceWavePulse, stopAssistantVoice, stopVoiceWavePulse],
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
      if (typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
        const detail = "Sintese de voz indisponivel neste navegador.";
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

  const previewVoiceChoice = useCallback(
    (voiceId: string, label?: string) => {
      const enabled = enableAssistantVoice({ silent: true });
      if (!enabled) return;
      selectedVoiceIdRef.current = voiceId;
      setSelectedVoiceId(voiceId);
      stopAssistantVoice();
      setShowCameraPane(false);
      setAssistantVoiceError("");
      if (label) {
        pushSystemMessage(`Preview de voz: ${label.toUpperCase()}`);
      }
      voiceVisualTestTimeoutRef.current = window.setTimeout(() => {
        voiceVisualTestTimeoutRef.current = null;
        speakAssistantReply("TESTE DE VOZ KNEX EM EXECUCAO.");
      }, 180);
    },
    [enableAssistantVoice, pushSystemMessage, speakAssistantReply, stopAssistantVoice],
  );

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
      const currentHistory = buildHistoryForApi(messagesRef.current);
      const assistantId = makeMessageId();

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
          },
          {
            id: assistantId,
            role: "assistant",
            source: nextSource,
            content: "",
            createdAt: Date.now(),
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
          speakAssistantReply(nextContent);
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
          speakAssistantReply(accumulated);
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

  const runQuickAction = useCallback(
    (prompt: string) => {
      void sendPrompt(prompt, { hiddenUser: true, source: "proactive" });
    },
    [sendPrompt],
  );

  const triggerProactiveReply = useCallback(
    (payload: PresencePayload) => {
      if (!proactiveEnabled) return;
      if (!payload.someone_in_frame) return;
      if (statusRef.current !== "idle") return;

      const now = Date.now();
      if (now - lastProactiveAtRef.current < PROACTIVE_COOLDOWN_MS) return;
      lastProactiveAtRef.current = now;

      const identityLabel = extractIdentityLabel(payload);
      const proactivePrompt = [
        "Contexto de streaming em tempo real autorizado:",
        "- Presenca detectada: sim",
        `- Identidade confirmada: ${payload.identity_confirmed ? "sim" : "nao"}`,
        `- Rotulo observado: ${identityLabel}`,
        "",
        "Gere uma mensagem curta, natural e proativa para abrir conversa com o usuario agora.",
        "Responda em pt-BR, sem mencionar regras internas.",
      ].join("\n");

      void sendPrompt(proactivePrompt, { hiddenUser: true, source: "proactive" });
    },
    [proactiveEnabled, sendPrompt],
  );

  const executeTerminalCommand = useCallback(
    (rawValue: string) => {
      const normalized = rawValue.trim().toLowerCase();
      if (!normalized.startsWith("/")) return false;

      if (normalized === "/help") {
        pushSystemMessage(
          "Comandos: /help | /camera on|off|toggle | /microfone on|off|toggle | /voz on|off|toggle|teste | /proativo on|off|toggle | /saudacao | /apoio | /resumo | /clear",
        );
        return true;
      }

      if (normalized === "/clear") {
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

      if (normalized === "/camera on") {
        if (assistantVoiceEnabled) {
          pushSystemMessage("Camera bloqueada enquanto a Voz IA estiver ativa. Use /voz off para liberar.");
          return true;
        }
        setShowCameraPane(true);
        pushSystemMessage("Camera: ON");
        return true;
      }
      if (normalized === "/camera off") {
        if (assistantVoiceEnabled) {
          pushSystemMessage("Camera bloqueada enquanto a Voz IA estiver ativa. Use /voz off para liberar.");
          return true;
        }
        setShowCameraPane(false);
        pushSystemMessage("Camera: OFF");
        return true;
      }
      if (normalized === "/camera toggle") {
        if (assistantVoiceEnabled) {
          pushSystemMessage("Camera bloqueada enquanto a Voz IA estiver ativa. Use /voz off para liberar.");
          return true;
        }
        setShowCameraPane((current) => !current);
        pushSystemMessage("Camera: alternada.");
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
      if (normalized === "/voz teste") {
        previewVoiceChoice(selectedVoiceIdRef.current || "auto");
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
      disableAssistantVoice,
      disableMicrophone,
      enableAssistantVoice,
      enableMicrophone,
      pushSystemMessage,
      previewVoiceChoice,
      runQuickAction,
      toggleAssistantVoice,
      toggleMicrophone,
    ],
  );

  useEffect(() => {
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
    };
    const onPresenceChanged = (event: Event) => {
      const payload = parsePayload(event);
      if (!payload) return;
      setPresenceState(payload);
      triggerProactiveReply(payload);
    };

    eventSource.addEventListener("ready", onReady);
    eventSource.addEventListener("state", onState);
    eventSource.addEventListener("presence_changed", onPresenceChanged);
    eventSource.addEventListener("error", onError);

    return () => {
      eventSource.removeEventListener("ready", onReady);
      eventSource.removeEventListener("state", onState);
      eventSource.removeEventListener("presence_changed", onPresenceChanged);
      eventSource.removeEventListener("error", onError);
      eventSource.close();
    };
  }, [triggerProactiveReply]);

  const latestAssistantMessage = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === "assistant") return messages[index];
    }
    return null;
  }, [messages]);
  const stageText = useMemo(() => {
    const content = latestAssistantMessage?.content?.trim() || (status === "sending" ? "Gerando resposta..." : "");
    if (!content) return "";
    return content.toLocaleUpperCase("pt-BR");
  }, [latestAssistantMessage, status]);

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
  const showVideoStage = !showVoiceStage && showCameraPane;

  return (
    <main className="min-h-screen bg-black font-mono text-white">
      <div className="flex min-h-screen w-full flex-col">
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
          {showVideoStage ? (
            <div ref={cameraStageRef} className="absolute inset-0 flex items-center justify-center overflow-hidden">
              <div
                className="pointer-events-none overflow-hidden border-0 bg-black outline-none ring-0 shadow-none"
                style={{
                  width: `${cameraFrameSize.width}px`,
                  height: `${cameraFrameSize.height}px`,
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
                    className="mx-auto inline-block max-w-[min(88vw,1200px)] whitespace-pre-wrap break-words text-center text-[clamp(1.35rem,2.5vw,2.7rem)] font-semibold uppercase leading-[1.12] tracking-[0.08em] text-white"
                  >
                    {stageText}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <footer className="bg-black/95 px-3 py-3 md:px-5 md:py-4">
          {error ? <p className="mb-2 text-sm uppercase tracking-[0.12em] text-rose-400 md:text-base">{error}</p> : null}
          {microphoneError ? <p className="mb-2 text-sm uppercase tracking-[0.12em] text-amber-300 md:text-base">{microphoneError}</p> : null}
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
                  className="inline-block h-6 w-3 shrink-0 rounded-sm bg-white transition-opacity"
                  style={{ opacity: inactiveComposerBlinkOn ? 1 : 0.15 }}
                  title="Composer inativo"
                />
              ) : null}
              <input
                ref={commandInputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onFocus={() => setComposerFocused(true)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  submitPrompt();
                }}
                onBlur={() => setComposerFocused(false)}
                placeholder=""
                className="h-8 flex-1 bg-transparent text-sm text-white caret-white outline-none placeholder:text-white/35 md:text-base"
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
                disabled={assistantVoiceEnabled}
                title={
                  assistantVoiceEnabled
                    ? "Desative a voz da IA para habilitar a camera"
                    : showCameraPane
                      ? "Desativar camera"
                      : "Ativar camera"
                }
                className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold uppercase tracking-[0.12em] transition md:text-base ${
                  assistantVoiceEnabled ? "cursor-not-allowed text-white/35" : showCameraPane ? "text-white" : "text-white/55 hover:text-white"
                }`}
              >
                <Camera className="h-3.5 w-3.5" />
                {assistantVoiceEnabled ? "Camera bloqueada" : showCameraPane ? "Camera on" : "Camera off"}
              </button>
            </div>
            <div ref={voiceMenuRef} className="relative flex justify-end">
              <button
                type="button"
                onClick={() => setVoiceMenuOpen((current) => !current)}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold uppercase tracking-[0.12em] text-white/70 hover:text-white md:text-base"
                title="Abrir menu de vozes"
              >
                <Volume2 className="h-3.5 w-3.5" />
                Melhores vozes
                <span className="text-xs md:text-sm">{voiceMenuOpen ? "^" : "v"}</span>
              </button>
              {voiceMenuOpen ? (
                <div className="absolute bottom-full right-0 z-30 mb-2 w-[360px] max-h-[60vh] overflow-y-auto bg-black/95 p-2">
                  <div className="mb-2 bg-black/80 p-2">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/70">Perfil voz knex</p>
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateVoiceProfile({ style: "neutral" })}
                        className={`px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                          voiceProfile.style === "neutral" ? "text-white" : "text-white/60 hover:text-white"
                        }`}
                      >
                        Neutro
                      </button>
                      <button
                        type="button"
                        onClick={() => updateVoiceProfile({ style: "focused" })}
                        className={`px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                          voiceProfile.style === "focused" ? "text-white" : "text-white/60 hover:text-white"
                        }`}
                      >
                        Focado
                      </button>
                      <button
                        type="button"
                        onClick={() => updateVoiceProfile({ style: "warm" })}
                        className={`px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                          voiceProfile.style === "warm" ? "text-white" : "text-white/60 hover:text-white"
                        }`}
                      >
                        Quente
                      </button>
                      <button
                        type="button"
                        onClick={() => updateVoiceProfile({ style: "dynamic" })}
                        className={`px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                          voiceProfile.style === "dynamic" ? "text-white" : "text-white/60 hover:text-white"
                        }`}
                      >
                        Dinamico
                      </button>
                    </div>

                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">
                      Tom {voiceProfile.pitch.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min={0.7}
                      max={1.35}
                      step={0.01}
                      value={voiceProfile.pitch}
                      onChange={(event) => updateVoiceProfile({ pitch: Number(event.target.value) })}
                      className="mb-2 w-full accent-white"
                    />

                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">
                      Velocidade {voiceProfile.rate.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min={0.75}
                      max={1.35}
                      step={0.01}
                      value={voiceProfile.rate}
                      onChange={(event) => updateVoiceProfile({ rate: Number(event.target.value) })}
                      className="mb-2 w-full accent-white"
                    />

                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">
                      Pausa {voiceProfile.pauseMs}ms
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={700}
                      step={10}
                      value={voiceProfile.pauseMs}
                      onChange={(event) => updateVoiceProfile({ pauseMs: Number(event.target.value) })}
                      className="mb-2 w-full accent-white"
                    />

                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">
                      Volume {voiceProfile.volume.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min={0.2}
                      max={1}
                      step={0.01}
                      value={voiceProfile.volume}
                      onChange={(event) => updateVoiceProfile({ volume: Number(event.target.value) })}
                      className="w-full accent-white"
                    />

                    <button
                      type="button"
                      onClick={() => setVoiceProfile(DEFAULT_VOICE_PROFILE)}
                      className="mt-2 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/65 hover:text-white"
                    >
                      Resetar perfil
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      previewVoiceChoice("auto", "Auto (pt-BR)");
                      setVoiceMenuOpen(false);
                    }}
                    className={`block w-full px-2.5 py-1.5 text-left text-xs font-semibold uppercase tracking-[0.12em] md:text-sm ${
                      selectedVoiceId === "auto" ? "text-white" : "text-white/60 hover:text-white"
                    }`}
                    title="Selecao automatica (pt-BR prioritaria)"
                  >
                    Auto (pt-BR)
                  </button>
                  {bestVoices.map((voice) => {
                    const selected = selectedVoiceId === voice.id;
                    return (
                      <button
                        key={voice.id}
                        type="button"
                        onClick={() => {
                          previewVoiceChoice(voice.id, sanitizeVoiceLabel(voice.name));
                          setVoiceMenuOpen(false);
                        }}
                        className={`block w-full px-2.5 py-1.5 text-left text-xs font-semibold uppercase tracking-[0.12em] md:text-sm ${
                          selected ? "text-white" : "text-white/60 hover:text-white"
                        }`}
                        title={`${voice.name} (${voice.lang})`}
                      >
                        {sanitizeVoiceLabel(voice.name)} ({voice.lang})
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}

