"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  HelpCircle,
  Keyboard,
  LogOut,
  MessageCircle,
  MessageSquare,
  MoreVertical,
  Pause,
  Phone,
  Play,
  SendHorizontal,
  Mic,
  Search,
  Settings,
  Shield,
  SlidersHorizontal,
  Smile,
  Timer,
  Trash2,
  User,
  Users,
  Video,
} from "lucide-react";
import { Manrope, Space_Grotesk } from "next/font/google";
import type { CSSProperties } from "react";

const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });

const STORAGE_KEY = "knexchat.identity";
const SHOW_OTP_PREVIEW = process.env.NEXT_PUBLIC_KNEXCHAT_SHOW_OTP === "1";
const MOCK_RESEND_WARNING =
  "The knexit.com domain is not verified. Please, add and verify your domain on https://resend.com/domains";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function KnexChatMotionStyles() {
  return (
    <style jsx global>{`
      @keyframes knex-dash {
        0% {
          stroke-dashoffset: 0;
        }
        100% {
          stroke-dashoffset: -180;
        }
      }
      @keyframes knex-dash-reverse {
        0% {
          stroke-dashoffset: 0;
        }
        100% {
          stroke-dashoffset: 180;
        }
      }
      .knex-dash {
        animation: knex-dash 10s linear infinite;
      }
      .knex-dash-reverse {
        animation: knex-dash-reverse 11s linear infinite;
      }
      @keyframes knex-float-left {
        0%,
        100% {
          transform: translate3d(0, 0, 0);
          opacity: 0.55;
        }
        50% {
          transform: translate3d(18px, -12px, 0);
          opacity: 0.8;
        }
      }
      @keyframes knex-float-right {
        0%,
        100% {
          transform: translate3d(0, 0, 0);
          opacity: 0.5;
        }
        50% {
          transform: translate3d(-16px, 14px, 0);
          opacity: 0.78;
        }
      }
      @keyframes knex-record-bar {
        0%,
        100% {
          height: 3px;
          opacity: 0.35;
        }
        50% {
          height: 12px;
          opacity: 0.9;
        }
      }
      .knex-record-wave {
        display: inline-flex;
        align-items: flex-end;
        gap: 2px;
        height: 12px;
      }
      .knex-record-bar {
        width: 2px;
        border-radius: 999px;
        background: #1d4ed8;
        animation: knex-record-bar 1.6s ease-in-out infinite;
        animation-delay: calc(var(--i) * -0.12s);
      }
      .knex-record-wave.is-paused .knex-record-bar {
        animation-play-state: paused;
        opacity: 0.35;
      }
    `}</style>
  );
}

type ScreenVariant = "phone" | "laptop";

