"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  CircleDot,
  HelpCircle,
  Keyboard,
  LogOut,
  MessageCircle,
  MessageSquare,
  Phone,
  Search,
  Settings,
  Shield,
  SlidersHorizontal,
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
          Link da reuniao: knexchat.app/join
        </div>
        <div className={`ml-auto w-[58%] rounded-2xl bg-blue-500/20 ${textBase} text-blue-700 px-3 py-2`}>
          Agenda confirmada.
        </div>
        <div className={`w-[70%] rounded-2xl bg-slate-200 ${textBase} text-slate-700 px-3 py-2`}>
          Encontros semanais as 18h.
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

function KnexChatFlowOverlay() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-0 hidden lg:block"
      viewBox="0 0 1200 700"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <path id="knex-flow-top" d="M240 120 C 420 30 780 30 960 120" />
        <path id="knex-flow-bottom" d="M1000 300 L 1000 520 L 180 520 L 180 360" />
        <clipPath id="knex-avatar-clip" clipPathUnits="objectBoundingBox">
          <circle cx="0.5" cy="0.5" r="0.5" />
        </clipPath>
        <filter id="knex-avatar-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="rgba(15,23,42,0.25)" />
        </filter>
      </defs>

      <path
        d="M240 120 C 420 30 780 30 960 120"
        fill="none"
        stroke="rgba(59,130,246,0.35)"
        strokeWidth="1.6"
        strokeDasharray="4 12"
        strokeLinecap="round"
      >
        <animate attributeName="stroke-dashoffset" from="0" to="-120" dur="8s" repeatCount="indefinite" />
      </path>
      <path
        d="M1000 300 L 1000 520 L 180 520 L 180 360"
        fill="none"
        stroke="rgba(59,130,246,0.3)"
        strokeWidth="1.6"
        strokeDasharray="4 12"
        strokeLinecap="round"
      >
        <animate attributeName="stroke-dashoffset" from="0" to="120" dur="9s" repeatCount="indefinite" />
      </path>

      {[0, 3.5, 7].map((start) => (
        <g key={`arrow-top-${start}`}>
          <path d="M0 0 L10 4 L0 8 L3 4 Z" fill="rgba(59,130,246,0.55)" />
          <animateMotion dur="10s" repeatCount="indefinite" begin={`${start}s`} rotate="auto">
            <mpath href="#knex-flow-top" />
          </animateMotion>
        </g>
      ))}
      {[1.5, 5, 8.5].map((start) => (
        <g key={`arrow-bottom-${start}`}>
          <path d="M0 0 L10 4 L0 8 L3 4 Z" fill="rgba(59,130,246,0.45)" />
          <animateMotion dur="11s" repeatCount="indefinite" begin={`${start}s`} rotate="auto">
            <mpath href="#knex-flow-bottom" />
          </animateMotion>
        </g>
      ))}

      {[
        { img: "https://i.pravatar.cc/120?img=12", begin: "0s", path: "#knex-flow-top" },
        { img: "https://i.pravatar.cc/120?img=32", begin: "4s", path: "#knex-flow-top" },
        { img: "https://i.pravatar.cc/120?img=8", begin: "8s", path: "#knex-flow-top" },
      ].map((item) => (
        <g key={item.img} filter="url(#knex-avatar-shadow)">
          <image
            href={item.img}
            width="40"
            height="40"
            clipPath="url(#knex-avatar-clip)"
            preserveAspectRatio="xMidYMid slice"
          />
          <circle cx="20" cy="20" r="20" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1" />
          <animateMotion dur="14s" repeatCount="indefinite" begin={item.begin} rotate="0">
            <mpath href={item.path} />
          </animateMotion>
        </g>
      ))}
      {[
        { img: "https://i.pravatar.cc/120?img=45", begin: "1s", path: "#knex-flow-bottom" },
        { img: "https://i.pravatar.cc/120?img=5", begin: "5s", path: "#knex-flow-bottom" },
        { img: "https://i.pravatar.cc/120?img=18", begin: "9s", path: "#knex-flow-bottom" },
      ].map((item) => (
        <g key={item.img} filter="url(#knex-avatar-shadow)">
          <image
            href={item.img}
            width="40"
            height="40"
            clipPath="url(#knex-avatar-clip)"
            preserveAspectRatio="xMidYMid slice"
          />
          <circle cx="20" cy="20" r="20" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1" />
          <animateMotion dur="15s" repeatCount="indefinite" begin={item.begin} rotate="0">
            <mpath href={item.path} />
          </animateMotion>
        </g>
      ))}
    </svg>
  );
}