function KnexChatScreen({ variant }: { variant: ScreenVariant }) {
  const headerPadding = variant === "phone" ? "px-4 py-3" : "px-5 py-3";
  const bodyPadding = variant === "phone" ? "px-4 py-4" : "px-5 py-5";
  const textBase = variant === "phone" ? "text-[11px]" : "text-xs";
  const inputPadding = variant === "phone" ? "px-3 py-2" : "px-4 py-2.5";
  const showKeyboard = variant === "phone";
  return (
    <div className="flex h-full flex-col">
      <div className={`flex items-center justify-between border-b border-slate-200 ${headerPadding} ${textBase} text-slate-500`}>
        <span className="font-semibold">
          <span className="bg-gradient-to-r from-blue-600 via-sky-500 via-indigo-500 to-cyan-400 bg-clip-text text-transparent">
            KnexChat
          </span>
        </span>
        <span>09:41</span>
      </div>
      <div className={`flex-1 space-y-3 ${bodyPadding}`}>
        <div className={`w-[72%] rounded-2xl bg-slate-200 ${textBase} text-slate-700 px-3 py-2`}>
          Novo grupo criado para a turma 2025.
        </div>
        <div className={`ml-auto w-[64%] rounded-2xl bg-blue-500/20 ${textBase} text-blue-700 px-3 py-2`}>
          Fechado! Vou avisar o time.
        </div>
        <div className={`w-[68%] rounded-2xl bg-slate-200 ${textBase} text-slate-700 px-3 py-2`}>
          Link da reunião: knexchat.app/join
        </div>
        <div className={`ml-auto w-[58%] rounded-2xl bg-blue-500/20 ${textBase} text-blue-700 px-3 py-2`}>
          Agenda confirmada.
        </div>
        <div className={`w-[70%] rounded-2xl bg-slate-200 ${textBase} text-slate-700 px-3 py-2`}>
          Encontros semanais ?s 18h.
        </div>
        <div className={`ml-auto w-[54%] rounded-2xl bg-blue-500/20 ${textBase} text-blue-700 px-3 py-2`}>
          Perfeito, obrigado!
        </div>
      </div>
      <div className={`mx-4 mb-4 flex items-center gap-2 rounded-full border border-slate-200 bg-white ${textBase} text-slate-500 ${inputPadding}`}>
        <span>Digitando: "Vamos alinhar?"</span>
      </div>
      {showKeyboard ? (
        <div className="mt-auto border-t border-slate-200 bg-slate-100 px-4 pb-4 pt-3">
          <div className="mb-2 flex justify-center">
            <div className="h-1.5 w-16 rounded-full bg-slate-300" />
          </div>
          <div className="grid grid-cols-10 gap-1 text-[10px] text-slate-600">
            {"QWERTYUIOP".split("").map((key) => (
              <div key={key} className="rounded-md bg-white px-2 py-1 text-center shadow-sm">
                {key}
              </div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-9 gap-1 px-2 text-[10px] text-slate-600">
            {"ASDFGHJKL".split("").map((key) => (
              <div key={key} className="rounded-md bg-white px-2 py-1 text-center shadow-sm">
                {key}
              </div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-12 gap-1 text-[10px] text-slate-600">
            <div className="col-span-2 rounded-md bg-white px-2 py-1 text-center shadow-sm">123</div>
            {"ZXCVBNM".split("").map((key) => (
              <div key={key} className="rounded-md bg-white px-2 py-1 text-center shadow-sm">
                {key}
              </div>
            ))}
            <div className="col-span-2 rounded-md bg-white px-2 py-1 text-center shadow-sm">Bksp</div>
          </div>
          <div className="mt-1 grid grid-cols-12 gap-1 text-[10px] text-slate-600">
            <div className="col-span-2 rounded-md bg-white px-2 py-1 text-center shadow-sm">ABC</div>
            <div className="col-span-8 rounded-md bg-white px-2 py-1 text-center shadow-sm">space</div>
            <div className="col-span-2 rounded-md bg-blue-500 px-2 py-1 text-center font-semibold text-white shadow-sm">
              send
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function KnexChatGlowBackdrop() {
  return (
    <>
      <div className="pointer-events-none absolute -top-[140px] -left-[140px] z-0 h-[720px] w-[720px] rounded-full bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.26)_0%,transparent_70%)] blur-[90px] opacity-60" />
      <div className="pointer-events-none absolute -bottom-[180px] -right-[180px] z-0 h-[820px] w-[820px] rounded-full bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.24)_0%,transparent_70%)] blur-[90px] opacity-60" />
      <div className="pointer-events-none absolute -top-[120px] -right-[200px] z-0 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.2)_0%,transparent_70%)] blur-[90px] opacity-50" />
      <div className="pointer-events-none absolute -bottom-[160px] -left-[200px] z-0 h-[640px] w-[640px] rounded-full bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.2)_0%,transparent_70%)] blur-[90px] opacity-50" />
    </>
  );
}

type Identity = {
  userId: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  deviceId: string;
  name?: string;
};

type TabKey = "conversations" | "groups" | "contacts";
type FilterKey = "all" | "unread" | "groups" | "contacts";

type Thread = {
  id: string;
  title: string;
  preview: string;
  lastActivity: string;
  unread?: number;
  tab: TabKey;
  avatarUrl?: string;
  onlineCount?: number;
};

type Message = {
  id: string;
  author: "me" | "them";
  body: string;
  time: string;
  senderName?: string;
  audioUrl?: string;
  audioDuration?: string;
};

type WallpaperOption = {
  key: string;
  label: string;
  color?: string;
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Tudo" },
  { key: "unread", label: "Não lidas" },
  { key: "groups", label: "Grupos" },
  { key: "contacts", label: "Contatos" },
];

const WALLPAPER_OPTIONS: WallpaperOption[] = [
  { key: "default", label: "Padrão", color: "#efe8e1" },
  { key: "mist", label: "Névoa", color: "#eef2f7" },
  { key: "ice", label: "Gelo", color: "#e3f2ff" },
  { key: "mint", label: "Menta", color: "#ddf5ec" },
  { key: "sky", label: "Céu", color: "#d8f1ff" },
  { key: "sand", label: "Areia", color: "#f4efe7" },
  { key: "lilac", label: "Lilás", color: "#ece7ff" },
  { key: "lemon", label: "Limão", color: "#fff6bf" },
  { key: "rose", label: "Rosa", color: "#ffdbe6" },
  { key: "peach", label: "Pêssego", color: "#ffd9b0" },
  { key: "coral", label: "Coral", color: "#ffd0c7" },
  { key: "lagoon", label: "Laguna", color: "#d8f7f3" },
  { key: "sage", label: "Sálvia", color: "#e2efe5" },
  { key: "stone", label: "Pedra", color: "#e4e7ec" },
  { key: "denim", label: "Denim", color: "#c7d8ff" },
  { key: "night", label: "Noite", color: "#1b2230" },
  { key: "graphite", label: "Grafite", color: "#2b2f38" },
  { key: "plum", label: "Ameixa", color: "#3b1f3b" },
  { key: "forest", label: "Floresta", color: "#1f3a33" },
  { key: "navy", label: "Marinho", color: "#1a2b4f" },
];

const INITIAL_CONVERSATIONS: Thread[] = [
  {
    id: "conv-geral",
    title: "Geral",
    preview: "Checklist do sprint fechado.",
    lastActivity: "Agora",
    unread: 2,
    tab: "conversations",
    avatarUrl: "https://i.pravatar.cc/100?img=32",
  },
  {
    id: "conv-orientacao",
    title: "Orientação de TCC",
    preview: "Revisão enviada para você.",
    lastActivity: "09:40",
    tab: "conversations",
    avatarUrl: "https://i.pravatar.cc/100?img=47",
  },
  {
    id: "conv-projeto",
    title: "Projeto KnexIt",
    preview: "Vamos alinhar os canais.",
    lastActivity: "Ontem",
    tab: "conversations",
    avatarUrl: "https://i.pravatar.cc/100?img=12",
  },
];

const INITIAL_GROUPS: Thread[] = [
  {
    id: "grp-lab-ia",
    title: "Lab IA",
    preview: "Nova pauta adicionada.",
    lastActivity: "08:10",
    onlineCount: 6,
    unread: 1,
    tab: "groups",
    avatarUrl: "https://i.pravatar.cc/100?img=15",
  },
  {
    id: "grp-turma-2025",
    title: "Turma 2025",
    preview: "Bem-vindos!",
    lastActivity: "Ontem",
    onlineCount: 18,
    tab: "groups",
    avatarUrl: "https://i.pravatar.cc/100?img=8",
  },
];

const INITIAL_CONTACTS: Thread[] = [
  {
    id: "ctt-luiza",
    title: "Luiza Costa",
    preview: "Online agora",
    lastActivity: "Ativo",
    tab: "contacts",
    avatarUrl: "https://i.pravatar.cc/100?img=5",
  },
  {
    id: "ctt-vitor",
    title: "Mentor Vitor",
    preview: "Disponível até 18h",
    lastActivity: "Ativo",
    tab: "contacts",
    avatarUrl: "https://i.pravatar.cc/100?img=23",
  },
];

const SETTINGS_MENU = [
  {
    key: "general",
    label: "Geral",
    description: "Iniciar e fechar",
    icon: SlidersHorizontal,
  },
  {
    key: "account",
    label: "Conta",
    description: "Notificações de segurança, dados da conta",
    icon: User,
  },
  {
    key: "privacy",
    label: "Privacidade",
    description: "Contatos bloqueados, mensagens temporárias",
    icon: Shield,
  },
  {
    key: "chats",
    label: "Conversas",
    description: "Tema, papel de parede, configurações de conversas",
    icon: MessageSquare,
  },
  {
    key: "media",
    label: "Vídeo e voz",
    description: "Câmera, microfone e alto-falantes",
    icon: Video,
  },
  {
    key: "notifications",
    label: "Notificações",
    description: "Notificações de mensagens",
    icon: Bell,
  },
  {
    key: "shortcuts",
    label: "Atalhos do teclado",
    description: "Ações rápidas",
    icon: Keyboard,
  },
  {
    key: "help",
    label: "Ajuda e feedback",
    description: "Central de Ajuda, fale conosco, Política de Privacidade",
    icon: HelpCircle,
  },
] as const;

const MESSAGE_SEED: Record<string, Message[]> = {
  "conv-geral": [
    { id: "m1", author: "them", body: "Bom dia! Fechamos a pauta de hoje?", time: "09:12" },
    { id: "m2", author: "me", body: "Sim, subi o resumo e o checklist.", time: "09:14" },
    { id: "m3", author: "them", body: "Perfeito. Vou avisar o time.", time: "09:15" },
  ],
  "conv-orientacao": [
    { id: "m1", author: "them", body: "Revisou o capítulo 2?", time: "09:03" },
    { id: "m2", author: "me", body: "Sim, ajustei a metodologia.", time: "09:06" },
    { id: "m3", author: "them", body: "Vamos marcar uma call.", time: "09:08" },
  ],
  "conv-projeto": [
    { id: "m1", author: "them", body: "Preciso do status do onboarding.", time: "Ontem" },
    { id: "m2", author: "me", body: "Em andamento, falta revisar o fluxo.", time: "Ontem" },
  ],
  "grp-lab-ia": [
    { id: "m1", author: "them", body: "Reunião hoje às 14h.", time: "08:05", senderName: "Camila Souza" },
    { id: "m2", author: "me", body: "Confirmado. Levo o protótipo.", time: "08:07" },
  ],
  "grp-turma-2025": [
    { id: "m1", author: "them", body: "Boas-vindas! Agenda liberada.", time: "Ontem", senderName: "Coordenação" },
    { id: "m2", author: "me", body: "Obrigado! Já conferi o cronograma.", time: "Ontem" },
  ],
  "ctt-luiza": [
    { id: "m1", author: "them", body: "Pode revisar o material do evento?", time: "08:50" },
    { id: "m2", author: "me", body: "Sim, mando ainda hoje.", time: "08:52" },
  ],
  "ctt-vitor": [
    { id: "m1", author: "them", body: "Quer discutir a proposta de pesquisa?", time: "Ontem" },
    { id: "m2", author: "me", body: "Claro, estou livre amanhã.", time: "Ontem" },
  ],
};

const THEME_STYLE: CSSProperties = {
  "--knex-900": "#05070d",
  "--knex-850": "#0b111c",
  "--knex-800": "#101826",
  "--knex-700": "#e2e8f0",
  "--knex-650": "#273449",
  "--knex-accent": "#34d399",
  "--knex-accent-strong": "#10b981",
  "--knex-accent-glow": "rgba(16, 185, 129, 0.25)",
  "--knex-accent-soft": "rgba(52, 211, 153, 0.16)",
} as CSSProperties;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

function isValidEmail(email: string) {
  return /\S+@\S+\.\S+/.test(email);
}

function getAvatarText(label: string) {
  const cleaned = label.replace(/[^a-zA-Z0-9]/g, " ").trim();
  if (!cleaned) return "KN";
  const parts = cleaned.split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? parts[0]?.[1] ?? "";
  return `${first}${second}`.toUpperCase();
}

const SENDER_COLOR_CLASSES = [
  "text-blue-700",
  "text-emerald-700",
  "text-rose-600",
  "text-indigo-700",
  "text-amber-700",
  "text-sky-700",
  "text-fuchsia-700",
  "text-teal-700",
  "text-violet-700",
  "text-orange-700",
];

function getSenderColorClass(label: string) {
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = (hash * 31 + label.charCodeAt(i)) % 2147483647;
  }
  const index = Math.abs(hash) % SENDER_COLOR_CLASSES.length;
  return SENDER_COLOR_CLASSES[index];
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function isIdentity(value: unknown): value is Identity {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.userId === "string" &&
    typeof record.email === "string" &&
    typeof record.emailVerified === "boolean" &&
    typeof record.createdAt === "string" &&
    typeof record.deviceId === "string" &&
    (record.name === undefined || typeof record.name === "string")
  );
}

function safeParseIdentity(raw: string): Identity | null {
  try {
    const parsed = JSON.parse(raw);
    return isIdentity(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export default function KnexChatPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const isChatRoute = pathname?.startsWith("/knexchat/web/chat");
  const searchQuery = useMemo(() => searchParams?.toString() ?? "", [searchParams]);
  const chatHref = useMemo(
    () => (searchQuery ? `/knexchat/web/chat?${searchQuery}` : "/knexchat/web/chat"),
    [searchQuery],
  );
  const activationHref = useMemo(
    () => (searchQuery ? `/knexchat/web?${searchQuery}` : "/knexchat/web"),
    [searchQuery],
  );
  const joinToken = useMemo(() => {
    const raw = searchParams?.get("join");
    return raw?.trim() ? raw.trim() : null;
  }, [searchParams]);
  const threadParam = useMemo(() => {
    const raw = searchParams?.get("thread");
    return raw?.trim() ? raw.trim() : null;
  }, [searchParams]);

  const [identity, setIdentity] = useState<Identity | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [registeringName, setRegisteringName] = useState("");
  const [registeringEmail, setRegisteringEmail] = useState("");
  const [activationStep, setActivationStep] = useState<"email" | "otp">("email");
  const [otpGenerated, setOtpGenerated] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [activationError, setActivationError] = useState<string | null>(null);
  const [activationNotice, setActivationNotice] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [activeThreadId, setActiveThreadId] = useState<string>(INITIAL_CONVERSATIONS[0].id);
  const [pendingJoinToken, setPendingJoinToken] = useState<string | null>(null);
  const [handledJoinToken, setHandledJoinToken] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Thread[]>(INITIAL_CONVERSATIONS);
  const [groups, setGroups] = useState<Thread[]>(INITIAL_GROUPS);
  const [contacts, setContacts] = useState<Thread[]>(INITIAL_CONTACTS);
  const [messageDraft, setMessageDraft] = useState("");
  const [messagesByThread, setMessagesByThread] = useState<Record<string, Message[]>>(MESSAGE_SEED);
  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "paused">("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeSettingKey, setActiveSettingKey] = useState<(typeof SETTINGS_MENU)[number]["key"] | null>(null);
  const [isWallpaperModalOpen, setIsWallpaperModalOpen] = useState(false);
  const [wallpaperHoverKey, setWallpaperHoverKey] = useState<string | null>(null);
  const [headerInfoStep, setHeaderInfoStep] = useState(0);
  const [settingsState, setSettingsState] = useState({
    openOnStart: true,
    minimizeToTray: true,
    language: "automatico",
    fontSize: "100%",
    spellCheck: true,
    emojiReplace: true,
    enterToSend: true,
    wallpaper: "default",
    theme: "light" as "light" | "dark" | "system",
  });
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [pendingTheme, setPendingTheme] = useState<"light" | "dark" | "system">("light");
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingIntervalRef = useRef<number | null>(null);
  const recordingSecondsRef = useRef(0);
  const recordingActionRef = useRef<"send" | "discard">("discard");
  const recordingDurationRef = useRef(0);
  const audioChunksRef = useRef<Blob[]>([]);

  const currentUser = useMemo(() => {
    if (!identity) return null;
    const displayName = identity.name?.trim() ? identity.name : "Participante";
    const avatarSource = identity.name?.trim()
      ? identity.name
      : identity.email.split("@")[0] ?? identity.email;
    return {
      id: "u1",
      name: displayName,
      role: "student",
      email: identity.email,
      avatarText: getAvatarText(avatarSource),
    };
  }, [identity]);

  const combinedThreads = useMemo(() => [...conversations, ...groups], [conversations, groups]);
  const activeThreads = useMemo(() => {
    if (activeFilter === "groups") return groups;
    if (activeFilter === "contacts") return contacts;
    if (activeFilter === "unread") return combinedThreads.filter((thread) => thread.unread);
    return combinedThreads;
  }, [activeFilter, combinedThreads, groups, contacts]);
  const activeThread = useMemo(() => {
    const allThreads = [...conversations, ...groups, ...contacts];
    return allThreads.find((thread) => thread.id === activeThreadId) ?? activeThreads[0] ?? null;
  }, [activeThreadId, conversations, groups, contacts, activeThreads]);
  const headerInfo = useMemo(() => {
    const thread = activeThread;
    const isContact = thread?.tab === "contacts";
    const isGroup = thread?.tab === "groups";
    const previewLower = thread?.preview?.toLowerCase() ?? "";
    const onlineCount = thread?.onlineCount ?? 0;
    const isOnline = isContact
      ? Boolean(previewLower.includes("online") || previewLower.includes("disponível") || thread?.lastActivity === "Ativo")
      : isGroup
        ? onlineCount > 0
        : false;
    const statusLabel = isGroup
      ? `${onlineCount} participante${onlineCount === 1 ? "" : "s"} online`
      : isOnline
        ? "Online agora"
        : "Offline";
    const lastActivityLabel = thread?.lastActivity === "Ativo" ? "Agora" : thread?.lastActivity;
    const lastSeenLabel = lastActivityLabel ? `Último acesso: ${lastActivityLabel}` : "Último acesso indisponível";
    const hintLabel = isContact
      ? "clique para mostrar dados do contato"
      : isGroup
        ? "clique para mostrar dados do grupo"
        : "clique para mostrar dados";
    const dotClass = isOnline ? "bg-emerald-400" : "bg-slate-300";
    return { statusLabel, lastSeenLabel, hintLabel, dotClass };
  }, [activeThread]);
  const headerInfoItems = useMemo(
    () => [headerInfo.statusLabel, headerInfo.lastSeenLabel, headerInfo.hintLabel].filter(Boolean),
    [headerInfo],
  );

  useEffect(() => {
    setHeaderInfoStep(0);
    if (headerInfoItems.length <= 1) return;
    const interval = setInterval(() => {
      setHeaderInfoStep((prev) => (prev + 1) % headerInfoItems.length);
    }, 3200);
    return () => clearInterval(interval);
  }, [activeThreadId, headerInfoItems.length]);

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        window.clearInterval(recordingIntervalRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const activeMessages = useMemo(() => {
    if (!activeThread) return [];
    return messagesByThread[activeThread.id] ?? [
      {
        id: "m1",
        author: "them",
        body: `Thread ${activeThread.id} aberta via link.`,
        time: "Agora",
      },
      { id: "m2", author: "me", body: "Oi! Vamos conversar por aqui.", time: "Agora" },
    ];
  }, [activeThread, messagesByThread]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setIsReady(true);
        return;
      }
      const parsed = safeParseIdentity(raw);
      if (parsed) {
        setIdentity(parsed);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/knexchat/sw.js", { scope: "/knexchat/" }).catch(() => {});
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const displayMode = window.matchMedia("(display-mode: standalone)");
    if (displayMode.matches) {
      setIsInstalled(true);
    }
    const handlePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemPrefersDark(media.matches);
    const handleChange = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches);
    if (media.addEventListener) {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  useEffect(() => {
    if (!joinToken) {
      setPendingJoinToken(null);
      return;
    }
    if (joinToken === handledJoinToken) return;
    setPendingJoinToken(joinToken);
  }, [joinToken, handledJoinToken]);

  useEffect(() => {
    if (!threadParam) return;
    const allThreads = [...conversations, ...groups, ...contacts];
    const existing = allThreads.find((thread) => thread.id === threadParam);
    if (existing) {
      setActiveFilter(existing.tab === "groups" ? "groups" : "all");
      setActiveThreadId(existing.id);
      return;
    }
    const newThread: Thread = {
      id: threadParam,
      title: `Thread ${threadParam}`,
      preview: "Conversa iniciada via link.",
      lastActivity: "Agora",
      tab: "conversations",
    };
    setConversations((prev) => (prev.some((item) => item.id === threadParam) ? prev : [newThread, ...prev]));
    setActiveFilter("all");
    setActiveThreadId(threadParam);
  }, [threadParam, conversations, groups, contacts]);

  useEffect(() => {
    if (!activeThreads.length) {
      setActiveThreadId("");
      return;
    }
    if (!activeThreads.some((thread) => thread.id === activeThreadId)) {
      setActiveThreadId(activeThreads[0].id);
    }
  }, [activeThreads, activeThreadId]);

  useEffect(() => {
    if (!isReady) return;
    if (identity && !isChatRoute) {
      router.replace(chatHref);
      return;
    }
    if (!identity && isChatRoute) {
      router.replace(activationHref);
    }
  }, [activationHref, chatHref, identity, isChatRoute, isReady, router]);

  const handleSendCode = async () => {
    const normalizedName = normalizeName(registeringName);
    if (!normalizedName) {
      setActivationError("Informe seu nome.");
      return;
    }
    const normalized = normalizeEmail(registeringEmail);
    if (!normalized || !isValidEmail(normalized)) {
      setActivationError("Informe um e-mail válido.");
      return;
    }
    const generated = Math.floor(100000 + Math.random() * 900000).toString();
    if (SHOW_OTP_PREVIEW) {
      setOtpGenerated(generated);
      setOtpInput("");
      setActivationError(null);
      setActivationNotice(null);
      setActivationStep("otp");
      return;
    }
    setIsSendingOtp(true);
    setActivationError(null);
    setActivationNotice(null);
    try {
      const res = await fetch("/api/knexchat/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized, code: generated }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = typeof payload?.message === "string" ? payload.message : "Falha ao enviar código.";
        throw new Error(message);
      }
      setOtpGenerated(generated);
      setOtpInput("");
      setActivationError(null);
      setActivationNotice("Código enviado para seu e-mail.");
      setActivationStep("otp");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao enviar código.";
      setActivationError(message);
      setActivationNotice(null);
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleConfirmOtp = () => {
    if (!otpGenerated || otpInput.trim() !== otpGenerated) {
      setActivationError("Código inválido");
      return;
    }
    const normalizedName = normalizeName(registeringName);
    const normalized = normalizeEmail(registeringEmail);
    const nextIdentity: Identity = {
      userId: "u1",
      email: normalized,
      emailVerified: true,
      deviceId: `dev_${Math.random().toString(16).slice(2)}`,
      createdAt: new Date().toISOString(),
      name: normalizedName || undefined,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextIdentity));
    } catch {
      // Ignore storage errors; identity still lives in memory.
    }
    setIdentity(nextIdentity);
    setActivationStep("email");
    setOtpGenerated(null);
    setOtpInput("");
    setActivationError(null);
    setActivationNotice(null);
    router.replace(chatHref);
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors.
    }
    setIdentity(null);
    setRegisteringName("");
    setRegisteringEmail("");
    setOtpGenerated(null);
    setOtpInput("");
    setActivationError(null);
    setActivationNotice(null);
    setIsSendingOtp(false);
    setActivationStep("email");
    setHandledJoinToken(null);
    router.replace(activationHref);
  };

  const handleAcceptJoin = () => {
    if (!pendingJoinToken) return;
    const newThreadId = `grp_${pendingJoinToken}`;
    const newThread: Thread = {
      id: newThreadId,
      title: `Grupo ${pendingJoinToken}`,
      preview: "Convite aceito.",
      lastActivity: "Agora",
      tab: "groups",
    };
    setGroups((prev) => (prev.some((item) => item.id === newThreadId) ? prev : [newThread, ...prev]));
    setMessagesByThread((prev) => ({
      ...prev,
      [newThreadId]: [
        { id: "m1", author: "them", body: "Grupo ativado via convite.", time: "Agora" },
        { id: "m2", author: "me", body: "Oi, pessoal! Cheguei.", time: "Agora" },
      ],
    }));
    setActiveFilter("groups");
    setActiveThreadId(newThreadId);
    setHandledJoinToken(pendingJoinToken);
    setPendingJoinToken(null);
  };

  const handleSendMessage = () => {
    if (!activeThread || !currentUser) return;
    const trimmed = messageDraft.trim();
    if (!trimmed) return;
    const timeLabel = new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const newMessage: Message = {
      id: `m_${Date.now()}`,
      author: "me",
      body: trimmed,
      time: timeLabel,
    };
    setMessagesByThread((prev) => ({
      ...prev,
      [activeThread.id]: [...(prev[activeThread.id] ?? []), newMessage],
    }));
    const updateThread = (threads: Thread[]) =>
      threads.map((thread) =>
        thread.id === activeThread.id
          ? { ...thread, preview: trimmed, lastActivity: timeLabel }
          : thread,
      );
    if (activeThread.tab === "conversations") {
      setConversations(updateThread);
    } else if (activeThread.tab === "groups") {
      setGroups(updateThread);
    } else {
      setContacts(updateThread);
    }
    setMessageDraft("");
  };

  const stopRecordingTimer = () => {
    if (recordingIntervalRef.current) {
      window.clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  };

  const startRecordingTimer = (reset = false) => {
    if (reset) {
      recordingSecondsRef.current = 0;
      setRecordingSeconds(0);
    }
    stopRecordingTimer();
    recordingIntervalRef.current = window.setInterval(() => {
      recordingSecondsRef.current += 1;
      setRecordingSeconds(recordingSecondsRef.current);
    }, 1000);
  };

  const finalizeRecording = (action: "send" | "discard", blob: Blob | null) => {
    const durationLabel = formatDuration(recordingDurationRef.current);
    if (action === "send" && blob && activeThread && currentUser) {
      const timeLabel = new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const audioUrl = URL.createObjectURL(blob);
      const newMessage: Message = {
        id: `m_${Date.now()}`,
        author: "me",
        body: "Mensagem de áudio",
        time: timeLabel,
        audioUrl,
        audioDuration: durationLabel,
      };
      setMessagesByThread((prev) => ({
        ...prev,
        [activeThread.id]: [...(prev[activeThread.id] ?? []), newMessage],
      }));
      const updateThread = (threads: Thread[]) =>
        threads.map((thread) =>
          thread.id === activeThread.id
            ? { ...thread, preview: "Mensagem de áudio", lastActivity: timeLabel }
            : thread,
        );
      if (activeThread.tab === "conversations") {
        setConversations(updateThread);
      } else if (activeThread.tab === "groups") {
        setGroups(updateThread);
      } else {
        setContacts(updateThread);
      }
    }
    setRecordingState("idle");
    setRecordingSeconds(0);
    recordingSecondsRef.current = 0;
    recordingDurationRef.current = 0;
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
  };

  const startRecording = async () => {
    if (recordingState !== "idle") return;
    if (typeof window === "undefined") return;
    if (!navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recordingActionRef.current = "discard";
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const blob = audioChunksRef.current.length
          ? new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" })
          : null;
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }
        finalizeRecording(recordingActionRef.current, blob);
      };
      recorder.start();
      setRecordingState("recording");
      startRecordingTimer(true);
    } catch {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    }
  };

  const stopRecording = (action: "send" | "discard") => {
    recordingActionRef.current = action;
    recordingDurationRef.current = recordingSecondsRef.current;
    stopRecordingTimer();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      finalizeRecording(action, null);
    }
  };

  const toggleRecordingPause = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (recordingState === "recording") {
      recorder.pause();
      setRecordingState("paused");
      stopRecordingTimer();
    } else if (recordingState === "paused") {
      recorder.resume();
      setRecordingState("recording");
      startRecordingTimer(false);
    }
  };

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice.catch(() => null);
    setInstallPrompt(null);
  };

  const navButtonClass = (active: boolean) =>
    `grid h-11 w-11 place-items-center rounded-2xl transition ${
      active
        ? isDarkTheme
          ? "bg-white/10 text-slate-100 shadow-[0_12px_24px_rgba(0,0,0,0.45)]"
          : "bg-slate-100 text-slate-900 shadow-[0_12px_24px_rgba(15,23,42,0.18)]"
        : isDarkTheme
          ? "text-slate-300 hover:bg-white/10"
          : "text-slate-900 hover:bg-slate-100"
    }`;

  const toggleSetting = (key: "openOnStart" | "minimizeToTray" | "spellCheck" | "emojiReplace" | "enterToSend") => {
    setSettingsState((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const themeLabel =
    settingsState.theme === "dark" ? "Modo escuro" : settingsState.theme === "system" ? "Automático" : "Modo claro";
  const isDarkTheme = settingsState.theme === "dark" || (settingsState.theme === "system" && systemPrefersDark);
  const wallpaperPreviewKey = isWallpaperModalOpen ? wallpaperHoverKey ?? settingsState.wallpaper : settingsState.wallpaper;
  const wallpaperColor = useMemo(() => {
    const option = WALLPAPER_OPTIONS.find((item) => item.key === wallpaperPreviewKey);
    return option?.color;
  }, [wallpaperPreviewKey]);
  const wallpaperPreviewColor = wallpaperColor ?? (isDarkTheme ? "#141414" : "#ffffff");
  const settingsPanelBase = isDarkTheme ? "bg-[#141414] text-slate-100" : "bg-white text-slate-900";
  const settingsBorder = isDarkTheme ? "border-[#2a2a2a]" : "border-slate-200";
  const settingsMuted = isDarkTheme ? "text-slate-400" : "text-slate-500";
  const settingsField =
    isDarkTheme ? "border-[#2a2a2a] bg-[#1b1b1b] text-slate-100" : "border-slate-200 bg-white text-slate-900";
  const settingsHover = isDarkTheme ? "hover:bg-white/5" : "hover:bg-slate-100";
  const navRailBase = isDarkTheme ? "bg-[#0f0f0f]" : "bg-white";
  const navRailDivider = isDarkTheme ? "bg-[#2a2a2a]" : "bg-slate-200";

  const activationBackdrop = !isChatRoute ? (
    <>
      <KnexChatMotionStyles />
      <KnexChatGlowBackdrop />
    </>
  ) : null;

  if (!isReady) {
    return (
      <main
        style={THEME_STYLE}
        className={`${manrope.className} relative h-[100svh] bg-white overflow-hidden text-slate-900`}
      >
        {activationBackdrop}
        <div className="relative z-10 flex min-h-screen items-center justify-center">
          <div className="text-sm text-slate-400">Carregando KnexChat...</div>
        </div>
      </main>
    );
  }

  if (!identity) {
    if (isChatRoute) {
      return (
        <main
          style={THEME_STYLE}
          className={`${manrope.className} relative h-[100svh] bg-white overflow-hidden text-slate-900`}
        >
          <div className="relative z-10 flex min-h-screen items-center justify-center">
            <div className="text-sm text-slate-400">Redirecionando para ativa??o...</div>
          </div>
        </main>
      );
    }
    return (
      <main className={`${manrope.className} relative h-[100svh] bg-white overflow-hidden text-slate-900`}>
        {activationBackdrop}
        <div className="relative z-10">
          <ActivationScreen
            headingClassName={spaceGrotesk.className}
            registeringName={registeringName}
            registeringEmail={registeringEmail}
            onNameChange={setRegisteringName}
            onEmailChange={setRegisteringEmail}
            activationStep={activationStep}
            otpInput={otpInput}
            otpGenerated={otpGenerated}
            activationError={activationError}
            activationNotice={activationNotice}
            isSendingOtp={isSendingOtp}
            showOtpPreview={SHOW_OTP_PREVIEW}
            onSendCode={handleSendCode}
            onOtpChange={setOtpInput}
            onConfirmOtp={handleConfirmOtp}
            onEditEmail={() => {
              setActivationStep("email");
              setActivationError(null);
              setActivationNotice(null);
              setOtpInput("");
            }}
          />
        </div>
      </main>
    );
  }

  if (!isChatRoute) {
    return (
      <main
        style={THEME_STYLE}
        className={`${manrope.className} relative h-[100svh] bg-white overflow-hidden text-slate-900`}
      >
        {activationBackdrop}
        <div className="relative z-10 flex min-h-screen items-center justify-center">
          <div className="text-sm text-slate-400">Abrindo o KnexChat...</div>
        </div>
      </main>
    );
  }

  return (
    <main
      style={THEME_STYLE}
      className={`${manrope.className} relative h-screen overflow-hidden ${
        isDarkTheme ? "bg-[#141414]" : "bg-white"
      } text-slate-100`}
    >
      <KnexChatMotionStyles />
      <div className="relative z-10 flex h-full flex-col">
        <header
          className={`flex flex-wrap items-center justify-between gap-3 border-b ${settingsBorder} bg-[var(--knex-850)]/80 px-4 py-3 backdrop-blur`}
        >
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10">
            <img
              src="/knexchat/icons/knexchat-logo.png"
              alt="Knexchat"
              className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-[28px] object-contain drop-shadow-[0_18px_36px_rgba(59,130,246,0.35)]"
            />
          </div>
          <div>
            <p className={`${spaceGrotesk.className} text-lg font-semibold`}>
              <span className="bg-gradient-to-r from-blue-600 via-sky-500 via-indigo-500 to-cyan-400 bg-clip-text text-transparent">
                KnexChat
              </span>
            </p>
            <p className={`text-xs ${isDarkTheme ? "text-slate-300" : "text-slate-900"}`}>
              Mensageria com Knex ID por e-mail
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-blue-700/80 bg-blue-600 px-3 py-1 text-xs font-bold text-white">
            Knex ID: {identity.email}
          </span>
          {!isInstalled ? (
            <button
              type="button"
              onClick={handleInstallApp}
              className="rounded-full border border-blue-700/80 bg-blue-600 px-3 py-1 text-xs font-bold text-slate-900 transition hover:border-blue-700 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!installPrompt}
              title={installPrompt ? "Instalar Knexchat" : "Instalação indisponível no momento"}
            >
              Instalar
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full border border-rose-500/80 bg-rose-500 px-3 py-1 text-xs font-bold text-slate-900 transition hover:border-rose-600 hover:bg-rose-600"
          >
            Sair
          </button>
        </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <nav
          className={`hidden w-16 flex-col items-center gap-4 border-r ${settingsBorder} ${navRailBase} py-5 lg:flex`}
        >
          <div className="relative">
            <button type="button" className={navButtonClass(!isSettingsOpen)} onClick={() => setIsSettingsOpen(false)}>
              <MessageCircle className="h-5 w-5" />
            </button>
            <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-blue-600 text-[10px] font-semibold text-white">
              67
            </span>
          </div>
          <button type="button" className={navButtonClass(false)}>
            <Phone className="h-5 w-5" />
          </button>
          <button type="button" className={navButtonClass(false)}>
            <CircleDot className="h-5 w-5" />
          </button>
          <button type="button" className={navButtonClass(false)}>
            <Users className="h-5 w-5" />
          </button>
          <div className="mt-auto flex flex-col items-center gap-3">
            <div className={`h-px w-8 ${navRailDivider}`} />
            <button type="button" className={navButtonClass(isSettingsOpen)} onClick={() => setIsSettingsOpen(true)}>
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </nav>
        {isSettingsOpen ? (
          <>
            <aside
              className={`flex w-full flex-col border-b ${settingsBorder} ${settingsPanelBase} lg:w-[340px] lg:border-b-0 lg:border-r`}
            >
              {activeSettingKey === "general" ? (
                <div className="flex h-full flex-col">
                  <div className={`flex items-center gap-3 border-b px-5 py-3 ${settingsBorder}`}>
                    <button
                      type="button"
                      onClick={() => setActiveSettingKey(null)}
                      className={`flex h-7 w-7 items-center justify-center rounded-full transition ${
                        isDarkTheme ? "text-slate-200 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"
                      }`}
                      aria-label="Voltar"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-base font-semibold">Geral</span>
                  </div>
                  <div className="flex-1 space-y-6 px-5 py-4">
                    <div className="space-y-3">
                      <p className={`text-xs font-semibold ${settingsMuted}`}>Iniciar e fechar</p>
                      <div className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-b pb-3 ${settingsBorder}`}>
                        <p className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                          Iniciar o KnexChat ao entrar
                        </p>
                        <button
                          type="button"
                          onClick={() => toggleSetting("openOnStart")}
                          className={`relative h-6 w-11 justify-self-end rounded-full border transition ${
                            settingsState.openOnStart
                              ? "border-emerald-500 bg-emerald-500"
                              : isDarkTheme
                                ? "border-[#3a3a3a] bg-[#1f1f1f]"
                                : "border-slate-300 bg-white"
                          }`}
                          aria-pressed={settingsState.openOnStart}
                        >
                          <span
                            className={`absolute left-1 top-1/2 h-[14px] w-[14px] -translate-y-1/2 rounded-full bg-white shadow transition ${
                              settingsState.openOnStart ? "translate-x-[20px]" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                      <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-4 pb-2">
                        <div>
                          <p className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                            Minimizar para bandeja do sistema
                          </p>
                          <p className={`text-xs ${settingsMuted}`}>
                            Mantenha o KnexChat em execução depois de fechar a janela do app.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleSetting("minimizeToTray")}
                          className={`relative mt-0.5 h-6 w-11 justify-self-end rounded-full border transition ${
                            settingsState.minimizeToTray
                              ? "border-emerald-500 bg-emerald-500"
                              : isDarkTheme
                                ? "border-[#3a3a3a] bg-[#1f1f1f]"
                                : "border-slate-300 bg-white"
                          }`}
                          aria-pressed={settingsState.minimizeToTray}
                        >
                          <span
                            className={`absolute left-1 top-1/2 h-[14px] w-[14px] -translate-y-1/2 rounded-full bg-white shadow transition ${
                              settingsState.minimizeToTray ? "translate-x-[20px]" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className={`text-xs font-semibold ${settingsMuted}`}>Idioma</p>
                      <button
                        type="button"
                        className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm shadow-sm ${settingsField}`}
                      >
                        <span>Automático (sistema: Português (Brasil))</span>
                        <ChevronDown className={`h-4 w-4 ${settingsMuted}`} />
                      </button>
                    </div>

                    <div className="space-y-3">
                      <p className={`text-xs font-semibold ${settingsMuted}`}>Tamanho da fonte</p>
                      <button
                        type="button"
                        className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm shadow-sm ${settingsField}`}
                      >
                        <span>{settingsState.fontSize} (padrão)</span>
                        <ChevronDown className={`h-4 w-4 ${settingsMuted}`} />
                      </button>
                      <p className={`text-xs ${settingsMuted}`}>
                        Pressione Ctrl +/- para aumentar ou diminuir o tamanho do texto.
                      </p>
                    </div>
                  </div>
                </div>
              ) : activeSettingKey === "chats" ? (
                <div className="flex h-full flex-col">
                  <div className={`flex items-center gap-3 border-b px-5 py-3 ${settingsBorder}`}>
                    <button
                      type="button"
                      onClick={() => {
                        if (isWallpaperModalOpen) {
                          setIsWallpaperModalOpen(false);
                          setWallpaperHoverKey(null);
                        } else {
                          setActiveSettingKey(null);
                        }
                      }}
                      className={`flex h-7 w-7 items-center justify-center rounded-full transition ${
                        isDarkTheme ? "text-slate-200 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"
                      }`}
                      aria-label="Voltar"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-base font-semibold">{isWallpaperModalOpen ? "Papel de parede" : "Conversas"}</span>
                  </div>
                  {isWallpaperModalOpen ? (
                    <div className="flex min-h-0 flex-1 flex-col px-5 py-4">
                      <p className={`text-xs font-semibold ${settingsMuted}`}>Definir papel de parede da conversa</p>
                      <div className="mt-4 grid grid-cols-4 gap-3" onMouseLeave={() => setWallpaperHoverKey(null)}>
                        {WALLPAPER_OPTIONS.map((option) => {
                          const isSelected = settingsState.wallpaper === option.key;
                          const isPreview = wallpaperPreviewKey === option.key;
                          return (
                            <button
                              key={option.key}
                              type="button"
                              onMouseEnter={() => setWallpaperHoverKey(option.key)}
                              onFocus={() => setWallpaperHoverKey(option.key)}
                              onClick={() => {
                                setSettingsState((prev) => ({ ...prev, wallpaper: option.key }));
                                setWallpaperHoverKey(option.key);
                              }}
                              className={`flex h-12 w-full items-center justify-center rounded-lg border text-[10px] font-semibold transition ${
                                isPreview
                                  ? "border-blue-600 ring-2 ring-blue-200"
                                  : isSelected
                                    ? "border-blue-600"
                                    : "border-slate-200 hover:border-slate-300"
                              }`}
                              style={option.color ? { backgroundColor: option.color } : undefined}
                            >
                              <span className={option.color ? "sr-only" : isDarkTheme ? "text-slate-100" : "text-slate-700"}>
                                {option.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                  <div className="flex-1 space-y-6 px-5 py-4">
                    <div className="space-y-2">
                      <p className={`text-xs font-semibold ${settingsMuted}`}>Exibição</p>
                      <button
                        type="button"
                        onClick={() => {
                          setPendingTheme(settingsState.theme);
                          setIsThemeModalOpen(true);
                        }}
                        className={`flex w-full items-center justify-between border-b py-2 text-left ${settingsBorder}`}
                      >
                        <div>
                          <p className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>Tema</p>
                          <p className={`text-xs ${settingsMuted}`}>{themeLabel}</p>
                        </div>
                        <ChevronRight className={`h-4 w-4 ${settingsMuted}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setWallpaperHoverKey(null);
                          setIsWallpaperModalOpen(true);
                        }}
                        className={`flex w-full items-center justify-between border-b py-2 text-left ${settingsBorder}`}
                      >
                        <p className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                          Papel de parede
                        </p>
                        <ChevronRight className={`h-4 w-4 ${settingsMuted}`} />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <p className={`text-xs font-semibold ${settingsMuted}`}>Configurações de conversas</p>
                      <button
                        type="button"
                        className={`flex w-full items-center justify-between border-b py-2 text-left ${settingsBorder}`}
                      >
                        <p className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                          Qualidade da mídia
                        </p>
                        <ChevronRight className={`h-4 w-4 ${settingsMuted}`} />
                      </button>
                      <button
                        type="button"
                        className={`flex w-full items-center justify-between border-b py-2 text-left ${settingsBorder}`}
                      >
                        <p className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                          Baixar mídia automaticamente
                        </p>
                        <ChevronRight className={`h-4 w-4 ${settingsMuted}`} />
                      </button>
                      <div className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-b py-2 ${settingsBorder}`}>
                        <div>
                          <p className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                            Verificação ortográfica
                          </p>
                          <p className={`text-xs ${settingsMuted}`}>Verificar ortografia ao digitar.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleSetting("spellCheck")}
                          className={`relative h-6 w-11 justify-self-end rounded-full border transition ${
                            settingsState.spellCheck
                              ? "border-emerald-500 bg-emerald-500"
                              : isDarkTheme
                                ? "border-[#3a3a3a] bg-[#1f1f1f]"
                                : "border-slate-300 bg-white"
                          }`}
                          aria-pressed={settingsState.spellCheck}
                        >
                          <span
                            className={`absolute left-1 top-1/2 h-[14px] w-[14px] -translate-y-1/2 rounded-full bg-white shadow transition ${
                              settingsState.spellCheck ? "translate-x-[20px]" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                      <div className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-b py-2 ${settingsBorder}`}>
                        <div>
                          <p className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                            Substituição de texto por emoji
                          </p>
                          <p className={`text-xs ${settingsMuted}`}>Substitui textos específicos por emojis ao digitar.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleSetting("emojiReplace")}
                          className={`relative h-6 w-11 justify-self-end rounded-full border transition ${
                            settingsState.emojiReplace
                              ? "border-emerald-500 bg-emerald-500"
                              : isDarkTheme
                                ? "border-[#3a3a3a] bg-[#1f1f1f]"
                                : "border-slate-300 bg-white"
                          }`}
                          aria-pressed={settingsState.emojiReplace}
                        >
                          <span
                            className={`absolute left-1 top-1/2 h-[14px] w-[14px] -translate-y-1/2 rounded-full bg-white shadow transition ${
                              settingsState.emojiReplace ? "translate-x-[20px]" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                      <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-4 py-2">
                        <div>
                          <p className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                            Enviar com Enter
                          </p>
                          <p className={`text-xs ${settingsMuted}`}>A tecla Enter envia a mensagem.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleSetting("enterToSend")}
                          className={`relative h-6 w-11 justify-self-end rounded-full border transition ${
                            settingsState.enterToSend
                              ? "border-emerald-500 bg-emerald-500"
                              : isDarkTheme
                                ? "border-[#3a3a3a] bg-[#1f1f1f]"
                                : "border-slate-300 bg-white"
                          }`}
                          aria-pressed={settingsState.enterToSend}
                        >
                          <span
                            className={`absolute left-1 top-1/2 h-[14px] w-[14px] -translate-y-1/2 rounded-full bg-white shadow transition ${
                              settingsState.enterToSend ? "translate-x-[20px]" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                  )}
                </div>
              ) : (
                <>
                  <div className={`border-b px-5 py-3 ${settingsBorder}`}>
                    <h2 className="text-xl font-semibold">Configurações</h2>
                    <div
                      className={`mt-2 flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs shadow-sm ${
                        isDarkTheme
                          ? "border-emerald-500/60 bg-[#1b1b1b] text-slate-300"
                          : "border-emerald-400/70 bg-white text-slate-500"
                      }`}
                    >
                      <Search className="h-4 w-4 text-emerald-500" />
                      <span>Pesquisar configurações</span>
                    </div>
                  </div>
                  <div className={`border-b px-5 py-3 ${settingsBorder}`}>
                    <div className="flex items-center gap-3">
                      <div
                        className={`grid h-10 w-10 place-items-center rounded-full text-sm font-semibold ${
                          isDarkTheme ? "bg-[#0d0d0d] text-slate-100" : "bg-slate-900 text-white"
                        }`}
                      >
                        {getAvatarText(currentUser?.name ?? "KN")}
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                          {currentUser?.name ?? "Participante"}
                        </p>
                        <p className={`text-xs ${isDarkTheme ? "text-slate-400" : "text-slate-600"}`}>
                          {currentUser?.email}
                        </p>
                        <p className={`text-[10px] ${settingsMuted}`}>"Onde há igualdade, a amizade não perde."</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 px-4 py-2">
                    <div className="space-y-0.5">
                      {SETTINGS_MENU.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeSettingKey === item.key;
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => setActiveSettingKey(item.key)}
                            className={`flex w-full items-start gap-3 rounded-2xl px-3 py-2 text-left transition ${
                              isActive ? (isDarkTheme ? "bg-white/10" : "bg-slate-100") : settingsHover
                            }`}
                          >
                            <div
                              className={`grid h-8 w-8 place-items-center rounded-2xl ${
                                isDarkTheme ? "bg-white/10 text-slate-300" : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                            </div>
                            <div>
                              <p className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                                {item.label}
                              </p>
                              <p className={`text-[11px] ${settingsMuted}`}>{item.description}</p>
                            </div>
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={handleLogout}
                        className={`mt-1 flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-rose-500 transition ${
                          isDarkTheme ? "hover:bg-rose-500/10" : "hover:bg-rose-50"
                        }`}
                      >
                        <div
                          className={`grid h-8 w-8 place-items-center rounded-2xl ${
                            isDarkTheme ? "bg-rose-500/10 text-rose-300" : "bg-rose-100 text-rose-500"
                          }`}
                        >
                          <LogOut className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">Desconectar</p>
                        </div>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </aside>
            <section className={`flex min-h-0 flex-1 ${isDarkTheme ? "bg-[#141414]" : "bg-slate-50"}`}>
              {activeSettingKey === "chats" && isWallpaperModalOpen ? (
                <div className="flex h-full w-full flex-col p-6">
                  <p className={`text-xs font-semibold ${settingsMuted}`}>Pré-visualizar papel de parede</p>
                  <div
                    className={`mt-4 flex-1 rounded-2xl border ${settingsBorder}`}
                    style={{ backgroundColor: wallpaperPreviewColor }}
                  />
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center">
                  <div className="text-center">
                    <Settings className={`mx-auto h-16 w-16 ${isDarkTheme ? "text-slate-500" : "text-slate-300"}`} />
                    <p className={`mt-4 text-2xl font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-700"}`}>
                      Configurações
                    </p>
                  </div>
                </div>
              )}
            </section>
            {isThemeModalOpen ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
                <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
                  <h3 className="text-lg font-semibold text-slate-900">Tema</h3>
                  <div className="mt-4 space-y-3">
                    {[
                      { key: "light", label: "Claro" },
                      { key: "dark", label: "Escuro" },
                      { key: "system", label: "Automático (sistema)" },
                    ].map((option) => {
                      const isSelected = pendingTheme === option.key;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => setPendingTheme(option.key as "light" | "dark" | "system")}
                          className="flex w-full items-center gap-3 text-left text-sm text-slate-900"
                        >
                          <span
                            className={`relative h-5 w-5 rounded-full border-2 ${
                              isSelected ? "border-emerald-500" : "border-slate-300"
                            }`}
                          >
                            {isSelected ? (
                              <span className="absolute inset-0 m-1 rounded-full bg-emerald-500" />
                            ) : null}
                          </span>
                          <span>{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-6 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsThemeModalOpen(false)}
                      className="rounded-full px-4 py-2 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSettingsState((prev) => ({ ...prev, theme: pendingTheme }));
                        setIsThemeModalOpen(false);
                      }}
                      className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
                    >
                      OK
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <>
        <aside className="flex w-full flex-col border-b border-[var(--knex-700)] bg-[var(--knex-850)]/60 lg:w-80 lg:border-b-0 lg:border-r">
          <div className="flex flex-col gap-4 border-b border-[var(--knex-700)] px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-900 text-base font-semibold text-emerald-200">
                {currentUser?.avatarText ?? "KN"}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{currentUser?.name}</p>
                <p className="text-xs text-slate-900">{currentUser?.email}</p>
              </div>
            </div>
            <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto whitespace-nowrap">
              {FILTERS.map((filter) => {
                const isActive = filter.key === activeFilter;
                return (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setActiveFilter(filter.key)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                      isDarkTheme
                        ? isActive
                          ? "bg-emerald-500/30 text-emerald-100"
                          : "border border-[var(--knex-700)] text-slate-300 hover:border-emerald-400/50 hover:text-emerald-100"
                        : isActive
                          ? "border border-blue-200 bg-blue-100 text-blue-800"
                          : "border border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                    }`}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <div className="space-y-2">
              {activeThreads.map((thread) => {
                const isActive = thread.id === activeThread?.id;
                return (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => setActiveThreadId(thread.id)}
                    className={`flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left transition ${
                      isDarkTheme ? "" : "font-['Arial']"
                    } ${
                      isActive
                        ? isDarkTheme
                          ? "border-emerald-500/40 bg-emerald-500/10"
                          : "border-blue-200 bg-blue-50"
                        : isDarkTheme
                          ? "border-transparent bg-slate-900/40 hover:border-slate-700/70"
                          : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50"
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      {thread.avatarUrl ? (
                        <img
                          src={thread.avatarUrl}
                          alt={`Avatar de ${thread.title}`}
                          className="h-12 w-12 rounded-2xl object-cover"
                        />
                      ) : (
                        <div
                          className={`grid h-12 w-12 place-items-center rounded-2xl text-xs font-semibold ${
                            isDarkTheme ? "bg-slate-900 text-slate-200" : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {getAvatarText(thread.title)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p
                          className={`truncate text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}
                        >
                          {thread.title}
                        </p>
                        <p className={`truncate text-xs ${isDarkTheme ? "text-slate-300" : "text-slate-900"}`}>
                          {thread.preview}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`text-[11px] ${isDarkTheme ? "text-slate-300" : "text-slate-900"}`}>
                        {thread.lastActivity}
                      </span>
                      {thread.unread ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            isDarkTheme ? "bg-blue-500 text-white" : "bg-blue-600 text-white"
                          }`}
                        >
                          {thread.unread}
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--knex-700)] bg-[var(--knex-850)]/40 px-4 py-3">
            <div>
              <p
                className={`${spaceGrotesk.className} text-lg font-semibold ${
                  isDarkTheme ? "text-slate-100" : "text-slate-900"
                }`}
              >
                {activeThread?.title ?? "Selecione uma conversa"}
              </p>
              <div className={`mt-1 flex items-center gap-2 text-xs ${isDarkTheme ? "text-slate-300" : "text-slate-500"}`}>
                <span className={`h-2 w-2 rounded-full ${headerInfo.dotClass}`} />
                <span>{headerInfoItems[headerInfoStep] ?? ""}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Iniciar videochamada"
                className={`rounded-full p-2 transition ${
                  isDarkTheme ? "text-blue-400 hover:bg-blue-500/10 hover:text-blue-300" : "text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                }`}
              >
                <Video className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Iniciar chamada"
                className={`rounded-full p-2 transition ${
                  isDarkTheme ? "text-blue-400 hover:bg-blue-500/10 hover:text-blue-300" : "text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                }`}
              >
                <Phone className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Buscar na conversa"
                className={`rounded-full p-2 transition ${
                  isDarkTheme ? "text-blue-400 hover:bg-blue-500/10 hover:text-blue-300" : "text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                }`}
              >
                <Search className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Mais opções"
                className={`rounded-full p-2 transition ${
                  isDarkTheme ? "text-blue-400 hover:bg-blue-500/10 hover:text-blue-300" : "text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                }`}
              >
                <MoreVertical className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div
            className="relative flex-1 min-h-0 transition-colors"
            style={wallpaperColor ? { backgroundColor: wallpaperColor } : undefined}
          >
            <div className="absolute inset-0 overflow-y-auto px-4 py-6">
              {pendingJoinToken ? (
                <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">Convite detectado</p>
                      <p className="text-xs text-emerald-100/80">
                        Token: {pendingJoinToken} - Clique para entrar no grupo.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAcceptJoin}
                      className="rounded-full bg-emerald-500/30 px-4 py-1 text-xs font-semibold text-emerald-50 hover:bg-emerald-500/50"
                    >
                      Entrar
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="space-y-4">
                {activeMessages.map((message) => {
                  const isMe = message.author === "me";
                  const showSender = !isMe && activeThread?.tab === "groups";
                  const senderLabel = message.senderName ?? "Participante";
                  const senderColorClass = getSenderColorClass(senderLabel);
                  const bubbleBase = isMe
                    ? "border-blue-500/30 bg-blue-600"
                    : "border-slate-200 bg-white";
                  const bubbleText = isMe ? "text-white" : "text-slate-900";
                  const bubbleTime = isMe ? "text-blue-100" : "text-slate-500";
                  const bubble = (
                    <div className={`max-w-[72%] rounded-2xl border px-4 py-3 ${bubbleBase}`}>
                      {showSender ? (
                        <p className={`text-[11px] font-semibold ${senderColorClass}`}>{senderLabel}</p>
                      ) : null}
                      <p className={`text-sm ${bubbleText}`}>{message.body}</p>
                      <p className={`mt-1 text-[11px] ${bubbleTime}`}>{message.time}</p>
                    </div>
                  );
                  const incomingAvatar = activeThread?.tab === "groups" && activeThread.avatarUrl ? (
                    <img
                      src={activeThread.avatarUrl}
                      alt={`Avatar de ${activeThread.title}`}
                      className="h-9 w-9 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-xs font-semibold text-slate-200">
                      {getAvatarText(activeThread?.title ?? "KN")}
                    </div>
                  );
                  return (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${isMe ? "items-end justify-end" : "items-start justify-start"}`}
                    >
                      {!isMe ? (
                        <>
                          {incomingAvatar}
                          {bubble}
                        </>
                      ) : (
                        bubble
                      )}
                      {isMe ? (
                        <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/20 text-xs font-semibold text-emerald-200">
                          {currentUser?.avatarText ?? "KN"}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="absolute inset-x-4 bottom-4">
              <form
                className="flex flex-wrap items-center gap-2 rounded-2xl bg-[var(--knex-850)]/70 p-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (recordingState === "idle") {
                    handleSendMessage();
                  }
                }}
              >
                <div className="flex min-w-[200px] flex-1 items-center gap-4 rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-within:border-blue-600">
                  <button
                    type="button"
                    aria-label="Adicionar"
                    className="text-3xl leading-none text-slate-600 transition hover:text-slate-900"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    aria-label="Emojis"
                    className="text-slate-600 transition hover:text-slate-900"
                  >
                    <Smile className="h-5 w-5" />
                  </button>
                  <input
                    type="text"
                    value={messageDraft}
                    onChange={(event) => setMessageDraft(event.target.value)}
                    placeholder="Digite uma mensagem"
                    className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none"
                  />
                  {recordingState !== "idle" ? (
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="Cancelar gravação"
                        onClick={() => stopRecording("discard")}
                        className="text-slate-500 transition hover:text-slate-900"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <span className="h-2 w-2 rounded-full bg-rose-500" />
                        {formatDuration(recordingSeconds)}
                      </span>
                      <span className={`knex-record-wave ${recordingState === "paused" ? "is-paused" : ""}`} aria-hidden="true">
                        {Array.from({ length: 14 }).map((_, index) => (
                          <span
                            key={index}
                            className="knex-record-bar"
                            style={{ "--i": 13 - index } as CSSProperties}
                          />
                        ))}
                      </span>
                      <button
                        type="button"
                        aria-label={recordingState === "paused" ? "Retomar gravação" : "Pausar gravação"}
                        onClick={toggleRecordingPause}
                        className="text-slate-500 transition hover:text-slate-900"
                      >
                        {recordingState === "paused" ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                      </button>
                      <Timer className="h-4 w-4 text-slate-400" />
                      <button
                        type="button"
                        aria-label="Enviar áudio"
                        onClick={() => stopRecording("send")}
                        className="rounded-full bg-blue-600 p-2 text-white transition hover:bg-blue-700"
                      >
                        <SendHorizontal className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      aria-label="Gravar áudio"
                      onClick={startRecording}
                      className="ml-auto text-blue-600 transition hover:text-blue-700"
                    >
                      <Mic className="h-5 w-5" />
                    </button>
                  )}
                </div>
                {recordingState === "idle" && messageDraft.trim() ? (
                  <button
                    type="submit"
                    className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    Enviar
                  </button>
                ) : null}
              </form>
            </div>
          </div>
        </section>
          </>
        )}
        </div>
      </div>
    </main>
  );
}

type ActivationScreenProps = {
  headingClassName: string;
  registeringName: string;
  registeringEmail: string;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  activationStep: "email" | "otp";
  otpInput: string;
  otpGenerated: string | null;
  activationError: string | null;
  activationNotice: string | null;
  isSendingOtp: boolean;
  showOtpPreview: boolean;
  onSendCode: () => Promise<void> | void;
  onOtpChange: (value: string) => void;
  onConfirmOtp: () => void;
  onEditEmail: () => void;
};

function ActivationScreen({
  headingClassName,
  registeringName,
  registeringEmail,
  onNameChange,
  onEmailChange,
  activationStep,
  otpInput,
  otpGenerated,
  activationError,
  activationNotice,
  isSendingOtp,
  showOtpPreview,
  onSendCode,
  onOtpChange,
  onConfirmOtp,
  onEditEmail,
}: ActivationScreenProps) {
  // Trilhas/linhas removidas a pedido.

  return (
    <div className="relative w-full min-h-[100svh] overflow-x-hidden overflow-y-auto md:overflow-hidden">
      <div className="relative mx-auto flex min-h-[100svh] w-full max-w-[1400px] flex-col justify-center px-4 py-[clamp(16px,4vh,48px)] box-border md:px-8 lg:px-10">
        <div className="relative z-10 grid w-full items-center gap-8 lg:gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)_minmax(0,1fr)]">
          <div className="relative z-20 order-2 flex w-full justify-center lg:order-1 lg:justify-start" aria-hidden="true">
            <div
              className="pointer-events-none relative w-[clamp(240px,26vw,320px)] aspect-[9/19] overflow-hidden rounded-[clamp(18px,3.6vw,30px)] drop-shadow-[0_30px_80px_rgba(15,23,42,0.18)]"
            >
              <img
                src="https://ead.ufac.br/video/envio/uploads/imagem%20do%20celular_page-0001.png"
                alt="Celular KnexChat"
                className="absolute inset-0 h-full w-full object-cover scale-[1.12]"
              />
            </div>
          </div>

          <div className="order-1 flex justify-center lg:order-2">
            <div className="relative z-30 w-full max-w-lg rounded-3xl border border-slate-200 bg-white/95 p-8 shadow-2xl shadow-black/20 backdrop-blur">
              <div className="text-center">
                <h1 className={`${headingClassName} text-4xl font-semibold md:text-5xl`}>
                  <span className="bg-gradient-to-r from-blue-600 via-sky-500 via-indigo-500 to-cyan-400 bg-clip-text text-transparent">
                    KnexChat
                  </span>
                </h1>
              </div>
              <div className="mt-6 space-y-2 text-left">
                <p className={`${headingClassName} text-lg font-semibold text-slate-900`}>Ativar KnexChat</p>
                <p className="text-sm text-slate-700">
                  Use seu e-mail para criar seu Knex ID (equivalente ao número do WhatsApp).
                </p>
              </div>

              {activationStep === "email" ? (
                <form
                  className="mt-6 space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    onSendCode();
                  }}
                >
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.2em] text-slate-700">NOME</label>
                    <input
                      type="text"
                      value={registeringName}
                      onChange={(event) => onNameChange(event.target.value)}
                      placeholder="Seu nome"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500/60 focus:outline-none"
                      disabled={isSendingOtp}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.2em] text-slate-700">E-MAIL</label>
                    <input
                      type="email"
                      value={registeringEmail}
                      onChange={(event) => onEmailChange(event.target.value)}
                      placeholder="voce@exemplo.com"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500/60 focus:outline-none"
                      disabled={isSendingOtp}
                      required
                    />
                  </div>
                  {showOtpPreview ? (
                    <p className="text-sm text-slate-700">{MOCK_RESEND_WARNING}</p>
                  ) : null}
                  {activationError ? <p className="text-sm text-rose-600">{activationError}</p> : null}
                  <button
                    type="submit"
                    className="mx-auto flex w-fit items-center justify-center rounded-full border border-slate-200 bg-slate-100 px-6 py-2 text-sm font-semibold text-slate-900 transition hover:bg-blue-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isSendingOtp}
                  >
                    {isSendingOtp ? "Enviando..." : "Enviar código"}
                  </button>
                </form>
              ) : (
                <form
                  className="mt-6 space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    onConfirmOtp();
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                    <span>E-mail: {registeringEmail}</span>
                    <button
                      type="button"
                      onClick={onEditEmail}
                      className="text-blue-600 transition hover:text-blue-500"
                    >
                      Editar e-mail
                    </button>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.2em] text-slate-700">Código de 6 dígitos</label>
                    <input
                      type="text"
                      value={otpInput}
                      onChange={(event) => onOtpChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-center text-lg tracking-[0.3em] text-slate-900 placeholder:text-slate-400 focus:border-blue-500/60 focus:outline-none"
                      disabled={isSendingOtp}
                    />
                  </div>
                  {activationNotice ? <p className="text-sm text-slate-700">{activationNotice}</p> : null}
                  {showOtpPreview && otpGenerated ? (
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs text-slate-700">
                      Código (debug): <span className="font-semibold text-slate-900">{otpGenerated}</span>
                    </div>
                  ) : null}
                  {activationError ? <p className="text-sm text-rose-600">{activationError}</p> : null}
                  <button
                    type="submit"
                    className="mx-auto flex w-fit items-center justify-center rounded-full border border-slate-200 bg-slate-100 px-6 py-2 text-sm font-semibold text-slate-900 transition hover:bg-blue-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isSendingOtp}
                  >
                    Confirmar
                  </button>
                  <button
                    type="button"
                    onClick={onSendCode}
                    className="mx-auto flex w-fit items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-2 text-xs font-semibold text-slate-700 transition hover:bg-blue-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isSendingOtp}
                  >
                    {isSendingOtp ? "Enviando..." : "Enviar novo código"}
                  </button>
                </form>
              )}
            </div>
          </div>

          <div
            className="relative z-20 order-3 flex w-full justify-center lg:order-3 lg:justify-end"
            aria-hidden="true"
          >
            <div
              className="pointer-events-none relative w-[clamp(320px,44vw,560px)] max-w-full drop-shadow-[0_30px_90px_rgba(15,23,42,0.18)]"
            >
              <img
                src="https://ead.ufac.br/video/envio/uploads/iamgem%20do%20laptop.png"
                alt="Laptop KnexChat"
                className="h-auto w-full object-contain"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