function KnexChatGlowBackdrop() {
  return (
    <>
      <div className="pointer-events-none absolute -top-[140px] -left-[140px] z-0 h-[720px] w-[720px] rounded-full bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.26)_0%,transparent_70%)] blur-[90px] opacity-60" />
      <div className="pointer-events-none absolute -bottom-[180px] -right-[180px] z-0 h-[820px] w-[820px] rounded-full bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.24)_0%,transparent_70%)] blur-[90px] opacity-60" />
      <div className="pointer-events-none absolute -top-[120px] -right-[200px] z-0 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.2)_0%,transparent_70%)] blur-[90px] opacity-50" />
      <div className="pointer-events-none absolute -bottom-[160px] -left-[200px] z-0 h-[640px] w-[640px] rounded-full bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.2)_0%,transparent_70%)] blur-[90px] opacity-50" />
      <KnexChatFlowOverlay />
      <div className="pointer-events-none absolute left-6 top-10 z-0 hidden lg:block">
        <div className="relative h-[600px] w-[320px] drop-shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
          <div className="absolute inset-0 rounded-[54px] bg-slate-900 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.9)]" />
          <div className="absolute inset-[6px] overflow-hidden rounded-[46px] bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <KnexChatScreen variant="phone" />
          </div>
          <div className="absolute top-5 left-1/2 h-2 w-20 -translate-x-1/2 rounded-full bg-slate-800/70" />
        </div>
      </div>

      <div className="pointer-events-none absolute right-6 top-14 z-0 hidden lg:block">
        <div className="relative h-[456px] w-[520px] drop-shadow-[0_30px_90px_rgba(15,23,42,0.18)]">
          <div className="flex h-full w-full flex-col">
            <div className="relative flex-1 rounded-t-[20px] border border-slate-200/80 bg-slate-900 shadow-[0_30px_100px_rgba(15,23,42,0.12)]">
              <div className="absolute inset-2 overflow-hidden rounded-[16px] bg-white">
                <KnexChatScreen variant="laptop" />
              </div>
            </div>
            <div className="relative h-40 w-full rounded-[0_0_28px_28px] bg-slate-200 shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
              <div className="absolute inset-x-6 top-3 text-[9px] text-slate-500/80">
                <div className="grid grid-cols-12 gap-1">
                  {"QWERTYUIOP[]".split("").map((key) => (
                    <div key={key} className="rounded-sm bg-white/70 px-1 py-0.5 text-center">
                      {key}
                    </div>
                  ))}
                </div>
                <div className="mt-1 grid grid-cols-11 gap-1 px-1">
                  {"ASDFGHJKL;".split("").map((key) => (
                    <div key={key} className="rounded-sm bg-white/70 px-1 py-0.5 text-center">
                      {key}
                    </div>
                  ))}
                  <div className="rounded-sm bg-white/70 px-1 py-0.5 text-center">Enter</div>
                </div>
                <div className="mt-1 grid grid-cols-12 gap-1">
                  <div className="col-span-2 rounded-sm bg-white/70 px-1 py-0.5 text-center">Shift</div>
                  {"ZXCVBNM,.".split("").map((key) => (
                    <div key={key} className="rounded-sm bg-white/70 px-1 py-0.5 text-center">
                      {key}
                    </div>
                  ))}
                  <div className="col-span-2 rounded-sm bg-white/70 px-1 py-0.5 text-center">Shift</div>
                </div>
                <div className="mt-1 grid grid-cols-12 gap-1">
                  <div className="col-span-2 rounded-sm bg-white/70 px-1 py-0.5 text-center">Ctrl</div>
                  <div className="col-span-2 rounded-sm bg-white/70 px-1 py-0.5 text-center">Alt</div>
                  <div className="col-span-4 rounded-sm bg-white/70 px-1 py-0.5 text-center">space</div>
                  <div className="col-span-2 rounded-sm bg-white/70 px-1 py-0.5 text-center">Alt</div>
                  <div className="col-span-2 rounded-sm bg-white/70 px-1 py-0.5 text-center">Ctrl</div>
                </div>
              </div>
              <div className="absolute bottom-2 left-1/2 h-5 w-32 -translate-x-1/2 rounded-md bg-slate-300" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

type Identity = {
  userId: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  deviceId: string;
};

type TabKey = "conversations" | "groups" | "contacts";
type FilterKey = "all" | "unread" | "groups";

type Thread = {
  id: string;
  title: string;
  preview: string;
  lastActivity: string;
  unread?: number;
  tab: TabKey;
};

type Message = {
  id: string;
  author: "me" | "them";
  body: string;
  time: string;
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Tudo" },
  { key: "unread", label: "Nao lidas" },
  { key: "groups", label: "Grupos" },
];

const INITIAL_CONVERSATIONS: Thread[] = [
  {
    id: "conv-geral",
    title: "Geral",
    preview: "Checklist do sprint fechado.",
    lastActivity: "Agora",
    unread: 2,
    tab: "conversations",
  },
  {
    id: "conv-orientacao",
    title: "Orientacao de TCC",
    preview: "Revisao enviada para voce.",
    lastActivity: "09:40",
    tab: "conversations",
  },
  {
    id: "conv-projeto",
    title: "Projeto KnexIt",
    preview: "Vamos alinhar os canais.",
    lastActivity: "Ontem",
    tab: "conversations",
  },
];

const INITIAL_GROUPS: Thread[] = [
  {
    id: "grp-lab-ia",
    title: "Lab IA",
    preview: "Nova pauta adicionada.",
    lastActivity: "08:10",
    unread: 1,
    tab: "groups",
  },
  {
    id: "grp-turma-2025",
    title: "Turma 2025",
    preview: "Bem-vindos!",
    lastActivity: "Ontem",
    tab: "groups",
  },
];

const INITIAL_CONTACTS: Thread[] = [
  {
    id: "ctt-luiza",
    title: "Luiza Costa",
    preview: "Online agora",
    lastActivity: "Ativo",
    tab: "contacts",
  },
  {
    id: "ctt-vitor",
    title: "Mentor Vitor",
    preview: "Disponivel ate 18h",
    lastActivity: "Ativo",
    tab: "contacts",
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
    description: "Notificacoes de seguranca, dados da conta",
    icon: User,
  },
  {
    key: "privacy",
    label: "Privacidade",
    description: "Contatos bloqueados, mensagens temporarias",
    icon: Shield,
  },
  {
    key: "chats",
    label: "Conversas",
    description: "Tema, papel de parede, configuracoes de conversas",
    icon: MessageSquare,
  },
  {
    key: "media",
    label: "Video e voz",
    description: "Camera, microfone e alto-falantes",
    icon: Video,
  },
  {
    key: "notifications",
    label: "Notificacoes",
    description: "Notificacoes de mensagens",
    icon: Bell,
  },
  {
    key: "shortcuts",
    label: "Atalhos do teclado",
    description: "Acoes rapidas",
    icon: Keyboard,
  },
  {
    key: "help",
    label: "Ajuda e feedback",
    description: "Central de Ajuda, fale conosco, Politica de Privacidade",
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
    { id: "m1", author: "them", body: "Revisou o capitulo 2?", time: "09:03" },
    { id: "m2", author: "me", body: "Sim, ajustei a metodologia.", time: "09:06" },
    { id: "m3", author: "them", body: "Vamos marcar uma call.", time: "09:08" },
  ],
  "conv-projeto": [
    { id: "m1", author: "them", body: "Preciso do status do onboarding.", time: "Ontem" },
    { id: "m2", author: "me", body: "Em andamento, falta revisar o fluxo.", time: "Ontem" },
  ],
  "grp-lab-ia": [
    { id: "m1", author: "them", body: "Reuniao hoje as 14h.", time: "08:05" },
    { id: "m2", author: "me", body: "Confirmado. Levo o prototipo.", time: "08:07" },
  ],
  "grp-turma-2025": [
    { id: "m1", author: "them", body: "Boas-vindas! Agenda liberada.", time: "Ontem" },
    { id: "m2", author: "me", body: "Obrigado! Ja conferi o cronograma.", time: "Ontem" },
  ],
  "ctt-luiza": [
    { id: "m1", author: "them", body: "Pode revisar o material do evento?", time: "08:50" },
    { id: "m2", author: "me", body: "Sim, mando ainda hoje.", time: "08:52" },
  ],
  "ctt-vitor": [
    { id: "m1", author: "them", body: "Quer discutir a proposta de pesquisa?", time: "Ontem" },
    { id: "m2", author: "me", body: "Claro, estou livre amanha.", time: "Ontem" },
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

function isIdentity(value: unknown): value is Identity {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.userId === "string" &&
    typeof record.email === "string" &&
    typeof record.emailVerified === "boolean" &&
    typeof record.createdAt === "string" &&
    typeof record.deviceId === "string"
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
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const currentUser = useMemo(() => {
    if (!identity) return null;
    return {
      id: "u1",
      name: "Participante",
      role: "student",
      email: identity.email,
      avatarText: getAvatarText(identity.email.split("@")[0] ?? identity.email),
    };
  }, [identity]);

  const combinedThreads = useMemo(() => [...conversations, ...groups], [conversations, groups]);
  const activeThreads = useMemo(() => {
    if (activeFilter === "groups") return groups;
    if (activeFilter === "unread") return combinedThreads.filter((thread) => thread.unread);
    return combinedThreads;
  }, [activeFilter, combinedThreads, groups]);
  const activeThread = useMemo(() => {
    const allThreads = [...conversations, ...groups, ...contacts];
    return allThreads.find((thread) => thread.id === activeThreadId) ?? activeThreads[0] ?? null;
  }, [activeThreadId, conversations, groups, contacts, activeThreads]);

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
    const normalized = normalizeEmail(registeringEmail);
    if (!normalized || !isValidEmail(normalized)) {
      setActivationError("Informe um e-mail valido.");
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
        const message = typeof payload?.message === "string" ? payload.message : "Falha ao enviar codigo.";
        throw new Error(message);
      }
      setOtpGenerated(generated);
      setOtpInput("");
      setActivationError(null);
      setActivationNotice("Codigo enviado para seu e-mail.");
      setActivationStep("otp");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao enviar codigo.";
      setActivationError(message);
      setActivationNotice(null);
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleConfirmOtp = () => {
    if (!otpGenerated || otpInput.trim() !== otpGenerated) {
      setActivationError("Codigo invalido");
      return;
    }
    const normalized = normalizeEmail(registeringEmail);
    const nextIdentity: Identity = {
      userId: "u1",
      email: normalized,
      emailVerified: true,
      deviceId: `dev_${Math.random().toString(16).slice(2)}`,
      createdAt: new Date().toISOString(),
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

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice.catch(() => null);
    setInstallPrompt(null);
  };

  const navButtonClass = (active: boolean) =>
    `grid h-11 w-11 place-items-center rounded-2xl transition ${
      active
        ? "bg-slate-100 text-slate-900 shadow-[0_12px_24px_rgba(15,23,42,0.18)]"
        : "text-slate-900 hover:bg-slate-100"
    }`;

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
        className={`${manrope.className} relative min-h-screen bg-white overflow-hidden text-slate-900`}
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
          className={`${manrope.className} relative min-h-screen bg-white overflow-hidden text-slate-900`}
        >
          <div className="relative z-10 flex min-h-screen items-center justify-center">
            <div className="text-sm text-slate-400">Redirecionando para ativacao...</div>
          </div>
        </main>
      );
    }
    return (
      <main className={`${manrope.className} relative min-h-screen bg-white overflow-hidden text-slate-900`}>
        {activationBackdrop}
        <div className="relative z-10">
          <ActivationScreen
            headingClassName={spaceGrotesk.className}
            registeringEmail={registeringEmail}
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
        className={`${manrope.className} relative min-h-screen bg-white overflow-hidden text-slate-900`}
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
      className={`${manrope.className} relative h-screen overflow-hidden bg-white text-slate-100`}
    >
      <div className="relative z-10 flex h-full flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--knex-700)] bg-[var(--knex-850)]/80 px-4 py-3 backdrop-blur">
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
            <p className="text-xs text-slate-900">Mensageria com Knex ID por e-mail</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-blue-300/70 bg-blue-200/80 px-3 py-1 text-xs text-slate-900">
            Knex ID: {identity.email}
          </span>
          {!isInstalled ? (
            <button
              type="button"
              onClick={handleInstallApp}
              className="rounded-full border border-blue-300/70 bg-blue-200/90 px-3 py-1 text-xs font-semibold text-slate-900 transition hover:border-blue-300/90 hover:bg-blue-300/90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!installPrompt}
              title={installPrompt ? "Instalar Knexchat" : "Instalacao indisponivel no momento"}
            >
              Instalar
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full border border-rose-300/70 bg-rose-200/90 px-3 py-1 text-xs font-semibold text-slate-900 transition hover:border-rose-300/90 hover:bg-rose-300/90"
          >
            Sair
          </button>
        </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <nav className="hidden w-16 flex-col items-center gap-4 border-r border-[var(--knex-700)] bg-[var(--knex-900)]/90 py-5 lg:flex">
          <div className="relative">
            <button type="button" className={navButtonClass(!isSettingsOpen)} onClick={() => setIsSettingsOpen(false)}>
              <MessageCircle className="h-5 w-5" />
            </button>
            <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-emerald-400 text-[10px] font-semibold text-slate-900">
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
            <div className="h-px w-8 bg-[var(--knex-700)]" />
            <button type="button" className={navButtonClass(isSettingsOpen)} onClick={() => setIsSettingsOpen(true)}>
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </nav>
        {isSettingsOpen ? (
          <>
            <aside className="flex w-full flex-col border-b border-slate-200 bg-white text-slate-900 lg:w-[360px] lg:border-b-0 lg:border-r">
              <div className="border-b border-slate-200 px-6 py-4">
                <h2 className="text-xl font-semibold">Configuracoes</h2>
                <div className="mt-2 flex items-center gap-2 rounded-full border border-emerald-400/70 bg-white px-3 py-2 text-sm text-slate-500 shadow-sm">
                  <Search className="h-4 w-4 text-emerald-500" />
                  <span>Pesquisar configuracoes</span>
                </div>
              </div>
              <div className="border-b border-slate-200 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                    {getAvatarText(currentUser?.name ?? "KN")}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{currentUser?.name ?? "Participante"}</p>
                    <p className="text-xs text-slate-600">{currentUser?.email}</p>
                    <p className="text-[11px] text-slate-500">"Onde ha igualdade, a amizade nao perde."</p>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3">
                <div className="space-y-1">
                  {SETTINGS_MENU.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        className="flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-slate-100"
                      >
                        <div className="grid h-9 w-9 place-items-center rounded-2xl bg-slate-100 text-slate-600">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                          <p className="text-xs text-slate-500">{item.description}</p>
                        </div>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-2 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-rose-600 transition hover:bg-rose-50"
                  >
                    <div className="grid h-9 w-9 place-items-center rounded-2xl bg-rose-100 text-rose-500">
                      <LogOut className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Desconectar</p>
                    </div>
                  </button>
                </div>
              </div>
            </aside>
            <section className="flex min-h-0 flex-1 items-center justify-center bg-slate-50">
              <div className="text-center">
                <Settings className="mx-auto h-16 w-16 text-slate-300" />
                <p className="mt-4 text-2xl font-semibold text-slate-700">Configuracoes</p>
              </div>
            </section>
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
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((filter) => {
                const isActive = filter.key === activeFilter;
                return (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setActiveFilter(filter.key)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      isActive
                        ? "bg-emerald-500/30 text-emerald-100"
                        : "border border-[var(--knex-700)] text-slate-300 hover:border-emerald-400/50 hover:text-emerald-100"
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
                      isActive
                        ? "border-emerald-500/40 bg-emerald-500/10"
                        : "border-transparent bg-slate-900/40 hover:border-slate-700/70"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold">{thread.title}</p>
                      <p className="text-xs text-slate-300">{thread.preview}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-[11px] text-slate-300">{thread.lastActivity}</span>
                      {thread.unread ? (
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
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
              <p className={`${spaceGrotesk.className} text-lg font-semibold`}>
                {activeThread?.title ?? "Selecione uma conversa"}
              </p>
              <p className="text-xs text-slate-300">{activeThread?.preview ?? "Aguardando thread..."}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <span className="rounded-full border border-[var(--knex-700)] px-3 py-1">
                {activeThread?.tab === "groups"
                  ? "Grupo ativo"
                  : activeThread?.tab === "contacts"
                    ? "Contato direto"
                    : "Conversa direta"}
              </span>
            </div>
          </div>

          {pendingJoinToken ? (
            <div className="mx-4 mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
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

          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="space-y-4">
              {activeMessages.map((message) => {
                const isMe = message.author === "me";
                const bubbleBase = isMe
                  ? "border-emerald-500/30 bg-emerald-500/10"
                  : "border-slate-800/80 bg-slate-900/70";
                return (
                  <div
                    key={message.id}
                    className={`flex items-end gap-3 ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    {!isMe ? (
                      <div className="grid h-9 w-9 place-items-center rounded-2xl bg-slate-900 text-xs font-semibold text-slate-200">
                        {getAvatarText(activeThread?.title ?? "KN")}
                      </div>
                    ) : null}
                    <div className={`max-w-[72%] rounded-2xl border px-4 py-3 ${bubbleBase}`}>
                      <p className="text-sm text-slate-100">{message.body}</p>
                      <p className="mt-1 text-[11px] text-slate-300">{message.time}</p>
                    </div>
                    {isMe ? (
                      <div className="grid h-9 w-9 place-items-center rounded-2xl bg-emerald-500/20 text-xs font-semibold text-emerald-200">
                        {currentUser?.avatarText ?? "KN"}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-[var(--knex-700)] bg-[var(--knex-850)]/70 px-4 py-4">
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                handleSendMessage();
              }}
            >
              <input
                type="text"
                value={messageDraft}
                onChange={(event) => setMessageDraft(event.target.value)}
                placeholder="Digite uma mensagem..."
                className="min-w-[200px] flex-1 rounded-2xl border border-[var(--knex-700)] bg-[var(--knex-900)] px-4 py-3 text-sm text-slate-100 placeholder:text-slate-400 focus:border-emerald-500/60 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-2xl bg-emerald-500/20 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/30"
              >
                Enviar
              </button>
            </form>
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
  registeringEmail: string;
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
  registeringEmail,
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
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center px-6 py-12">
      <div className="relative z-10 w-full max-w-lg rounded-3xl border border-slate-200 bg-white/95 p-8 shadow-2xl shadow-black/20 backdrop-blur">
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
            Use seu e-mail para criar seu Knex ID (equivalente ao numero do WhatsApp).
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
              {isSendingOtp ? "Enviando..." : "Enviar codigo"}
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
              <label className="text-xs uppercase tracking-[0.2em] text-slate-700">Codigo de 6 digitos</label>
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
                Codigo (debug): <span className="font-semibold text-slate-900">{otpGenerated}</span>
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
              {isSendingOtp ? "Enviando..." : "Enviar novo codigo"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
