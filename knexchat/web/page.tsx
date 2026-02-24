"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Roboto } from "next/font/google";
import {
  Archive,
  Bell,
  BellOff,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Copy,
  X,
  XCircle,
  CalendarDays,
  Camera,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Download,
  CreditCard,
  Flag,
  FileText,
  Globe,
  HelpCircle,
  Headphones,
  Hash,
  Radio,
  ScanLine,
  Shapes,
  Image as ImageIcon,
  Keyboard,
  Lock,
  LogOut,
  LayoutGrid,
  MessageCirclePlus,
  AtSign,
  Mail,
  MessageCircle,
  MessageSquare,
  MoreVertical,
  Menu,
  Plus,
  FolderOpen,
  Smartphone,
  Star,
  Users2,
  Pause,
  Phone,
  Play,
  Pin,
  Reply,
  SendHorizontal,
  Share2,
  Paperclip,
  UserPlus,
  Mic,
  Square,
  Search,
  Settings,
  Shield,
  SlidersHorizontal,
  Smile,
  Timer,
  Trash,
  Trash2,
  User,
  Users,
  Video,
  Pencil,
  Link2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import type { CSSProperties, ReactNode } from "react";
import { identitySupabase as createIdentitySupabase } from "@/lib/identitySupabaseClient";
import {
  consumeKnexchatProfileSeed,
  getKnexchatProfileSeedKey,
  writeKnexchatProfileSeed,
} from "@/lib/knexchat/profileSeed";

type MasterDetailProps = {
  showDetail: boolean;
  master: ReactNode;
  detail: ReactNode;
  className?: string;
};

function MasterDetail({ showDetail, master, detail, className = "" }: MasterDetailProps) {
  return (
    <div className={`flex min-h-0 flex-1 overflow-hidden ${className}`.trim()}>
      <div className={`${showDetail ? "hidden md:flex" : "flex"} min-h-0 w-full flex-col md:w-auto md:min-w-0`}>
        {master}
      </div>
      <div className={`${showDetail ? "flex" : "hidden md:flex"} min-h-0 flex-1 flex-col`}>{detail}</div>
    </div>
  );
}

type SkeletonProps = {
  className?: string;
};

function Skeleton({ className = "" }: SkeletonProps) {
  return <div className={`animate-pulse rounded-md bg-slate-200/80 ${className}`.trim()} />;
}

type DebugUiSnapshot = {
  viewport: string;
  visualViewport: string;
  rootFontSize: string;
  route: string;
  env: string;
  userAgent: string;
};

const STORAGE_KEY = "knexchat.identity";
const CHAT_STATE_KEY = "knexchat.state.v2";
const CHAT_UI_STATE_KEY = "knexchat.ui.v2";
const DIRECTORY_KEY = "knexchat.directory.v2";
const INBOX_KEY = "knexchat.inbox.v2";
const LEGACY_CHAT_STATE_KEY = "knexchat.state.v1";
const LEGACY_CHAT_UI_STATE_KEY = "knexchat.ui.v1";
const LEGACY_DIRECTORY_KEY = "knexchat.directory.v1";
const LEGACY_INBOX_KEY = "knexchat.inbox.v1";
const KNEXCHAT_FONT_FAMILY = "'Roboto', 'Helvetica Neue', Arial, sans-serif";
const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  fallback: ["Helvetica Neue", "Arial", "sans-serif"],
});
const KNEXCHAT_FONT_CLASS = roboto.className;
const TOP_MENU_CAROUSEL_ITEMS = [
  "Música",
  "Mixes",
  "Aeronaves militares",
  "Ao vivo",
  "Caminhões",
  "Sátira",
  "Suspenses",
  "Sedã",
  "Tiro prático",
  "Ao vivo",
  "Telefones",
  "Computadores",
  "Máquinas",
  "Animação",
  "Enviados recentemente",
  "Aventura",
];
const supabase = createIdentitySupabase();

function buildKnexchatWebHref(searchQuery: string, threadId: string | null): string {
  const params = new URLSearchParams(searchQuery);
  if (threadId && threadId.trim()) {
    params.set("thread", threadId);
  } else {
    params.delete("thread");
  }
  const nextQuery = params.toString();
  return nextQuery ? `/knexchat/web?${nextQuery}` : "/knexchat/web";
}

function KnexChatMotionStyles() {
  return (
    <style>{`
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
      @keyframes knex-sheet-up {
        0% {
          transform: translate3d(0, 24px, 0);
          opacity: 0;
        }
        100% {
          transform: translate3d(0, 0, 0);
          opacity: 1;
        }
      }
      .knex-sheet-up {
        animation: knex-sheet-up 180ms ease-out;
      }
      .knex-bubble {
        display: inline-flex;
        flex-direction: column;
        max-width: 75%;
        width: fit-content;
        padding: 10px 14px;
        border-radius: 18px;
        line-height: 1.35;
        word-break: break-word;
        font-family: inherit;
        box-shadow: 0 1px 1px rgba(0, 0, 0, 0.08);
        position: relative;
      }
      .knex-bubble--in {
        align-self: flex-start;
        margin-right: auto;
        background: #ffffff;
        color: #1f1f1f;
        border-radius: 4px 18px 18px 18px;
      }
      .knex-bubble--out {
        align-self: flex-end;
        margin-left: auto;
        background: #0b5ed7;
        color: #ffffff;
        text-shadow: 0 0 0.55px rgba(8, 33, 78, 0.88);
        border-radius: 18px 4px 18px 18px;
      }
      .knex-bubble__text {
        font-size: 14px;
      }
      .knex-bubble--media {
        --knex-media-outer-radius: 10px;
        --knex-media-inset: 3px;
        --knex-media-inner-radius: calc(var(--knex-media-outer-radius) - var(--knex-media-inset));
        padding: var(--knex-media-inset);
      }
      .knex-bubble--out.knex-bubble--media {
        border-radius: var(--knex-media-outer-radius);
      }
      .knex-bubble--in.knex-bubble--media {
        border-radius: var(--knex-media-outer-radius);
      }
      .knex-bubble__media {
        width: clamp(140px, 55vw, 240px);
        max-width: 100%;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .knex-bubble__media-trigger {
        border-radius: var(--knex-media-inner-radius);
      }
      .knex-bubble__image {
        width: 100%;
        height: auto;
        max-height: min(56vh, 360px);
        border-radius: var(--knex-media-inner-radius);
        display: block;
        object-fit: contain;
        image-orientation: from-image;
        background: rgba(15, 23, 42, 0.08);
      }
      .knex-bubble__time {
        font-size: 11px;
        margin-top: 4px;
        align-self: flex-end;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
      }
      .knex-bubble--in .knex-bubble__time {
        color: #8a8a8a;
      }
      .knex-bubble--out .knex-bubble__time {
        color: rgba(255, 255, 255, 0.75);
      }
    `}</style>
  );
}

type ScreenVariant = "phone" | "laptop";

type ActivationLayout = {
  scale: number;
  stageWidth: number;
  stageHeight: number;
  phoneLeft: number;
  laptopLeft: number;
  topStartX: number;
  topEndX: number;
  bottomStartX: number;
  bottomEndX: number;
};

const STAGE_WIDTH = 2200;
const STAGE_HEIGHT = 700;
const PHONE_WIDTH = 320;
const LAPTOP_WIDTH = 520;
const CARD_MAX_WIDTH = 512;
const FLOW_TOP_START_OFFSET = 110;
const FLOW_TOP_END_OFFSET = 274;
const FLOW_BOTTOM_END_OFFSET = 43;

function clampValue(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function computeActivationLayout(viewportWidth: number, viewportHeight: number): ActivationLayout {
  const safeWidth = Math.max(viewportWidth, 1);
  const safeHeight = Math.max(viewportHeight, 1);
  const scale = Math.min(1, safeWidth / STAGE_WIDTH, safeHeight / STAGE_HEIGHT);
  const horizontalPadding = safeWidth >= 640 ? 48 : 32;
  const cardWidth = Math.min(CARD_MAX_WIDTH, Math.max(0, safeWidth - horizontalPadding));
  const cardWidthStage = cardWidth / scale;
  const desiredGap = clampValue(safeWidth * 0.08, 96, 200);
  const gapStage = desiredGap / scale;
  const cardLeft = (STAGE_WIDTH - cardWidthStage) / 2;
  const maxGapStage = Math.max(0, cardLeft - LAPTOP_WIDTH);
  const safeGapStage = Math.min(gapStage, maxGapStage);

  const phoneLeft = clampValue(cardLeft - safeGapStage - PHONE_WIDTH, 0, STAGE_WIDTH - PHONE_WIDTH);
  const laptopLeft = clampValue(cardLeft + cardWidthStage + safeGapStage, 0, STAGE_WIDTH - LAPTOP_WIDTH);

  const topStartX = phoneLeft + FLOW_TOP_START_OFFSET;
  const topEndX = laptopLeft + FLOW_TOP_END_OFFSET;
  const bottomStartX = topEndX;
  const bottomEndX = phoneLeft + FLOW_BOTTOM_END_OFFSET;

  return {
    scale,
    stageWidth: STAGE_WIDTH,
    stageHeight: STAGE_HEIGHT,
    phoneLeft,
    laptopLeft,
    topStartX,
    topEndX,
    bottomStartX,
    bottomEndX,
  };
}

type SimpleEmojiPickerProps = {
  width?: number;
  height?: number;
  onEmojiClick: (emoji: string) => void;
  isDark?: boolean;
};

const SIMPLE_EMOJI_SET = [
  "😀",
  "😅",
  "😍",
  "🤝",
  "🎉",
  "🔥",
  "✨",
  "✅",
  "📌",
  "💬",
  "🚀",
  "📣",
  "👋",
  "🙏",
  "💡",
  "🧠",
  "⚡",
  "❤️",
  "👍",
  "👏",
  "🙌",
  "🎯",
  "📎",
  "🔒",
];

function SimpleEmojiPicker({ width, height, onEmojiClick, isDark }: SimpleEmojiPickerProps) {
  return (
    <div
      className={`h-full w-full overflow-y-auto p-3 ${isDark ? "bg-[#1b1b1b]" : "bg-white"}`}
      style={{ width, height }}
    >
      <div className="grid grid-cols-8 gap-2 text-lg">
        {SIMPLE_EMOJI_SET.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
              isDark ? "hover:bg-white/10" : "hover:bg-slate-100"
            }`}
            onClick={() => onEmojiClick(emoji)}
            aria-label={`Selecionar ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

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
          <span className="bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 bg-clip-text text-transparent">
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
        <span>Digitando: &quot;Vamos alinhar?&quot;</span>
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

function KnexChatFlowOverlay({ layout }: { layout: ActivationLayout }) {
  const topSpan = layout.topEndX - layout.topStartX;
  const topCtrlOffset = topSpan / 4;
  const topPath = `M${layout.topStartX} 120 C ${layout.topStartX + topCtrlOffset} 30 ${
    layout.topEndX - topCtrlOffset
  } 30 ${layout.topEndX} 120`;
  const bottomPath = `M${layout.bottomStartX} 300 L ${layout.bottomStartX} 520 L ${layout.bottomEndX} 520 L ${layout.bottomEndX} 360`;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-0 hidden lg:block"
      viewBox={`0 0 ${layout.stageWidth} ${layout.stageHeight}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <path id="knex-flow-top" d={topPath} />
        <path id="knex-flow-bottom" d={bottomPath} />
        <clipPath id="knex-avatar-clip" clipPathUnits="objectBoundingBox">
          <circle cx="0.5" cy="0.5" r="0.5" />
        </clipPath>
        <filter id="knex-avatar-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="rgba(15,23,42,0.25)" />
        </filter>
      </defs>

      <path
        d={topPath}
        fill="none"
        stroke="rgba(59,130,246,0.35)"
        strokeWidth="1.6"
        strokeDasharray="4 12"
        strokeLinecap="round"
      >
        <animate attributeName="stroke-dashoffset" from="0" to="-120" dur="8s" repeatCount="indefinite" />
      </path>
      <path
        d={bottomPath}
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

function KnexChatGlowBackdrop({ layout }: { layout: ActivationLayout }) {
  const stageStyle = {
    transform: `translateZ(0) scale(${layout.scale})`,
    transformOrigin: "center",
  } as CSSProperties;
  return (
    <>
      <div className="pointer-events-none absolute -top-[140px] -left-[140px] z-0 h-[720px] w-[720px] rounded-full bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.26)_0%,transparent_70%)] blur-[90px] opacity-60" />
      <div className="pointer-events-none absolute -bottom-[180px] -right-[180px] z-0 h-[820px] w-[820px] rounded-full bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.24)_0%,transparent_70%)] blur-[90px] opacity-60" />
      <div className="pointer-events-none absolute -top-[120px] -right-[200px] z-0 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.2)_0%,transparent_70%)] blur-[90px] opacity-50" />
      <div className="pointer-events-none absolute -bottom-[160px] -left-[200px] z-0 h-[640px] w-[640px] rounded-full bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.2)_0%,transparent_70%)] blur-[90px] opacity-50" />
      <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
        <div className="relative" style={{ width: layout.stageWidth, height: layout.stageHeight, ...stageStyle }}>
          <KnexChatFlowOverlay layout={layout} />
          <div className="absolute top-10 hidden lg:block" style={{ left: layout.phoneLeft }}>
            <div className="relative h-[600px] w-[320px] drop-shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
              <div className="absolute inset-0 rounded-[54px] bg-slate-900 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.9)]" />
              <div className="absolute inset-[6px] overflow-hidden rounded-[46px] bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                <KnexChatScreen variant="phone" />
              </div>
              <div className="absolute top-5 left-1/2 h-2 w-20 -translate-x-1/2 rounded-full bg-slate-800/70" />
            </div>
          </div>

          <div className="absolute top-14 hidden lg:block" style={{ left: layout.laptopLeft }}>
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
  name?: string;
  knexId?: string;
};

type DirectoryEntry = {
  email: string;
  name?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt?: string;
};

type InboxMessage = {
  id: string;
  to: string;
  from: string;
  fromName?: string;
  body: string;
  time: string;
  sentAt: number;
  kind?: "text" | "image" | "audio";
  imageUrl?: string;
  imageName?: string;
  audioUrl?: string;
  audioDuration?: string;
};

type TabKey = "conversations" | "groups" | "contacts";
type BaseFilterKey = "all" | "unread" | "groups" | "contacts";
type CustomFilterKey = `custom:${string}`;
type FilterKey = BaseFilterKey | CustomFilterKey;
type MediaTabKey = "media" | "docs" | "links";
type DirectoryTabKey = "people" | "contacts" | "requests";
type DirectoryFilterKey = "all" | "identity" | "context" | "relationship";
type DirectoryRequestsTabKey = "incoming" | "outgoing";

type ContactRequestStatus = "pending" | "accepted" | "rejected" | "blocked" | "canceled";
type ContactRequestDirection = "incoming" | "outgoing";
type ContactRequestLookupKey = `${ContactRequestDirection}:${string}`;
type ContactRequest = {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string | null;
  status: ContactRequestStatus;
  direction: ContactRequestDirection;
  createdAt: string;
};

type ApiContactRequest = {
  id?: string;
  email?: string;
  name?: string | null;
  avatarUrl?: string | null;
  avatar_url?: string | null;
  status?: string;
  direction?: string;
  createdAt?: string;
  created_at?: string;
};

type DirectoryPerson = {
  email: string;
  name: string;
  knexId: string;
  avatarUrl?: string | null;
  isSelf?: boolean;
};

type Thread = {
  id: string;
  title: string;
  preview: string;
  lastActivity: string;
  lastActivityAt?: number;
  unread?: number;
  tab: TabKey;
  avatarUrl?: string;
  onlineCount?: number;
  contactEmail?: string;
  participantRoles?: {
    email: string;
    role: "admin" | "member";
    name?: string | null;
    avatarUrl?: string | null;
    lastSeenAt?: number;
  }[];
};

type CustomConversationList = {
  id: string;
  name: string;
  threadIds: string[];
  createdAt: number;
};

type ThreadMenuItem = {
  label: string;
  icon: LucideIcon;
  action?: "contact-info" | "group-info";
  tone?: "danger";
};

type DesktopConversationContextAction =
  | "archive"
  | "lock"
  | "mute"
  | "pin"
  | "mark-unread"
  | "close"
  | "block"
  | "leave-group"
  | "delete";

type DesktopConversationContextMenuItem = {
  label: string;
  icon: LucideIcon;
  action: DesktopConversationContextAction;
  tone?: "danger";
};

type ApiParticipant = {
  email: string;
  role: "admin" | "member";
  name?: string | null;
  avatar_url?: string | null;
  updated_at?: string | null;
};

type ApiThread = {
  id: string;
  kind: "direct" | "group" | "forum";
  title?: string | null;
  avatar_url?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_message_at?: string | null;
  participants?: ApiParticipant[];
  lastMessage?: ApiMessage | null;
};

type ApiMessage = {
  id: string;
  thread_id: string;
  sender_email: string;
  body: string | null;
  kind: "text" | "image" | "audio" | "file";
  media_url?: string | null;
  media_name?: string | null;
  attachments?: Array<{
    id?: string;
    media_id?: string;
    kind?: "image" | "video" | "audio" | "file";
    url?: string | null;
  }>;
  created_at: string;
};

type MessageDeliveryState = "sent" | "delivered" | "seen";

type Message = {
  id: string;
  author: "me" | "them";
  body: string;
  time: string;
  sentAt?: number;
  senderName?: string;
  senderEmail?: string;
  senderAvatarUrl?: string;
  audioUrl?: string;
  audioDuration?: string;
  imageUrl?: string;
  imageName?: string;
  fileUrl?: string;
  fileName?: string;
  deliveryStatus?: MessageDeliveryState;
};

type MediaItem = {
  id: string;
  threadId: string;
  label: string;
  caption?: string;
  src: string;
  sizeKb?: number;
  isFavorite?: boolean;
  mediaType?: "image" | "video";
  duration?: string;
};

type ConversationMediaViewerItem = {
  id: string;
  src: string;
  label: string;
  time: string;
  senderName: string;
  senderAvatarUrl?: string;
  mediaType: "image" | "video";
};

type MessageMediaContextMenuState = {
  messageId: string;
  src: string;
  label: string;
  mediaType: "image" | "video";
  x: number;
  y: number;
};

type WallpaperOption = {
  key: string;
  label: string;
  color?: string;
};

type GroupPermissions = {
  editGroupSettings: boolean;
  sendMessages: boolean;
  addMembers: boolean;
  inviteViaLink: boolean;
  approveNewMembers: boolean;
};

const CUSTOM_FILTER_PREFIX = "custom:";

const FILTERS: { key: BaseFilterKey; label: string }[] = [
  { key: "all", label: "Tudo" },
  { key: "unread", label: "Não lidas" },
  { key: "groups", label: "Grupos" },
  { key: "contacts", label: "Contatos" },
];

const MEDIA_CONTEXT_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;
const PRESENCE_ONLINE_WINDOW_MS = 90 * 1000;

const DIRECTORY_TABS: { key: DirectoryTabKey; label: string }[] = [
  { key: "people", label: "Pessoas" },
  { key: "contacts", label: "Meus contatos" },
  { key: "requests", label: "Solicitações" },
];

const DIRECTORY_FILTERS: { key: DirectoryFilterKey; label: string; hint: string }[] = [
  { key: "all", label: "Todos", hint: "Exibição completa" },
  { key: "identity", label: "Identidade", hint: "Nome, Knex ID, e-mail parcial" },
  { key: "context", label: "Contexto", hint: "Instituição, curso, comunidades" },
  { key: "relationship", label: "Relacionamento", hint: "Contatos e solicitações" },
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

const DEFAULT_SETTINGS_STATE = {
  openOnStart: true,
  minimizeToTray: true,
  language: "automatico",
  fontSize: "100%",
  spellCheck: true,
  emojiReplace: true,
  enterToSend: true,
  wallpaper: "default",
  profileRecado: "Onde há igualdade, a amizade não perde.",
  theme: "light" as "light" | "dark" | "system",
};

const DEFAULT_GROUP_PERMISSIONS: GroupPermissions = {
  editGroupSettings: true,
  sendMessages: true,
  addMembers: true,
  inviteViaLink: false,
  approveNewMembers: false,
};

const INITIAL_CONVERSATIONS: Thread[] = [];

const INITIAL_GROUPS: Thread[] = [];

const INITIAL_CONTACTS: Thread[] = [];

const MEDIA_TABS: { key: MediaTabKey; label: string }[] = [
  { key: "media", label: "Mídias" },
  { key: "docs", label: "Documentos" },
  { key: "links", label: "Links" },
];

const MEDIA_LIBRARY_SEED: MediaItem[] = [];

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

type AppNavKey =
  | "conversations"
  | "calls"
  | "status"
  | "channels"
  | "communities"
  | "contacts"
  | "images"
  | "settings";

type GlobalSearchResult = {
  id: string;
  kind: "thread" | "message" | "person" | "area" | "setting";
  label: string;
  subLabel: string;
  icon: LucideIcon;
  score: number;
  threadId?: string;
  threadTab?: TabKey;
  navKey?: AppNavKey;
  settingKey?: (typeof SETTINGS_MENU)[number]["key"];
  directoryQuery?: string;
};

const MESSAGE_SEED: Record<string, Message[]> = {};

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

function formatMediaSize(kilobytes: number) {
  if (!kilobytes) return "0 KB";
  if (kilobytes >= 1024) {
    const mb = kilobytes / 1024;
    return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
  }
  return `${Math.round(kilobytes)} KB`;
}

function isValidEmail(email: string) {
  return /\S+@\S+\.\S+/.test(email);
}

function normalizeContactRequestStatus(status: unknown): ContactRequestStatus | null {
  if (status === "pending" || status === "accepted" || status === "rejected" || status === "blocked") {
    return status;
  }
  if (status === "canceled" || status === "cancelled") {
    return "canceled";
  }
  return null;
}

function mapApiContactRequest(raw: unknown): ContactRequest | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as ApiContactRequest;
  const id = typeof record.id === "string" && record.id.trim() ? record.id.trim() : "";
  const email = typeof record.email === "string" ? normalizeEmail(record.email) : "";
  const direction = record.direction === "incoming" || record.direction === "outgoing" ? record.direction : null;
  const status = normalizeContactRequestStatus(record.status);
  const createdAtRaw = typeof record.createdAt === "string" ? record.createdAt : record.created_at;
  const createdAt = typeof createdAtRaw === "string" && createdAtRaw.trim() ? createdAtRaw : new Date().toISOString();
  const name =
    typeof record.name === "string" && record.name.trim()
      ? normalizeName(record.name)
      : undefined;
  const avatarUrl = normalizeAvatarUrl(record.avatarUrl ?? record.avatar_url ?? null);

  if (!id || !email || !isValidEmail(email) || !direction || !status) return null;
  return {
    id,
    email,
    ...(name ? { name } : {}),
    ...(avatarUrl ? { avatarUrl } : {}),
    status,
    direction,
    createdAt,
  };
}

function extractEmail(value?: string | null) {
  if (!value) return null;
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? normalizeEmail(match[0]) : null;
}

function formatNameFromEmail(email: string) {
  const local = email.split("@")[0] ?? email;
  const spaced = local.replace(/[._-]+/g, " ").trim();
  if (!spaced) return email;
  return spaced.replace(/\b\w/g, (char) => char.toUpperCase());
}

function maskEmail(email: string) {
  const [localPart, domainPart] = email.split("@");
  if (!localPart || !domainPart) return email;
  const localMasked =
    localPart.length <= 2
      ? `${localPart.slice(0, 1)}*`
      : `${localPart.slice(0, 1)}${"*".repeat(Math.min(localPart.length - 2, 3))}${localPart.slice(-1)}`;
  const domainSegments = domainPart.split(".");
  const tld = domainSegments.length > 1 ? `.${domainSegments.slice(1).join(".")}` : "";
  const domainBase = domainSegments[0] ?? domainPart;
  const domainMasked =
    domainBase.length <= 2
      ? `${domainBase.slice(0, 1)}*`
      : `${domainBase.slice(0, 1)}${"*".repeat(Math.min(domainBase.length - 2, 3))}${domainBase.slice(-1)}`;
  return `${localMasked}@${domainMasked}${tld}`;
}

function getKnexIdFromEmail(email: string) {
  const local = email.split("@")[0] ?? email;
  const cleaned = local.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const suffix = cleaned ? cleaned.slice(0, 12) : "usuario";
  return `knex-${suffix}`;
}

function normalizeKnexId(raw: unknown) {
  if (typeof raw !== "string") return null;
  const value = raw.trim().replace(/^@+/, "").toLowerCase();
  if (!value) return null;
  return /^[a-z0-9._-]+$/.test(value) ? value : null;
}

function formatKnexId(knexId: string) {
  return `@${knexId.replace(/^@+/, "")}`;
}

function contactIdFromEmail(email: string) {
  const normalized = normalizeEmail(email);
  const slug = normalized.replace(/[^a-z0-9]+/g, "-");
  return `ctt-${slug}`;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value?: string | null) {
  if (!value) return false;
  return UUID_REGEX.test(value);
}

function toTimestampMs(value?: string | number | null) {
  if (!value) return null;
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? null : time;
}

function formatTimestampLabel(value?: string | number | null) {
  const time = toTimestampMs(value);
  if (!time) return "";
  const date = new Date(time);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();
  if (isYesterday) return "Ontem";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatClockLabel(value?: string | number | null) {
  const time = toTimestampMs(value);
  if (!time) return "";
  return new Date(time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatLastSeenTimestamp(value?: string | number | null) {
  const time = toTimestampMs(value);
  if (!time) return "";
  const date = new Date(time);
  const now = new Date();
  const timeLabel = formatClockLabel(time);
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) return `hoje às ${timeLabel}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();
  if (isYesterday) return `ontem às ${timeLabel}`;
  const dateLabel = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${dateLabel} às ${timeLabel}`;
}

function getThreadActivityTimestamp(thread: Thread) {
  return typeof thread.lastActivityAt === "number" ? thread.lastActivityAt : 0;
}

function areStringArraysEqual(previous: string[] = [], next: string[] = []) {
  if (previous.length !== next.length) return false;
  return previous.every((value, index) => value === next[index]);
}

function areParticipantRolesEqual(
  previous: Thread["participantRoles"],
  next: Thread["participantRoles"],
) {
  const previousList = previous ?? [];
  const nextList = next ?? [];
  if (previousList.length !== nextList.length) return false;
  return previousList.every((participant, index) => {
    const candidate = nextList[index];
    if (!candidate) return false;
    return (
      participant.email === candidate.email &&
      participant.role === candidate.role &&
      (participant.name ?? null) === (candidate.name ?? null) &&
      areAvatarUrlsEqual(participant.avatarUrl ?? null, candidate.avatarUrl ?? null) &&
      (participant.lastSeenAt ?? undefined) === (candidate.lastSeenAt ?? undefined)
    );
  });
}

function areThreadsEqual(previous: Thread, next: Thread) {
  return (
    previous.id === next.id &&
    previous.title === next.title &&
    previous.preview === next.preview &&
    previous.lastActivity === next.lastActivity &&
    (previous.lastActivityAt ?? undefined) === (next.lastActivityAt ?? undefined) &&
    (previous.unread ?? undefined) === (next.unread ?? undefined) &&
    previous.tab === next.tab &&
    areAvatarUrlsEqual(previous.avatarUrl ?? undefined, next.avatarUrl ?? undefined) &&
    (previous.onlineCount ?? undefined) === (next.onlineCount ?? undefined) &&
    (previous.contactEmail ?? undefined) === (next.contactEmail ?? undefined) &&
    areParticipantRolesEqual(previous.participantRoles, next.participantRoles)
  );
}

function areThreadListsEqual(previous: Thread[], next: Thread[]) {
  if (previous.length !== next.length) return false;
  return previous.every((thread, index) => {
    const candidate = next[index];
    if (!candidate) return false;
    return areThreadsEqual(thread, candidate);
  });
}

function preserveStableThreadAvatars(previous: Thread[], next: Thread[]) {
  if (!previous.length || !next.length) return next;
  const previousById = new Map(previous.map((thread) => [thread.id, thread] as const));
  let changed = false;
  const stabilized = next.map((thread) => {
    const previousThread = previousById.get(thread.id);
    if (!previousThread) return thread;
    const previousAvatar = previousThread.avatarUrl ?? null;
    const nextAvatar = thread.avatarUrl ?? null;
    if (!nextAvatar && previousAvatar) {
      changed = true;
      return { ...thread, avatarUrl: previousThread.avatarUrl };
    }
    if (areAvatarUrlsEqual(previousAvatar, nextAvatar) && previousAvatar !== nextAvatar) {
      changed = true;
      return { ...thread, avatarUrl: previousThread.avatarUrl };
    }
    return thread;
  });
  return changed ? stabilized : next;
}

function areMessagesEqual(previous: Message[] = [], next: Message[] = []) {
  if (previous.length !== next.length) return false;
  return previous.every((message, index) => {
    const candidate = next[index];
    if (!candidate) return false;
    return (
      message.id === candidate.id &&
      message.author === candidate.author &&
      message.body === candidate.body &&
      message.time === candidate.time &&
      (message.sentAt ?? undefined) === (candidate.sentAt ?? undefined) &&
      (message.senderName ?? undefined) === (candidate.senderName ?? undefined) &&
      (message.senderEmail ?? undefined) === (candidate.senderEmail ?? undefined) &&
      areAvatarUrlsEqual(message.senderAvatarUrl ?? undefined, candidate.senderAvatarUrl ?? undefined) &&
      (message.imageUrl ?? undefined) === (candidate.imageUrl ?? undefined) &&
      (message.imageName ?? undefined) === (candidate.imageName ?? undefined) &&
      (message.fileUrl ?? undefined) === (candidate.fileUrl ?? undefined) &&
      (message.fileName ?? undefined) === (candidate.fileName ?? undefined) &&
      (message.audioUrl ?? undefined) === (candidate.audioUrl ?? undefined) &&
      (message.audioDuration ?? undefined) === (candidate.audioDuration ?? undefined) &&
      (message.deliveryStatus ?? undefined) === (candidate.deliveryStatus ?? undefined)
    );
  });
}

function resolveMessageDeliveryState(
  message: Message,
  messageIndex: number,
  allMessages: Message[],
): MessageDeliveryState | null {
  if (message.author !== "me") return null;
  if (message.deliveryStatus === "seen") return "seen";
  const hasIncomingAfter = allMessages.slice(messageIndex + 1).some((candidate) => candidate.author !== "me");
  if (hasIncomingAfter) return "seen";
  const hasOutgoingAfter = allMessages.slice(messageIndex + 1).some((candidate) => candidate.author === "me");
  if (message.deliveryStatus === "delivered") return "delivered";
  if (message.deliveryStatus === "sent") {
    return hasOutgoingAfter ? "delivered" : "sent";
  }
  if (hasOutgoingAfter) return "delivered";
  return message.id.startsWith("m_") ? "sent" : "delivered";
}

type DeliveryStatusIndicatorProps = {
  state: MessageDeliveryState;
  className?: string;
};

function DeliveryStatusIndicator({ state, className = "" }: DeliveryStatusIndicatorProps) {
  if (state === "sent") {
    return <Check className={`h-3.5 w-3.5 ${className}`.trim()} strokeWidth={2.4} />;
  }
  return (
    <span className={`relative inline-flex h-3.5 w-5 ${className}`.trim()}>
      <Check className="absolute left-0 top-0 h-3.5 w-3.5" strokeWidth={2.4} />
      <Check className="absolute left-[6px] top-0 h-3.5 w-3.5" strokeWidth={2.4} />
    </span>
  );
}

function getContactPrimaryKey(thread: Thread) {
  if (thread.contactEmail) return normalizeEmail(thread.contactEmail);
  const previewEmail = extractEmail(thread.preview);
  if (previewEmail) return previewEmail;
  return thread.id;
}

function isCustomFilterKey(value: FilterKey): value is CustomFilterKey {
  return value.startsWith(CUSTOM_FILTER_PREFIX);
}

function toCustomFilterKey(listId: string): CustomFilterKey {
  return `${CUSTOM_FILTER_PREFIX}${listId}`;
}

function getCustomFilterIdFromKey(value: CustomFilterKey) {
  return value.slice(CUSTOM_FILTER_PREFIX.length);
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

const PLAYBACK_SPEED_OPTIONS = [1, 1.5, 2] as const;
type PlaybackSpeed = (typeof PLAYBACK_SPEED_OPTIONS)[number];

function formatPlaybackSpeedLabel(speed: PlaybackSpeed) {
  return `${Number.isInteger(speed) ? speed.toFixed(0) : speed}x`;
}

function getNextPlaybackSpeed(speed: PlaybackSpeed): PlaybackSpeed {
  const currentIndex = PLAYBACK_SPEED_OPTIONS.findIndex((value) => value === speed);
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % PLAYBACK_SPEED_OPTIONS.length;
  return PLAYBACK_SPEED_OPTIONS[nextIndex];
}

function detectMediaTypeFromSource(src: string | undefined | null): "image" | "video" {
  if (!src) return "image";
  const value = src.trim();
  if (!value) return "image";
  if (/^data:video\//i.test(value)) return "video";
  if (/^data:image\//i.test(value)) return "image";
  const normalized = value.split("#")[0].split("?")[0].toLowerCase();
  if (/\.(mp4|webm|ogg|mov|m4v|mkv)$/i.test(normalized)) return "video";
  return "image";
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
    (record.name === undefined || typeof record.name === "string") &&
    (record.knexId === undefined || typeof record.knexId === "string")
  );
}

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw || !raw.trim()) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeParseIdentity(raw: string): Identity | null {
  const parsed = safeParseJson<unknown>(raw);
  return parsed && isIdentity(parsed) ? parsed : null;
}

function areIdentitiesEqual(a: Identity | null | undefined, b: Identity | null | undefined): boolean {
  if (!a || !b) return false;
  return (
    a.userId === b.userId &&
    a.email === b.email &&
    a.emailVerified === b.emailVerified &&
    a.createdAt === b.createdAt &&
    a.deviceId === b.deviceId &&
    (a.name ?? "") === (b.name ?? "") &&
    (a.knexId ?? "") === (b.knexId ?? "")
  );
}

function normalizeAvatarUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (/^data:image\//i.test(value)) return value;
  if (/^blob:/i.test(value)) return value;
  return null;
}

function getAvatarComparisonKey(raw: string | null | undefined): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return "";
  if (!/^https?:\/\//i.test(value)) return value;
  try {
    const parsed = new URL(value);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return value;
  }
}

function areAvatarUrlsEqual(previous: string | null | undefined, next: string | null | undefined): boolean {
  return getAvatarComparisonKey(previous) === getAvatarComparisonKey(next);
}

function resolveApiMessageMediaUrl(message: ApiMessage): string | null {
  const direct = typeof message.media_url === "string" ? message.media_url.trim() : "";
  if (direct) return direct;
  if (!Array.isArray(message.attachments)) return null;
  const attachmentWithUrl = message.attachments.find(
    (attachment) => attachment && typeof attachment.url === "string" && attachment.url.trim(),
  );
  if (!attachmentWithUrl || typeof attachmentWithUrl.url !== "string") return null;
  return attachmentWithUrl.url.trim();
}

function normalizeDirectoryEntries(raw: string | null): DirectoryEntry[] {
  const parsed = safeParseJson<unknown>(raw);
  if (!Array.isArray(parsed)) return [];
  const entries: DirectoryEntry[] = [];
  const seen = new Set<string>();
  parsed.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const record = item as Record<string, unknown>;
    if (typeof record.email !== "string") return;
    const email = normalizeEmail(record.email);
    if (!email || !isValidEmail(email)) return;
    if (seen.has(email)) return;
    seen.add(email);
    const name = typeof record.name === "string" ? normalizeName(record.name) : undefined;
    const avatarUrl = normalizeAvatarUrl(
      typeof record.avatarUrl === "string"
        ? record.avatarUrl
        : typeof record.avatar_url === "string"
          ? record.avatar_url
          : null,
    );
    const createdAt =
      typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString();
    const updatedAt =
      typeof record.updatedAt === "string"
        ? record.updatedAt
        : typeof record.updated_at === "string"
          ? record.updated_at
          : undefined;
    entries.push({
      email,
      name: name || undefined,
      ...(avatarUrl ? { avatarUrl } : {}),
      createdAt,
      ...(updatedAt ? { updatedAt } : {}),
    });
  });
  return entries;
}

function normalizeInboxMessages(raw: string | null): InboxMessage[] {
  const parsed = safeParseJson<unknown>(raw);
  if (!Array.isArray(parsed)) return [];
  const messages: InboxMessage[] = [];
  parsed.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const record = item as Record<string, unknown>;
    if (typeof record.to !== "string" || typeof record.from !== "string") return;
    if (typeof record.body !== "string" || typeof record.time !== "string") return;
    if (typeof record.sentAt !== "number" || !Number.isFinite(record.sentAt)) return;
    const to = normalizeEmail(record.to);
    const from = normalizeEmail(record.from);
    if (!to || !from) return;
    const kind =
      typeof record.kind === "string" && ["text", "image", "audio"].includes(record.kind)
        ? (record.kind as "text" | "image" | "audio")
        : undefined;
    messages.push({
      id: typeof record.id === "string" ? record.id : `m_${record.sentAt}`,
      to,
      from,
      fromName: typeof record.fromName === "string" ? record.fromName : undefined,
      body: record.body,
      time: record.time,
      sentAt: record.sentAt,
      kind,
      imageUrl: typeof record.imageUrl === "string" ? record.imageUrl : undefined,
      imageName: typeof record.imageName === "string" ? record.imageName : undefined,
      audioUrl: typeof record.audioUrl === "string" ? record.audioUrl : undefined,
      audioDuration: typeof record.audioDuration === "string" ? record.audioDuration : undefined,
    });
  });
  return messages;
}

export default function KnexChatPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const isChatRoute = !pathname || pathname.startsWith("/knexchat/web") || pathname.startsWith("/knexchat/t/");
  const searchQuery = useMemo(() => searchParams?.toString() ?? "", [searchParams]);
  const chatHref = useMemo(() => (searchQuery ? `/knexchat/web?${searchQuery}` : "/knexchat/web"), [searchQuery]);
  const activationReturnTo = useMemo(() => {
    const base = pathname ?? "/knexchat/web";
    return searchQuery ? `${base}?${searchQuery}` : base;
  }, [pathname, searchQuery]);
  const activationHref = useMemo(
    () => `/knexchat/activate?returnTo=${encodeURIComponent(activationReturnTo)}`,
    [activationReturnTo],
  );
  const joinToken = useMemo(() => {
    const raw = searchParams?.get("join");
    return raw?.trim() ? raw.trim() : null;
  }, [searchParams]);
  const params = useParams();
  const threadParam = useMemo(() => {
    const fromPath = typeof params?.id === "string" ? params.id : null;
    if (fromPath) return fromPath;
    const raw = searchParams?.get("thread");
    return raw?.trim() ? raw.trim() : null;
  }, [params, searchParams]);

  const [identity, setIdentity] = useState<Identity | null>(null);
  const [activationProfileIdentity, setActivationProfileIdentity] = useState<{
    displayName?: string;
    knexId?: string;
  } | null>(null);
  const [authSession, setAuthSession] = useState<Session | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authHttpUnauthorized, setAuthHttpUnauthorized] = useState(false);
  const [isKnexchatActivated, setIsKnexchatActivated] = useState<boolean | null>(null);
  const [entitlementBlocked, setEntitlementBlocked] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);
  const debugUiEnabled = process.env.NEXT_PUBLIC_DEBUG_UI === "1";
  const [debugUiSnapshot, setDebugUiSnapshot] = useState<DebugUiSnapshot | null>(null);
  const [activationLayout, setActivationLayout] = useState<ActivationLayout>(() =>
    computeActivationLayout(1440, 900),
  );
  const [directoryEntries, setDirectoryEntries] = useState<DirectoryEntry[]>([]);
  const [directoryLookupCache, setDirectoryLookupCache] = useState<Record<string, boolean>>({});
  const [isDirectoryCacheHydrated, setIsDirectoryCacheHydrated] = useState(false);
  const serverMessagingEnabled = true;
  const [isServerSyncing, setIsServerSyncing] = useState(false);
  const [serverSyncError, setServerSyncError] = useState<string | null>(null);
  const [realtimeKey, setRealtimeKey] = useState(0);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [clockTick, setClockTick] = useState(() => Date.now());
  const [presenceByEmail, setPresenceByEmail] = useState<Record<string, number>>({});

  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [customConversationLists, setCustomConversationLists] = useState<CustomConversationList[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string>(INITIAL_CONVERSATIONS[0]?.id ?? "");
  const [pendingJoinToken, setPendingJoinToken] = useState<string | null>(null);
  const [handledJoinToken, setHandledJoinToken] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Thread[]>(INITIAL_CONVERSATIONS);
  const [groups, setGroups] = useState<Thread[]>(INITIAL_GROUPS);
  const [contacts, setContacts] = useState<Thread[]>(INITIAL_CONTACTS);
  const [unreadByThread, setUnreadByThread] = useState<Record<string, number>>(() => {
    const seed: Record<string, number> = {};
    INITIAL_CONVERSATIONS.forEach((thread) => {
      if (thread.unread) seed[thread.id] = thread.unread;
    });
    INITIAL_GROUPS.forEach((thread) => {
      if (thread.unread) seed[thread.id] = thread.unread;
    });
    INITIAL_CONTACTS.forEach((thread) => {
      if (thread.unread) seed[thread.id] = thread.unread;
    });
    return seed;
  });
  const [messageDraft, setMessageDraft] = useState("");
  const [messageSendNotice, setMessageSendNotice] = useState<string | null>(null);
  const [isComposerAttachmentMenuOpen, setIsComposerAttachmentMenuOpen] = useState(false);
  const [isComposerCameraOpen, setIsComposerCameraOpen] = useState(false);
  const [composerCameraError, setComposerCameraError] = useState<string | null>(null);
  const [isComposerCameraBusy, setIsComposerCameraBusy] = useState(false);
  const [composerCameraCapturedFile, setComposerCameraCapturedFile] = useState<File | null>(null);
  const [composerCameraCapturedPreview, setComposerCameraCapturedPreview] = useState<string | null>(null);
  const [messagesByThread, setMessagesByThread] = useState<Record<string, Message[]>>(MESSAGE_SEED);
  const [messageLoadingByThread, setMessageLoadingByThread] = useState<Record<string, boolean>>({});
  const [messageErrorByThread, setMessageErrorByThread] = useState<Record<string, string | null>>({});
  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "paused">("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [activeNavKey, setActiveNavKey] = useState<
    "conversations" | "calls" | "status" | "channels" | "communities" | "contacts" | "images" | "settings"
  >("conversations");
  const [isNavSidebarOpen, setIsNavSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileTarget, setProfileTarget] = useState<"thread" | "self" | null>(null);
  const [isProfileAvatarPreviewOpen, setIsProfileAvatarPreviewOpen] = useState(false);
  const [isProfileAvatarActionMenuOpen, setIsProfileAvatarActionMenuOpen] = useState(false);
  const [isProfileAvatarDesktopCameraOpen, setIsProfileAvatarDesktopCameraOpen] = useState(false);
  const [profileAvatarDesktopCameraCapturedFile, setProfileAvatarDesktopCameraCapturedFile] = useState<File | null>(null);
  const [profileAvatarDesktopCameraCapturedPreview, setProfileAvatarDesktopCameraCapturedPreview] = useState<string | null>(null);
  const [profileNameDraft, setProfileNameDraft] = useState("");
  const [profileRecadoDraft, setProfileRecadoDraft] = useState("");
  const [profileAvatarUploading, setProfileAvatarUploading] = useState(false);
  const [profileAvatarNotice, setProfileAvatarNotice] = useState<string | null>(null);
  const [chatListWidth, setChatListWidth] = useState(384);
  const [isChatListResizing, setIsChatListResizing] = useState(false);
  const [isThreadMenuOpen, setIsThreadMenuOpen] = useState(false);
  const [isHeaderAvatarMenuOpen, setIsHeaderAvatarMenuOpen] = useState(false);
  const [desktopConversationContextMenu, setDesktopConversationContextMenu] = useState<{
    threadId: string;
    threadTab: TabKey;
    x: number;
    y: number;
  } | null>(null);
  const [hiddenThreadIds, setHiddenThreadIds] = useState<string[]>([]);
  const [isContactInfoOpen, setIsContactInfoOpen] = useState(false);
  const [isContactEditOpen, setIsContactEditOpen] = useState(false);
  const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);
  const [isGroupPermissionsOpen, setIsGroupPermissionsOpen] = useState(false);
  const [isGroupAdminsModalOpen, setIsGroupAdminsModalOpen] = useState(false);
  const [isGroupMemberModalOpen, setIsGroupMemberModalOpen] = useState(false);
  const [groupDescriptions, setGroupDescriptions] = useState<Record<string, string>>({});
  const [groupPermissionsById, setGroupPermissionsById] = useState<Record<string, GroupPermissions>>({});
  const [groupAdminIdsByGroup, setGroupAdminIdsByGroup] = useState<Record<string, string[]>>({});
  const [groupAdminSearch, setGroupAdminSearch] = useState("");
  const [selectedGroupAdminIds, setSelectedGroupAdminIds] = useState<string[]>([]);
  const [isDeleteContactConfirmOpen, setIsDeleteContactConfirmOpen] = useState(false);
  const [deleteContactTargetId, setDeleteContactTargetId] = useState<string | null>(null);
  const [deleteContactTargetName, setDeleteContactTargetName] = useState("");
  const [isGroupNameEditing, setIsGroupNameEditing] = useState(false);
  const [groupNameDraft, setGroupNameDraft] = useState("");
  const [groupDescriptionDraft, setGroupDescriptionDraft] = useState("");
  const [isGroupDescriptionEditing, setIsGroupDescriptionEditing] = useState(false);
  const groupNameInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [editContactFirstName, setEditContactFirstName] = useState("");
  const [editContactLastName, setEditContactLastName] = useState("");
  const [editContactEmail, setEditContactEmail] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");
  const [editContactSync, setEditContactSync] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isCustomListOpen, setIsCustomListOpen] = useState(false);
  const [isNewChatEmailOpen, setIsNewChatEmailOpen] = useState(false);
  const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);
  const [isNewGroupCreateOpen, setIsNewGroupCreateOpen] = useState(false);
  const [groupMemberPickerMode, setGroupMemberPickerMode] = useState<"create" | "add">("create");
  const [isGroupsPanelOpen, setIsGroupsPanelOpen] = useState(false);
  const [isGroupCreateOpen, setIsGroupCreateOpen] = useState(false);
  const [isCommunityListOpen, setIsCommunityListOpen] = useState(false);
  const [isNewContactOpen, setIsNewContactOpen] = useState(false);
  const [isDirectoryOpen, setIsDirectoryOpen] = useState(false);
  const [directoryTab, setDirectoryTab] = useState<DirectoryTabKey>("people");
  const [directoryRequestsTab, setDirectoryRequestsTab] = useState<DirectoryRequestsTabKey>("incoming");
  const [directorySearch, setDirectorySearch] = useState("");
  const [directoryFilter, setDirectoryFilter] = useState<DirectoryFilterKey>("all");
  const [activeTopMenuIndex, setActiveTopMenuIndex] = useState(0);

  const showDetailOnMobile =
    isMobileView &&
    isMobileDetailOpen &&
    Boolean(activeThreadId) &&
    !isSettingsOpen &&
    !isDirectoryOpen &&
    !isNewChatOpen &&
    !isCustomListOpen &&
    !isProfileOpen;
  const showMobileConversationShellHeader = isMobileView && showDetailOnMobile && Boolean(activeThreadId);
  const showMobileFooterDock = !showMobileConversationShellHeader;

  const openNewConversationPanel = useCallback(() => {
    setIsDirectoryOpen(false);
    setIsNewChatOpen(true);
    setIsNewChatEmailOpen(false);
    setIsNewGroupOpen(false);
    setIsCommunityListOpen(false);
    setIsGroupsPanelOpen(false);
    setIsGroupCreateOpen(false);
    setIsGroupsExpanded(false);
    setIsNewContactOpen(false);
    setGroupMemberPickerMode("create");
  }, []);

  const handleMobileBack = useCallback(() => {
    setIsMobileDetailOpen(false);
    if (!isMobileView) return;
    if (!threadParam && !pathname?.startsWith("/knexchat/t/")) return;
    router.replace(buildKnexchatWebHref(searchQuery, null), { scroll: false });
  }, [isMobileView, pathname, router, searchQuery, threadParam]);
  const handleToggleSidebar = useCallback(() => {
    if (isMobileView) {
      setIsProfileOpen(false);
      setProfileTarget(null);
      setIsSettingsOpen(false);
      setActiveSettingKey(null);
      setIsDirectoryOpen(false);
      setIsMobileProfileSheetOpen((prev) => !prev);
      return;
    }
    setIsNavSidebarOpen((prev) => !prev);
  }, [isMobileView]);
  useEffect(() => {
    if (!isMobileView || !isNavSidebarOpen) return;
    setIsNavSidebarOpen(false);
  }, [isMobileView, isNavSidebarOpen]);
  useEffect(() => {
    if (isMobileView || !isNavSidebarOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsNavSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileView, isNavSidebarOpen]);

  const [isDirectoryFiltersOpen, setIsDirectoryFiltersOpen] = useState(false);
  const [contactRequests, setContactRequests] = useState<ContactRequest[]>([]);
  const [isGroupEmojiOpen, setIsGroupEmojiOpen] = useState(false);
  const [isGroupMembersExpanded, setIsGroupMembersExpanded] = useState(false);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [isConversationMediaViewerOpen, setIsConversationMediaViewerOpen] = useState(false);
  const [conversationMediaViewerIndex, setConversationMediaViewerIndex] = useState(0);
  const [isConversationMediaViewerUiVisible, setIsConversationMediaViewerUiVisible] = useState(false);
  const [messageMediaContextMenu, setMessageMediaContextMenu] = useState<MessageMediaContextMenuState | null>(null);
  const [messageVideoDurationById, setMessageVideoDurationById] = useState<Record<string, string>>({});
  const [isConversationMediaViewerVideoPlaying, setIsConversationMediaViewerVideoPlaying] = useState(false);
  const [conversationMediaViewerVideoCurrentTime, setConversationMediaViewerVideoCurrentTime] = useState(0);
  const [conversationMediaViewerVideoDuration, setConversationMediaViewerVideoDuration] = useState(0);
  const [conversationMediaViewerVideoPlaybackSpeed, setConversationMediaViewerVideoPlaybackSpeed] =
    useState<PlaybackSpeed>(1);
  const [activeMediaTab, setActiveMediaTab] = useState<MediaTabKey>("media");
  const [mediaLibrary, setMediaLibrary] = useState<MediaItem[]>(MEDIA_LIBRARY_SEED);
  const [isMediaSelectMode, setIsMediaSelectMode] = useState(false);
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [mediaGridVariant, setMediaGridVariant] = useState<"compact" | "comfortable">("comfortable");
  const [isMediaFilterOpen, setIsMediaFilterOpen] = useState(false);
  const [mediaFilterSender, setMediaFilterSender] = useState<"all" | "me" | "others">("all");
  const [mediaFilterOrder, setMediaFilterOrder] = useState<"recent" | "old" | "big">("recent");
  const [isMediaShareOpen, setIsMediaShareOpen] = useState(false);
  const [shareSearch, setShareSearch] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [selectedShareContactIds, setSelectedShareContactIds] = useState<string[]>([]);
  const [shareAudioFiles, setShareAudioFiles] = useState<
    { id: string; file: File; url: string; duration?: string; durationSeconds?: number; waveform?: number[] }[]
  >([]);
  const shareAudioLimit = 4;
  const [shareRecordingState, setShareRecordingState] = useState<"idle" | "recording">("idle");
  const [shareRecordingSeconds, setShareRecordingSeconds] = useState(0);
  const shareWaveBarCount = 18;
  const [shareRecordingWave, setShareRecordingWave] = useState<number[]>(
    () => Array.from({ length: shareWaveBarCount }, () => 0.15),
  );
  const [shareAudioPlaybackSeconds, setShareAudioPlaybackSeconds] = useState(0);
  const [shareAudioPlaybackSpeed, setShareAudioPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [isComposerDragActive, setIsComposerDragActive] = useState(false);
  const [isGroupsExpanded, setIsGroupsExpanded] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [conversationSearch, setConversationSearch] = useState("");
  const [customListSearch, setCustomListSearch] = useState("");
  const [newChatSearch, setNewChatSearch] = useState("");
  const [newCustomListName, setNewCustomListName] = useState("");
  const [customListStep, setCustomListStep] = useState<"name" | "members">("name");
  const [customListError, setCustomListError] = useState<string | null>(null);
  const [selectedCustomListThreadIds, setSelectedCustomListThreadIds] = useState<string[]>([]);
  const [newGroupSearch, setNewGroupSearch] = useState("");
  const [newChatEmail, setNewChatEmail] = useState("");
  const [selectedGroupMemberIds, setSelectedGroupMemberIds] = useState<string[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupImageUrl, setNewGroupImageUrl] = useState<string | null>(null);
  const [isGroupImageMenuOpen, setIsGroupImageMenuOpen] = useState(false);
  const groupImageFileInputRef = useRef<HTMLInputElement | null>(null);
  const groupImageCameraInputRef = useRef<HTMLInputElement | null>(null);
  const groupEmojiAnchorRef = useRef<HTMLDivElement | null>(null);
  const groupEmojiMenuRef = useRef<HTMLDivElement | null>(null);
  const [groupEmojiMenuStyle, setGroupEmojiMenuStyle] = useState<CSSProperties | null>(null);
  const [groupEmojiSize, setGroupEmojiSize] = useState({ width: 420, height: 360 });
  const [isGroupEmojiResizing, setIsGroupEmojiResizing] = useState(false);
  const groupAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const groupEmojiResizeRef = useRef<{
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);
  const [newContactFirstName, setNewContactFirstName] = useState("");
  const [newContactLastName, setNewContactLastName] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactSync, setNewContactSync] = useState(false);
  const [newContactError, setNewContactError] = useState<string | null>(null);
  const [newContactInviteNotice, setNewContactInviteNotice] = useState<string | null>(null);
  const [selfAvatarUrl, setSelfAvatarUrl] = useState<string | null>(null);
  const [threadAvatarOverrides, setThreadAvatarOverrides] = useState<Record<string, string>>({});
  const [activeSettingKey, setActiveSettingKey] = useState<(typeof SETTINGS_MENU)[number]["key"] | null>(null);
  const [isMobileProfileSheetOpen, setIsMobileProfileSheetOpen] = useState(false);
  const [mobileProfileSheetScrollY, setMobileProfileSheetScrollY] = useState(0);
  const [isMobileProfileSearchOpen, setIsMobileProfileSearchOpen] = useState(false);
  const [mobileProfileSearchQuery, setMobileProfileSearchQuery] = useState("");
  const [isWallpaperModalOpen, setIsWallpaperModalOpen] = useState(false);
  const [wallpaperHoverKey, setWallpaperHoverKey] = useState<string | null>(null);
  const [headerInfoStep, setHeaderInfoStep] = useState(0);
  const chatStateKey = useMemo(() => {
    if (!identity?.email) return null;
    return `${CHAT_STATE_KEY}:${normalizeEmail(identity.email)}`;
  }, [identity?.email]);
  const chatUiStateKey = useMemo(() => {
    if (!identity?.email) return null;
    return `${CHAT_UI_STATE_KEY}:${normalizeEmail(identity.email)}`;
  }, [identity?.email]);
  const legacyChatStateKey = useMemo(() => {
    if (!identity?.email) return null;
    return `${LEGACY_CHAT_STATE_KEY}:${normalizeEmail(identity.email)}`;
  }, [identity?.email]);
  const legacyChatUiStateKey = useMemo(() => {
    if (!identity?.email) return null;
    return `${LEGACY_CHAT_UI_STATE_KEY}:${normalizeEmail(identity.email)}`;
  }, [identity?.email]);
  const [settingsState, setSettingsState] = useState(DEFAULT_SETTINGS_STATE);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [pendingTheme, setPendingTheme] = useState<"light" | "dark" | "system">("light");
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);
  const [isChatStateHydrated, setIsChatStateHydrated] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingIntervalRef = useRef<number | null>(null);
  const recordingSecondsRef = useRef(0);
  const recordingActionRef = useRef<"send" | "discard">("discard");
  const recordingDurationRef = useRef(0);
  const messageFetchInFlightRef = useRef<Set<string>>(new Set());
  const refreshSessionPromiseRef = useRef<Promise<string | null> | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messageImageInputRef = useRef<HTMLInputElement | null>(null);
  const messageCameraInputRef = useRef<HTMLInputElement | null>(null);
  const shareThumbsRef = useRef<HTMLDivElement | null>(null);
  const shareAudioInputRef = useRef<HTMLInputElement | null>(null);
  const shareRecorderRef = useRef<MediaRecorder | null>(null);
  const shareStreamRef = useRef<MediaStream | null>(null);
  const shareRecordingIntervalRef = useRef<number | null>(null);
  const shareRecordingSecondsRef = useRef(0);
  const shareRecordingDurationRef = useRef(0);
  const shareAudioChunksRef = useRef<Blob[]>([]);
  const shareRecordingActionRef = useRef<"keep" | "discard">("keep");
  const shareAudioContextRef = useRef<AudioContext | null>(null);
  const shareAnalyserRef = useRef<AnalyserNode | null>(null);
  const shareWaveDataRef = useRef<Uint8Array | null>(null);
  const shareWaveRafRef = useRef<number | null>(null);
  const shareWaveLastUpdateRef = useRef(0);
  const shareAudioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const shareAudioPlaybackRafRef = useRef<number | null>(null);
  const mobileDockButtonsRef = useRef<HTMLDivElement | null>(null);
  const mobileProfileSheetScrollRef = useRef<HTMLDivElement | null>(null);
  const mobileProfileSearchInputRef = useRef<HTMLInputElement | null>(null);
  const topMenuCarouselRef = useRef<HTMLDivElement | null>(null);
  const conversationFiltersRef = useRef<HTMLDivElement | null>(null);
  const directoryFiltersRef = useRef<HTMLDivElement | null>(null);
  const [shareAudioPlayingId, setShareAudioPlayingId] = useState<string | null>(null);
  const [shareAudioIsPaused, setShareAudioIsPaused] = useState(false);
  const [isMobileDockCarousel, setIsMobileDockCarousel] = useState(false);
  const [canScrollTopMenuLeft, setCanScrollTopMenuLeft] = useState(false);
  const [canScrollTopMenuRight, setCanScrollTopMenuRight] = useState(false);
  const [isConversationFiltersCarousel, setIsConversationFiltersCarousel] = useState(false);
  const [isDirectoryFiltersCarousel, setIsDirectoryFiltersCarousel] = useState(false);
  const incomingCountRef = useRef<Record<string, number>>({});
  const unreadInitializedRef = useRef(false);
  const chatListResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const threadMenuAnchorRef = useRef<HTMLButtonElement | null>(null);
  const threadMenuRef = useRef<HTMLDivElement | null>(null);
  const globalSearchContainerRef = useRef<HTMLDivElement | null>(null);
  const headerAvatarMenuRef = useRef<HTMLDivElement | null>(null);
  const desktopConversationContextMenuRef = useRef<HTMLDivElement | null>(null);
  const hiddenThreadIdsRef = useRef<Set<string>>(new Set());
  const conversationMediaViewerTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const conversationMediaViewerDidSwipeRef = useRef(false);
  const conversationMediaViewerVideoRef = useRef<HTMLVideoElement | null>(null);
  const composerDragDepthRef = useRef(0);
  const messageMediaContextMenuRef = useRef<HTMLDivElement | null>(null);
  const composerAttachmentButtonRef = useRef<HTMLButtonElement | null>(null);
  const composerAttachmentMenuRef = useRef<HTMLDivElement | null>(null);
  const composerCameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const composerCameraStreamRef = useRef<MediaStream | null>(null);
  const messageListScrollRef = useRef<HTMLDivElement | null>(null);
  const messageListPinnedToBottomRef = useRef(true);
  const previousMessageListThreadRef = useRef<string | null>(null);
  const profileAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const profileAvatarCameraInputRef = useRef<HTMLInputElement | null>(null);
  const profileAvatarDesktopCameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const profileAvatarDesktopCameraStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setClockTick(Date.now());
    }, 30 * 1000);
    return () => window.clearInterval(interval);
  }, []);

  const scrollMessageListToBottom = useCallback((force = false) => {
    const container = messageListScrollRef.current;
    if (!container) return;
    if (!force && !messageListPinnedToBottomRef.current) return;
    container.scrollTop = container.scrollHeight;
  }, []);
  const handleMessageListScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    messageListPinnedToBottomRef.current = distanceToBottom <= 24;
  }, []);

  useEffect(() => {
    if (isProfileAvatarPreviewOpen) return;
    setIsProfileAvatarActionMenuOpen(false);
    setIsProfileAvatarDesktopCameraOpen(false);
  }, [isProfileAvatarPreviewOpen]);
  useEffect(() => {
    if (isProfileAvatarDesktopCameraOpen) return;
    const stream = profileAvatarDesktopCameraStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      profileAvatarDesktopCameraStreamRef.current = null;
    }
    if (profileAvatarDesktopCameraVideoRef.current) {
      profileAvatarDesktopCameraVideoRef.current.srcObject = null;
    }
    setProfileAvatarDesktopCameraCapturedFile(null);
    setProfileAvatarDesktopCameraCapturedPreview(null);
  }, [isProfileAvatarDesktopCameraOpen]);
  useEffect(() => {
    if (!isProfileAvatarDesktopCameraOpen) return;
    const video = profileAvatarDesktopCameraVideoRef.current;
    const stream = profileAvatarDesktopCameraStreamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => {
      // Ignore autoplay restrictions; user can interact to retry.
    });
  }, [isProfileAvatarDesktopCameraOpen]);
  useEffect(
    () => () => {
      const stream = profileAvatarDesktopCameraStreamRef.current;
      if (!stream) return;
      stream.getTracks().forEach((track) => track.stop());
      profileAvatarDesktopCameraStreamRef.current = null;
    },
    [],
  );

  const currentUser = useMemo(() => {
    if (!identity) return null;
    const displayName = identity.name?.trim() ? identity.name : formatNameFromEmail(identity.email);
    const avatarSource = identity.name?.trim()
      ? identity.name
      : identity.email.split("@")[0] ?? identity.email;
    const knexIdLabel = identity.knexId ? formatKnexId(identity.knexId) : getKnexIdFromEmail(identity.email);
    return {
      id: "u1",
      name: displayName,
      role: "student",
      email: identity.email,
      knexIdLabel,
      avatarUrl: selfAvatarUrl,
      avatarText: getAvatarText(avatarSource),
    };
  }, [identity, selfAvatarUrl]);

  const resetChatState = useCallback(() => {
    setConversations(INITIAL_CONVERSATIONS);
    setGroups(INITIAL_GROUPS);
    setContacts(INITIAL_CONTACTS);
    setContactRequests([]);
    setHiddenThreadIds([]);
    setUnreadByThread(() => {
      const seed: Record<string, number> = {};
      INITIAL_CONVERSATIONS.forEach((thread) => {
        if (thread.unread) seed[thread.id] = thread.unread;
      });
      INITIAL_GROUPS.forEach((thread) => {
        if (thread.unread) seed[thread.id] = thread.unread;
      });
      INITIAL_CONTACTS.forEach((thread) => {
        if (thread.unread) seed[thread.id] = thread.unread;
      });
      return seed;
    });
    incomingCountRef.current = {};
    unreadInitializedRef.current = false;
    setMessagesByThread(MESSAGE_SEED);
    setMessageLoadingByThread({});
    setMessageErrorByThread({});
    messageFetchInFlightRef.current.clear();
    setSettingsState({ ...DEFAULT_SETTINGS_STATE });
    setGroupDescriptions({});
    setGroupPermissionsById({});
    setGroupAdminIdsByGroup({});
    setCustomConversationLists([]);
    setSelfAvatarUrl(null);
    setThreadAvatarOverrides({});
    setMediaLibrary(MEDIA_LIBRARY_SEED);
    setPresenceByEmail({});
    lastSeenMessageByThreadRef.current = {};
    threadsBaselineInitializedRef.current = false;
    setActiveFilter("all");
    setActiveThreadId(INITIAL_CONVERSATIONS[0]?.id ?? "");
    setIsCustomListOpen(false);
    setCustomListSearch("");
    setNewCustomListName("");
    setCustomListStep("name");
    setCustomListError(null);
    setSelectedCustomListThreadIds([]);
  }, []);

  const contactNameByEmail = useMemo(() => {
    const map = new Map<string, { name: string; avatarUrl?: string | null }>();
    const merge = (emailRaw: string, nameRaw?: string | null, avatarRaw?: string | null) => {
      const email = normalizeEmail(emailRaw);
      if (!email) return;
      const nameCandidate = normalizeName(nameRaw ?? "");
      const avatarCandidate = normalizeAvatarUrl(avatarRaw);
      const existing = map.get(email);
      const nextName = nameCandidate || existing?.name || formatNameFromEmail(email);
      const nextAvatar = avatarCandidate ?? existing?.avatarUrl ?? null;
      map.set(email, { name: nextName, avatarUrl: nextAvatar });
    };

    directoryEntries.forEach((entry) => {
      merge(entry.email, entry.name ?? null, entry.avatarUrl ?? null);
    });

    contacts.forEach((contact) => {
      const email = contact.contactEmail
        ? normalizeEmail(contact.contactEmail)
        : extractEmail(contact.preview) ?? "";
      if (!email) return;
      merge(email, contact.title, contact.avatarUrl ?? null);
    });

    conversations.forEach((thread) => {
      if (thread.tab === "groups") {
        thread.participantRoles?.forEach((participant) => {
          merge(participant.email, participant.name ?? null, participant.avatarUrl ?? null);
        });
        return;
      }
      const email = thread.contactEmail
        ? normalizeEmail(thread.contactEmail)
        : extractEmail(thread.preview) ?? "";
      if (!email) return;
      merge(email, thread.title, thread.avatarUrl ?? null);
    });

    groups.forEach((thread) => {
      thread.participantRoles?.forEach((participant) => {
        merge(participant.email, participant.name ?? null, participant.avatarUrl ?? null);
      });
    });

    if (identity?.email) {
      merge(identity.email, identity.name ?? null, selfAvatarUrl);
    }

    return map;
  }, [contacts, conversations, directoryEntries, groups, identity?.email, identity?.name, selfAvatarUrl]);
  const contactNameByEmailRef = useRef(contactNameByEmail);
  const identityEmailRef = useRef(identity?.email ? normalizeEmail(identity.email) : "");
  const selfAvatarUrlRef = useRef<string | null>(selfAvatarUrl);
  const activeThreadIdRef = useRef(activeThreadId);
  const threadsBaselineInitializedRef = useRef(false);
  const lastSeenMessageByThreadRef = useRef<Record<string, string>>({});
  const lastThreadRealtimeSyncRef = useRef(0);
  const isFetchingThreadsRef = useRef(false);
  useEffect(() => {
    contactNameByEmailRef.current = contactNameByEmail;
  }, [contactNameByEmail]);
  useEffect(() => {
    identityEmailRef.current = identity?.email ? normalizeEmail(identity.email) : "";
  }, [identity?.email]);
  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);
  useEffect(() => {
    selfAvatarUrlRef.current = selfAvatarUrl;
  }, [selfAvatarUrl]);
  useEffect(() => {
    hiddenThreadIdsRef.current = new Set(hiddenThreadIds);
  }, [hiddenThreadIds]);
  useEffect(() => {
    if (!directoryEntries.length) return;
    setPresenceByEmail((prev) => {
      let changed = false;
      const next = { ...prev };
      directoryEntries.forEach((entry) => {
        const normalizedEmail = normalizeEmail(entry.email);
        if (!normalizedEmail || !isValidEmail(normalizedEmail)) return;
        const timestamp = toTimestampMs(entry.updatedAt ?? entry.createdAt) ?? 0;
        if (!timestamp) return;
        if ((next[normalizedEmail] ?? 0) >= timestamp) return;
        next[normalizedEmail] = timestamp;
        changed = true;
      });
      return changed ? next : prev;
    });
  }, [directoryEntries]);

  const applySelfAvatarSync = useCallback(
    (avatarCandidate: string | null | undefined, emailCandidate?: string | null) => {
      const normalizedAvatar = normalizeAvatarUrl(avatarCandidate ?? null);
      if (!normalizedAvatar) return;
      if (areAvatarUrlsEqual(normalizedAvatar, selfAvatarUrlRef.current)) return;
      selfAvatarUrlRef.current = normalizedAvatar;
      setSelfAvatarUrl(normalizedAvatar);

      const normalizedEmail = normalizeEmail(emailCandidate ?? identityEmailRef.current ?? identity?.email ?? "");
      if (!normalizedEmail || !isValidEmail(normalizedEmail)) return;

      const now = new Date().toISOString();
      setDirectoryEntries((prev) => {
        const index = prev.findIndex((entry) => normalizeEmail(entry.email) === normalizedEmail);
        if (index < 0) {
          return [
            {
              email: normalizedEmail,
              ...(identity?.name ? { name: identity.name } : {}),
              avatarUrl: normalizedAvatar,
              createdAt: now,
              updatedAt: now,
            },
            ...prev,
          ];
        }
        const existing = prev[index];
        if (areAvatarUrlsEqual(existing.avatarUrl, normalizedAvatar)) return prev;
        const next = [...prev];
        next[index] = { ...existing, avatarUrl: normalizedAvatar, updatedAt: now };
        return next;
      });
    },
    [identity?.email, identity?.name],
  );

  const applyRealtimeProfileSync = useCallback(
    (entry: {
      email?: string | null;
      name?: string | null;
      avatar_url?: string | null;
      avatarUrl?: string | null;
      created_at?: string | null;
      createdAt?: string | null;
      updated_at?: string | null;
      updatedAt?: string | null;
    }) => {
      const normalizedEmail = normalizeEmail(entry?.email ?? "");
      if (!normalizedEmail || !isValidEmail(normalizedEmail)) return;
      const normalizedAvatar = normalizeAvatarUrl(entry?.avatar_url ?? entry?.avatarUrl ?? null);
      const normalizedName = normalizeName(entry?.name ?? "");
      const createdAt =
        typeof entry?.created_at === "string"
          ? entry.created_at
          : typeof entry?.createdAt === "string"
            ? entry.createdAt
            : new Date().toISOString();
      const updatedAtRaw =
        typeof entry?.updated_at === "string"
          ? entry.updated_at
          : typeof entry?.updatedAt === "string"
            ? entry.updatedAt
            : createdAt;
      const lastSeenAt = toTimestampMs(updatedAtRaw) ?? undefined;

      if (lastSeenAt) {
        setPresenceByEmail((prev) => {
          const current = prev[normalizedEmail] ?? 0;
          if (current >= lastSeenAt) return prev;
          return { ...prev, [normalizedEmail]: lastSeenAt };
        });
      }

      setDirectoryEntries((prev) => {
        const index = prev.findIndex((item) => normalizeEmail(item.email) === normalizedEmail);
        if (index < 0) {
          return [
            {
              email: normalizedEmail,
              ...(normalizedName ? { name: normalizedName } : {}),
              ...(normalizedAvatar ? { avatarUrl: normalizedAvatar } : {}),
              createdAt,
              ...(updatedAtRaw ? { updatedAt: updatedAtRaw } : {}),
            },
            ...prev,
          ];
        }
        const existing = prev[index];
        const nextAvatar = normalizedAvatar ?? existing.avatarUrl;
        const nextName = normalizedName || existing.name;
        const nextUpdatedAt = updatedAtRaw ?? existing.updatedAt;
        if (
          areAvatarUrlsEqual(existing.avatarUrl, nextAvatar) &&
          existing.name === nextName &&
          existing.updatedAt === nextUpdatedAt
        ) {
          return prev;
        }
        const next = [...prev];
        next[index] = {
          ...existing,
          ...(nextName ? { name: nextName } : {}),
          ...(nextAvatar ? { avatarUrl: nextAvatar } : {}),
          ...(nextUpdatedAt ? { updatedAt: nextUpdatedAt } : {}),
        };
        return next;
      });
      setDirectoryLookupCache((prev) => ({ ...prev, [normalizedEmail]: true }));

      const updateThreadList = (threads: Thread[]) => {
        let changed = false;
        const next = threads.map((thread) => {
          let threadChanged = false;
          let nextThread = thread;
          const contactMatch =
            (thread.tab === "contacts" || thread.tab === "conversations") &&
            getContactPrimaryKey(thread) === normalizedEmail;

          if (contactMatch) {
            const updatedThread: Thread = {
              ...nextThread,
              ...(normalizedAvatar ? { avatarUrl: normalizedAvatar } : {}),
              ...(normalizedName ? { title: normalizedName } : {}),
            };
            if (!areThreadsEqual(nextThread, updatedThread)) {
              nextThread = updatedThread;
              threadChanged = true;
            }
          }

          if (nextThread.participantRoles?.length) {
            let participantChanged = false;
            const nextParticipants = nextThread.participantRoles.map((participant) => {
              if (normalizeEmail(participant.email) !== normalizedEmail) return participant;
              const updatedParticipant = {
                ...participant,
                ...(normalizedName ? { name: normalizedName } : {}),
                ...(normalizedAvatar ? { avatarUrl: normalizedAvatar } : {}),
                ...(lastSeenAt ? { lastSeenAt } : {}),
              };
              if (
                updatedParticipant.name !== participant.name ||
                !areAvatarUrlsEqual(updatedParticipant.avatarUrl, participant.avatarUrl) ||
                updatedParticipant.lastSeenAt !== participant.lastSeenAt
              ) {
                participantChanged = true;
              }
              return updatedParticipant;
            });
            if (participantChanged) {
              nextThread = {
                ...nextThread,
                participantRoles: nextParticipants,
              };
              threadChanged = true;
            }
          }

          if (threadChanged) {
            changed = true;
            return nextThread;
          }
          return thread;
        });
        return changed ? next : threads;
      };

      setConversations((prev) => updateThreadList(prev));
      setContacts((prev) => updateThreadList(prev));
      setGroups((prev) => updateThreadList(prev));
      setMessagesByThread((prev) => {
        let changed = false;
        const next: Record<string, Message[]> = {};
        Object.entries(prev).forEach(([threadId, messages]) => {
          const mappedMessages = messages.map((message) => {
            const senderEmail = normalizeEmail(message.senderEmail ?? "");
            if (!senderEmail || senderEmail !== normalizedEmail) return message;
            const updatedMessage: Message = {
              ...message,
              ...(normalizedName ? { senderName: normalizedName } : {}),
              ...(normalizedAvatar ? { senderAvatarUrl: normalizedAvatar } : {}),
            };
            if (
              updatedMessage.senderName !== message.senderName ||
              !areAvatarUrlsEqual(updatedMessage.senderAvatarUrl, message.senderAvatarUrl)
            ) {
              changed = true;
            }
            return updatedMessage;
          });
          next[threadId] = mappedMessages;
        });
        return changed ? next : prev;
      });

      if (normalizedAvatar && normalizedEmail === identityEmailRef.current) {
        applySelfAvatarSync(normalizedAvatar, normalizedEmail);
      }
    },
    [applySelfAvatarSync],
  );

  const hiddenThreadIdSet = useMemo(() => new Set(hiddenThreadIds), [hiddenThreadIds]);
  const allThreads = useMemo(
    () => [...conversations, ...groups, ...contacts].filter((thread) => !hiddenThreadIdSet.has(thread.id)),
    [conversations, groups, contacts, hiddenThreadIdSet],
  );
  const allThreadsRef = useRef<Thread[]>([]);
  useEffect(() => {
    allThreadsRef.current = allThreads;
  }, [allThreads]);
  const isThreadOpenInActiveConversation = useCallback(
    (threadId: string, fallbackContactEmail?: string | null) => {
      const currentActiveThreadId = activeThreadIdRef.current;
      if (!currentActiveThreadId) return false;
      if (currentActiveThreadId === threadId) return true;

      const activeThread = allThreadsRef.current.find((thread) => thread.id === currentActiveThreadId) ?? null;
      if (!activeThread) return false;
      if (activeThread.tab !== "contacts" && activeThread.tab !== "conversations") return false;

      const activeContactKey = getContactPrimaryKey(activeThread);
      if (!activeContactKey) return false;

      const incomingThread = allThreadsRef.current.find((thread) => thread.id === threadId) ?? null;
      if (incomingThread && (incomingThread.tab === "contacts" || incomingThread.tab === "conversations")) {
        return getContactPrimaryKey(incomingThread) === activeContactKey;
      }

      const fallbackKey = normalizeEmail(fallbackContactEmail ?? "");
      return Boolean(fallbackKey) && fallbackKey === activeContactKey;
    },
    [],
  );
  const contactsWithMessages = useMemo(
    () =>
      contacts.filter(
        (contact) => !hiddenThreadIdSet.has(contact.id) && (messagesByThread[contact.id] ?? []).length > 0,
      ),
    [contacts, hiddenThreadIdSet, messagesByThread],
  );
  const conversationThreads = useMemo(
    () => [...conversations, ...groups, ...contactsWithMessages],
    [conversations, groups, contactsWithMessages],
  );
  const customConversationListById = useMemo(() => {
    const map = new Map<string, CustomConversationList>();
    customConversationLists.forEach((list) => map.set(list.id, list));
    return map;
  }, [customConversationLists]);
  const conversationFilterOptions = useMemo<{ key: FilterKey; label: string }[]>(
    () => [
      ...FILTERS,
      ...customConversationLists.map((list) => ({
        key: toCustomFilterKey(list.id),
        label: list.name,
      })),
    ],
    [customConversationLists],
  );
  const customListThreadCandidates = useMemo(() => {
    const directConversationKeys = new Set(conversations.map((thread) => getContactPrimaryKey(thread)));
    const sorted = [...allThreads].sort((a, b) => {
      const diff = getThreadActivityTimestamp(b) - getThreadActivityTimestamp(a);
      if (diff !== 0) return diff;
      return a.id.localeCompare(b.id);
    });
    const seenContactKeys = new Set<string>();
    return sorted.filter((thread) => {
      if (thread.tab !== "contacts") return true;
      const key = getContactPrimaryKey(thread);
      if (directConversationKeys.has(key)) return false;
      if (seenContactKeys.has(key)) return false;
      seenContactKeys.add(key);
      return true;
    });
  }, [allThreads, conversations]);
  const getUnreadCountForThread = useCallback(
    (thread: Thread) => {
      const directUnread = unreadByThread[thread.id] ?? thread.unread ?? 0;
      if (directUnread > 0) return directUnread;
      if (thread.tab !== "contacts" && thread.tab !== "conversations") return Math.max(0, directUnread);
      const contactKey = getContactPrimaryKey(thread);
      let fallbackUnread = 0;
      allThreads.forEach((candidate) => {
        if (candidate.id === thread.id) return;
        if (candidate.tab !== "contacts" && candidate.tab !== "conversations") return;
        if (getContactPrimaryKey(candidate) !== contactKey) return;
        const candidateUnread = unreadByThread[candidate.id] ?? candidate.unread ?? 0;
        if (candidateUnread > fallbackUnread) {
          fallbackUnread = candidateUnread;
        }
      });
      return fallbackUnread;
    },
    [allThreads, unreadByThread],
  );
  const filteredCustomListCandidates = useMemo(() => {
    const query = customListSearch.trim().toLowerCase();
    if (!query) return customListThreadCandidates;
    return customListThreadCandidates.filter((thread) => {
      const haystack = `${thread.title} ${thread.preview}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [customListSearch, customListThreadCandidates]);
  const selectedCustomListThreads = useMemo(
    () => customListThreadCandidates.filter((thread) => selectedCustomListThreadIds.includes(thread.id)),
    [customListThreadCandidates, selectedCustomListThreadIds],
  );
  const activeThreads = useMemo(() => {
    const conversationKeys = new Set(conversations.map((thread) => getContactPrimaryKey(thread)));
    let base = conversationThreads;
    if (isCustomFilterKey(activeFilter)) {
      const listId = getCustomFilterIdFromKey(activeFilter);
      const selectedIds = new Set(customConversationListById.get(listId)?.threadIds ?? []);
      base = allThreads.filter((thread) => selectedIds.has(thread.id));
    } else if (activeFilter === "groups") {
      base = groups;
    } else if (activeFilter === "contacts") {
      base = [...conversations, ...contactsWithMessages];
    } else if (activeFilter === "unread") {
      base = conversationThreads.filter(
        (thread) => getUnreadCountForThread(thread) > 0,
      );
    }
    const sorted = [...base]
      .filter((thread) => !hiddenThreadIdSet.has(thread.id))
      .sort((a, b) => {
        const diff = getThreadActivityTimestamp(b) - getThreadActivityTimestamp(a);
        if (diff !== 0) return diff;
        return a.id.localeCompare(b.id);
      });
    const seen = new Set<string>();
    return sorted.filter((thread) => {
      if (thread.tab !== "contacts") return true;
      const key = getContactPrimaryKey(thread);
      if (conversationKeys.has(key)) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [
    activeFilter,
    allThreads,
    contactsWithMessages,
    conversationThreads,
    conversations,
    customConversationListById,
    groups,
    hiddenThreadIdSet,
    getUnreadCountForThread,
  ]);
  useEffect(() => {
    setSelectedCustomListThreadIds((prev) => {
      if (!prev.length) return prev;
      const available = new Set(customListThreadCandidates.map((thread) => thread.id));
      const filtered = prev.filter((id) => available.has(id));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [customListThreadCandidates]);
  useEffect(() => {
    if (!isCustomFilterKey(activeFilter)) return;
    const listId = getCustomFilterIdFromKey(activeFilter);
    if (customConversationListById.has(listId)) return;
    setActiveFilter("all");
  }, [activeFilter, customConversationListById]);
  const activeThread = useMemo(() => {
    return allThreads.find((thread) => thread.id === activeThreadId) ?? activeThreads[0] ?? null;
  }, [activeThreadId, activeThreads, allThreads]);
  const activeServerThreadId = useMemo(() => {
    if (!activeThread) return "";
    if (isUuid(activeThread.id)) return activeThread.id;
    if (activeThread.tab !== "contacts" && activeThread.tab !== "conversations") return "";
    const targetEmail = activeThread.contactEmail
      ? normalizeEmail(activeThread.contactEmail)
      : extractEmail(activeThread.preview) ?? "";
    if (!targetEmail) return "";
    const serverThread = conversations.find((thread) => {
      if (!isUuid(thread.id)) return false;
      if (thread.tab !== "conversations") return false;
      const threadEmail = thread.contactEmail ? normalizeEmail(thread.contactEmail) : extractEmail(thread.preview) ?? "";
      return Boolean(threadEmail && threadEmail === targetEmail);
    });
    return serverThread?.id ?? "";
  }, [activeThread, conversations]);
  const unreadTotal = useMemo(
    () => {
      const seenDirectKeys = new Set<string>();
      return allThreads.reduce((total, thread) => {
        if (thread.tab === "contacts" || thread.tab === "conversations") {
          const key = getContactPrimaryKey(thread);
          if (seenDirectKeys.has(key)) return total;
          seenDirectKeys.add(key);
        }
        const unread = getUnreadCountForThread(thread);
        return total + Math.max(0, unread);
      }, 0);
    },
    [allThreads, getUnreadCountForThread],
  );
  const unreadTotalLabel = unreadTotal > 99 ? "99+" : String(unreadTotal);
  const mobileProfileHeaderFade = Math.min(Math.max(mobileProfileSheetScrollY / 72, 0), 1);
  const isMobileProfileHeaderCompact = mobileProfileSheetScrollY > 28;
  const handleMobileProfileSheetScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const next = event.currentTarget.scrollTop;
    setMobileProfileSheetScrollY((prev) => (Math.abs(prev - next) < 0.5 ? prev : next));
  }, []);
  const filteredActiveThreads = useMemo(() => {
    const query = conversationSearch.trim().toLowerCase();
    if (!query) return activeThreads;
    return activeThreads.filter((thread) => {
      const haystack = `${thread.title} ${thread.preview}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [activeThreads, conversationSearch]);
  const contactEmailSet = useMemo(() => {
    const next = new Set<string>();
    contacts.forEach((contact) => {
      const email = contact.contactEmail
        ? normalizeEmail(contact.contactEmail)
        : extractEmail(contact.preview) ?? "";
      if (email) next.add(email);
    });
    return next;
  }, [contacts]);
  const contactByEmail = useMemo(() => {
    const next = new Map<string, Thread>();
    contacts.forEach((contact) => {
      const email = contact.contactEmail
        ? normalizeEmail(contact.contactEmail)
        : extractEmail(contact.preview) ?? "";
      if (email) next.set(email, contact);
    });
    return next;
  }, [contacts]);
  const directoryPeople = useMemo<DirectoryPerson[]>(() => {
    const byEmail = new Map<string, DirectoryPerson>();
    const addPerson = (email: string, name?: string, isSelf?: boolean, avatarRaw?: string | null) => {
      const normalized = normalizeEmail(email);
      if (!normalized) return;
      const fallbackInfo = contactNameByEmail.get(normalized);
      const displayName =
        (name?.trim() ? name.trim() : "") ||
        fallbackInfo?.name ||
        formatNameFromEmail(normalized);
      const avatarUrl = normalizeAvatarUrl(avatarRaw) ?? fallbackInfo?.avatarUrl ?? null;
      const existing = byEmail.get(normalized);
      if (existing) {
        if (!existing.name && displayName) existing.name = displayName;
        if (!existing.avatarUrl && avatarUrl) existing.avatarUrl = avatarUrl;
        if (isSelf) existing.isSelf = true;
        return;
      }
      byEmail.set(normalized, {
        email: normalized,
        name: displayName,
        knexId: getKnexIdFromEmail(normalized),
        avatarUrl,
        isSelf,
      });
    };
    directoryEntries.forEach((entry) => addPerson(entry.email, entry.name, false, entry.avatarUrl ?? null));
    contacts.forEach((contact) => {
      const email = contact.contactEmail
        ? normalizeEmail(contact.contactEmail)
        : extractEmail(contact.preview) ?? "";
      if (!email) return;
      addPerson(email, contact.title, false, contact.avatarUrl ?? null);
    });
    groups.forEach((group) => {
      group.participantRoles?.forEach((participant) => {
        addPerson(participant.email, participant.name ?? undefined, false, participant.avatarUrl ?? null);
      });
    });
    if (identity?.email) {
      addPerson(identity.email, identity.name ?? undefined, true, selfAvatarUrl);
    }
    const list = Array.from(byEmail.values());
    list.sort((a, b) => {
      if (a.isSelf && !b.isSelf) return -1;
      if (!a.isSelf && b.isSelf) return 1;
      return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
    });
    return list;
  }, [contactNameByEmail, contacts, directoryEntries, groups, identity?.email, identity?.name, selfAvatarUrl]);
  const filteredDirectoryPeople = useMemo(() => {
    const query = directorySearch.trim().toLowerCase();
    if (!query) return directoryPeople;
    return directoryPeople.filter((person) => {
      const haystack = `${person.name} ${person.knexId} ${person.email}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [directoryPeople, directorySearch]);
  const contactRequestByEmail = useMemo(() => {
    const next = new Map<string, ContactRequest>();
    contactRequests.forEach((request) => {
      next.set(normalizeEmail(request.email), request);
    });
    return next;
  }, [contactRequests]);
  const incomingRequests = useMemo(
    () => contactRequests.filter((request) => request.direction === "incoming"),
    [contactRequests],
  );
  const outgoingRequests = useMemo(
    () => contactRequests.filter((request) => request.direction === "outgoing"),
    [contactRequests],
  );
  const baseContacts = useMemo(
    () =>
      contacts.map((contact) => ({
        id: contact.id,
        title: contact.title,
        preview: contact.preview,
        avatarUrl: contact.avatarUrl ?? null,
        contactEmail: contact.contactEmail ?? null,
      })),
    [contacts],
  );
  const sortedBaseContacts = useMemo(
    () => [...baseContacts].sort((a, b) => a.title.localeCompare(b.title, "pt-BR", { sensitivity: "base" })),
    [baseContacts],
  );
  const newChatContacts = useMemo(() => {
    if (!currentUser) return sortedBaseContacts;
    return [
      {
        id: "self-contact",
        title: `${currentUser.name} (você)`,
        preview: "Mensagens para mim",
        avatarUrl: currentUser.avatarUrl ?? null,
        contactEmail: currentUser.email ?? null,
      },
      ...sortedBaseContacts,
    ];
  }, [currentUser, sortedBaseContacts]);
  const isDirectoryEmail = useCallback(
    (email: string) => {
      const normalized = normalizeEmail(email);
      if (!normalized) return false;
      if (directoryLookupCache[normalized] !== undefined) {
        return directoryLookupCache[normalized];
      }
      return directoryEntries.some((entry) => normalizeEmail(entry.email) === normalized);
    },
    [directoryEntries, directoryLookupCache],
  );
  const groupContacts = useMemo(() => {
    if (!serverMessagingEnabled) return sortedBaseContacts;
    return sortedBaseContacts.filter((contact) => {
      const contactEmail = contact.contactEmail
        ? normalizeEmail(contact.contactEmail)
        : extractEmail(contact.preview) ?? "";
      if (!contactEmail) return false;
      return isDirectoryEmail(contactEmail);
    });
  }, [isDirectoryEmail, serverMessagingEnabled, sortedBaseContacts]);
  const filteredNewChatContacts = useMemo(() => {
    const query = newChatSearch.trim().toLowerCase();
    if (!query) return newChatContacts;
    const filtered = newChatContacts.filter((contact) => {
      const haystack = `${contact.title} ${contact.preview}`.toLowerCase();
      return haystack.includes(query);
    });
    const selfContact = filtered.find((contact) => contact.id === "self-contact") ?? null;
    const others = filtered.filter((contact) => contact.id !== "self-contact");
    return selfContact ? [selfContact, ...others] : others;
  }, [newChatContacts, newChatSearch]);
  useEffect(() => {
    if (serverMessagingEnabled) return;
    const incomingMessageCount = (threadId: string) =>
      (messagesByThread[threadId] ?? []).reduce((total, message) => total + (message.author === "me" ? 0 : 1), 0);
    const nextIncoming = { ...incomingCountRef.current };
    if (!unreadInitializedRef.current) {
      allThreads.forEach((thread) => {
        const totalCount = incomingMessageCount(thread.id);
        nextIncoming[thread.id] = totalCount;
      });
      incomingCountRef.current = nextIncoming;
      unreadInitializedRef.current = true;
      return;
    }
    const increments: Record<string, number> = {};
    allThreads.forEach((thread) => {
      const totalCount = incomingMessageCount(thread.id);
      const previous = incomingCountRef.current[thread.id] ?? 0;
      if (totalCount > previous) {
        increments[thread.id] = totalCount - previous;
      }
      nextIncoming[thread.id] = totalCount;
    });
    incomingCountRef.current = nextIncoming;
    if (!Object.keys(increments).length) return;
    setUnreadByThread((prev) => {
      const next = { ...prev };
      let changed = false;
      Object.entries(increments).forEach(([id, delta]) => {
        if (id === activeThreadId) {
          if (next[id]) {
            next[id] = 0;
            changed = true;
          }
          return;
        }
        next[id] = (next[id] ?? 0) + delta;
        changed = true;
      });
      return changed ? next : prev;
    });
  }, [activeThreadId, allThreads, messagesByThread, serverMessagingEnabled]);
  useEffect(() => {
    if (!activeThreadId) return;
    const activeThreadForRead = allThreads.find((thread) => thread.id === activeThreadId) ?? null;
    if (!activeThreadForRead) return;
    const idsToClear = new Set<string>([activeThreadId]);
    if (activeThreadForRead.tab === "contacts" || activeThreadForRead.tab === "conversations") {
      const activeContactKey = getContactPrimaryKey(activeThreadForRead);
      allThreads.forEach((thread) => {
        if (thread.tab !== "contacts" && thread.tab !== "conversations") return;
        if (getContactPrimaryKey(thread) !== activeContactKey) return;
        idsToClear.add(thread.id);
      });
    }
    setUnreadByThread((prev) => {
      let changed = false;
      const next = { ...prev };
      idsToClear.forEach((id) => {
        if (!next[id]) return;
        next[id] = 0;
        changed = true;
      });
      return changed ? next : prev;
    });
    const nextIncoming = { ...incomingCountRef.current };
    idsToClear.forEach((id) => {
      const incomingCount = (messagesByThread[id] ?? []).reduce(
        (total, message) => total + (message.author === "me" ? 0 : 1),
        0,
      );
      nextIncoming[id] = incomingCount;
    });
    incomingCountRef.current = nextIncoming;
  }, [activeThreadId, allThreads, messagesByThread]);
  const isShareAudioLimitReached = shareAudioFiles.length >= shareAudioLimit;
  const selectableGroupContacts = useMemo(() => {
    if (groupMemberPickerMode !== "add") return groupContacts;
    if (!activeThread || activeThread.tab !== "groups") return sortedBaseContacts;
    const existingEmails = new Set<string>();
    (activeThread.participantRoles ?? []).forEach((participant) => {
      const normalized = normalizeEmail(participant.email);
      if (normalized && isValidEmail(normalized)) {
        existingEmails.add(normalized);
      }
    });
    const selfEmail = identity?.email ? normalizeEmail(identity.email) : "";
    if (selfEmail && isValidEmail(selfEmail)) {
      existingEmails.add(selfEmail);
    }
    return sortedBaseContacts.filter((contact) => {
      const contactEmail = contact.contactEmail
        ? normalizeEmail(contact.contactEmail)
        : extractEmail(contact.preview) ?? "";
      if (!contactEmail || !isValidEmail(contactEmail)) return false;
      return !existingEmails.has(contactEmail);
    });
  }, [activeThread, groupContacts, groupMemberPickerMode, identity?.email, sortedBaseContacts]);
  const filteredGroupContacts = useMemo(() => {
    const query = newGroupSearch.trim().toLowerCase();
    if (!query) return selectableGroupContacts;
    return selectableGroupContacts.filter((contact) => {
      const haystack = `${contact.title} ${contact.preview}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [newGroupSearch, selectableGroupContacts]);
  const selectedGroupMembers = useMemo(
    () => selectableGroupContacts.filter((contact) => selectedGroupMemberIds.includes(contact.id)),
    [selectableGroupContacts, selectedGroupMemberIds],
  );
  const threadLookup = useMemo(() => {
    const map = new Map<string, Thread>();
    allThreads.forEach((thread) => {
      map.set(thread.id, thread);
    });
    return map;
  }, [allThreads]);
  const mediaItems = useMemo(
    () => {
      const mapped = mediaLibrary.map((item) => ({
        ...item,
        thread: threadLookup.get(item.threadId) ?? null,
      }));
      const filteredBySender = mapped.filter((item) => {
        if (mediaFilterSender === "all") return true;
        if (mediaFilterSender === "me") return item.caption?.toLowerCase().includes("você") ?? false;
        return !item.caption?.toLowerCase().includes("você");
      });
      const sorted = [...filteredBySender];
      if (mediaFilterOrder === "old") {
        sorted.reverse();
      } else if (mediaFilterOrder === "big") {
        sorted.sort((a, b) => a.label.localeCompare(b.label));
      }
      return sorted;
    },
    [mediaLibrary, threadLookup, mediaFilterOrder, mediaFilterSender],
  );
  const shareCommunityItems = useMemo(
    () => [
      {
        id: "comm-uab",
        title: "Comunidade Polo UAB Rio Branco",
        preview: "Avisos",
        avatarUrl: null,
      },
      {
        id: "comm-ufac",
        title: "Ufac - Especialização em Educação",
        preview: "~ Escobar: Tranquilo, obrigado pensei que já estav...",
        avatarUrl: null,
      },
    ],
    [],
  );
  const shareForumItems = useMemo(
    () => [
      {
        id: "forum-knex",
        title: "Fórum KnexChat",
        preview: "Fórum",
        avatarUrl: null,
      },
    ],
    [],
  );
  const shareRecentContacts = useMemo(() => {
    const query = shareSearch.trim().toLowerCase();
    const base = conversationThreads;
    if (!query) return base;
    return base.filter((contact) => {
      const haystack = `${contact.title} ${contact.preview}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [conversationThreads, shareSearch]);
  const shareDirectoryContacts = useMemo(() => {
    const query = shareSearch.trim().toLowerCase();
    const items = [
      ...(currentUser
        ? [
            {
              id: "self-contact",
              title: `${currentUser.name} (você)`,
              preview: "Mensagens para mim",
              avatarUrl: currentUser.avatarUrl ?? null,
            },
          ]
        : []),
      ...contacts,
      ...groups,
      ...shareCommunityItems,
      ...shareForumItems,
    ];
    const map = new Map<string, typeof items[number]>();
    items.forEach((item) => {
      if (!map.has(item.id)) {
        map.set(item.id, item);
      }
    });
    const all = Array.from(map.values());
    if (!query) return all;
    return all.filter((contact) => {
      const haystack = `${contact.title} ${contact.preview}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [contacts, currentUser, groups, shareCommunityItems, shareForumItems, shareSearch]);
  const shareAllSelectable = useMemo(() => {
    const map = new Map<string, { id: string; title: string; preview?: string; avatarUrl?: string | null }>();
    [...shareRecentContacts, ...shareDirectoryContacts].forEach((item) => {
      if (!map.has(item.id)) {
        map.set(item.id, item);
      }
    });
    return Array.from(map.values());
  }, [shareDirectoryContacts, shareRecentContacts]);
  const clearShareAudios = useCallback(() => {
    setShareAudioFiles((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.url));
      return [];
    });
    if (shareAudioPlayerRef.current) {
      shareAudioPlayerRef.current.pause();
      shareAudioPlayerRef.current = null;
    }
    setShareAudioPlayingId(null);
  }, []);
  const handleShareSend = useCallback(() => {
    if (!selectedShareContactIds.length) return;
    const activityAt = Date.now();
    const timeLabel = formatClockLabel(activityAt) || "Agora";
    const trimmedMessage = shareMessage.trim();
    const mediaToShare = mediaLibrary.filter((item) => selectedMediaIds.includes(item.id));
    const audioToShare = shareAudioFiles;
    const resolveTitle = (id: string) =>
      shareAllSelectable.find((item) => item.id === id)?.title ?? "Participante";
    const resolveAvatar = (id: string) =>
      shareAllSelectable.find((item) => item.id === id)?.avatarUrl ?? null;
    const previewByRecipient = new Map<string, string>();
    const resolveRecipientTab = (id: string): TabKey => {
      if (conversations.some((thread) => thread.id === id)) return "conversations";
      if (groups.some((thread) => thread.id === id)) return "groups";
      if (contacts.some((thread) => thread.id === id)) return "contacts";
      if (id.startsWith("comm-") || id.startsWith("forum-")) return "groups";
      return "contacts";
    };
    const recipientsByTab: Record<TabKey, string[]> = {
      conversations: [],
      groups: [],
      contacts: [],
    };
    selectedShareContactIds.forEach((id) => {
      recipientsByTab[resolveRecipientTab(id)].push(id);
    });

    setMessagesByThread((prev) => {
      const next = { ...prev };
      selectedShareContactIds.forEach((recipientId) => {
        const existing = next[recipientId] ?? [];
        const outgoing: Message[] = [];
        if (trimmedMessage && !mediaToShare.length && !audioToShare.length) {
          outgoing.push({
            id: `m_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            author: "me",
            body: trimmedMessage,
            time: timeLabel,
            sentAt: activityAt,
          });
        }
        mediaToShare.forEach((item, index) => {
          const body =
            trimmedMessage && mediaToShare.length === 1 && !audioToShare.length
              ? trimmedMessage
              : item.caption ?? item.label ?? `Mídia ${index + 1}`;
          outgoing.push({
            id: `m_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            author: "me",
            body,
            time: timeLabel,
            sentAt: activityAt,
            imageUrl: item.src,
            imageName: item.label,
          });
        });
        audioToShare.forEach((entry) => {
          const audioUrl = URL.createObjectURL(entry.file);
          outgoing.push({
            id: `m_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            author: "me",
            body: trimmedMessage || "Mensagem de áudio",
            time: timeLabel,
            sentAt: activityAt,
            audioUrl,
            audioDuration: entry.duration,
          });
        });
        if (outgoing.length) {
          next[recipientId] = [...existing, ...outgoing];
          const last = outgoing[outgoing.length - 1];
          const preview =
            last.imageUrl ? "Imagem enviada" : last.audioUrl ? "Mensagem de áudio" : last.body || "Mensagem enviada";
          previewByRecipient.set(recipientId, preview);
        }
      });
      return next;
    });

    setMediaLibrary((prev) => {
      if (!mediaToShare.length) return prev;
      const forwarded: MediaItem[] = [];
      selectedShareContactIds.forEach((recipientId) => {
        mediaToShare.forEach((item) => {
          forwarded.push({
            ...item,
            id: `media_${Date.now()}_${recipientId}_${item.id}`,
            threadId: recipientId,
            caption: `Encaminhado por ${currentUser?.name ?? "Você"}`,
          });
        });
      });
      return [...forwarded, ...prev];
    });

    const upsertThread =
      (tab: TabKey, ids: string[]) =>
      (threads: Thread[]) => {
        if (!ids.length) return threads;
        let updated = threads;
        ids.forEach((recipientId) => {
          const exists = updated.some((thread) => thread.id === recipientId);
          if (exists) {
            updated = updated.map((thread) =>
              thread.id === recipientId
                ? {
                    ...thread,
                    preview: previewByRecipient.get(recipientId) ?? thread.preview,
                    lastActivity: timeLabel,
                    lastActivityAt: activityAt,
                  }
                : thread,
            );
            return;
          }
          const title = resolveTitle(recipientId);
          updated = [
            {
              id: recipientId,
              title,
              preview: previewByRecipient.get(recipientId) ?? "Mensagem enviada",
              lastActivity: timeLabel,
              lastActivityAt: activityAt,
              tab,
              avatarUrl: resolveAvatar(recipientId) ?? undefined,
            },
            ...updated,
          ];
        });
        return updated;
      };

    setConversations(upsertThread("conversations", recipientsByTab.conversations));
    setGroups(upsertThread("groups", recipientsByTab.groups));
    setContacts(upsertThread("contacts", recipientsByTab.contacts));

    setShareMessage("");
    setShareSearch("");
    setSelectedShareContactIds([]);
    setSelectedMediaIds([]);
    setIsMediaSelectMode(false);
    clearShareAudios();
  }, [
    clearShareAudios,
    currentUser?.name,
    contacts,
    conversations,
    groups,
    mediaLibrary,
    selectedMediaIds,
    selectedShareContactIds,
    setContacts,
    setConversations,
    setGroups,
    setMediaLibrary,
    setMessagesByThread,
    shareAllSelectable,
    shareAudioFiles,
    shareMessage,
  ]);
  const selectedMediaSummary = useMemo(() => {
    const totalKb = selectedMediaIds.reduce((sum, id) => {
      const match = mediaLibrary.find((item) => item.id === id);
      return sum + (match?.sizeKb ?? 0);
    }, 0);
    return {
      count: selectedMediaIds.length,
      sizeLabel: formatMediaSize(totalKb),
    };
  }, [mediaLibrary, selectedMediaIds]);

  const handleFavoriteSelected = useCallback(() => {
    if (!selectedMediaIds.length) return;
    setMediaLibrary((prev) => {
      const selectedSet = new Set(selectedMediaIds);
      const allFavorited = prev
        .filter((item) => selectedSet.has(item.id))
        .every((item) => item.isFavorite);
      return prev.map((item) =>
        selectedSet.has(item.id) ? { ...item, isFavorite: !allFavorited } : item,
      );
    });
  }, [selectedMediaIds]);

  const handleDownloadSelected = useCallback(async () => {
    if (!selectedMediaIds.length) return;
    const items = mediaLibrary.filter((item) => selectedMediaIds.includes(item.id));
    for (const item of items) {
      const filename = item.label ? `${item.label.replace(/\s+/g, "_")}.jpg` : "imagem.jpg";
      try {
        const response = await fetch(item.src);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      } catch {
        const link = document.createElement("a");
        link.href = item.src;
        link.target = "_blank";
        link.rel = "noreferrer";
        link.click();
      }
    }
  }, [mediaLibrary, selectedMediaIds]);

  useEffect(() => {
    if (!isNewGroupCreateOpen) {
      setIsGroupEmojiOpen(false);
    }
  }, [isNewGroupCreateOpen]);

  useEffect(() => {
    if (!isGroupEmojiOpen) {
      setGroupEmojiMenuStyle(null);
      return;
    }
    if (!groupEmojiAnchorRef.current) return;
    const margin = 12;
    const updatePosition = () => {
      if (!groupEmojiAnchorRef.current) return;
      const anchor = groupEmojiAnchorRef.current.getBoundingClientRect();
      const effectiveWidth = Math.min(groupEmojiSize.width, Math.floor(window.innerWidth * 0.8));
      const effectiveHeight = Math.min(groupEmojiSize.height, Math.floor(window.innerHeight * 0.8));
      let left = anchor.right + margin;
      if (left + effectiveWidth > window.innerWidth - margin) {
        left = window.innerWidth - effectiveWidth - margin;
      }
      if (left < margin) {
        left = margin;
      }
      let top = anchor.bottom + margin;
      if (top + effectiveHeight > window.innerHeight - margin) {
        top = anchor.top - effectiveHeight - margin;
      }
      if (top < margin) {
        top = margin;
      }
      setGroupEmojiMenuStyle({ left, top });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isGroupEmojiOpen, groupEmojiSize.width, groupEmojiSize.height]);

  useEffect(() => {
    if (!isGroupEmojiOpen || !groupEmojiMenuRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const nextWidth = Math.round(entry.contentRect.width);
      const nextHeight = Math.round(entry.contentRect.height);
      setGroupEmojiSize((prev) => {
        if (prev.width === nextWidth && prev.height === nextHeight) return prev;
        return { width: nextWidth, height: nextHeight };
      });
    });
    observer.observe(groupEmojiMenuRef.current);
    return () => observer.disconnect();
  }, [isGroupEmojiOpen]);

  useEffect(() => {
    if (!isGroupEmojiResizing) return;
    const handleMove = (event: MouseEvent) => {
      if (!groupEmojiResizeRef.current) return;
      const { startX, startY, startWidth, startHeight } = groupEmojiResizeRef.current;
      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;
      const maxWidth = Math.floor(window.innerWidth * 0.8);
      const maxHeight = Math.floor(window.innerHeight * 0.8);
      const nextWidth = Math.min(Math.max(startWidth + deltaX, 280), maxWidth);
      const nextHeight = Math.min(Math.max(startHeight + deltaY, 240), maxHeight);
      setGroupEmojiSize({ width: nextWidth, height: nextHeight });
    };
    const handleUp = () => {
      setIsGroupEmojiResizing(false);
      groupEmojiResizeRef.current = null;
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isGroupEmojiResizing]);
  useEffect(() => {
    if (!isChatListResizing) return;
    const handleMove = (event: MouseEvent) => {
      if (!chatListResizeRef.current) return;
      const { startX, startWidth } = chatListResizeRef.current;
      const deltaX = event.clientX - startX;
      const minWidth = 280;
      const maxWidth = Math.floor(window.innerWidth * 0.6);
      const nextWidth = Math.min(Math.max(startWidth + deltaX, minWidth), maxWidth);
      setChatListWidth(nextWidth);
    };
    const handleUp = () => {
      setIsChatListResizing(false);
      chatListResizeRef.current = null;
    };
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isChatListResizing]);
  useEffect(() => {
    if (!activeThread || activeThread.tab === "groups") {
      setIsContactInfoOpen(false);
    }
  }, [activeThread]);
  useEffect(() => {
    if (!activeThread || activeThread.tab !== "groups") {
      setIsGroupInfoOpen(false);
      setIsGroupPermissionsOpen(false);
      setIsGroupAdminsModalOpen(false);
    }
  }, [activeThread]);
  useEffect(() => {
    if (isProfileOpen) {
      setIsContactInfoOpen(false);
      setIsGroupInfoOpen(false);
    }
  }, [isProfileOpen]);
  useEffect(() => {
    if (!isContactInfoOpen) {
      setIsContactEditOpen(false);
    }
  }, [isContactInfoOpen]);
  useEffect(() => {
    if (!isGroupInfoOpen) {
      setIsGroupPermissionsOpen(false);
      setIsGroupAdminsModalOpen(false);
      setIsGroupMemberModalOpen(false);
    }
  }, [isGroupInfoOpen]);
  useEffect(() => {
    if (!isGroupMemberModalOpen) return;
    if (!activeThread || activeThread.tab !== "groups") {
      setIsGroupMemberModalOpen(false);
    }
  }, [activeThread, isGroupMemberModalOpen]);
  useEffect(() => {
    if (isNewGroupOpen) return;
    setGroupMemberPickerMode("create");
    setNewGroupSearch("");
  }, [isNewGroupOpen]);
  useEffect(() => {
    if (!activeThread || activeThread.tab !== "groups") return;
    setGroupNameDraft(activeThread.title ?? "");
    setIsGroupNameEditing(false);
    if (groupNameInputRef.current) {
      groupNameInputRef.current.style.height = "auto";
    }
    const current = groupDescriptions[activeThread.id] ?? "";
    setGroupDescriptionDraft(current);
    setIsGroupDescriptionEditing(false);
  }, [activeThread, groupDescriptions]);
  const isNewContactPhoneValid = useMemo(() => {
    const digits = newContactPhone.replace(/\D/g, "");
    return digits.length >= 10;
  }, [newContactPhone]);
  const normalizedNewContactEmail = useMemo(() => {
    const trimmed = newContactEmail.trim();
    if (!trimmed || !isValidEmail(trimmed)) return "";
    return normalizeEmail(trimmed);
  }, [newContactEmail]);
  const isNewContactEmailValid = useMemo(() => {
    return Boolean(normalizedNewContactEmail);
  }, [normalizedNewContactEmail]);
  const isNewContactRegistered = useMemo(() => {
    if (!normalizedNewContactEmail) return false;
    if (directoryLookupCache[normalizedNewContactEmail] !== undefined) {
      return directoryLookupCache[normalizedNewContactEmail];
    }
    return directoryEntries.some(
      (entry) => normalizeEmail(entry.email) === normalizedNewContactEmail,
    );
  }, [directoryEntries, directoryLookupCache, normalizedNewContactEmail]);
  const isNewContactReady = useMemo(
    () => isNewContactEmailValid,
    [isNewContactEmailValid],
  );
  const openThreadById = useCallback(
    (threadId: string) => {
      setActiveThreadId((prev) => (prev === threadId ? prev : threadId));
      if (isMobileView) {
        setIsMobileDetailOpen(true);
      }
      if (activeNavKey !== "conversations") setActiveNavKey("conversations");
      if (isSettingsOpen) setIsSettingsOpen(false);
      if (activeSettingKey !== null) setActiveSettingKey(null);
      if (isDirectoryOpen) setIsDirectoryOpen(false);
      if (isDirectoryFiltersOpen) setIsDirectoryFiltersOpen(false);
      if (isNewChatOpen) setIsNewChatOpen(false);
      if (isCustomListOpen) setIsCustomListOpen(false);
      if (isNewChatEmailOpen) setIsNewChatEmailOpen(false);
      if (isNewGroupOpen) setIsNewGroupOpen(false);
      if (isNewGroupCreateOpen) setIsNewGroupCreateOpen(false);
      if (isCommunityListOpen) setIsCommunityListOpen(false);
      if (isGroupsPanelOpen) setIsGroupsPanelOpen(false);
      if (isGroupCreateOpen) setIsGroupCreateOpen(false);
      if (isNewContactOpen) setIsNewContactOpen(false);
      if (isGroupsExpanded) setIsGroupsExpanded(false);
      if (selectedGroupMemberIds.length) setSelectedGroupMemberIds([]);
      if (isProfileOpen) setIsProfileOpen(false);
      if (profileTarget !== null) setProfileTarget(null);
      if (isProfileAvatarPreviewOpen) setIsProfileAvatarPreviewOpen(false);
      if (isThreadMenuOpen) setIsThreadMenuOpen(false);
      if (desktopConversationContextMenu) setDesktopConversationContextMenu(null);
      if (isContactInfoOpen) setIsContactInfoOpen(false);
      if (isContactEditOpen) setIsContactEditOpen(false);
      if (isGroupInfoOpen) setIsGroupInfoOpen(false);
      if (isGroupPermissionsOpen) setIsGroupPermissionsOpen(false);
      if (isGroupAdminsModalOpen) setIsGroupAdminsModalOpen(false);
      if (isMobileView) {
        const isWebRoute = pathname?.startsWith("/knexchat/web");
        if (!isWebRoute || threadParam !== threadId) {
          const nextRoute = buildKnexchatWebHref(searchQuery, threadId);
          router.replace(nextRoute, { scroll: false });
        }
      }
    },
    [
      activeNavKey,
      activeSettingKey,
      isContactEditOpen,
      isContactInfoOpen,
      isCustomListOpen,
      isDirectoryFiltersOpen,
      isDirectoryOpen,
      isGroupAdminsModalOpen,
      isGroupCreateOpen,
      isGroupInfoOpen,
      isGroupPermissionsOpen,
      isGroupsExpanded,
      isGroupsPanelOpen,
      isMobileView,
      isNewChatEmailOpen,
      isNewChatOpen,
      isNewContactOpen,
      isNewGroupCreateOpen,
      isNewGroupOpen,
      isProfileAvatarPreviewOpen,
      isProfileOpen,
      isSettingsOpen,
      isThreadMenuOpen,
      isCommunityListOpen,
      desktopConversationContextMenu,
      pathname,
      profileTarget,
      router,
      searchQuery,
      selectedGroupMemberIds.length,
      threadParam,
    ],
  );
  const unhideThreadById = useCallback((threadId: string) => {
    setHiddenThreadIds((prev) => (prev.includes(threadId) ? prev.filter((id) => id !== threadId) : prev));
  }, []);
  const dismissConversationThread = useCallback(
    (thread: Thread, options?: { clearMessages?: boolean }) => {
      const clearMessages = Boolean(options?.clearMessages);
      setHiddenThreadIds((prev) => (prev.includes(thread.id) ? prev : [thread.id, ...prev]));

      if (thread.tab === "conversations") {
        setConversations((prev) => prev.filter((item) => item.id !== thread.id));
      } else if (thread.tab === "groups") {
        setGroups((prev) => prev.filter((item) => item.id !== thread.id));
      }

      if (clearMessages) {
        if (thread.tab === "contacts") {
          setContacts((prev) =>
            prev.map((contact) =>
              contact.id === thread.id
                ? {
                    ...contact,
                    preview: contact.contactEmail ?? contact.preview ?? "Conversa apagada",
                    lastActivity: "",
                    lastActivityAt: 0,
                  }
                : contact,
            ),
          );
        }
        setMessagesByThread((prev) => {
          if (!(thread.id in prev)) return prev;
          const next = { ...prev };
          if (thread.tab === "contacts") {
            next[thread.id] = [];
          } else {
            delete next[thread.id];
          }
          return next;
        });
      }

      setUnreadByThread((prev) => {
        if (!(thread.id in prev)) return prev;
        const next = { ...prev };
        delete next[thread.id];
        return next;
      });

      if (activeThreadId === thread.id) {
        setActiveThreadId("");
      }
    },
    [activeThreadId],
  );
  const openDesktopConversationContextMenu = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>, thread: Thread) => {
      if (isMobileView) return;
      event.preventDefault();
      event.stopPropagation();
      if (isThreadMenuOpen) {
        setIsThreadMenuOpen(false);
      }
      const menuWidth = 272;
      const menuHeight = 360;
      const viewportPadding = 8;
      const maxX = Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding);
      const maxY = Math.max(viewportPadding, window.innerHeight - menuHeight - viewportPadding);
      const x = Math.min(Math.max(event.clientX, viewportPadding), maxX);
      const y = Math.min(Math.max(event.clientY, viewportPadding), maxY);
      setDesktopConversationContextMenu({ threadId: thread.id, threadTab: thread.tab, x, y });
    },
    [isMobileView, isThreadMenuOpen],
  );
  const handleDesktopConversationContextAction = useCallback(
    async (action: DesktopConversationContextAction) => {
      const menu = desktopConversationContextMenu;
      if (!menu) return;

      const thread =
        allThreadsRef.current.find((item) => item.id === menu.threadId) ??
        conversations.find((item) => item.id === menu.threadId) ??
        groups.find((item) => item.id === menu.threadId) ??
        contacts.find((item) => item.id === menu.threadId) ??
        null;

      if (!thread) {
        setDesktopConversationContextMenu(null);
        return;
      }

      if (action === "archive") {
        dismissConversationThread(thread, { clearMessages: false });
      } else if (action === "pin") {
        const moveToTop = (items: Thread[]) => {
          const index = items.findIndex((item) => item.id === thread.id);
          if (index <= 0) return items;
          const next = [...items];
          const [current] = next.splice(index, 1);
          next.unshift(current);
          return next;
        };
        if (thread.tab === "groups") {
          setGroups((prev) => moveToTop(prev));
        } else if (thread.tab === "conversations") {
          setConversations((prev) => moveToTop(prev));
        } else {
          setContacts((prev) => moveToTop(prev));
        }
        unhideThreadById(thread.id);
      } else if (action === "mark-unread") {
        setUnreadByThread((prev) => ({
          ...prev,
          [thread.id]: Math.max(1, prev[thread.id] ?? thread.unread ?? 0),
        }));
      } else if (action === "close") {
        if (activeThreadId === thread.id) {
          setActiveThreadId("");
        }
      } else if (action === "delete" || action === "leave-group") {
        const isLeaveGroupAction = action === "leave-group";
        if (serverMessagingEnabled && isUuid(thread.id)) {
          try {
            const token = authSession?.access_token ?? null;
            const headers = token ? ({ Authorization: `Bearer ${token}` } as HeadersInit) : undefined;
            const response = await fetch(`/api/knexchat/threads?threadId=${encodeURIComponent(thread.id)}`, {
              method: "DELETE",
              ...(headers ? { headers } : {}),
            });
            if (!response.ok) {
              setMessageSendNotice(
                isLeaveGroupAction
                  ? "Não foi possível sair do grupo agora."
                  : "Não foi possível apagar essa conversa agora.",
              );
              setDesktopConversationContextMenu(null);
              return;
            }
          } catch {
            setMessageSendNotice(
              isLeaveGroupAction
                ? "Não foi possível sair do grupo agora."
                : "Não foi possível apagar essa conversa agora.",
            );
            setDesktopConversationContextMenu(null);
            return;
          }
        }
        dismissConversationThread(thread, { clearMessages: true });
        if (serverMessagingEnabled && isUuid(thread.id)) {
          setRealtimeKey((prev) => prev + 1);
        }
      } else if (action === "lock") {
        setMessageSendNotice("Trancar conversa ficará disponível em breve.");
      } else if (action === "mute") {
        setMessageSendNotice("Silenciar notificações ficará disponível em breve.");
      } else if (action === "block") {
        setMessageSendNotice("Bloquear contato ficará disponível em breve.");
      }

      setDesktopConversationContextMenu(null);
    },
    [
      activeThreadId,
      authSession?.access_token,
      contacts,
      conversations,
      desktopConversationContextMenu,
      dismissConversationThread,
      groups,
      serverMessagingEnabled,
      unhideThreadById,
    ],
  );
  const ensureSelfConversationThread = useCallback(() => {
    if (!currentUser?.email) return null;
    const selfEmail = normalizeEmail(currentUser.email);
    const existingSelfThread =
      conversations.find((thread) => thread.contactEmail && normalizeEmail(thread.contactEmail) === selfEmail) ?? null;
    if (existingSelfThread) {
      setMessagesByThread((prev) => ({ ...prev, [existingSelfThread.id]: prev[existingSelfThread.id] ?? [] }));
      setUnreadByThread((prev) => ({ ...prev, [existingSelfThread.id]: prev[existingSelfThread.id] ?? 0 }));
      return existingSelfThread;
    }

    const selfThreadId = contactIdFromEmail(selfEmail);
    const now = Date.now();
    const selfThread: Thread = {
      id: selfThreadId,
      title: currentUser.name ?? "Você",
      preview: "Mensagens para mim",
      lastActivity: "Agora",
      lastActivityAt: now,
      tab: "conversations",
      avatarUrl: currentUser.avatarUrl ?? undefined,
      contactEmail: selfEmail,
    };
    setConversations((prev) => (prev.some((thread) => thread.id === selfThreadId) ? prev : [selfThread, ...prev]));
    setMessagesByThread((prev) => ({ ...prev, [selfThreadId]: prev[selfThreadId] ?? [] }));
    setUnreadByThread((prev) => ({ ...prev, [selfThreadId]: prev[selfThreadId] ?? 0 }));
    return selfThread;
  }, [conversations, currentUser]);
  const openContactThread = useCallback(
    (threadId: string) => {
      unhideThreadById(threadId);
      if (threadId === "self-contact") {
        const selfThread = ensureSelfConversationThread();
        if (selfThread) {
          unhideThreadById(selfThread.id);
          setActiveFilter("all");
          openThreadById(selfThread.id);
        }
        setIsNewChatOpen(false);
        setIsNewChatEmailOpen(false);
        setIsNewGroupOpen(false);
        setIsNewGroupCreateOpen(false);
        setIsCommunityListOpen(false);
        setIsNewContactOpen(false);
        setIsCustomListOpen(false);
        setIsDirectoryOpen(false);
        setIsProfileOpen(false);
        setProfileTarget(null);
        return;
      }
      const contact = contacts.find((item) => item.id === threadId);
      const contactEmail = contact?.contactEmail
        ? normalizeEmail(contact.contactEmail)
        : extractEmail(contact?.preview ?? "") ?? "";
      const existingThread = contactEmail
        ? conversations.find(
            (thread) => thread.contactEmail && normalizeEmail(thread.contactEmail) === contactEmail,
          )
        : null;
      if (existingThread) {
        unhideThreadById(existingThread.id);
        setActiveFilter("all");
        openThreadById(existingThread.id);
      } else {
        setActiveFilter((prev) => (prev === "contacts" || prev === "all" ? prev : "all"));
        openThreadById(threadId);
      }
      setIsNewChatOpen(false);
      setIsNewChatEmailOpen(false);
      setIsNewGroupOpen(false);
      setIsNewGroupCreateOpen(false);
      setIsCommunityListOpen(false);
      setIsNewContactOpen(false);
      setIsCustomListOpen(false);
      setIsDirectoryOpen(false);
      setIsProfileOpen(false);
      setProfileTarget(null);
    },
    [contacts, conversations, ensureSelfConversationThread, openThreadById, unhideThreadById],
  );
  const openCommunityThread = useCallback(
    (community: { id: string; title: string; preview: string; lastActivity?: string }) => {
      const existingById = groups.find((group) => group.id === community.id);
      const existingByTitle = groups.find(
        (group) => group.title.trim().toLocaleLowerCase("pt-BR") === community.title.trim().toLocaleLowerCase("pt-BR"),
      );
      const existing = existingById ?? existingByTitle ?? null;
      if (existing) {
        setActiveFilter("groups");
        openThreadById(existing.id);
        return;
      }
      const createdAt = Date.now();
      const threadId = `grp-${community.id}`;
      const thread: Thread = {
        id: threadId,
        title: community.title,
        preview: community.preview,
        lastActivity: community.lastActivity ?? "Agora",
        lastActivityAt: createdAt,
        tab: "groups",
      };
      setGroups((prev) => (prev.some((group) => group.id === threadId) ? prev : [thread, ...prev]));
      setMessagesByThread((prev) => ({ ...prev, [threadId]: prev[threadId] ?? [] }));
      setUnreadByThread((prev) => ({ ...prev, [threadId]: prev[threadId] ?? 0 }));
      setActiveFilter("groups");
      openThreadById(threadId);
    },
    [groups, openThreadById],
  );
  const resetCustomListDraft = useCallback(() => {
    setNewCustomListName("");
    setCustomListSearch("");
    setCustomListStep("name");
    setCustomListError(null);
    setSelectedCustomListThreadIds([]);
  }, []);
  const handleOpenCustomListPanel = useCallback(() => {
    setIsDirectoryOpen(false);
    setIsNewChatOpen(false);
    setIsNewChatEmailOpen(false);
    setIsNewGroupOpen(false);
    setIsNewGroupCreateOpen(false);
    setIsCommunityListOpen(false);
    setIsGroupsPanelOpen(false);
    setIsGroupCreateOpen(false);
    setIsGroupsExpanded(false);
    setIsNewContactOpen(false);
    setIsCustomListOpen(true);
    resetCustomListDraft();
  }, [resetCustomListDraft]);
  const handleCloseCustomListPanel = useCallback(() => {
    setIsCustomListOpen(false);
    resetCustomListDraft();
  }, [resetCustomListDraft]);
  const handleContinueCustomListMembers = useCallback(() => {
    const normalizedName = newCustomListName.trim();
    if (!normalizedName) {
      setCustomListError("Digite um nome para a lista.");
      return;
    }
    const duplicate = customConversationLists.some(
      (list) => list.name.toLocaleLowerCase("pt-BR") === normalizedName.toLocaleLowerCase("pt-BR"),
    );
    if (duplicate) {
      setCustomListError("Esse nome de lista já existe.");
      return;
    }
    setCustomListError(null);
    setCustomListStep("members");
  }, [customConversationLists, newCustomListName]);
  const handleToggleCustomListThread = useCallback((threadId: string) => {
    setSelectedCustomListThreadIds((prev) =>
      prev.includes(threadId) ? prev.filter((id) => id !== threadId) : [...prev, threadId],
    );
  }, []);
  const handleSaveCustomList = useCallback(() => {
    const normalizedName = newCustomListName.trim();
    if (!normalizedName) {
      setCustomListError("Digite um nome para a lista.");
      setCustomListStep("name");
      return;
    }
    const dedupedThreadIds = Array.from(new Set(selectedCustomListThreadIds));
    if (!dedupedThreadIds.length) return;
    const duplicate = customConversationLists.some(
      (list) => list.name.toLocaleLowerCase("pt-BR") === normalizedName.toLocaleLowerCase("pt-BR"),
    );
    if (duplicate) {
      setCustomListError("Esse nome de lista já existe.");
      setCustomListStep("name");
      return;
    }
    const now = Date.now();
    const listId = `lst-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const nextList: CustomConversationList = {
      id: listId,
      name: normalizedName,
      threadIds: dedupedThreadIds,
      createdAt: now,
    };
    setCustomConversationLists((prev) => [nextList, ...prev]);
    setActiveFilter(toCustomFilterKey(listId));
    setIsCustomListOpen(false);
    resetCustomListDraft();
  }, [customConversationLists, newCustomListName, resetCustomListDraft, selectedCustomListThreadIds]);
  const addContactFromDirectory = useCallback(
    (email: string, name?: string, avatarUrl?: string | null) => {
      const normalized = normalizeEmail(email);
      if (!normalized || !isValidEmail(normalized)) return;
      const displayName = name?.trim() ? name.trim() : formatNameFromEmail(normalized);
      const contactId = contactIdFromEmail(normalized);
      const normalizedAvatar = normalizeAvatarUrl(avatarUrl);
      setContacts((prev) => {
        if (prev.some((contact) => getContactPrimaryKey(contact) === normalized)) {
          if (!normalizedAvatar) return prev;
          return prev.map((contact) =>
            getContactPrimaryKey(contact) === normalized && !contact.avatarUrl
              ? { ...contact, avatarUrl: normalizedAvatar }
              : contact,
          );
        }
        return [
          {
            id: contactId,
            title: displayName,
            preview: normalized,
            lastActivity: "Agora",
            lastActivityAt: Date.now(),
            tab: "contacts",
            contactEmail: normalized,
            ...(normalizedAvatar ? { avatarUrl: normalizedAvatar } : {}),
          },
          ...prev,
        ];
      });
      setMessagesByThread((prev) => ({ ...prev, [contactId]: prev[contactId] ?? [] }));
      setUnreadByThread((prev) => ({ ...prev, [contactId]: prev[contactId] ?? 0 }));
    },
    [setContacts, setMessagesByThread, setUnreadByThread],
  );
  const authTokenRef = useRef<string | null>(null);
  useEffect(() => {
    authTokenRef.current = authSession?.access_token ?? null;
  }, [authSession?.access_token]);
  useEffect(() => {
    if (!authSession?.access_token) return;
    setAuthHttpUnauthorized(false);
  }, [authSession?.access_token]);

  const refreshAuthToken = useCallback(async () => {
    if (refreshSessionPromiseRef.current) {
      return refreshSessionPromiseRef.current;
    }
    const refreshPromise = (async () => {
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (error) return null;
        const nextToken = data.session?.access_token ?? null;
        if (!nextToken) return null;
        authTokenRef.current = nextToken;
        setAuthSession(data.session ?? null);
        setAuthHttpUnauthorized(false);
        return nextToken;
      } catch {
        return null;
      } finally {
        refreshSessionPromiseRef.current = null;
      }
    })();
    refreshSessionPromiseRef.current = refreshPromise;
    return refreshPromise;
  }, []);

  const authFetch = useCallback(
    async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const method = (init.method ?? "GET").toUpperCase();
      const requestWithToken = async (token: string | null) => {
        const headers = new Headers(init.headers ?? {});
        if (token) {
          headers.set("Authorization", `Bearer ${token}`);
        }
        return fetch(input, {
          ...init,
          headers,
          ...(init.cache ? {} : method === "GET" || method === "HEAD" ? { cache: "no-store" } : {}),
        });
      };

      const initialToken = authTokenRef.current ?? authSession?.access_token ?? null;
      let response = await requestWithToken(initialToken);

      if (response.status === 401) {
        const refreshedToken = await refreshAuthToken();
        if (refreshedToken && refreshedToken !== initialToken) {
          response = await requestWithToken(refreshedToken);
        }
      }

      if (response.status === 401) {
        if (!authHttpUnauthorized) {
          setAuthHttpUnauthorized(true);
          if (process.env.NODE_ENV !== "production") {
            console.warn("[KnexChat] API returned 401, stopping sync loops until re-auth.");
          }
          void supabase.auth.signOut().catch(() => undefined);
        }
        return response;
      }

      if (response.status === 403) {
        const payload = await response.clone().json().catch(() => null);
        if (payload && typeof payload === "object" && payload.code === "ENTITLEMENT_REQUIRED") {
          setEntitlementBlocked(true);
        }
      }
      return response;
    },
    [authHttpUnauthorized, authSession?.access_token, refreshAuthToken],
  );
  const sendPresenceHeartbeat = useCallback(async () => {
    if (!serverMessagingEnabled || !identity?.email || authHttpUnauthorized) return;
    if (!authTokenRef.current && !authSession?.access_token) return;
    try {
      const res = await authFetch("/api/knexchat/presence", { method: "POST" });
      if (!res.ok) return;
      const payload = (await res.json().catch(() => ({}))) as { updated_at?: string; updatedAt?: string };
      const updatedAt =
        typeof payload.updated_at === "string"
          ? payload.updated_at
          : typeof payload.updatedAt === "string"
            ? payload.updatedAt
            : new Date().toISOString();
      applyRealtimeProfileSync({
        email: identity.email,
        ...(identity.name ? { name: identity.name } : {}),
        updatedAt,
      });
    } catch {
      // Ignore heartbeat errors.
    }
  }, [
    applyRealtimeProfileSync,
    authFetch,
    authHttpUnauthorized,
    authSession?.access_token,
    identity?.email,
    identity?.name,
    serverMessagingEnabled,
  ]);
  useEffect(() => {
    if (!serverMessagingEnabled || !identity?.email || !isChatStateHydrated) return;
    if (isKnexchatActivated !== true || entitlementBlocked || authHttpUnauthorized) return;
    if (!authTokenRef.current && !authSession?.access_token) return;
    let cancelled = false;
    const heartbeat = async () => {
      if (cancelled) return;
      await sendPresenceHeartbeat();
    };
    void heartbeat();
    const interval = window.setInterval(() => {
      void heartbeat();
    }, 45 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    authHttpUnauthorized,
    authSession?.access_token,
    entitlementBlocked,
    identity?.email,
    isChatStateHydrated,
    isKnexchatActivated,
    sendPresenceHeartbeat,
    serverMessagingEnabled,
  ]);
  const syncContactRequestsFromServer = useCallback(async () => {
    if (!serverMessagingEnabled) return;
    if (!identity?.email) return;
    if (authHttpUnauthorized) return;
    if (!authTokenRef.current && !authSession?.access_token) return;
    try {
      const res = await authFetch("/api/knexchat/contact-requests?includeResolved=1");
      if (!res.ok) return;
      const payload = (await res.json().catch(() => ({}))) as { requests?: unknown[] };
      if (!Array.isArray(payload.requests)) return;
      const mapped = payload.requests.map(mapApiContactRequest).filter((item): item is ContactRequest => Boolean(item));

      mapped.forEach((request) => {
        const normalizedEmail = normalizeEmail(request.email);
        if (request.status !== "accepted") return;
        if (contactEmailSet.has(normalizedEmail)) return;
        const known = contactNameByEmailRef.current.get(normalizedEmail);
        addContactFromDirectory(request.email, request.name ?? known?.name, known?.avatarUrl ?? null);
      });

      const pending = mapped
        .filter((request) => request.status === "pending")
        .map((request) => {
          const known = contactNameByEmailRef.current.get(normalizeEmail(request.email));
          const nextName = request.name?.trim() ? request.name : known?.name;
          const nextAvatar = request.avatarUrl ?? known?.avatarUrl ?? null;
          const withName = nextName ? { ...request, name: nextName } : request;
          return nextAvatar ? { ...withName, avatarUrl: nextAvatar } : withName;
        });
      setContactRequests((prev) => {
        const previousByKey = new Map<ContactRequestLookupKey, ContactRequest>(
          prev.map(
            (request) =>
              [`${request.direction}:${normalizeEmail(request.email)}` as ContactRequestLookupKey, request] as const,
          ),
        );
        const next = pending.map((request) => {
          const key: ContactRequestLookupKey = `${request.direction}:${normalizeEmail(request.email)}`;
          const previousRequest = previousByKey.get(key);
          if (!previousRequest) return request;
          if (!areAvatarUrlsEqual(previousRequest.avatarUrl, request.avatarUrl)) return request;
          if ((previousRequest.avatarUrl ?? null) === (request.avatarUrl ?? null)) return request;
          return { ...request, avatarUrl: previousRequest.avatarUrl ?? null };
        });
        const unchanged =
          prev.length === next.length &&
          prev.every((request, index) => {
            const candidate = next[index];
            if (!candidate) return false;
            return (
              request.id === candidate.id &&
              request.email === candidate.email &&
              request.name === candidate.name &&
              request.status === candidate.status &&
              request.direction === candidate.direction &&
              request.createdAt === candidate.createdAt &&
              areAvatarUrlsEqual(request.avatarUrl, candidate.avatarUrl)
            );
          });
        return unchanged ? prev : next;
      });
    } catch {
      // Keep local state on transient errors.
    }
  }, [
    addContactFromDirectory,
    authFetch,
    authHttpUnauthorized,
    authSession?.access_token,
    contactEmailSet,
    identity?.email,
    serverMessagingEnabled,
  ]);
  const handleSendContactRequest = useCallback(
    (email: string, name?: string) => {
      const normalized = normalizeEmail(email);
      if (!normalized || !isValidEmail(normalized)) return;
      if (contactEmailSet.has(normalized)) return;

      setContactRequests((prev) => {
        if (
          prev.some(
            (request) =>
              normalizeEmail(request.email) === normalized &&
              request.status === "pending" &&
              request.direction === "outgoing",
          )
        ) {
          return prev;
        }
        return [
          {
            id: `req-local-${normalized}-${Date.now()}`,
            email: normalized,
            ...(name?.trim() ? { name: normalizeName(name) } : {}),
            status: "pending",
            direction: "outgoing",
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ];
      });

      void (async () => {
        try {
          const res = await authFetch("/api/knexchat/contact-requests", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: normalized }),
          });
          if (!res.ok) {
            await syncContactRequestsFromServer();
            return;
          }
          const payload = (await res.json().catch(() => ({}))) as { request?: unknown };
          const mapped = mapApiContactRequest(payload.request);
          if (!mapped) {
            await syncContactRequestsFromServer();
            return;
          }
          setContactRequests((prev) => {
            const next = prev.filter(
              (request) =>
                !(normalizeEmail(request.email) === normalizeEmail(mapped.email) && request.direction === "outgoing"),
            );
            return [mapped, ...next];
          });
        } catch {
          await syncContactRequestsFromServer();
        }
      })();
    },
    [authFetch, contactEmailSet, syncContactRequestsFromServer],
  );
  const handleAcceptContactRequest = useCallback(
    (email: string, name?: string, avatarUrl?: string | null) => {
      const normalized = normalizeEmail(email);
      if (!normalized || !isValidEmail(normalized)) return;

      addContactFromDirectory(email, name, avatarUrl);
      setContactRequests((prev) =>
        prev.filter(
          (request) => !(normalizeEmail(request.email) === normalized && request.direction === "incoming"),
        ),
      );

      void (async () => {
        try {
          await authFetch("/api/knexchat/contact-requests", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: normalized, action: "accept" }),
          });
        } finally {
          await syncContactRequestsFromServer();
        }
      })();
    },
    [addContactFromDirectory, authFetch, syncContactRequestsFromServer],
  );
  const handleCancelOutgoingContactRequest = useCallback(
    (email: string) => {
      const normalized = normalizeEmail(email);
      if (!normalized || !isValidEmail(normalized)) return;

      setContactRequests((prev) =>
        prev.filter(
          (request) => !(normalizeEmail(request.email) === normalized && request.direction === "outgoing"),
        ),
      );

      void (async () => {
        try {
          await authFetch("/api/knexchat/contact-requests", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: normalized, action: "cancel" }),
          });
        } finally {
          await syncContactRequestsFromServer();
        }
      })();
    },
    [authFetch, syncContactRequestsFromServer],
  );
  const handleRejectContactRequest = useCallback(
    (email: string, status: ContactRequestStatus) => {
      const normalized = normalizeEmail(email);
      if (!normalized || !isValidEmail(normalized)) return;
      const action = status === "blocked" ? "block" : "reject";

      setContactRequests((prev) =>
        prev.filter(
          (request) => !(normalizeEmail(request.email) === normalized && request.direction === "incoming"),
        ),
      );

      void (async () => {
        try {
          await authFetch("/api/knexchat/contact-requests", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: normalized, action }),
          });
        } finally {
          await syncContactRequestsFromServer();
        }
      })();
    },
    [authFetch, syncContactRequestsFromServer],
  );
  const applyRealtimeContactRequestSync = useCallback(
    (entry: unknown) => {
      const mapped = mapApiContactRequest(entry);
      if (!mapped) return;
      const normalizedEmail = normalizeEmail(mapped.email);
      const known = contactNameByEmailRef.current.get(normalizedEmail);
      const resolvedName = mapped.name ?? known?.name;
      const resolvedAvatar = known?.avatarUrl ?? null;

      if (mapped.status === "accepted") {
        addContactFromDirectory(mapped.email, resolvedName, resolvedAvatar);
      }

      setContactRequests((prev) => {
        const withoutPeer = prev.filter((request) => normalizeEmail(request.email) !== normalizedEmail);
        if (mapped.status !== "pending") return withoutPeer;
        const pendingRequest = resolvedName ? { ...mapped, name: resolvedName } : mapped;
        return [pendingRequest, ...withoutPeer];
      });
    },
    [addContactFromDirectory],
  );
  const requestRealtimeTicket = useCallback(async () => {
    try {
      const res = await authFetch("/api/knexchat/realtime-ticket", { method: "POST" });
      if (res.status === 403) {
        const payload = (await res.json().catch(() => null)) as { code?: string } | null;
        if (payload?.code === "ENTITLEMENT_REQUIRED") {
          setEntitlementBlocked(true);
          return null;
        }
      }
      if (!res.ok) return null;
      const payload = (await res.json().catch(() => ({}))) as {
        transport?: "query" | "cookie";
        ticket?: string;
      };
      if (payload.transport === "cookie") {
        return { mode: "cookie" as const };
      }
      if (typeof payload.ticket === "string" && payload.ticket) {
        return { mode: "query" as const, ticket: payload.ticket };
      }
      return null;
    } catch {
      return null;
    }
  }, [authFetch]);
  const checkEmailRegistered = useCallback(
    async (email: string) => {
      const normalized = normalizeEmail(email);
      if (!normalized || !isValidEmail(normalized)) return false;
      if (!authSession?.access_token) return false;
      if (directoryLookupCache[normalized] !== undefined) {
        return directoryLookupCache[normalized];
      }
      try {
        const res = await authFetch(`/api/knexchat/directory?email=${encodeURIComponent(normalized)}`);
        if (!res.ok) throw new Error("lookup_failed");
        const payload = (await res.json().catch(() => ({}))) as { exists?: boolean };
        const exists = Boolean(payload?.exists);
        setDirectoryLookupCache((prev) => ({ ...prev, [normalized]: exists }));
        if (exists) {
          setDirectoryEntries((prev) => {
            if (prev.some((entry) => normalizeEmail(entry.email) === normalized)) return prev;
            return [{ email: normalized, createdAt: new Date().toISOString() }, ...prev];
          });
        }
        return exists;
      } catch {
        return false;
      }
    },
    [authFetch, authSession?.access_token, directoryLookupCache],
  );
  useEffect(() => {
    if (!normalizedNewContactEmail) return;
    void checkEmailRegistered(normalizedNewContactEmail);
  }, [checkEmailRegistered, normalizedNewContactEmail]);
  const isRegisteredEmail = useCallback(
    (email: string) => {
      const normalized = normalizeEmail(email);
      if (!normalized) return false;
      if (directoryLookupCache[normalized] !== undefined) {
        return directoryLookupCache[normalized];
      }
      return directoryEntries.some((entry) => normalizeEmail(entry.email) === normalized);
    },
    [directoryEntries, directoryLookupCache],
  );
  const getThreadRecipientEmail = useCallback((thread: Thread | null) => {
    if (!thread || (thread.tab !== "contacts" && thread.tab !== "conversations")) return null;
    if (thread.contactEmail) return normalizeEmail(thread.contactEmail);
    const previewEmail = extractEmail(thread.preview);
    return previewEmail ? normalizeEmail(previewEmail) : null;
  }, []);
  useEffect(() => {
    if (!activeThread) return;
    if (isUuid(activeThread.id)) return;
    if (activeThread.tab !== "contacts" && activeThread.tab !== "conversations") return;
    const activeEmail = getThreadRecipientEmail(activeThread);
    if (!activeEmail) return;
    const serverThread = conversations.find((thread) => {
      if (!isUuid(thread.id) || thread.tab !== "conversations") return false;
      const threadEmail = getThreadRecipientEmail(thread);
      return Boolean(threadEmail && threadEmail === activeEmail);
    });
    if (!serverThread || serverThread.id === activeThreadId) return;
    setActiveFilter("all");
    setActiveThreadId(serverThread.id);
  }, [activeThread, activeThreadId, conversations, getThreadRecipientEmail]);
  const isSelfConversationThread = useCallback(
    (thread: Thread | null) => {
      if (!thread || (thread.tab !== "contacts" && thread.tab !== "conversations")) return false;
      if (!identity?.email) return false;
      const selfEmail = normalizeEmail(identity.email);
      const recipientEmail = getThreadRecipientEmail(thread);
      return Boolean(recipientEmail && recipientEmail === selfEmail);
    },
    [getThreadRecipientEmail, identity?.email],
  );
  const ensureRecipientRegistered = useCallback(
    async (thread: Thread | null) => {
      if (!thread || (thread.tab !== "contacts" && thread.tab !== "conversations")) return true;
      if (isSelfConversationThread(thread)) return true;
      if (!serverMessagingEnabled) return true;
      const recipientEmail = getThreadRecipientEmail(thread);
      if (!recipientEmail) return true;
      if (isRegisteredEmail(recipientEmail)) return true;
      const canVerifyDirectory = Boolean(authTokenRef.current ?? authSession?.access_token);
      if (!canVerifyDirectory) return true;
      const exists = await checkEmailRegistered(recipientEmail);
      if (exists) return true;
      setMessageSendNotice(
        "Este e-mail ainda não está cadastrado no KnexChat. Convide o contato para poder enviar mensagens.",
      );
      return false;
    },
    [
      authSession?.access_token,
      checkEmailRegistered,
      getThreadRecipientEmail,
      isRegisteredEmail,
      isSelfConversationThread,
      serverMessagingEnabled,
    ],
  );
  useEffect(() => {
    setMessageSendNotice(null);
  }, [activeThreadId]);
  const enqueueInboxMessage = useCallback((message: InboxMessage) => {
    if (serverMessagingEnabled) return;
    if (typeof window === "undefined") return;
    try {
      const existing = normalizeInboxMessages(localStorage.getItem(INBOX_KEY));
      localStorage.setItem(INBOX_KEY, JSON.stringify([...existing, message]));
    } catch {
      // Ignore inbox persistence errors.
    }
  }, [serverMessagingEnabled]);
  const consumeInboxMessages = useCallback(() => {
    if (serverMessagingEnabled) return;
    if (!identity?.email || typeof window === "undefined") return;
    const selfEmail = normalizeEmail(identity.email);
    try {
      const inbox = normalizeInboxMessages(localStorage.getItem(INBOX_KEY));
      if (!inbox.length) return;
      const mine = inbox.filter((message) => message.to === selfEmail);
      if (!mine.length) return;
      const remaining = inbox.filter((message) => message.to !== selfEmail);
      localStorage.setItem(INBOX_KEY, JSON.stringify(remaining));
      const latestBySender = new Map<string, InboxMessage>();
      mine.forEach((message) => {
        const prev = latestBySender.get(message.from);
        if (!prev || message.sentAt >= prev.sentAt) {
          latestBySender.set(message.from, message);
        }
      });
      const previewForMessage = (message: InboxMessage) => {
        if (message.imageUrl) return "Imagem recebida";
        if (message.audioUrl) return "Mensagem de áudio";
        return message.body || "Mensagem recebida";
      };
      const knownContactEmails = new Set(contacts.map((contact) => getContactPrimaryKey(contact)));
      setContacts((prev) => {
        let changed = false;
        const next = [...prev];
        const indexByEmail = new Map<string, number>();
        next.forEach((contact, index) => {
          indexByEmail.set(getContactPrimaryKey(contact), index);
        });
        latestBySender.forEach((message, emailKey) => {
          const index = indexByEmail.get(emailKey);
          const contactName = message.fromName?.trim()
            ? normalizeName(message.fromName)
            : formatNameFromEmail(emailKey);
          if (index === undefined) return;
          const current = next[index];
          let updated = current;
          let hasUpdate = false;
          if (!current.contactEmail) {
            updated = { ...updated, contactEmail: emailKey };
            hasUpdate = true;
          }
          if (!current.title || current.title === "Novo contato") {
            updated = { ...updated, title: contactName };
            hasUpdate = true;
          }
          updated = {
            ...updated,
            preview: previewForMessage(message) || updated.preview,
            lastActivity: formatTimestampLabel(message.sentAt) || message.time,
            lastActivityAt: message.sentAt,
          };
          hasUpdate = true;
          if (hasUpdate) {
            changed = true;
            next[index] = updated;
          }
        });
        return changed ? next : prev;
      });
      setConversations((prev) => {
        let changed = false;
        let next = [...prev];
        const indexById = new Map<string, number>();
        next.forEach((thread, index) => indexById.set(thread.id, index));
        latestBySender.forEach((message, emailKey) => {
          const threadId = contactIdFromEmail(emailKey);
          if (knownContactEmails.has(emailKey)) {
            if (indexById.has(threadId)) {
              next = next.filter((thread) => thread.id !== threadId);
              changed = true;
            }
            return;
          }
          const contactName = message.fromName?.trim()
            ? normalizeName(message.fromName)
            : formatNameFromEmail(emailKey);
          const preview = previewForMessage(message);
          const existingIndex = indexById.get(threadId);
          if (existingIndex !== undefined) {
            const existing = next[existingIndex];
            next[existingIndex] = {
              ...existing,
              title: contactName || existing.title,
              preview,
              lastActivity: formatTimestampLabel(message.sentAt) || message.time,
              lastActivityAt: message.sentAt,
              tab: "conversations",
              contactEmail: emailKey,
            };
            changed = true;
            return;
          }
          next = [
            {
              id: threadId,
              title: contactName,
              preview,
              lastActivity: formatTimestampLabel(message.sentAt) || message.time,
              lastActivityAt: message.sentAt,
              tab: "conversations",
              contactEmail: emailKey,
            },
            ...next,
          ];
          changed = true;
        });
        return changed ? next : prev;
      });
      setMessagesByThread((prev) => {
        const next = { ...prev };
        mine.forEach((message) => {
          const threadId = contactIdFromEmail(message.from);
          const senderInfo = contactNameByEmail.get(message.from);
          const senderName = message.fromName?.trim()
            ? normalizeName(message.fromName)
            : senderInfo?.name ?? formatNameFromEmail(message.from);
          const incomingMessage: Message = {
            id: message.id,
            author: "them",
            body: message.body || (message.imageUrl ? "Imagem recebida" : message.audioUrl ? "Mensagem de áudio" : "Mensagem recebida"),
            time: formatClockLabel(message.sentAt) || message.time,
            sentAt: message.sentAt,
            senderName,
            senderEmail: message.from,
            senderAvatarUrl: senderInfo?.avatarUrl ?? undefined,
            imageUrl: message.imageUrl,
            imageName: message.imageName,
            audioUrl: message.audioUrl,
            audioDuration: message.audioDuration,
          };
          next[threadId] = [...(next[threadId] ?? []), incomingMessage];
        });
        return next;
      });
    } catch {
      // Ignore inbox errors.
    }
  }, [
    contactNameByEmail,
    contacts,
    identity?.email,
    serverMessagingEnabled,
    setContacts,
    setConversations,
    setMessagesByThread,
  ]);

  const previewFromApiMessage = useCallback((message?: ApiMessage | null) => {
    if (!message) return "Sem mensagens";
    const mediaSource = resolveApiMessageMediaUrl(message);
    if (message.kind === "image") {
      return detectMediaTypeFromSource(mediaSource) === "video" ? "Vídeo enviado" : "Imagem enviada";
    }
    if (message.kind === "audio") return "Mensagem de áudio";
    if (message.kind === "file") return message.media_name ?? "Arquivo enviado";
    return message.body?.trim() || "Mensagem enviada";
  }, []);

  const mapApiThreadToThread = useCallback(
    (thread: ApiThread): Thread => {
      const identityEmail = identityEmailRef.current;
      const threadAvatar = normalizeAvatarUrl(thread.avatar_url ?? null) ?? undefined;
      const participants = (thread.participants ?? []).map((participant) => ({
        email: normalizeEmail(participant.email),
        role: participant.role,
        name: participant.name ?? null,
        avatarUrl: normalizeAvatarUrl(participant.avatar_url ?? null),
        lastSeenAt: toTimestampMs(participant.updated_at ?? null) ?? undefined,
      }));
      const tab: TabKey = thread.kind === "group" || thread.kind === "forum" ? "groups" : "conversations";
      const lastTimestamp = thread.last_message_at ?? thread.updated_at ?? thread.created_at;
      const lastActivityAt = toTimestampMs(lastTimestamp) ?? undefined;
      const lastActivity = formatTimestampLabel(lastTimestamp) || "Agora";
      const preview = previewFromApiMessage(thread.lastMessage ?? null);
      let title = thread.title?.trim() ?? "";
      let contactEmail: string | undefined;
      let avatarUrl: string | undefined;

      if (thread.kind === "direct") {
        const otherParticipant =
          participants.find((participant) => normalizeEmail(participant.email) !== identityEmail) ?? participants[0];
        const otherEmail = otherParticipant?.email ? normalizeEmail(otherParticipant.email) : "";
        contactEmail = otherEmail || undefined;
        const contactInfo = otherEmail ? contactNameByEmailRef.current.get(otherEmail) : undefined;
        const displayName = contactInfo?.name ?? otherParticipant?.name ?? "";
        title = displayName || (otherEmail ? formatNameFromEmail(otherEmail) : "Conversa direta");
        avatarUrl = contactInfo?.avatarUrl ?? otherParticipant?.avatarUrl ?? undefined;
      }

      if (tab === "groups") {
        title = title || "Grupo";
        avatarUrl = threadAvatar ?? avatarUrl;
      }

      return {
        id: thread.id,
        title,
        preview,
        lastActivity: lastActivity || "Agora",
        lastActivityAt: lastActivityAt ?? undefined,
        tab,
        avatarUrl,
        onlineCount: tab === "groups" ? participants.length : undefined,
        contactEmail,
        participantRoles: participants,
      };
    },
    [previewFromApiMessage],
  );

  const mapApiMessageToMessage = useCallback(
    (message: ApiMessage): Message => {
      const senderEmail = normalizeEmail(message.sender_email);
      const senderInfo = senderEmail ? contactNameByEmailRef.current.get(senderEmail) : undefined;
      const author: "me" | "them" = identityEmailRef.current && identityEmailRef.current === senderEmail ? "me" : "them";
      const deliveryStatus: MessageDeliveryState | undefined = author === "me" ? "delivered" : undefined;
      const sentAt = toTimestampMs(message.created_at) ?? undefined;
      const timeLabel = formatClockLabel(sentAt ?? message.created_at) || "Agora";
      const mediaSource = resolveApiMessageMediaUrl(message) ?? undefined;
      if (message.kind === "image") {
        return {
          id: message.id,
          author,
          body: message.media_name ?? "Imagem enviada",
          time: timeLabel,
          ...(sentAt ? { sentAt } : {}),
          senderName: senderInfo?.name,
          senderEmail: senderEmail || undefined,
          senderAvatarUrl: senderInfo?.avatarUrl ?? undefined,
          imageUrl: mediaSource,
          imageName: message.media_name ?? undefined,
          deliveryStatus,
        };
      }
      if (message.kind === "audio") {
        return {
          id: message.id,
          author,
          body: "Mensagem de áudio",
          time: timeLabel,
          ...(sentAt ? { sentAt } : {}),
          senderName: senderInfo?.name,
          senderEmail: senderEmail || undefined,
          senderAvatarUrl: senderInfo?.avatarUrl ?? undefined,
          audioUrl: mediaSource,
          audioDuration: message.media_name ?? undefined,
          deliveryStatus,
        };
      }
      if (message.kind === "file") {
        return {
          id: message.id,
          author,
          body: message.media_name ?? "Arquivo enviado",
          time: timeLabel,
          ...(sentAt ? { sentAt } : {}),
          senderName: senderInfo?.name,
          senderEmail: senderEmail || undefined,
          senderAvatarUrl: senderInfo?.avatarUrl ?? undefined,
          fileUrl: mediaSource,
          fileName: message.media_name ?? undefined,
          deliveryStatus,
        };
      }
      return {
        id: message.id,
        author,
        body: message.body ?? "",
        time: timeLabel,
        ...(sentAt ? { sentAt } : {}),
        senderName: senderInfo?.name,
        senderEmail: senderEmail || undefined,
        senderAvatarUrl: senderInfo?.avatarUrl ?? undefined,
        deliveryStatus,
      };
    },
    [],
  );

  const updateThreadActivity = useCallback((threadId: string, preview: string, activityAt: number) => {
    const lastActivity = formatTimestampLabel(activityAt) || "Agora";
    const applyUpdate = (threads: Thread[]) =>
      threads.map((thread) =>
        thread.id === threadId
          ? { ...thread, preview, lastActivity, lastActivityAt: activityAt }
          : thread,
      );
    setConversations((prev) => applyUpdate(prev));
    setGroups((prev) => applyUpdate(prev));
    setContacts((prev) => applyUpdate(prev));
  }, []);

  const applyRealtimeThreadSync = useCallback(
    (threadRecord: {
      id?: string;
      title?: string | null;
      avatar_url?: string | null;
      avatarUrl?: string | null;
      updated_at?: string | null;
      updatedAt?: string | null;
      last_message_at?: string | null;
      lastMessageAt?: string | null;
    }) => {
      const threadId = typeof threadRecord.id === "string" ? threadRecord.id.trim() : "";
      if (!isUuid(threadId)) return;

      const hasTitleField = Object.prototype.hasOwnProperty.call(threadRecord, "title");
      const normalizedTitle = typeof threadRecord.title === "string" ? threadRecord.title.trim() : "";
      const hasAvatarField =
        Object.prototype.hasOwnProperty.call(threadRecord, "avatar_url") ||
        Object.prototype.hasOwnProperty.call(threadRecord, "avatarUrl");
      const avatarValue =
        Object.prototype.hasOwnProperty.call(threadRecord, "avatar_url")
          ? threadRecord.avatar_url
          : threadRecord.avatarUrl;
      const normalizedAvatar = normalizeAvatarUrl(avatarValue ?? null);
      const activityRaw =
        (typeof threadRecord.last_message_at === "string" ? threadRecord.last_message_at : null) ??
        (typeof threadRecord.lastMessageAt === "string" ? threadRecord.lastMessageAt : null) ??
        (typeof threadRecord.updated_at === "string" ? threadRecord.updated_at : null) ??
        (typeof threadRecord.updatedAt === "string" ? threadRecord.updatedAt : null);
      const activityAt = toTimestampMs(activityRaw);
      const activityLabel = activityAt ? formatTimestampLabel(activityAt) || "Agora" : null;

      const applyThreadUpdate = (threads: Thread[]) => {
        const index = threads.findIndex((thread) => thread.id === threadId);
        if (index < 0) return threads;

        const current = threads[index];
        let nextThread: Thread = current;

        if (hasTitleField && normalizedTitle && normalizedTitle !== current.title) {
          nextThread = { ...nextThread, title: normalizedTitle };
        }

        if (hasAvatarField) {
          const currentAvatar = current.avatarUrl ?? null;
          if (currentAvatar !== normalizedAvatar) {
            nextThread = normalizedAvatar
              ? { ...nextThread, avatarUrl: normalizedAvatar }
              : { ...nextThread, avatarUrl: undefined };
          }
        }

        if (activityAt && activityAt !== current.lastActivityAt) {
          nextThread = {
            ...nextThread,
            lastActivityAt: activityAt,
            lastActivity: activityLabel ?? current.lastActivity,
          };
        }

        if (nextThread === current) return threads;

        const next = [...threads];
        next[index] = nextThread;
        if (activityAt) {
          next.sort((a, b) => {
            const diff = getThreadActivityTimestamp(b) - getThreadActivityTimestamp(a);
            if (diff !== 0) return diff;
            return a.id.localeCompare(b.id);
          });
        }
        return next;
      };

      setConversations((prev) => applyThreadUpdate(prev));
      setGroups((prev) => applyThreadUpdate(prev));
    },
    [],
  );

  const readFileAsDataUrl = useCallback((file: Blob) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        if (!result) {
          reject(new Error("empty_result"));
          return;
        }
        resolve(result);
      };
      reader.onerror = () => reject(reader.error ?? new Error("file_read_failed"));
      reader.readAsDataURL(file);
    });
  }, []);

  const optimizeGroupAvatarDataUrl = useCallback(
    async (file: File) => {
      const sourceDataUrl = await readFileAsDataUrl(file);
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const nextImage = new Image();
        nextImage.onload = () => resolve(nextImage);
        nextImage.onerror = () => reject(new Error("group_avatar_image_load_failed"));
        nextImage.src = sourceDataUrl;
      });

      const sourceWidth = image.naturalWidth || image.width || 0;
      const sourceHeight = image.naturalHeight || image.height || 0;
      if (!sourceWidth || !sourceHeight) {
        throw new Error("group_avatar_dimensions_invalid");
      }

      const maxSide = 720;
      const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
      const width = Math.max(1, Math.round(sourceWidth * scale));
      const height = Math.max(1, Math.round(sourceHeight * scale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("group_avatar_context_unavailable");
      }
      context.drawImage(image, 0, 0, width, height);

      const variants: Array<{ type: string; quality: number }> = [
        { type: "image/webp", quality: 0.84 },
        { type: "image/webp", quality: 0.72 },
        { type: "image/jpeg", quality: 0.82 },
        { type: "image/jpeg", quality: 0.7 },
      ];
      let bestCandidate = sourceDataUrl;
      for (const variant of variants) {
        const candidate = canvas.toDataURL(variant.type, variant.quality);
        if (!candidate) continue;
        if (candidate.length < bestCandidate.length) {
          bestCandidate = candidate;
        }
        if (candidate.length <= 900_000) {
          return candidate;
        }
      }
      if (bestCandidate.length > 1_600_000) {
        throw new Error("group_avatar_too_large_after_optimization");
      }
      return bestCandidate;
    },
    [readFileAsDataUrl],
  );

  const refreshRealtime = useCallback(() => {
    setRealtimeKey((prev) => prev + 1);
  }, []);

  const fetchThreadsFromServer = useCallback(async () => {
    if (!serverMessagingEnabled || !identity?.email) return;
    if (isFetchingThreadsRef.current) return;
    isFetchingThreadsRef.current = true;
    setIsServerSyncing(true);
    setServerSyncError(null);
    try {
      const res = await authFetch(`/api/knexchat/threads?includeParticipants=1&includeLastMessage=1`);
      if (!res.ok) throw new Error("threads_failed");
      const payload = (await res.json().catch(() => ({}))) as { threads?: ApiThread[] };
      const rawThreads = Array.isArray(payload?.threads) ? payload.threads : [];
      const mapped = rawThreads.map(mapApiThreadToThread).sort((a, b) => {
        const diff = getThreadActivityTimestamp(b) - getThreadActivityTimestamp(a);
        if (diff !== 0) return diff;
        return a.id.localeCompare(b.id);
      });
      const hasBaseline = threadsBaselineInitializedRef.current;
      const viewerEmail = identityEmailRef.current;
      const pendingUnreadByThread: Record<string, number> = {};
      rawThreads.forEach((thread) => {
        if (!isUuid(thread.id)) return;
        const lastMessage = thread.lastMessage;
        if (!lastMessage?.id) return;
        const previousLastMessageId = lastSeenMessageByThreadRef.current[thread.id];
        if (previousLastMessageId === lastMessage.id) return;

        lastSeenMessageByThreadRef.current[thread.id] = lastMessage.id;
        if (!hasBaseline) return;

        const senderEmail = normalizeEmail(lastMessage.sender_email);
        if (!senderEmail || senderEmail === viewerEmail) return;
        if (isThreadOpenInActiveConversation(thread.id, senderEmail)) return;

        pendingUnreadByThread[thread.id] = (pendingUnreadByThread[thread.id] ?? 0) + 1;
      });
      if (!hasBaseline) {
        threadsBaselineInitializedRef.current = true;
      } else if (Object.keys(pendingUnreadByThread).length) {
        setUnreadByThread((prev) => {
          const next = { ...prev };
          Object.entries(pendingUnreadByThread).forEach(([threadId, delta]) => {
            next[threadId] = (next[threadId] ?? 0) + delta;
          });
          return next;
        });
      }
      setPresenceByEmail((prev) => {
        let changed = false;
        const next = { ...prev };
        mapped.forEach((thread) => {
          thread.participantRoles?.forEach((participant) => {
            if (!participant.lastSeenAt) return;
            const email = normalizeEmail(participant.email);
            if (!email || !isValidEmail(email)) return;
            const current = next[email] ?? 0;
            if (participant.lastSeenAt > current) {
              next[email] = participant.lastSeenAt;
              changed = true;
            }
          });
        });
        return changed ? next : prev;
      });
      const selfEmail = identityEmailRef.current;
      if (selfEmail) {
        let selfAvatarFromThreads: string | null = null;
        for (const thread of mapped) {
          if (!thread.participantRoles?.length) continue;
          for (const participant of thread.participantRoles) {
            if (normalizeEmail(participant.email) !== selfEmail) continue;
            const candidate = normalizeAvatarUrl(participant.avatarUrl ?? null);
            if (candidate) {
              selfAvatarFromThreads = candidate;
              break;
            }
          }
          if (selfAvatarFromThreads) break;
        }
        if (selfAvatarFromThreads) {
          applyRealtimeProfileSync({
            email: selfEmail,
            avatarUrl: selfAvatarFromThreads,
          });
        }
      }
      const nextConversations = mapped.filter((thread) => thread.tab === "conversations");
      const nextGroups = mapped.filter((thread) => thread.tab === "groups");
      setConversations((prev) => {
        const selfEmail = identityEmailRef.current;
        const stabilizedRemoteConversations = preserveStableThreadAvatars(prev, nextConversations);
        if (!selfEmail) {
          return areThreadListsEqual(prev, stabilizedRemoteConversations) ? prev : stabilizedRemoteConversations;
        }
        const selfThreads = prev.filter(
          (thread) =>
            thread.tab === "conversations" &&
            !isUuid(thread.id) &&
            Boolean(thread.contactEmail && normalizeEmail(thread.contactEmail) === selfEmail),
        );
        if (!selfThreads.length) {
          return areThreadListsEqual(prev, stabilizedRemoteConversations) ? prev : stabilizedRemoteConversations;
        }
        const merged = [...stabilizedRemoteConversations];
        selfThreads.forEach((thread) => {
          const alreadyIncluded = merged.some(
            (item) =>
              item.id === thread.id ||
              Boolean(item.contactEmail && normalizeEmail(item.contactEmail) === selfEmail),
          );
          if (!alreadyIncluded) {
            merged.unshift(thread);
          }
        });
        const stabilizedMerged = preserveStableThreadAvatars(prev, merged);
        return areThreadListsEqual(prev, stabilizedMerged) ? prev : stabilizedMerged;
      });
      setGroups((prev) => {
        const stabilizedGroups = preserveStableThreadAvatars(prev, nextGroups);
        return areThreadListsEqual(prev, stabilizedGroups) ? prev : stabilizedGroups;
      });
      setGroupAdminIdsByGroup((prev) => {
        const next = { ...prev };
        const selfEmail = identityEmailRef.current;
        let changed = false;
        mapped.forEach((thread) => {
          if (thread.tab !== "groups" || !thread.participantRoles?.length) return;
          const adminIds = thread.participantRoles
            .filter((participant) => participant.role === "admin")
            .map((participant) => {
              const normalized = normalizeEmail(participant.email);
              return selfEmail && normalized === selfEmail ? "self" : participant.email;
            });
          if (!adminIds.length) {
            if (thread.id in next) {
              delete next[thread.id];
              changed = true;
            }
            return;
          }
          if (!areStringArraysEqual(next[thread.id] ?? [], adminIds)) {
            next[thread.id] = adminIds;
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    } catch {
      setServerSyncError("Não foi possível sincronizar suas conversas.");
    } finally {
      isFetchingThreadsRef.current = false;
      setIsServerSyncing(false);
    }
  }, [
    applyRealtimeProfileSync,
    authFetch,
    identity?.email,
    isThreadOpenInActiveConversation,
    mapApiThreadToThread,
    serverMessagingEnabled,
  ]);

  const fetchMessagesForThread = useCallback(
    async (threadId: string) => {
      if (!serverMessagingEnabled || !identity?.email || !isUuid(threadId)) return;
      if (messageFetchInFlightRef.current.has(threadId)) return;
      messageFetchInFlightRef.current.add(threadId);
      setMessageLoadingByThread((prev) => ({ ...prev, [threadId]: true }));
      setMessageErrorByThread((prev) => ({ ...prev, [threadId]: null }));
      try {
        const res = await authFetch(`/api/knexchat/messages?threadId=${encodeURIComponent(threadId)}&limit=200`);
        if (!res.ok) throw new Error("messages_failed");
        const payload = (await res.json().catch(() => ({}))) as { messages?: ApiMessage[] };
        const rawMessages = Array.isArray(payload?.messages) ? payload.messages : [];
        const mappedMessages = rawMessages.map(mapApiMessageToMessage);
        setMessagesByThread((prev) => {
          const existing = prev[threadId] ?? [];
          if (areMessagesEqual(existing, mappedMessages)) return prev;
          return { ...prev, [threadId]: mappedMessages };
        });
        const lastMessage = rawMessages[rawMessages.length - 1];
        if (lastMessage) {
          const preview = previewFromApiMessage(lastMessage);
          const activityAt = toTimestampMs(lastMessage.created_at) ?? Date.now();
          updateThreadActivity(threadId, preview, activityAt);
        }
      } catch (error) {
        setMessageErrorByThread((prev) => ({
          ...prev,
          [threadId]: "Não foi possível carregar as mensagens desta conversa.",
        }));
        if (process.env.NODE_ENV !== "production") {
          console.error("[KnexChat] fetchMessagesForThread failed", error);
        }
      } finally {
        messageFetchInFlightRef.current.delete(threadId);
        setMessageLoadingByThread((prev) => ({ ...prev, [threadId]: false }));
      }
    },
    [
      authFetch,
      identity?.email,
      mapApiMessageToMessage,
      previewFromApiMessage,
      serverMessagingEnabled,
      updateThreadActivity,
    ],
  );

  const ensureServerThreadForSend = useCallback(
    async (thread: Thread) => {
      if (!serverMessagingEnabled) return thread.id;
      if (isSelfConversationThread(thread)) return thread.id;
      if (isUuid(thread.id)) return thread.id;
      if (!identity?.email) {
        setMessageSendNotice("Sessão indisponível. Faça login novamente para enviar mensagens.");
        return null;
      }
      if (thread.tab !== "contacts" && thread.tab !== "conversations") {
        setMessageSendNotice("Abra uma conversa direta para enviar mensagem.");
        return null;
      }
      let recipientEmail = getThreadRecipientEmail(thread);
      if (!recipientEmail && thread.participantRoles?.length) {
        const selfEmail = normalizeEmail(identity.email);
        const otherParticipant =
          thread.participantRoles.find((participant) => normalizeEmail(participant.email) !== selfEmail) ??
          thread.participantRoles[0];
        const candidate = otherParticipant?.email ? normalizeEmail(otherParticipant.email) : "";
        recipientEmail = candidate && candidate !== selfEmail ? candidate : null;
      }
      if (!recipientEmail) {
        setMessageSendNotice("Não foi possível identificar o destinatário desta conversa.");
        return null;
      }
      try {
        const res = await authFetch("/api/knexchat/threads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "direct",
            createdBy: identity.email,
            participants: [recipientEmail],
          }),
        });
        if (!res.ok) {
          if (res.status === 422) {
            const payload = (await res.json().catch(() => ({}))) as { missing?: string[] };
            const missing = Array.isArray(payload?.missing) ? payload.missing : [];
            if (missing.length) {
              setMessageSendNotice(
                "Este e-mail ainda não está cadastrado no KnexChat. Convide o contato para poder enviar mensagens.",
              );
            }
            return null;
          }
          throw new Error("thread_create_failed");
        }
        const payload = (await res.json().catch(() => ({}))) as { thread?: ApiThread };
        if (!payload.thread) return null;
        const mapped = mapApiThreadToThread(payload.thread);
        setConversations((prev) => (prev.some((item) => item.id === mapped.id) ? prev : [mapped, ...prev]));
        setMessagesByThread((prev) => ({ ...prev, [mapped.id]: prev[mapped.id] ?? [] }));
        setUnreadByThread((prev) => ({ ...prev, [mapped.id]: prev[mapped.id] ?? 0 }));
        setActiveFilter("all");
        setActiveThreadId(mapped.id);
        refreshRealtime();
        return mapped.id;
      } catch {
        setMessageSendNotice("Não foi possível iniciar essa conversa agora.");
        return null;
      }
    },
    [
      authFetch,
      getThreadRecipientEmail,
      identity?.email,
      isSelfConversationThread,
      mapApiThreadToThread,
      refreshRealtime,
      serverMessagingEnabled,
    ],
  );
  const handleSendInvite = useCallback(async () => {
    if (!normalizedNewContactEmail) return;
    const baseUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}${activationHref}`
        : activationHref;
    const inviteText = `Convite para o KnexChat: cadastre-se em ${baseUrl} com o e-mail ${normalizedNewContactEmail}.`;
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        throw new Error("Clipboard indisponível");
      }
      await navigator.clipboard.writeText(inviteText);
      setNewContactInviteNotice("Convite enviado.");
    } catch {
      setNewContactInviteNotice("Não foi possível enviar o convite.");
    }
  }, [activationHref, normalizedNewContactEmail]);
  const handleCreateContact = useCallback(() => {
    if (!normalizedNewContactEmail) {
      setNewContactError("Informe um e-mail válido.");
      return;
    }
    setNewContactError(null);
    setNewContactInviteNotice(null);
    const first = normalizeName(newContactFirstName);
    const last = normalizeName(newContactLastName);
    const displayName = [first, last].filter(Boolean).join(" ") || newContactEmail.trim() || "Novo contato";
    const preview = normalizedNewContactEmail || newContactPhone.trim() || "Contato adicionado";
    const activityAt = Date.now();
    const timeLabel = formatTimestampLabel(activityAt) || "Agora";
    const fallbackId = `ctt-${Date.now()}`;
    const newId = normalizedNewContactEmail ? contactIdFromEmail(normalizedNewContactEmail) : fallbackId;
    const displayNameLower = displayName.toLowerCase();
    const existing = contacts.find((contact) => {
      const sameName = contact.title.toLowerCase() === displayNameLower;
      if (!normalizedNewContactEmail) return sameName;
      const contactEmail = contact.contactEmail ? normalizeEmail(contact.contactEmail) : "";
      const previewEmail = extractEmail(contact.preview);
      const sameEmail = contactEmail === normalizedNewContactEmail || previewEmail === normalizedNewContactEmail;
      const idMatches = contact.id === contactIdFromEmail(normalizedNewContactEmail);
      return sameEmail || idMatches || sameName;
    });
    const contactEmail = normalizedNewContactEmail || undefined;
    const targetId = existing ? existing.id : newId;

    if (existing) {
      setContacts((prev) =>
        prev.map((contact) =>
          contact.id === existing.id
            ? {
                ...contact,
                title: displayName,
                preview,
                lastActivity: timeLabel,
                lastActivityAt: activityAt,
                contactEmail: contactEmail ?? contact.contactEmail,
              }
            : contact,
        ),
      );
    } else {
      setContacts((prev) => [
        {
          id: newId,
          title: displayName,
          preview,
          lastActivity: timeLabel,
          lastActivityAt: activityAt,
          tab: "contacts",
          contactEmail,
        },
        ...prev,
      ]);
    }
    setConversations((prev) => prev.filter((thread) => thread.id !== targetId));
    setMessagesByThread((prev) => ({ ...prev, [targetId]: prev[targetId] ?? [] }));
    setUnreadByThread((prev) => ({ ...prev, [targetId]: prev[targetId] ?? 0 }));

    setNewContactFirstName("");
    setNewContactLastName("");
    setNewContactEmail("");
    setNewContactPhone("");
    setNewContactSync(false);
    setIsNewContactOpen(false);
  }, [
    contacts,
    newContactEmail,
    newContactFirstName,
    newContactLastName,
    newContactPhone,
    normalizedNewContactEmail,
  ]);
  const resolveThreadAvatarUrl = useCallback(
    (thread: Thread | null | undefined) => {
      if (!thread) return null;
      const override = threadAvatarOverrides[thread.id] ?? null;
      if (serverMessagingEnabled && isUuid(thread.id)) {
        return thread.avatarUrl ?? override;
      }
      return override ?? thread.avatarUrl ?? null;
    },
    [serverMessagingEnabled, threadAvatarOverrides],
  );
  const activeThreadAvatarUrl = useMemo(() => resolveThreadAvatarUrl(activeThread), [activeThread, resolveThreadAvatarUrl]);
  const resolveMessageTimeLabel = useCallback(
    (message: Message) => {
      const messageTimestamp =
        typeof message.sentAt === "number" && Number.isFinite(message.sentAt)
          ? message.sentAt
          : toTimestampMs(message.time);
      if (!messageTimestamp) return message.time;
      return formatClockLabel(messageTimestamp) || message.time;
    },
    [],
  );
  const resolveThreadLastActivityLabel = useCallback(
    (thread: Thread) => {
      const threadTimestamp =
        typeof thread.lastActivityAt === "number" && Number.isFinite(thread.lastActivityAt) && thread.lastActivityAt > 0
          ? thread.lastActivityAt
          : null;
      if (!threadTimestamp) return thread.lastActivity;
      return formatTimestampLabel(threadTimestamp) || thread.lastActivity;
    },
    [],
  );
  const resolvePresenceTimestampByEmail = useCallback(
    (emailRaw?: string | null) => {
      const normalizedEmail = normalizeEmail(emailRaw ?? "");
      if (!normalizedEmail || !isValidEmail(normalizedEmail)) return null;
      const fromMap = presenceByEmail[normalizedEmail] ?? 0;
      const directoryEntry = directoryEntries.find((entry) => normalizeEmail(entry.email) === normalizedEmail);
      const fromDirectory = toTimestampMs(directoryEntry?.updatedAt ?? directoryEntry?.createdAt ?? null) ?? 0;
      const latest = Math.max(fromMap, fromDirectory);
      return latest > 0 ? latest : null;
    },
    [directoryEntries, presenceByEmail],
  );
  const headerInfo = useMemo(() => {
    const thread = activeThread;
    const isContact = thread?.tab === "contacts" || thread?.tab === "conversations";
    const isGroup = thread?.tab === "groups";
    const now = clockTick;
    if (!thread) {
      return {
        statusLabel: "Offline",
        lastSeenLabel: "Último acesso indisponível",
        hintLabel: "clique para mostrar dados",
        dotClass: "bg-slate-300",
      };
    }

    if (isGroup) {
      const participantTimestamps = (thread.participantRoles ?? [])
        .map((participant) => {
          const presenceTimestamp = resolvePresenceTimestampByEmail(participant.email);
          return Math.max(presenceTimestamp ?? 0, participant.lastSeenAt ?? 0);
        })
        .filter((value) => value > 0);
      const onlineCount = participantTimestamps.filter((timestamp) => now - timestamp <= PRESENCE_ONLINE_WINDOW_MS).length;
      const latestSeenAt = participantTimestamps.length ? Math.max(...participantTimestamps) : null;
      const statusLabel = `${onlineCount} participante${onlineCount === 1 ? "" : "s"} online`;
      const lastSeenLabel = latestSeenAt
        ? onlineCount > 0
          ? "Participantes ativos agora"
          : `Última atividade: ${formatLastSeenTimestamp(latestSeenAt)}`
        : "Último acesso indisponível";
      return {
        statusLabel,
        lastSeenLabel,
        hintLabel: "clique para mostrar dados do grupo",
        dotClass: onlineCount > 0 ? "bg-emerald-400" : "bg-slate-300",
      };
    }

    const contactEmail = isContact ? getThreadRecipientEmail(thread) : null;
    const isSelfContact = Boolean(
      contactEmail &&
        identity?.email &&
        normalizeEmail(contactEmail) === normalizeEmail(identity.email),
    );
    const participantSeenAt =
      thread.participantRoles?.find((participant) => normalizeEmail(participant.email) === normalizeEmail(contactEmail ?? ""))?.lastSeenAt ??
      null;
    const incomingSeenAt = (messagesByThread[thread.id] ?? []).reduce<number>((latest, message) => {
      if (message.author === "me") return latest;
      const messageAt =
        typeof message.sentAt === "number" && Number.isFinite(message.sentAt)
          ? message.sentAt
          : toTimestampMs(message.time) ?? 0;
      return messageAt > latest ? messageAt : latest;
    }, 0);
    const threadSeenAt =
      typeof thread.lastActivityAt === "number" && Number.isFinite(thread.lastActivityAt) ? thread.lastActivityAt : 0;
    const presenceSeenAt = resolvePresenceTimestampByEmail(contactEmail) ?? 0;
    const lastSeenAt = Math.max(participantSeenAt ?? 0, incomingSeenAt, threadSeenAt, presenceSeenAt, isSelfContact ? now : 0) || null;
    const isOnline = Boolean(lastSeenAt && now - lastSeenAt <= PRESENCE_ONLINE_WINDOW_MS);
    const statusLabel = isOnline ? "Online" : "Offline";
    const lastSeenLabel = lastSeenAt
      ? isOnline
        ? "Ativo agora"
        : `Último acesso: ${formatLastSeenTimestamp(lastSeenAt)}`
      : "Último acesso indisponível";
    const hintLabel = isContact
      ? "clique para mostrar dados do contato"
      : "clique para mostrar dados";
    const dotClass = isOnline ? "bg-emerald-400" : "bg-slate-300";
    return { statusLabel, lastSeenLabel, hintLabel, dotClass };
  }, [activeThread, clockTick, getThreadRecipientEmail, identity?.email, messagesByThread, resolvePresenceTimestampByEmail]);
  const headerInfoItems = useMemo(
    () => [headerInfo.statusLabel, headerInfo.lastSeenLabel, headerInfo.hintLabel].filter(Boolean),
    [headerInfo],
  );
  const profileData = useMemo(() => {
    if (profileTarget === "self") {
      return {
        title: currentUser?.name ?? "Participante",
        avatarUrl: currentUser?.avatarUrl ?? null,
        avatarText: currentUser?.avatarText ?? "KN",
        recado: settingsState.profileRecado ?? DEFAULT_SETTINGS_STATE.profileRecado,
        phone: "Não informado",
      };
    }
    if (activeThread) {
      const groupDescription =
        activeThread.tab === "groups" ? (groupDescriptions[activeThread.id] ?? "") : "";
      return {
        title: activeThread.title,
        avatarUrl: activeThreadAvatarUrl ?? null,
        avatarText: getAvatarText(activeThread.title),
        recado:
          activeThread.tab === "groups"
            ? groupDescription || "Sem descrição"
            : activeThread.preview ?? "Sem recado",
        phone: activeThread.tab === "groups" ? "Grupo sem telefone" : "+55 68 9614-3009",
      };
    }
    return null;
  }, [
    activeThread,
    activeThreadAvatarUrl,
    currentUser,
    groupDescriptions,
    profileTarget,
    settingsState.profileRecado,
  ]);
  const canEditProfile = profileTarget === "self";
  useEffect(() => {
    if (!isProfileOpen || profileTarget !== "self") return;
    setProfileNameDraft(identity?.name ?? "");
    setProfileRecadoDraft(settingsState.profileRecado ?? DEFAULT_SETTINGS_STATE.profileRecado);
    setProfileAvatarNotice(null);
  }, [identity?.name, isProfileOpen, profileTarget, settingsState.profileRecado]);

  const handleOpenProfile = (target: "thread" | "self") => {
    setIsHeaderAvatarMenuOpen(false);
    setIsProfileOpen(true);
    setProfileTarget(target);
    setIsProfileAvatarPreviewOpen(false);
    setIsProfileAvatarActionMenuOpen(false);
    setIsProfileAvatarDesktopCameraOpen(false);
    setIsNewChatOpen(false);
    setIsCustomListOpen(false);
    setIsNewChatEmailOpen(false);
    setIsNewGroupOpen(false);
    setIsNewGroupCreateOpen(false);
    setIsCommunityListOpen(false);
    setIsGroupsPanelOpen(false);
    setIsGroupCreateOpen(false);
    setSelectedGroupMemberIds([]);
    if (target === "thread") {
      setIsSettingsOpen(false);
      setActiveSettingKey(null);
    } else {
      setIsSettingsOpen(false);
      setActiveSettingKey(null);
    }
  };

  const handleCloseProfile = () => {
    setIsProfileOpen(false);
    setProfileTarget(null);
    setIsProfileAvatarPreviewOpen(false);
    setIsProfileAvatarActionMenuOpen(false);
    setIsProfileAvatarDesktopCameraOpen(false);
  };
  const resetPanelsForMobileNavigation = () => {
    setIsSettingsOpen(false);
    setActiveSettingKey(null);
    setIsProfileOpen(false);
    setProfileTarget(null);
    setIsProfileAvatarPreviewOpen(false);
    setIsDirectoryOpen(false);
    setDirectorySearch("");
    setIsDirectoryFiltersOpen(false);
    setIsNewChatOpen(false);
    setIsCustomListOpen(false);
    setIsNewChatEmailOpen(false);
    setIsNewGroupOpen(false);
    setIsNewGroupCreateOpen(false);
    setIsCommunityListOpen(false);
    setIsGroupsPanelOpen(false);
    setIsGroupCreateOpen(false);
    setIsNewContactOpen(false);
    setIsGroupsExpanded(false);
    setSelectedGroupMemberIds([]);
    setIsThreadMenuOpen(false);
    setIsContactInfoOpen(false);
    setIsContactEditOpen(false);
    setIsGroupInfoOpen(false);
    setIsGroupMemberModalOpen(false);
    setIsGroupPermissionsOpen(false);
    setIsGroupAdminsModalOpen(false);
    setIsMobileDetailOpen(false);
  };
  const openMobileFooterEnvironment = (
    key: "conversations" | "calls" | "status" | "channels" | "communities" | "contacts",
    options?: { directoryTab?: DirectoryTabKey },
  ) => {
    setIsMobileProfileSheetOpen(false);
    resetPanelsForMobileNavigation();
    setActiveNavKey(key);
    if (key === "contacts") {
      setIsDirectoryOpen(true);
      setDirectoryTab(options?.directoryTab ?? "people");
      return;
    }
    if (key === "communities") {
      setIsNewChatOpen(true);
      setIsCommunityListOpen(true);
      return;
    }
    if (key === "channels") {
      setActiveFilter("groups");
      return;
    }
    setActiveFilter("all");
  };
  const openSettingsFromMobileSheet = (key: (typeof SETTINGS_MENU)[number]["key"] | null) => {
    setIsMobileProfileSheetOpen(false);
    resetPanelsForMobileNavigation();
    setActiveNavKey("settings");
    setIsSettingsOpen(true);
    setActiveSettingKey(key);
  };
  const handleSidebarMenuSelect = (
    key: "conversations" | "calls" | "status" | "channels" | "communities" | "contacts" | "images" | "settings",
  ) => {
    if (key === "settings") {
      openSettingsFromMobileSheet(null);
      setIsNavSidebarOpen(false);
      return;
    }
    if (key === "images") {
      setActiveNavKey("images");
      setIsDirectoryOpen(false);
      setIsMediaModalOpen(true);
      setActiveMediaTab("media");
      setIsMediaSelectMode(false);
      setSelectedMediaIds([]);
      setIsMediaFilterOpen(false);
      setIsMediaShareOpen(false);
      setShareSearch("");
      setShareMessage("");
      setSelectedShareContactIds([]);
      clearShareAudios();
      if (shareRecordingState === "recording") {
        stopShareRecording("discard");
      }
      setIsNavSidebarOpen(false);
      return;
    }
    if (key === "contacts") {
      openMobileFooterEnvironment("contacts", { directoryTab: "people" });
      setIsNavSidebarOpen(false);
      return;
    }
    openMobileFooterEnvironment(key);
    setIsNavSidebarOpen(false);
  };
  const handleBackFromSettingsDetail = useCallback(() => {
    if (isMobileView) {
      setIsSettingsOpen(false);
      setActiveSettingKey(null);
      setIsMobileProfileSheetOpen(true);
      return;
    }
    setActiveSettingKey(null);
  }, [isMobileView]);
  const commitProfileName = useCallback(() => {
    if (profileTarget !== "self" || !identity) return;
    const normalizedName = normalizeName(profileNameDraft);
    if ((identity.name ?? "") === normalizedName) return;
    const updated = { ...identity, name: normalizedName };
    setIdentity(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore profile persistence errors.
    }
  }, [identity, profileNameDraft, profileTarget]);
  const commitProfileRecado = useCallback(() => {
    if (profileTarget !== "self") return;
    setSettingsState((prev) => {
      if (prev.profileRecado === profileRecadoDraft) return prev;
      return { ...prev, profileRecado: profileRecadoDraft };
    });
  }, [profileRecadoDraft, profileTarget]);
  const handleShareProfileAvatar = useCallback(async () => {
    const avatarUrl = profileData?.avatarUrl ?? "";
    if (!avatarUrl) {
      setProfileAvatarNotice("Adicione uma foto para compartilhar.");
      return;
    }
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({
          title: "Foto do perfil",
          text: "Foto do perfil",
          url: avatarUrl,
        });
        return;
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
    }
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(avatarUrl);
        setProfileAvatarNotice("Link da foto copiado.");
        return;
      }
    } catch {
      // Ignore clipboard share errors.
    }
    setProfileAvatarNotice("Não foi possível compartilhar agora.");
  }, [profileData?.avatarUrl]);
  const handleInlineProfileNameEdit = useCallback(() => {
    if (profileTarget !== "self" || !identity) return;
    const currentName = profileNameDraft || identity.name || "";
    const nextName = window.prompt("Atualizar nome", currentName);
    if (nextName === null) return;
    const normalizedName = normalizeName(nextName);
    setProfileNameDraft(normalizedName);
    if ((identity.name ?? "") === normalizedName) return;
    const updated = { ...identity, name: normalizedName || undefined };
    setIdentity(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore profile persistence errors.
    }
  }, [identity, profileNameDraft, profileTarget]);
  const handleInlineProfileRecadoEdit = useCallback(() => {
    if (profileTarget !== "self") return;
    const currentRecado = profileRecadoDraft || settingsState.profileRecado || DEFAULT_SETTINGS_STATE.profileRecado;
    const nextRecado = window.prompt("Atualizar recado", currentRecado);
    if (nextRecado === null) return;
    setProfileRecadoDraft(nextRecado);
    setSettingsState((prev) => {
      if (prev.profileRecado === nextRecado) return prev;
      return { ...prev, profileRecado: nextRecado };
    });
  }, [profileRecadoDraft, profileTarget, settingsState.profileRecado]);
  const handleCloseProfileAndCommit = useCallback(() => {
    commitProfileName();
    commitProfileRecado();
    setIsProfileOpen(false);
    setProfileTarget(null);
    setIsProfileAvatarPreviewOpen(false);
    setIsProfileAvatarActionMenuOpen(false);
    setIsProfileAvatarDesktopCameraOpen(false);
  }, [commitProfileName, commitProfileRecado]);
  const closeProfileAvatarPreview = useCallback(() => {
    setIsProfileAvatarActionMenuOpen(false);
    setIsProfileAvatarDesktopCameraOpen(false);
    setIsProfileAvatarPreviewOpen(false);
  }, []);

  const uploadProfileAvatarFile = useCallback(
    async (file: File): Promise<boolean> => {
      if (!file.type.startsWith("image/")) {
        setProfileAvatarNotice("Escolha uma imagem válida.");
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        setProfileAvatarNotice("A imagem deve ter até 5MB.");
        return false;
      }

      setProfileAvatarUploading(true);
      setProfileAvatarNotice(null);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await authFetch("/api/knexchat/avatar", {
          method: "POST",
          body: formData,
        });
        const payload = (await res.json().catch(() => null)) as
          | {
              avatar_url?: string;
              message?: string;
            }
          | null;
        if (!res.ok || !payload?.avatar_url) {
          throw new Error(payload?.message ?? "Não foi possível atualizar o avatar.");
        }

        const normalizedAvatar = normalizeAvatarUrl(payload.avatar_url);
        if (!normalizedAvatar) {
          throw new Error("Resposta de avatar inválida.");
        }

        const syncedAt = new Date().toISOString();
        if (identity?.email) {
          applyRealtimeProfileSync({
            email: identity.email,
            ...(identity.name ? { name: identity.name } : {}),
            avatarUrl: normalizedAvatar,
            createdAt: syncedAt,
          });
        } else {
          setSelfAvatarUrl(normalizedAvatar);
        }
        if (identity?.userId) {
          writeKnexchatProfileSeed(identity.userId, {
            avatarUrl: normalizedAvatar,
            ...(identity.name ? { displayName: identity.name } : {}),
            createdAt: syncedAt,
          });
        }
        setProfileAvatarNotice("Foto de perfil atualizada.");
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Não foi possível atualizar o avatar.";
        setProfileAvatarNotice(message);
        return false;
      } finally {
        setProfileAvatarUploading(false);
      }
    },
    [applyRealtimeProfileSync, authFetch, identity?.email, identity?.name, identity?.userId],
  );

  const handleProfileAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (profileTarget !== "self") {
      event.target.value = "";
      return;
    }
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await uploadProfileAvatarFile(file);
  };

  const handleOpenProfileAvatarCamera = useCallback(async () => {
    if (profileTarget !== "self") return;
    setIsProfileAvatarActionMenuOpen(false);
    setProfileAvatarDesktopCameraCapturedFile(null);
    setProfileAvatarDesktopCameraCapturedPreview(null);
    const isMobileDevice =
      isMobileView ||
      (typeof navigator !== "undefined" &&
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    if (isMobileDevice) {
      profileAvatarCameraInputRef.current?.click();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setProfileAvatarNotice("A câmera do navegador não está disponível. Abrindo seletor do sistema.");
      profileAvatarCameraInputRef.current?.click();
      return;
    }
    try {
      const previousStream = profileAvatarDesktopCameraStreamRef.current;
      if (previousStream) {
        previousStream.getTracks().forEach((track) => track.stop());
        profileAvatarDesktopCameraStreamRef.current = null;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      profileAvatarDesktopCameraStreamRef.current = stream;
      const video = profileAvatarDesktopCameraVideoRef.current;
      if (video) {
        video.srcObject = stream;
        void video.play().catch(() => {
          // Ignore autoplay restrictions; user can interact to retry.
        });
      }
      setIsProfileAvatarDesktopCameraOpen(true);
    } catch {
      setProfileAvatarNotice("Não foi possível acessar a câmera. Use Galeria para continuar.");
    }
  }, [isMobileView, profileTarget]);

  const handleCaptureProfileAvatarFromDesktopCamera = useCallback(async () => {
    const video = profileAvatarDesktopCameraVideoRef.current;
    if (!video) return;
    const sourceWidth = video.videoWidth || 0;
    const sourceHeight = video.videoHeight || 0;
    if (!sourceWidth || !sourceHeight) {
      setProfileAvatarNotice("A câmera ainda não está pronta. Tente novamente.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = sourceWidth;
    canvas.height = sourceHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setProfileAvatarNotice("Não foi possível capturar a imagem da câmera.");
      return;
    }
    context.drawImage(video, 0, 0, sourceWidth, sourceHeight);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.92);
    });
    if (!blob) {
      setProfileAvatarNotice("Não foi possível gerar a foto da câmera.");
      return;
    }
    const capturedFile = new File([blob], `avatar-camera-${Date.now()}.jpg`, { type: "image/jpeg" });
    const previewData = canvas.toDataURL("image/jpeg", 0.92);
    setProfileAvatarDesktopCameraCapturedFile(capturedFile);
    setProfileAvatarDesktopCameraCapturedPreview(previewData);
    const stream = profileAvatarDesktopCameraStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      profileAvatarDesktopCameraStreamRef.current = null;
    }
    if (profileAvatarDesktopCameraVideoRef.current) {
      profileAvatarDesktopCameraVideoRef.current.srcObject = null;
    }
  }, []);

  const handleApplyProfileAvatarFromDesktopCamera = useCallback(async () => {
    if (!profileAvatarDesktopCameraCapturedFile) return;
    const uploaded = await uploadProfileAvatarFile(profileAvatarDesktopCameraCapturedFile);
    if (!uploaded) return;
    setIsProfileAvatarDesktopCameraOpen(false);
  }, [profileAvatarDesktopCameraCapturedFile, uploadProfileAvatarFile]);

  const getGroupSelectionContactEmail = useCallback(
    (contact: { contactEmail?: string | null; preview?: string | null }) => {
      if (contact.contactEmail) {
        const normalized = normalizeEmail(contact.contactEmail);
        return normalized && isValidEmail(normalized) ? normalized : "";
      }
      const previewEmail = extractEmail(contact.preview ?? "");
      if (!previewEmail) return "";
      const normalized = normalizeEmail(previewEmail);
      return normalized && isValidEmail(normalized) ? normalized : "";
    },
    [],
  );

  const openGroupMemberPickerForActiveGroup = useCallback(() => {
    if (!activeThread || activeThread.tab !== "groups") return;
    setGroupMemberPickerMode("add");
    setSelectedGroupMemberIds([]);
    setNewGroupSearch("");
    if (!isMobileView) {
      setIsGroupMemberModalOpen(true);
      return;
    }
    setIsNewChatOpen(true);
    setIsNewGroupOpen(true);
    setIsNewGroupCreateOpen(false);
    setIsNewChatEmailOpen(false);
    setIsCommunityListOpen(false);
    setIsNewContactOpen(false);
  }, [activeThread, isMobileView]);

  const handleAddMembersToActiveGroup = useCallback(async () => {
    const thread = activeThread;
    if (!thread || thread.tab !== "groups") return;

    const selectedContacts = selectableGroupContacts.filter((contact) =>
      selectedGroupMemberIds.includes(contact.id),
    );
    const selectedEmails = selectedContacts
      .map((contact) => getGroupSelectionContactEmail(contact))
      .filter(Boolean);
    if (!selectedEmails.length) {
      setMessageSendNotice("Selecione ao menos um contato para adicionar.");
      return;
    }

    const currentParticipants = new Set<string>();
    (thread.participantRoles ?? []).forEach((participant) => {
      const normalized = normalizeEmail(participant.email);
      if (!normalized || !isValidEmail(normalized)) return;
      currentParticipants.add(normalized);
    });
    const emailsToAdd = Array.from(new Set(selectedEmails)).filter((email) => !currentParticipants.has(email));
    if (!emailsToAdd.length) {
      setMessageSendNotice("Os contatos selecionados já fazem parte do grupo.");
      return;
    }

    if (serverMessagingEnabled && isUuid(thread.id)) {
      try {
        const res = await authFetch("/api/knexchat/threads", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threadId: thread.id, participants: emailsToAdd }),
        });
        if (!res.ok) {
          if (res.status === 422) {
            const payload = (await res.json().catch(() => ({}))) as { missing?: string[] };
            const missing = Array.isArray(payload?.missing) ? payload.missing : [];
            setMessageSendNotice(
              missing.length
                ? `Alguns participantes não estão cadastrados: ${missing.join(", ")}`
                : "Alguns participantes não estão cadastrados no KnexChat.",
            );
            return;
          }
          if (res.status === 403) {
            setMessageSendNotice("Somente admins podem adicionar membros ao grupo.");
            return;
          }
          throw new Error("group_add_members_failed");
        }

        const payload = (await res.json().catch(() => ({}))) as { thread?: ApiThread };
        if (payload.thread) {
          const mapped = mapApiThreadToThread(payload.thread);
          setGroups((prev) => prev.map((group) => (group.id === mapped.id ? mapped : group)));
        }
        void fetchThreadsFromServer();
        refreshRealtime();
      } catch {
        setMessageSendNotice("Não foi possível adicionar membros agora.");
        return;
      }
    } else {
      const now = Date.now();
      setGroups((prev) =>
        prev.map((group) => {
          if (group.id !== thread.id) return group;
          const existingRoles = group.participantRoles ?? [];
          const existingEmails = new Set<string>();
          existingRoles.forEach((participant) => {
            const normalized = normalizeEmail(participant.email);
            if (normalized && isValidEmail(normalized)) {
              existingEmails.add(normalized);
            }
          });
          const additions = selectedContacts
            .map((contact) => {
              const email = getGroupSelectionContactEmail(contact);
              if (!email || existingEmails.has(email)) return null;
              existingEmails.add(email);
              return {
                email,
                role: "member" as const,
                name: contact.title,
                avatarUrl: contact.avatarUrl ?? null,
                lastSeenAt: now,
              };
            })
            .filter(Boolean) as NonNullable<Thread["participantRoles"]>;
          if (!additions.length) return group;
          const participantRoles = [...existingRoles, ...additions];
          return {
            ...group,
            participantRoles,
            onlineCount: participantRoles.length,
          };
        }),
      );
    }

    if (isGroupMemberModalOpen) {
      setIsGroupMemberModalOpen(false);
    } else {
      setIsNewChatOpen(false);
      setIsNewGroupOpen(false);
      setIsNewGroupCreateOpen(false);
    }
    setSelectedGroupMemberIds([]);
    setNewGroupSearch("");
    setGroupMemberPickerMode("create");
    setMessageSendNotice(
      `${emailsToAdd.length} membro${emailsToAdd.length === 1 ? "" : "s"} adicionado${emailsToAdd.length === 1 ? "" : "s"}.`,
    );
  }, [
    activeThread,
    authFetch,
    fetchThreadsFromServer,
    getGroupSelectionContactEmail,
    mapApiThreadToThread,
    refreshRealtime,
    isGroupMemberModalOpen,
    selectableGroupContacts,
    selectedGroupMemberIds,
    serverMessagingEnabled,
  ]);

  const handleAdvanceGroupMemberPicker = useCallback(() => {
    if (!selectedGroupMembers.length) return;
    if (groupMemberPickerMode === "add") {
      void handleAddMembersToActiveGroup();
      return;
    }
    setIsNewGroupCreateOpen(true);
  }, [groupMemberPickerMode, handleAddMembersToActiveGroup, selectedGroupMembers.length]);

  const closeGroupMemberPickerModal = useCallback(() => {
    setIsGroupMemberModalOpen(false);
    setSelectedGroupMemberIds([]);
    setNewGroupSearch("");
    setGroupMemberPickerMode("create");
  }, []);

  const handleCreateGroup = async () => {
    if (!identity?.email) return;
    const trimmedName = newGroupName.trim();
    const memberEmails = selectedGroupMemberIds
      .map((id) => selectableGroupContacts.find((contact) => contact.id === id))
      .map((contact) => (contact ? getGroupSelectionContactEmail(contact) : ""))
      .filter(Boolean);
    if (serverMessagingEnabled) {
      try {
        const res = await authFetch("/api/knexchat/threads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "group",
            title: trimmedName || "Novo grupo",
            ...(newGroupImageUrl ? { avatarUrl: newGroupImageUrl } : {}),
            createdBy: identity.email,
            participants: memberEmails,
            admins: [identity.email],
          }),
        });
        if (!res.ok) {
          if (res.status === 422) {
            const payload = (await res.json().catch(() => ({}))) as { missing?: string[] };
            const missing = Array.isArray(payload?.missing) ? payload.missing : [];
            alert(
              missing.length
                ? `Alguns participantes não estão cadastrados: ${missing.join(", ")}`
                : "Alguns participantes não estão cadastrados no KnexChat.",
            );
            return;
          }
          throw new Error("group_create_failed");
        }
        const payload = (await res.json().catch(() => ({}))) as { thread?: ApiThread };
        if (!payload.thread) throw new Error("missing_thread");
        const mapped = mapApiThreadToThread(payload.thread);
        setGroups((prev) => (prev.some((item) => item.id === mapped.id) ? prev : [mapped, ...prev]));
        setMessagesByThread((prev) => ({ ...prev, [mapped.id]: prev[mapped.id] ?? [] }));
        setActiveFilter("groups");
        setActiveThreadId(mapped.id);
        refreshRealtime();
      } catch {
        alert("Não foi possível criar o grupo agora.");
        return;
      }
    } else {
      const groupId = `grp-${Date.now()}`;
      const memberCount = selectedGroupMemberIds.length;
      const title = trimmedName || "Novo grupo";
      const newGroup: Thread = {
        id: groupId,
        title,
        preview: memberCount
          ? `${memberCount} participante${memberCount === 1 ? "" : "s"} selecionado${memberCount === 1 ? "" : "s"}`
          : "Grupo criado",
        lastActivity: "Agora",
        lastActivityAt: Date.now(),
        tab: "groups",
        avatarUrl: newGroupImageUrl ?? undefined,
        onlineCount: memberCount,
      };
      setGroups((prev) => [newGroup, ...prev]);
      if (newGroupImageUrl) {
        setThreadAvatarOverrides((prev) => ({ ...prev, [groupId]: newGroupImageUrl }));
      }
      setMessagesByThread((prev) => ({
        ...prev,
        [groupId]: [{ id: "m1", author: "them", body: "Grupo criado.", time: "Agora" }],
      }));
      setActiveFilter("groups");
      setActiveThreadId(groupId);
    }
    setIsNewChatOpen(false);
    setIsNewGroupOpen(false);
    setIsNewGroupCreateOpen(false);
    setIsCommunityListOpen(false);
    setSelectedGroupMemberIds([]);
    setNewGroupName("");
    setNewGroupImageUrl(null);
  };

  const handleGroupImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("A foto do grupo deve ter até 2MB.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      if (!result) return;
      setNewGroupImageUrl(result);
      setIsGroupImageMenuOpen(false);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };
  const stopComposerCameraStream = useCallback(() => {
    const stream = composerCameraStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      composerCameraStreamRef.current = null;
    }
    const video = composerCameraVideoRef.current;
    if (video) {
      video.srcObject = null;
    }
  }, []);
  const closeComposerCamera = useCallback(() => {
    setIsComposerCameraOpen(false);
    setComposerCameraError(null);
    setIsComposerCameraBusy(false);
    setComposerCameraCapturedFile(null);
    setComposerCameraCapturedPreview(null);
    stopComposerCameraStream();
  }, [stopComposerCameraStream]);
  const openComposerCamera = useCallback(() => {
    setIsComposerAttachmentMenuOpen(false);
    if (isMobileView) {
      messageCameraInputRef.current?.click();
      return;
    }
    setComposerCameraError(null);
    setIsComposerCameraBusy(false);
    setComposerCameraCapturedFile(null);
    setComposerCameraCapturedPreview(null);
    setIsComposerCameraOpen(true);
  }, [isMobileView]);
  const handleComposerAttachmentMenuAction = useCallback(
    (action: "document" | "gallery" | "camera" | "audio" | "contact" | "poll" | "event" | "sticker") => {
      setIsComposerAttachmentMenuOpen(false);
      if (action === "document" || action === "gallery") {
        messageImageInputRef.current?.click();
        return;
      }
      if (action === "camera") {
        openComposerCamera();
        return;
      }
      const labels: Record<string, string> = {
        audio: "Áudio",
        contact: "Contato",
        poll: "Enquete",
        event: "Evento",
        sticker: "Nova figurinha",
      };
      setMessageSendNotice(`${labels[action]} ficará disponível em breve.`);
    },
    [openComposerCamera],
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
    setIsThreadMenuOpen(false);
  }, [activeThreadId]);
  useEffect(() => {
    if (!isMobileView && !showMobileConversationShellHeader) return;
    setIsHeaderAvatarMenuOpen(false);
  }, [isMobileView, showMobileConversationShellHeader]);
  useEffect(() => {
    if (!isMobileView) return;
    setIsGlobalSearchOpen(false);
  }, [isMobileView]);
  useEffect(() => {
    if (!isThreadMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (threadMenuRef.current?.contains(target)) return;
      if (threadMenuAnchorRef.current?.contains(target)) return;
      setIsThreadMenuOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsThreadMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [isThreadMenuOpen]);
  useEffect(() => {
    if (!isHeaderAvatarMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (headerAvatarMenuRef.current?.contains(target)) return;
      setIsHeaderAvatarMenuOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsHeaderAvatarMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [isHeaderAvatarMenuOpen]);
  useEffect(() => {
    if (!isGlobalSearchOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (globalSearchContainerRef.current?.contains(target)) return;
      setIsGlobalSearchOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsGlobalSearchOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [isGlobalSearchOpen]);
  useEffect(() => {
    if (!desktopConversationContextMenu) return;
    const closeMenu = () => setDesktopConversationContextMenu(null);
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (desktopConversationContextMenuRef.current?.contains(target)) return;
      closeMenu();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("resize", closeMenu);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("resize", closeMenu);
    };
  }, [desktopConversationContextMenu]);
  useEffect(() => {
    if (!isComposerAttachmentMenuOpen || isMobileView) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (composerAttachmentMenuRef.current?.contains(target)) return;
      if (composerAttachmentButtonRef.current?.contains(target)) return;
      setIsComposerAttachmentMenuOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsComposerAttachmentMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [isComposerAttachmentMenuOpen, isMobileView]);
  useEffect(() => {
    if (!isComposerCameraOpen || isMobileView || composerCameraCapturedPreview) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setComposerCameraError("A câmera não está disponível neste navegador.");
      return;
    }
    let cancelled = false;
    setComposerCameraError(null);
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        composerCameraStreamRef.current = stream;
        const video = composerCameraVideoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
      } catch {
        if (!cancelled) {
          setComposerCameraError("Não foi possível acessar a câmera.");
        }
      }
    })();
    return () => {
      cancelled = true;
      stopComposerCameraStream();
    };
  }, [composerCameraCapturedPreview, isComposerCameraOpen, isMobileView, stopComposerCameraStream]);
  useEffect(() => {
    if (!isComposerCameraOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeComposerCamera();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [closeComposerCamera, isComposerCameraOpen]);
  useEffect(() => {
    if (!isComposerCameraOpen) return;
    setIsComposerAttachmentMenuOpen(false);
  }, [isComposerCameraOpen]);

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
      stopComposerCameraStream();
    };
  }, [stopComposerCameraStream]);

  const activeMessages = useMemo(() => {
    if (!activeThread) return [];
    return messagesByThread[activeThread.id] ?? [];
  }, [activeThread, messagesByThread]);
  const isActiveThreadMessageLoading = Boolean(activeThread && messageLoadingByThread[activeThread.id]);
  const activeThreadMessageLoadError = activeThread ? messageErrorByThread[activeThread.id] ?? null : null;
  const hasActiveThreadMessages = activeMessages.length > 0;
  const shouldShowInitialMessageLoading = isActiveThreadMessageLoading && !hasActiveThreadMessages;
  const shouldShowMessageEmptyState =
    !isActiveThreadMessageLoading && !activeThreadMessageLoadError && !hasActiveThreadMessages;
  useEffect(() => {
    if (!activeThreadId) return;
    const isThreadSwitch = previousMessageListThreadRef.current !== activeThreadId;
    previousMessageListThreadRef.current = activeThreadId;
    if (isThreadSwitch) {
      messageListPinnedToBottomRef.current = true;
    }
    const frameId = window.requestAnimationFrame(() => {
      scrollMessageListToBottom(isThreadSwitch);
    });
    const timeoutId = window.setTimeout(() => {
      scrollMessageListToBottom(isThreadSwitch);
    }, 120);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [activeMessages.length, activeThreadId, scrollMessageListToBottom]);
  const conversationMediaItems = useMemo<ConversationMediaViewerItem[]>(() => {
    return activeMessages
      .filter((message) => Boolean(message.imageUrl))
      .map((message, index) => {
        const senderInfo = message.senderEmail
          ? contactNameByEmail.get(normalizeEmail(message.senderEmail))
          : undefined;
        const senderName =
          message.author === "me"
            ? currentUser?.name ?? "Você"
            : message.senderName?.trim() || senderInfo?.name || "Participante";
        const senderAvatarCandidate =
          message.author === "me"
            ? currentUser?.avatarUrl ?? null
            : message.senderAvatarUrl ?? senderInfo?.avatarUrl ?? null;
        return {
          id: message.id,
          src: message.imageUrl ?? "",
          label: message.imageName ?? message.body ?? `Mídia ${index + 1}`,
          time: resolveMessageTimeLabel(message),
          senderName,
          senderAvatarUrl: normalizeAvatarUrl(senderAvatarCandidate) ?? undefined,
          mediaType: detectMediaTypeFromSource(message.imageUrl),
        };
      });
  }, [activeMessages, contactNameByEmail, currentUser?.avatarUrl, currentUser?.name, resolveMessageTimeLabel]);
  const activeConversationMediaItem =
    conversationMediaItems.length && conversationMediaViewerIndex >= 0
      ? conversationMediaItems[Math.min(conversationMediaViewerIndex, conversationMediaItems.length - 1)]
      : null;
  const openConversationMediaViewer = useCallback(
    (messageId: string) => {
      const index = conversationMediaItems.findIndex((item) => item.id === messageId);
      if (index < 0) return;
      setMessageMediaContextMenu(null);
      setConversationMediaViewerIndex(index);
      setIsConversationMediaViewerUiVisible(!isMobileView);
      setIsConversationMediaViewerOpen(true);
    },
    [conversationMediaItems, isMobileView],
  );
  const closeConversationMediaViewer = useCallback(() => {
    const video = conversationMediaViewerVideoRef.current;
    if (video && !video.paused) {
      video.pause();
    }
    setIsConversationMediaViewerOpen(false);
    setIsConversationMediaViewerUiVisible(false);
    setIsConversationMediaViewerVideoPlaying(false);
    setConversationMediaViewerVideoCurrentTime(0);
    setConversationMediaViewerVideoDuration(0);
    conversationMediaViewerTouchStartRef.current = null;
    conversationMediaViewerDidSwipeRef.current = false;
  }, []);
  const toggleConversationMediaViewerVideoPlayback = useCallback(() => {
    const video = conversationMediaViewerVideoRef.current;
    if (!video) return;
    if (isMobileView) {
      setIsConversationMediaViewerUiVisible(true);
    }
    if (video.paused || video.ended) {
      setIsConversationMediaViewerVideoPlaying(true);
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          setIsConversationMediaViewerVideoPlaying(false);
        });
      }
      return;
    }
    setIsConversationMediaViewerVideoPlaying(false);
    video.pause();
  }, [isMobileView]);
  const cycleConversationMediaViewerVideoPlaybackSpeed = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      setConversationMediaViewerVideoPlaybackSpeed((previous) => getNextPlaybackSpeed(previous));
    },
    [],
  );
  const handleConversationMediaViewerVideoSurfaceClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.stopPropagation();
      if (conversationMediaViewerDidSwipeRef.current) {
        conversationMediaViewerDidSwipeRef.current = false;
        return;
      }
      toggleConversationMediaViewerVideoPlayback();
    },
    [toggleConversationMediaViewerVideoPlayback],
  );
  const handleConversationMediaViewerVideoButtonClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      toggleConversationMediaViewerVideoPlayback();
    },
    [toggleConversationMediaViewerVideoPlayback],
  );
  const toggleConversationMediaViewerUi = useCallback(() => {
    if (!isMobileView) return;
    setIsConversationMediaViewerUiVisible((previous) => !previous);
  }, [isMobileView]);
  const goToPreviousConversationMedia = useCallback(() => {
    setConversationMediaViewerIndex((prev) => Math.max(0, prev - 1));
  }, []);
  const goToNextConversationMedia = useCallback(() => {
    setConversationMediaViewerIndex((prev) => Math.min(conversationMediaItems.length - 1, prev + 1));
  }, [conversationMediaItems.length]);
  const updateMessageVideoDuration = useCallback((messageId: string, seconds: number) => {
    if (!messageId || !Number.isFinite(seconds) || seconds <= 0) return;
    const label = formatDuration(Math.round(seconds));
    setMessageVideoDurationById((previous) =>
      previous[messageId] === label ? previous : { ...previous, [messageId]: label },
    );
  }, []);
  const closeMessageMediaContextMenu = useCallback(() => {
    setMessageMediaContextMenu(null);
  }, []);
  const openMessageMediaContextMenu = useCallback(
    (
      event: React.MouseEvent<HTMLButtonElement>,
      message: Message,
      mediaType: "image" | "video",
    ) => {
      if (isMobileView || !message.imageUrl) return;
      event.preventDefault();
      event.stopPropagation();
      const menuWidth = 320;
      const menuHeight = 420;
      const gutter = 8;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const x = Math.min(Math.max(gutter, event.clientX), Math.max(gutter, viewportWidth - menuWidth - gutter));
      const y = Math.min(Math.max(gutter, event.clientY), Math.max(gutter, viewportHeight - menuHeight - gutter));
      setMessageMediaContextMenu({
        messageId: message.id,
        src: message.imageUrl,
        label: message.imageName ?? message.body ?? (mediaType === "video" ? "Vídeo" : "Imagem"),
        mediaType,
        x,
        y,
      });
    },
    [isMobileView],
  );
  const handleMessageMediaContextMenuAction = useCallback(() => {
    setMessageMediaContextMenu(null);
  }, []);
  const handleMessageMediaContextMenuCopy = useCallback(async () => {
    if (!messageMediaContextMenu) return;
    try {
      const response = await fetch(messageMediaContextMenu.src);
      if (!response.ok) throw new Error("copy_fetch_failed");
      const blob = await response.blob();
      if (
        typeof ClipboardItem !== "undefined" &&
        navigator.clipboard?.write &&
        blob.type &&
        (messageMediaContextMenu.mediaType === "image" || blob.type.startsWith("image/"))
      ) {
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      } else {
        const dataUrl = await readFileAsDataUrl(blob);
        await navigator.clipboard.writeText(dataUrl);
      }
    } catch {
      try {
        await navigator.clipboard.writeText(messageMediaContextMenu.src);
      } catch {
        // Ignore clipboard errors to keep menu responsive.
      }
    }
    setMessageMediaContextMenu(null);
  }, [messageMediaContextMenu, readFileAsDataUrl]);
  const handleMessageMediaContextMenuSaveAs = useCallback(() => {
    if (!messageMediaContextMenu) return;
    const link = document.createElement("a");
    link.href = messageMediaContextMenu.src;
    link.download = messageMediaContextMenu.label;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setMessageMediaContextMenu(null);
  }, [messageMediaContextMenu]);
  const handleConversationMediaViewerTouchStart = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (!isMobileView || conversationMediaItems.length <= 1) return;
      const touch = event.touches[0];
      if (!touch) return;
      conversationMediaViewerDidSwipeRef.current = false;
      conversationMediaViewerTouchStartRef.current = { x: touch.clientX, y: touch.clientY };
    },
    [conversationMediaItems.length, isMobileView],
  );
  const handleConversationMediaViewerTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (!isMobileView || conversationMediaItems.length <= 1) return;
      const start = conversationMediaViewerTouchStartRef.current;
      conversationMediaViewerTouchStartRef.current = null;
      if (!start) return;
      const touch = event.changedTouches[0];
      if (!touch) return;
      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;
      if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
      conversationMediaViewerDidSwipeRef.current = true;
      setIsConversationMediaViewerUiVisible(false);
      if (deltaX < 0) {
        goToNextConversationMedia();
        return;
      }
      goToPreviousConversationMedia();
    },
    [conversationMediaItems.length, goToNextConversationMedia, goToPreviousConversationMedia, isMobileView],
  );
  const handleConversationMediaViewerOverlayClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!isMobileView) {
        closeConversationMediaViewer();
        return;
      }
      if (conversationMediaViewerDidSwipeRef.current) {
        conversationMediaViewerDidSwipeRef.current = false;
        return;
      }
      const target = event.target as HTMLElement | null;
      if (!target || target.closest("button, a")) return;
      toggleConversationMediaViewerUi();
    },
    [closeConversationMediaViewer, isMobileView, toggleConversationMediaViewerUi],
  );
  useEffect(() => {
    if (!isConversationMediaViewerOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeConversationMediaViewer();
        return;
      }
      if (event.key === "ArrowLeft") {
        goToPreviousConversationMedia();
        return;
      }
      if (event.key === "ArrowRight") {
        goToNextConversationMedia();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [
    closeConversationMediaViewer,
    goToNextConversationMedia,
    goToPreviousConversationMedia,
    isConversationMediaViewerOpen,
  ]);
  useEffect(() => {
    if (!messageMediaContextMenu || isMobileView) return;
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && messageMediaContextMenuRef.current?.contains(target)) return;
      closeMessageMediaContextMenu();
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMessageMediaContextMenu();
      }
    };
    const handleViewportChange = () => {
      closeMessageMediaContextMenu();
    };
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [closeMessageMediaContextMenu, isMobileView, messageMediaContextMenu]);
  useEffect(() => {
    if (!isConversationMediaViewerOpen) return;
    if (!conversationMediaItems.length) {
      setIsConversationMediaViewerOpen(false);
      setIsConversationMediaViewerUiVisible(false);
      setConversationMediaViewerIndex(0);
      return;
    }
    if (conversationMediaViewerIndex >= conversationMediaItems.length) {
      setConversationMediaViewerIndex(conversationMediaItems.length - 1);
    }
  }, [conversationMediaItems.length, conversationMediaViewerIndex, isConversationMediaViewerOpen]);
  useEffect(() => {
    if (
      !isConversationMediaViewerOpen ||
      !activeConversationMediaItem ||
      activeConversationMediaItem.mediaType !== "video"
    ) {
      const video = conversationMediaViewerVideoRef.current;
      if (video && !video.paused) {
        video.pause();
      }
      setIsConversationMediaViewerVideoPlaying(false);
      setConversationMediaViewerVideoCurrentTime(0);
      setConversationMediaViewerVideoDuration(0);
      return;
    }
    setIsConversationMediaViewerVideoPlaying(false);
    setConversationMediaViewerVideoCurrentTime(0);
    setConversationMediaViewerVideoDuration(0);
  }, [activeConversationMediaItem, isConversationMediaViewerOpen]);
  useEffect(() => {
    const video = conversationMediaViewerVideoRef.current;
    if (!video) return;
    video.playbackRate = conversationMediaViewerVideoPlaybackSpeed;
  }, [conversationMediaViewerVideoPlaybackSpeed, activeConversationMediaItem?.id, isConversationMediaViewerOpen]);
  useEffect(() => {
    if (!isConversationMediaViewerOpen || !isMobileView || !isConversationMediaViewerUiVisible) return;
    const timeoutId = window.setTimeout(() => {
      setIsConversationMediaViewerUiVisible(false);
    }, 2300);
    return () => window.clearTimeout(timeoutId);
  }, [conversationMediaViewerIndex, isConversationMediaViewerOpen, isConversationMediaViewerUiVisible, isMobileView]);
  useEffect(() => {
    setIsConversationMediaViewerOpen(false);
    setIsConversationMediaViewerUiVisible(false);
    setMessageMediaContextMenu(null);
    setIsConversationMediaViewerVideoPlaying(false);
    setConversationMediaViewerVideoCurrentTime(0);
    setConversationMediaViewerVideoDuration(0);
    setConversationMediaViewerIndex(0);
    conversationMediaViewerTouchStartRef.current = null;
    conversationMediaViewerDidSwipeRef.current = false;
  }, [activeThreadId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateLayout = () => {
      setActivationLayout(computeActivationLayout(window.innerWidth, window.innerHeight));
    };
    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 767px)");
    const handleChange = () => setIsMobileView(media.matches);
    handleChange();
    if (media.addEventListener) {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);
  useEffect(() => {
    if (!debugUiEnabled || typeof window === "undefined") return;
    const updateDebugSnapshot = () => {
      const rootFontSize = window.getComputedStyle(document.documentElement).fontSize;
      const visualWidth = window.visualViewport ? Math.round(window.visualViewport.width) : null;
      const visualHeight = window.visualViewport ? Math.round(window.visualViewport.height) : null;
      setDebugUiSnapshot({
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        visualViewport: visualWidth && visualHeight ? `${visualWidth}x${visualHeight}` : "indisponível",
        rootFontSize,
        route: `${window.location.pathname}${window.location.search}`,
        env: process.env.NODE_ENV ?? "unknown",
        userAgent: navigator.userAgent,
      });
    };

    updateDebugSnapshot();
    window.addEventListener("resize", updateDebugSnapshot);
    const visualViewport = window.visualViewport;
    if (visualViewport) {
      visualViewport.addEventListener("resize", updateDebugSnapshot);
    }

    return () => {
      window.removeEventListener("resize", updateDebugSnapshot);
      if (visualViewport) {
        visualViewport.removeEventListener("resize", updateDebugSnapshot);
      }
    };
  }, [debugUiEnabled, pathname, searchQuery]);

  useEffect(() => {
    if (isMobileView) return;
    setIsMobileProfileSheetOpen(false);
  }, [isMobileView]);
  useEffect(() => {
    if (isMobileProfileSheetOpen) return;
    setMobileProfileSheetScrollY(0);
    setIsMobileProfileSearchOpen(false);
    setMobileProfileSearchQuery("");
  }, [isMobileProfileSheetOpen]);
  useEffect(() => {
    if (!isMobileProfileSheetOpen || !isMobileProfileSearchOpen) return;
    if (mobileProfileSheetScrollRef.current) {
      mobileProfileSheetScrollRef.current.scrollTop = 0;
    }
    const timer = window.setTimeout(() => {
      mobileProfileSearchInputRef.current?.focus();
      mobileProfileSearchInputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isMobileProfileSearchOpen, isMobileProfileSheetOpen]);

  useEffect(() => {
    if (!(isDirectoryOpen || isGroupsPanelOpen || isNewChatOpen || isProfileOpen || isSettingsOpen)) return;
    setIsCustomListOpen(false);
  }, [isDirectoryOpen, isGroupsPanelOpen, isNewChatOpen, isProfileOpen, isSettingsOpen]);

  const updateTopMenuCarouselEdges = useCallback(() => {
    const element = topMenuCarouselRef.current;
    if (!element) {
      setCanScrollTopMenuLeft(false);
      setCanScrollTopMenuRight(false);
      return;
    }
    const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);
    setCanScrollTopMenuLeft(element.scrollLeft > 2);
    setCanScrollTopMenuRight(element.scrollLeft < maxScrollLeft - 2);
  }, []);

  useEffect(() => {
    if (showMobileConversationShellHeader) {
      setCanScrollTopMenuLeft(false);
      setCanScrollTopMenuRight(false);
      return;
    }

    const element = topMenuCarouselRef.current;
    if (!element) {
      setCanScrollTopMenuLeft(false);
      setCanScrollTopMenuRight(false);
      return;
    }

    const handleTopMenuEdgeUpdate = () => updateTopMenuCarouselEdges();
    handleTopMenuEdgeUpdate();
    element.addEventListener("scroll", handleTopMenuEdgeUpdate, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => handleTopMenuEdgeUpdate());
      resizeObserver.observe(element);
    }

    window.addEventListener("resize", handleTopMenuEdgeUpdate);
    return () => {
      element.removeEventListener("scroll", handleTopMenuEdgeUpdate);
      window.removeEventListener("resize", handleTopMenuEdgeUpdate);
      resizeObserver?.disconnect();
    };
  }, [showMobileConversationShellHeader, updateTopMenuCarouselEdges]);

  useEffect(() => {
    const hasHorizontalOverflow = (element: HTMLDivElement | null) => {
      if (!element) return false;
      return element.scrollWidth - element.clientWidth > 1;
    };

    const evaluateCarouselNeeds = () => {
      if (!isMobileView) {
        setIsMobileDockCarousel(false);
      } else {
        setIsMobileDockCarousel(hasHorizontalOverflow(mobileDockButtonsRef.current));
      }
      setIsConversationFiltersCarousel(hasHorizontalOverflow(conversationFiltersRef.current));
      setIsDirectoryFiltersCarousel(hasHorizontalOverflow(directoryFiltersRef.current));
    };

    evaluateCarouselNeeds();
    const rafId = window.requestAnimationFrame(evaluateCarouselNeeds);
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => evaluateCarouselNeeds());
      if (mobileDockButtonsRef.current) resizeObserver.observe(mobileDockButtonsRef.current);
      if (conversationFiltersRef.current) resizeObserver.observe(conversationFiltersRef.current);
      if (directoryFiltersRef.current) resizeObserver.observe(directoryFiltersRef.current);
    }
    window.addEventListener("resize", evaluateCarouselNeeds);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", evaluateCarouselNeeds);
      resizeObserver?.disconnect();
    };
  }, [
    activeFilter,
    directoryFilter,
    directoryTab,
    isDirectoryFiltersOpen,
    isCustomListOpen,
    isMobileView,
    isNewChatOpen,
  ]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw || !raw.trim()) {
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
    };
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setAuthSession(data.session ?? null);
      setIsAuthReady(true);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthSession(session ?? null);
      setIsAuthReady(true);
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authSession?.user?.id) {
      setEntitlementBlocked(false);
    }
  }, [authSession?.user?.id]);

  useEffect(() => {
    if (!isAuthReady) return;
    if (!authSession?.access_token) {
      setIsKnexchatActivated(false);
      setActivationProfileIdentity(null);
      return;
    }
    let active = true;
    (async () => {
      try {
        const res = await authFetch("/api/knexchat/activation/status");
        if (!res.ok) throw new Error("status_failed");
        const payload = (await res.json().catch(() => null)) as {
          activated?: boolean;
          profile?: {
            display_name?: string | null;
            nickname_normalized?: string | null;
            nickname?: string | null;
          } | null;
        } | null;
        if (active) {
          setIsKnexchatActivated(Boolean(payload?.activated));
          const profileDisplayName = normalizeName(payload?.profile?.display_name ?? "");
          const profileKnexId = normalizeKnexId(payload?.profile?.nickname_normalized ?? payload?.profile?.nickname ?? "");
          setActivationProfileIdentity(
            profileDisplayName || profileKnexId
              ? {
                  ...(profileDisplayName ? { displayName: profileDisplayName } : {}),
                  ...(profileKnexId ? { knexId: profileKnexId } : {}),
                }
              : null,
          );
        }
      } catch {
        if (active) {
          // Keep previous activation state on transient failures to avoid UI flashing loops.
          setIsKnexchatActivated((prev) => (prev === true ? true : false));
          setActivationProfileIdentity((prev) => prev);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [authFetch, authSession?.access_token, isAuthReady]);

  useEffect(() => {
    if (!isAuthReady) return;
    if (!authSession?.user?.email) {
      setIdentity(null);
      return;
    }
    if (isKnexchatActivated === false) {
      setIdentity(null);
      return;
    }
    if (isKnexchatActivated === null) return;

    const normalizedEmail = normalizeEmail(authSession.user.email);
    const metadata = authSession.user.user_metadata as {
      name?: string;
      full_name?: string;
      avatar_url?: string;
      picture?: string;
      avatar?: string;
    } | null;
    const normalizedName = normalizeName(
      activationProfileIdentity?.displayName ?? metadata?.name ?? metadata?.full_name ?? "",
    );
    const normalizedKnexId = normalizeKnexId(activationProfileIdentity?.knexId ?? "");
    const normalizedAvatar = normalizeAvatarUrl(metadata?.avatar_url ?? metadata?.picture ?? metadata?.avatar ?? null);
    let storedIdentity: Identity | null = null;
    try {
      storedIdentity = safeParseIdentity(localStorage.getItem(STORAGE_KEY) ?? "");
    } catch {
      storedIdentity = null;
    }
    const reusableStoredIdentity =
      storedIdentity &&
      storedIdentity.userId === authSession.user.id &&
      normalizeEmail(storedIdentity.email) === normalizedEmail
        ? storedIdentity
        : null;
    const stableDeviceId = reusableStoredIdentity?.deviceId?.trim()
      ? reusableStoredIdentity.deviceId
      : `dev_${Math.random().toString(16).slice(2)}`;
    const stableCreatedAt = reusableStoredIdentity?.createdAt?.trim()
      ? reusableStoredIdentity.createdAt
      : authSession.user.created_at ?? new Date().toISOString();
    const nextIdentity: Identity = {
      userId: authSession.user.id,
      email: normalizedEmail,
      emailVerified: Boolean(authSession.user.email_confirmed_at),
      deviceId: stableDeviceId,
      createdAt: stableCreatedAt,
      name: normalizedName || undefined,
      ...(normalizedKnexId ? { knexId: normalizedKnexId } : {}),
    };
    setIdentity((prev) => (areIdentitiesEqual(prev, nextIdentity) ? prev : nextIdentity));
    try {
      if (!areIdentitiesEqual(reusableStoredIdentity, nextIdentity)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextIdentity));
      }
    } catch {
      // Ignore storage errors.
    }
    const directoryEntry: DirectoryEntry = {
      email: normalizedEmail,
      name: normalizedName || undefined,
      ...(normalizedAvatar ? { avatarUrl: normalizedAvatar } : {}),
      createdAt: new Date().toISOString(),
    };
    setDirectoryEntries((prev) => {
      const existingIndex = prev.findIndex((entry) => normalizeEmail(entry.email) === normalizedEmail);
      if (existingIndex >= 0) {
        const existing = prev[existingIndex];
        const shouldUpdate =
          (!existing.name && normalizedName) ||
          (!existing.avatarUrl && normalizedAvatar);
        if (!shouldUpdate) return prev;
        const next = [...prev];
        next[existingIndex] = {
          ...existing,
          ...(normalizedName ? { name: normalizedName } : {}),
          ...(normalizedAvatar ? { avatarUrl: normalizedAvatar } : {}),
        };
        return next;
      }
      return [directoryEntry, ...prev];
    });
    setDirectoryLookupCache((prev) => ({ ...prev, [normalizedEmail]: true }));
  }, [activationProfileIdentity?.displayName, activationProfileIdentity?.knexId, authSession, isAuthReady, isKnexchatActivated]);

  useEffect(() => {
    if (!isAuthReady || !authSession?.user?.email) return;
    if (isKnexchatActivated === false) return;
    if (isKnexchatActivated === null) return;

    const normalizedEmail = normalizeEmail(authSession.user.email);
    const metadata = authSession.user.user_metadata as {
      name?: string;
      full_name?: string;
    } | null;
    const normalizedName = normalizeName(
      activationProfileIdentity?.displayName ?? metadata?.name ?? metadata?.full_name ?? "",
    );
    const normalizedAvatar = normalizeAvatarUrl(selfAvatarUrl ?? null);

    void (async () => {
      try {
        const res = await authFetch("/api/knexchat/directory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: normalizedEmail,
            name: normalizedName || undefined,
            avatarUrl: normalizedAvatar || undefined,
          }),
        });
        if (res.status === 409) return;
      } catch {
        // Ignore directory registration errors.
      }
    })();
  }, [activationProfileIdentity?.displayName, authFetch, authSession, isAuthReady, isKnexchatActivated, selfAvatarUrl]);

  useEffect(() => {
    if (!chatStateKey) {
      resetChatState();
      setIsChatStateHydrated(true);
      return;
    }
    resetChatState();
    try {
      try {
        localStorage.removeItem(LEGACY_CHAT_STATE_KEY);
        localStorage.removeItem(LEGACY_CHAT_UI_STATE_KEY);
        localStorage.removeItem(LEGACY_DIRECTORY_KEY);
        localStorage.removeItem(LEGACY_INBOX_KEY);
        if (legacyChatStateKey) {
          localStorage.removeItem(legacyChatStateKey);
        }
        if (legacyChatUiStateKey) {
          localStorage.removeItem(legacyChatUiStateKey);
        }
      } catch {
        // Ignore legacy storage cleanup errors.
      }
      let raw = localStorage.getItem(chatStateKey);
      if (!raw || !raw.trim()) {
        setIsChatStateHydrated(true);
        return;
      }
      const parsed = safeParseJson<Partial<{
        conversations: Thread[];
        groups: Thread[];
        contacts: Thread[];
        hiddenThreadIds: string[];
        messagesByThread: Record<string, Message[]>;
        unreadByThread: Record<string, number>;
        settingsState: typeof DEFAULT_SETTINGS_STATE;
        selfAvatarUrl: string | null;
        threadAvatarOverrides: Record<string, string>;
        mediaLibrary: MediaItem[];
        groupDescriptions: Record<string, string>;
        groupPermissions: Record<string, GroupPermissions>;
        groupAdmins: Record<string, string[]>;
        customConversationLists: CustomConversationList[];
        activeFilter: FilterKey;
        activeThreadId: string;
      }>>(raw);
      if (!parsed) {
        localStorage.removeItem(chatStateKey);
        setIsChatStateHydrated(true);
        return;
      }
      if (Array.isArray(parsed.conversations)) {
        setConversations(parsed.conversations);
      }
      if (Array.isArray(parsed.groups)) {
        setGroups(parsed.groups);
      }
      if (Array.isArray(parsed.contacts)) {
        setContacts(parsed.contacts);
      }
      if (Array.isArray(parsed.hiddenThreadIds)) {
        setHiddenThreadIds(
          parsed.hiddenThreadIds.filter((id): id is string => typeof id === "string" && Boolean(id.trim())),
        );
      }
      if (parsed.messagesByThread && typeof parsed.messagesByThread === "object") {
        setMessagesByThread(parsed.messagesByThread);
      }
      if (parsed.unreadByThread && typeof parsed.unreadByThread === "object") {
        setUnreadByThread(parsed.unreadByThread);
      }
      if (parsed.settingsState && typeof parsed.settingsState === "object") {
        setSettingsState((prev) => ({ ...prev, ...parsed.settingsState }));
      }
      if (typeof parsed.selfAvatarUrl === "string" || parsed.selfAvatarUrl === null) {
        setSelfAvatarUrl(parsed.selfAvatarUrl ?? null);
      }
      if (parsed.threadAvatarOverrides && typeof parsed.threadAvatarOverrides === "object") {
        setThreadAvatarOverrides(parsed.threadAvatarOverrides);
      }
      if (Array.isArray(parsed.mediaLibrary)) {
        setMediaLibrary(parsed.mediaLibrary);
      }
      if (parsed.groupDescriptions && typeof parsed.groupDescriptions === "object") {
        setGroupDescriptions(parsed.groupDescriptions as Record<string, string>);
      }
      if (parsed.groupPermissions && typeof parsed.groupPermissions === "object") {
        setGroupPermissionsById(parsed.groupPermissions as Record<string, GroupPermissions>);
      }
      if (parsed.groupAdmins && typeof parsed.groupAdmins === "object") {
        setGroupAdminIdsByGroup(parsed.groupAdmins as Record<string, string[]>);
      }
      if (Array.isArray(parsed.customConversationLists)) {
        setCustomConversationLists(
          parsed.customConversationLists
            .filter((item) => item && typeof item === "object")
            .map((item) => {
              const draft = item as Partial<CustomConversationList>;
              const id = typeof draft.id === "string" ? draft.id.trim() : "";
              const name = typeof draft.name === "string" ? draft.name.trim() : "";
              const threadIds = Array.isArray(draft.threadIds)
                ? draft.threadIds.filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
                : [];
              const createdAt =
                typeof draft.createdAt === "number" && Number.isFinite(draft.createdAt) ? draft.createdAt : Date.now();
              if (!id || !name) return null;
              return { id, name, threadIds, createdAt };
            })
            .filter((item): item is CustomConversationList => Boolean(item)),
        );
      }
      const parsedUiState = chatUiStateKey
        ? safeParseJson<Partial<{ activeFilter: FilterKey; activeThreadId: string }>>(
            localStorage.getItem(chatUiStateKey),
          )
        : null;
      const hasUiFilter = typeof parsedUiState?.activeFilter === "string" && parsedUiState.activeFilter.length > 0;
      const hasUiThreadId =
        typeof parsedUiState?.activeThreadId === "string" && parsedUiState.activeThreadId.trim().length > 0;
      if (hasUiFilter) {
        setActiveFilter(parsedUiState.activeFilter as FilterKey);
      } else if (parsed.activeFilter) {
        setActiveFilter(parsed.activeFilter);
      }
      if (hasUiThreadId) {
        setActiveThreadId(parsedUiState.activeThreadId as string);
      } else if (parsed.activeThreadId) {
        setActiveThreadId(parsed.activeThreadId);
      }
    } catch {
      localStorage.removeItem(chatStateKey);
      if (chatUiStateKey) {
        localStorage.removeItem(chatUiStateKey);
      }
    } finally {
      setIsChatStateHydrated(true);
    }
  }, [chatStateKey, chatUiStateKey, legacyChatStateKey, legacyChatUiStateKey, resetChatState]);

  useEffect(() => {
    if (!isChatStateHydrated) return;
    if (!identity?.userId) return;
    if (!identity?.email) return;

    const applySeed = (seed: { avatarUrl?: string; createdAt?: string; displayName?: string } | null | undefined) => {
      if (!seed?.avatarUrl) return;
      const normalizedAvatar = normalizeAvatarUrl(seed.avatarUrl);
      if (!normalizedAvatar || normalizedAvatar === selfAvatarUrlRef.current) return;
      applyRealtimeProfileSync({
        email: identity.email,
        ...(identity.name ? { name: identity.name } : {}),
        avatarUrl: normalizedAvatar,
        ...(seed.createdAt ? { createdAt: seed.createdAt } : {}),
      });
    };

    applySeed(consumeKnexchatProfileSeed(identity.userId));
    const profileSeedStorageKey = getKnexchatProfileSeedKey(identity.userId);
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== profileSeedStorageKey || !event.newValue) return;
      const seed = safeParseJson<{ avatarUrl?: string; createdAt?: string; displayName?: string }>(event.newValue);
      applySeed(seed);
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [applyRealtimeProfileSync, identity?.email, identity?.name, identity?.userId, isChatStateHydrated]);

  useEffect(() => {
    if (!identity?.email) return;
    const selfEmail = normalizeEmail(identity.email);
    const selfEntry = directoryEntries.find((entry) => normalizeEmail(entry.email) === selfEmail);
    const normalizedAvatar = normalizeAvatarUrl(selfEntry?.avatarUrl ?? null);
    if (!normalizedAvatar || normalizedAvatar === selfAvatarUrl) return;
    setSelfAvatarUrl(normalizedAvatar);
  }, [directoryEntries, identity?.email, selfAvatarUrl]);

  useEffect(() => {
    if (typeof window === "undefined") {
      setDirectoryEntries([]);
      setDirectoryLookupCache({});
      setIsDirectoryCacheHydrated(true);
      return;
    }
    try {
      const cached = normalizeDirectoryEntries(localStorage.getItem(DIRECTORY_KEY));
      setDirectoryEntries(cached);
      setDirectoryLookupCache(() => {
        const next: Record<string, boolean> = {};
        cached.forEach((entry) => {
          const normalized = normalizeEmail(entry.email);
          if (normalized) next[normalized] = true;
        });
        return next;
      });
      setIsDirectoryCacheHydrated(true);
    } catch {
      setDirectoryEntries([]);
      setDirectoryLookupCache({});
      setIsDirectoryCacheHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isDirectoryCacheHydrated) return;
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(DIRECTORY_KEY, JSON.stringify(directoryEntries));
    } catch {
      // Ignore directory cache persistence errors.
    }
  }, [directoryEntries, isDirectoryCacheHydrated]);

  useEffect(() => {
    if (!isAuthReady || !authSession?.access_token) return;
    if (!identity?.email) return;
    if (isKnexchatActivated !== true || entitlementBlocked) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch("/api/knexchat/directory?limit=200");
        if (!res.ok) return;
        const payload = (await res.json().catch(() => ({}))) as {
          entries?: Array<{
            email?: string;
            name?: string | null;
            avatar_url?: string | null;
            avatarUrl?: string | null;
            created_at?: string;
            createdAt?: string;
            updated_at?: string;
            updatedAt?: string;
          }>;
        };
        if (cancelled || !Array.isArray(payload.entries)) return;
        const incoming = payload.entries
          .map((entry) => {
            const email = typeof entry.email === "string" ? normalizeEmail(entry.email) : "";
            if (!email || !isValidEmail(email)) return null;
            const name = typeof entry.name === "string" ? normalizeName(entry.name) : "";
            const avatarUrl = normalizeAvatarUrl(entry.avatar_url ?? entry.avatarUrl ?? null);
            const createdAt =
              typeof entry.created_at === "string"
                ? entry.created_at
                : typeof entry.createdAt === "string"
                  ? entry.createdAt
                  : new Date().toISOString();
            const updatedAt =
              typeof entry.updated_at === "string"
                ? entry.updated_at
                : typeof entry.updatedAt === "string"
                  ? entry.updatedAt
                  : undefined;
            const mapped: DirectoryEntry = {
              email,
              ...(name ? { name } : {}),
              ...(avatarUrl ? { avatarUrl } : {}),
              createdAt,
              ...(updatedAt ? { updatedAt } : {}),
            };
            return mapped;
          })
          .filter(Boolean) as DirectoryEntry[];
        if (!incoming.length) return;
        setDirectoryEntries((prev) => {
          const byEmail = new Map<string, DirectoryEntry>();
          prev.forEach((entry) => {
            const normalized = normalizeEmail(entry.email);
            if (!normalized) return;
            byEmail.set(normalized, entry);
          });
          incoming.forEach((entry) => {
            const normalized = normalizeEmail(entry.email);
            if (!normalized) return;
            const existing = byEmail.get(normalized);
            if (!existing) {
              byEmail.set(normalized, entry);
              return;
            }
            byEmail.set(normalized, {
              ...existing,
              ...(entry.name ? { name: entry.name } : {}),
              ...(entry.avatarUrl ? { avatarUrl: entry.avatarUrl } : {}),
              createdAt: existing.createdAt || entry.createdAt,
              updatedAt: entry.updatedAt ?? existing.updatedAt,
            });
          });
          return Array.from(byEmail.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        });
        setDirectoryLookupCache((prev) => {
          const next = { ...prev };
          incoming.forEach((entry) => {
            const normalized = normalizeEmail(entry.email);
            if (normalized) next[normalized] = true;
          });
          return next;
        });
      } catch {
        // Ignore directory sync failures.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, authSession?.access_token, entitlementBlocked, identity?.email, isAuthReady, isKnexchatActivated]);

  useEffect(() => {
    if (!serverMessagingEnabled || !identity?.email || !isChatStateHydrated) return;
    if (isKnexchatActivated !== true || entitlementBlocked || authHttpUnauthorized) return;
    if (!authTokenRef.current && !authSession?.access_token) return;
    void syncContactRequestsFromServer();
  }, [
    authHttpUnauthorized,
    authSession?.access_token,
    entitlementBlocked,
    identity?.email,
    isChatStateHydrated,
    isKnexchatActivated,
    serverMessagingEnabled,
    syncContactRequestsFromServer,
  ]);

  useEffect(() => {
    if (!serverMessagingEnabled || !identity?.email || !isChatStateHydrated) return;
    if (isKnexchatActivated !== true || entitlementBlocked || authHttpUnauthorized) return;
    if (!authTokenRef.current && !authSession?.access_token) return;
    const interval = window.setInterval(
      () => {
        void syncContactRequestsFromServer();
      },
      isRealtimeConnected ? 15000 : 9000,
    );
    return () => window.clearInterval(interval);
  }, [
    authHttpUnauthorized,
    authSession?.access_token,
    entitlementBlocked,
    identity?.email,
    isChatStateHydrated,
    isKnexchatActivated,
    isRealtimeConnected,
    serverMessagingEnabled,
    syncContactRequestsFromServer,
  ]);

  useEffect(() => {
    if (serverMessagingEnabled) return;
    if (!identity?.email || typeof window === "undefined" || !isChatStateHydrated) return;
    consumeInboxMessages();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === INBOX_KEY) {
        consumeInboxMessages();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [consumeInboxMessages, identity?.email, isChatStateHydrated, serverMessagingEnabled]);

  useEffect(() => {
    if (!serverMessagingEnabled || !identity?.email || !isChatStateHydrated) return;
    if (isKnexchatActivated !== true || entitlementBlocked || authHttpUnauthorized) return;
    if (!authTokenRef.current && !authSession?.access_token) return;
    void fetchThreadsFromServer();
  }, [
    authHttpUnauthorized,
    authSession?.access_token,
    entitlementBlocked,
    fetchThreadsFromServer,
    identity?.email,
    isChatStateHydrated,
    isKnexchatActivated,
    serverMessagingEnabled,
  ]);

  useEffect(() => {
    if (!serverMessagingEnabled || !identity?.email || !isChatStateHydrated) return;
    if (isKnexchatActivated !== true || entitlementBlocked || authHttpUnauthorized) return;
    if (!authTokenRef.current && !authSession?.access_token) return;
    const interval = window.setInterval(
      () => {
        void fetchThreadsFromServer();
      },
      isRealtimeConnected ? 12000 : 8000,
    );
    return () => window.clearInterval(interval);
  }, [
    authHttpUnauthorized,
    authSession?.access_token,
    entitlementBlocked,
    fetchThreadsFromServer,
    identity?.email,
    isChatStateHydrated,
    isKnexchatActivated,
    isRealtimeConnected,
    serverMessagingEnabled,
  ]);

  useEffect(() => {
    if (!serverMessagingEnabled || !identity?.email || !isChatStateHydrated) return;
    if (isKnexchatActivated !== true || entitlementBlocked || authHttpUnauthorized) return;
    if (!authSession?.access_token) return;
    let source: EventSource | null = null;
    let cancelled = false;
    let reconnectTimer: number | null = null;

    const handleReady = () => {
      setIsRealtimeConnected(true);
    };

    const handleMessage = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as { message?: ApiMessage };
        const message = payload?.message;
        if (!message || !message.thread_id) return;
        const previousLastMessageId = lastSeenMessageByThreadRef.current[message.thread_id];
        if (previousLastMessageId && previousLastMessageId === message.id) return;
        lastSeenMessageByThreadRef.current[message.thread_id] = message.id;
        if (hiddenThreadIdsRef.current.has(message.thread_id)) {
          unhideThreadById(message.thread_id);
        }
        const mapped = mapApiMessageToMessage(message);
        setMessagesByThread((prev) => {
          const existing = prev[message.thread_id] ?? [];
          if (existing.some((item) => item.id === mapped.id)) return prev;
          return { ...prev, [message.thread_id]: [...existing, mapped] };
        });
        const activityAt = toTimestampMs(message.created_at) ?? Date.now();
        updateThreadActivity(message.thread_id, previewFromApiMessage(message), activityAt);
        if (mapped.author === "them" && !isThreadOpenInActiveConversation(message.thread_id, message.sender_email)) {
          setUnreadByThread((prev) => ({
            ...prev,
            [message.thread_id]: (prev[message.thread_id] ?? 0) + 1,
          }));
        }
        const hasThread = allThreadsRef.current.some((thread) => thread.id === message.thread_id);
        if (!hasThread) {
          void fetchThreadsFromServer();
        }
      } catch {
        // ignore payload errors
      }
    };

    const handleThread = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as {
          thread?: {
            id?: string;
            title?: string | null;
            avatar_url?: string | null;
            updated_at?: string | null;
            last_message_at?: string | null;
          };
        };
        const thread = payload?.thread;
        const threadId = typeof thread?.id === "string" ? thread.id : "";
        if (!isUuid(threadId)) return;

        applyRealtimeThreadSync({
          id: threadId,
          title: typeof thread?.title === "string" ? thread.title : null,
          ...(Object.prototype.hasOwnProperty.call(thread ?? {}, "avatar_url")
            ? { avatar_url: thread?.avatar_url ?? null }
            : {}),
          updated_at: typeof thread?.updated_at === "string" ? thread.updated_at : null,
          last_message_at: typeof thread?.last_message_at === "string" ? thread.last_message_at : null,
        });

        const now = Date.now();
        if (now - lastThreadRealtimeSyncRef.current < 700) return;
        lastThreadRealtimeSyncRef.current = now;
        void fetchThreadsFromServer();
      } catch {
        // ignore thread payload errors
      }
    };

    const handleProfile = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as {
          entry?: {
            email?: string;
            name?: string | null;
            avatar_url?: string | null;
            avatarUrl?: string | null;
            created_at?: string | null;
            createdAt?: string | null;
            updated_at?: string | null;
            updatedAt?: string | null;
          };
        };
        const entry = payload?.entry;
        if (!entry) return;
        applyRealtimeProfileSync(entry);
      } catch {
        // ignore profile payload errors
      }
    };

    const handleContactRequest = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as { entry?: unknown };
        if (!payload?.entry) return;
        applyRealtimeContactRequestSync(payload.entry);
      } catch {
        // ignore contact request payload errors
      }
    };

    const handleThreadParticipation = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as { entry?: { thread_id?: string } };
        const threadId = payload?.entry?.thread_id;
        if (!isUuid(threadId)) return;
        const hasThread = allThreadsRef.current.some((thread) => thread.id === threadId);
        void fetchThreadsFromServer();
        if (!hasThread) {
          refreshRealtime();
        }
      } catch {
        // ignore thread participation payload errors
      }
    };

    const handleError = () => {
      setIsRealtimeConnected(false);
      if (reconnectTimer !== null) return;
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        if (!cancelled) {
          refreshRealtime();
        }
      }, 2000);
    };

    const connect = async () => {
      setIsRealtimeConnected(false);
      const transport = await requestRealtimeTicket();
      if (!transport || cancelled) return;
      const url =
        transport.mode === "query"
          ? `/api/knexchat/realtime?ticket=${encodeURIComponent(transport.ticket)}`
          : "/api/knexchat/realtime";
      source = new EventSource(url);
      source.addEventListener("ready", handleReady as EventListener);
      source.addEventListener("message", handleMessage as EventListener);
      source.addEventListener("thread", handleThread as EventListener);
      source.addEventListener("profile", handleProfile as EventListener);
      source.addEventListener("contact_request", handleContactRequest as EventListener);
      source.addEventListener("thread_participation", handleThreadParticipation as EventListener);
      source.addEventListener("error", handleError as EventListener);
    };

    void connect();

    return () => {
      cancelled = true;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (!source) return;
      source.removeEventListener("ready", handleReady as EventListener);
      source.removeEventListener("message", handleMessage as EventListener);
      source.removeEventListener("thread", handleThread as EventListener);
      source.removeEventListener("profile", handleProfile as EventListener);
      source.removeEventListener("contact_request", handleContactRequest as EventListener);
      source.removeEventListener("thread_participation", handleThreadParticipation as EventListener);
      source.removeEventListener("error", handleError as EventListener);
      source.close();
    };
  }, [
    applyRealtimeContactRequestSync,
    applyRealtimeProfileSync,
    applyRealtimeThreadSync,
    authHttpUnauthorized,
    entitlementBlocked,
    fetchThreadsFromServer,
    authSession?.access_token,
    identity?.email,
    isChatStateHydrated,
    isKnexchatActivated,
    mapApiMessageToMessage,
    previewFromApiMessage,
    realtimeKey,
    requestRealtimeTicket,
    refreshRealtime,
    serverMessagingEnabled,
    isThreadOpenInActiveConversation,
    unhideThreadById,
    updateThreadActivity,
  ]);

  useEffect(() => {
    if (!serverMessagingEnabled || !identity?.email || !isChatStateHydrated) return;
    if (isKnexchatActivated !== true || entitlementBlocked || authHttpUnauthorized) return;
    if (!authTokenRef.current && !authSession?.access_token) return;
    if (!activeServerThreadId) return;
    let cancelled = false;
    const loadMessages = async () => {
      if (cancelled) return;
      await fetchMessagesForThread(activeServerThreadId);
    };
    void loadMessages();
    const interval = window.setInterval(loadMessages, isRealtimeConnected ? 2500 : 6000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    activeServerThreadId,
    authHttpUnauthorized,
    authSession?.access_token,
    entitlementBlocked,
    fetchMessagesForThread,
    identity?.email,
    isChatStateHydrated,
    isKnexchatActivated,
    isRealtimeConnected,
    serverMessagingEnabled,
  ]);

  useEffect(() => {
    if (!isChatStateHydrated || !chatStateKey) return;
    const timer = window.setTimeout(() => {
      try {
          localStorage.setItem(
          chatStateKey,
          JSON.stringify({
            conversations,
            groups,
            contacts,
            hiddenThreadIds,
            messagesByThread,
            unreadByThread,
            settingsState,
            groupDescriptions,
            groupPermissions: groupPermissionsById,
            groupAdmins: groupAdminIdsByGroup,
            customConversationLists,
            selfAvatarUrl,
            threadAvatarOverrides,
            mediaLibrary,
          }),
        );
      } catch {
        // Ignore storage errors.
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [
    chatStateKey,
    contacts,
    conversations,
    customConversationLists,
    hiddenThreadIds,
    groups,
    isChatStateHydrated,
    mediaLibrary,
    messagesByThread,
    unreadByThread,
    selfAvatarUrl,
    settingsState,
    groupDescriptions,
    groupPermissionsById,
    groupAdminIdsByGroup,
    threadAvatarOverrides,
  ]);

  useEffect(() => {
    if (!isChatStateHydrated || !chatUiStateKey) return;
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(
          chatUiStateKey,
          JSON.stringify({
            activeFilter,
            activeThreadId,
          }),
        );
      } catch {
        // Ignore storage errors.
      }
    }, 80);
    return () => window.clearTimeout(timer);
  }, [activeFilter, activeThreadId, chatUiStateKey, isChatStateHydrated]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    let disposed = false;
    navigator.serviceWorker
      .register("/knexchat/sw.js", { scope: "/knexchat/" })
      .then((registration) => {
        if (disposed) return;
        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }
        void registration.update().catch(() => undefined);
      })
      .catch((error) => {
        if (process.env.NODE_ENV !== "production") {
          console.error("[KnexChat] service worker registration failed", error);
        }
      });
    return () => {
      disposed = true;
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
      lastActivityAt: Date.now(),
      tab: "conversations",
    };
    setConversations((prev) => (prev.some((item) => item.id === threadParam) ? prev : [newThread, ...prev]));
    setActiveFilter("all");
    setActiveThreadId(threadParam);
  }, [threadParam, conversations, groups, contacts]);

  useEffect(() => {
    if (!isMobileView) return;
    if (threadParam) {
      setIsMobileDetailOpen(true);
    }
  }, [isMobileView, threadParam]);

  useEffect(() => {
    if (!isMobileView) {
      setIsMobileDetailOpen(false);
    }
  }, [isMobileView]);

  useEffect(() => {
    const activeExistsInAllThreads = Boolean(activeThreadId) && allThreads.some((thread) => thread.id === activeThreadId);
    if (activeExistsInAllThreads) return;

    if (!activeThreads.length) {
      if (activeThreadId) {
        setActiveThreadId("");
      }
      return;
    }

    // Auto-select only when there is no active thread or it was truly removed.
    setActiveThreadId(activeThreads[0].id);
  }, [activeThreads, activeThreadId, allThreads]);

  useEffect(() => {
    if (!isReady || !isAuthReady) return;
    if (identity) {
      if (!isChatRoute) {
        router.replace(chatHref);
      }
      return;
    }
    if (isKnexchatActivated === false) {
      router.replace(activationHref);
    }
  }, [activationHref, chatHref, identity, isAuthReady, isChatRoute, isKnexchatActivated, isReady, router]);

  useEffect(() => {
    if (!entitlementBlocked) return;
    const returnTo = `${pathname ?? "/knexchat/web"}${searchQuery ? `?${searchQuery}` : ""}`;
    router.replace(`/knexchat/activate?returnTo=${encodeURIComponent(returnTo)}`);
  }, [entitlementBlocked, pathname, router, searchQuery]);



  const handleLogout = async () => {
    setIsHeaderAvatarMenuOpen(false);
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore auth signout errors.
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors.
    }
    setIdentity(null);
    setEntitlementBlocked(false);
    setHandledJoinToken(null);
    resetChatState();
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
      lastActivityAt: Date.now(),
      tab: "groups",
    };
    setGroups((prev) => (prev.some((item) => item.id === newThreadId) ? prev : [newThread, ...prev]));
    setMessagesByThread((prev) => ({ ...prev, [newThreadId]: prev[newThreadId] ?? [] }));
    setActiveFilter("groups");
    setActiveThreadId(newThreadId);
    setHandledJoinToken(pendingJoinToken);
    setPendingJoinToken(null);
  };

  const handleSendMessage = async () => {
    let thread = activeThread;
    if (!thread) {
      const selfThread = ensureSelfConversationThread();
      if (selfThread) {
        setActiveFilter("all");
        openThreadById(selfThread.id);
        thread = selfThread;
      }
    }
    if (!thread) {
      setMessageSendNotice("Selecione uma conversa para enviar mensagem.");
      return;
    }
    const trimmed = messageDraft.trim();
    if (!trimmed) return;
    if (!(await ensureRecipientRegistered(thread))) return;
    if (messageSendNotice) setMessageSendNotice(null);
    const threadId = await ensureServerThreadForSend(thread);
    if (!threadId) {
      if (!messageSendNotice) {
        setMessageSendNotice("Não foi possível preparar esta conversa para envio.");
      }
      return;
    }

    if (serverMessagingEnabled && identity?.email && !isSelfConversationThread(thread)) {
      try {
        const res = await authFetch("/api/knexchat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId,
            senderEmail: identity.email,
            kind: "text",
            body: trimmed,
          }),
        });
        if (!res.ok) throw new Error("send_failed");
        const payload = (await res.json().catch(() => ({}))) as { message?: ApiMessage };
        if (!payload.message) throw new Error("missing_message");
        const mapped = mapApiMessageToMessage(payload.message);
        setMessagesByThread((prev) => ({
          ...prev,
          [threadId]: [...(prev[threadId] ?? []), mapped],
        }));
        const activityAt = toTimestampMs(payload.message.created_at) ?? Date.now();
        updateThreadActivity(threadId, previewFromApiMessage(payload.message), activityAt);
        setMessageDraft("");
        return;
      } catch {
        setMessageSendNotice("Não foi possível enviar a mensagem agora.");
        return;
      }
    }

    const activityAt = Date.now();
    const timeLabel = formatClockLabel(activityAt) || "Agora";
    const newMessage: Message = {
      id: `m_${Date.now()}`,
      author: "me",
      body: trimmed,
      time: timeLabel,
      sentAt: activityAt,
      deliveryStatus: "sent",
    };
    setMessagesByThread((prev) => ({
      ...prev,
      [threadId]: [...(prev[threadId] ?? []), newMessage],
    }));
    updateThreadActivity(threadId, trimmed, activityAt);
    setMessageDraft("");
  };

  const handleSendAttachment = async (file: File) => {
    let thread = activeThread;
    if (!thread) {
      const selfThread = ensureSelfConversationThread();
      if (selfThread) {
        setActiveFilter("all");
        openThreadById(selfThread.id);
        thread = selfThread;
      }
    }
    if (!thread) {
      setMessageSendNotice("Selecione uma conversa para enviar mensagem.");
      return;
    }
    if (!(await ensureRecipientRegistered(thread))) return;
    if (messageSendNotice) setMessageSendNotice(null);
    const threadId = await ensureServerThreadForSend(thread);
    if (!threadId) {
      if (!messageSendNotice) {
        setMessageSendNotice("Não foi possível preparar esta conversa para envio.");
      }
      return;
    }
    const isVideo = file.type.startsWith("video/");
    const isVisualMedia = file.type.startsWith("image/") || isVideo;
    const messageKind: "image" | "file" = isVisualMedia ? "image" : "file";
    const previewLabel = isVisualMedia ? (isVideo ? "Vídeo enviado" : "Imagem enviada") : "Arquivo enviado";
    const mediaName = file.name?.trim() || (isVisualMedia ? (isVideo ? "Vídeo enviado" : "Imagem enviada") : "Arquivo enviado");
    let persistedVisualMediaUrl: string | null = null;
    let mediaUrl = "";
    try {
      mediaUrl = await readFileAsDataUrl(file);
    } catch {
      setMessageSendNotice("Não foi possível preparar esse arquivo para envio.");
      return;
    }
    if (!mediaUrl) return;

    if (serverMessagingEnabled && identity?.email && !isSelfConversationThread(thread)) {
      try {
        const res = await authFetch("/api/knexchat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId,
            senderEmail: identity.email,
            kind: messageKind,
            body: mediaName,
            mediaUrl,
            mediaName,
          }),
        });
        if (!res.ok) throw new Error("send_failed");
        const payload = (await res.json().catch(() => ({}))) as { message?: ApiMessage };
        if (!payload.message) throw new Error("missing_message");
        const mapped = mapApiMessageToMessage(payload.message);
        persistedVisualMediaUrl = mapped.imageUrl ?? null;
        setMessagesByThread((prev) => ({
          ...prev,
          [threadId]: [...(prev[threadId] ?? []), mapped],
        }));
        const activityAt = toTimestampMs(payload.message.created_at) ?? Date.now();
        updateThreadActivity(threadId, previewFromApiMessage(payload.message), activityAt);
      } catch {
        setMessageSendNotice("Não foi possível enviar o arquivo agora.");
        return;
      }
    } else {
      const activityAt = Date.now();
      const timeLabel = formatClockLabel(activityAt) || "Agora";
      const newMessage: Message = isVisualMedia
        ? {
            id: `m_${Date.now()}`,
            author: "me",
            body: mediaName,
            time: timeLabel,
            sentAt: activityAt,
            imageUrl: mediaUrl,
            imageName: mediaName,
            deliveryStatus: "sent",
          }
        : {
            id: `m_${Date.now()}`,
            author: "me",
            body: mediaName,
            time: timeLabel,
            sentAt: activityAt,
            fileUrl: mediaUrl,
            fileName: mediaName,
            deliveryStatus: "sent",
          };
      setMessagesByThread((prev) => ({
        ...prev,
        [threadId]: [...(prev[threadId] ?? []), newMessage],
      }));
      updateThreadActivity(threadId, previewLabel, activityAt);
    }

    if (isVisualMedia) {
      const mediaItem: MediaItem = {
        id: `media_${Date.now()}`,
        threadId,
        label: mediaName,
        caption: `Enviado por ${currentUser?.name ?? "Você"}`,
        src: persistedVisualMediaUrl ?? mediaUrl,
        sizeKb: file.size ? Math.max(1, Math.round(file.size / 1024)) : undefined,
        isFavorite: false,
        mediaType: isVideo ? "video" : "image",
      };
      setMediaLibrary((prev) => [mediaItem, ...prev]);
    }
  };
  const handleMessageAttachmentChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleSendAttachment(file);
    event.target.value = "";
  };
  const pickPreferredAttachmentFile = useCallback((files: File[]) => {
    return (
      files.find((candidate) => candidate.type.startsWith("image/")) ??
      files.find((candidate) => candidate.type.startsWith("video/")) ??
      files[0] ??
      null
    );
  }, []);
  const extractMediaSourcesFromText = useCallback((raw: string | null | undefined) => {
    if (!raw) return [];
    const input = raw.trim();
    if (!input) return [];
    const sources: string[] = [];
    const seen = new Set<string>();
    const pushSource = (candidate: string | null | undefined) => {
      if (!candidate) return;
      const sanitized = candidate
        .trim()
        .replace(/^[<("'`]+/, "")
        .replace(/[>)"'`.,;]+$/, "")
        .replace(/&amp;/g, "&");
      if (!sanitized) return;
      if (!/^(https?:\/\/|blob:|data:)/i.test(sanitized)) return;
      if (seen.has(sanitized)) return;
      seen.add(sanitized);
      sources.push(sanitized);
    };
    function scanUnknown(value: unknown, depth: number): void {
      if (depth > 5 || value == null) return;
      if (typeof value === "string") {
        scanString(value, depth);
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((item) => scanUnknown(item, depth + 1));
        return;
      }
      if (typeof value === "object") {
        Object.values(value as Record<string, unknown>).forEach((item) => scanUnknown(item, depth + 1));
      }
    }
    function scanString(value: string, depth: number): void {
      const text = value.trim();
      if (!text) return;
      pushSource(text);
      const urlMatches = text.match(/(?:https?:\/\/|blob:)[^\s"'<>]+/gi);
      urlMatches?.forEach((match) => pushSource(match));
      const dataMatches = text.match(/data:[^\s"'<>]+/gi);
      dataMatches?.forEach((match) => pushSource(match));
      if (depth >= 4) return;
      if ((text.startsWith("{") || text.startsWith("[")) && text.length <= 220000) {
        try {
          const parsed = JSON.parse(text) as unknown;
          scanUnknown(parsed, depth + 1);
        } catch {
          // ignore non-json payloads
        }
      }
    }
    scanString(input, 0);
    return sources;
  }, []);
  const extractMediaSourcesFromHtml = useCallback(
    (html: string | null | undefined) => {
      if (!html) return [];
      const sources: string[] = [];
      const seen = new Set<string>();
      const pushSource = (candidate: string | null | undefined) => {
        if (!candidate) return;
        const cleaned = candidate.trim();
        if (!cleaned) return;
        if (seen.has(cleaned)) return;
        seen.add(cleaned);
        sources.push(cleaned);
      };
      if (typeof DOMParser !== "undefined") {
        try {
          const doc = new DOMParser().parseFromString(html, "text/html");
          doc
            .querySelectorAll("img[src], video[src], source[src], a[href]")
            .forEach((element) => pushSource(element.getAttribute("src") ?? element.getAttribute("href")));
        } catch {
          // ignore html parser errors
        }
      }
      const attrMatches = html.matchAll(/(?:src|href)=["']([^"']+)["']/gi);
      for (const match of attrMatches) {
        pushSource(match[1]);
      }
      extractMediaSourcesFromText(html).forEach((source) => pushSource(source));
      return sources;
    },
    [extractMediaSourcesFromText],
  );
  const collectMediaSourcesFromTransfer = useCallback(
    (transfer: DataTransfer | null | undefined) => {
      if (!transfer) return [];
      const sources: string[] = [];
      const seen = new Set<string>();
      const pushSource = (candidate: string | null | undefined) => {
        if (!candidate) return;
        const cleaned = candidate.trim();
        if (!cleaned) return;
        if (seen.has(cleaned)) return;
        seen.add(cleaned);
        sources.push(cleaned);
      };
      const uriList = transfer.getData("text/uri-list");
      if (uriList) {
        uriList
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith("#"))
          .forEach((line) => extractMediaSourcesFromText(line).forEach((source) => pushSource(source)));
      }
      extractMediaSourcesFromHtml(transfer.getData("text/html")).forEach((source) => pushSource(source));
      extractMediaSourcesFromText(transfer.getData("text/plain")).forEach((source) => pushSource(source));
      return sources;
    },
    [extractMediaSourcesFromHtml, extractMediaSourcesFromText],
  );
  const buildFileFromMediaSource = useCallback(async (source: string) => {
    try {
      const response = await fetch(source);
      if (!response.ok) return null;
      const blob = await response.blob();
      if (!blob.size) return null;
      const normalizedBlob = blob.type ? blob : new Blob([blob], { type: "application/octet-stream" });
      const sourcePath = source.split("#")[0]?.split("?")[0] ?? source;
      const encodedName = sourcePath.split("/").pop() ?? "";
      let decodedName = "";
      try {
        decodedName = decodeURIComponent(encodedName);
      } catch {
        decodedName = encodedName;
      }
      const sanitizedName = decodedName.replace(/[\\/:*?"<>|]/g, "_").trim();
      const hasExtension = /\.[a-z0-9]{2,12}$/i.test(sanitizedName);
      const mimeSubtype = normalizedBlob.type.includes("/")
        ? normalizedBlob.type.split("/")[1]?.split(";")[0]?.toLowerCase() ?? ""
        : "";
      const extensionMap: Record<string, string> = {
        jpeg: "jpg",
        "svg+xml": "svg",
        quicktime: "mov",
        "x-matroska": "mkv",
      };
      const mappedSubtype = extensionMap[mimeSubtype] ?? mimeSubtype;
      const extension = mappedSubtype ? `.${mappedSubtype.replace(/[^a-z0-9.+-]/g, "")}` : "";
      const detectedType = detectMediaTypeFromSource(source);
      const baseName =
        normalizedBlob.type.startsWith("video/") || detectedType === "video"
          ? "video-colado"
          : normalizedBlob.type.startsWith("image/")
            ? "imagem-colada"
            : "arquivo-colado";
      const fileName = sanitizedName && hasExtension ? sanitizedName : `${baseName}${extension}`;
      return new File([normalizedBlob], fileName, { type: normalizedBlob.type || "application/octet-stream" });
    } catch {
      return null;
    }
  }, []);
  const extractAttachmentFromTransfer = useCallback(
    async (transfer: DataTransfer | null | undefined): Promise<{ file: File | null; hasMediaPayload: boolean }> => {
      if (!transfer) return { file: null, hasMediaPayload: false };
      const directFiles = Array.from(transfer.files ?? []);
      const fileFromFiles = pickPreferredAttachmentFile(directFiles);
      if (fileFromFiles) return { file: fileFromFiles, hasMediaPayload: true };

      const itemFiles = Array.from(transfer.items ?? [])
        .filter((item) => item.kind === "file")
        .map((item) => item.getAsFile())
        .filter((candidate): candidate is File => Boolean(candidate));
      const fileFromItems = pickPreferredAttachmentFile(itemFiles);
      if (fileFromItems) return { file: fileFromItems, hasMediaPayload: true };

      const mediaSources = collectMediaSourcesFromTransfer(transfer);
      if (!mediaSources.length) return { file: null, hasMediaPayload: false };
      for (const source of mediaSources) {
        const file = await buildFileFromMediaSource(source);
        if (file) return { file, hasMediaPayload: true };
      }
      return { file: null, hasMediaPayload: true };
    },
    [buildFileFromMediaSource, collectMediaSourcesFromTransfer, pickPreferredAttachmentFile],
  );
  const hasDragFiles = useCallback((dataTransfer: DataTransfer | null | undefined) => {
    if (!dataTransfer) return false;
    if ((dataTransfer.files?.length ?? 0) > 0) return true;
    if (Array.from(dataTransfer.items ?? []).some((item) => item.kind === "file")) return true;
    const types = Array.from(dataTransfer.types ?? []);
    return types.includes("Files") || types.includes("text/uri-list") || types.includes("text/html");
  }, []);
  const hasClipboardMediaPayload = useCallback(
    (dataTransfer: DataTransfer | null | undefined) => {
      if (!dataTransfer) return false;
      if (hasDragFiles(dataTransfer)) return true;
      const plainText = dataTransfer.getData("text/plain")?.trim();
      if (!plainText) return false;
      if (/^data:(image|video|application)\//i.test(plainText)) return true;
      if (/^blob:/i.test(plainText)) return true;
      if (/^https?:\/\/[^\s]+\.(png|jpe?g|gif|webp|bmp|svg|mp4|webm|mov|m4v|mkv)(?:[?#].*)?$/i.test(plainText)) {
        return true;
      }
      if ((plainText.startsWith("{") || plainText.startsWith("[")) && /"(src|url|image|media|file|video)"/i.test(plainText)) {
        return extractMediaSourcesFromText(plainText).length > 0;
      }
      if (/<(?:img|video|source)\b/i.test(plainText)) return extractMediaSourcesFromText(plainText).length > 0;
      return false;
    },
    [extractMediaSourcesFromText, hasDragFiles],
  );
  const resetComposerDragState = useCallback(() => {
    composerDragDepthRef.current = 0;
    setIsComposerDragActive(false);
  }, []);
  const handleComposerDragEnter = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      if (!hasDragFiles(event.dataTransfer)) return;
      event.preventDefault();
      event.stopPropagation();
      composerDragDepthRef.current += 1;
      setIsComposerDragActive(true);
    },
    [hasDragFiles],
  );
  const handleComposerDragOver = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      if (!hasDragFiles(event.dataTransfer)) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "copy";
      if (!isComposerDragActive) setIsComposerDragActive(true);
    },
    [hasDragFiles, isComposerDragActive],
  );
  const handleComposerDragLeave = useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (composerDragDepthRef.current > 0) {
      composerDragDepthRef.current -= 1;
    }
    if (composerDragDepthRef.current === 0) {
      setIsComposerDragActive(false);
    }
  }, []);
  const handleComposerDrop = useCallback(
    async (event: React.DragEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const transfer = event.dataTransfer;
      resetComposerDragState();
      const { file, hasMediaPayload } = await extractAttachmentFromTransfer(transfer);
      if (!file) {
        if (hasMediaPayload) {
          setMessageSendNotice("Não foi possível ler esse arquivo arrastado.");
        }
        return;
      }
      await handleSendAttachment(file);
    },
    [extractAttachmentFromTransfer, handleSendAttachment, resetComposerDragState],
  );
  const handleComposerPaste = useCallback(
    async (event: React.ClipboardEvent<HTMLElement>) => {
      const clipboardData = event.clipboardData;
      if (!hasClipboardMediaPayload(clipboardData)) return;
      event.preventDefault();
      const { file } = await extractAttachmentFromTransfer(clipboardData);
      if (!file) {
        setMessageSendNotice("Não foi possível colar essa mídia.");
        return;
      }
      await handleSendAttachment(file);
    },
    [extractAttachmentFromTransfer, handleSendAttachment, hasClipboardMediaPayload],
  );
  const handleCaptureComposerCamera = useCallback(async () => {
    const video = composerCameraVideoRef.current;
    if (!video || video.readyState < 2) {
      setComposerCameraError("A câmera ainda não está pronta.");
      return;
    }
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      setComposerCameraError("Não foi possível capturar a foto.");
      return;
    }
    context.drawImage(video, 0, 0, width, height);
    setIsComposerCameraBusy(true);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.92);
    });
    if (!blob) {
      setIsComposerCameraBusy(false);
      setComposerCameraError("Não foi possível capturar a foto.");
      return;
    }
    const file = new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" });
    const previewData = canvas.toDataURL("image/jpeg", 0.92);
    setComposerCameraCapturedFile(file);
    setComposerCameraCapturedPreview(previewData);
    setIsComposerCameraBusy(false);
    stopComposerCameraStream();
  }, [stopComposerCameraStream]);
  const handleRetakeComposerCameraCapture = useCallback(() => {
    if (isComposerCameraBusy) return;
    setComposerCameraError(null);
    setComposerCameraCapturedFile(null);
    setComposerCameraCapturedPreview(null);
  }, [isComposerCameraBusy]);
  const handleApplyComposerCameraCapture = useCallback(async () => {
    if (!composerCameraCapturedFile || isComposerCameraBusy) return;
    setIsComposerCameraBusy(true);
    try {
      await handleSendAttachment(composerCameraCapturedFile);
      closeComposerCamera();
    } finally {
      setIsComposerCameraBusy(false);
    }
  }, [closeComposerCamera, composerCameraCapturedFile, handleSendAttachment, isComposerCameraBusy]);

  const toggleMediaSelectMode = useCallback(() => {
    setIsMediaSelectMode((prev) => {
      if (prev) {
        setSelectedMediaIds([]);
      }
      return !prev;
    });
  }, []);

  const toggleMediaSelection = useCallback((id: string) => {
    setSelectedMediaIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }, []);
  const toggleShareContact = useCallback((id: string) => {
    setSelectedShareContactIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }, []);
  const scrollShareThumbs = useCallback((direction: "left" | "right") => {
    if (!shareThumbsRef.current) return;
    const delta = direction === "left" ? -80 : 80;
    shareThumbsRef.current.scrollBy({ left: delta, behavior: "smooth" });
  }, []);
  const scrollTopMenuCarousel = useCallback((direction: "left" | "right") => {
    if (!topMenuCarouselRef.current) return;
    const viewportWidth = topMenuCarouselRef.current.clientWidth;
    const delta = Math.max(180, Math.floor(viewportWidth * 0.72));
    topMenuCarouselRef.current.scrollBy({
      left: direction === "left" ? -delta : delta,
      behavior: "smooth",
    });
    window.requestAnimationFrame(() => updateTopMenuCarouselEdges());
  }, [updateTopMenuCarouselEdges]);
  const updateShareAudioDuration = useCallback((id: string, duration: string, durationSeconds?: number) => {
    setShareAudioFiles((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, duration, durationSeconds: durationSeconds ?? item.durationSeconds } : item,
      ),
    );
  }, []);
  const loadShareAudioWaveform = useCallback(
    async (file: File, id: string) => {
      if (typeof window === "undefined") return;
      const AudioContextClass =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      try {
        const arrayBuffer = await file.arrayBuffer();
        const context = new AudioContextClass();
        const audioBuffer = await context.decodeAudioData(arrayBuffer.slice(0));
        const channelData = audioBuffer.getChannelData(0);
        const samplesPerBar = Math.max(1, Math.floor(channelData.length / shareWaveBarCount));
        const waveform: number[] = [];
        let peakMax = 0;
        for (let i = 0; i < shareWaveBarCount; i += 1) {
          const start = i * samplesPerBar;
          const end = i === shareWaveBarCount - 1 ? channelData.length : start + samplesPerBar;
          let peak = 0;
          for (let j = start; j < end; j += 1) {
            const value = Math.abs(channelData[j]);
            if (value > peak) peak = value;
          }
          waveform.push(peak);
          if (peak > peakMax) peakMax = peak;
        }
        const normalized =
          peakMax > 0 ? waveform.map((value) => value / peakMax) : waveform.map(() => 0.15);
        const durationSeconds = Math.round(audioBuffer.duration);
        context.close().catch(() => null);
        setShareAudioFiles((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  waveform: normalized,
                  durationSeconds,
                  duration: item.duration ?? formatDuration(durationSeconds),
                }
              : item,
          ),
        );
      } catch {
        // ignore waveform errors
      }
    },
    [shareWaveBarCount],
  );
  const stopShareWaveMeter = useCallback(() => {
    if (shareWaveRafRef.current) {
      cancelAnimationFrame(shareWaveRafRef.current);
      shareWaveRafRef.current = null;
    }
    shareWaveLastUpdateRef.current = 0;
    shareWaveDataRef.current = null;
    shareAnalyserRef.current = null;
    if (shareAudioContextRef.current) {
      shareAudioContextRef.current.close().catch(() => null);
      shareAudioContextRef.current = null;
    }
    setShareRecordingWave(Array.from({ length: shareWaveBarCount }, () => 0.15));
  }, [shareWaveBarCount]);
  const startShareWaveMeter = useCallback(
    (stream: MediaStream) => {
      if (typeof window === "undefined") return;
      const AudioContextClass =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      stopShareWaveMeter();
      const context = new AudioContextClass();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;
      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);
      shareAudioContextRef.current = context;
      shareAnalyserRef.current = analyser;
      const dataArray = new Uint8Array(analyser.fftSize);
      shareWaveDataRef.current = dataArray;
      setShareRecordingWave(Array.from({ length: shareWaveBarCount }, () => 0.15));

      const updateWave = (timestamp: number) => {
        if (!shareAnalyserRef.current || !shareWaveDataRef.current) return;
        if (timestamp - shareWaveLastUpdateRef.current >= 80) {
          shareWaveLastUpdateRef.current = timestamp;
          const analyser = shareAnalyserRef.current;
          const waveData = shareWaveDataRef.current;
          (analyser as unknown as { getByteTimeDomainData: (data: Uint8Array) => void }).getByteTimeDomainData(
            waveData,
          );
          let sum = 0;
          for (let i = 0; i < shareWaveDataRef.current.length; i += 1) {
            const value = (shareWaveDataRef.current[i] - 128) / 128;
            sum += value * value;
          }
          const rms = Math.sqrt(sum / shareWaveDataRef.current.length);
          const intensity = Math.min(1, rms * 2.6);
          const nextValue = Math.max(0.12, intensity);
          setShareRecordingWave((prev) => {
            const base =
              prev.length === shareWaveBarCount
                ? [...prev]
                : Array.from({ length: shareWaveBarCount }, () => 0.15);
            base.shift();
            base.push(nextValue);
            return base;
          });
        }
        shareWaveRafRef.current = requestAnimationFrame(updateWave);
      };
      shareWaveRafRef.current = requestAnimationFrame(updateWave);
      context.resume().catch(() => null);
    },
    [shareWaveBarCount, stopShareWaveMeter],
  );
  const addShareAudioFile = useCallback(
    (file: File, duration?: string) => {
      if (shareAudioFiles.length >= shareAudioLimit) return;
      const id = `audio_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const url = URL.createObjectURL(file);
      setShareAudioFiles((prev) => {
        if (prev.length >= shareAudioLimit) {
          URL.revokeObjectURL(url);
          return prev;
        }
        return [...prev, { id, file, url, duration }];
      });
      void loadShareAudioWaveform(file, id);
    },
    [shareAudioFiles.length, shareAudioLimit, loadShareAudioWaveform],
  );
  const removeShareAudioById = useCallback(
    (id: string) => {
      setShareAudioFiles((prev) => {
        const target = prev.find((item) => item.id === id);
        if (target) {
          URL.revokeObjectURL(target.url);
        }
        return prev.filter((item) => item.id !== id);
      });
      if (shareAudioPlayingId === id) {
        if (shareAudioPlayerRef.current) {
          shareAudioPlayerRef.current.pause();
          shareAudioPlayerRef.current = null;
        }
        setShareAudioPlayingId(null);
        setShareAudioPlaybackSeconds(0);
      }
    },
    [shareAudioPlayingId],
  );
  const handleShareAudioChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (shareAudioFiles.length >= shareAudioLimit) {
        event.target.value = "";
        return;
      }
      addShareAudioFile(file);
      event.target.value = "";
    },
    [addShareAudioFile, shareAudioFiles.length, shareAudioLimit],
  );
  const stopShareRecordingTimer = useCallback(() => {
    if (shareRecordingIntervalRef.current) {
      window.clearInterval(shareRecordingIntervalRef.current);
      shareRecordingIntervalRef.current = null;
    }
  }, []);
  const startShareRecordingTimer = useCallback(() => {
    shareRecordingSecondsRef.current = 0;
    setShareRecordingSeconds(0);
    stopShareRecordingTimer();
    shareRecordingIntervalRef.current = window.setInterval(() => {
      shareRecordingSecondsRef.current += 1;
      setShareRecordingSeconds(shareRecordingSecondsRef.current);
    }, 1000);
  }, [stopShareRecordingTimer]);
  const stopShareRecording = useCallback(
    (action: "keep" | "discard" = "keep") => {
      const recorder = shareRecorderRef.current;
      shareRecordingActionRef.current = action;
      shareRecordingDurationRef.current = shareRecordingSecondsRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
      if (shareStreamRef.current) {
        shareStreamRef.current.getTracks().forEach((track) => track.stop());
        shareStreamRef.current = null;
      }
      stopShareRecordingTimer();
      stopShareWaveMeter();
      setShareRecordingState("idle");
      setShareRecordingSeconds(0);
      shareRecordingSecondsRef.current = 0;
    },
    [stopShareRecordingTimer, stopShareWaveMeter],
  );
  const startShareRecording = useCallback(async () => {
    if (shareRecordingState !== "idle") return;
    if (shareAudioFiles.length >= shareAudioLimit) return;
    if (typeof window === "undefined") return;
    if (!navigator.mediaDevices?.getUserMedia) {
      shareAudioInputRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      shareStreamRef.current = stream;
      startShareWaveMeter(stream);
      const recorder = new MediaRecorder(stream);
      shareRecorderRef.current = recorder;
      shareAudioChunksRef.current = [];
      shareRecordingActionRef.current = "keep";
      recorder.ondataavailable = (event) => {
        if (event.data.size) {
          shareAudioChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const action = shareRecordingActionRef.current;
        const durationLabel = formatDuration(shareRecordingDurationRef.current);
        if (action === "keep" && shareAudioChunksRef.current.length) {
          const blob = new Blob(shareAudioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
          const file = new File([blob], `audio-${Date.now()}.webm`, { type: blob.type });
          addShareAudioFile(file, durationLabel);
        }
        shareAudioChunksRef.current = [];
      };
      recorder.start();
      setShareRecordingState("recording");
      startShareRecordingTimer();
    } catch {
      shareAudioInputRef.current?.click();
    }
  }, [addShareAudioFile, shareRecordingState, shareAudioFiles.length, shareAudioLimit, startShareRecordingTimer, startShareWaveMeter]);
  const stopShareAudioProgress = useCallback((reset = true) => {
    if (shareAudioPlaybackRafRef.current) {
      cancelAnimationFrame(shareAudioPlaybackRafRef.current);
      shareAudioPlaybackRafRef.current = null;
    }
    if (reset) {
      setShareAudioPlaybackSeconds(0);
    }
  }, []);
  const stopShareAudioPlayback = useCallback(() => {
    if (shareAudioPlayerRef.current) {
      shareAudioPlayerRef.current.pause();
      shareAudioPlayerRef.current.currentTime = 0;
    }
    shareAudioPlayerRef.current = null;
    setShareAudioPlayingId(null);
    setShareAudioIsPaused(false);
    stopShareAudioProgress(true);
  }, [stopShareAudioProgress]);
  const startShareAudioProgress = useCallback(() => {
    if (shareAudioPlaybackRafRef.current) {
      cancelAnimationFrame(shareAudioPlaybackRafRef.current);
    }
    const tick = () => {
      const player = shareAudioPlayerRef.current;
      if (!player) {
        shareAudioPlaybackRafRef.current = null;
        return;
      }
      setShareAudioPlaybackSeconds(player.currentTime);
      if (!player.paused && !player.ended) {
        shareAudioPlaybackRafRef.current = requestAnimationFrame(tick);
      } else {
        shareAudioPlaybackRafRef.current = null;
      }
    };
    shareAudioPlaybackRafRef.current = requestAnimationFrame(tick);
  }, []);
  const toggleShareAudioPlayback = useCallback(
    (entry: { id: string; url: string }) => {
      if (shareAudioPlayingId === entry.id && shareAudioPlayerRef.current) {
        const player = shareAudioPlayerRef.current;
        if (player.paused) {
          player.play().catch(() => null);
        } else {
          player.pause();
        }
        return;
      }
      stopShareAudioPlayback();
      stopShareAudioProgress(true);
      const audio = new Audio(entry.url);
      audio.playbackRate = shareAudioPlaybackSpeed;
      shareAudioPlayerRef.current = audio;
      setShareAudioPlayingId(entry.id);
      setShareAudioPlaybackSeconds(0);
      setShareAudioIsPaused(false);
      audio.onloadedmetadata = () => {
        if (!Number.isNaN(audio.duration)) {
          updateShareAudioDuration(entry.id, formatDuration(Math.round(audio.duration)), Math.round(audio.duration));
        }
      };
      audio.onplay = () => {
        setShareAudioIsPaused(false);
        startShareAudioProgress();
      };
      audio.onpause = () => {
        setShareAudioIsPaused(true);
        stopShareAudioProgress(false);
      };
      audio.onended = () => {
        setShareAudioPlayingId((prev) => (prev === entry.id ? null : prev));
        shareAudioPlayerRef.current = null;
        setShareAudioIsPaused(false);
        stopShareAudioProgress(true);
      };
      audio.play().catch(() => {
        setShareAudioPlayingId(null);
        shareAudioPlayerRef.current = null;
        setShareAudioIsPaused(false);
        stopShareAudioProgress(true);
      });
    },
    [
      shareAudioPlayingId,
      startShareAudioProgress,
      stopShareAudioPlayback,
      stopShareAudioProgress,
      shareAudioPlaybackSpeed,
      updateShareAudioDuration,
    ],
  );
  const cycleShareAudioPlaybackSpeed = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      setShareAudioPlaybackSpeed((previous) => getNextPlaybackSpeed(previous));
    },
    [],
  );
  useEffect(() => {
    if (!shareAudioPlayerRef.current) return;
    shareAudioPlayerRef.current.playbackRate = shareAudioPlaybackSpeed;
  }, [shareAudioPlaybackSpeed, shareAudioPlayingId]);

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

  const finalizeRecording = async (action: "send" | "discard", blob: Blob | null) => {
    const durationLabel = formatDuration(recordingDurationRef.current);
    let thread = activeThread;
    if (action === "send" && blob && !thread) {
      const selfThread = ensureSelfConversationThread();
      if (selfThread) {
        setActiveFilter("all");
        openThreadById(selfThread.id);
        thread = selfThread;
      }
    }
    if (
      action === "send" &&
      blob &&
      thread &&
      currentUser &&
      (await ensureRecipientRegistered(thread))
    ) {
      if (messageSendNotice) setMessageSendNotice(null);
      const threadId = await ensureServerThreadForSend(thread);
      if (threadId) {
        if (serverMessagingEnabled && identity?.email && !isSelfConversationThread(thread)) {
          try {
            const audioDataUrl = await readFileAsDataUrl(blob);
            const res = await authFetch("/api/knexchat/messages", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                threadId,
                senderEmail: identity.email,
                kind: "audio",
                body: "Mensagem de áudio",
                mediaUrl: audioDataUrl,
                mediaName: durationLabel,
              }),
            });
            if (!res.ok) throw new Error("send_failed");
            const payload = (await res.json().catch(() => ({}))) as { message?: ApiMessage };
            if (!payload.message) throw new Error("missing_message");
            const mapped = mapApiMessageToMessage(payload.message);
            setMessagesByThread((prev) => ({
              ...prev,
              [threadId]: [...(prev[threadId] ?? []), mapped],
            }));
            const activityAt = toTimestampMs(payload.message.created_at) ?? Date.now();
            updateThreadActivity(threadId, previewFromApiMessage(payload.message), activityAt);
          } catch {
            setMessageSendNotice("Não foi possível enviar o áudio agora.");
          }
        } else {
          const activityAt = Date.now();
          const timeLabel = formatClockLabel(activityAt) || "Agora";
          const audioUrl = URL.createObjectURL(blob);
          const newMessage: Message = {
            id: `m_${Date.now()}`,
            author: "me",
            body: "Mensagem de áudio",
            time: timeLabel,
            sentAt: activityAt,
            audioUrl,
            audioDuration: durationLabel,
            deliveryStatus: "sent",
          };
          setMessagesByThread((prev) => ({
            ...prev,
            [threadId]: [...(prev[threadId] ?? []), newMessage],
          }));
          updateThreadActivity(threadId, "Mensagem de áudio", activityAt);
        }
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
        void finalizeRecording(recordingActionRef.current, blob);
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
      void finalizeRecording(action, null);
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

  const navButtonClass = (active: boolean) =>
    `grid h-11 w-11 place-items-center rounded-2xl transition ${
      active
        ? isDarkTheme
          ? "border border-white/25 bg-slate-300/35 text-white shadow-[0_12px_24px_rgba(0,0,0,0.38)]"
          : "bg-white text-black shadow-[0_12px_24px_rgba(15,23,42,0.18)]"
        : isDarkTheme
          ? "text-slate-300 hover:bg-slate-300/25 hover:text-white"
          : "text-slate-700 hover:bg-slate-200/80 hover:text-slate-900"
    }`;
  const mobileDockButtonClass = (active: boolean) =>
    `flex h-11 w-full items-center justify-center rounded-xl transition max-[420px]:h-10 max-[360px]:h-9 ${
      active
        ? isDarkTheme
          ? "bg-white/24 text-white shadow-[0_8px_18px_rgba(15,23,42,0.35)] [filter:drop-shadow(0_0_0.6px_rgba(8,33,78,0.92))]"
          : "bg-white text-slate-900 shadow-[0_8px_18px_rgba(15,23,42,0.15)]"
        : "text-white hover:bg-white/18 hover:text-white [filter:drop-shadow(0_0_0.6px_rgba(8,33,78,0.92))]"
    }`;
  const mobileDockIconClass = "h-[1.5rem] w-[1.5rem]";
  const mobileDockAvatarButtonClass = (active: boolean) =>
    `relative flex h-11 w-full items-center justify-center overflow-hidden rounded-xl border-[1.25px] transition max-[420px]:h-10 max-[360px]:h-9 ${
      active
        ? "border-white bg-white shadow-[0_8px_18px_rgba(15,23,42,0.15)]"
        : "border-white/70 bg-transparent hover:border-white hover:bg-white/14"
    }`;
  const avatarFrameLg = "rounded-[26px]";
  const avatarFrameMd = "rounded-[8.5px]";
  const avatarFrameSm = "rounded-[7.5px]";
  const avatarFrameXs = "rounded-[7px]";
  const renderShareContact = (contact: { id: string; title: string; preview?: string; avatarUrl?: string | null }) => {
    const isSelected = selectedShareContactIds.includes(contact.id);
    return (
      <button
        key={contact.id}
        type="button"
        onClick={() => toggleShareContact(contact.id)}
        className="flex w-full items-center gap-3 text-left"
      >
        <span
          className={`flex h-5 w-5 items-center justify-center rounded border ${
            isSelected
              ? "border-blue-500 bg-blue-500 text-white"
              : isDarkTheme
                ? "border-[#3a3a3a] text-slate-200"
                : "border-slate-300 text-slate-600"
          }`}
        >
          {isSelected ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
        </span>
        {contact.avatarUrl ? (
          <img src={contact.avatarUrl} alt={contact.title} className={`h-10 w-10 ${avatarFrameSm} object-cover`} />
        ) : (
          <div
            className={`grid h-10 w-10 place-items-center ${avatarFrameSm} text-xs font-semibold ${
              isDarkTheme ? "bg-slate-800 text-slate-100" : "bg-slate-200 text-slate-600"
            }`}
          >
            {getAvatarText(contact.title)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{contact.title}</p>
          {contact.preview ? <p className={`truncate text-xs ${settingsMuted}`}>{contact.preview}</p> : null}
        </div>
      </button>
    );
  };

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
  const chatListWidthStyle = useMemo(
    () => ({ "--chat-list-width": `${chatListWidth}px` } as CSSProperties),
    [chatListWidth],
  );
  const handleStartChatListResize = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    chatListResizeRef.current = { startX: event.clientX, startWidth: chatListWidth };
    setIsChatListResizing(true);
  }, [chatListWidth]);
  const threadMenuSections = useMemo<ThreadMenuItem[][]>(() => {
    if (!activeThread) return [];
    if (activeThread.tab === "groups") {
      return [
        [
          { label: "Dados do grupo", icon: Users, action: "group-info" },
          { label: "Selecionar mensagens", icon: CheckSquare },
          { label: "Reativar notificações", icon: Bell },
          { label: "Trancar conversa", icon: Lock },
          { label: "Fechar conversa", icon: XCircle },
        ],
        [
          { label: "Limpar conversa", icon: Trash, tone: "danger" },
          { label: "Sair do grupo", icon: LogOut, tone: "danger" },
        ],
      ];
    }
    return [
      [
        { label: "Dados do contato", icon: User, action: "contact-info" },
        { label: "Selecionar mensagens", icon: CheckSquare },
        { label: "Silenciar notificações", icon: BellOff },
        { label: "Mensagens temporárias", icon: Timer },
        { label: "Trancar conversa", icon: Lock },
        { label: "Fechar conversa", icon: XCircle },
      ],
      [
        { label: "Denunciar", icon: Flag },
        { label: "Bloquear", icon: Shield },
        { label: "Limpar conversa", icon: Trash, tone: "danger" },
        { label: "Apagar conversa", icon: Trash2, tone: "danger" },
      ],
    ];
  }, [activeThread]);
  const desktopConversationContextMenuSections = useMemo<DesktopConversationContextMenuItem[][]>(() => {
    const isGroupConversation = desktopConversationContextMenu?.threadTab === "groups";
    return [
      [
        { label: "Arquivar conversa", icon: Archive, action: "archive" },
        { label: "Trancar conversa", icon: Lock, action: "lock" },
        { label: "Silenciar notificações", icon: BellOff, action: "mute" },
        { label: "Fixar conversa", icon: Pin, action: "pin" },
        { label: "Marcar como não lida", icon: Mail, action: "mark-unread" },
      ],
      [{ label: "Fechar conversa", icon: XCircle, action: "close" }],
      isGroupConversation
        ? [{ label: "Sair do grupo", icon: LogOut, action: "leave-group", tone: "danger" }]
        : [
            { label: "Bloquear", icon: Shield, action: "block" },
            { label: "Apagar conversa", icon: Trash2, action: "delete", tone: "danger" },
          ],
    ];
  }, [desktopConversationContextMenu?.threadTab]);
  const commonGroups = useMemo(
    () =>
      groups.slice(0, 3).map((group) => ({
        id: group.id,
        title: group.title,
        subtitle: group.preview ?? "Grupo no KnexChat",
        avatarUrl: group.avatarUrl ?? null,
      })),
    [groups],
  );
  const mediaCount = useMemo(() => {
    if (!activeThread) return 0;
    return mediaLibrary.filter((item) => item.threadId === activeThread.id).length;
  }, [activeThread, mediaLibrary]);
  const groupMediaItems = useMemo(() => {
    if (!activeThread) return [];
    return mediaLibrary.filter((item) => item.threadId === activeThread.id).slice(0, 4);
  }, [activeThread, mediaLibrary]);
  const groupMembers = useMemo(() => {
    const members: { id: string; title: string; subtitle?: string; avatarUrl?: string | null; isAdmin?: boolean }[] = [];
    if (activeThread && activeThread.tab === "groups" && activeThread.participantRoles?.length) {
      const selfEmail = identity?.email ? normalizeEmail(identity.email) : "";
      const participants = activeThread.participantRoles;
      const selfParticipant = selfEmail
        ? participants.find((participant) => normalizeEmail(participant.email) === selfEmail)
        : undefined;
      const others = participants.filter(
        (participant) => normalizeEmail(participant.email) !== selfEmail,
      );
      const ordered = selfParticipant ? [selfParticipant, ...others] : others;
      const sliceCount = isGroupMembersExpanded ? ordered.length : Math.min(8, ordered.length);
      ordered.slice(0, sliceCount).forEach((participant) => {
        const normalized = normalizeEmail(participant.email);
        const isSelf = selfEmail && normalized === selfEmail;
        const contactInfo = contactNameByEmail.get(normalized);
        members.push({
          id: isSelf ? "self" : participant.email,
          title: isSelf
            ? "Você"
            : contactInfo?.name ?? participant.name ?? formatNameFromEmail(participant.email),
          subtitle: isSelf
            ? settingsState.profileRecado ?? DEFAULT_SETTINGS_STATE.profileRecado
            : participant.email,
          avatarUrl: isSelf ? currentUser?.avatarUrl ?? null : contactInfo?.avatarUrl ?? participant.avatarUrl ?? null,
          isAdmin: participant.role === "admin",
        });
      });
      return members;
    }
    const adminIds =
      activeThread && activeThread.tab === "groups"
        ? new Set(groupAdminIdsByGroup[activeThread.id] ?? [])
        : null;
    const hasCustomAdmins = Boolean(adminIds && adminIds.size > 0);
    if (currentUser) {
      const isAdmin = hasCustomAdmins ? adminIds?.has("self") : true;
      members.push({
        id: "self",
        title: "Você",
        subtitle: settingsState.profileRecado ?? DEFAULT_SETTINGS_STATE.profileRecado,
        avatarUrl: currentUser.avatarUrl ?? null,
        isAdmin,
      });
    }
    const sliceCount = isGroupMembersExpanded ? contacts.length : Math.min(8, contacts.length);
    contacts.slice(0, sliceCount).forEach((contact, index) => {
      const isAdmin = hasCustomAdmins ? adminIds?.has(contact.id) : index < 2;
      members.push({
        id: contact.id,
        title: contact.title,
        subtitle: contact.preview,
        avatarUrl: contact.avatarUrl ?? null,
        isAdmin,
      });
    });
    return members;
  }, [
    activeThread,
    contacts,
    contactNameByEmail,
    currentUser,
    groupAdminIdsByGroup,
    identity?.email,
    isGroupMembersExpanded,
    settingsState.profileRecado,
  ]);
  const groupAdminNames = useMemo(() => {
    const admins = groupMembers.filter((member) => member.isAdmin).map((member) => member.title);
    return admins.length ? admins.join(", ") : "Nenhum admin";
  }, [groupMembers]);
  useEffect(() => {
    if (!isGroupAdminsModalOpen) return;
    if (!activeThread || activeThread.tab !== "groups") return;
    setGroupAdminSearch("");
    const existing = groupAdminIdsByGroup[activeThread.id];
    if (existing && existing.length) {
      setSelectedGroupAdminIds(existing);
      return;
    }
    const seed = groupMembers.filter((member) => member.isAdmin).map((member) => member.id);
    setSelectedGroupAdminIds(seed);
  }, [activeThread, groupAdminIdsByGroup, groupMembers, isGroupAdminsModalOpen]);
  const groupAdminCandidates = useMemo(() => {
    const candidates: { id: string; title: string; subtitle?: string; avatarUrl?: string | null }[] = [];
    if (activeThread && activeThread.tab === "groups" && activeThread.participantRoles?.length) {
      const selfEmail = identity?.email ? normalizeEmail(identity.email) : "";
      activeThread.participantRoles.forEach((participant) => {
        const normalized = normalizeEmail(participant.email);
        const isSelf = selfEmail && normalized === selfEmail;
        const contactInfo = contactNameByEmail.get(normalized);
        candidates.push({
          id: isSelf ? "self" : participant.email,
          title: isSelf
            ? `${currentUser?.name ?? "Você"} (você)`
            : contactInfo?.name ?? participant.name ?? formatNameFromEmail(participant.email),
          subtitle: isSelf
            ? settingsState.profileRecado ?? DEFAULT_SETTINGS_STATE.profileRecado
            : participant.email,
          avatarUrl: isSelf ? currentUser?.avatarUrl ?? null : contactInfo?.avatarUrl ?? participant.avatarUrl ?? null,
        });
      });
      return candidates;
    }
    if (currentUser) {
      candidates.push({
        id: "self",
        title: `${currentUser.name ?? "Você"} (você)`,
        subtitle: settingsState.profileRecado ?? DEFAULT_SETTINGS_STATE.profileRecado,
        avatarUrl: currentUser.avatarUrl ?? null,
      });
    }
    contacts.forEach((contact) => {
      candidates.push({
        id: contact.id,
        title: contact.title,
        subtitle: contact.preview,
        avatarUrl: contact.avatarUrl ?? null,
      });
    });
    return candidates;
  }, [activeThread, contactNameByEmail, contacts, currentUser, identity?.email, settingsState.profileRecado]);
  const filteredGroupAdminCandidates = useMemo(() => {
    const term = groupAdminSearch.trim().toLowerCase();
    if (!term) return groupAdminCandidates;
    return groupAdminCandidates.filter((candidate) => {
      const haystack = `${candidate.title} ${candidate.subtitle ?? ""}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [groupAdminCandidates, groupAdminSearch]);
  const selectedGroupAdmins = useMemo(
    () =>
      selectedGroupAdminIds
        .map((id) => groupAdminCandidates.find((candidate) => candidate.id === id))
        .filter(Boolean) as { id: string; title: string; subtitle?: string; avatarUrl?: string | null }[],
    [groupAdminCandidates, selectedGroupAdminIds],
  );
  const toggleGroupAdminSelection = useCallback((id: string) => {
    setSelectedGroupAdminIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }, []);
  const groupMemberCount = useMemo(() => {
    if (activeThread && activeThread.tab === "groups" && activeThread.participantRoles?.length) {
      return activeThread.participantRoles.length;
    }
    return Math.max(1, contacts.length + (currentUser ? 1 : 0));
  }, [activeThread, contacts.length, currentUser]);
  const groupMembersHiddenCount = useMemo(
    () => Math.max(groupMemberCount - groupMembers.length, 0),
    [groupMemberCount, groupMembers.length],
  );
  const activeGroupPermissions = useMemo(() => {
    if (!activeThread || activeThread.tab !== "groups") return DEFAULT_GROUP_PERMISSIONS;
    return groupPermissionsById[activeThread.id] ?? DEFAULT_GROUP_PERMISSIONS;
  }, [activeThread, groupPermissionsById]);
  const canEditGroupSettings = useMemo(() => {
    if (!activeThread || activeThread.tab !== "groups") return false;
    const isAdmin = groupMembers.some((member) => member.id === "self" && member.isAdmin);
    return isAdmin || activeGroupPermissions.editGroupSettings;
  }, [activeGroupPermissions.editGroupSettings, activeThread, groupMembers]);
  const handleGroupAvatarChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const thread = activeThread;
      if (!thread || thread.tab !== "groups" || !canEditGroupSettings) {
        event.target.value = "";
        return;
      }
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      if (file.size > 6 * 1024 * 1024) {
        setMessageSendNotice("A foto do grupo deve ter até 6MB.");
        return;
      }

      const threadId = thread.id;
      const previousAvatar = thread.avatarUrl ?? null;
      let avatarDataUrl = "";
      try {
        avatarDataUrl = await optimizeGroupAvatarDataUrl(file);
      } catch (error) {
        if (error instanceof Error && error.message === "group_avatar_too_large_after_optimization") {
          setMessageSendNotice("A imagem ainda ficou muito pesada. Escolha uma foto menor.");
          return;
        }
        setMessageSendNotice("Não foi possível processar a imagem do grupo.");
        return;
      }
      if (!avatarDataUrl) {
        setMessageSendNotice("Não foi possível processar a imagem do grupo.");
        return;
      }

      setGroups((prev) =>
        prev.map((group) => (group.id === threadId ? { ...group, avatarUrl: avatarDataUrl } : group)),
      );
      setThreadAvatarOverrides((prev) => {
        if (!(threadId in prev)) return prev;
        const next = { ...prev };
        delete next[threadId];
        return next;
      });

      if (!serverMessagingEnabled || !isUuid(threadId)) return;

      try {
        const res = await authFetch("/api/knexchat/threads", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threadId, avatarUrl: avatarDataUrl }),
        });
        if (!res.ok) throw new Error("thread_avatar_update_failed");
        const payload = (await res.json().catch(() => ({}))) as { thread?: ApiThread };
        if (payload.thread) {
          const syncedAvatar = normalizeAvatarUrl(payload.thread.avatar_url ?? null) ?? avatarDataUrl;
          const syncedTitle = typeof payload.thread.title === "string" ? payload.thread.title.trim() : "";
          setGroups((prev) =>
            prev.map((group) =>
              group.id === threadId
                ? { ...group, ...(syncedTitle ? { title: syncedTitle } : {}), avatarUrl: syncedAvatar }
                : group,
            ),
          );
        }
        void fetchThreadsFromServer();
      } catch {
        setGroups((prev) =>
          prev.map((group) =>
            group.id === threadId ? { ...group, ...(previousAvatar ? { avatarUrl: previousAvatar } : { avatarUrl: undefined }) } : group,
          ),
        );
        setMessageSendNotice("Não foi possível atualizar a foto do grupo.");
      }
    },
    [
      activeThread,
      authFetch,
      canEditGroupSettings,
      fetchThreadsFromServer,
      optimizeGroupAvatarDataUrl,
      serverMessagingEnabled,
    ],
  );
  const openGroupNameEditor = useCallback(() => {
    if (!activeThread || activeThread.tab !== "groups" || !canEditGroupSettings) return;
    setGroupNameDraft(activeThread.title ?? "");
    setIsGroupNameEditing(true);
  }, [activeThread, canEditGroupSettings]);
  const cancelGroupNameEditor = useCallback(() => {
    if (!activeThread || activeThread.tab !== "groups") return;
    setGroupNameDraft(activeThread.title ?? "");
    setIsGroupNameEditing(false);
  }, [activeThread]);
  const saveGroupName = useCallback(() => {
    if (!activeThread || activeThread.tab !== "groups") return;
    const next = groupNameDraft.trim();
    if (!next) {
      setGroupNameDraft(activeThread.title ?? "");
      setIsGroupNameEditing(false);
      return;
    }
    setGroups((prev) =>
      prev.map((group) => (group.id === activeThread.id ? { ...group, title: next } : group)),
    );
    setIsGroupNameEditing(false);
  }, [activeThread, groupNameDraft, setGroups]);
  const toggleGroupPermission = useCallback(
    (key: keyof GroupPermissions) => {
      if (!activeThread || activeThread.tab !== "groups") return;
      setGroupPermissionsById((prev) => {
        const current = prev[activeThread.id] ?? DEFAULT_GROUP_PERMISSIONS;
        return { ...prev, [activeThread.id]: { ...current, [key]: !current[key] } };
      });
    },
    [activeThread],
  );
  const canEditGroupDescription = useMemo(() => {
    if (!activeThread || activeThread.tab !== "groups") return false;
    return groupMembers.some((member) => member.id === "self" && member.isAdmin);
  }, [activeThread, groupMembers]);
  const openGroupDescriptionEditor = useCallback(() => {
    if (!activeThread || activeThread.tab !== "groups" || !canEditGroupDescription) return;
    setGroupDescriptionDraft(groupDescriptions[activeThread.id] ?? "");
    setIsGroupDescriptionEditing(true);
  }, [activeThread, canEditGroupDescription, groupDescriptions]);
  const cancelGroupDescriptionEditor = useCallback(() => {
    if (!activeThread || activeThread.tab !== "groups") return;
    setGroupDescriptionDraft(groupDescriptions[activeThread.id] ?? "");
    setIsGroupDescriptionEditing(false);
  }, [activeThread, groupDescriptions]);
  const saveGroupDescription = useCallback(() => {
    if (!activeThread || activeThread.tab !== "groups" || !canEditGroupDescription) return;
    const next = groupDescriptionDraft.trim();
    setGroupDescriptions((prev) => ({ ...prev, [activeThread.id]: next }));
    setIsGroupDescriptionEditing(false);
  }, [activeThread, canEditGroupDescription, groupDescriptionDraft]);
  const handleOpenContactEdit = useCallback(() => {
    if (!activeThread || activeThread.tab === "groups") return;
    const normalizedTitle = normalizeName(activeThread.title ?? "");
    const [first, ...rest] = normalizedTitle.split(" ");
    const resolvedEmail = getThreadRecipientEmail(activeThread) ?? "";
    setEditContactFirstName(first ?? "");
    setEditContactLastName(rest.join(" "));
    setEditContactEmail(resolvedEmail);
    setEditContactPhone("");
    setEditContactSync(false);
    setIsContactEditOpen(true);
  }, [activeThread, getThreadRecipientEmail]);
  const handleSaveContactEdit = useCallback(() => {
    if (!activeThread || activeThread.tab === "groups") return;
    const firstName = normalizeName(editContactFirstName);
    const lastName = normalizeName(editContactLastName);
    const displayName =
      [firstName, lastName].filter(Boolean).join(" ") || activeThread.title || "Contato";
    const normalizedEmail =
      editContactEmail && isValidEmail(editContactEmail) ? normalizeEmail(editContactEmail) : "";
    const contactEmail = normalizedEmail || activeThread.contactEmail;
    const preview = contactEmail || editContactPhone.trim() || activeThread.preview || "Contato";
    const updateThread = (thread: Thread) => {
      if (thread.id !== activeThread.id) {
        const threadEmail = thread.contactEmail ? normalizeEmail(thread.contactEmail) : "";
        if (!contactEmail || threadEmail !== normalizeEmail(contactEmail)) {
          return thread;
        }
      }
      return {
        ...thread,
        title: displayName,
        preview,
        contactEmail,
      };
    };
    setContacts((prev) => prev.map(updateThread));
    setConversations((prev) => prev.map(updateThread));
    if (activeThread.tab === "contacts") {
      setActiveThreadId(activeThread.id);
    }
    setIsContactEditOpen(false);
  }, [
    activeThread,
    editContactEmail,
    editContactFirstName,
    editContactLastName,
    editContactPhone,
    setContacts,
    setConversations,
  ]);
  const performDeleteContact = useCallback(
    (contactId: string) => {
      setContacts((prev) => prev.filter((contact) => contact.id !== contactId));
      setUnreadByThread((prev) => {
        if (!prev[contactId]) return prev;
        const next = { ...prev };
        delete next[contactId];
        return next;
      });
      setIsContactEditOpen(false);
      setIsContactInfoOpen(false);
      if (activeThreadId === contactId) {
        setActiveThreadId("");
      }
    },
    [activeThreadId],
  );
  const requestDeleteContact = useCallback(() => {
    if (!activeThread || activeThread.tab === "groups") return;
    setDeleteContactTargetId(activeThread.id);
    setDeleteContactTargetName(activeThread.title ?? "este contato");
    setIsDeleteContactConfirmOpen(true);
  }, [activeThread]);
  const confirmDeleteContact = useCallback(() => {
    if (!deleteContactTargetId) {
      setIsDeleteContactConfirmOpen(false);
      return;
    }
    performDeleteContact(deleteContactTargetId);
    setIsDeleteContactConfirmOpen(false);
    setDeleteContactTargetId(null);
    setDeleteContactTargetName("");
  }, [deleteContactTargetId, performDeleteContact]);
  const cancelDeleteContact = useCallback(() => {
    setIsDeleteContactConfirmOpen(false);
    setDeleteContactTargetId(null);
    setDeleteContactTargetName("");
  }, []);
  const settingsPanelBase = isDarkTheme ? "bg-[#141414] text-slate-100" : "bg-white text-slate-900";
  const settingsBorder = isDarkTheme ? "border-[#2a2a2a]" : "border-slate-200";
  const settingsMuted = isDarkTheme ? "text-slate-400" : "text-slate-500";
  const settingsField =
    isDarkTheme ? "border-[#2a2a2a] bg-[#1b1b1b] text-slate-100" : "border-slate-200 bg-white text-slate-900";
  const settingsHover = isDarkTheme ? "hover:bg-white/5" : "hover:bg-slate-100";
  const settingsCrispClass = "subpixel-antialiased [text-rendering:geometricPrecision]";
  const settingsCrispContrastClass = isDarkTheme
    ? "[&_.text-slate-400]:text-slate-300 [&_.text-slate-500]:text-slate-300 [&_.text-slate-100]:text-white"
    : "";
  const settingsCrispTextStyle: CSSProperties | undefined = isDarkTheme
    ? { textShadow: "0 0 0.45px rgba(8,33,78,0.82)" }
    : undefined;
  const conversationPanelFontClass = KNEXCHAT_FONT_CLASS;
  const shellBrandSurface = isDarkTheme ? "bg-[var(--knex-850)]/85" : "bg-[var(--kx-header)]";
  const navRailBase = isDarkTheme ? shellBrandSurface : "bg-[#f5f6f7]";
  const navRailDivider = isDarkTheme ? "bg-[#2a2a2a]" : "bg-slate-300/90";
  const shellSurface = isDarkTheme ? "bg-[var(--knex-850)]/60" : "bg-[var(--kx-bg)] lg:bg-[#f5f6f7]";
  const mobileDockSurface = isDarkTheme ? "bg-[var(--knex-850)]" : "bg-[var(--kx-header)]";
  const whiteHeaderTextStyle: CSSProperties = { textShadow: "0 0 0.6px rgba(8,33,78,0.92)" };
  const headerBrandTextStyle: CSSProperties = {
    ...whiteHeaderTextStyle,
    fontFamily: KNEXCHAT_FONT_FAMILY,
    fontWeight: 700,
    letterSpacing: "-0.015em",
  };
  const shellHeaderSurface = isDarkTheme
    ? `border-b border-[#2a2a2a] md:border-b-0 ${shellBrandSurface} text-white`
    : "bg-[var(--kx-header)] text-white md:bg-[#f5f6f7] md:text-slate-900";
  const showMobileConversationFloatingActions =
    isMobileView &&
    showMobileFooterDock &&
    activeNavKey === "conversations" &&
    !isMobileProfileSheetOpen &&
    !isDirectoryOpen &&
    !isSettingsOpen &&
    !isProfileOpen &&
    !isGroupsPanelOpen &&
    !isCustomListOpen &&
    !isNewChatOpen;
  const headerAvatarHandle = useMemo(() => {
    const emailLocalPart = currentUser?.email?.split("@")[0] ?? "";
    const source = emailLocalPart || currentUser?.name || "usuario";
    const normalized = source
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9._-]/g, "");
    return `@${normalized || "usuario"}`;
  }, [currentUser?.email, currentUser?.name]);
  const headerLineLeft = isSettingsOpen ? "calc(3.5rem + 340px)" : "calc(3.5rem + 24rem)";
  const messagePanelBg = isDarkTheme ? "bg-[#141414]" : "bg-slate-50";
  const useDetachedMobileMic = isMobileView;
  const hasComposerText = messageDraft.trim().length > 0;
  const hasPreviousConversationMedia = conversationMediaViewerIndex > 0;
  const hasNextConversationMedia = conversationMediaViewerIndex < conversationMediaItems.length - 1;
  const isConversationMediaViewerChromeVisible = !isMobileView || isConversationMediaViewerUiVisible;
  const conversationMediaViewerVideoCurrentLabel = formatDuration(
    Math.max(0, Math.floor(conversationMediaViewerVideoCurrentTime)),
  );
  const conversationMediaViewerVideoDurationLabel = formatDuration(
    Math.max(0, Math.round(conversationMediaViewerVideoDuration)),
  );
  const conversationMediaViewerVideoPlaybackSpeedLabel = formatPlaybackSpeedLabel(
    conversationMediaViewerVideoPlaybackSpeed,
  );
  const conversationMediaViewerVideoProgressPercent =
    conversationMediaViewerVideoDuration > 0
      ? Math.min(
          100,
          Math.max(0, (conversationMediaViewerVideoCurrentTime / conversationMediaViewerVideoDuration) * 100),
        )
      : 0;
  const shareAudioPlaybackSpeedLabel = formatPlaybackSpeedLabel(shareAudioPlaybackSpeed);
  const mediaContextMenuSurface = isDarkTheme
    ? "border-[#2a2a2a] bg-[#1b1b1b] text-slate-100"
    : "border-slate-200 bg-[#f4f4f4] text-slate-700";
  const mediaContextMenuDivider = isDarkTheme ? "bg-white/10" : "bg-slate-300/80";
  const mediaContextMenuOption = isDarkTheme ? "hover:bg-white/5" : "hover:bg-black/5";
  const mediaContextMenuReaction = isDarkTheme ? "hover:bg-white/10" : "hover:bg-black/5";
  const profileFieldRowClass =
    "flex w-full items-center gap-2 px-0 py-0.5 max-[640px]:gap-1.5 max-[420px]:gap-1 [@media(max-height:820px)]:gap-1.5 [@media(max-height:820px)]:py-0.5 [@media(max-height:700px)]:gap-1 [@media(max-height:700px)]:py-0";
  const profileFieldLabelClass = `block text-[10px] uppercase tracking-[0.14em] ${settingsMuted} max-[640px]:text-[9px] [@media(max-height:760px)]:text-[9px] [@media(max-height:680px)]:text-[8px]`;
  const profileFieldValueClass =
    "block truncate text-[13px] leading-tight max-[640px]:text-[12px] max-[420px]:text-[11px] [@media(max-height:760px)]:text-[12px] [@media(max-height:680px)]:text-[11px]";
  const profileFieldIconClass = `h-3.5 w-3.5 shrink-0 ${settingsMuted} max-[420px]:h-3 max-[420px]:w-3 [@media(max-height:760px)]:h-3 [@media(max-height:760px)]:w-3`;
  const messagePanelBodyStyle = wallpaperColor ? { backgroundColor: wallpaperColor } : undefined;
  const mobileProfileSheetItems: {
    id: string;
    label: string;
    description: string;
    icon: LucideIcon;
    settingKey: (typeof SETTINGS_MENU)[number]["key"] | null;
    onSelect: () => void;
  }[] = [
    {
      id: "payments",
      label: "Pagamentos",
      description: "Gerenciar pagamentos e plano",
      icon: CreditCard,
      settingKey: "account",
      onSelect: () => openSettingsFromMobileSheet("account"),
    },
    {
      id: "account",
      label: "Conta",
      description: "Notificações de segurança, mudança de número",
      icon: User,
      settingKey: "account",
      onSelect: () => openSettingsFromMobileSheet("account"),
    },
    {
      id: "privacy",
      label: "Privacidade",
      description: "Bloqueio de contatos e mensagens temporárias",
      icon: Shield,
      settingKey: "privacy",
      onSelect: () => openSettingsFromMobileSheet("privacy"),
    },
    {
      id: "avatar",
      label: "Avatar",
      description: "Criar, editar e foto do perfil",
      icon: Camera,
      settingKey: null,
      onSelect: () => {
        setIsMobileProfileSheetOpen(false);
        resetPanelsForMobileNavigation();
        handleOpenProfile("self");
      },
    },
    {
      id: "lists",
      label: "Listas",
      description: "Gerenciar pessoas e grupos",
      icon: Users2,
      settingKey: null,
      onSelect: () => openMobileFooterEnvironment("contacts", { directoryTab: "contacts" }),
    },
    {
      id: "chats",
      label: "Conversas",
      description: "Tema, papel de parede e histórico",
      icon: MessageSquare,
      settingKey: "chats",
      onSelect: () => openSettingsFromMobileSheet("chats"),
    },
    {
      id: "broadcast",
      label: "Listas de transmissão",
      description: "Gerencie listas e envie transmissões",
      icon: SendHorizontal,
      settingKey: null,
      onSelect: () => openMobileFooterEnvironment("channels"),
    },
    {
      id: "notifications",
      label: "Notificações",
      description: "Mensagens, grupos e ligações",
      icon: Bell,
      settingKey: "notifications",
      onSelect: () => openSettingsFromMobileSheet("notifications"),
    },
    {
      id: "storage",
      label: "Armazenamento e dados",
      description: "Uso de rede e download automático",
      icon: Smartphone,
      settingKey: "media",
      onSelect: () => openSettingsFromMobileSheet("media"),
    },
    {
      id: "accessibility",
      label: "Acessibilidade",
      description: "Aumentar contraste e animação",
      icon: SlidersHorizontal,
      settingKey: "shortcuts",
      onSelect: () => openSettingsFromMobileSheet("shortcuts"),
    },
    {
      id: "language",
      label: "Idioma do app",
      description: "Português (Brasil)",
      icon: Globe,
      settingKey: "general",
      onSelect: () => openSettingsFromMobileSheet("general"),
    },
    {
      id: "help",
      label: "Ajuda",
      description: "Central de Ajuda e Política de Privacidade",
      icon: HelpCircle,
      settingKey: "help",
      onSelect: () => openSettingsFromMobileSheet("help"),
    },
    {
      id: "feedback",
      label: "Enviar feedback",
      description: "Relatar problemas técnicos",
      icon: Flag,
      settingKey: "help",
      onSelect: () => openSettingsFromMobileSheet("help"),
    },
    {
      id: "invite",
      label: "Convidar amigos",
      description: "Compartilhar acesso ao KnexChat",
      icon: UserPlus,
      settingKey: null,
      onSelect: () => openMobileFooterEnvironment("contacts", { directoryTab: "people" }),
    },
    {
      id: "beta",
      label: "Acesso antecipado a recursos",
      description: "Participar do programa beta",
      icon: Star,
      settingKey: "help",
      onSelect: () => openSettingsFromMobileSheet("help"),
    },
    {
      id: "updates",
      label: "Atualizações do app",
      description: "Ver novidades e versões",
      icon: Download,
      settingKey: "help",
      onSelect: () => openSettingsFromMobileSheet("help"),
    },
  ];
  const filteredMobileProfileSheetItems = mobileProfileSearchQuery.trim()
    ? mobileProfileSheetItems.filter((item) => {
        const query = mobileProfileSearchQuery.trim().toLowerCase();
        const haystack = `${item.label} ${item.description}`.toLowerCase();
        return haystack.includes(query);
      })
    : mobileProfileSheetItems;
  const desktopSidebarPrimaryItems: {
    key: "conversations" | "calls" | "status" | "channels" | "communities" | "contacts";
    label: string;
    icon: LucideIcon;
  }[] = [
    { key: "conversations", label: "Conversas", icon: MessageCircle },
    { key: "calls", label: "Ligacoes", icon: Phone },
    { key: "status", label: "Status", icon: CircleDot },
    { key: "channels", label: "Canais", icon: Radio },
    { key: "communities", label: "Comunidades", icon: Shapes },
    { key: "contacts", label: "Contatos", icon: UserPlus },
  ];
  const desktopSidebarExploreItems: {
    key: "images" | "settings";
    label: string;
    icon: LucideIcon;
  }[] = [
    { key: "images", label: "Midias", icon: ImageIcon },
    { key: "settings", label: "Configuracoes", icon: Settings },
  ];
  const globalSearchResults = useMemo<GlobalSearchResult[]>(() => {
    const query = globalSearchQuery.trim().toLowerCase();
    if (!query) return [];

    const scoreToken = (value: string) => {
      const candidate = value.trim().toLowerCase();
      if (!candidate) return -1;
      if (candidate === query) return 140;
      if (candidate.startsWith(query)) return 112;
      if (candidate.includes(` ${query}`)) return 94;
      return candidate.includes(query) ? 72 : -1;
    };
    const resolveScore = (...entries: { text: string; boost?: number }[]) => {
      let best = -1;
      entries.forEach((entry) => {
        const base = scoreToken(entry.text);
        if (base < 0) return;
        const boosted = base + (entry.boost ?? 0);
        if (boosted > best) best = boosted;
      });
      return best;
    };

    const threadById = new Map<string, Thread>();
    allThreads.forEach((thread) => {
      threadById.set(thread.id, thread);
    });

    const directThreadByEmail = new Map<string, { id: string; tab: TabKey }>();
    allThreads.forEach((thread) => {
      if (thread.tab !== "contacts" && thread.tab !== "conversations") return;
      const email = thread.contactEmail ? normalizeEmail(thread.contactEmail) : extractEmail(thread.preview) ?? "";
      if (!email || directThreadByEmail.has(email)) return;
      directThreadByEmail.set(email, { id: thread.id, tab: thread.tab });
    });

    const nextResults: GlobalSearchResult[] = [];

    allThreads.forEach((thread) => {
      const score = resolveScore(
        { text: thread.title, boost: 22 },
        { text: thread.preview, boost: 9 },
        { text: thread.contactEmail ?? "", boost: 7 },
      );
      if (score < 0) return;
      const icon: LucideIcon =
        thread.tab === "groups" ? Users2 : thread.tab === "contacts" ? UserPlus : MessageCircle;
      nextResults.push({
        id: `thread:${thread.id}`,
        kind: "thread",
        label: thread.title,
        subLabel: thread.preview || thread.lastActivity || "Conversa",
        icon,
        score,
        threadId: thread.id,
        threadTab: thread.tab,
      });
    });

    Object.entries(messagesByThread).forEach(([threadId, threadMessages]) => {
      const thread = threadById.get(threadId);
      if (!thread || !threadMessages.length) return;
      let threadHitCount = 0;
      for (let index = threadMessages.length - 1; index >= 0 && threadHitCount < 2; index -= 1) {
        const message = threadMessages[index];
        const messageLabel = [message.body, message.fileName, message.imageName]
          .map((value) => (typeof value === "string" ? value.trim() : ""))
          .find(Boolean) ?? "Mensagem";
        const score = resolveScore(
          { text: message.body ?? "", boost: 16 },
          { text: message.fileName ?? "", boost: 14 },
          { text: message.imageName ?? "", boost: 13 },
          { text: `${message.body ?? ""} ${message.fileName ?? ""} ${message.imageName ?? ""} ${message.senderName ?? ""}`, boost: 8 },
        );
        if (score < 0) continue;
        nextResults.push({
          id: `message:${threadId}:${message.id}`,
          kind: "message",
          label: messageLabel,
          subLabel: `${thread.title} · ${message.time}`,
          icon: MessageSquare,
          score,
          threadId,
          threadTab: thread.tab,
        });
        threadHitCount += 1;
      }
    });

    directoryPeople.forEach((person) => {
      const normalizedEmail = normalizeEmail(person.email);
      const linkedThread = normalizedEmail ? directThreadByEmail.get(normalizedEmail) : undefined;
      const score = resolveScore(
        { text: person.name, boost: 15 },
        { text: person.knexId, boost: 11 },
        { text: person.email, boost: 10 },
      );
      if (score < 0) return;
      nextResults.push({
        id: `person:${normalizedEmail || person.email}`,
        kind: "person",
        label: person.name,
        subLabel: `${person.knexId} · ${person.email}`,
        icon: User,
        score: score + (linkedThread ? 5 : 0),
        ...(linkedThread ? { threadId: linkedThread.id, threadTab: linkedThread.tab } : {}),
        directoryQuery: person.email,
      });
    });

    const areaTargets: { key: AppNavKey; label: string; hint: string; icon: LucideIcon }[] = [
      { key: "conversations", label: "Conversas", hint: "Abrir painel de conversas", icon: MessageCircle },
      { key: "calls", label: "Ligações", hint: "Abrir chamadas", icon: Phone },
      { key: "status", label: "Status", hint: "Abrir status", icon: CircleDot },
      { key: "channels", label: "Canais", hint: "Abrir canais", icon: Radio },
      { key: "communities", label: "Comunidades", hint: "Abrir comunidades", icon: Shapes },
      { key: "contacts", label: "Contatos", hint: "Abrir contatos", icon: UserPlus },
      { key: "images", label: "Mídias", hint: "Abrir biblioteca de mídias", icon: ImageIcon },
      { key: "settings", label: "Configurações", hint: "Abrir configurações", icon: Settings },
    ];
    areaTargets.forEach((target) => {
      const score = resolveScore(
        { text: target.label, boost: 14 },
        { text: target.hint, boost: 8 },
      );
      if (score < 0) return;
      nextResults.push({
        id: `area:${target.key}`,
        kind: "area",
        label: target.label,
        subLabel: target.hint,
        icon: target.icon,
        score,
        navKey: target.key,
      });
    });

    SETTINGS_MENU.forEach((setting) => {
      const score = resolveScore(
        { text: setting.label, boost: 16 },
        { text: setting.description, boost: 10 },
      );
      if (score < 0) return;
      nextResults.push({
        id: `setting:${setting.key}`,
        kind: "setting",
        label: setting.label,
        subLabel: setting.description,
        icon: setting.icon,
        score,
        settingKey: setting.key,
      });
    });

    const deduped = new Map<string, GlobalSearchResult>();
    nextResults.forEach((result) => {
      const existing = deduped.get(result.id);
      if (!existing || existing.score < result.score) {
        deduped.set(result.id, result);
      }
    });

    return Array.from(deduped.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 18);
  }, [allThreads, directoryPeople, globalSearchQuery, messagesByThread]);
  const globalSearchSections = useMemo(
    () => [
      { key: "thread", title: "Conversas", items: globalSearchResults.filter((item) => item.kind === "thread").slice(0, 5) },
      { key: "message", title: "Mensagens", items: globalSearchResults.filter((item) => item.kind === "message").slice(0, 5) },
      { key: "person", title: "Pessoas", items: globalSearchResults.filter((item) => item.kind === "person").slice(0, 4) },
      { key: "area", title: "Navegação", items: globalSearchResults.filter((item) => item.kind === "area").slice(0, 3) },
      { key: "setting", title: "Configurações", items: globalSearchResults.filter((item) => item.kind === "setting").slice(0, 4) },
    ].filter((section) => section.items.length > 0),
    [globalSearchResults],
  );
  const handleSelectGlobalSearchResult = (result: GlobalSearchResult) => {
    setIsGlobalSearchOpen(false);
    setGlobalSearchQuery("");

    if (result.kind === "setting" && result.settingKey) {
      openSettingsFromMobileSheet(result.settingKey);
      return;
    }

    if (result.kind === "area" && result.navKey) {
      handleSidebarMenuSelect(result.navKey);
      return;
    }

    if (result.kind === "person") {
      if (result.threadId) {
        openContactThread(result.threadId);
        return;
      }
      openMobileFooterEnvironment("contacts", { directoryTab: "people" });
      setDirectorySearch(result.directoryQuery?.trim() || result.label);
      return;
    }

    if (!result.threadId) return;
    if (result.threadTab === "contacts") {
      openContactThread(result.threadId);
      return;
    }
    openThreadById(result.threadId);
  };

  const activationBackdrop = !isChatRoute ? (
    <>
      <KnexChatMotionStyles />
      <KnexChatGlowBackdrop layout={activationLayout} />
    </>
  ) : null;

  if (!isReady || !isAuthReady) {
    return (
      <main
        style={THEME_STYLE}
        className={`${KNEXCHAT_FONT_CLASS} relative flex h-full min-h-0 flex-col overflow-hidden bg-[var(--kx-bg)] text-slate-900`}
      >
        {activationBackdrop}
        <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center">
          <div className="text-sm text-slate-400">Carregando KnexChat...</div>
        </div>
      </main>
    );
  }

  if (authSession?.user?.email && isKnexchatActivated === null && !identity) {
    return (
      <main
        style={THEME_STYLE}
        className={`${KNEXCHAT_FONT_CLASS} relative flex h-full min-h-0 flex-col overflow-hidden bg-[var(--kx-bg)] text-slate-900`}
      >
        {activationBackdrop}
        <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center">
          <div className="text-sm text-slate-400">Verificando sua conta KnexChat...</div>
        </div>
      </main>
    );
  }

  if (!identity) {
    return (
      <main
        style={THEME_STYLE}
        className={`${KNEXCHAT_FONT_CLASS} relative flex h-full min-h-0 flex-col overflow-hidden bg-[var(--kx-bg)] text-slate-900`}
      >
        <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center">
          <div className="text-sm text-slate-400">Redirecionando para ativacao...</div>
        </div>
      </main>
    );
  }

  if (!isChatRoute) {
    return (
      <main
        style={THEME_STYLE}
        className={`${KNEXCHAT_FONT_CLASS} relative flex h-full min-h-0 flex-col overflow-hidden bg-[var(--kx-bg)] text-slate-900`}
      >
        {activationBackdrop}
        <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center">
          <div className="text-sm text-slate-400">Abrindo o KnexChat...</div>
        </div>
      </main>
    );
  }

  return (
    <main
      style={THEME_STYLE}
      className={`${KNEXCHAT_FONT_CLASS} relative flex h-full min-h-0 flex-col overflow-hidden ${
        isDarkTheme ? "bg-[#141414] text-slate-100" : "bg-[var(--kx-bg)] text-slate-900"
      }`}
    >
      <KnexChatMotionStyles />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <header
          className={`relative flex min-h-[3.25rem] flex-nowrap items-center justify-start px-2 py-1.5 lg:min-h-[3rem] lg:flex-wrap lg:justify-between lg:gap-3 lg:px-4 lg:py-1.5 ${shellHeaderSurface}`}
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.375rem)" }}
        >
          {showMobileConversationShellHeader ? (
            <div className="relative flex w-full items-center gap-0.5 md:hidden">
              <button
                type="button"
                onClick={handleMobileBack}
                className="flex h-7 w-7 items-center justify-center rounded-full text-white transition hover:bg-white/15"
                aria-label="Voltar"
              >
                <ChevronLeft
                  className="h-3.5 w-3.5 [filter:drop-shadow(0_0_0.6px_rgba(8,33,78,0.92))]"
                  strokeWidth={2.45}
                />
              </button>
              <button
                type="button"
                onClick={() => handleOpenProfile("thread")}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                title="Abrir perfil"
              >
                {activeThread ? (
                  activeThreadAvatarUrl ? (
                    <img
                      src={activeThreadAvatarUrl}
                      alt={`Avatar de ${activeThread.title}`}
                      className={`h-9 w-9 ${avatarFrameSm} object-cover`}
                    />
                  ) : (
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-white/20 text-xs font-semibold text-white">
                      {getAvatarText(activeThread.title)}
                    </div>
                  )
                ) : null}
                <div className="min-w-0 flex-1">
                  <p
                    className={`${KNEXCHAT_FONT_CLASS} truncate text-base font-normal text-white`}
                    style={whiteHeaderTextStyle}
                  >
                    {activeThread?.title ?? "Conversa"}
                  </p>
                  <p className="min-h-[1rem] truncate text-[11px] leading-4 text-white" style={whiteHeaderTextStyle}>
                    {headerInfoItems[headerInfoStep] ?? ""}
                  </p>
                </div>
              </button>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  aria-label="Iniciar videochamada"
                  className="rounded-full p-2 text-white transition hover:bg-white/15 hover:text-white"
                >
                  <Video
                    className="h-5 w-5 [filter:drop-shadow(0_0_0.6px_rgba(8,33,78,0.92))]"
                    strokeWidth={2.45}
                  />
                </button>
                <button
                  type="button"
                  aria-label="Iniciar chamada"
                  className="rounded-full p-2 text-white transition hover:bg-white/15 hover:text-white"
                >
                  <Phone
                    className="h-5 w-5 [filter:drop-shadow(0_0_0.6px_rgba(8,33,78,0.92))]"
                    strokeWidth={2.45}
                  />
                </button>
                <button
                  type="button"
                  aria-label="Mais opções"
                  ref={threadMenuAnchorRef}
                  onClick={() => {
                    if (!activeThread) return;
                    setIsThreadMenuOpen((prev) => !prev);
                  }}
                  className="rounded-full p-2 text-white transition hover:bg-white/15 hover:text-white"
                >
                  <MoreVertical
                    className="h-5 w-5 [filter:drop-shadow(0_0_0.6px_rgba(8,33,78,0.92))]"
                    strokeWidth={2.45}
                  />
                </button>
              </div>
              {isThreadMenuOpen && threadMenuSections.length ? (
                <div
                  ref={threadMenuRef}
                  className={`absolute right-0 top-full z-40 mt-2 w-64 rounded-2xl border px-2 py-2 text-sm shadow-xl ${
                    isDarkTheme ? "border-[#2a2a2a] bg-[#1b1b1b]" : "border-slate-200 bg-white"
                  }`}
                >
                  {threadMenuSections.map((section, sectionIndex) => (
                    <div key={`thread-menu-mobile-section-${sectionIndex}`}>
                      {section.map((item) => {
                        const Icon = item.icon;
                        const isDanger = item.tone === "danger";
                        const action = item.action as string | undefined;
                        return (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => {
                              if (action === "contact-info") {
                                setIsContactInfoOpen(true);
                                setIsGroupInfoOpen(false);
                              } else if (action === "group-info") {
                                setIsGroupInfoOpen(true);
                                setIsContactInfoOpen(false);
                              }
                              setIsThreadMenuOpen(false);
                            }}
                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition ${
                              isDanger
                                ? isDarkTheme
                                  ? "hover:bg-rose-500/20"
                                  : "hover:bg-rose-100"
                                : isDarkTheme
                                  ? "hover:bg-white/5"
                                  : "hover:bg-slate-100"
                            } ${isDarkTheme ? "text-slate-200" : "text-slate-700"}`}
                          >
                            <Icon className="h-4 w-4" />
                            <span className="text-sm">{item.label}</span>
                          </button>
                        );
                      })}
                      {sectionIndex < threadMenuSections.length - 1 ? (
                        <div className={`${isDarkTheme ? "bg-white/10" : "bg-slate-200"} my-2 h-px`} />
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <div className="absolute left-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5 lg:left-4">
                <button
                  type="button"
                  onClick={handleToggleSidebar}
                  aria-label={isNavSidebarOpen ? "Fechar menu lateral" : "Abrir menu lateral"}
                  title={isNavSidebarOpen ? "Fechar menu lateral" : "Abrir menu lateral"}
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-md transition ${
                    isDarkTheme
                      ? "text-white hover:bg-white/15"
                      : "text-white hover:bg-white/15 md:text-slate-700 md:hover:bg-slate-200/70"
                  }`}
                >
                  <Menu
                    className="h-[clamp(1.06rem,3.8vw,1.18rem)] w-[clamp(1.06rem,3.8vw,1.18rem)] [filter:drop-shadow(0_0_0.6px_rgba(8,33,78,0.92))]"
                    strokeWidth={2.45}
                  />
                </button>
                <img
                  src="/knexchat/icons/spacehub-official-tight.png"
                  alt="Logo SpaceHub"
                  className="h-[clamp(1.24rem,4.6vw,1.58rem)] w-[clamp(1.24rem,4.6vw,1.58rem)] shrink-0 object-contain object-center"
                />
                <div>
                  <p
                    className="text-[clamp(1.3rem,5.8vw,1.62rem)] font-semibold leading-none max-[360px]:text-[clamp(1.2rem,5.45vw,1.42rem)] md:text-[clamp(1.14rem,1.6vw,1.34rem)]"
                  >
                    <span
                      className={isDarkTheme ? "text-white" : "text-white md:text-slate-900"}
                      style={isDarkTheme ? headerBrandTextStyle : undefined}
                    >
                      SpaceHub
                    </span>
                  </p>
                </div>
              </div>
              <div
                ref={globalSearchContainerRef}
                className="pointer-events-none absolute left-1/2 top-1/2 hidden w-[calc(min(42rem,calc(100%-26rem))*0.8)] -translate-x-1/2 -translate-y-1/2 items-center justify-center lg:flex"
              >
                <div className="pointer-events-auto relative w-full">
                  <div
                    className={`flex h-8 w-full items-center overflow-hidden rounded-full border ${
                      isDarkTheme ? "border-[#3a3a3a] bg-[#1f1f1f] text-slate-200" : "border-slate-300 bg-[#efefef] text-slate-700"
                    }`}
                  >
                    <input
                      type="search"
                      aria-label="Pesquisar no SpaceHub"
                      placeholder="Pesquisar no SpaceHub"
                      value={globalSearchQuery}
                      onFocus={() => {
                        if (globalSearchQuery.trim()) setIsGlobalSearchOpen(true);
                      }}
                      onChange={(event) => {
                        const nextQuery = event.target.value;
                        setGlobalSearchQuery(nextQuery);
                        setIsGlobalSearchOpen(Boolean(nextQuery.trim()));
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          setIsGlobalSearchOpen(false);
                          return;
                        }
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        const firstResult = globalSearchResults[0];
                        if (!firstResult) return;
                        handleSelectGlobalSearchResult(firstResult);
                      }}
                      className={`h-full min-w-0 flex-1 bg-transparent px-4 text-[0.99rem] outline-none placeholder:text-slate-400 ${
                        isDarkTheme ? "placeholder:text-slate-500" : ""
                      }`}
                    />
                    <span className={`grid h-full w-10 place-items-center border-l ${isDarkTheme ? "border-[#3a3a3a] text-slate-400" : "border-slate-300 text-slate-500"}`}>
                      <Keyboard className="h-3.5 w-3.5" />
                    </span>
                    <button
                      type="button"
                      aria-label="Buscar"
                      title="Buscar"
                      onClick={() => {
                        const firstResult = globalSearchResults[0];
                        if (!firstResult) return;
                        handleSelectGlobalSearchResult(firstResult);
                      }}
                      className={`grid h-full w-11 place-items-center transition ${
                        isDarkTheme ? "border-l border-[#3a3a3a] bg-[#2a2a2a] text-slate-200 hover:bg-[#343434]" : "border-l border-slate-300 bg-[#e5e5e5] text-slate-700 hover:bg-[#dcdcdc]"
                      }`}
                    >
                      <Search className="h-4 w-4" />
                    </button>
                  </div>
                  {isGlobalSearchOpen ? (
                    <div
                      className={`absolute left-0 right-0 top-full z-[60] mt-2 max-h-[26rem] overflow-y-auto rounded-2xl border p-2 shadow-2xl ${
                        isDarkTheme ? "border-[#343434] bg-[#1a1a1a] text-slate-100" : "border-slate-300 bg-[#f4f4f4] text-slate-900"
                      }`}
                    >
                      {globalSearchQuery.trim() ? (
                        globalSearchSections.length ? (
                          <div className="space-y-1.5">
                            {globalSearchSections.map((section) => (
                              <div key={`global-search-section-${section.key}`}>
                                <p className={`px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${settingsMuted}`}>
                                  {section.title}
                                </p>
                                {section.items.map((item) => {
                                  const ItemIcon = item.icon;
                                  return (
                                    <button
                                      key={item.id}
                                      type="button"
                                      onClick={() => handleSelectGlobalSearchResult(item)}
                                      className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition ${settingsHover}`}
                                    >
                                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${isDarkTheme ? "border-[#3b3b3b] bg-[#252525]" : "border-slate-300 bg-white"}`}>
                                        <ItemIcon className="h-4 w-4" />
                                      </span>
                                      <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium">{item.label}</span>
                                        <span className={`block truncate text-xs ${settingsMuted}`}>{item.subLabel}</span>
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className={`px-2 py-3 text-sm ${settingsMuted}`}>Nenhum resultado encontrado.</p>
                        )
                      ) : (
                        <p className={`px-2 py-3 text-sm ${settingsMuted}`}>Digite para pesquisar em todo o app.</p>
                      )}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  aria-label="Pesquisa por voz"
                  title="Pesquisa por voz"
                  className={`pointer-events-auto ml-3 grid h-8 w-8 shrink-0 place-items-center rounded-full border transition ${
                    isDarkTheme ? "border-[#3a3a3a] bg-[#222] text-slate-200 hover:bg-[#2d2d2d]" : "border-slate-300 bg-[#efefef] text-slate-700 hover:bg-[#e2e2e2]"
                  }`}
                >
                  <Mic className="h-4 w-4" />
                </button>
              </div>
              <span
                className={`absolute right-1.5 top-1/2 -translate-y-1/2 lg:hidden ${
                  isDarkTheme ? "text-white" : "text-white md:text-slate-700"
                }`}
                aria-hidden="true"
              >
                <MoreVertical
                  className="h-[clamp(1.38rem,5.72vw,1.68rem)] w-[clamp(1.38rem,5.72vw,1.68rem)] [filter:drop-shadow(0_0_0.6px_rgba(8,33,78,0.92))]"
                  strokeWidth={2.45}
                />
              </span>
              <div className="absolute right-3 top-1/2 hidden -translate-y-1/2 lg:block">
                <div ref={headerAvatarMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setIsHeaderAvatarMenuOpen((prev) => !prev)}
                    aria-label="Abrir menu da conta"
                    title="Conta"
                    className={`flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border transition ${
                      isDarkTheme
                        ? "border-white/45 bg-white/10 hover:bg-white/20"
                        : "border-slate-300 bg-white hover:bg-slate-100"
                    }`}
                  >
                    {currentUser?.avatarUrl ? (
                      <img
                        src={currentUser.avatarUrl}
                        alt={`Avatar de ${currentUser?.name ?? "Participante"}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className={`grid h-full w-full place-items-center text-xs font-semibold ${isDarkTheme ? "text-white" : "text-slate-700"}`}>
                        {getAvatarText(currentUser?.name ?? "KN")}
                      </span>
                    )}
                  </button>
                  {isHeaderAvatarMenuOpen ? (
                    <div
                      className={`absolute right-0 top-full z-50 mt-2 w-[19rem] overflow-hidden rounded-2xl border shadow-2xl ${
                        isDarkTheme ? "border-[#2f2f2f] bg-[#1f1f1f] text-slate-100" : "border-slate-300 bg-[#f1f1f1] text-slate-900"
                      }`}
                    >
                      <div className="flex items-start gap-3 px-4 py-3">
                        {currentUser?.avatarUrl ? (
                          <img
                            src={currentUser.avatarUrl}
                            alt={`Avatar de ${currentUser?.name ?? "Participante"}`}
                            className={`h-11 w-11 ${avatarFrameMd} object-cover`}
                          />
                        ) : (
                          <div
                            className={`grid h-11 w-11 place-items-center ${avatarFrameMd} text-sm font-semibold ${
                              isDarkTheme ? "bg-slate-900 text-slate-100" : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {getAvatarText(currentUser?.name ?? "KN")}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xl font-normal leading-tight">{currentUser?.name ?? "Participante"}</p>
                          <p className={`truncate text-sm ${isDarkTheme ? "text-slate-400" : "text-slate-600"}`}>
                            {headerAvatarHandle}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setIsHeaderAvatarMenuOpen(false);
                              handleOpenProfile("self");
                            }}
                            className={`mt-1.5 text-sm font-medium ${
                              isDarkTheme ? "text-blue-300 hover:text-blue-200" : "text-blue-700 hover:text-blue-600"
                            }`}
                          >
                            Acessar seu canal
                          </button>
                        </div>
                      </div>
                      <div className={`h-px ${isDarkTheme ? "bg-white/10" : "bg-slate-300/80"}`} />
                      <button
                        type="button"
                        onClick={() => {
                          setIsHeaderAvatarMenuOpen(false);
                          openSettingsFromMobileSheet("account");
                        }}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-[1.05rem] transition ${
                          isDarkTheme ? "hover:bg-white/5" : "hover:bg-black/5"
                        }`}
                      >
                        <span
                          className={`grid h-5 w-5 place-items-center rounded-full text-[13px] font-bold ${
                            isDarkTheme ? "bg-slate-700 text-white" : "bg-white text-slate-800"
                          }`}
                        >
                          G
                        </span>
                        <span>Conta do Google</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsHeaderAvatarMenuOpen(false)}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-[1.05rem] transition ${
                          isDarkTheme ? "hover:bg-white/5" : "hover:bg-black/5"
                        }`}
                      >
                        <User className="h-5 w-5" />
                        <span>Mudar de conta</span>
                        <ChevronRight className={`ml-auto h-4 w-4 ${isDarkTheme ? "text-slate-400" : "text-slate-600"}`} />
                      </button>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-[1.05rem] transition ${
                          isDarkTheme ? "hover:bg-white/5" : "hover:bg-black/5"
                        }`}
                      >
                        <LogOut className="h-5 w-5" />
                        <span>Sair</span>
                      </button>
                      <div className={`h-px ${isDarkTheme ? "bg-white/10" : "bg-slate-300/80"}`} />
                      <button
                        type="button"
                        onClick={() => {
                          setIsHeaderAvatarMenuOpen(false);
                          openSettingsFromMobileSheet("account");
                        }}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-[1.05rem] transition ${
                          isDarkTheme ? "hover:bg-white/5" : "hover:bg-black/5"
                        }`}
                      >
                        <Play className="h-5 w-5" />
                        <span>YouTube Studio</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsHeaderAvatarMenuOpen(false);
                          openSettingsFromMobileSheet("account");
                        }}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-[1.05rem] transition ${
                          isDarkTheme ? "hover:bg-white/5" : "hover:bg-black/5"
                        }`}
                      >
                        <CreditCard className="h-5 w-5" />
                        <span>Compras e assinaturas</span>
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          )}
        </header>
        <button
          type="button"
          aria-label="Fechar menu lateral"
          onClick={() => setIsNavSidebarOpen(false)}
          className={`absolute inset-0 z-[18] hidden transition lg:block ${
            isNavSidebarOpen ? "bg-black/15 opacity-100" : "pointer-events-none bg-transparent opacity-0"
          }`}
        />
        <aside
          className={`absolute left-0 top-0 z-[19] hidden h-full w-[17rem] flex-col border-r shadow-xl transition-all duration-200 ease-out lg:flex ${
            isDarkTheme ? "border-[#2a2a2a] bg-[#161616] text-slate-100" : "border-slate-200 bg-[#f5f6f7] text-slate-900"
          } ${isNavSidebarOpen ? "translate-x-0 opacity-100" : "-translate-x-5 opacity-0 pointer-events-none"}`}
        >
          <div className={`flex min-h-[3rem] items-center gap-1.5 border-b px-4 py-1.5 ${settingsBorder}`}>
            <button
              type="button"
              onClick={() => setIsNavSidebarOpen(false)}
              aria-label="Fechar menu lateral"
              title="Fechar menu lateral"
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-md transition ${
                isDarkTheme ? "text-white hover:bg-white/15" : "text-slate-800 hover:bg-slate-200/70"
              }`}
            >
              <Menu
                className="h-[clamp(1.06rem,3.8vw,1.18rem)] w-[clamp(1.06rem,3.8vw,1.18rem)]"
                strokeWidth={2.45}
              />
            </button>
            <img
              src="/knexchat/icons/spacehub-official-tight.png"
              alt="Logo SpaceHub"
              className="h-[clamp(1.24rem,4.6vw,1.58rem)] w-[clamp(1.24rem,4.6vw,1.58rem)] shrink-0 object-contain object-center"
            />
            <p
              className="truncate text-[clamp(1.3rem,5.8vw,1.62rem)] font-semibold leading-none max-[360px]:text-[clamp(1.2rem,5.45vw,1.42rem)] md:text-[clamp(1.14rem,1.6vw,1.34rem)]"
            >
              <span className={isDarkTheme ? "text-white" : "text-slate-900"} style={isDarkTheme ? headerBrandTextStyle : undefined}>
                SpaceHub
              </span>
            </p>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            <div className="space-y-0.5 px-2">
              {desktopSidebarPrimaryItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeNavKey === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleSidebarMenuSelect(item.key)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${
                      isActive
                        ? isDarkTheme
                          ? "bg-white/10 text-white"
                          : "bg-slate-200 text-slate-900"
                        : isDarkTheme
                          ? "text-slate-200 hover:bg-white/5"
                          : "text-slate-800 hover:bg-slate-200/70"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
            <div className={`my-2 h-px ${settingsBorder} border-b`} />
            <div className="px-4 pb-1 pt-1">
              <p className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${settingsMuted}`}>Explorar</p>
            </div>
            <div className="space-y-0.5 px-2">
              {desktopSidebarExploreItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeNavKey === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleSidebarMenuSelect(item.key)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${
                      isActive
                        ? isDarkTheme
                          ? "bg-white/10 text-white"
                          : "bg-slate-200 text-slate-900"
                        : isDarkTheme
                          ? "text-slate-200 hover:bg-white/5"
                          : "text-slate-800 hover:bg-slate-200/70"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
        <div
          className={`relative flex min-h-0 flex-1 flex-col ${
            showMobileFooterDock
              ? "pb-[3.5rem]"
              : "pb-[env(safe-area-inset-bottom)]"
          } overflow-hidden lg:flex-row lg:pb-0 ${shellSurface}`}
        >
        <nav
          className={`hidden w-14 flex-col items-center gap-4 ${navRailBase} pb-5 pt-[3.2rem] lg:flex`}
        >
          <div className="relative group">
            <button
              type="button"
              className={navButtonClass(activeNavKey === "conversations")}
              onClick={() => {
                setActiveNavKey("conversations");
                setIsDirectoryOpen(false);
                setIsSettingsOpen(false);
                setIsProfileOpen(false);
                setProfileTarget(null);
                setIsNewChatOpen(false);
                setIsNewChatEmailOpen(false);
                setIsNewGroupOpen(false);
                setIsNewGroupCreateOpen(false);
                setIsCommunityListOpen(false);
                setIsGroupsPanelOpen(false);
                setIsGroupCreateOpen(false);
                setIsNewContactOpen(false);
                setIsGroupsExpanded(false);
                setSelectedGroupMemberIds([]);
              }}
              aria-label="Conversas"
              title="Conversas"
            >
              <MessageCircle className="h-5 w-5" />
            </button>
            {unreadTotal > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-orange-600 px-1.5 text-[10px] font-semibold text-white">
                {unreadTotalLabel}
              </span>
            ) : null}
            <span
              className={`pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold shadow transition ${
                isDarkTheme ? "bg-slate-900 text-slate-100" : "bg-slate-900 text-white"
              } opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0`}
            >
              Conversas
            </span>
          </div>
          <div className="relative group">
            <button
              type="button"
              className={navButtonClass(activeNavKey === "calls")}
              aria-label="Ligações"
              title="Ligações"
              onClick={() => {
                setActiveNavKey("calls");
                setIsDirectoryOpen(false);
              }}
            >
              <Phone className="h-5 w-5" />
            </button>
            <span
              className={`pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold shadow transition ${
                isDarkTheme ? "bg-slate-900 text-slate-100" : "bg-slate-900 text-white"
              } opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0`}
            >
              Ligações
            </span>
          </div>
          <div className="relative group">
            <button
              type="button"
              className={navButtonClass(activeNavKey === "status")}
              aria-label="Status"
              title="Status"
              onClick={() => {
                setActiveNavKey("status");
                setIsDirectoryOpen(false);
              }}
            >
              <CircleDot className="h-5 w-5" />
            </button>
            <span
              className={`pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold shadow transition ${
                isDarkTheme ? "bg-slate-900 text-slate-100" : "bg-slate-900 text-white"
              } opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0`}
            >
              Status
            </span>
          </div>
          <div className="relative group">
            <button
              type="button"
              className={navButtonClass(activeNavKey === "channels")}
              aria-label="Canais"
              title="Canais"
              onClick={() => {
                setActiveNavKey("channels");
                setIsDirectoryOpen(false);
              }}
            >
              <Radio className="h-5 w-5" />
            </button>
            <span
              className={`pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold shadow transition ${
                isDarkTheme ? "bg-slate-900 text-slate-100" : "bg-slate-900 text-white"
              } opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0`}
            >
              Canais
            </span>
          </div>
          <div className="relative group">
            <button
              type="button"
              className={navButtonClass(activeNavKey === "communities")}
              aria-label="Comunidades"
              title="Comunidades"
              onClick={() => {
                setActiveNavKey("communities");
                setIsDirectoryOpen(false);
                setIsNewChatOpen(true);
                setIsCommunityListOpen(true);
                setIsNewChatEmailOpen(false);
                setIsNewGroupOpen(false);
                setIsGroupsPanelOpen(false);
                setIsGroupCreateOpen(false);
                setIsGroupsExpanded(false);
                setIsNewContactOpen(false);
                setIsSettingsOpen(false);
                setIsProfileOpen(false);
                setProfileTarget(null);
              }}
            >
              <Shapes className="h-5 w-5" />
            </button>
            <span
              className={`pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold shadow transition ${
                isDarkTheme ? "bg-slate-900 text-slate-100" : "bg-slate-900 text-white"
              } opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0`}
            >
              Comunidades
            </span>
          </div>
          <div className="relative group">
            <button
              type="button"
              className={`${navButtonClass(activeNavKey === "contacts")} ${
                isDarkTheme
                  ? activeNavKey === "contacts"
                    ? "bg-slate-300/45 border-white/30"
                    : "hover:bg-slate-300/40"
                  : ""
              }`}
              aria-label="Novo contato ou conversa"
              title="Novo contato ou conversa"
              onClick={() => {
                setActiveNavKey("contacts");
                setIsDirectoryOpen(true);
                setDirectoryTab("people");
                setIsNewChatOpen(false);
                setIsNewChatEmailOpen(false);
                setIsNewGroupOpen(false);
                setIsNewGroupCreateOpen(false);
                setIsCommunityListOpen(false);
                setIsGroupsPanelOpen(false);
                setIsGroupCreateOpen(false);
                setIsGroupsExpanded(false);
                setIsNewContactOpen(false);
                setIsSettingsOpen(false);
                setIsProfileOpen(false);
                setProfileTarget(null);
              }}
            >
              <UserPlus
                className={`h-5 w-5 ${
                  activeNavKey === "contacts"
                    ? isDarkTheme
                      ? "text-white"
                      : "text-black"
                    : isDarkTheme
                      ? "text-slate-300 group-hover:text-white"
                      : "text-slate-700 group-hover:text-slate-900"
                }`}
              />
            </button>
            <span
              className={`pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold shadow transition ${
                isDarkTheme ? "bg-slate-900 text-slate-100" : "bg-slate-900 text-white"
              } opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0`}
            >
              Novo contato/conversa
            </span>
          </div>
          <div className="mt-auto flex flex-col items-center gap-3">
            <div className="relative group">
              <button
                type="button"
                className={navButtonClass(activeNavKey === "images")}
                onClick={() => {
                  setActiveNavKey("images");
                  setIsDirectoryOpen(false);
                  setIsMediaModalOpen(true);
                  setActiveMediaTab("media");
                  setIsMediaSelectMode(false);
                  setSelectedMediaIds([]);
                  setIsMediaFilterOpen(false);
                  setIsMediaShareOpen(false);
                  setShareSearch("");
                  setShareMessage("");
                  setSelectedShareContactIds([]);
                  clearShareAudios();
                  if (shareRecordingState === "recording") {
                    stopShareRecording("discard");
                  }
                }}
                aria-label="Imagens"
                title="Imagens"
              >
                <ImageIcon className="h-5 w-5" />
              </button>
              <span
                className={`pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold shadow transition ${
                  isDarkTheme ? "bg-slate-900 text-slate-100" : "bg-slate-900 text-white"
                } opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0`}
              >
                Imagens
              </span>
            </div>
            <div className={`h-px w-8 ${navRailDivider}`} />
            <div className="relative group">
              <button
                type="button"
                className={navButtonClass(activeNavKey === "settings")}
                onClick={() => {
                  setActiveNavKey("settings");
                  setIsDirectoryOpen(false);
                  setIsSettingsOpen(true);
                  setIsProfileOpen(false);
                  setProfileTarget(null);
                  setActiveSettingKey(null);
                setIsNewChatOpen(false);
                setIsNewChatEmailOpen(false);
                setIsNewGroupOpen(false);
                setIsNewGroupCreateOpen(false);
                setIsCommunityListOpen(false);
                setIsGroupsPanelOpen(false);
                setIsGroupCreateOpen(false);
                setIsNewContactOpen(false);
                setIsGroupsExpanded(false);
                setSelectedGroupMemberIds([]);
              }}
                aria-label="Configurações"
                title={isSettingsOpen ? undefined : "Configurações"}
              >
                <Settings className="h-5 w-5" />
              </button>
              <span
                className={`pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold shadow transition ${
                  isDarkTheme ? "bg-slate-900 text-slate-100" : "bg-slate-900 text-white"
                } ${
                  isSettingsOpen
                    ? "opacity-0 translate-x-1"
                    : "opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0"
                }`}
              >
                Configurações
              </span>
            </div>
          </div>
        </nav>
        <div className="flex min-h-0 flex-1 flex-col">
        {showMobileConversationShellHeader ? null : (
          <div
            className={`${settingsBorder} ${
              isDarkTheme ? "bg-[var(--knex-850)]/50" : "bg-[#f5f6f7]"
            }`}
          >
            <div className="px-4 py-2 md:px-0">
              <div className="flex items-center gap-2">
                {canScrollTopMenuLeft ? (
                  <button
                    type="button"
                    onClick={() => scrollTopMenuCarousel("left")}
                    aria-label="Voltar no menu"
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border transition ${
                      isDarkTheme
                        ? "border-white/25 bg-transparent text-slate-200 hover:bg-white/10"
                        : "border-slate-400/80 bg-transparent text-slate-600 hover:bg-slate-200/70"
                    }`}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                ) : null}
                <div
                  ref={topMenuCarouselRef}
                  className="no-scrollbar flex min-w-0 flex-1 items-center gap-2 overflow-x-auto overflow-y-hidden whitespace-nowrap scroll-px-4 scroll-smooth md:-mx-4 md:px-4 md:scroll-px-4"
                  onWheel={(event) => {
                    const element = event.currentTarget;
                    if (element.scrollWidth <= element.clientWidth) return;
                    if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
                    element.scrollLeft += event.deltaY;
                    event.preventDefault();
                  }}
                >
                  <span className="w-1.5 shrink-0 md:w-2" aria-hidden="true" />
                  {TOP_MENU_CAROUSEL_ITEMS.map((label, index) => {
                    const itemKey = `${label}-${index}`;
                    const isActive = index === activeTopMenuIndex;
                    return (
                      <button
                        key={itemKey}
                        type="button"
                        onClick={() => setActiveTopMenuIndex(index)}
                        className={`shrink-0 rounded-[7px] px-4 py-1.5 text-[15px] font-semibold leading-none transition md:text-[14px] ${
                          isActive
                            ? "bg-black text-white"
                            : isDarkTheme
                              ? "bg-[#2e2e2e] text-slate-100 hover:bg-[#3a3a3a]"
                              : "bg-[#e6e6e6] text-[#1f1f1f] hover:bg-[#dddddd]"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                  <span className="w-1.5 shrink-0 md:w-2" aria-hidden="true" />
                </div>
                {canScrollTopMenuRight ? (
                  <button
                    type="button"
                    onClick={() => scrollTopMenuCarousel("right")}
                    aria-label="Avançar no menu"
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border transition ${
                      isDarkTheme
                        ? "border-white/25 bg-transparent text-slate-200 hover:bg-white/10"
                        : "border-slate-400/80 bg-transparent text-slate-600 hover:bg-slate-200/70"
                    }`}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        )}
        <MasterDetail
          className="min-h-0 flex-1"
          showDetail={showDetailOnMobile}
          master={
          isSettingsOpen ? (
          <>
            <aside
              style={{ ...(chatListWidthStyle ?? {}), ...(settingsCrispTextStyle ?? {}) }}
              className={`relative flex min-h-0 w-full flex-1 flex-col border-b ${settingsBorder} ${settingsPanelBase} ${settingsCrispClass} ${settingsCrispContrastClass} md:w-[var(--chat-list-width)] md:border-b-0 ${isDarkTheme ? "md:border-l" : "md:border-l-0"} md:border-r md:overflow-visible`}
            >
              {activeSettingKey === "general" ? (
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className={`flex items-center gap-3 border-b px-5 py-3 ${settingsBorder}`}>
                    <button
                      type="button"
                      onClick={handleBackFromSettingsDetail}
                      className={`flex h-7 w-7 items-center justify-center rounded-full transition ${
                        isDarkTheme ? "text-slate-200 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"
                      }`}
                      aria-label="Voltar"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-base font-semibold">Geral</span>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto space-y-6 px-5 py-4">
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
                              ? isDarkTheme
                                ? "border-slate-200/80 bg-slate-200"
                                : "border-blue-500 bg-blue-500"
                              : isDarkTheme
                                ? "border-[#3a3a3a] bg-[#1f1f1f]"
                                : "border-slate-300 bg-white"
                          }`}
                          aria-pressed={settingsState.openOnStart}
                        >
                          <span
                            className={`absolute left-1 top-1/2 h-[14px] w-[14px] -translate-y-1/2 rounded-full shadow transition ${
                              isDarkTheme || settingsState.openOnStart ? "bg-white" : "bg-slate-400"
                            } ${settingsState.openOnStart ? "translate-x-[20px]" : "translate-x-0"}`}
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
                              ? isDarkTheme
                                ? "border-slate-200/80 bg-slate-200"
                                : "border-blue-500 bg-blue-500"
                              : isDarkTheme
                                ? "border-[#3a3a3a] bg-[#1f1f1f]"
                                : "border-slate-300 bg-white"
                          }`}
                          aria-pressed={settingsState.minimizeToTray}
                        >
                          <span
                            className={`absolute left-1 top-1/2 h-[14px] w-[14px] -translate-y-1/2 rounded-full shadow transition ${
                              isDarkTheme || settingsState.minimizeToTray ? "bg-white" : "bg-slate-400"
                            } ${settingsState.minimizeToTray ? "translate-x-[20px]" : "translate-x-0"}`}
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
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className={`flex items-center gap-3 border-b px-5 py-3 ${settingsBorder}`}>
                    <button
                      type="button"
                      onClick={() => {
                        if (isWallpaperModalOpen) {
                          setIsWallpaperModalOpen(false);
                          setWallpaperHoverKey(null);
                        } else {
                          handleBackFromSettingsDetail();
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
                  <div className="flex-1 min-h-0 overflow-y-auto space-y-6 px-5 py-4">
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
                              ? isDarkTheme
                                ? "border-slate-200/80 bg-slate-200"
                                : "border-blue-500 bg-blue-500"
                              : isDarkTheme
                                ? "border-[#3a3a3a] bg-[#1f1f1f]"
                                : "border-slate-300 bg-white"
                          }`}
                          aria-pressed={settingsState.spellCheck}
                        >
                          <span
                            className={`absolute left-1 top-1/2 h-[14px] w-[14px] -translate-y-1/2 rounded-full shadow transition ${
                              isDarkTheme || settingsState.spellCheck ? "bg-white" : "bg-slate-400"
                            } ${settingsState.spellCheck ? "translate-x-[20px]" : "translate-x-0"}`}
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
                              ? isDarkTheme
                                ? "border-slate-200/80 bg-slate-200"
                                : "border-blue-500 bg-blue-500"
                              : isDarkTheme
                                ? "border-[#3a3a3a] bg-[#1f1f1f]"
                                : "border-slate-300 bg-white"
                          }`}
                          aria-pressed={settingsState.emojiReplace}
                        >
                          <span
                            className={`absolute left-1 top-1/2 h-[14px] w-[14px] -translate-y-1/2 rounded-full shadow transition ${
                              isDarkTheme || settingsState.emojiReplace ? "bg-white" : "bg-slate-400"
                            } ${settingsState.emojiReplace ? "translate-x-[20px]" : "translate-x-0"}`}
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
                              ? isDarkTheme
                                ? "border-slate-200/80 bg-slate-200"
                                : "border-blue-500 bg-blue-500"
                              : isDarkTheme
                                ? "border-[#3a3a3a] bg-[#1f1f1f]"
                                : "border-slate-300 bg-white"
                          }`}
                          aria-pressed={settingsState.enterToSend}
                        >
                          <span
                            className={`absolute left-1 top-1/2 h-[14px] w-[14px] -translate-y-1/2 rounded-full shadow transition ${
                              isDarkTheme || settingsState.enterToSend ? "bg-white" : "bg-slate-400"
                            } ${settingsState.enterToSend ? "translate-x-[20px]" : "translate-x-0"}`}
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
                      className={`mt-2 flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs md:text-[15px] shadow-sm ${
                        isDarkTheme
                          ? "border-emerald-500/60 bg-[#1b1b1b] text-slate-300"
                          : "border-blue-400/70 bg-white text-slate-500"
                      }`}
                    >
                      <Search className={`h-4 w-4 ${isDarkTheme ? "text-emerald-500" : "text-blue-500"}`} />
                      <span>Pesquisar configurações</span>
                    </div>
                  </div>
                  <div className={`border-b px-5 py-3 ${settingsBorder}`}>
                    <button
                      type="button"
                      onClick={() => handleOpenProfile("self")}
                      className="flex w-full items-center gap-3 text-left"
                    >
                      {currentUser?.avatarUrl ? (
                        <img
                          src={currentUser.avatarUrl}
                          alt={`Avatar de ${currentUser?.name ?? "Participante"}`}
                          className={`h-10 w-10 ${avatarFrameSm} object-cover`}
                        />
                      ) : (
                        <div
                          className={`grid h-10 w-10 place-items-center ${avatarFrameSm} text-sm font-semibold ${
                            isDarkTheme ? "bg-[#0d0d0d] text-slate-100" : "bg-slate-900 text-white"
                          }`}
                        >
                          {getAvatarText(currentUser?.name ?? "KN")}
                        </div>
                      )}
                      <div>
                        <p
                          className={`text-base font-semibold md:text-[19px] md:leading-tight ${
                            isDarkTheme ? "text-slate-100" : "text-slate-900"
                          }`}
                        >
                          {currentUser?.name ?? "Participante"}
                        </p>
                        <p className={`text-xs md:text-[13px] ${isDarkTheme ? "text-slate-400" : "text-slate-600"}`}>
                          {currentUser?.email}
                        </p>
                        <p className={`text-[10px] md:text-[13px] ${settingsMuted}`}>
                          {settingsState.profileRecado ?? DEFAULT_SETTINGS_STATE.profileRecado}
                        </p>
                      </div>
                    </button>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2">
                    <div className="space-y-0.5">
                      <p className={`px-3 pb-1 pt-2 text-xs font-semibold tracking-[0.08em] ${settingsMuted}`}>
                        Configurações
                      </p>
                      {mobileProfileSheetItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = item.settingKey ? activeSettingKey === item.settingKey : false;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={item.onSelect}
                            className={`flex w-full items-start gap-3 rounded-2xl px-3 py-2 text-left transition ${
                              isActive ? (isDarkTheme ? "bg-white/10" : "bg-slate-100") : settingsHover
                            }`}
                          >
                            <div
                              className={`mt-0.5 grid h-8 w-8 place-items-center ${
                                isDarkTheme ? "text-slate-300" : "text-slate-600"
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                            </div>
                            <div>
                              <p
                                className={`text-sm font-normal md:text-base ${
                                  isDarkTheme ? "text-slate-100" : "text-slate-900"
                                }`}
                              >
                                {item.label}
                              </p>
                              <p className={`text-[11px] md:text-[13px] ${settingsMuted}`}>{item.description}</p>
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
                          className={`grid h-8 w-8 place-items-center ${
                            isDarkTheme ? "text-rose-300" : "text-rose-500"
                          }`}
                        >
                          <LogOut className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-normal md:text-base">Desconectar</p>
                        </div>
                      </button>
                    </div>
                  </div>
                </>
              )}
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Redimensionar painel lateral"
                onMouseDown={handleStartChatListResize}
                className="group absolute left-full top-0 z-30 hidden h-full w-3 cursor-col-resize lg:block"
              >
                <span
                  className={`pointer-events-none absolute left-0 top-0 h-full rounded-full transition-all ${
                    isChatListResizing
                      ? isDarkTheme
                        ? "w-1 bg-slate-400/45"
                        : "w-1 bg-blue-500/60"
                      : isDarkTheme
                        ? "w-px bg-[#2a2a2a] group-hover:w-1 group-hover:bg-slate-500/50"
                        : "w-px bg-slate-300/70 group-hover:w-1 group-hover:bg-slate-400/80"
                  }`}
                />
              </div>
            </aside>
            <section
              className={`flex min-h-0 flex-1 overflow-hidden ${settingsBorder} ${settingsCrispClass} ${settingsCrispContrastClass} ${
                isDarkTheme ? "bg-[#141414]" : "bg-slate-50"
              }`}
              style={settingsCrispTextStyle}
            >
              {activeSettingKey === "chats" && isWallpaperModalOpen ? (
                <div className="flex h-full w-full flex-col p-6">
                  <p className={`text-xs font-semibold ${settingsMuted}`}>Pré-visualizar papel de parede</p>
                  <div
                    className={`mt-4 flex-1 rounded-2xl border ${settingsBorder}`}
                    style={{ backgroundColor: wallpaperPreviewColor }}
                  />
                </div>
              ) : (
                <div className="flex-1" />
              )}
            </section>
            {isThemeModalOpen ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
                <div
                  className={`w-full max-w-xl rounded-3xl p-6 shadow-2xl ${
                    isDarkTheme ? "border border-[#3a3a3a] bg-[#2a2a2a]" : "bg-white"
                  }`}
                >
                  <h3 className={`text-lg font-semibold ${isDarkTheme ? "text-slate-200" : "text-slate-900"}`}>Tema</h3>
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
                          className={`flex w-full items-center gap-3 text-left text-sm transition ${
                            isDarkTheme ? "text-slate-200 hover:text-white" : "text-slate-900"
                          }`}
                        >
                          <span
                            className={`relative h-5 w-5 rounded-full border-2 ${
                              isSelected
                                ? isDarkTheme
                                  ? "border-white"
                                  : "border-blue-500"
                                : isDarkTheme
                                  ? "border-slate-500"
                                  : "border-slate-300"
                            }`}
                          >
                            {isSelected ? (
                              <span
                                className={`absolute inset-0 m-1 rounded-full ${
                                  isDarkTheme ? "bg-white" : "bg-blue-500"
                                }`}
                              />
                            ) : null}
                          </span>
                          <span className={isSelected ? (isDarkTheme ? "text-white" : "text-blue-600") : ""}>
                            {option.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-6 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsThemeModalOpen(false)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        isDarkTheme ? "text-slate-200 hover:bg-white/10 hover:text-white" : "text-blue-600 hover:bg-blue-50"
                      }`}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSettingsState((prev) => ({ ...prev, theme: pendingTheme }));
                        setIsThemeModalOpen(false);
                      }}
                      className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                        isDarkTheme ? "bg-slate-200 text-slate-900 hover:bg-white" : "bg-blue-500 text-white hover:bg-blue-600"
                      }`}
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
        {isProfileOpen ? (
          <aside
            style={chatListWidthStyle}
            className={`relative flex min-h-0 w-full flex-1 flex-col ${settingsBorder} ${
              isDarkTheme ? "bg-[var(--knex-850)]/60" : "bg-white"
            } md:w-[var(--chat-list-width)] md:border-b-0 ${isDarkTheme ? "md:border-l" : "md:border-l-0"} md:border-r md:overflow-visible`}
          >
            <div className="flex items-center justify-between px-4 py-3">
              <span className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>Perfil</span>
              <button
                type="button"
                onClick={handleCloseProfileAndCommit}
                className={`flex h-7 w-7 items-center justify-center rounded-full transition ${
                  isDarkTheme ? "text-slate-200 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"
                }`}
                aria-label="Voltar"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="flex flex-col items-center gap-3 px-4 py-6 max-[420px]:gap-2.5 max-[420px]:py-4 [@media(max-height:760px)]:py-4 [@media(max-height:700px)]:py-3">
                <div className="flex w-full items-center justify-center">
                  <button
                    type="button"
                    onClick={() => setIsProfileAvatarPreviewOpen(true)}
                    className="group relative cursor-pointer"
                    aria-label="Ver foto do perfil"
                    title="Ver foto do perfil"
                  >
                    {profileData?.avatarUrl ? (
                      <img
                        src={profileData.avatarUrl}
                        alt={`Avatar de ${profileData.title}`}
                        className={`h-32 w-32 ${avatarFrameLg} object-cover max-[640px]:h-28 max-[640px]:w-28 [@media(max-height:760px)]:h-24 [@media(max-height:760px)]:w-24`}
                      />
                    ) : (
                      <div
                        className={`grid h-32 w-32 place-items-center ${avatarFrameLg} text-lg font-semibold max-[640px]:h-28 max-[640px]:w-28 max-[640px]:text-base [@media(max-height:760px)]:h-24 [@media(max-height:760px)]:w-24 [@media(max-height:760px)]:text-sm ${
                          isDarkTheme ? "bg-slate-900 text-slate-200" : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {profileData?.avatarText ?? "KN"}
                      </div>
                    )}
                    <span
                      className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 ${avatarFrameLg} bg-black/55 px-3 text-center text-[11px] font-semibold text-white opacity-0 transition group-hover:opacity-100 ${
                        isDarkTheme ? "bg-black/60" : "bg-slate-900/65"
                      }`}
                    >
                      <ImageIcon className="h-5 w-5" />
                      <span>Ver foto do perfil</span>
                    </span>
                  </button>
                </div>
                <p className={`text-base font-semibold max-[640px]:text-sm [@media(max-height:760px)]:text-sm ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                  {profileData?.title ?? "Perfil"}
                </p>
                {canEditProfile && profileAvatarNotice ? (
                  <p
                    className={`text-xs ${
                      profileAvatarNotice.toLowerCase().includes("atualizada")
                        ? isDarkTheme
                          ? "text-emerald-300"
                          : "text-emerald-700"
                        : isDarkTheme
                          ? "text-rose-300"
                          : "text-rose-600"
                    }`}
                  >
                    {profileAvatarNotice}
                  </p>
                ) : null}
              </div>
              <div className="space-y-1 px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-sm max-[420px]:space-y-0.5 [@media(max-height:760px)]:space-y-0.5 [@media(max-height:700px)]:space-y-0">
              <button
                type="button"
                disabled={!canEditProfile}
                onClick={canEditProfile ? handleInlineProfileNameEdit : undefined}
                className={`${profileFieldRowClass} text-left ${isDarkTheme ? "text-slate-100" : "text-slate-900"} disabled:cursor-default`}
              >
                <Pencil className={profileFieldIconClass} />
                <span className="min-w-0 flex-1">
                  <span className={profileFieldLabelClass}>Nome</span>
                  <span className={`${profileFieldValueClass} font-semibold`}>
                    {canEditProfile ? profileNameDraft || profileData?.title || "Perfil" : profileData?.title ?? "Perfil"}
                  </span>
                </span>
              </button>
              {canEditProfile ? (
                <div
                  className={`${profileFieldRowClass} ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}
                >
                  <Mail className={profileFieldIconClass} />
                  <span className="min-w-0 flex-1">
                    <span className={profileFieldLabelClass}>E-mail</span>
                    <span className={profileFieldValueClass}>{currentUser?.email ?? "Não informado"}</span>
                  </span>
                </div>
              ) : null}
              <button
                type="button"
                disabled={!canEditProfile}
                onClick={canEditProfile ? handleInlineProfileRecadoEdit : undefined}
                className={`${profileFieldRowClass} text-left ${isDarkTheme ? "text-slate-100" : "text-slate-900"} disabled:cursor-default`}
              >
                <Pencil className={profileFieldIconClass} />
                <span className="min-w-0 flex-1">
                  <span className={profileFieldLabelClass}>Recado</span>
                  <span className={`${profileFieldValueClass} ${isDarkTheme ? "text-slate-300" : "text-slate-700"}`}>
                    {canEditProfile
                      ? profileRecadoDraft || profileData?.recado || "Sem recado"
                      : profileData?.recado ?? "Sem recado"}
                  </span>
                </span>
              </button>
              <div
                className={`${profileFieldRowClass} ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}
              >
                <Phone className={profileFieldIconClass} />
                <span className="min-w-0 flex-1">
                  <span className={profileFieldLabelClass}>Telefone</span>
                  <span className={`${profileFieldValueClass} ${isDarkTheme ? "text-slate-300" : "text-slate-700"}`}>
                    {profileData?.phone ?? "Não informado"}
                  </span>
                </span>
              </div>
              </div>
            </div>
          </aside>
        ) : (
          <aside
            style={chatListWidthStyle}
            className={`relative flex min-h-0 w-full flex-1 flex-col ${settingsBorder} ${conversationPanelFontClass} ${
              isDarkTheme ? "bg-[var(--knex-850)]/60" : "bg-white"
            } md:w-[var(--chat-list-width)] md:rounded-tl-lg md:border-b-0 md:border-l md:border-t md:border-r md:overflow-visible`}
          >
            {isGroupsPanelOpen ? (
              <div className={`flex flex-col gap-4 border-b px-4 py-4 ${settingsBorder}`}>
                {isGroupCreateOpen ? (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsGroupCreateOpen(false)}
                      className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                        isDarkTheme ? "text-blue-200 hover:bg-blue-500/10" : "text-blue-600 hover:bg-blue-50"
                      }`}
                      aria-label="Voltar"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <p className={`text-base font-semibold ${isDarkTheme ? "text-blue-200" : "text-blue-600"}`}>
                      Novo grupo
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <p className={`text-base font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                        Grupos
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsGroupCreateOpen(true)}
                        className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${
                          isDarkTheme
                            ? "border-blue-400/60 text-blue-200 hover:bg-blue-500/10"
                            : "border-blue-500 text-blue-600 hover:bg-blue-50"
                        }`}
                        aria-label="Novo grupo"
                        title="Novo grupo"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsGroupCreateOpen(true)}
                      className="flex items-center gap-3 text-left"
                    >
                      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-600 text-white">
                        <Users2 className="h-5 w-5" />
                      </span>
                      <span className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                        Novo grupo
                      </span>
                    </button>
                  </>
                )}
              </div>
            ) : (
              isDirectoryOpen || isNewChatOpen || isCustomListOpen ? null : (
                <div className={`flex flex-col gap-3 border-b px-0 py-3 md:px-4 ${settingsBorder}`}>
                  <div className="hidden items-center justify-between md:flex">
                    <p
                      className={`text-[1.56rem] font-normal leading-none md:text-[1.08rem] ${
                        isDarkTheme ? "text-slate-100" : "text-slate-900"
                      }`}
                    >
                      Conversas
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className={`hidden h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition md:flex ${
                          isDarkTheme
                            ? "text-blue-300 hover:bg-white/10"
                            : "text-blue-600 hover:bg-blue-50"
                        }`}
                        aria-label="Nova conversa"
                        title="Nova conversa"
                        onClick={openNewConversationPanel}
                      >
                        <MessageCirclePlus className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                          isDarkTheme
                            ? "text-slate-200 hover:bg-white/10"
                            : "text-slate-700 hover:bg-slate-100"
                        }`}
                        aria-label="Mais opções"
                        title="Mais opções"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {isNewChatOpen || isCustomListOpen ? null : (
                    <div className="px-4 md:px-0">
                      <div
                        className={`flex items-center gap-2 rounded-full border px-3 py-[0.45rem] text-[15px] md:py-1.5 md:text-xs ${
                          isDarkTheme
                            ? "border-slate-300/40 bg-slate-700/30 text-slate-200"
                            : "border-slate-400 bg-slate-200 text-slate-700"
                        }`}
                      >
                        <Search className={`${isDarkTheme ? "text-slate-300" : "text-slate-600"} h-4 w-4`} />
                        <input
                          type="text"
                          placeholder="Pesquisar conversas"
                          value={conversationSearch}
                          onChange={(event) => setConversationSearch(event.target.value)}
                          className={`w-full bg-transparent text-[15px] placeholder:font-medium focus:outline-none md:text-xs ${
                            isDarkTheme
                              ? "placeholder:text-slate-400 text-slate-100"
                              : "placeholder:text-slate-500 text-slate-800"
                          }`}
                        />
                      </div>
                      <div
                        ref={conversationFiltersRef}
                        className={`no-scrollbar mt-3 mb-1 hidden min-w-0 flex-nowrap items-center gap-2 overflow-x-auto overflow-y-hidden whitespace-nowrap md:flex md:-mx-4 md:px-4 md:scroll-px-4 ${
                          isConversationFiltersCarousel ? "scroll-smooth touch-pan-x snap-x snap-mandatory" : ""
                        }`}
                        onWheel={(event) => {
                          if (isMobileView) return;
                          const element = event.currentTarget;
                          if (element.scrollWidth <= element.clientWidth) return;
                          if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
                          element.scrollLeft += event.deltaY;
                          event.preventDefault();
                        }}
                        >
                        {conversationFilterOptions.map((filter) => {
                          const isActive = filter.key === activeFilter;
                          return (
                            <button
                              key={`desktop-filter-${filter.key}`}
                              type="button"
                              onClick={() => setActiveFilter(filter.key)}
                              className={`shrink-0 rounded-full px-[clamp(0.72rem,2.4vw,0.98rem)] py-[clamp(0.3rem,1.2vw,0.42rem)] text-[16px] font-semibold leading-none transition md:px-[clamp(0.56rem,2vw,0.78rem)] md:py-[clamp(0.23rem,1vw,0.33rem)] md:text-[clamp(11px,2.6vw,13px)] ${
                                isConversationFiltersCarousel ? "snap-start" : ""
                              } ${
                                isDarkTheme
                                  ? isActive
                                    ? "border border-slate-300/50 bg-white/10 text-slate-100"
                                    : "border border-slate-300/40 text-slate-300 hover:border-slate-300/50 hover:bg-white/5 hover:text-slate-100"
                                  : isActive
                                    ? "border border-slate-300 bg-blue-100 text-blue-800"
                                    : "border border-slate-300 bg-transparent text-slate-600 hover:border-slate-400 hover:bg-slate-100/70"
                              }`}
                            >
                              <span className="block max-w-[9rem] truncate">{filter.label}</span>
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={handleOpenCustomListPanel}
                          className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-[clamp(0.72rem,2.4vw,0.98rem)] py-[clamp(0.3rem,1.2vw,0.42rem)] text-[16px] font-semibold leading-none transition md:px-[clamp(0.56rem,2vw,0.78rem)] md:py-[clamp(0.23rem,1vw,0.33rem)] md:text-[clamp(11px,2.6vw,13px)] ${
                            isConversationFiltersCarousel ? "snap-start" : ""
                          } ${
                            isDarkTheme
                              ? "border border-slate-300/40 text-slate-200 hover:border-slate-300/50 hover:bg-white/5 hover:text-slate-100"
                              : "border border-slate-300 bg-transparent text-slate-600 hover:border-slate-400 hover:bg-slate-100/70"
                          }`}
                          aria-label="Incluir nova lista"
                          title="Incluir nova lista"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Mais</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            )}
            <div
              className={`flex min-h-0 flex-1 flex-col ${
                isNewChatOpen || isCustomListOpen ? "overflow-visible" : isDirectoryOpen ? "overflow-hidden" : "overflow-y-auto"
              } ${isNewChatOpen || isDirectoryOpen || isCustomListOpen ? "px-0 py-0" : "px-0 py-2"}`}
            >
              {isGroupsPanelOpen || isDirectoryOpen || isNewChatOpen || isCustomListOpen ? null : (
                <div
                  className={`no-scrollbar mb-2 shrink-0 flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto overflow-y-hidden whitespace-nowrap px-4 scroll-px-4 md:hidden ${
                    isConversationFiltersCarousel ? "scroll-smooth touch-pan-x snap-x snap-mandatory" : ""
                  }`}
                  onWheel={(event) => {
                    if (isMobileView) return;
                    const element = event.currentTarget;
                    if (element.scrollWidth <= element.clientWidth) return;
                    if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
                    element.scrollLeft += event.deltaY;
                    event.preventDefault();
                  }}
                >
                  {conversationFilterOptions.map((filter) => {
                    const isActive = filter.key === activeFilter;
                    return (
                      <button
                        key={filter.key}
                        type="button"
                        onClick={() => setActiveFilter(filter.key)}
                        className={`shrink-0 rounded-full px-[clamp(0.72rem,2.4vw,0.98rem)] py-[clamp(0.3rem,1.2vw,0.42rem)] text-[16px] font-semibold leading-none transition md:px-[clamp(0.56rem,2vw,0.78rem)] md:py-[clamp(0.23rem,1vw,0.33rem)] md:text-[clamp(11px,2.6vw,13px)] ${
                          isConversationFiltersCarousel ? "snap-start" : ""
                        } ${
                          isDarkTheme
                            ? isActive
                              ? "border border-slate-300/50 bg-white/10 text-slate-100"
                              : "border border-slate-300/40 text-slate-300 hover:border-slate-300/50 hover:bg-white/5 hover:text-slate-100"
                            : isActive
                              ? "border border-slate-300 bg-blue-100 text-blue-800"
                              : "border border-slate-300 bg-transparent text-slate-600 hover:border-slate-400 hover:bg-slate-100/70"
                        }`}
                      >
                        <span className="block max-w-[9rem] truncate">{filter.label}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={handleOpenCustomListPanel}
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-[clamp(0.72rem,2.4vw,0.98rem)] py-[clamp(0.3rem,1.2vw,0.42rem)] text-[16px] font-semibold leading-none transition md:px-[clamp(0.56rem,2vw,0.78rem)] md:py-[clamp(0.23rem,1vw,0.33rem)] md:text-[clamp(11px,2.6vw,13px)] ${
                      isConversationFiltersCarousel ? "snap-start" : ""
                    } ${
                      isDarkTheme
                        ? "border border-slate-300/40 text-slate-200 hover:border-slate-300/50 hover:bg-white/5 hover:text-slate-100"
                        : "border border-slate-300 bg-transparent text-slate-600 hover:border-slate-400 hover:bg-slate-100/70"
                    }`}
                    aria-label="Incluir nova lista"
                    title="Incluir nova lista"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Mais</span>
                  </button>
                </div>
              )}
              {isGroupsPanelOpen ? (
                isGroupCreateOpen ? (
                  <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-10 text-center">
                    <div className="relative">
                      <div
                        className={`grid h-32 w-32 place-items-center rounded-full border-2 ${
                          isDarkTheme ? "border-blue-400/40 bg-blue-500/10" : "border-blue-300 bg-blue-50"
                        }`}
                      >
                        <div
                          className={`grid h-16 w-12 place-items-center rounded-2xl border ${
                            isDarkTheme ? "border-blue-400/60 bg-[#0f1012]" : "border-blue-300 bg-white"
                          }`}
                        >
                          <div className="flex flex-col gap-1">
                            <span className="h-1 w-8 rounded-full bg-blue-500/70" />
                            <span className="h-1 w-8 rounded-full bg-blue-500/70" />
                            <span className="h-1 w-6 rounded-full bg-blue-500/70" />
                          </div>
                        </div>
                      </div>
                      <div
                        className={`absolute -bottom-1 -right-1 grid h-10 w-10 place-items-center rounded-full ${
                          isDarkTheme ? "bg-blue-500 text-white" : "bg-blue-600 text-white"
                        }`}
                      >
                        <span className="flex items-center justify-center gap-0.5">
                          <Users2 className="h-4 w-4" />
                          <Plus className="h-3 w-3 stroke-[2.5]" />
                        </span>
                      </div>
                    </div>
                    <p className={`mt-6 text-lg font-semibold ${isDarkTheme ? "text-blue-200" : "text-blue-700"}`}>
                      Criar grupo
                    </p>
                    <p className={`mt-2 max-w-xs text-xs ${settingsMuted}`}>
                      Reúna pessoas para conversar em um só lugar. Crie grupos para organizar temas e compartilhar avisos.
                    </p>
                    <button
                      type="button"
                      className={`mt-4 text-xs font-semibold ${
                        isDarkTheme ? "text-blue-200" : "text-blue-600"
                      }`}
                    >
                      Exemplos de grupos
                    </button>
                    <button
                      type="button"
                      className={`mt-8 rounded-full px-6 py-2 text-sm font-semibold text-white transition ${
                        isDarkTheme ? "bg-blue-500 hover:bg-blue-400" : "bg-blue-600 hover:bg-blue-500"
                      }`}
                    >
                      Começar
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(isGroupsExpanded ? groups : groups.slice(0, 2)).map((group) => (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => {
                          setActiveFilter("groups");
                          openThreadById(group.id);
                        }}
                        className={`flex w-full items-center justify-between rounded-2xl px-2 py-2 text-left transition ${
                          isDarkTheme ? "hover:bg-white/5" : "hover:bg-slate-100/70"
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          {group.avatarUrl ? (
                            <img
                              src={group.avatarUrl}
                              alt={`Avatar de ${group.title}`}
                              className={`h-11 w-11 ${avatarFrameMd} object-cover`}
                            />
                          ) : (
                            <div
                              className={`grid h-11 w-11 place-items-center ${avatarFrameMd} text-xs font-semibold ${
                                isDarkTheme ? "bg-slate-900 text-slate-200" : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {getAvatarText(group.title)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className={`truncate text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                              {group.title}
                            </p>
                            <p className={`truncate text-xs ${settingsMuted}`}>{group.preview}</p>
                          </div>
                        </div>
                        <span className={`text-[11px] ${settingsMuted}`}>{group.lastActivity}</span>
                      </button>
                    ))}
                    {groups.length > 2 ? (
                      <button
                        type="button"
                        onClick={() => setIsGroupsExpanded((prev) => !prev)}
                        className="px-1 text-sm font-semibold text-blue-600"
                      >
                        {isGroupsExpanded ? "Ver menos" : "Ver todos"}
                      </button>
                    ) : null}
                  </div>
                )
              ) : isDirectoryOpen ? (
                <div className={`flex min-h-0 flex-1 flex-col ${isDarkTheme ? "bg-[#0f1012]/40" : "bg-white"}`}>
                  <div className={`flex items-center justify-between border-b px-4 py-3 ${settingsBorder}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsDirectoryOpen(false);
                        setDirectorySearch("");
                        setIsDirectoryFiltersOpen(false);
                        setActiveNavKey("conversations");
                      }}
                      className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                        isDarkTheme ? "text-slate-200 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"
                      }`}
                      aria-label="Voltar"
                    >
                      <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
                    </button>
                    <p className={`text-base font-semibold md:text-[1.2rem] ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                      Diretório de pessoas
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsDirectoryFiltersOpen((prev) => !prev)}
                      className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                        isDarkTheme ? "text-blue-200 hover:bg-blue-500/10" : "text-blue-600 hover:bg-blue-50"
                      }`}
                      aria-label="Filtros"
                      title="Filtros"
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                    </button>
                  </div>
                  <div className={`border-b px-4 py-3 ${settingsBorder}`}>
                    <div
                      className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs ${
                        isDarkTheme
                          ? "border-slate-200/80 text-slate-200"
                          : "border-blue-400 text-slate-600"
                      }`}
                    >
                      <Search className={`${isDarkTheme ? "text-blue-300" : "text-blue-600"} h-4 w-4`} />
                      <input
                        type="text"
                        value={directorySearch}
                        onChange={(event) => setDirectorySearch(event.target.value)}
                        placeholder="Buscar por nome, Knex ID ou contexto"
                        className={`w-full bg-transparent text-xs focus:outline-none ${
                          isDarkTheme
                            ? "placeholder:text-slate-400 text-slate-100"
                            : "placeholder:text-slate-400 text-slate-700"
                        }`}
                      />
                    </div>
                    {isDirectoryFiltersOpen ? (
                      <div
                        ref={directoryFiltersRef}
                        className={`mt-3 flex flex-wrap gap-2 ${
                          isDirectoryFiltersCarousel
                            ? "no-scrollbar flex-nowrap items-center overflow-x-auto overflow-y-hidden scroll-smooth touch-pan-x snap-x snap-mandatory"
                            : ""
                        }`}
                      >
                        {DIRECTORY_FILTERS.map((filter) => {
                          const isActive = filter.key === directoryFilter;
                          return (
                            <button
                              key={filter.key}
                              type="button"
                              onClick={() => setDirectoryFilter(filter.key)}
                              className={`shrink-0 rounded-full border px-[clamp(0.5rem,2vw,0.7rem)] py-[clamp(0.24rem,1vw,0.34rem)] text-[clamp(10px,2.6vw,12px)] font-semibold leading-none transition ${
                                isDirectoryFiltersCarousel ? "snap-start" : ""
                              } ${
                                isDarkTheme
                                  ? isActive
                                    ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-100"
                                    : "border-[var(--knex-700)] text-slate-300 hover:border-emerald-400/50 hover:text-emerald-100"
                                  : isActive
                                    ? "border-blue-200 bg-blue-100 text-blue-800"
                                    : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                              }`}
                              title={filter.hint}
                            >
                              {filter.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {DIRECTORY_TABS.map((tab) => {
                        const isActive = tab.key === directoryTab;
                        return (
                          <button
                            key={tab.key}
                            type="button"
                            onClick={() => setDirectoryTab(tab.key)}
                            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
                              isDarkTheme
                                ? isActive
                                  ? "bg-blue-500/30 text-blue-100"
                                  : "border border-[var(--knex-700)] text-slate-300 hover:border-blue-400/50 hover:text-blue-100"
                                : isActive
                                  ? "border border-blue-200 bg-blue-100 text-blue-800"
                                  : "border border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                            }`}
                          >
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
                    {directoryTab === "people" ? (
                      <div className="-mx-4 space-y-0">
                        <p className={`px-4 text-sm font-semibold md:text-base ${settingsMuted}`}>Diretório visível</p>
                        {filteredDirectoryPeople.length ? (
                          filteredDirectoryPeople.map((person) => {
                            const request = contactRequestByEmail.get(person.email);
                            const contactThread = contactByEmail.get(person.email);
                            const isContact = contactEmailSet.has(person.email);
                            const isPersonActive = Boolean(contactThread && contactThread.id === activeThread?.id);
                            const isOutgoingPending =
                              request?.status === "pending" && request.direction === "outgoing";
                            const isIncomingPending =
                              request?.status === "pending" && request.direction === "incoming";
                            return (
                              <div
                                key={person.email}
                                className={`flex items-center justify-between gap-3 px-4 py-[0.4rem] transition ${
                                  isPersonActive
                                    ? isDarkTheme
                                      ? "bg-white/10"
                                      : "bg-slate-200"
                                    : isDarkTheme
                                      ? "hover:bg-white/5"
                                      : "hover:bg-slate-100"
                                }`}
                              >
                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                  {person.avatarUrl ? (
                                    <img
                                      src={person.avatarUrl}
                                      alt={`Avatar de ${person.name}`}
                                      className={`h-11 w-11 shrink-0 ${avatarFrameMd} object-cover`}
                                    />
                                  ) : (
                                    <div
                                      className={`grid h-11 w-11 place-items-center ${avatarFrameMd} text-xs font-semibold ${
                                        isDarkTheme ? "bg-slate-900 text-slate-200" : "bg-slate-100 text-slate-700"
                                      }`}
                                    >
                                      {getAvatarText(person.name)}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p
                                      className={`truncate text-base font-normal md:text-[19px] md:leading-tight ${
                                        isDarkTheme ? "text-slate-100" : "text-slate-900"
                                      }`}
                                    >
                                      {person.name}
                                      {person.isSelf ? " (você)" : ""}
                                    </p>
                                    <p className={`truncate text-[11px] ${settingsMuted}`}>
                                      {person.knexId} • {maskEmail(person.email)}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 md:w-[10.5rem] md:shrink-0 md:justify-end">
                                  {person.isSelf ? (
                                    <span
                                      className={`inline-flex h-9 min-w-[9.5rem] items-center justify-center whitespace-nowrap rounded-xl px-3 text-sm font-medium leading-none md:w-full md:min-w-0 ${
                                        isDarkTheme ? "bg-white/10 text-slate-200" : "bg-slate-100 text-slate-600"
                                      }`}
                                    >
                                      Você
                                    </span>
                                  ) : isContact && contactThread ? (
                                    <button
                                      type="button"
                                      onClick={() => openContactThread(contactThread.id)}
                                      className={`inline-flex h-9 min-w-[9.5rem] items-center justify-center whitespace-nowrap rounded-xl px-3 text-sm font-medium leading-none transition md:w-full md:min-w-0 ${
                                        isDarkTheme
                                          ? "bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
                                          : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                      }`}
                                    >
                                      Abrir conversa
                                    </button>
                                  ) : isOutgoingPending ? (
                                    <button
                                      type="button"
                                      onClick={() => handleCancelOutgoingContactRequest(person.email)}
                                      className={`inline-flex h-9 min-w-[9.5rem] items-center justify-center whitespace-nowrap rounded-xl px-3 text-sm font-medium leading-none transition md:w-full md:min-w-0 ${
                                        isDarkTheme
                                          ? "bg-slate-700 text-slate-100 hover:bg-slate-600"
                                          : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                      }`}
                                    >
                                      Cancelar pedido
                                    </button>
                                  ) : isIncomingPending ? (
                                    <div className="flex items-center gap-1 md:w-full md:flex-col md:items-stretch">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleAcceptContactRequest(person.email, person.name, person.avatarUrl ?? null)
                                        }
                                        className={`inline-flex h-9 min-w-[7.25rem] items-center justify-center whitespace-nowrap rounded-xl px-3 text-sm font-medium leading-none transition md:w-full md:min-w-0 ${
                                          isDarkTheme
                                            ? "bg-blue-500 text-slate-100 hover:bg-blue-400"
                                            : "bg-blue-600 text-white hover:bg-blue-700"
                                        }`}
                                      >
                                        Aceitar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleRejectContactRequest(person.email, "rejected")}
                                        className={`inline-flex h-9 min-w-[7.25rem] items-center justify-center whitespace-nowrap rounded-xl px-3 text-sm font-medium leading-none transition md:w-full md:min-w-0 ${
                                          isDarkTheme
                                            ? "bg-white/10 text-slate-200 hover:bg-white/20"
                                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                        }`}
                                      >
                                        Recusar
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleSendContactRequest(person.email, person.name)}
                                      className={`inline-flex h-9 min-w-[9.5rem] items-center justify-center whitespace-nowrap rounded-xl px-3 text-base font-medium leading-none transition md:w-full md:min-w-0 ${
                                        isDarkTheme
                                          ? "bg-blue-500 text-slate-100 hover:bg-blue-400"
                                          : "bg-blue-600 text-white hover:bg-blue-700"
                                      }`}
                                    >
                                      Solicitar contato
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <p className={`mt-3 text-xs ${settingsMuted}`}>Nenhuma pessoa encontrada.</p>
                        )}
                      </div>
                    ) : directoryTab === "contacts" ? (
                      <div className="-mx-4 space-y-0">
                        <p className={`px-4 text-[11px] font-semibold ${settingsMuted}`}>Meus contatos</p>
                        {contacts.length ? (
                          contacts.map((contact) => {
                            const isContactActive = contact.id === activeThread?.id;
                            const normalizedContactEmail = normalizeEmail(contact.contactEmail ?? "");
                            const fallbackContactAvatar =
                              normalizedContactEmail && isValidEmail(normalizedContactEmail)
                                ? contactNameByEmail.get(normalizedContactEmail)?.avatarUrl ?? null
                                : null;
                            const contactAvatarUrl = resolveThreadAvatarUrl(contact) ?? fallbackContactAvatar;
                            return (
                              <button
                                key={contact.id}
                                type="button"
                                onClick={() => openContactThread(contact.id)}
                                className={`flex w-full items-center justify-between px-4 py-[0.4rem] text-left transition ${
                                  isContactActive
                                    ? isDarkTheme
                                      ? "bg-white/10"
                                      : "bg-slate-200"
                                    : isDarkTheme
                                      ? "hover:bg-white/5"
                                      : "hover:bg-slate-100"
                                }`}
                              >
                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                  {contactAvatarUrl ? (
                                    <img
                                      src={contactAvatarUrl}
                                      alt={`Avatar de ${contact.title}`}
                                      className={`h-11 w-11 shrink-0 ${avatarFrameMd} object-cover`}
                                    />
                                  ) : (
                                    <div
                                      className={`grid h-11 w-11 shrink-0 place-items-center ${avatarFrameMd} text-xs font-semibold ${
                                        isDarkTheme ? "bg-slate-900 text-slate-200" : "bg-slate-100 text-slate-700"
                                      }`}
                                    >
                                      {getAvatarText(contact.title)}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p
                                      className={`truncate text-base font-semibold md:text-[19px] md:leading-tight ${
                                        isDarkTheme ? "text-slate-100" : "text-slate-900"
                                      }`}
                                    >
                                      {contact.title}
                                    </p>
                                    <p className={`truncate text-[11px] ${settingsMuted}`}>
                                      {contact.contactEmail ? maskEmail(contact.contactEmail) : contact.preview}
                                    </p>
                                  </div>
                                </div>
                                <span className={`shrink-0 text-[11px] ${settingsMuted}`}>Conectado</span>
                              </button>
                            );
                          })
                        ) : (
                          <p className={`mt-3 text-xs ${settingsMuted}`}>Nenhum contato aceito ainda.</p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-2 md:justify-center">
                          <button
                            type="button"
                            onClick={() => setDirectoryRequestsTab("incoming")}
                            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
                              isDarkTheme
                                ? directoryRequestsTab === "incoming"
                                  ? "bg-blue-500/30 text-blue-100"
                                  : "border border-[var(--knex-700)] text-slate-300 hover:border-blue-400/50 hover:text-blue-100"
                                : directoryRequestsTab === "incoming"
                                  ? "border border-blue-200 bg-blue-100 text-blue-800"
                                  : "border border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                            }`}
                          >
                            Solicitações recebidas
                          </button>
                          <button
                            type="button"
                            onClick={() => setDirectoryRequestsTab("outgoing")}
                            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
                              isDarkTheme
                                ? directoryRequestsTab === "outgoing"
                                  ? "bg-blue-500/30 text-blue-100"
                                  : "border border-[var(--knex-700)] text-slate-300 hover:border-blue-400/50 hover:text-blue-100"
                                : directoryRequestsTab === "outgoing"
                                  ? "border border-blue-200 bg-blue-100 text-blue-800"
                                  : "border border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                            }`}
                          >
                            Solicitações enviadas
                          </button>
                        </div>
                        {directoryRequestsTab === "incoming" ? (
                          <div className="-mx-4">
                            {incomingRequests.length ? (
                              incomingRequests.map((request) => {
                                const requestDisplayName = request.name ?? formatNameFromEmail(request.email);
                                const requestAvatarUrl =
                                  request.avatarUrl ??
                                  contactNameByEmail.get(normalizeEmail(request.email))?.avatarUrl ??
                                  null;
                                return (
                                  <div
                                    key={request.id}
                                    className={`flex items-center justify-between gap-3 px-4 py-[0.4rem] transition ${
                                      isDarkTheme ? "hover:bg-white/5" : "hover:bg-slate-100"
                                    }`}
                                  >
                                    <div className="flex min-w-0 flex-1 items-center gap-3">
                                      {requestAvatarUrl ? (
                                        <img
                                          src={requestAvatarUrl}
                                          alt={`Avatar de ${requestDisplayName}`}
                                          className={`h-10 w-10 ${avatarFrameSm} object-cover`}
                                        />
                                      ) : (
                                        <div
                                          className={`grid h-10 w-10 place-items-center ${avatarFrameSm} text-xs font-semibold ${
                                            isDarkTheme ? "bg-slate-900 text-slate-200" : "bg-slate-100 text-slate-700"
                                          }`}
                                        >
                                          {getAvatarText(requestDisplayName)}
                                        </div>
                                      )}
                                      <div className="min-w-0 flex-1">
                                        <p
                                          className={`truncate text-base font-normal md:text-[19px] md:font-semibold md:leading-tight ${
                                            isDarkTheme ? "text-slate-100" : "text-slate-900"
                                          }`}
                                        >
                                          {requestDisplayName}
                                        </p>
                                        <p className={`truncate text-[11px] ${settingsMuted}`}>
                                          {getKnexIdFromEmail(request.email)} • {maskEmail(request.email)}
                                        </p>
                                      </div>
                                    </div>
                                    {request.status === "pending" ? (
                                      <div className="flex items-center gap-1 md:shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            handleAcceptContactRequest(request.email, request.name, requestAvatarUrl);
                                            setDirectoryTab("contacts");
                                          }}
                                          className={`inline-flex h-9 min-w-[7.25rem] items-center justify-center whitespace-nowrap rounded-xl px-3 text-sm font-medium leading-none transition ${
                                            isDarkTheme
                                              ? "bg-blue-500 text-slate-100 hover:bg-blue-400"
                                              : "bg-blue-600 text-white hover:bg-blue-700"
                                          }`}
                                        >
                                          Aceitar
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleRejectContactRequest(request.email, "rejected")}
                                          className={`inline-flex h-9 min-w-[7.25rem] items-center justify-center whitespace-nowrap rounded-xl px-3 text-sm font-medium leading-none transition ${
                                            isDarkTheme
                                              ? "bg-white/10 text-slate-200 hover:bg-white/20"
                                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                          }`}
                                        >
                                          Excluir
                                        </button>
                                      </div>
                                    ) : (
                                      <span className={`md:w-[10.5rem] md:shrink-0 md:text-center text-[11px] ${settingsMuted}`}>
                                        {request.status}
                                      </span>
                                    )}
                                  </div>
                                );
                              })
                            ) : (
                              <p className={`px-4 py-10 text-center text-xs ${settingsMuted}`}>Nenhuma solicitação recebida.</p>
                            )}
                          </div>
                        ) : (
                          <div className="-mx-4">
                            {outgoingRequests.length ? (
                              outgoingRequests.map((request) => {
                                const requestDisplayName = request.name ?? formatNameFromEmail(request.email);
                                const requestAvatarUrl =
                                  request.avatarUrl ??
                                  contactNameByEmail.get(normalizeEmail(request.email))?.avatarUrl ??
                                  null;
                                return (
                                  <div
                                    key={request.id}
                                    className={`flex items-center justify-between gap-3 px-4 py-[0.4rem] transition ${
                                      isDarkTheme ? "hover:bg-white/5" : "hover:bg-slate-100"
                                    }`}
                                  >
                                    <div className="flex min-w-0 flex-1 items-center gap-3">
                                      {requestAvatarUrl ? (
                                        <img
                                          src={requestAvatarUrl}
                                          alt={`Avatar de ${requestDisplayName}`}
                                          className={`h-10 w-10 ${avatarFrameSm} object-cover`}
                                        />
                                      ) : (
                                        <div
                                          className={`grid h-10 w-10 place-items-center ${avatarFrameSm} text-xs font-semibold ${
                                            isDarkTheme ? "bg-slate-900 text-slate-200" : "bg-slate-100 text-slate-700"
                                          }`}
                                        >
                                          {getAvatarText(requestDisplayName)}
                                        </div>
                                      )}
                                      <div className="min-w-0 flex-1">
                                        <p
                                          className={`truncate text-base font-normal md:text-[19px] md:font-semibold md:leading-tight ${
                                            isDarkTheme ? "text-slate-100" : "text-slate-900"
                                          }`}
                                        >
                                          {requestDisplayName}
                                        </p>
                                        <p className={`truncate text-[11px] ${settingsMuted}`}>
                                          {getKnexIdFromEmail(request.email)} • {maskEmail(request.email)}
                                        </p>
                                      </div>
                                    </div>
                                    <span
                                      className={`inline-flex h-9 min-w-[8.25rem] items-center justify-center whitespace-nowrap rounded-xl px-3 text-sm font-medium leading-none md:w-[10.5rem] md:min-w-0 md:shrink-0 ${
                                        request.status === "pending"
                                          ? isDarkTheme
                                            ? "bg-blue-500 text-slate-100"
                                            : "bg-blue-600 text-white"
                                          : isDarkTheme
                                            ? "bg-white/10 text-slate-200"
                                            : "bg-slate-100 text-slate-600"
                                      }`}
                                    >
                                      {request.status === "pending" ? "Aguardando" : request.status}
                                    </span>
                                  </div>
                                );
                              })
                            ) : (
                              <p className={`px-4 py-10 text-center text-xs ${settingsMuted}`}>Nenhuma solicitação enviada.</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : isCustomListOpen ? (
                <div
                  className={`absolute inset-0 z-20 flex h-full min-h-0 flex-col overflow-hidden ${
                    isDarkTheme ? "bg-[#0f1012]/40" : "bg-white"
                  } lg:rounded-tl-md`}
                >
                  <div className="px-4 pt-2 lg:hidden">
                    <span
                      className={`mx-auto block h-1 w-16 rounded-full ${
                        isDarkTheme ? "bg-white/25" : "bg-slate-300"
                      }`}
                    />
                  </div>
                  <div className={`flex items-center justify-between border-b px-4 py-3 ${settingsBorder}`}>
                    {customListStep === "members" ? (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomListStep("name");
                          setCustomListSearch("");
                        }}
                        className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                          isDarkTheme ? "text-slate-200 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"
                        }`}
                        aria-label="Voltar para edição da lista"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleCloseCustomListPanel}
                        className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                          isDarkTheme ? "text-slate-200 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"
                        }`}
                        aria-label="Fechar nova lista"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    )}
                    <p className={`text-base font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                      {customListStep === "members" ? "Adicione pessoas ou grupos" : "Nova lista"}
                    </p>
                    <span className="h-8 w-8" aria-hidden="true" />
                  </div>
                  {customListStep === "members" ? (
                    <>
                      <div className={`border-b px-4 py-3 ${settingsBorder}`}>
                        <div
                          className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs md:text-[15px] ${
                            isDarkTheme
                              ? "border-blue-400/60 text-slate-200"
                              : "border-blue-400 text-slate-600"
                          }`}
                        >
                          <Search className={`${isDarkTheme ? "text-blue-300" : "text-blue-600"} h-4 w-4`} />
                          <input
                            type="text"
                            placeholder="Pesquisar pessoas ou grupos"
                            value={customListSearch}
                            onChange={(event) => setCustomListSearch(event.target.value)}
                            className={`w-full bg-transparent text-xs md:text-[15px] focus:outline-none ${
                              isDarkTheme
                                ? "placeholder:text-slate-400 text-slate-100"
                                : "placeholder:text-slate-400 text-slate-700"
                            }`}
                          />
                        </div>
                      </div>
                      {selectedCustomListThreads.length ? (
                        <div className={`flex flex-wrap gap-2 border-b px-4 py-3 ${settingsBorder}`}>
                          {selectedCustomListThreads.map((thread) => (
                            <button
                              key={`custom-list-chip-${thread.id}`}
                              type="button"
                              onClick={() => handleToggleCustomListThread(thread.id)}
                              className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-1 text-[11px] ${
                                isDarkTheme
                                  ? "border-blue-300/40 bg-blue-500/10 text-blue-100"
                                  : "border-blue-200 bg-blue-50 text-blue-700"
                              }`}
                            >
                              <span className="truncate">{thread.title}</span>
                              <X className="h-3 w-3" />
                            </button>
                          ))}
                        </div>
                      ) : null}
                      <div className="flex-1 overflow-y-auto px-4 py-4">
                        <p className={`text-xs font-semibold ${settingsMuted}`}>Sugestões para a lista</p>
                        <div className="mt-3 space-y-2">
                          {filteredCustomListCandidates.length ? (
                            filteredCustomListCandidates.map((thread) => {
                              const isSelected = selectedCustomListThreadIds.includes(thread.id);
                              const threadAvatarUrl = resolveThreadAvatarUrl(thread);
                              return (
                                <button
                                  key={`custom-list-option-${thread.id}`}
                                  type="button"
                                  onClick={() => handleToggleCustomListThread(thread.id)}
                                  className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-left transition ${
                                    isSelected
                                      ? isDarkTheme
                                        ? "border-blue-300/60 bg-blue-500/15"
                                        : "border-blue-300 bg-blue-50"
                                      : isDarkTheme
                                        ? "border-white/10 hover:border-white/20 hover:bg-white/5"
                                        : "border-slate-200 hover:bg-slate-50"
                                  }`}
                                >
                                  <div className="flex min-w-0 items-center gap-3">
                                    {threadAvatarUrl ? (
                                      <img
                                        src={threadAvatarUrl}
                                        alt={`Avatar de ${thread.title}`}
                                        className={`h-10 w-10 shrink-0 ${avatarFrameSm} object-cover`}
                                      />
                                    ) : (
                                      <div
                                        className={`grid h-10 w-10 shrink-0 place-items-center ${avatarFrameSm} text-xs font-semibold ${
                                          isDarkTheme ? "bg-slate-900 text-slate-200" : "bg-slate-100 text-slate-700"
                                        }`}
                                      >
                                        {getAvatarText(thread.title)}
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <p
                                        className={`truncate text-sm font-semibold ${
                                          isDarkTheme ? "text-slate-100" : "text-slate-900"
                                        }`}
                                      >
                                        {thread.title}
                                      </p>
                                      <p className={`truncate text-[11px] ${settingsMuted}`}>
                                        {thread.preview}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-2">
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                        thread.tab === "groups"
                                          ? isDarkTheme
                                            ? "bg-violet-500/20 text-violet-100"
                                            : "bg-violet-50 text-violet-700"
                                          : isDarkTheme
                                            ? "bg-emerald-500/20 text-emerald-100"
                                            : "bg-emerald-50 text-emerald-700"
                                      }`}
                                    >
                                      {thread.tab === "groups" ? "Grupo" : "Pessoa"}
                                    </span>
                                    <span
                                      className={`grid h-5 w-5 place-items-center rounded border ${
                                        isSelected
                                          ? isDarkTheme
                                            ? "border-blue-300 bg-blue-500 text-white"
                                            : "border-blue-500 bg-blue-600 text-white"
                                          : isDarkTheme
                                            ? "border-white/20 text-transparent"
                                            : "border-slate-300 text-transparent"
                                      }`}
                                    >
                                      <Check className="h-3.5 w-3.5" />
                                    </span>
                                  </div>
                                </button>
                              );
                            })
                          ) : (
                            <p className={`text-xs ${settingsMuted}`}>Nenhuma pessoa ou grupo encontrado.</p>
                          )}
                        </div>
                      </div>
                      <div className={`mt-auto border-t px-4 pb-[calc(env(safe-area-inset-bottom)+0.9rem)] pt-3 ${settingsBorder}`}>
                        <button
                          type="button"
                          onClick={handleSaveCustomList}
                          disabled={!selectedCustomListThreadIds.length}
                          className={`w-full rounded-full px-4 py-3 text-sm font-semibold transition ${
                            selectedCustomListThreadIds.length
                              ? isDarkTheme
                                ? "bg-blue-500 text-white hover:bg-blue-400"
                                : "bg-blue-600 text-white hover:bg-blue-700"
                              : isDarkTheme
                                ? "bg-[#2a2a2a] text-slate-500"
                                : "bg-slate-200 text-slate-400"
                          }`}
                        >
                          Salvar lista
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="px-4 py-6">
                        <label className={`text-sm ${settingsMuted}`} htmlFor="custom-list-name-input">
                          Nome da lista
                        </label>
                        <div className={`mt-2 flex items-center gap-2 border-b pb-2 ${isDarkTheme ? "border-slate-200/80" : "border-blue-500"}`}>
                          <input
                            id="custom-list-name-input"
                            type="text"
                            value={newCustomListName}
                            onChange={(event) => {
                              setNewCustomListName(event.target.value);
                              if (customListError) setCustomListError(null);
                            }}
                            placeholder="Exemplo: Trabalho, Amigos"
                            className={`w-full bg-transparent text-lg font-medium leading-tight focus:outline-none sm:text-xl ${
                              isDarkTheme
                                ? "placeholder:text-slate-500 text-slate-100"
                                : "placeholder:text-slate-400 text-slate-700"
                            }`}
                          />
                          <Smile className={`h-5 w-5 shrink-0 ${settingsMuted}`} />
                        </div>
                        {customListError ? <p className="mt-2 text-xs text-rose-500">{customListError}</p> : null}
                        <p className={`mt-6 max-w-md text-sm ${settingsMuted}`}>
                          As listas que você cria viram um filtro na parte de cima da aba Conversas.
                        </p>
                      </div>
                      <div
                        className={`mt-auto flex justify-center border-t px-4 pb-[calc(env(safe-area-inset-bottom)+0.9rem)] pt-3 ${settingsBorder}`}
                      >
                        <button
                          type="button"
                          onClick={handleContinueCustomListMembers}
                          className={`inline-flex min-w-[13rem] items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold leading-none transition ${
                            isDarkTheme
                              ? "border-slate-200/80 bg-white/10 text-slate-100 hover:bg-white/15"
                              : "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
                          }`}
                        >
                          Adicione pessoas ou grupos
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : isNewChatOpen ? (
                <div
                  className={`absolute inset-0 z-20 flex h-full min-h-0 flex-col overflow-hidden ${
                    isDarkTheme ? "bg-[#0f1012]/40" : "bg-white"
                  } lg:rounded-tl-md`}
                >
                  <div className={`flex items-center justify-between border-b px-4 py-3 ${settingsBorder}`}>
                  <button
                    type="button"
                      onClick={() => {
                        if (isNewGroupCreateOpen) {
                          setIsNewGroupCreateOpen(false);
                        } else if (isNewChatEmailOpen) {
                          setIsNewChatEmailOpen(false);
                        } else if (isNewGroupOpen) {
                          setIsNewGroupOpen(false);
                          setSelectedGroupMemberIds([]);
                        } else if (isCommunityListOpen) {
                          setIsCommunityListOpen(false);
                        } else if (isNewContactOpen) {
                          setIsNewContactOpen(false);
                        } else {
                          setIsNewChatOpen(false);
                          setIsNewChatEmailOpen(false);
                          setIsNewGroupOpen(false);
                          setIsNewGroupCreateOpen(false);
                          setIsCommunityListOpen(false);
                          setIsNewContactOpen(false);
                        }
                      }}
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                          isDarkTheme ? "text-slate-200 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"
                        }`}
                        aria-label="Voltar"
                    >
                      <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
                    </button>
                    <p
                      className={`font-semibold ${
                        isNewGroupCreateOpen || isNewGroupOpen || isNewChatEmailOpen || isCommunityListOpen || isNewContactOpen
                          ? "text-sm md:text-base"
                          : "text-base md:text-[1.2rem]"
                      } ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}
                    >
                      {isNewGroupCreateOpen
                        ? "Novo grupo"
                        : isNewGroupOpen
                          ? "Adicionar pessoas ao grupo"
                          : isNewChatEmailOpen
                            ? "E-mail"
                            : isCommunityListOpen
                              ? "Comunidades"
                              : isNewContactOpen
                                ? "Novo contato"
                                : "Nova conversa"}
                    </p>
                    {isNewGroupCreateOpen ? (
                      <span className="h-8 w-8" aria-hidden="true" />
                    ) : isCommunityListOpen ? (
                      <button
                        type="button"
                        className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${
                          isDarkTheme
                            ? "border-blue-400/60 text-blue-200 hover:bg-blue-500/10"
                            : "border-blue-500 text-blue-600 hover:bg-blue-50"
                        }`}
                        aria-label="Nova comunidade"
                        title="Nova comunidade"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    ) : isNewGroupOpen || isNewChatEmailOpen ? (
                      <span className="h-8 w-8" aria-hidden="true" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsNewChatEmailOpen(true)}
                        className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                          isDarkTheme ? "text-slate-200 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"
                        }`}
                        aria-label="Opções"
                      >
                        <span className="grid grid-cols-3 gap-[2px]" aria-hidden="true">
                          <span className="h-[2.5px] w-[2.5px] rounded-full bg-current" />
                          <span className="h-[2.5px] w-[2.5px] rounded-full bg-current" />
                          <span className="h-[2.5px] w-[2.5px] rounded-full bg-current" />
                          <span className="h-[2.5px] w-[2.5px] rounded-full bg-current" />
                          <span className="h-[2.5px] w-[2.5px] rounded-full bg-current" />
                          <span className="h-[2.5px] w-[2.5px] rounded-full bg-current" />
                          <span className="h-[2.5px] w-[2.5px] rounded-full bg-current" />
                          <span className="h-[2.5px] w-[2.5px] rounded-full bg-current" />
                          <span className="h-[2.5px] w-[2.5px] rounded-full bg-current" />
                        </span>
                      </button>
                    )}
                  </div>
                  {isNewGroupCreateOpen ? (
                    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-10 text-center">
                      <div className="relative">
                        {isGroupImageMenuOpen ? (
                          <button
                            type="button"
                            aria-label="Fechar menu de imagem"
                            className="fixed inset-0 z-10 cursor-default"
                            onClick={() => setIsGroupImageMenuOpen(false)}
                          />
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setIsGroupImageMenuOpen((prev) => !prev)}
                          className={`relative flex h-28 w-28 flex-col items-center justify-center gap-1 ${avatarFrameLg} ${
                            isDarkTheme ? "bg-slate-700 text-slate-100" : "bg-slate-300 text-slate-800"
                          }`}
                          aria-label="Adicionar imagem do grupo"
                        >
                          {newGroupImageUrl ? (
                            <img
                              src={newGroupImageUrl}
                              alt="Imagem do grupo"
                              className={`absolute inset-0 h-full w-full ${avatarFrameLg} object-cover`}
                            />
                          ) : null}
                          <div className={`${newGroupImageUrl ? "relative z-10" : ""}`}>
                            <ImageIcon className="mx-auto h-6 w-6" />
                            <span className="mt-1 block text-center text-[10px] font-semibold leading-tight">
                              Adicionar imagem do grupo
                            </span>
                          </div>
                        </button>
                        <input
                          ref={groupImageFileInputRef}
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={handleGroupImageChange}
                        />
                        <input
                          ref={groupImageCameraInputRef}
                          type="file"
                          accept="image/*"
                          capture="user"
                          className="sr-only"
                          onChange={handleGroupImageChange}
                        />
                        {isGroupImageMenuOpen ? (
                          <div
                            className={`absolute left-1/2 top-full z-20 mt-3 w-56 -translate-x-1/2 rounded-2xl border p-2 text-left shadow-lg ${
                              isDarkTheme
                                ? "border-[#2a2a2a] bg-[#1b1b1b] text-slate-100"
                                : "border-slate-200 bg-white text-slate-700"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => groupImageCameraInputRef.current?.click()}
                              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                                isDarkTheme ? "hover:bg-white/10" : "hover:bg-slate-100"
                              }`}
                            >
                              <Camera className="h-4 w-4" />
                              Tirar foto
                            </button>
                            <button
                              type="button"
                              onClick={() => groupImageFileInputRef.current?.click()}
                              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                                isDarkTheme ? "hover:bg-white/10" : "hover:bg-slate-100"
                              }`}
                            >
                              <FolderOpen className="h-4 w-4" />
                              Carregar foto
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsGroupImageMenuOpen(false)}
                              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                                isDarkTheme ? "hover:bg-white/10" : "hover:bg-slate-100"
                              }`}
                            >
                              <Smile className="h-4 w-4" />
                              Emoji e figurinha
                            </button>
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-8 flex w-full items-center gap-3 border-b pb-2">
                        <input
                          type="text"
                          value={newGroupName}
                          onChange={(event) => setNewGroupName(event.target.value)}
                          placeholder="Nome do grupo (opcional)"
                          className={`w-full bg-transparent text-sm font-medium focus:outline-none ${
                            isDarkTheme
                              ? "placeholder:text-slate-400 text-slate-100"
                              : "placeholder:text-slate-400 text-slate-700"
                          }`}
                        />
                        <div className="relative" ref={groupEmojiAnchorRef}>
                          {isGroupEmojiOpen ? (
                            <button
                              type="button"
                              aria-label="Fechar seletor de emojis"
                              className="fixed inset-0 z-10 cursor-default"
                              onClick={() => setIsGroupEmojiOpen(false)}
                            />
                          ) : null}
                          <button
                            type="button"
                            onClick={() => setIsGroupEmojiOpen((prev) => !prev)}
                            className={`relative z-20 flex h-7 w-7 items-center justify-center rounded-full transition ${
                              isDarkTheme ? "text-blue-200 hover:bg-blue-500/10" : "text-blue-600 hover:bg-blue-50"
                            }`}
                            aria-label="Adicionar emoji"
                          >
                            <Smile className="h-4 w-4" />
                          </button>
                          {isGroupEmojiOpen && groupEmojiMenuStyle ? (
                            <div
                              ref={groupEmojiMenuRef}
                              className={`fixed z-40 overflow-hidden rounded-2xl border shadow-2xl ${
                                isDarkTheme
                                  ? "border-[#2a2a2a] bg-[#1b1b1b]"
                                  : "border-slate-200 bg-white"
                              }`}
                              style={{
                                ...groupEmojiMenuStyle,
                                width: groupEmojiSize.width,
                                height: groupEmojiSize.height,
                                maxWidth: "80vw",
                                maxHeight: "80vh",
                                minWidth: 280,
                                minHeight: 240,
                              }}
                            >
                              <SimpleEmojiPicker
                                width={groupEmojiSize.width}
                                height={groupEmojiSize.height}
                                onEmojiClick={(emoji) => setNewGroupName((prev) => `${prev}${emoji}`)}
                                isDark={isDarkTheme}
                              />
                              <button
                                type="button"
                                aria-label="Redimensionar seletor de emojis"
                                className={`absolute bottom-2 right-2 z-20 h-5 w-5 cursor-nwse-resize rounded-md border text-[10px] ${
                                  isDarkTheme
                                    ? "border-[#303030] bg-white/10 text-slate-200"
                                    : "border-slate-200 bg-white text-slate-500"
                                }`}
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  groupEmojiResizeRef.current = {
                                    startX: event.clientX,
                                    startY: event.clientY,
                                    startWidth: groupEmojiSize.width,
                                    startHeight: groupEmojiSize.height,
                                  };
                                  setIsGroupEmojiResizing(true);
                                }}
                              >
                                ↘
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-6 w-full space-y-4 text-left">
                        <button
                          type="button"
                          className="flex w-full items-center justify-between"
                        >
                          <div>
                            <p className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                              Mensagens temporárias
                            </p>
                            <p className={`text-xs ${settingsMuted}`}>Desativadas</p>
                          </div>
                          <ChevronRight className={`h-4 w-4 ${settingsMuted}`} />
                        </button>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between"
                        >
                          <div>
                            <p className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                              Permissões do grupo
                            </p>
                          </div>
                          <ChevronRight className={`h-4 w-4 ${settingsMuted}`} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={handleCreateGroup}
                        className={`mt-10 flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition ${
                          isDarkTheme ? "bg-blue-500 hover:bg-blue-400" : "bg-blue-600 hover:bg-blue-700"
                        }`}
                        aria-label="Criar grupo"
                      >
                        <Check className="h-5 w-5" />
                      </button>
                    </div>
                  ) : isNewChatEmailOpen ? (
                    <>
                      <div className="border-b px-4 py-3">
                        <div
                          className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs md:text-[15px] ${
                            isDarkTheme
                              ? "border-blue-400/60 text-slate-200"
                              : "border-blue-400 text-slate-600"
                          }`}
                        >
                          <AtSign className={`${isDarkTheme ? "text-blue-300" : "text-blue-600"} h-4 w-4`} />
                          <input
                            type="email"
                            value={newChatEmail}
                            onChange={(event) => setNewChatEmail(event.target.value)}
                            placeholder="nome@exemplo.com"
                            className={`w-full bg-transparent text-xs md:text-[15px] focus:outline-none ${
                              isDarkTheme
                                ? "placeholder:text-slate-400 text-slate-100"
                                : "placeholder:text-slate-400 text-slate-700"
                            }`}
                          />
                        </div>
                        <p className={`mt-3 text-xs ${settingsMuted}`}>
                          Insira um e-mail para iniciar uma conversa
                        </p>
                      </div>
                      <div className="flex-1 px-4 py-6">
                        <div className="grid grid-cols-2 gap-3">
                          {["@knexit.com", "@gmail.com", "@outlook.com", "@icloud.com"].map((domain) => (
                            <button
                              key={domain}
                              type="button"
                              onClick={() =>
                                setNewChatEmail((prev) => {
                                  if (!prev || prev.includes("@")) return prev;
                                  return `${prev}${domain}`;
                                })
                              }
                              className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                                isDarkTheme
                                  ? "border-blue-400/30 text-blue-200 hover:bg-blue-500/10"
                                  : "border-blue-200 text-blue-600 hover:bg-blue-50"
                              }`}
                            >
                              {domain}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : isNewGroupOpen ? (
                    <>
                      {selectedGroupMembers.length ? (
                        <div className="flex flex-wrap gap-2 border-b px-4 py-3">
                          {selectedGroupMembers.map((member) => (
                            <button
                              key={member.id}
                              type="button"
                              onClick={() =>
                                setSelectedGroupMemberIds((prev) => prev.filter((id) => id !== member.id))
                              }
                              className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition ${
                                isDarkTheme
                                  ? "bg-white/10 text-slate-100 hover:bg-white/20"
                                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                              }`}
                            >
                              <span className="grid h-5 w-5 place-items-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-600">
                                {getAvatarText(member.title)}
                              </span>
                              <span className="truncate">{member.title}</span>
                              <X className="h-3 w-3" />
                            </button>
                          ))}
                        </div>
                      ) : null}
                      <div className="border-b px-4 py-3">
                        <div
                          className={`flex items-center gap-2 border-b px-1 py-2 text-xs ${
                            isDarkTheme ? "border-blue-400/60 text-slate-200" : "border-blue-400 text-slate-600"
                          }`}
                        >
                          <Search className={`${isDarkTheme ? "text-blue-300" : "text-blue-600"} h-4 w-4`} />
                          <input
                            type="text"
                            placeholder="Pesquisar nome ou número"
                            value={newGroupSearch}
                            onChange={(event) => setNewGroupSearch(event.target.value)}
                            className={`w-full bg-transparent text-xs focus:outline-none ${
                              isDarkTheme
                                ? "placeholder:text-slate-400 text-slate-100"
                                : "placeholder:text-slate-400 text-slate-700"
                            }`}
                          />
                        </div>
                      </div>
                      <div
                        className={`relative flex-1 overflow-y-auto px-4 py-4 ${
                          selectedGroupMembers.length ? "pb-20" : ""
                        }`}
                      >
                        <p className={`text-[11px] font-semibold ${settingsMuted}`}>#</p>
                        <div className="mt-3 space-y-3">
                          {filteredGroupContacts.length ? (
                            filteredGroupContacts.map((contact) => (
                              <button
                                key={contact.id}
                                type="button"
                                onClick={() =>
                                  setSelectedGroupMemberIds((prev) =>
                                    prev.includes(contact.id)
                                      ? prev.filter((id) => id !== contact.id)
                                      : [...prev, contact.id],
                                  )
                                }
                                className="flex w-full items-center gap-3 text-left"
                              >
                                {contact.avatarUrl ? (
                                  <img
                                    src={contact.avatarUrl}
                                    alt={`Avatar de ${contact.title}`}
                                    className={`h-10 w-10 ${avatarFrameSm} object-cover`}
                                  />
                                ) : (
                                  <div
                                    className={`grid h-10 w-10 place-items-center ${avatarFrameSm} text-xs font-semibold ${
                                      isDarkTheme ? "bg-slate-900 text-slate-200" : "bg-slate-100 text-slate-700"
                                    }`}
                                  >
                                    {getAvatarText(contact.title)}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p
                                    className={`truncate text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}
                                  >
                                    {contact.title}
                                  </p>
                                  <p className={`truncate text-xs ${settingsMuted}`}>{contact.preview}</p>
                                </div>
                              </button>
                            ))
                          ) : (
                            <p className={`text-xs ${settingsMuted}`}>
                              {groupMemberPickerMode === "add"
                                ? "Todos os seus contatos já participam deste grupo."
                                : "Nenhum contato encontrado."}
                            </p>
                          )}
                        </div>
                      </div>
                      {selectedGroupMembers.length ? (
                        <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.75rem)] right-4 z-[46] lg:hidden">
                          <button
                            type="button"
                            onClick={handleAdvanceGroupMemberPicker}
                            className={`grid h-12 w-12 place-items-center rounded-xl text-white shadow-lg transition ${
                              isDarkTheme ? "bg-blue-600 hover:bg-blue-500" : "bg-blue-600 hover:bg-blue-700"
                            }`}
                            aria-label="Avançar"
                          >
                            {groupMemberPickerMode === "add" ? (
                              <Check className="h-5 w-5" />
                            ) : (
                              <ArrowRight className="h-5 w-5" />
                            )}
                          </button>
                        </div>
                      ) : null}
                    </>
                  ) : isCommunityListOpen ? (
                    <div className="flex-1 px-4 py-4">
                      <button type="button" className="flex items-center gap-3 text-left">
                        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-600 text-white">
                          <Shapes className="h-5 w-5" />
                        </span>
                        <span className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                          Nova comunidade
                        </span>
                      </button>
                      <div className="mt-6 space-y-4">
                        {[
                          {
                            id: "comm-uab",
                            title: "Comunidade Polo UAB Rio Branco",
                            preview: "Avisos",
                            lastActivity: "15/11/2025",
                          },
                          {
                            id: "comm-ufac",
                            title: "Ufac - Especialização em Educação",
                            preview: "~ Escobar: Tranquilo, obrigado pensei que já estav...",
                            lastActivity: "19/12/2025",
                          },
                        ].map((community) => (
                          <button
                            key={community.id}
                            type="button"
                            onClick={() => openCommunityThread(community)}
                            className="flex w-full items-center gap-3 text-left"
                          >
                            <div
                              className={`grid h-11 w-11 place-items-center ${avatarFrameMd} ${
                                isDarkTheme ? "bg-slate-900 text-slate-200" : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              <Shapes className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p
                                className={`truncate text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}
                              >
                                {community.title}
                              </p>
                              <p className={`truncate text-xs ${settingsMuted}`}>{community.preview}</p>
                            </div>
                            <span className={`text-[11px] ${settingsMuted}`}>{community.lastActivity}</span>
                          </button>
                        ))}
                        <button type="button" className="px-1 text-sm font-semibold text-blue-600">
                          Ver todos
                        </button>
                      </div>
                    </div>
                  ) : isNewContactOpen ? (
                    <div className="flex flex-1 flex-col px-4 py-4">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 border-b pb-2">
                          <User className={`${isDarkTheme ? "text-blue-300" : "text-blue-600"} h-4 w-4`} />
                          <input
                            type="text"
                            value={newContactFirstName}
                            onChange={(event) => setNewContactFirstName(event.target.value)}
                            placeholder="Nome"
                            className={`w-full bg-transparent text-sm focus:outline-none ${
                              isDarkTheme
                                ? "placeholder:text-slate-400 text-slate-100"
                                : "placeholder:text-slate-400 text-slate-700"
                            }`}
                          />
                        </div>
                        <div className="flex items-center gap-3 border-b pb-2">
                          <User className={`${isDarkTheme ? "text-blue-300" : "text-blue-600"} h-4 w-4`} />
                          <input
                            type="text"
                            value={newContactLastName}
                            onChange={(event) => setNewContactLastName(event.target.value)}
                            placeholder="Sobrenome"
                            className={`w-full bg-transparent text-sm focus:outline-none ${
                              isDarkTheme
                                ? "placeholder:text-slate-400 text-slate-100"
                                : "placeholder:text-slate-400 text-slate-700"
                            }`}
                          />
                        </div>
                        <div className="flex items-center gap-3 border-b pb-2">
                          <Mail className={`${isDarkTheme ? "text-blue-300" : "text-blue-600"} h-4 w-4`} />
                          <input
                            type="email"
                            value={newContactEmail}
                            onChange={(event) => {
                              setNewContactEmail(event.target.value);
                              if (newContactError) setNewContactError(null);
                              if (newContactInviteNotice) setNewContactInviteNotice(null);
                            }}
                            placeholder="E-mail"
                            className={`w-full bg-transparent text-sm focus:outline-none ${
                              isDarkTheme
                                ? "placeholder:text-slate-400 text-slate-100"
                                : "placeholder:text-slate-400 text-slate-700"
                            }`}
                          />
                        </div>
                        {isNewContactEmailValid && !isNewContactRegistered ? (
                          <div
                            className={`rounded-2xl border px-3 py-3 text-xs ${
                              isDarkTheme
                                ? "border-amber-400/40 bg-amber-500/10 text-amber-100"
                                : "border-amber-200 bg-amber-50 text-amber-700"
                            }`}
                          >
                            <p className="text-xs font-semibold">Este e-mail ainda não está usando o KnexChat.</p>
                            <p className={`mt-1 text-[11px] ${isDarkTheme ? "text-amber-200/80" : "text-amber-700/80"}`}>
                              Envie um convite para liberar o envio de mensagens.
                            </p>
                            <div className="mt-2 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={handleSendInvite}
                                className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                                  isDarkTheme
                                    ? "border-amber-300/60 text-amber-100 hover:bg-amber-500/20"
                                    : "border-amber-300 text-amber-700 hover:bg-amber-100"
                                }`}
                              >
                                Enviar convite
                              </button>
                              {newContactInviteNotice ? (
                                <span className={`text-[11px] ${isDarkTheme ? "text-amber-200/80" : "text-amber-700/80"}`}>
                                  {newContactInviteNotice}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                        <div>
                          <div className="flex items-center gap-3 border-b pb-2">
                            <Phone className={`${isDarkTheme ? "text-blue-300" : "text-blue-600"} h-4 w-4`} />
                            <button
                              type="button"
                              className={`flex items-center gap-2 text-sm font-semibold ${
                                isDarkTheme ? "text-slate-200" : "text-slate-700"
                              }`}
                            >
                              BR +55
                              <ChevronDown className="h-4 w-4" />
                            </button>
                            <input
                              type="text"
                              value={newContactPhone}
                              onChange={(event) => setNewContactPhone(event.target.value)}
                              placeholder="Número de telefone"
                              className={`w-full bg-transparent text-sm focus:outline-none ${
                                isDarkTheme
                                  ? "placeholder:text-slate-400 text-slate-100"
                                  : "placeholder:text-slate-400 text-slate-700"
                              }`}
                            />
                            {isNewContactPhoneValid ? (
                              <Check className="h-5 w-5 text-blue-600" aria-label="Número válido" />
                            ) : null}
                          </div>
                          <p className={`mt-2 text-xs ${settingsMuted}`}>
                            O e-mail é a chave principal. Associe um número de telefone para facilitar o contato.
                          </p>
                          {newContactError ? (
                            <p className="mt-2 text-xs text-rose-500">{newContactError}</p>
                          ) : null}
                        </div>
                        <div className="flex items-center justify-between rounded-2xl border px-4 py-3">
                          <div className="flex items-start gap-3">
                            <Smartphone className={`${isDarkTheme ? "text-blue-300" : "text-blue-600"} h-4 w-4`} />
                            <div>
                              <p className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                                Sincronizar contato com celular
                              </p>
                              <p className={`text-xs ${settingsMuted}`}>
                                O contato será adicionado à lista do seu dispositivo.
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setNewContactSync((prev) => !prev)}
                            className={`relative h-6 w-11 rounded-full border transition ${
                              newContactSync
                                ? "border-blue-500 bg-blue-500"
                                : isDarkTheme
                                  ? "border-[#3a3a3a] bg-[#1f1f1f]"
                                  : "border-slate-300 bg-white"
                            }`}
                            aria-pressed={newContactSync}
                          >
                            <span
                              className={`absolute left-1 top-1/2 h-[14px] w-[14px] -translate-y-1/2 rounded-full bg-white shadow transition ${
                                newContactSync ? "translate-x-[13px]" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                      <div className="mt-auto flex justify-center pb-2 pt-6">
                        <button
                          type="button"
                          onClick={handleCreateContact}
                          className={`flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition ${
                            isNewContactReady
                              ? isDarkTheme
                                ? "bg-blue-500 hover:bg-blue-400"
                                : "bg-blue-600 hover:bg-blue-700"
                              : isDarkTheme
                                ? "bg-[#2a2a2a] text-slate-400"
                                : "bg-slate-200 text-slate-400"
                          }`}
                          aria-label="Salvar contato"
                          title="Salvar contato"
                          disabled={!isNewContactReady}
                        >
                          <Check className="h-5 w-5" strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-h-0 flex-1 flex-col">
                      <div className="border-b px-4 py-3">
                        <div
                          className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs md:text-[15px] ${
                            isDarkTheme
                              ? "border-blue-400/60 text-slate-200"
                              : "border-blue-400 text-slate-600"
                          }`}
                        >
                          <Search className={`${isDarkTheme ? "text-blue-300" : "text-blue-600"} h-4 w-4`} />
                          <input
                            type="text"
                            placeholder="Pesquisar nome ou número"
                            value={newChatSearch}
                            onChange={(event) => setNewChatSearch(event.target.value)}
                            className={`w-full bg-transparent text-xs md:text-[15px] focus:outline-none ${
                              isDarkTheme
                                ? "placeholder:text-slate-400 text-slate-100"
                                : "placeholder:text-slate-400 text-slate-700"
                            }`}
                          />
                        </div>
                      </div>
                      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain">
                        <div className="flex flex-col gap-3 border-b px-4 py-4">
                          <button
                            type="button"
                            onClick={() => {
                              setGroupMemberPickerMode("create");
                              setIsNewGroupOpen(true);
                              setIsNewChatEmailOpen(false);
                              setIsNewGroupCreateOpen(false);
                              setSelectedGroupMemberIds([]);
                              setNewGroupSearch("");
                            }}
                            className="flex items-center gap-3 text-left"
                          >
                            <span className="flex h-11 w-11 items-center justify-center gap-[1px] rounded-2xl bg-blue-600 text-white">
                              <Users2 className="h-5 w-5" />
                              <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                            </span>
                            <span
                              className={`text-sm font-semibold md:text-base ${
                                isDarkTheme ? "text-slate-100" : "text-slate-900"
                              }`}
                            >
                              Novo grupo
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsNewContactOpen(true);
                              setNewContactError(null);
                              setNewContactInviteNotice(null);
                              setIsNewChatEmailOpen(false);
                              setIsNewGroupOpen(false);
                            }}
                            className="flex items-center gap-3 text-left"
                          >
                            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-600 text-white">
                              <UserPlus className="h-5 w-5" />
                            </span>
                            <span
                              className={`text-sm font-semibold md:text-base ${
                                isDarkTheme ? "text-slate-100" : "text-slate-900"
                              }`}
                            >
                              Novo contato
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsCommunityListOpen(true);
                              setIsNewChatEmailOpen(false);
                              setIsNewGroupOpen(false);
                              setIsNewContactOpen(false);
                            }}
                            className="flex items-center gap-3 text-left"
                          >
                            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-600 text-white">
                              <Shapes className="h-5 w-5" />
                            </span>
                            <span
                              className={`text-sm font-semibold md:text-base ${
                                isDarkTheme ? "text-slate-100" : "text-slate-900"
                              }`}
                            >
                              Nova comunidade
                            </span>
                          </button>
                          <button type="button" className="flex items-center gap-3 text-left">
                            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-600 text-white">
                              <MessageSquare className="h-5 w-5" />
                            </span>
                            <span
                              className={`text-sm font-semibold md:text-base ${
                                isDarkTheme ? "text-slate-100" : "text-slate-900"
                              }`}
                            >
                              Novo Fórum
                            </span>
                          </button>
                        </div>
                        <div className="px-4 py-4">
                          <p className={`text-sm font-semibold md:text-sm ${settingsMuted}`}>Contatos no SpaceHub</p>
                          <div className="mt-3 space-y-3">
                            {filteredNewChatContacts.map((contact) => (
                              <button
                                key={contact.id}
                                type="button"
                                onClick={() => openContactThread(contact.id)}
                                className="flex w-full items-center gap-3 text-left"
                              >
                                {contact.avatarUrl ? (
                                  <img
                                    src={contact.avatarUrl}
                                    alt={`Avatar de ${contact.title}`}
                                    className={`h-10 w-10 md:h-12 md:w-12 ${avatarFrameSm} object-cover`}
                                  />
                                ) : (
                                  <div
                                    className={`grid h-10 w-10 md:h-12 md:w-12 place-items-center ${avatarFrameSm} text-sm font-semibold md:text-base ${
                                      isDarkTheme ? "bg-slate-900 text-slate-200" : "bg-slate-100 text-slate-700"
                                    }`}
                                  >
                                    {getAvatarText(contact.title)}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p
                                    className={`truncate text-base font-normal md:text-[19px] md:leading-tight ${
                                      isDarkTheme ? "text-slate-100" : "text-slate-900"
                                    }`}
                                  >
                                    {contact.title}
                                  </p>
                                  <p className={`truncate text-sm md:text-[13px] md:leading-tight ${settingsMuted}`}>
                                    {contact.preview}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full space-y-0">
                  {serverSyncError ? (
                    <div
                      className={`mx-2 mb-2 rounded-xl border px-3 py-2 text-xs ${
                        isDarkTheme
                          ? "border-rose-400/40 bg-rose-500/10 text-rose-100"
                          : "border-rose-200 bg-rose-50 text-rose-700"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span>{serverSyncError}</span>
                        <button
                          type="button"
                          onClick={() => {
                            void fetchThreadsFromServer();
                          }}
                          className="rounded-lg px-2 py-1 font-semibold transition hover:bg-black/10"
                        >
                          Tentar novamente
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {isServerSyncing && !filteredActiveThreads.length ? (
                    <div className="space-y-3 px-0 py-1">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <Skeleton key={index} className="h-10 w-full" />
                      ))}
                    </div>
                  ) : (
                    filteredActiveThreads.map((thread) => {
                      const isActive = thread.id === activeThread?.id;
                      const threadAvatarUrl = resolveThreadAvatarUrl(thread);
                      const unreadCount = getUnreadCountForThread(thread);
                      const threadTimeLabel = resolveThreadLastActivityLabel(thread);
                      return (
                        <button
                          key={thread.id}
                          type="button"
                          onClick={() => {
                            if (thread.tab === "contacts") {
                              openContactThread(thread.id);
                            } else {
                              openThreadById(thread.id);
                            }
                          }}
                          onContextMenu={(event) => openDesktopConversationContextMenu(event, thread)}
                          className={`flex w-full items-center justify-between px-4 py-[0.4rem] text-left transition ${
                            isActive
                              ? isDarkTheme
                                ? "bg-white/10"
                                : "bg-slate-200"
                              : isDarkTheme
                                ? "hover:bg-white/5"
                                : "hover:bg-slate-100"
                          }`}
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            {threadAvatarUrl ? (
                              <img
                                src={threadAvatarUrl}
                                alt={`Avatar de ${thread.title}`}
                                className={`h-12 w-12 ${avatarFrameMd} object-cover`}
                              />
                            ) : (
                              <div
                                className={`grid h-12 w-12 place-items-center ${avatarFrameMd} text-base font-semibold ${
                                  isDarkTheme ? "bg-slate-900 text-slate-200" : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {getAvatarText(thread.title)}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p
                                className={`truncate text-[17px] font-normal leading-tight ${
                                  isDarkTheme ? "text-slate-100" : "text-slate-900"
                                }`}
                              >
                                {thread.title}
                              </p>
                              <p
                                className={`mt-0.5 truncate text-[12.5px] leading-tight ${
                                  isDarkTheme ? "text-slate-300" : "text-slate-700"
                                }`}
                              >
                                {thread.preview}
                              </p>
                            </div>
                            <div className="ml-2 flex shrink-0 flex-col items-end justify-start self-start pt-0.5">
                              <span
                                className={`text-[12.5px] font-semibold leading-none ${
                                  unreadCount
                                    ? isDarkTheme
                                      ? "text-emerald-300"
                                      : "text-blue-600"
                                    : isDarkTheme
                                      ? "text-slate-400"
                                      : "text-blue-600"
                                }`}
                              >
                                {threadTimeLabel}
                              </span>
                              {unreadCount ? (
                                <span className="mt-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-semibold leading-none text-white">
                                  {unreadCount > 99 ? "99+" : unreadCount}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Redimensionar painel de conversas"
              onMouseDown={handleStartChatListResize}
              className="group absolute left-full top-0 z-30 hidden h-full w-3 cursor-col-resize lg:block"
            >
              <span
                className={`pointer-events-none absolute left-0 top-0 h-full rounded-full transition-all ${
                  isChatListResizing
                    ? isDarkTheme
                      ? "w-1 bg-slate-400/45"
                      : "w-1 bg-blue-500/60"
                    : isDarkTheme
                      ? "w-px bg-[#2a2a2a] group-hover:w-1 group-hover:bg-slate-500/50"
                      : "w-px bg-slate-300/70 group-hover:w-1 group-hover:bg-slate-400/80"
                }`}
              />
            </div>
          </aside>
        )}
        </>
      )
      }
      detail={
        <section
          className={`flex min-h-0 flex-1 flex-col overflow-hidden ${settingsBorder} ${messagePanelBg}`}
        >
          {isProfileOpen ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className={`border-b ${isDarkTheme ? "border-t" : "border-t-0"} md:border-t-0 ${settingsBorder} px-6 py-4`}>
                <p className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>Publicações</p>
                <p className={`text-xs ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                  Feed de {profileData?.title ?? "participante"}
                </p>
              </div>
              <div className="flex flex-1 items-center justify-center p-6">
                <div className="text-center">
                  <p className={`text-sm font-semibold ${isDarkTheme ? "text-slate-200" : "text-slate-900"}`}>
                    Nenhuma postagem ainda
                  </p>
                  <p className={`mt-1 text-xs ${isDarkTheme ? "text-slate-400" : "text-slate-500"}`}>
                    As postagens de status deste participante aparecerão aqui.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {showMobileConversationShellHeader ? null : (
                <div
                  className={`relative flex flex-nowrap items-center justify-between gap-3 border-b border-t ${settingsBorder} ${
                    isDarkTheme ? "bg-[var(--knex-850)]/40 text-white" : "bg-[#f5f6f7]"
                  } px-4 py-0`}
                >
                  {showDetailOnMobile ? (
                    <button
                      type="button"
                      onClick={handleMobileBack}
                      className={`flex h-9 w-9 items-center justify-center rounded-full transition md:hidden ${
                        isDarkTheme ? "text-slate-200 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"
                      }`}
                      aria-label="Voltar"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleOpenProfile("thread")}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    title="Abrir perfil"
                  >
                    {activeThread ? (
                      activeThreadAvatarUrl ? (
                        <img
                          src={activeThreadAvatarUrl}
                          alt={`Avatar de ${activeThread.title}`}
                          className={`h-10 w-10 ${avatarFrameSm} object-cover`}
                        />
                      ) : (
                        <div
                          className={`grid h-10 w-10 place-items-center ${avatarFrameSm} text-xs font-semibold ${
                            isDarkTheme ? "bg-slate-900 text-slate-200" : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {getAvatarText(activeThread.title)}
                        </div>
                      )
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p
                        className={`${KNEXCHAT_FONT_CLASS} text-lg font-normal ${
                          isDarkTheme ? "text-slate-100" : "text-slate-900"
                        } truncate max-w-[200px] sm:max-w-[260px] lg:max-w-[320px]`}
                      >
                        {activeThread?.title ?? "Selecione uma conversa"}
                      </p>
                      <div
                        className={`mt-1 flex min-h-[1rem] items-center gap-2 text-xs ${
                          isDarkTheme ? "text-slate-300" : "text-slate-500"
                        }`}
                      >
                        <span className={`h-2 w-2 shrink-0 rounded-full ${headerInfo.dotClass}`} />
                        <span className="block min-w-0 truncate">{headerInfoItems[headerInfoStep] ?? ""}</span>
                      </div>
                    </div>
                  </button>
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
                      ref={threadMenuAnchorRef}
                      onClick={() => {
                        if (!activeThread) return;
                        setIsThreadMenuOpen((prev) => !prev);
                      }}
                      className={`rounded-full p-2 transition ${
                        isDarkTheme ? "text-blue-400 hover:bg-blue-500/10 hover:text-blue-300" : "text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                      }`}
                    >
                      <MoreVertical className="h-5 w-5" />
                    </button>
                  </div>
                  {isThreadMenuOpen && threadMenuSections.length ? (
                    <div
                      ref={threadMenuRef}
                      className={`absolute right-4 top-full z-40 mt-2 w-64 rounded-2xl border px-2 py-2 text-sm shadow-xl ${
                        isDarkTheme ? "border-[#2a2a2a] bg-[#1b1b1b]" : "border-slate-200 bg-white"
                      }`}
                    >
                      {threadMenuSections.map((section, sectionIndex) => (
                        <div key={`thread-menu-section-${sectionIndex}`}>
                          {section.map((item) => {
                            const Icon = item.icon;
                            const isDanger = item.tone === "danger";
                            const action = item.action as string | undefined;
                            return (
                              <button
                                key={item.label}
                                type="button"
                                onClick={() => {
                                  if (action === "contact-info") {
                                    setIsContactInfoOpen(true);
                                    setIsGroupInfoOpen(false);
                                  } else if (action === "group-info") {
                                    setIsGroupInfoOpen(true);
                                    setIsContactInfoOpen(false);
                                  }
                                  setIsThreadMenuOpen(false);
                                }}
                                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition ${
                                  isDanger
                                    ? isDarkTheme
                                      ? "hover:bg-rose-500/20"
                                      : "hover:bg-rose-100"
                                    : isDarkTheme
                                      ? "hover:bg-white/5"
                                      : "hover:bg-slate-100"
                                } ${isDarkTheme ? "text-slate-200" : "text-slate-700"}`}
                              >
                                <Icon className="h-4 w-4" />
                                <span className="text-sm">{item.label}</span>
                              </button>
                            );
                          })}
                          {sectionIndex < threadMenuSections.length - 1 ? (
                            <div className={`${isDarkTheme ? "bg-white/10" : "bg-slate-200"} my-2 h-px`} />
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}

              <div
                className={`relative flex-1 min-h-0 overflow-hidden transition-colors ${messagePanelBg}`}
                style={messagePanelBodyStyle}
              >
                <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto]">
                  <div
                    ref={messageListScrollRef}
                    onScroll={handleMessageListScroll}
                    className={`min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y [-webkit-overflow-scrolling:touch] px-6 pt-6 ${
                      isMobileView ? "pb-3" : "pb-4"
                    }`}
                  >
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
                      {activeThreadMessageLoadError ? (
                        <div
                          className={`rounded-xl border px-3 py-2 text-xs ${
                            isDarkTheme
                              ? "border-rose-400/40 bg-rose-500/10 text-rose-100"
                              : "border-rose-200 bg-rose-50 text-rose-700"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span>{activeThreadMessageLoadError}</span>
                            {activeThread ? (
                              <button
                                type="button"
                                onClick={() => {
                                  void fetchMessagesForThread(activeThread.id);
                                }}
                                className="rounded-lg px-2 py-1 font-semibold transition hover:bg-black/10"
                              >
                                Tentar novamente
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                      {shouldShowInitialMessageLoading ? (
                        <div className="space-y-3 py-2">
                          {Array.from({ length: 5 }).map((_, index) => (
                            <Skeleton key={`message-skeleton-${index}`} className="h-12 w-[78%]" />
                          ))}
                        </div>
                      ) : null}
                      {shouldShowMessageEmptyState ? (
                        <div
                          className={`rounded-2xl border px-4 py-5 text-center text-sm ${
                            isDarkTheme ? "border-[#2a2a2a] text-slate-300" : "border-slate-200 text-slate-500"
                          }`}
                        >
                          Nenhuma mensagem ainda. Envie a primeira mensagem para iniciar a conversa.
                        </div>
                      ) : null}
                      {!shouldShowInitialMessageLoading && !shouldShowMessageEmptyState
                        ? activeMessages.map((message, messageIndex) => {
                        const isMe = message.author === "me";
                        const isGroupChat = activeThread?.tab === "groups";
                        const senderInfo = message.senderEmail
                          ? contactNameByEmail.get(normalizeEmail(message.senderEmail))
                          : undefined;
                        const senderLabel =
                          message.senderName?.trim() ||
                          senderInfo?.name ||
                          "Participante";
                        const senderColorClass = getSenderColorClass(senderLabel);
                        const bubbleVariant = isMe ? "knex-bubble--out" : "knex-bubble--in";
                        const isMediaMessage = Boolean(message.imageUrl);
                        const isFileMessage = Boolean(message.fileUrl || message.fileName);
                        const isAttachmentMessage = isMediaMessage || isFileMessage;
                        const mediaType = message.imageUrl ? detectMediaTypeFromSource(message.imageUrl) : null;
                        const videoDurationLabel =
                          mediaType === "video" ? messageVideoDurationById[message.id] ?? "0:00" : null;
                        const showSender = !isMe && isGroupChat && !isAttachmentMessage;
                        const deliveryState = resolveMessageDeliveryState(message, messageIndex, activeMessages);
                        const messageTimeLabel = resolveMessageTimeLabel(message);
                        const deliveryStatusClass =
                          deliveryState === "seen"
                            ? "text-[#53bdeb]"
                            : isMe
                              ? "text-white/85"
                              : "text-slate-500";
                        const incomingAvatarUrl = isGroupChat
                          ? normalizeAvatarUrl(
                              message.senderAvatarUrl ??
                                senderInfo?.avatarUrl ??
                                null,
                            )
                          : null;
                        const bubble = (
                          <div className={`knex-bubble ${bubbleVariant} ${isMediaMessage ? "knex-bubble--media" : ""}`}>
                            {showSender ? (
                              <p className={`text-[11px] font-semibold ${senderColorClass}`}>{senderLabel}</p>
                            ) : null}
                            {message.imageUrl ? (
                              <div className="knex-bubble__media">
                                <button
                                  type="button"
                                  onClick={() => openConversationMediaViewer(message.id)}
                                  onContextMenu={(event) => {
                                    if (!mediaType) return;
                                    openMessageMediaContextMenu(event, message, mediaType);
                                  }}
                                  className="knex-bubble__media-trigger block w-full overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/80"
                                  aria-label={mediaType === "video" ? "Abrir vídeo" : "Abrir imagem"}
                                >
                                  <div className="relative">
                                    {mediaType === "video" ? (
                                      <video
                                        src={message.imageUrl}
                                        className="knex-bubble__image"
                                        muted
                                        playsInline
                                        preload="metadata"
                                        onLoadedMetadata={(event) => {
                                          updateMessageVideoDuration(message.id, event.currentTarget.duration);
                                          scrollMessageListToBottom();
                                        }}
                                      />
                                    ) : (
                                      <img
                                        src={message.imageUrl}
                                        alt={message.imageName ?? "Imagem enviada"}
                                        className="knex-bubble__image"
                                        onLoad={() => scrollMessageListToBottom()}
                                      />
                                    )}
                                    {mediaType === "video" ? (
                                      <span className="pointer-events-none absolute inset-0 grid place-items-center">
                                        <span className="grid h-9 w-9 place-items-center rounded-full bg-black/45 text-white">
                                          <Play className="h-4 w-4" />
                                        </span>
                                      </span>
                                    ) : null}
                                    <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/80 via-black/30 to-transparent px-2.5 pb-2 pt-7">
                                      {mediaType === "video" ? (
                                        <span className="inline-flex h-5 items-center justify-center gap-1 rounded-md bg-black/35 px-1.5 text-white">
                                          <Video className="h-3.5 w-3.5" />
                                          <span className="text-[10px] font-medium tabular-nums">{videoDurationLabel}</span>
                                        </span>
                                      ) : (
                                        <span className="h-5 w-5" />
                                      )}
                                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-white">
                                        <span>{messageTimeLabel}</span>
                                        {deliveryState ? (
                                          <DeliveryStatusIndicator
                                            state={deliveryState}
                                            className={deliveryState === "seen" ? "text-[#53bdeb]" : "text-white/85"}
                                          />
                                        ) : null}
                                      </span>
                                    </span>
                                  </div>
                                </button>
                              </div>
                            ) : isFileMessage ? (
                              <div className={`rounded-xl px-3 py-2.5 ${isMe ? "bg-white/15" : "bg-black/5"}`}>
                                <div className="flex items-center gap-2">
                                  <FolderOpen className="h-4 w-4 shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">{message.fileName ?? message.body ?? "Arquivo enviado"}</p>
                                  </div>
                                  {message.fileUrl ? (
                                    <a
                                      href={message.fileUrl}
                                      download={message.fileName ?? "arquivo"}
                                      className={`ml-auto inline-flex h-7 w-7 items-center justify-center rounded-full transition ${
                                        isMe ? "bg-white/20 hover:bg-white/30" : "bg-black/10 hover:bg-black/15"
                                      }`}
                                      aria-label="Baixar arquivo"
                                    >
                                      <Download className="h-4 w-4" />
                                    </a>
                                  ) : null}
                                </div>
                                <div className={`mt-1 flex items-center justify-end gap-1 text-[11px] ${isMe ? "text-white/85" : "text-slate-500"}`}>
                                  <span>{messageTimeLabel}</span>
                                  {deliveryState ? (
                                    <DeliveryStatusIndicator state={deliveryState} className={deliveryStatusClass} />
                                  ) : null}
                                </div>
                              </div>
                            ) : (
                              <p className="knex-bubble__text">{message.body}</p>
                            )}
                            {!isAttachmentMessage ? (
                              <p className="knex-bubble__time">
                                <span>{messageTimeLabel}</span>
                                {deliveryState ? (
                                  <DeliveryStatusIndicator state={deliveryState} className={deliveryStatusClass} />
                                ) : null}
                              </p>
                            ) : null}
                          </div>
                        );
                        const incomingAvatar = incomingAvatarUrl ? (
                          <img
                            src={incomingAvatarUrl}
                            alt={`Avatar de ${senderLabel}`}
                            className={`h-9 w-9 ${avatarFrameXs} object-cover`}
                          />
                        ) : (
                          <div
                            className={`grid h-9 w-9 place-items-center ${avatarFrameXs} bg-slate-900 text-xs font-semibold text-slate-200`}
                          >
                            {getAvatarText(senderLabel)}
                          </div>
                        );
                        const showIncomingAvatar = !isMe && isGroupChat;
                        const showOutgoingAvatar = isMe && isGroupChat;
                      return (
                        <div
                          key={message.id}
                          className={`flex ${isMe ? "items-end justify-end" : "items-start justify-start"} ${
                            isGroupChat ? "gap-3" : "gap-0"
                          }`}
                        >
                          {!isMe ? (
                            <>
                              {showIncomingAvatar ? incomingAvatar : null}
                              {bubble}
                            </>
                          ) : (
                            bubble
                          )}
                      {showOutgoingAvatar ? (
                        currentUser?.avatarUrl ? (
                          <img
                            src={currentUser.avatarUrl}
                            alt={`Avatar de ${currentUser?.name ?? "Participante"}`}
                            className={`h-9 w-9 ${avatarFrameXs} object-cover`}
                          />
                        ) : (
                          <div
                            className={`grid h-9 w-9 place-items-center ${avatarFrameXs} bg-emerald-500/20 text-xs font-semibold text-emerald-200`}
                          >
                            {currentUser?.avatarText ?? "KN"}
                          </div>
                        )
                      ) : null}
                        </div>
                      );
                    })
                        : null}
                    </div>
                  </div>

                  <div
                    className={`${
                      useDetachedMobileMic
                        ? "px-2 pt-0.5 pb-[calc(env(safe-area-inset-bottom)+0.35rem)]"
                        : "px-0 pb-0 pt-0"
                    } z-10 shrink-0 ${isDarkTheme ? "bg-[#141414]" : "bg-slate-50"}`}
                  >
                    <div
                      className={
                        useDetachedMobileMic
                          ? isComposerDragActive
                            ? "grid grid-cols-1 items-end gap-0"
                            : "grid grid-cols-[minmax(0,1fr)_44px] items-end gap-1"
                          : isMobileView
                            ? "flex items-end gap-2"
                            : "flex items-center gap-0"
                      }
                      onDragEnter={handleComposerDragEnter}
                      onDragOver={handleComposerDragOver}
                      onDragLeave={handleComposerDragLeave}
                      onDrop={(event) => {
                        void handleComposerDrop(event);
                      }}
                    >
                      <form
                        className={`relative flex flex-1 items-center transition-all duration-200 ${
                          isMobileView ? "flex-wrap" : "flex-nowrap"
                        } ${
                          isComposerDragActive
                            ? "min-h-[56vh] w-full justify-center rounded-[28px] border-2 border-dashed border-emerald-500 bg-emerald-100/80 p-6 sm:min-h-[62vh] sm:p-8"
                            : useDetachedMobileMic
                              ? "gap-1"
                              : "gap-2 bg-[var(--knex-850)]/70 px-4 py-2"
                        }`}
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (recordingState === "idle") {
                            handleSendMessage();
                          }
                        }}
                        onPaste={(event) => {
                          void handleComposerPaste(event);
                        }}
                      >
                      {isComposerDragActive ? (
                        <div className="pointer-events-none flex h-full w-full flex-col items-center justify-center gap-4 text-center text-emerald-900">
                          <div className="grid h-20 w-20 place-items-center rounded-3xl bg-emerald-500/15">
                            <ImageIcon className="h-10 w-10" />
                          </div>
                          <p className="text-2xl font-semibold leading-none sm:text-4xl">Arraste o arquivo aqui</p>
                          <p className="text-sm font-medium text-emerald-800/90 sm:text-base">
                            Solte para enviar imagem, vídeo ou arquivo.
                          </p>
                        </div>
                      ) : (
                        <>
                      {messageSendNotice ? (
                        <div
                          className={`w-full rounded-2xl border px-3 py-2 text-xs ${
                            isDarkTheme
                              ? "border-amber-400/40 bg-amber-500/10 text-amber-100"
                              : "border-amber-200 bg-amber-50 text-amber-700"
                          }`}
                        >
                          {messageSendNotice}
                        </div>
                      ) : null}
                      <div
                        className={`flex min-w-[200px] flex-1 items-center border text-sm focus-within:border-blue-600 ${
                          useDetachedMobileMic
                            ? isDarkTheme
                              ? "h-[40px] rounded-xl border-slate-600 bg-[#3a3a3a] text-white gap-3 pl-1.5 pr-2"
                              : "h-[40px] rounded-xl border-slate-300 bg-white text-slate-900 gap-3 pl-1.5 pr-2"
                            : "rounded-2xl border-slate-300 bg-white text-slate-900 gap-4 px-3 py-2"
                        }`}
                      >
                        <div className="relative shrink-0">
                          <button
                            ref={composerAttachmentButtonRef}
                            type="button"
                            aria-label="Adicionar"
                            onClick={() => {
                              if (isMobileView) {
                                messageImageInputRef.current?.click();
                                return;
                              }
                              setIsComposerAttachmentMenuOpen((prev) => !prev);
                            }}
                            className={`text-3xl leading-none transition ${
                              useDetachedMobileMic
                                ? isDarkTheme
                                  ? "text-slate-200 hover:text-white"
                                  : "text-slate-600 hover:text-slate-900"
                                : "text-slate-600 hover:text-slate-900"
                            }`}
                          >
                            +
                          </button>
                          {!isMobileView && isComposerAttachmentMenuOpen ? (
                            <div
                              ref={composerAttachmentMenuRef}
                              className={`absolute bottom-full left-0 z-50 mb-2 w-[194px] overflow-hidden rounded-[18px] border py-1.5 shadow-xl ${
                                isDarkTheme ? "border-[#2f2f2f] bg-[#1f1f1f] text-slate-100" : "border-slate-200 bg-[#ececec] text-slate-900"
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => handleComposerAttachmentMenuAction("document")}
                                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-medium transition ${
                                  isDarkTheme ? "hover:bg-white/10" : "hover:bg-white/70"
                                }`}
                              >
                                <FileText className="h-4 w-4 text-violet-500" />
                                <span>Documento</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleComposerAttachmentMenuAction("gallery")}
                                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-medium transition ${
                                  isDarkTheme ? "hover:bg-white/10" : "hover:bg-white/70"
                                }`}
                              >
                                <ImageIcon className="h-4 w-4 text-blue-500" />
                                <span>Fotos e vídeos</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleComposerAttachmentMenuAction("camera")}
                                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-medium transition ${
                                  isDarkTheme ? "hover:bg-white/10" : "hover:bg-white/70"
                                }`}
                              >
                                <Camera className="h-4 w-4 text-pink-500" />
                                <span>Câmera</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleComposerAttachmentMenuAction("audio")}
                                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-medium transition ${
                                  isDarkTheme ? "hover:bg-white/10" : "hover:bg-white/70"
                                }`}
                              >
                                <Headphones className="h-4 w-4 text-orange-500" />
                                <span>Áudio</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleComposerAttachmentMenuAction("contact")}
                                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-medium transition ${
                                  isDarkTheme ? "hover:bg-white/10" : "hover:bg-white/70"
                                }`}
                              >
                                <User className="h-4 w-4 text-sky-500" />
                                <span>Contato</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleComposerAttachmentMenuAction("poll")}
                                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-medium transition ${
                                  isDarkTheme ? "hover:bg-white/10" : "hover:bg-white/70"
                                }`}
                              >
                                <BarChart3 className="h-4 w-4 text-amber-500" />
                                <span>Enquete</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleComposerAttachmentMenuAction("event")}
                                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-medium transition ${
                                  isDarkTheme ? "hover:bg-white/10" : "hover:bg-white/70"
                                }`}
                              >
                                <CalendarDays className="h-4 w-4 text-pink-500" />
                                <span>Evento</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleComposerAttachmentMenuAction("sticker")}
                                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-medium transition ${
                                  isDarkTheme ? "hover:bg-white/10" : "hover:bg-white/70"
                                }`}
                              >
                                <Smile className="h-4 w-4 text-emerald-500" />
                                <span>Nova figurinha</span>
                              </button>
                            </div>
                          ) : null}
                        </div>
                        <input
                          ref={messageImageInputRef}
                          type="file"
                          accept="*/*"
                          className="sr-only"
                          onChange={handleMessageAttachmentChange}
                        />
                        <input
                          ref={messageCameraInputRef}
                          type="file"
                          accept="image/*,video/*"
                          capture="environment"
                          className="sr-only"
                          onChange={handleMessageAttachmentChange}
                        />
                        <button
                          type="button"
                          aria-label="Emojis"
                          className={`transition ${
                            useDetachedMobileMic
                              ? isDarkTheme
                                ? "text-slate-200 hover:text-white"
                                : "text-slate-600 hover:text-slate-900"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          <Smile className="h-5 w-5" />
                        </button>
                        <input
                          type="text"
                          value={messageDraft}
                          onChange={(event) => {
                            setMessageDraft(event.target.value);
                            if (messageSendNotice) setMessageSendNotice(null);
                          }}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter") return;
                            if (event.nativeEvent.isComposing) return;
                            if (!settingsState.enterToSend) {
                              event.preventDefault();
                              return;
                            }
                            event.preventDefault();
                            if (recordingState === "idle") {
                              void handleSendMessage();
                            }
                          }}
                          enterKeyHint={settingsState.enterToSend ? "send" : "done"}
                          placeholder="Digite uma mensagem"
                          className={`w-full bg-transparent text-sm focus:outline-none ${
                            useDetachedMobileMic
                              ? isDarkTheme
                                ? "text-white placeholder:text-slate-300"
                                : "text-slate-900 placeholder:text-slate-500"
                              : "text-slate-900 placeholder:text-slate-500"
                          }`}
                        />
                        {recordingState === "idle" ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              aria-label="Anexar arquivo"
                              title="Anexar arquivo"
                              onClick={() => messageImageInputRef.current?.click()}
                              className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
                                useDetachedMobileMic
                                  ? isDarkTheme
                                    ? "text-slate-200 hover:bg-white/10 hover:text-white"
                                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                              }`}
                            >
                              <Paperclip className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              aria-label="Abrir câmera"
                              title="Abrir câmera"
                              onClick={() => openComposerCamera()}
                              className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
                                useDetachedMobileMic
                                  ? isDarkTheme
                                    ? "text-slate-200 hover:bg-white/10 hover:text-white"
                                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                              }`}
                            >
                              <Camera className="h-4 w-4" />
                            </button>
                          </div>
                        ) : null}
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
                            <span
                              className={`knex-record-wave ${recordingState === "paused" ? "is-paused" : ""}`}
                              aria-hidden="true"
                            >
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
                            {useDetachedMobileMic ? null : (
                              <button
                                type="button"
                                aria-label="Enviar áudio"
                                onClick={() => stopRecording("send")}
                                className="rounded-full bg-blue-600 p-2 text-white transition hover:bg-blue-700"
                              >
                                <SendHorizontal className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ) : useDetachedMobileMic ? null : (
                          <button
                            type="button"
                            aria-label="Gravar áudio"
                            onClick={startRecording}
                            className="text-blue-600 transition hover:text-blue-700"
                          >
                            <Mic className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                      {!useDetachedMobileMic && recordingState === "idle" && hasComposerText ? (
                        <button
                          type="submit"
                          className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                        >
                          Enviar
                        </button>
                      ) : null}
                        </>
                      )}
                      </form>
                      {useDetachedMobileMic && !isComposerDragActive ? (
                        <button
                          type="button"
                          aria-label={
                            recordingState !== "idle"
                              ? "Enviar áudio"
                              : hasComposerText
                                ? "Enviar mensagem"
                                : "Gravar áudio"
                          }
                          onClick={() => {
                            if (recordingState !== "idle") {
                              stopRecording("send");
                              return;
                            }
                            if (hasComposerText) {
                              void handleSendMessage();
                              return;
                            }
                            startRecording();
                          }}
                          className="flex h-[40px] w-[44px] shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700"
                        >
                          {recordingState !== "idle" || hasComposerText ? (
                            <SendHorizontal className="h-5 w-5" />
                          ) : (
                            <Mic className="h-5 w-5" />
                          )}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
                {isComposerCameraOpen && !isMobileView ? (
                  <div className="absolute inset-0 z-[118] flex flex-col bg-[#dedfe3]">
                    <header className="flex items-center gap-2 px-4 py-3 text-slate-900">
                      <button
                        type="button"
                        onClick={closeComposerCamera}
                        className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-black/5"
                        aria-label="Fechar câmera"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <p className="text-base font-medium">Tirar foto</p>
                    </header>
                    <div className="flex min-h-0 flex-1 items-center justify-center px-6 pb-[5.5rem]">
                      <div className="h-full max-h-[78vh] w-full max-w-[1080px] overflow-hidden bg-black">
                        {composerCameraError ? (
                          <div className="grid h-full place-items-center px-6 text-center text-sm text-white">
                            <p>{composerCameraError}</p>
                          </div>
                        ) : composerCameraCapturedPreview ? (
                          <img
                            src={composerCameraCapturedPreview}
                            alt="Pré-visualização da foto capturada"
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <video
                            ref={composerCameraVideoRef}
                            className="h-full w-full object-contain"
                            autoPlay
                            muted
                            playsInline
                          />
                        )}
                      </div>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 flex h-[5.25rem] items-center justify-center bg-[#cfd2d7] px-4">
                      {composerCameraCapturedPreview ? (
                        <div className="flex w-full max-w-[1080px] items-center justify-between">
                          <button
                            type="button"
                            onClick={handleRetakeComposerCameraCapture}
                            disabled={isComposerCameraBusy}
                            className="inline-flex min-h-[40px] items-center gap-2 rounded-full px-3 text-sm font-semibold text-slate-700 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Camera className="h-4 w-4" />
                            Tirar outra
                          </button>
                          <button
                            type="button"
                            aria-label="Usar foto"
                            onClick={() => void handleApplyComposerCameraCapture()}
                            disabled={isComposerCameraBusy}
                            className="inline-flex min-h-[40px] items-center gap-2 rounded-full bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Check className="h-4 w-4" />
                            Usar foto
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          aria-label="Capturar foto"
                          onClick={() => void handleCaptureComposerCamera()}
                          disabled={Boolean(composerCameraError) || isComposerCameraBusy}
                          className="grid h-14 w-14 place-items-center rounded-full bg-emerald-500 text-white shadow-lg transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-400"
                        >
                          <Camera className="h-6 w-6" />
                        </button>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </section>
          }
        />
        {isContactInfoOpen && activeThread && activeThread.tab !== "groups" ? (
          <aside
            className={`relative hidden min-h-0 w-[26rem] flex-col border-l border-t ${settingsBorder} ${
              isDarkTheme ? "bg-[#141414]" : "bg-white"
            } lg:flex`}
          >
            <div className="flex items-center justify-between px-4 py-3">
              <button
                type="button"
                onClick={() => setIsContactInfoOpen(false)}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                  isDarkTheme ? "text-slate-200 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"
                }`}
                aria-label="Fechar dados do contato"
              >
                <X className="h-4 w-4" />
              </button>
              <p className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                Dados do contato
              </p>
              <button
                type="button"
                className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                  isDarkTheme ? "text-slate-200 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"
                }`}
                aria-label="Editar contato"
                onClick={handleOpenContactEdit}
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5">
              <div className="flex flex-col items-center gap-2">
                {activeThreadAvatarUrl ? (
                  <img
                    src={activeThreadAvatarUrl}
                    alt={`Avatar de ${activeThread.title}`}
                    className={`h-24 w-24 ${avatarFrameLg} object-cover`}
                  />
                ) : (
                  <div
                    className={`grid h-24 w-24 place-items-center ${avatarFrameLg} text-lg font-semibold ${
                      isDarkTheme ? "bg-slate-900 text-slate-200" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {getAvatarText(activeThread.title)}
                  </div>
                )}
                <p className={`text-base font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                  {activeThread.title}
                </p>
                <p className={`text-xs ${settingsMuted}`}>{profileData?.phone ?? "+55 68 9999-5995"}</p>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { label: "Pesquisar", icon: Search },
                  { label: "Vídeo", icon: Video },
                  { label: "Voz", icon: Phone },
                ].map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      type="button"
                      className={`flex flex-col items-center justify-center gap-1 rounded-xl border py-2 text-xs font-semibold transition ${
                        isDarkTheme
                          ? "border-[#2a2a2a] text-slate-100 hover:bg-white/5"
                          : "border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <Icon className="h-4 w-4 text-emerald-500" />
                      {action.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 space-y-1">
                <p className={`text-xs font-semibold ${settingsMuted}`}>Recado</p>
                <p className={`text-sm ${isDarkTheme ? "text-slate-200" : "text-slate-700"}`}>
                  {profileData?.recado ?? "Disponível"}
                </p>
              </div>
              <div className={`mt-5 border-t pt-4 ${settingsBorder}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon className={`h-4 w-4 ${settingsMuted}`} />
                    <span className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                      Mídia, links e docs
                    </span>
                  </div>
                  <span className={`text-xs ${settingsMuted}`}>{mediaCount || 23}</span>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={`media-thumb-${index}`}
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        isDarkTheme ? "bg-slate-700 text-slate-200" : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      <Download className="h-4 w-4" />
                    </div>
                  ))}
                </div>
              </div>
              <div className={`mt-5 space-y-3 border-t pt-4 ${settingsBorder}`}>
                {[
                  { label: "Mensagens favoritas", icon: Star },
                  { label: "Configurações de notificação", icon: Bell },
                  { label: "Mensagens temporárias", icon: Timer, subLabel: "Desativadas" },
                  { label: "Privacidade avançada da conversa", icon: Shield, subLabel: "Desativada" },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="flex items-start gap-3">
                      <Icon className={`mt-0.5 h-4 w-4 ${settingsMuted}`} />
                      <div>
                        <p className={`text-sm ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>{item.label}</p>
                        {item.subLabel ? <p className={`text-xs ${settingsMuted}`}>{item.subLabel}</p> : null}
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-start gap-3">
                  <Lock className={`mt-0.5 h-4 w-4 ${settingsMuted}`} />
                  <div>
                    <p className={`text-sm ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>Criptografia</p>
                    <p className={`text-xs ${settingsMuted}`}>
                      As mensagens são protegidas com a criptografia de ponta a ponta. Clique para verificar.
                    </p>
                  </div>
                </div>
              </div>
              <div className={`mt-5 border-t pt-4 ${settingsBorder}`}>
                <p className={`text-xs font-semibold ${settingsMuted}`}>3 grupos em comum</p>
                <div className="mt-3 space-y-3">
                  {commonGroups.map((group) => (
                    <div
                      key={group.id}
                      className={`flex items-center gap-3 rounded-2xl px-2 py-2 ${
                        isDarkTheme ? "hover:bg-white/5" : "hover:bg-slate-50"
                      }`}
                    >
                      {group.avatarUrl ? (
                        <img
                          src={group.avatarUrl}
                          alt={`Avatar de ${group.title}`}
                          className={`h-10 w-10 ${avatarFrameSm} object-cover`}
                        />
                      ) : (
                        <div
                          className={`grid h-10 w-10 place-items-center ${avatarFrameSm} text-xs font-semibold ${
                            isDarkTheme ? "bg-slate-900 text-slate-200" : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {getAvatarText(group.title)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className={`truncate text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                          {group.title}
                        </p>
                        <p className={`truncate text-xs ${settingsMuted}`}>{group.subtitle}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className={`mt-5 space-y-3 border-t pt-4 ${settingsBorder}`}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 text-left text-sm text-rose-500"
                >
                  <Shield className="h-4 w-4" />
                  Bloquear {activeThread.title}
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 text-left text-sm text-rose-500"
                >
                  <Flag className="h-4 w-4" />
                  Denunciar {activeThread.title}
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 text-left text-sm text-rose-500"
                >
                  <Trash2 className="h-4 w-4" />
                  Apagar conversa
                </button>
              </div>
            </div>
            {isContactEditOpen ? (
              <div
                className={`absolute inset-0 z-20 flex flex-col ${
                  isDarkTheme ? "bg-[#141414]" : "bg-white"
                }`}
              >
                <div className={`flex items-center justify-between border-b px-4 py-3 ${settingsBorder}`}>
                  <button
                    type="button"
                    onClick={() => setIsContactEditOpen(false)}
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                      isDarkTheme ? "text-slate-200 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"
                    }`}
                    aria-label="Voltar"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <p className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                    Editar contato
                  </p>
                  <button
                    type="button"
                    onClick={requestDeleteContact}
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                      isDarkTheme ? "text-rose-400 hover:bg-white/10" : "text-rose-500 hover:bg-slate-100"
                    }`}
                    aria-label="Excluir contato"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5">
                  <div className="space-y-4">
                    <div>
                      <p className={`text-xs font-semibold ${settingsMuted}`}>Nome</p>
                      <div className="mt-2 flex items-center gap-3 border-b pb-2">
                        <User className={`${isDarkTheme ? "text-blue-300" : "text-blue-600"} h-4 w-4`} />
                        <input
                          type="text"
                          value={editContactFirstName}
                          onChange={(event) => setEditContactFirstName(event.target.value)}
                          placeholder="Nome"
                          className={`w-full bg-transparent text-sm focus:outline-none ${
                            isDarkTheme
                              ? "placeholder:text-slate-400 text-slate-100"
                              : "placeholder:text-slate-400 text-slate-700"
                          }`}
                        />
                      </div>
                    </div>
                    <div>
                      <p className={`text-xs font-semibold ${settingsMuted}`}>Sobrenome</p>
                      <div className="mt-2 flex items-center gap-3 border-b pb-2">
                        <User className={`${isDarkTheme ? "text-blue-300" : "text-blue-600"} h-4 w-4`} />
                        <input
                          type="text"
                          value={editContactLastName}
                          onChange={(event) => setEditContactLastName(event.target.value)}
                          placeholder="Sobrenome"
                          className={`w-full bg-transparent text-sm focus:outline-none ${
                            isDarkTheme
                              ? "placeholder:text-slate-400 text-slate-100"
                              : "placeholder:text-slate-400 text-slate-700"
                          }`}
                        />
                      </div>
                    </div>
                    <div>
                      <p className={`text-xs font-semibold ${settingsMuted}`}>E-mail</p>
                      <div className="mt-2 flex items-center gap-3 border-b pb-2">
                        <Mail className={`${isDarkTheme ? "text-blue-300" : "text-blue-600"} h-4 w-4`} />
                        <input
                          type="email"
                          value={editContactEmail}
                          readOnly
                          aria-readonly="true"
                          className={`w-full bg-transparent text-sm focus:outline-none opacity-70 ${
                            isDarkTheme
                              ? "placeholder:text-slate-400 text-slate-100"
                              : "placeholder:text-slate-400 text-slate-700"
                          }`}
                        />
                      </div>
                      <p className={`mt-1 text-xs ${settingsMuted}`}>O e-mail é a chave principal e não pode ser alterado.</p>
                    </div>
                    <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-3">
                      <div>
                        <p className={`text-xs font-semibold ${settingsMuted}`}>País</p>
                        <button
                          type="button"
                          className={`mt-2 flex w-full items-center justify-between rounded-full border px-3 py-2 text-xs ${
                            isDarkTheme
                              ? "border-[#2a2a2a] text-slate-100"
                              : "border-slate-200 text-slate-700"
                          }`}
                        >
                          BR +55
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </div>
                      <div>
                        <p className={`text-xs font-semibold ${settingsMuted}`}>Número de telefone</p>
                        <div className="mt-2 flex items-center gap-3 border-b pb-2">
                          <Phone className={`${isDarkTheme ? "text-blue-300" : "text-blue-600"} h-4 w-4`} />
                          <input
                            type="text"
                            value={editContactPhone}
                            onChange={(event) => setEditContactPhone(event.target.value)}
                            placeholder="Número de telefone"
                            className={`w-full bg-transparent text-sm focus:outline-none ${
                              isDarkTheme
                                ? "placeholder:text-slate-400 text-slate-100"
                                : "placeholder:text-slate-400 text-slate-700"
                            }`}
                          />
                          <Check className="h-4 w-4 text-blue-600" aria-label="Número válido" />
                        </div>
                        <p className={`mt-1 text-xs ${settingsMuted}`}>Esse número de telefone já está no KnexChat.</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border px-4 py-3">
                      <div className="flex items-start gap-3">
                        <Smartphone className={`${isDarkTheme ? "text-blue-300" : "text-blue-600"} h-4 w-4`} />
                        <div>
                          <p className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                            Sincronizar contato com celular
                          </p>
                          <p className={`text-xs ${settingsMuted}`}>
                            O contato será adicionado à lista de contatos do seu celular.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditContactSync((prev) => !prev)}
                        className={`relative h-6 w-11 rounded-full border transition ${
                          editContactSync
                            ? "border-blue-600 bg-blue-600"
                            : isDarkTheme
                              ? "border-[#3a3a3a] bg-[#1f1f1f]"
                              : "border-slate-300 bg-white"
                        }`}
                        aria-pressed={editContactSync}
                      >
                        <span
                          className={`absolute left-1 top-1/2 h-[14px] w-[14px] -translate-y-1/2 rounded-full bg-white shadow transition ${
                            editContactSync ? "translate-x-[13px]" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                  <div className="mt-auto flex justify-center pb-4 pt-8">
                    <button
                      type="button"
                      onClick={handleSaveContactEdit}
                      className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition hover:bg-blue-700"
                      aria-label="Salvar contato"
                    >
                      <Check className="h-5 w-5" strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </aside>
        ) : null}
        {isGroupInfoOpen && activeThread && activeThread.tab === "groups" ? (
          <aside
            className={`relative hidden min-h-0 w-[26rem] flex-col border-l border-t ${settingsBorder} ${
              isDarkTheme ? "bg-[#141414]" : "bg-white"
            } lg:flex`}
          >
            <div className="flex items-center justify-between px-4 py-3">
              <button
                type="button"
                onClick={() => setIsGroupInfoOpen(false)}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                  isDarkTheme ? "text-slate-200 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"
                }`}
                aria-label="Fechar dados do grupo"
              >
                <X className="h-4 w-4" />
              </button>
              <p className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                Dados do grupo
              </p>
              <span className="h-8 w-8" aria-hidden="true" />
            </div>
            {isGroupPermissionsOpen ? (
              <div
                className={`absolute inset-0 z-20 flex flex-col ${
                  isDarkTheme ? "bg-[#141414]" : "bg-white"
                }`}
              >
                <div className="flex items-center gap-2 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setIsGroupPermissionsOpen(false)}
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                      isDarkTheme ? "text-slate-200 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"
                    }`}
                    aria-label="Voltar para dados do grupo"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <p className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                    Permissões do grupo
                  </p>
                </div>
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-6">
                  <p className={`text-xs font-semibold ${settingsMuted}`}>Os membros do grupo podem:</p>
                  <div className="mt-4 space-y-5">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                      <div className="flex items-start gap-3">
                        <Pencil className={`mt-0.5 h-9 w-9 ${settingsMuted}`} />
                        <div>
                          <p className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                            Editar configurações do grupo
                          </p>
                          <p className={`text-xs ${settingsMuted}`}>
                            Essa opção inclui o nome, a imagem, a descrição, a duração das mensagens temporárias e a
                            opção de fixar e desafixar mensagens.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleGroupPermission("editGroupSettings")}
                        className={`relative mt-1 h-5 w-8 rounded-full border transition ${
                          activeGroupPermissions.editGroupSettings
                            ? "border-blue-700 bg-blue-600"
                            : isDarkTheme
                              ? "border-slate-400 bg-[#1b1b1b]"
                              : "border-slate-400 bg-white"
                        }`}
                        aria-pressed={activeGroupPermissions.editGroupSettings}
                      >
                        <span
                          className={`absolute left-1 top-1/2 h-[12px] w-[12px] -translate-y-1/2 rounded-full ${
                            activeGroupPermissions.editGroupSettings ? "bg-white" : "bg-slate-500"
                          } shadow ring-1 transition ${
                            activeGroupPermissions.editGroupSettings
                              ? "translate-x-[10px] ring-blue-200"
                              : isDarkTheme
                                ? "translate-x-0 ring-slate-300"
                                : "translate-x-0 ring-slate-300"
                          }`}
                        />
                      </button>
                    </div>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                      <div className="flex items-start gap-3">
                        <MessageSquare className={`mt-0.5 h-4 w-4 ${settingsMuted}`} />
                        <div>
                          <p className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                            Enviar novas mensagens
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleGroupPermission("sendMessages")}
                        className={`relative mt-1 h-5 w-8 rounded-full border transition ${
                          activeGroupPermissions.sendMessages
                            ? "border-blue-700 bg-blue-600"
                            : isDarkTheme
                              ? "border-slate-400 bg-[#1b1b1b]"
                              : "border-slate-400 bg-white"
                        }`}
                        aria-pressed={activeGroupPermissions.sendMessages}
                      >
                        <span
                          className={`absolute left-1 top-1/2 h-[12px] w-[12px] -translate-y-1/2 rounded-full ${
                            activeGroupPermissions.sendMessages ? "bg-white" : "bg-slate-500"
                          } shadow ring-1 transition ${
                            activeGroupPermissions.sendMessages
                              ? "translate-x-[10px] ring-blue-200"
                              : isDarkTheme
                                ? "translate-x-0 ring-slate-300"
                                : "translate-x-0 ring-slate-300"
                          }`}
                        />
                      </button>
                    </div>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                      <div className="flex items-start gap-3">
                        <UserPlus className={`mt-0.5 h-4 w-4 ${settingsMuted}`} />
                        <div>
                          <p className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                            Adicionar membros
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleGroupPermission("addMembers")}
                        className={`relative mt-1 h-5 w-8 rounded-full border transition ${
                          activeGroupPermissions.addMembers
                            ? "border-blue-700 bg-blue-600"
                            : isDarkTheme
                              ? "border-slate-400 bg-[#1b1b1b]"
                              : "border-slate-400 bg-white"
                        }`}
                        aria-pressed={activeGroupPermissions.addMembers}
                      >
                        <span
                          className={`absolute left-1 top-1/2 h-[12px] w-[12px] -translate-y-1/2 rounded-full ${
                            activeGroupPermissions.addMembers ? "bg-white" : "bg-slate-500"
                          } shadow ring-1 transition ${
                            activeGroupPermissions.addMembers
                              ? "translate-x-[10px] ring-blue-200"
                              : isDarkTheme
                                ? "translate-x-0 ring-slate-300"
                                : "translate-x-0 ring-slate-300"
                          }`}
                        />
                      </button>
                    </div>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                      <div className="flex items-start gap-3">
                        <Link2 className={`mt-0.5 h-4 w-4 ${settingsMuted}`} />
                        <div>
                          <p className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                            Convidar via link
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleGroupPermission("inviteViaLink")}
                        className={`relative mt-1 h-5 w-8 rounded-full border transition ${
                          activeGroupPermissions.inviteViaLink
                            ? "border-blue-700 bg-blue-600"
                            : isDarkTheme
                              ? "border-slate-400 bg-[#1b1b1b]"
                              : "border-slate-400 bg-white"
                        }`}
                        aria-pressed={activeGroupPermissions.inviteViaLink}
                      >
                        <span
                          className={`absolute left-1 top-1/2 h-[12px] w-[12px] -translate-y-1/2 rounded-full ${
                            activeGroupPermissions.inviteViaLink ? "bg-white" : "bg-slate-500"
                          } shadow ring-1 transition ${
                            activeGroupPermissions.inviteViaLink
                              ? "translate-x-[10px] ring-blue-200"
                              : isDarkTheme
                                ? "translate-x-0 ring-slate-300"
                                : "translate-x-0 ring-slate-300"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <p className={`mt-6 text-xs font-semibold ${settingsMuted}`}>Os admins do grupo podem:</p>
                  <div className="mt-4 space-y-5">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                      <div className="flex items-start gap-3">
                        <CheckSquare className={`mt-0.5 h-6 w-6 ${settingsMuted}`} />
                        <div>
                          <p className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                            Aprovar novos membros
                          </p>
                          <p className={`text-xs ${settingsMuted}`}>
                            Enquanto essa opção estiver ativada, os admins deverão aprovar a entrada de membros no
                            grupo.{" "}
                            <span className="text-blue-600">Saiba mais</span>
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleGroupPermission("approveNewMembers")}
                        className={`relative mt-1 h-5 w-8 rounded-full border transition ${
                          activeGroupPermissions.approveNewMembers
                            ? "border-blue-700 bg-blue-600"
                            : isDarkTheme
                              ? "border-slate-400 bg-[#1b1b1b]"
                              : "border-slate-400 bg-white"
                        }`}
                        aria-pressed={activeGroupPermissions.approveNewMembers}
                      >
                        <span
                          className={`absolute left-1 top-1/2 h-[12px] w-[12px] -translate-y-1/2 rounded-full ${
                            activeGroupPermissions.approveNewMembers ? "bg-white" : "bg-slate-500"
                          } shadow ring-1 transition ${
                            activeGroupPermissions.approveNewMembers
                              ? "translate-x-[10px] ring-blue-200"
                              : isDarkTheme
                                ? "translate-x-0 ring-slate-300"
                                : "translate-x-0 ring-slate-300"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <p className={`mt-6 text-xs font-semibold ${settingsMuted}`}>Admins do grupo</p>
                  <button
                    type="button"
                    onClick={() => setIsGroupAdminsModalOpen(true)}
                    className={`mt-3 flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2 text-left transition ${
                      isDarkTheme ? "bg-white/5 hover:bg-white/10" : "bg-slate-50 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Users className={`mt-0.5 h-4 w-4 ${settingsMuted}`} />
                      <div>
                        <p className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                          Editar admins do grupo
                        </p>
                        <p className={`text-xs ${settingsMuted}`}>{groupAdminNames}</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            ) : null}
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5">
              <div className="flex flex-col items-center gap-2 text-center">
                {canEditGroupSettings ? (
                  <label className="group relative cursor-pointer">
                    {activeThreadAvatarUrl ? (
                      <img
                        src={activeThreadAvatarUrl}
                        alt={`Avatar de ${activeThread.title}`}
                        className={`h-24 w-24 ${avatarFrameLg} object-cover`}
                      />
                    ) : (
                      <div
                        className={`grid h-24 w-24 place-items-center ${avatarFrameLg} text-lg font-semibold ${
                          isDarkTheme ? "bg-slate-900 text-slate-200" : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {getAvatarText(activeThread.title)}
                      </div>
                    )}
                    <span
                      className={`absolute inset-0 flex flex-col items-center justify-center gap-2 ${avatarFrameLg} bg-black/55 px-3 text-center text-[11px] font-semibold text-white opacity-0 transition group-hover:opacity-100 ${
                        isDarkTheme ? "bg-black/60" : "bg-slate-900/65"
                      }`}
                    >
                      <ImageIcon className="h-5 w-5" />
                      <span>Mudar imagem do grupo</span>
                    </span>
                    <input
                      ref={groupAvatarInputRef}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleGroupAvatarChange}
                    />
                  </label>
                ) : activeThreadAvatarUrl ? (
                  <img
                    src={activeThreadAvatarUrl}
                    alt={`Avatar de ${activeThread.title}`}
                    className={`h-24 w-24 ${avatarFrameLg} object-cover`}
                  />
                ) : (
                  <div
                    className={`grid h-24 w-24 place-items-center ${avatarFrameLg} text-lg font-semibold ${
                      isDarkTheme ? "bg-slate-900 text-slate-200" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {getAvatarText(activeThread.title)}
                  </div>
                )}
                <div className="mt-1 relative w-full">
                  {isGroupNameEditing ? (
                    <textarea
                      ref={groupNameInputRef}
                      value={groupNameDraft}
                      onChange={(event) => {
                        setGroupNameDraft(event.target.value);
                        event.currentTarget.style.height = "auto";
                        event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
                      }}
                      onBlur={saveGroupName}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          saveGroupName();
                        }
                        if (event.key === "Escape") {
                          event.preventDefault();
                          cancelGroupNameEditor();
                        }
                      }}
                      rows={1}
                      className={`mx-auto block w-[70%] resize-none overflow-hidden rounded-xl border px-3 py-1.5 text-center text-sm font-semibold ${settingsField}`}
                      aria-label="Editar nome do grupo"
                      autoFocus
                    />
                  ) : (
                    <>
                      <p className={`mx-auto w-[70%] break-words text-center text-base font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                        {activeThread.title}
                      </p>
                      {canEditGroupSettings ? (
                        <button
                          type="button"
                          onClick={openGroupNameEditor}
                          className={`absolute right-0 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full transition ${
                            isDarkTheme ? "text-slate-200 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"
                          }`}
                          aria-label="Editar nome do grupo"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      ) : null}
                    </>
                  )}
                </div>
                <p className={`text-xs ${settingsMuted}`}>
                  Grupo · {groupMemberCount} membro{groupMemberCount === 1 ? "" : "s"}
                </p>
              </div>
              <div className="mt-4 flex items-center justify-center gap-2">
                {[
                  { label: "Adicionar", icon: UserPlus },
                  { label: "Pesquisar", icon: Search },
                ].map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      type="button"
                      className={`flex w-36 flex-col items-center justify-center gap-1 rounded-2xl border py-2 text-xs font-semibold transition ${
                        isDarkTheme
                          ? "border-[#2a2a2a] text-slate-100 hover:bg-white/5"
                          : "border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <Icon className="h-4 w-4 text-blue-600" />
                      {action.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  {canEditGroupDescription ? (
                    <>
                      <button
                        type="button"
                        onClick={openGroupDescriptionEditor}
                        className="text-sm font-semibold text-blue-600"
                      >
                        Adicionar descrição ao grupo
                      </button>
                      <button
                        type="button"
                        onClick={openGroupDescriptionEditor}
                        className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                          isDarkTheme ? "text-slate-200 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"
                        }`}
                        aria-label="Editar descrição do grupo"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <p className={`text-sm font-semibold ${settingsMuted}`}>Descrição do grupo</p>
                  )}
                </div>
                {isGroupDescriptionEditing ? (
                  <div className={`rounded-2xl border p-3 ${settingsBorder}`}>
                    <textarea
                      value={groupDescriptionDraft}
                      onChange={(event) => setGroupDescriptionDraft(event.target.value)}
                      rows={3}
                      placeholder="Adicione uma descrição"
                      className={`w-full resize-none bg-transparent text-sm focus:outline-none ${
                        isDarkTheme
                          ? "placeholder:text-slate-400 text-slate-100"
                          : "placeholder:text-slate-400 text-slate-700"
                      }`}
                    />
                    <div className="mt-3 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={cancelGroupDescriptionEditor}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                          isDarkTheme ? "text-slate-200 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={saveGroupDescription}
                        className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-blue-700"
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                ) : groupDescriptions[activeThread.id] ? (
                  <p className={`text-sm ${isDarkTheme ? "text-slate-200" : "text-slate-700"}`}>
                    {groupDescriptions[activeThread.id]}
                  </p>
                ) : !canEditGroupDescription ? (
                  <p className={`text-sm ${settingsMuted}`}>Sem descrição.</p>
                ) : null}
                <p className={`text-xs ${settingsMuted}`}>
                  Grupo criado por GMadson no dia 02/02/2025 às 14:50
                </p>
              </div>
              <div className={`mt-5 border-t pt-4 ${settingsBorder}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon className={`h-4 w-4 ${settingsMuted}`} />
                    <span className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                      Mídia, links e docs
                    </span>
                  </div>
                  <span className={`text-xs ${settingsMuted}`}>{mediaCount || 191}</span>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {groupMediaItems.length ? (
                    groupMediaItems.map((item) => (
                      <div
                        key={item.id}
                        className={`h-16 w-full overflow-hidden rounded-2xl ${
                          isDarkTheme ? "bg-slate-700" : "bg-slate-200"
                        }`}
                      >
                        <img src={item.src} alt={item.label} className="h-full w-full object-cover" />
                      </div>
                    ))
                  ) : (
                    Array.from({ length: 4 }).map((_, index) => (
                      <div
                        key={`group-media-thumb-${index}`}
                        className={`flex h-16 w-full items-center justify-center rounded-2xl ${
                          isDarkTheme ? "bg-slate-700 text-slate-200" : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        <ImageIcon className="h-4 w-4" />
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className={`mt-5 space-y-3 border-t pt-4 ${settingsBorder}`}>
                {[
                  { label: "Mensagens favoritas", icon: Star },
                  { label: "Configurações de notificação", icon: BellOff, subLabel: "Sempre silenciadas" },
                  { label: "Criptografia", icon: Lock, subLabel: "As mensagens são protegidas com a criptografia de ponta a ponta." },
                  { label: "Mensagens temporárias", icon: Timer, subLabel: "Desativadas" },
                  { label: "Privacidade avançada da conversa", icon: Shield, subLabel: "Desativada" },
                  { label: "Permissões do grupo", icon: Settings },
                ].map((item) => {
                  const Icon = item.icon;
                  if (item.label === "Permissões do grupo") {
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => setIsGroupPermissionsOpen(true)}
                        className={`flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left transition ${settingsHover}`}
                      >
                        <Icon className={`mt-0.5 h-4 w-4 ${settingsMuted}`} />
                        <div>
                          <p className={`text-sm ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>{item.label}</p>
                          {item.subLabel ? <p className={`text-xs ${settingsMuted}`}>{item.subLabel}</p> : null}
                        </div>
                      </button>
                    );
                  }
                  return (
                    <div key={item.label} className="flex items-start gap-3">
                      <Icon className={`mt-0.5 h-4 w-4 ${settingsMuted}`} />
                      <div>
                        <p className={`text-sm ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>{item.label}</p>
                        {item.subLabel ? <p className={`text-xs ${settingsMuted}`}>{item.subLabel}</p> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className={`mt-5 border-t pt-4 ${settingsBorder}`}>
                <button
                  type="button"
                  className={`flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left transition ${
                    isDarkTheme ? "hover:bg-white/5" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-500/15 text-blue-600">
                    <Users2 className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${isDarkTheme ? "text-blue-200" : "text-blue-600"}`}>
                      Adicionar grupo a uma comunidade
                    </p>
                    <p className={`text-xs ${settingsMuted}`}>
                      Reúna pessoas em grupos de assuntos específicos
                    </p>
                  </div>
                  <ChevronRight className={`h-4 w-4 ${settingsMuted}`} />
                </button>
              </div>
              <div className={`mt-5 border-t pt-4 ${settingsBorder}`}>
                <div className="flex items-center justify-between">
                  <p className={`text-xs font-semibold ${settingsMuted}`}>{groupMemberCount} membros</p>
                  <Search className={`h-4 w-4 ${settingsMuted}`} />
                </div>
                <div className="mt-3 space-y-3">
                  <button
                    type="button"
                    onClick={openGroupMemberPickerForActiveGroup}
                    disabled={!canEditGroupSettings}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      canEditGroupSettings
                        ? isDarkTheme
                          ? "text-slate-100 hover:bg-white/10"
                          : "text-slate-700 hover:bg-slate-100"
                        : isDarkTheme
                          ? "text-slate-500"
                          : "text-slate-400"
                    }`}
                  >
                    <span
                      className={`grid h-10 w-10 place-items-center rounded-full ${
                        isDarkTheme ? "bg-blue-500/55 text-blue-100" : "bg-blue-600/40 text-blue-800"
                      }`}
                    >
                      <UserPlus className="h-5 w-5" />
                    </span>
                    Adicionar membro
                  </button>
                  <button
                    type="button"
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      isDarkTheme ? "text-slate-100 hover:bg-white/10" : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span
                      className={`grid h-10 w-10 place-items-center rounded-full ${
                        isDarkTheme ? "bg-blue-500/55 text-blue-100" : "bg-blue-600/40 text-blue-800"
                      }`}
                    >
                      <Link2 className="h-5 w-5" />
                    </span>
                    Convidar via link
                  </button>
                </div>
                <div className="mt-4 space-y-4">
                  {groupMembers.map((member) => (
                    <div
                      key={`group-member-${member.id}`}
                      className={`flex items-center gap-3 rounded-2xl px-2 py-2 ${
                        isDarkTheme ? "hover:bg-white/5" : "hover:bg-slate-50"
                      }`}
                    >
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt={`Avatar de ${member.title}`}
                          className={`h-10 w-10 ${avatarFrameSm} object-cover`}
                        />
                      ) : (
                        <div
                          className={`grid h-10 w-10 place-items-center ${avatarFrameSm} text-xs font-semibold ${
                            isDarkTheme ? "bg-slate-900 text-slate-200" : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {getAvatarText(member.title)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                          {member.title}
                        </p>
                        {member.subtitle ? <p className={`truncate text-xs ${settingsMuted}`}>{member.subtitle}</p> : null}
                      </div>
                      {member.isAdmin ? (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                          Admin do grupo
                        </span>
                      ) : null}
                    </div>
                  ))}
                  {(isGroupMembersExpanded || groupMembersHiddenCount > 0) ? (
                    <button
                      type="button"
                      onClick={() => setIsGroupMembersExpanded((prev) => !prev)}
                      className="text-left text-sm font-semibold text-blue-600"
                    >
                      {isGroupMembersExpanded ? "Ver menos" : `Ver tudo (mais ${groupMembersHiddenCount})`}
                    </button>
                  ) : null}
                </div>
              </div>
              <div className={`mt-5 space-y-3 border-t pt-4 ${settingsBorder}`}>
                <button
                  type="button"
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-rose-500 transition ${
                    isDarkTheme ? "hover:bg-white/10" : "hover:bg-slate-100"
                  }`}
                >
                  <LogOut className="h-4 w-4" />
                  Sair do grupo
                </button>
                <button
                  type="button"
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-rose-500 transition ${
                    isDarkTheme ? "hover:bg-white/10" : "hover:bg-slate-100"
                  }`}
                >
                  <Flag className="h-4 w-4" />
                  Denunciar grupo
                </button>
              </div>
            </div>
          </aside>
        ) : null}
        </div>
      </div>
      {isDeleteContactConfirmOpen ? (
        <div
          className="absolute inset-0 z-[70] flex items-center justify-center bg-black/40 px-4"
          onClick={cancelDeleteContact}
          role="presentation"
        >
          <div
            className={`w-full max-w-md rounded-2xl border px-6 py-5 shadow-2xl ${
              isDarkTheme ? "border-[#2a2a2a] bg-[#1b1b1b] text-slate-100" : "border-slate-200 bg-white text-slate-900"
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-sm font-semibold">Excluir contato</p>
            <p className={`mt-2 text-sm ${settingsMuted}`}>
              Excluir {deleteContactTargetName || "este contato"}?
            </p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={confirmDeleteContact}
                className="rounded-full bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                OK
              </button>
              <button
                type="button"
                onClick={cancelDeleteContact}
                className={`rounded-full px-6 py-2 text-sm font-semibold transition ${
                  isDarkTheme ? "bg-white/10 text-slate-100 hover:bg-white/20" : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                }`}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {isGroupMemberModalOpen && !isMobileView && activeThread && activeThread.tab === "groups" ? (
        <div
          className="absolute inset-0 z-[72] flex items-center justify-center bg-black/40 px-4"
          onClick={closeGroupMemberPickerModal}
          role="presentation"
        >
          <div
            className={`relative flex h-[min(86vh,860px)] w-[min(94vw,460px)] flex-col overflow-hidden rounded-3xl border shadow-2xl ${
              isDarkTheme ? "border-[#2a2a2a] bg-[#1b1b1b] text-slate-100" : "border-slate-200 bg-white text-slate-900"
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={`flex items-center gap-3 border-b px-5 py-4 ${settingsBorder}`}>
              <button
                type="button"
                onClick={closeGroupMemberPickerModal}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                  isDarkTheme ? "text-slate-200 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"
                }`}
                aria-label="Fechar adicionar membro"
              >
                <X className="h-4 w-4" />
              </button>
              <p className="text-xl font-semibold">Adicionar membro</p>
            </div>
            <div className="px-5 pt-4">
              <div className={`flex items-center gap-2 rounded-full border px-3 py-2 ${isDarkTheme ? "border-emerald-400/60" : "border-emerald-500"}`}>
                <Search className={`h-4 w-4 ${settingsMuted}`} />
                <input
                  type="text"
                  value={newGroupSearch}
                  onChange={(event) => setNewGroupSearch(event.target.value)}
                  placeholder="Pesquisar nome ou número"
                  className={`w-full bg-transparent text-sm focus:outline-none ${
                    isDarkTheme ? "placeholder:text-slate-400 text-slate-100" : "placeholder:text-slate-500 text-slate-700"
                  }`}
                />
              </div>
              <p className={`mt-5 text-sm ${settingsMuted}`}>Contatos</p>
            </div>
            <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-5 pb-3">
              <div className="space-y-2">
                {filteredGroupContacts.length ? (
                  filteredGroupContacts.map((contact) => {
                    const isSelected = selectedGroupMemberIds.includes(contact.id);
                    return (
                      <button
                        key={`group-member-picker-${contact.id}`}
                        type="button"
                        onClick={() =>
                          setSelectedGroupMemberIds((prev) =>
                            prev.includes(contact.id)
                              ? prev.filter((id) => id !== contact.id)
                              : [...prev, contact.id],
                          )
                        }
                        className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition ${
                          isDarkTheme ? "hover:bg-white/5" : "hover:bg-slate-100"
                        }`}
                      >
                        <span
                          className={`inline-flex h-5 w-5 items-center justify-center rounded-md border ${
                            isSelected
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : isDarkTheme
                                ? "border-slate-400 text-transparent"
                                : "border-slate-400 text-transparent"
                          }`}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </span>
                        {contact.avatarUrl ? (
                          <img
                            src={contact.avatarUrl}
                            alt={`Avatar de ${contact.title}`}
                            className={`h-12 w-12 ${avatarFrameMd} object-cover`}
                          />
                        ) : (
                          <div
                            className={`grid h-12 w-12 place-items-center ${avatarFrameMd} text-sm font-semibold ${
                              isDarkTheme ? "bg-slate-900 text-slate-200" : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {getAvatarText(contact.title)}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-base ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                            {contact.title}
                          </p>
                          <p className={`truncate text-sm ${settingsMuted}`}>{contact.preview}</p>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <p className={`px-2 py-3 text-sm ${settingsMuted}`}>
                    Todos os seus contatos já participam deste grupo.
                  </p>
                )}
              </div>
            </div>
            <div className={`flex items-center justify-end gap-3 border-t px-5 py-3 ${settingsBorder}`}>
              <button
                type="button"
                onClick={closeGroupMemberPickerModal}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  isDarkTheme ? "bg-white/10 text-slate-100 hover:bg-white/20" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleAddMembersToActiveGroup()}
                disabled={!selectedGroupMemberIds.length}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  selectedGroupMemberIds.length
                    ? "bg-emerald-500 text-white hover:bg-emerald-600"
                    : isDarkTheme
                      ? "bg-[#2a2a2a] text-slate-500"
                      : "bg-slate-200 text-slate-400"
                }`}
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {isGroupAdminsModalOpen && activeThread && activeThread.tab === "groups" ? (
        <div
          className="absolute inset-0 z-[70] flex items-center justify-center bg-black/40 px-4"
          onClick={() => setIsGroupAdminsModalOpen(false)}
          role="presentation"
        >
          <div
            className={`relative flex h-[min(82vh,760px)] w-[min(94vw,420px)] flex-col overflow-hidden rounded-3xl shadow-2xl ${
              isDarkTheme ? "bg-[#1b1b1b] text-slate-100" : "bg-white text-slate-900"
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b px-5 py-4">
              <button
                type="button"
                onClick={() => setIsGroupAdminsModalOpen(false)}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                  isDarkTheme ? "text-slate-200 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"
                }`}
                aria-label="Fechar edição de admins"
              >
                <X className="h-4 w-4" />
              </button>
              <p className="text-sm font-semibold">Editar admins do grupo</p>
            </div>
            <div className="px-5 pt-4">
              <div className={`flex items-center gap-2 rounded-full px-3 py-2 ${isDarkTheme ? "bg-white/10" : "bg-slate-100"}`}>
                <Search className={`h-4 w-4 ${settingsMuted}`} />
                <input
                  type="text"
                  value={groupAdminSearch}
                  onChange={(event) => setGroupAdminSearch(event.target.value)}
                  placeholder="Pesquisar nome ou número"
                  className={`w-full bg-transparent text-sm focus:outline-none ${
                    isDarkTheme ? "placeholder:text-slate-400" : "placeholder:text-slate-500"
                  }`}
                />
              </div>
              {selectedGroupAdmins.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedGroupAdmins.map((admin) => (
                    <span
                      key={`selected-admin-${admin.id}`}
                      className={`flex items-center gap-2 rounded-full px-2 py-1 text-xs ${
                        isDarkTheme ? "bg-blue-500/20 text-blue-100" : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {admin.avatarUrl ? (
                        <img
                          src={admin.avatarUrl}
                          alt={admin.title}
                          className={`h-6 w-6 ${avatarFrameSm} object-cover`}
                        />
                      ) : (
                        <span
                          className={`grid h-6 w-6 place-items-center ${avatarFrameSm} text-[10px] font-semibold ${
                            isDarkTheme ? "bg-slate-900 text-slate-200" : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {getAvatarText(admin.title)}
                        </span>
                      )}
                      <span className="max-w-[120px] truncate">{admin.title}</span>
                      <button
                        type="button"
                        onClick={() => toggleGroupAdminSelection(admin.id)}
                        className={`flex h-4 w-4 items-center justify-center rounded-full transition ${
                          isDarkTheme ? "text-slate-300 hover:bg-white/10" : "text-slate-500 hover:bg-slate-200"
                        }`}
                        aria-label={`Remover ${admin.title}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="mt-4 flex-1 overflow-y-auto px-5 pb-24">
              <p className={`text-xs font-semibold ${settingsMuted}`}>Contatos</p>
              <div className="mt-3 space-y-3">
                {filteredGroupAdminCandidates.map((candidate) => {
                  const isSelected = selectedGroupAdminIds.includes(candidate.id);
                  return (
                    <button
                      key={`admin-candidate-${candidate.id}`}
                      type="button"
                      onClick={() => toggleGroupAdminSelection(candidate.id)}
                      className={`flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition ${
                        isDarkTheme ? "hover:bg-white/5" : "hover:bg-slate-50"
                      }`}
                    >
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                          isSelected
                            ? "border-blue-600 bg-blue-600 text-white"
                            : isDarkTheme
                              ? "border-slate-500"
                              : "border-slate-300"
                        }`}
                      >
                        {isSelected ? <Check className="h-3 w-3" /> : null}
                      </span>
                      {candidate.avatarUrl ? (
                        <img
                          src={candidate.avatarUrl}
                          alt={candidate.title}
                          className={`h-10 w-10 ${avatarFrameSm} object-cover`}
                        />
                      ) : (
                        <div
                          className={`grid h-10 w-10 place-items-center ${avatarFrameSm} text-xs font-semibold ${
                            isDarkTheme ? "bg-slate-900 text-slate-200" : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {getAvatarText(candidate.title)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className={`truncate text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                          {candidate.title}
                        </p>
                        {candidate.subtitle ? <p className={`truncate text-xs ${settingsMuted}`}>{candidate.subtitle}</p> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!activeThread || activeThread.tab !== "groups") return;
                setGroupAdminIdsByGroup((prev) => ({ ...prev, [activeThread.id]: selectedGroupAdminIds }));
                setIsGroupAdminsModalOpen(false);
              }}
              className="absolute bottom-5 right-5 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition hover:bg-blue-700"
              aria-label="Salvar admins do grupo"
            >
              <Check className="h-5 w-5" />
            </button>
          </div>
        </div>
      ) : null}
      {showMobileConversationFloatingActions ? (
        <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.75rem)] right-4 z-[45] flex flex-col items-end gap-2 lg:hidden">
          <button
            type="button"
            onClick={() => {}}
            className="grid h-11 w-11 place-items-center rounded-full bg-blue-600 text-white transition hover:bg-blue-500"
            aria-label="Abrir assistente IA (em breve)"
            title="Abrir assistente IA (em breve)"
          >
            <ScanLine className="h-5 w-5" strokeWidth={2.35} />
          </button>
          <button
            type="button"
            onClick={openNewConversationPanel}
            className="grid h-12 w-12 place-items-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-500"
            aria-label="Nova conversa"
            title="Nova conversa"
          >
            <MessageCirclePlus
              className="h-[1.6rem] w-[1.6rem]"
              strokeWidth={2.45}
            />
          </button>
        </div>
      ) : null}
      {showMobileFooterDock ? (
        <div
          className={`fixed inset-x-0 bottom-0 z-40 flex items-center px-3 pt-0 lg:hidden ${mobileDockSurface}`}
          style={{
            height: "3.5rem",
          }}
        >
          <div className="w-full">
            <div
              ref={mobileDockButtonsRef}
              data-overflow={isMobileDockCarousel ? "1" : "0"}
              className="grid w-full grid-cols-7 items-center gap-1.5"
            >
            {/*
              While profile sheet is open, avatar is the only selected footer item.
            */}
            <button
              type="button"
              className={mobileDockButtonClass(!isMobileProfileSheetOpen && activeNavKey === "conversations")}
              onClick={() => openMobileFooterEnvironment("conversations")}
              aria-label="Conversas"
              title="Conversas"
            >
              <MessageCircle className={mobileDockIconClass} strokeWidth={2.45} />
            </button>
            <button
              type="button"
              className={mobileDockButtonClass(!isMobileProfileSheetOpen && activeNavKey === "calls")}
              onClick={() => openMobileFooterEnvironment("calls")}
              aria-label="Ligações"
              title="Ligações"
            >
              <Phone className={mobileDockIconClass} strokeWidth={2.45} />
            </button>
            <button
              type="button"
              className={mobileDockButtonClass(!isMobileProfileSheetOpen && activeNavKey === "status")}
              onClick={() => openMobileFooterEnvironment("status")}
              aria-label="Status"
              title="Status"
            >
              <CircleDot className={mobileDockIconClass} strokeWidth={2.45} />
            </button>
            <button
              type="button"
              className={mobileDockButtonClass(!isMobileProfileSheetOpen && activeNavKey === "channels")}
              onClick={() => openMobileFooterEnvironment("channels")}
              aria-label="Canais"
              title="Canais"
            >
              <Radio className={mobileDockIconClass} strokeWidth={2.45} />
            </button>
            <button
              type="button"
              className={mobileDockButtonClass(!isMobileProfileSheetOpen && activeNavKey === "communities")}
              onClick={() => openMobileFooterEnvironment("communities")}
              aria-label="Comunidades"
              title="Comunidades"
            >
              <Shapes className={mobileDockIconClass} strokeWidth={2.45} />
            </button>
            <button
              type="button"
              className={mobileDockButtonClass(!isMobileProfileSheetOpen && activeNavKey === "contacts")}
              onClick={() => openMobileFooterEnvironment("contacts", { directoryTab: "people" })}
              aria-label="Novo contato ou conversa"
              title="Novo contato ou conversa"
            >
              <UserPlus className={mobileDockIconClass} strokeWidth={2.45} />
            </button>
            <button
              type="button"
              onClick={() => {
                setIsProfileOpen(false);
                setProfileTarget(null);
                setIsSettingsOpen(false);
                setActiveSettingKey(null);
                setIsDirectoryOpen(false);
                setIsMobileProfileSheetOpen((prev) => !prev);
              }}
              className={mobileDockAvatarButtonClass(isMobileProfileSheetOpen)}
              aria-label="Meu perfil"
              title="Meu perfil"
            >
              <span className="relative z-10 flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg max-[420px]:h-9 max-[420px]:w-9 max-[360px]:h-8 max-[360px]:w-8">
                {currentUser?.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={`Avatar de ${currentUser?.name ?? "Perfil"}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                    <span
                      className={`grid h-full w-full place-items-center text-[10px] font-semibold ${
                        isDarkTheme ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {getAvatarText(currentUser?.name ?? "KN")}
                    </span>
                )}
              </span>
            </button>
            </div>
          </div>
        </div>
      ) : null}
      {isMobileProfileSheetOpen ? (
        <>
          <button
            type="button"
            aria-label="Fechar opções do perfil"
            className="fixed inset-x-0 top-0 bottom-[3.5rem] z-50 bg-black/35 lg:hidden"
            onClick={() => setIsMobileProfileSheetOpen(false)}
          />
          <div className="fixed inset-x-0 top-0 bottom-[3.5rem] z-[55] lg:hidden">
            <div
              className={`knex-sheet-up flex h-full flex-col overflow-hidden rounded-none border shadow-2xl ${settingsBorder} ${
                isDarkTheme ? "bg-[#0f141f] text-slate-100" : "bg-white text-slate-900"
              }`}
            >
              <div
                className="flex items-center justify-between gap-2 px-4"
                style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)", paddingBottom: "0.75rem" }}
              >
                {isMobileProfileSearchOpen ? (
                  <div
                    className={`flex min-w-0 flex-1 items-center gap-2 rounded-full border px-2.5 py-2 text-xs ${
                      isDarkTheme
                        ? "border-slate-200/80 bg-white/5 text-slate-100"
                        : "border-blue-300 bg-blue-50 text-slate-700"
                    }`}
                  >
                    <button
                      type="button"
                      aria-label="Fechar pesquisa"
                      title="Fechar pesquisa"
                      onClick={() => {
                        setIsMobileProfileSearchOpen(false);
                        setMobileProfileSearchQuery("");
                      }}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition ${
                        isDarkTheme ? "text-slate-200 hover:bg-white/10" : "text-slate-600 hover:bg-white/60"
                      }`}
                    >
                      <ArrowRight className="h-3.5 w-3.5 rotate-180" />
                    </button>
                    <input
                      ref={mobileProfileSearchInputRef}
                      type="text"
                      value={mobileProfileSearchQuery}
                      onChange={(event) => setMobileProfileSearchQuery(event.target.value)}
                      placeholder="Pesquisar configurações"
                      className={`w-full bg-transparent text-xs focus:outline-none ${
                        isDarkTheme
                          ? "placeholder:text-slate-400 text-slate-100"
                          : "placeholder:text-slate-500 text-slate-700"
                      }`}
                    />
                    <Search className={`${isDarkTheme ? "text-slate-300" : "text-blue-600"} h-4 w-4 shrink-0`} />
                  </div>
                ) : (
                  <>
                    <div className="min-w-0 flex-1 pr-2">
                      <p
                        className={`truncate text-sm font-semibold transition-opacity duration-150 ${
                          isMobileProfileHeaderCompact ? "opacity-100" : "opacity-0"
                        }`}
                      >
                        {currentUser?.name ?? "Perfil"}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Escanear QR"
                      title="Escanear QR"
                      className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${
                        isDarkTheme
                          ? "border-slate-200/80 bg-slate-100 text-slate-900 hover:bg-white"
                          : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                      }`}
                    >
                      <ScanLine className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Pesquisar"
                      title="Pesquisar"
                      onClick={() => setIsMobileProfileSearchOpen(true)}
                      className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                        isDarkTheme ? "text-slate-200 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <Search className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
              <div
                ref={mobileProfileSheetScrollRef}
                className="flex-1 overflow-y-auto px-0 py-0"
                onScroll={handleMobileProfileSheetScroll}
              >
                {isMobileProfileSearchOpen ? null : (
                  <div
                    className={`flex flex-col items-center border-b px-4 py-4 text-center ${settingsBorder}`}
                    style={{
                      opacity: 1 - mobileProfileHeaderFade,
                      transform: `translateY(${-mobileProfileHeaderFade * 22}px) scale(${1 - mobileProfileHeaderFade * 0.08})`,
                      transformOrigin: "top center",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileProfileSheetOpen(false);
                        resetPanelsForMobileNavigation();
                        handleOpenProfile("self");
                      }}
                      className="group relative rounded-xl"
                      aria-label="Editar avatar"
                      title="Editar avatar"
                    >
                      {currentUser?.avatarUrl ? (
                        <img
                          src={currentUser.avatarUrl}
                          alt={`Avatar de ${currentUser?.name ?? "Participante"}`}
                          className={`h-[4.6rem] w-[4.6rem] ${avatarFrameMd} object-cover`}
                        />
                      ) : (
                        <div
                          className={`grid h-[4.6rem] w-[4.6rem] place-items-center ${avatarFrameMd} text-sm font-semibold ${
                            isDarkTheme ? "bg-slate-900 text-slate-200" : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {getAvatarText(currentUser?.name ?? "KN")}
                        </div>
                      )}
                      <span className="pointer-events-none absolute inset-0 grid place-items-center rounded-xl bg-black/0 text-[10px] font-semibold text-white opacity-0 transition group-hover:bg-black/45 group-hover:opacity-100">
                        Editar
                      </span>
                    </button>
                    <div className="min-w-0">
                      <p className="mt-2 truncate text-base font-semibold">{currentUser?.name ?? "Perfil"}</p>
                      <p className={`mt-1 truncate text-xs ${settingsMuted}`}>{currentUser?.knexIdLabel}</p>
                    </div>
                  </div>
                )}
                <div className={`px-0 ${isMobileProfileSearchOpen ? "py-0" : "py-2"}`}>
                  <p className={`px-3 pb-1 pt-2 text-xs font-semibold tracking-[0.08em] ${settingsMuted}`}>
                    Configurações
                  </p>
                  {filteredMobileProfileSheetItems.map((item) => {
                    const Icon = item.icon;
                    const isMobileSettingEnabled = item.id === "chats" || item.id === "avatar";
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          if (!isMobileSettingEnabled) return;
                          item.onSelect();
                        }}
                        className={`flex w-full items-start gap-3 rounded-2xl px-3 py-2 text-left transition ${settingsHover}`}
                      >
                        <span
                          className={`mt-0.5 grid h-8 w-8 place-items-center ${
                            isDarkTheme ? "text-slate-100" : "text-slate-700"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{item.label}</span>
                          <span className={`block truncate text-[11px] ${settingsMuted}`}>{item.description}</span>
                        </span>
                      </button>
                    );
                  })}
                  {filteredMobileProfileSheetItems.length ? null : (
                    <p className={`px-4 py-4 text-xs ${settingsMuted}`}>Nenhuma configuração encontrada.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
      {desktopConversationContextMenu && !isMobileView ? (
        <div
          ref={desktopConversationContextMenuRef}
          className={`fixed z-[108] w-[272px] overflow-hidden rounded-2xl border py-2 shadow-2xl ${
            isDarkTheme ? "border-[#2a2a2a] bg-[#1b1b1b]" : "border-slate-200 bg-white"
          }`}
          style={{ left: desktopConversationContextMenu.x, top: desktopConversationContextMenu.y }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
          role="menu"
        >
          {desktopConversationContextMenuSections.map((section, sectionIndex) => (
            <div key={`desktop-conversation-context-section-${sectionIndex}`}>
              {section.map((item) => {
                const Icon = item.icon;
                const isDanger = item.tone === "danger";
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleDesktopConversationContextAction(item.action)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${
                      isDanger
                        ? isDarkTheme
                          ? "text-rose-300 hover:bg-rose-500/20"
                          : "text-rose-600 hover:bg-rose-100"
                        : isDarkTheme
                          ? "text-slate-200 hover:bg-white/5"
                          : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-sm">{item.label}</span>
                  </button>
                );
              })}
              {sectionIndex < desktopConversationContextMenuSections.length - 1 ? (
                <div className={`mx-2 my-2 h-px ${isDarkTheme ? "bg-white/10" : "bg-slate-200"}`} />
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      {messageMediaContextMenu && !isMobileView ? (
        <div
          ref={messageMediaContextMenuRef}
          className={`fixed z-[110] w-[320px] overflow-hidden rounded-2xl border shadow-2xl ${mediaContextMenuSurface}`}
          style={{ left: messageMediaContextMenu.x, top: messageMediaContextMenu.y }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
          role="menu"
        >
          <div className="flex items-center gap-1.5 px-2.5 py-2">
            {MEDIA_CONTEXT_REACTIONS.map((emoji) => (
              <button
                key={`${messageMediaContextMenu.messageId}-${emoji}`}
                type="button"
                onClick={handleMessageMediaContextMenuAction}
                className={`grid h-9 w-9 place-items-center rounded-full text-xl transition ${mediaContextMenuReaction}`}
                aria-label={`Reagir com ${emoji}`}
              >
                <span aria-hidden="true">{emoji}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={handleMessageMediaContextMenuAction}
              className={`ml-auto grid h-9 w-9 place-items-center rounded-full transition ${mediaContextMenuReaction}`}
              aria-label="Mais reações"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
          <div className={`h-px ${mediaContextMenuDivider}`} />
          <div className="py-1">
            <button
              type="button"
              onClick={handleMessageMediaContextMenuAction}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${mediaContextMenuOption}`}
            >
              <Reply className="h-4 w-4" />
              <span className="text-sm">Responder</span>
            </button>
            <button
              type="button"
              onClick={handleMessageMediaContextMenuCopy}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${mediaContextMenuOption}`}
            >
              <Copy className="h-4 w-4" />
              <span className="text-sm">Copiar</span>
            </button>
            <button
              type="button"
              onClick={handleMessageMediaContextMenuAction}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${mediaContextMenuOption}`}
            >
              <ArrowRight className="h-4 w-4" />
              <span className="text-sm">Encaminhar</span>
            </button>
            <button
              type="button"
              onClick={handleMessageMediaContextMenuAction}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${mediaContextMenuOption}`}
            >
              <Pin className="h-4 w-4" />
              <span className="text-sm">Fixar</span>
            </button>
            <button
              type="button"
              onClick={handleMessageMediaContextMenuAction}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${mediaContextMenuOption}`}
            >
              <Star className="h-4 w-4" />
              <span className="text-sm">Favoritar</span>
            </button>
            <div className={`my-1 h-px ${mediaContextMenuDivider}`} />
            <button
              type="button"
              onClick={handleMessageMediaContextMenuAction}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${mediaContextMenuOption}`}
            >
              <CheckSquare className="h-4 w-4" />
              <span className="text-sm">Selecionar</span>
            </button>
            <button
              type="button"
              onClick={handleMessageMediaContextMenuSaveAs}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${mediaContextMenuOption}`}
            >
              <Download className="h-4 w-4" />
              <span className="text-sm">Salvar como</span>
            </button>
            <div className={`my-1 h-px ${mediaContextMenuDivider}`} />
            <button
              type="button"
              onClick={handleMessageMediaContextMenuAction}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${
                isDarkTheme ? "text-rose-300 hover:bg-rose-500/15" : "text-rose-600 hover:bg-rose-50"
              }`}
            >
              <Trash2 className="h-4 w-4" />
              <span className="text-sm">Apagar</span>
            </button>
          </div>
        </div>
      ) : null}
      {isProfileOpen && isProfileAvatarPreviewOpen ? (
        <div className={`fixed inset-0 z-[120] flex flex-col ${isDarkTheme ? "bg-[#0b0f17]" : "bg-white"}`}>
          <header
            className={`flex items-center justify-between border-b px-3 py-2.5 ${
              isDarkTheme ? "border-[#2a2a2a] bg-[#111827] text-slate-100" : "border-slate-200 bg-white text-slate-900"
            }`}
          >
            <div className="min-w-0 flex items-center gap-2">
              <button
                type="button"
                onClick={closeProfileAvatarPreview}
                className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                  isDarkTheme ? "text-slate-200 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"
                }`}
                aria-label="Voltar"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <p className="truncate text-sm font-semibold">Foto do perfil</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsProfileAvatarActionMenuOpen(true)}
                disabled={!canEditProfile || profileAvatarUploading}
                className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                  isDarkTheme ? "text-slate-200 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"
                } disabled:cursor-not-allowed disabled:opacity-45`}
                aria-label="Editar foto do perfil"
                title="Editar foto do perfil"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleShareProfileAvatar}
                className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                  isDarkTheme ? "text-slate-200 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"
                }`}
                aria-label="Compartilhar foto do perfil"
                title="Compartilhar foto do perfil"
              >
                <Share2 className="h-4 w-4" />
              </button>
              {canEditProfile ? (
                <input
                  ref={profileAvatarInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleProfileAvatarChange}
                  disabled={profileAvatarUploading}
                />
              ) : null}
              {canEditProfile ? (
                <input
                  ref={profileAvatarCameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={handleProfileAvatarChange}
                  disabled={profileAvatarUploading}
                />
              ) : null}
            </div>
          </header>
          {profileAvatarNotice ? (
            <div className={`border-b px-4 py-2 text-xs ${isDarkTheme ? "border-[#2a2a2a]" : "border-slate-200"}`}>
              <p
                className={`${
                  profileAvatarNotice.toLowerCase().includes("atualizada") || profileAvatarNotice.toLowerCase().includes("copiado")
                    ? isDarkTheme
                      ? "text-emerald-300"
                      : "text-emerald-700"
                    : isDarkTheme
                      ? "text-rose-300"
                      : "text-rose-600"
                }`}
              >
                {profileAvatarNotice}
              </p>
            </div>
          ) : null}
          <div className="flex flex-1 items-center justify-center px-4 py-4">
            {profileData?.avatarUrl ? (
              <img
                src={profileData.avatarUrl}
                alt={`Avatar ampliado de ${profileData.title}`}
                className={`h-[min(82vh,88vw)] w-[min(82vh,88vw)] ${avatarFrameLg} object-cover`}
              />
            ) : (
              <div
                className={`grid h-[min(82vh,88vw)] w-[min(82vh,88vw)] place-items-center ${avatarFrameLg} text-2xl font-semibold ${
                  isDarkTheme ? "bg-slate-900 text-slate-200" : "bg-slate-100 text-slate-700"
                }`}
              >
                {profileData?.avatarText ?? "KN"}
              </div>
            )}
          </div>
          {isProfileAvatarActionMenuOpen ? (
            <>
              <button
                type="button"
                onClick={() => setIsProfileAvatarActionMenuOpen(false)}
                className="absolute inset-0 bg-black/35"
                aria-label="Fechar menu de foto do perfil"
              />
              <section
                className={`knex-sheet-up absolute inset-x-0 bottom-0 z-10 h-auto max-h-[70vh] overflow-hidden border-t ${
                  isDarkTheme ? "border-[#2a2a2a] bg-[#111827] text-slate-100" : "border-slate-200 bg-white text-slate-900"
                }`}
              >
                <header className={`flex items-center justify-between border-b px-3 py-2.5 ${isDarkTheme ? "border-[#2a2a2a]" : "border-slate-200"}`}>
                  <button
                    type="button"
                    onClick={() => setIsProfileAvatarActionMenuOpen(false)}
                    className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                      isDarkTheme ? "text-slate-200 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"
                    }`}
                    aria-label="Fechar menu"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <p className="text-sm font-semibold">Foto do perfil</p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileAvatarActionMenuOpen(false);
                      setProfileAvatarNotice("Remoção de foto ficará disponível em breve.");
                    }}
                    className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                      isDarkTheme ? "text-rose-200 hover:bg-rose-500/20" : "text-rose-600 hover:bg-rose-50"
                    }`}
                    aria-label="Remover foto do perfil"
                    title="Remover foto do perfil"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </header>
                <div className="max-h-[calc(70vh-3.5rem)] space-y-1 overflow-y-auto px-3 py-3">
                  <button
                    type="button"
                    onClick={() => {
                      void handleOpenProfileAvatarCamera();
                    }}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold transition ${
                      isDarkTheme ? "hover:bg-white/10" : "hover:bg-slate-100"
                    }`}
                  >
                    <Camera className={`h-4 w-4 ${settingsMuted}`} />
                    <span>Câmera</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileAvatarActionMenuOpen(false);
                      profileAvatarInputRef.current?.click();
                    }}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold transition ${
                      isDarkTheme ? "hover:bg-white/10" : "hover:bg-slate-100"
                    }`}
                  >
                    <ImageIcon className={`h-4 w-4 ${settingsMuted}`} />
                    <span>Galeria</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileAvatarActionMenuOpen(false);
                      setProfileAvatarNotice("Biblioteca de avatar ficará disponível em breve.");
                    }}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold transition ${
                      isDarkTheme ? "hover:bg-white/10" : "hover:bg-slate-100"
                    }`}
                  >
                    <User className={`h-4 w-4 ${settingsMuted}`} />
                    <span>Avatar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileAvatarActionMenuOpen(false);
                      setProfileAvatarNotice("Importação do Instagram ficará disponível em breve.");
                    }}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold transition ${
                      isDarkTheme ? "hover:bg-white/10" : "hover:bg-slate-100"
                    }`}
                  >
                    <Link2 className={`h-4 w-4 ${settingsMuted}`} />
                    <span>Importar do Instagram</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileAvatarActionMenuOpen(false);
                      setProfileAvatarNotice("Imagens de IA ficarão disponíveis em breve.");
                    }}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold transition ${
                      isDarkTheme ? "hover:bg-white/10" : "hover:bg-slate-100"
                    }`}
                  >
                    <Shapes className={`h-4 w-4 ${settingsMuted}`} />
                    <span>imagens de IA</span>
                  </button>
                </div>
              </section>
            </>
          ) : null}
          {isProfileAvatarDesktopCameraOpen ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 px-4 py-4">
              <div
                className={`w-full max-w-md overflow-hidden rounded-3xl border ${
                  isDarkTheme ? "border-[#2a2a2a] bg-[#111827]" : "border-slate-200 bg-white"
                }`}
              >
                <div className="aspect-[3/4] w-full bg-black">
                  {profileAvatarDesktopCameraCapturedPreview ? (
                    <img
                      src={profileAvatarDesktopCameraCapturedPreview}
                      alt="Pré-visualização da foto capturada"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <video
                      ref={profileAvatarDesktopCameraVideoRef}
                      className="h-full w-full object-cover"
                      autoPlay
                      muted
                      playsInline
                    />
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 px-3 py-3">
                  {profileAvatarDesktopCameraCapturedPreview ? (
                    <button
                      type="button"
                      onClick={() => void handleOpenProfileAvatarCamera()}
                      disabled={profileAvatarUploading}
                      className={`flex min-h-[40px] items-center gap-2 rounded-full px-3 text-sm font-semibold transition ${
                        isDarkTheme ? "text-slate-200 hover:bg-white/10" : "text-slate-700 hover:bg-slate-100"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      <Camera className="h-4 w-4" />
                      Tirar outra
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsProfileAvatarDesktopCameraOpen(false)}
                      className={`flex min-h-[40px] items-center gap-2 rounded-full px-3 text-sm font-semibold transition ${
                        isDarkTheme ? "text-slate-200 hover:bg-white/10" : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <X className="h-4 w-4" />
                      Cancelar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      profileAvatarDesktopCameraCapturedPreview
                        ? void handleApplyProfileAvatarFromDesktopCamera()
                        : void handleCaptureProfileAvatarFromDesktopCamera()
                    }
                    disabled={profileAvatarUploading}
                    className={`flex min-h-[40px] items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${
                      isDarkTheme ? "bg-blue-500/30 text-blue-100 hover:bg-blue-500/40" : "bg-blue-600 text-white hover:bg-blue-700"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {profileAvatarDesktopCameraCapturedPreview ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                    {profileAvatarDesktopCameraCapturedPreview ? "Usar foto" : "Capturar"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {isConversationMediaViewerOpen && activeConversationMediaItem ? (
        <div
          className={`${isMobileView ? "fixed inset-0 bg-black" : "absolute inset-0 bg-[#e7e7e7]"} z-[90] flex flex-col`}
          onClick={handleConversationMediaViewerOverlayClick}
          role="presentation"
        >
          <div
            className={`z-10 flex items-center justify-between px-4 py-3 ${
              isMobileView
                ? `absolute inset-x-0 top-0 bg-black/45 transition-all duration-200 ${
                    isConversationMediaViewerChromeVisible
                      ? "pointer-events-auto opacity-100 translate-y-0"
                      : "pointer-events-none opacity-0 -translate-y-3"
                  }`
                : "border-b border-slate-300/80"
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="min-w-0 flex items-center gap-3">
              {activeConversationMediaItem.senderAvatarUrl ? (
                <img
                  src={activeConversationMediaItem.senderAvatarUrl}
                  alt={`Avatar de ${activeConversationMediaItem.senderName}`}
                  className={`h-10 w-10 ${avatarFrameSm} object-cover`}
                />
              ) : (
                <div
                  className={`grid h-10 w-10 place-items-center ${avatarFrameSm} text-xs font-semibold ${
                    isMobileView ? "bg-white/20 text-white" : "bg-slate-300 text-slate-700"
                  }`}
                >
                  {getAvatarText(activeConversationMediaItem.senderName)}
                </div>
              )}
              <div className="min-w-0">
                <p className={`truncate text-sm font-semibold ${isMobileView ? "text-white" : "text-slate-900"}`}>
                  {activeConversationMediaItem.senderName}
                </p>
                <p className={`truncate text-xs ${isMobileView ? "text-white/80" : "text-slate-600"}`}>
                  {activeConversationMediaItem.time}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={activeConversationMediaItem.src}
                download={activeConversationMediaItem.label}
                target="_blank"
                rel="noreferrer"
                className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                  isMobileView ? "text-white hover:bg-white/20" : "text-slate-700 hover:bg-white/70"
                }`}
                aria-label="Baixar mídia"
                onClick={(event) => event.stopPropagation()}
              >
                <Download className="h-4 w-4" />
              </a>
              <button
                type="button"
                onClick={closeConversationMediaViewer}
                className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                  isMobileView ? "text-white hover:bg-white/20" : "text-slate-700 hover:bg-white/70"
                }`}
                aria-label="Fechar visualizador de mídia"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div
            className={`relative flex min-h-0 flex-1 items-center justify-center ${
              isMobileView ? "px-0 pb-0" : "px-4 pb-4 sm:px-14"
            }`}
            onClick={(event) => {
              if (!isMobileView) {
                event.stopPropagation();
              }
            }}
            onTouchStart={handleConversationMediaViewerTouchStart}
            onTouchEnd={handleConversationMediaViewerTouchEnd}
            onTouchCancel={() => {
              conversationMediaViewerTouchStartRef.current = null;
              conversationMediaViewerDidSwipeRef.current = false;
            }}
          >
            {activeConversationMediaItem.mediaType === "video" ? (
              <div
                className={`relative ${isMobileView ? "h-full w-full" : "max-h-full max-w-full overflow-hidden rounded-md shadow-lg"}`}
                onClick={handleConversationMediaViewerVideoSurfaceClick}
              >
                <video
                  ref={conversationMediaViewerVideoRef}
                  key={activeConversationMediaItem.id}
                  src={activeConversationMediaItem.src}
                  className={`max-h-full max-w-full bg-black object-contain ${isMobileView ? "h-full w-full rounded-none" : ""}`}
                  playsInline
                  preload="metadata"
                  onPlay={() => setIsConversationMediaViewerVideoPlaying(true)}
                  onPause={() => setIsConversationMediaViewerVideoPlaying(false)}
                  onEnded={() => setIsConversationMediaViewerVideoPlaying(false)}
                  onLoadedMetadata={(event) => {
                    const duration = Number.isFinite(event.currentTarget.duration)
                      ? event.currentTarget.duration
                      : 0;
                    event.currentTarget.playbackRate = conversationMediaViewerVideoPlaybackSpeed;
                    setConversationMediaViewerVideoDuration(duration);
                    setConversationMediaViewerVideoCurrentTime(event.currentTarget.currentTime || 0);
                  }}
                  onTimeUpdate={(event) => {
                    setConversationMediaViewerVideoCurrentTime(event.currentTarget.currentTime || 0);
                    if (Number.isFinite(event.currentTarget.duration)) {
                      setConversationMediaViewerVideoDuration(event.currentTarget.duration);
                    }
                  }}
                />
                {isConversationMediaViewerChromeVisible ? (
                  <div
                    className={`pointer-events-none absolute inset-x-0 bottom-0 px-3 py-2 text-[11px] text-white ${
                      isMobileView ? "bg-black/35" : "bg-black/45"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="shrink-0 tabular-nums">{conversationMediaViewerVideoCurrentLabel}</span>
                      <span className="shrink-0 tabular-nums">{conversationMediaViewerVideoDurationLabel}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
                        <span
                          className="block h-full rounded-full bg-white/90 transition-[width] duration-150"
                          style={{ width: `${conversationMediaViewerVideoProgressPercent}%` }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={cycleConversationMediaViewerVideoPlaybackSpeed}
                        className={`pointer-events-auto inline-flex h-6 min-w-[44px] items-center justify-center rounded-full px-2 text-[10px] font-semibold ${
                          isMobileView ? "bg-white/20 text-white" : "bg-white/25 text-white"
                        }`}
                        aria-label={`Alterar velocidade do video. Atual ${conversationMediaViewerVideoPlaybackSpeedLabel}`}
                      >
                        {conversationMediaViewerVideoPlaybackSpeedLabel}
                      </button>
                    </div>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={handleConversationMediaViewerVideoButtonClick}
                  className={`absolute left-1/2 top-1/2 z-10 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full transition ${
                    isMobileView ? "h-14 w-14" : "h-16 w-16"
                  } ${
                    isConversationMediaViewerVideoPlaying
                      ? "pointer-events-none opacity-0"
                      : "pointer-events-auto bg-black/55 text-white opacity-100 hover:bg-black/65"
                  }`}
                  aria-label="Reproduzir vídeo"
                >
                  <Play className="h-6 w-6" />
                </button>
              </div>
            ) : (
              <img
                src={activeConversationMediaItem.src}
                alt={activeConversationMediaItem.label}
                className={`max-h-full max-w-full object-contain ${isMobileView ? "h-full w-full" : "shadow-lg"}`}
              />
            )}
            {!isMobileView && conversationMediaItems.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={goToPreviousConversationMedia}
                  disabled={!hasPreviousConversationMedia}
                  className={`absolute left-3 top-1/2 -translate-y-1/2 grid place-items-center rounded-full transition ${
                    isMobileView ? "h-9 w-9" : "h-10 w-10"
                  } ${
                    hasPreviousConversationMedia
                      ? isMobileView
                        ? "bg-black/45 text-white hover:bg-black/60"
                        : "bg-slate-700/85 text-white hover:bg-slate-800"
                      : "cursor-not-allowed bg-slate-500/40 text-white/60"
                  }`}
                  aria-label="Mídia anterior"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={goToNextConversationMedia}
                  disabled={!hasNextConversationMedia}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 grid place-items-center rounded-full transition ${
                    isMobileView ? "h-9 w-9" : "h-10 w-10"
                  } ${
                    hasNextConversationMedia
                      ? isMobileView
                        ? "bg-black/45 text-white hover:bg-black/60"
                        : "bg-slate-700/85 text-white hover:bg-slate-800"
                      : "cursor-not-allowed bg-slate-500/40 text-white/60"
                  }`}
                  aria-label="Próxima mídia"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            ) : null}
          </div>
          {!isMobileView && conversationMediaItems.length > 1 ? (
            <div
              className="border-t border-slate-300/80 bg-white/70 px-3 py-2"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="no-scrollbar mx-auto flex max-w-full items-center justify-center gap-2 overflow-x-auto">
                {conversationMediaItems.map((item, index) => {
                  const isActive = index === conversationMediaViewerIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setConversationMediaViewerIndex(index)}
                      className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-md transition ${
                        isActive ? "ring-2 ring-blue-500" : "opacity-75 hover:opacity-100"
                      }`}
                      aria-label={`Abrir mídia ${index + 1}`}
                    >
                      {item.mediaType === "video" ? (
                        <div className="relative h-full w-full">
                          <video src={item.src} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                          <span className="pointer-events-none absolute inset-0 grid place-items-center bg-black/25">
                            <Play className="h-3.5 w-3.5 text-white" />
                          </span>
                        </div>
                      ) : (
                        <img src={item.src} alt={item.label} className="h-full w-full object-cover" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {isMediaModalOpen ? (
        <div
          className="absolute inset-0 z-[60] flex items-center justify-center bg-black/50 px-4"
          onClick={() => {
            setIsMediaModalOpen(false);
            setIsMediaSelectMode(false);
            setSelectedMediaIds([]);
            setIsMediaShareOpen(false);
            setShareSearch("");
            setShareMessage("");
            setSelectedShareContactIds([]);
            clearShareAudios();
            if (shareRecordingState === "recording") {
              stopShareRecording("discard");
            }
          }}
          role="presentation"
        >
          <div
            className={`relative flex h-[min(82vh,720px)] w-[min(94vw,1200px)] flex-col overflow-hidden rounded-3xl shadow-2xl ${
              isDarkTheme ? "bg-[#161616] text-slate-100" : "bg-white text-slate-900"
            } ${isMediaShareOpen ? "border-0" : `border ${settingsBorder}`}`}
            onClick={(event) => event.stopPropagation()}
          >
            {isMediaFilterOpen ? (
              <button
                type="button"
                aria-label="Fechar filtros"
                className="fixed inset-0 z-[60] cursor-default"
                onClick={() => setIsMediaFilterOpen(false)}
              />
            ) : null}
            <div className={`flex flex-wrap items-center gap-4 border-b px-5 py-4 ${settingsBorder}`}>
              <div className="min-w-[160px]">
                <p className="text-sm font-semibold">Mídia</p>
                <p className={`text-xs ${settingsMuted}`}>Mídias de todas as conversas</p>
              </div>
              <div className="flex flex-1 items-center justify-center gap-6">
                {MEDIA_TABS.map((tab) => {
                  const isActive = activeMediaTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveMediaTab(tab.key)}
                      className={`relative pb-2 text-sm font-semibold transition ${
                        isActive ? "text-blue-600" : settingsMuted
                      }`}
                    >
                      {tab.label}
                      <span
                        className={`absolute inset-x-0 -bottom-[1px] h-[2px] ${
                          isActive ? "bg-blue-500" : "bg-transparent"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
              <div className="ml-auto flex items-center gap-3">
                <button
                  type="button"
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                    isDarkTheme ? "text-slate-200 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"
                  }`}
                  aria-label="Pesquisar mídia"
                >
                  <Search className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setMediaGridVariant((prev) => (prev === "comfortable" ? "compact" : "comfortable"))
                  }
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                    isDarkTheme ? "text-slate-200 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"
                  }`}
                  aria-label="Alterar tamanho do grid"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsMediaFilterOpen((prev) => !prev)}
                    className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                      isDarkTheme ? "text-slate-200 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"
                    }`}
                    aria-label="Filtrar"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </button>
                  {isMediaFilterOpen ? (
                    <div
                      className={`absolute right-0 top-12 z-[70] w-56 rounded-2xl border p-4 shadow-xl ${
                        isDarkTheme ? "border-[#2a2a2a] bg-[#1b1b1b]" : "border-slate-200 bg-white"
                      }`}
                    >
                      <p className={`text-xs font-semibold ${settingsMuted}`}>Enviado por</p>
                      <div className="mt-2 space-y-2">
                        {[
                          { key: "all", label: "Todas" },
                          { key: "me", label: "Você" },
                          { key: "others", label: "Outros" },
                        ].map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => setMediaFilterSender(item.key as "all" | "me" | "others")}
                            className="flex w-full items-center gap-3 text-sm"
                          >
                            <span
                              className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                                mediaFilterSender === item.key
                                  ? "border-blue-500"
                                  : isDarkTheme
                                    ? "border-[#3a3a3a]"
                                    : "border-slate-300"
                              }`}
                            >
                              {mediaFilterSender === item.key ? (
                                <span className="h-2 w-2 rounded-full bg-blue-500" />
                              ) : null}
                            </span>
                            <span>{item.label}</span>
                          </button>
                        ))}
                      </div>
                      <div className={`my-4 h-px ${settingsBorder}`} />
                      <p className={`text-xs font-semibold ${settingsMuted}`}>Ordenar por</p>
                      <div className="mt-2 space-y-2">
                        {[
                          { key: "recent", label: "Mais recentes" },
                          { key: "old", label: "Mais antigas" },
                          { key: "big", label: "Maior" },
                        ].map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => setMediaFilterOrder(item.key as "recent" | "old" | "big")}
                            className="flex w-full items-center gap-3 text-sm"
                          >
                            <span
                              className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                                mediaFilterOrder === item.key
                                  ? "border-blue-500"
                                  : isDarkTheme
                                    ? "border-[#3a3a3a]"
                                    : "border-slate-300"
                              }`}
                            >
                              {mediaFilterOrder === item.key ? (
                                <span className="h-2 w-2 rounded-full bg-blue-500" />
                              ) : null}
                            </span>
                            <span>{item.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
                {isMediaSelectMode ? (
                  <button
                    type="button"
                    onClick={toggleMediaSelectMode}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                      isDarkTheme
                        ? "border-[#2a2a2a] text-blue-200 hover:bg-white/10"
                        : "border-slate-200 text-blue-600 hover:bg-blue-50"
                    }`}
                    aria-label="Cancelar seleção de mídias"
                  >
                    Cancelar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={toggleMediaSelectMode}
                    className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition ${
                      isDarkTheme
                        ? "border-slate-200 text-slate-200 hover:bg-white/10"
                        : "border-slate-600 text-slate-600 hover:bg-slate-100"
                    }`}
                    aria-label="Selecionar mídias"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                )}
                {!isMediaSelectMode ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsMediaModalOpen(false);
                    setIsMediaSelectMode(false);
                    setSelectedMediaIds([]);
                    setIsMediaShareOpen(false);
                    setShareSearch("");
                    setShareMessage("");
                    setSelectedShareContactIds([]);
                    clearShareAudios();
                    if (shareRecordingState === "recording") {
                      stopShareRecording("discard");
                    }
                  }}
                  className={`flex h-10 w-10 items-center justify-center rounded-full transition ${
                    isDarkTheme ? "text-slate-200 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"
                  }`}
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              ) : null}
              </div>
            </div>
            {isMediaShareOpen ? (
              <div
                className="absolute inset-0 z-[75] flex items-center justify-center bg-black/40 p-4"
                onClick={() => {
                  setIsMediaShareOpen(false);
                  setShareMessage("");
                  setShareSearch("");
                  setSelectedShareContactIds([]);
                  clearShareAudios();
                  if (shareRecordingState === "recording") {
                    stopShareRecording("discard");
                  }
                }}
                role="presentation"
              >
                <div
                  className={`relative flex h-[min(82vh,640px)] w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border shadow-2xl ${
                    isDarkTheme ? "bg-[#161616] text-slate-100" : "bg-white text-slate-900"
                  } ${settingsBorder}`}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className={`flex items-center gap-3 border-b px-4 py-3 ${settingsBorder}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMediaShareOpen(false);
                        setShareMessage("");
                        setShareSearch("");
                        setSelectedShareContactIds([]);
                        clearShareAudios();
                        if (shareRecordingState === "recording") {
                          stopShareRecording("discard");
                        }
                      }}
                      className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                        isDarkTheme ? "text-slate-200 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"
                      }`}
                      aria-label="Voltar"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-sm font-semibold">Encaminhar mensagem para</span>
                  </div>
                  <div className={`border-b px-4 py-3 ${settingsBorder}`}>
                    <div
                      className={`flex items-center gap-2 rounded-full border-[1.5px] px-3 py-2 text-xs ${
                        isDarkTheme
                          ? "border-blue-400/60 text-slate-200"
                          : "border-blue-400 text-slate-600"
                      }`}
                    >
                      <Search className={`${isDarkTheme ? "text-blue-300" : "text-blue-600"} h-4 w-4`} />
                      <input
                        type="text"
                        value={shareSearch}
                        onChange={(event) => setShareSearch(event.target.value)}
                        placeholder="Pesquisar nome ou e-mail"
                        className={`w-full bg-transparent text-xs focus:outline-none ${
                          isDarkTheme
                            ? "placeholder:text-slate-400 text-slate-100"
                            : "placeholder:text-slate-400 text-slate-700"
                        }`}
                      />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto px-4 py-4">
                    <p className={`text-[11px] font-semibold ${settingsMuted}`}>Conversas recentes</p>
                    {shareRecentContacts.length ? (
                      <div className="mt-3 space-y-3">
                        {shareRecentContacts.map((contact) => renderShareContact(contact))}
                      </div>
                    ) : (
                      <p className={`mt-3 text-xs ${settingsMuted}`}>Nenhuma conversa recente.</p>
                    )}
                    <p className={`mt-6 text-[11px] font-semibold ${settingsMuted}`}>Todos os contatos</p>
                    {shareDirectoryContacts.length ? (
                      <div className="mt-3 space-y-3">
                        {shareDirectoryContacts.map((contact) => renderShareContact(contact))}
                      </div>
                    ) : (
                      <p className={`mt-3 text-xs ${settingsMuted}`}>Nenhum contato encontrado.</p>
                    )}
                  </div>
                  <div
                    className={`border-t px-3 pt-3 pb-3 ${settingsBorder} ${
                      isDarkTheme ? "bg-[#1b1b1b]" : "bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {selectedMediaIds.length ? (
                        <div className="flex items-center gap-2">
                          <div className="flex h-[70px] min-w-0 flex-1 items-center gap-2">
                            {selectedMediaIds.length > 1 ? (
                              <button
                                type="button"
                                onClick={() => scrollShareThumbs("left")}
                                className={`flex h-6 w-6 items-center justify-center rounded-full transition ${
                                  isDarkTheme
                                    ? "text-slate-200 hover:bg-white/10"
                                    : "text-slate-600 hover:bg-slate-100"
                                }`}
                                aria-label="Voltar miniaturas"
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </button>
                            ) : null}
                            <div
                              ref={shareThumbsRef}
                              className={`flex min-w-[52px] flex-1 items-center gap-2 ${
                                selectedMediaIds.length > 1
                                  ? "overflow-x-auto overflow-y-visible scroll-smooth pr-2"
                                  : "overflow-visible"
                              }`}
                            >
                              {selectedMediaIds.map((id) => {
                                const item = mediaLibrary.find((media) => media.id === id);
                                if (!item) return null;
                                return (
                                  <div key={id} className="relative flex-shrink-0">
                                    <img
                                      src={item.src}
                                      alt={item.label}
                                      className="h-[70px] w-[70px] rounded-md object-cover"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setSelectedMediaIds((prev) => prev.filter((mediaId) => mediaId !== id))
                                      }
                                      className={`absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold text-white shadow ${
                                        isDarkTheme ? "bg-blue-500" : "bg-blue-600"
                                      }`}
                                      aria-label="Remover imagem selecionada"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                            {selectedMediaIds.length > 1 ? (
                              <button
                                type="button"
                                onClick={() => scrollShareThumbs("right")}
                                className={`flex h-6 w-6 items-center justify-center rounded-full transition ${
                                  isDarkTheme
                                    ? "text-slate-200 hover:bg-white/10"
                                    : "text-slate-600 hover:bg-slate-100"
                                }`}
                                aria-label="Avancar miniaturas"
                              >
                                <ChevronRight className="h-4 w-4" />
                              </button>
                            ) : null}
                          </div>
                          {selectedMediaIds.length > 1 ? (
                            <>
                              <div className={`h-10 w-px ${isDarkTheme ? "bg-[#2a2a2a]" : "bg-slate-200"}`} />
                              <div className="ml-4 flex min-w-[80px] flex-col">
                                <span className="text-[11px] font-semibold">Foto</span>
                                <span className={`text-[10px] ${settingsMuted}`}>
                                  {selectedMediaIds.length} imagens
                                </span>
                              </div>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                      {selectedMediaIds.length <= 1 ? (
                        <div className={`w-full ${selectedMediaIds.length ? "pl-2" : "pl-0"}`}>
                          <div className="flex items-start gap-2">
                            <div className="relative flex-1">
                              <textarea
                                value={shareMessage}
                                onChange={(event) => setShareMessage(event.target.value)}
                                placeholder="Adicione uma mensagem..."
                                rows={2}
                                className={`h-[70px] w-full resize-none rounded-md border px-3 pb-8 pt-2 text-xs focus:outline-none ${
                                  isDarkTheme
                                    ? "border-[#2a2a2a] bg-[#1b1b1b] text-slate-100 placeholder:text-slate-500"
                                    : "border-slate-200 bg-white text-slate-700 placeholder:text-slate-400"
                                }`}
                              />
                              {shareRecordingState === "recording" ? (
                                <div
                                  className={`absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2 text-[10px] ${
                                    isDarkTheme ? "text-slate-100" : "text-slate-600"
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => stopShareRecording("discard")}
                                      className={`flex h-5 w-5 items-center justify-center rounded-full transition ${
                                        isDarkTheme ? "text-slate-200 hover:bg-white/10" : "text-slate-500 hover:bg-slate-100"
                                      }`}
                                      aria-label="Descartar áudio"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                                    <span className="font-semibold">{formatDuration(shareRecordingSeconds)}</span>
                                  </div>
                                  <div className="mx-2 flex-1">
                                    <span className="knex-record-wave" aria-hidden="true">
                                      {shareRecordingWave.map((value, index) => {
                                        const height = 4 + value * 14;
                                        return (
                                          <span
                                            key={`share-wave-${index}`}
                                            className="knex-record-bar"
                                            style={{
                                              height: `${height}px`,
                                              animation: "none",
                                            }}
                                          />
                                        );
                                      })}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => stopShareRecording("keep")}
                                      className={`flex h-5 w-5 items-center justify-center rounded-full transition ${
                                        isDarkTheme ? "text-slate-200 hover:bg-white/10" : "text-slate-500 hover:bg-slate-100"
                                      }`}
                                      aria-label="Encerrar áudio"
                                    >
                                      <Pause className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                if (shareRecordingState === "recording") return;
                                if (isShareAudioLimitReached) return;
                                startShareRecording();
                              }}
                              className={`flex h-[70px] w-10 items-center justify-center rounded-md border transition ${
                                isDarkTheme
                                  ? "border-[#2a2a2a] text-slate-200 hover:bg-white/10"
                                  : "border-slate-200 text-slate-600 hover:bg-slate-100"
                              }`}
                              aria-label="Gravar áudio"
                              title={isShareAudioLimitReached ? "Limite de 4 áudios" : "Gravar áudio"}
                              disabled={shareRecordingState === "recording" || isShareAudioLimitReached}
                            >
                              <Mic className="h-4 w-4" />
                            </button>
                            <input
                              ref={shareAudioInputRef}
                              type="file"
                              accept="audio/*"
                              className="sr-only"
                              onChange={handleShareAudioChange}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                    {shareAudioFiles.length ? (
                      <div className="mt-2 grid grid-cols-2 gap-2 justify-items-center">
                        {shareAudioFiles.map((entry, index) => {
                          const isPlaying = shareAudioPlayingId === entry.id;
                          const isPaused = isPlaying && shareAudioIsPaused;
                          const isOddLast =
                            shareAudioFiles.length % 2 === 1 &&
                            index === shareAudioFiles.length - 1;
                          const playbackWave =
                            entry.waveform && entry.waveform.length
                              ? entry.waveform
                              : Array.from({ length: shareWaveBarCount }, () => 0.18);
                          const totalSeconds =
                            entry.durationSeconds ??
                            (entry.duration
                              ? entry.duration
                                  .split(":")
                                  .map((part) => Number(part))
                                  .reduce((acc, value) => acc * 60 + value, 0)
                              : 0);
                          const progress =
                            totalSeconds > 0 ? Math.min(1, shareAudioPlaybackSeconds / totalSeconds) : 0;
                          return (
                            <div
                              key={entry.id}
                              className={`w-full max-w-[240px] justify-self-center ${
                                isOddLast ? "col-span-2 max-w-[260px]" : ""
                              }`}
                            >
                              <div
                                className={`flex w-full items-center gap-2 rounded-full px-3 py-2 text-[11px] font-semibold ${
                                  isDarkTheme
                                    ? "bg-blue-500/20 text-blue-100"
                                    : "bg-blue-100 text-blue-700"
                                }`}
                              >
                                {isPlaying ? (
                                  <div className="flex w-full flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => toggleShareAudioPlayback(entry)}
                                        className={`flex h-5 w-5 items-center justify-center rounded-full ${
                                          isDarkTheme ? "text-blue-100" : "text-blue-700"
                                        }`}
                                        aria-label={isPaused ? "Retomar áudio" : "Pausar áudio"}
                                      >
                                        {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                                      </button>
                                      <span className={`h-2 w-2 rounded-full ${isDarkTheme ? "bg-blue-300" : "bg-blue-500"}`} />
                                      <span className="flex flex-1 justify-center">
                                        <span className="relative inline-flex h-5 items-end gap-1" aria-hidden="true">
                                          {playbackWave.map((value, waveIndex) => {
                                            const height = 4 + value * 16;
                                            const baseColor = isDarkTheme ? "rgba(148,163,184,0.75)" : "rgba(148,163,184,0.9)";
                                            return (
                                              <span
                                                key={`play-wave-${entry.id}-${waveIndex}`}
                                                className="rounded-full"
                                                style={{
                                                  width: "2px",
                                                  height: `${height}px`,
                                                  backgroundColor: baseColor,
                                                }}
                                              />
                                            );
                                          })}
                                          {totalSeconds > 0 ? (
                                            <span
                                              className="pointer-events-none absolute bottom-0 h-5 w-0.5"
                                              style={{
                                                left: `${Math.min(100, Math.max(0, progress * 100))}%`,
                                                backgroundColor: isDarkTheme ? "#60a5fa" : "#2563eb",
                                                boxShadow: isDarkTheme
                                                  ? "0 0 6px rgba(96,165,250,0.9)"
                                                  : "0 0 6px rgba(37,99,235,0.8)",
                                              }}
                                            />
                                          ) : null}
                                        </span>
                                      </span>
                                      <button
                                        type="button"
                                        onClick={cycleShareAudioPlaybackSpeed}
                                        className={`inline-flex h-5 min-w-[34px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${
                                          isDarkTheme
                                            ? "text-blue-100 hover:bg-blue-500/30"
                                            : "text-blue-700 hover:bg-blue-200/60"
                                        }`}
                                        aria-label={`Alterar velocidade do audio. Atual ${shareAudioPlaybackSpeedLabel}`}
                                      >
                                        {shareAudioPlaybackSpeedLabel}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => removeShareAudioById(entry.id)}
                                        className={`flex h-5 w-5 items-center justify-center rounded-full ${
                                          isDarkTheme
                                            ? "text-blue-100 hover:bg-blue-500/30"
                                            : "text-blue-700 hover:bg-blue-200/60"
                                        }`}
                                        aria-label="Remover áudio"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                    <div
                                      className={`flex items-center justify-between text-[10px] font-medium ${
                                        isDarkTheme ? "text-blue-100/80" : "text-blue-700/70"
                                      }`}
                                    >
                                      <span>{formatDuration(Math.floor(shareAudioPlaybackSeconds))}</span>
                                      <span>{totalSeconds ? formatDuration(totalSeconds) : entry.duration ?? ""}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => toggleShareAudioPlayback(entry)}
                                      className={`flex h-5 w-5 items-center justify-center rounded-full ${
                                        isDarkTheme ? "text-blue-100" : "text-blue-700"
                                      }`}
                                      aria-label="Ouvir áudio"
                                    >
                                      <Play className="h-3 w-3" />
                                    </button>
                                    <span className="flex-1">
                                      Áudio {index + 1}
                                      {entry.duration ? ` · ${entry.duration}` : ""}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={cycleShareAudioPlaybackSpeed}
                                      className={`inline-flex h-5 min-w-[34px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${
                                        isDarkTheme
                                          ? "text-blue-100 hover:bg-blue-500/30"
                                          : "text-blue-700 hover:bg-blue-200/60"
                                      }`}
                                      aria-label={`Alterar velocidade do audio. Atual ${shareAudioPlaybackSpeedLabel}`}
                                    >
                                      {shareAudioPlaybackSpeedLabel}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => removeShareAudioById(entry.id)}
                                      className={`flex h-5 w-5 items-center justify-center rounded-full ${
                                        isDarkTheme
                                          ? "text-blue-100 hover:bg-blue-500/30"
                                          : "text-blue-700 hover:bg-blue-200/60"
                                      }`}
                                      aria-label="Remover áudio"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                    {selectedShareContactIds.length ? (
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {selectedShareContactIds
                              .map(
                                (id) =>
                                  shareAllSelectable.find((contact) => contact.id === id)?.title ?? "Selecionado",
                              )
                              .join(", ")}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleShareSend}
                          className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-white shadow transition hover:bg-blue-700"
                          aria-label="Enviar"
                        >
                          <SendHorizontal className="h-5 w-5" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
            <div className="flex flex-1 min-h-0 flex-col">
              <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
                {activeMediaTab === "media" ? (
                  <div
                    className={`grid gap-3 ${
                      mediaGridVariant === "compact"
                        ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
                        : "grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                    }`}
                  >
                    {mediaItems.map((item) => {
                      const isSelected = selectedMediaIds.includes(item.id);
                      return (
                        <div
                          key={item.id}
                          className={`group relative aspect-square overflow-hidden rounded-xl border shadow-sm transition ${
                            isDarkTheme ? "border-[#2a2a2a] bg-[#202020]" : "border-slate-200 bg-slate-100"
                          } ${isMediaSelectMode && isSelected ? "ring-2 ring-blue-500" : ""}`}
                        >
                        <img
                          src={item.src}
                          alt={item.label}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                        {item.isFavorite ? (
                          <span className="absolute left-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-amber-500 shadow">
                            <Star className="h-4 w-4" />
                          </span>
                        ) : null}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-3">
                          {item.mediaType === "video" ? (
                            <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold text-white">
                              <Video className="h-3.5 w-3.5" />
                              <span>{item.duration ?? "0:00"}</span>
                            </div>
                          ) : null}
                          <p className="text-xs font-semibold text-white">
                            {item.thread?.title ?? item.label}
                          </p>
                            <p className="text-[10px] text-white/80">{item.caption ?? item.label}</p>
                          </div>
                          {isMediaSelectMode ? (
                            <button
                              type="button"
                              onClick={() => toggleMediaSelection(item.id)}
                              className={`absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full border text-xs font-semibold transition ${
                                isSelected
                                  ? "border-blue-500 bg-blue-500 text-white"
                                  : isDarkTheme
                                    ? "border-[#3a3a3a] bg-black/30 text-slate-100"
                                    : "border-slate-200 bg-white/80 text-slate-600"
                              }`}
                              aria-label={isSelected ? "Remover seleção" : "Selecionar mídia"}
                            >
                              {isSelected ? <Check className="h-3 w-3" /> : null}
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm">
                    <span className={settingsMuted}>
                      {activeMediaTab === "docs"
                        ? "Nenhum documento compartilhado ainda."
                        : "Nenhum link compartilhado ainda."}
                    </span>
                  </div>
                )}
              </div>
              {activeMediaTab === "media" && isMediaSelectMode ? (
                <div
                  className={`sticky bottom-0 flex items-center justify-between border-t px-5 py-3 text-xs ${settingsBorder} ${
                    isDarkTheme ? "bg-[#161616]" : "bg-white"
                  }`}
                >
                  <div
                    className="flex items-center gap-2"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedMediaIds.length) return;
                        setMediaLibrary((prev) => prev.filter((item) => !selectedMediaIds.includes(item.id)));
                        setSelectedMediaIds([]);
                      }}
                      className={`flex items-center gap-2 rounded-full px-3 py-2 text-[11px] font-semibold transition ${
                        selectedMediaSummary.count
                          ? "bg-rose-500 text-white hover:bg-rose-600"
                          : "bg-rose-200 text-white"
                      }`}
                      aria-label="Excluir selecionadas"
                      disabled={!selectedMediaSummary.count}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>{selectedMediaSummary.sizeLabel}</span>
                    </button>
                  </div>
                  <span className={`text-xs ${settingsMuted}`}>
                    {selectedMediaSummary.count} selecionada{selectedMediaSummary.count === 1 ? "" : "s"}
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleFavoriteSelected}
                      disabled={!selectedMediaSummary.count}
                      className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                        selectedMediaSummary.count
                          ? isDarkTheme
                            ? "text-slate-100 hover:bg-white/10"
                            : "text-slate-600 hover:bg-slate-100"
                          : "text-slate-400 opacity-50"
                      }`}
                      aria-label="Favoritar"
                    >
                      <Star className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadSelected}
                      disabled={!selectedMediaSummary.count}
                      className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                        selectedMediaSummary.count
                          ? isDarkTheme
                            ? "text-slate-100 hover:bg-white/10"
                            : "text-slate-600 hover:bg-slate-100"
                          : "text-slate-400 opacity-50"
                      }`}
                      aria-label="Baixar"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedMediaSummary.count) return;
                        setIsMediaShareOpen(true);
                        setIsMediaFilterOpen(false);
                        setShareSearch("");
                        setShareMessage("");
                        setSelectedShareContactIds([]);
                        clearShareAudios();
                      }}
                      disabled={!selectedMediaSummary.count}
                      className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                        selectedMediaSummary.count
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "bg-blue-200 text-white opacity-60"
                      }`}
                      aria-label="Compartilhar"
                    >
                      <SendHorizontal className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      </div>
      {debugUiEnabled && debugUiSnapshot ? (
        <div className="pointer-events-none fixed bottom-2 left-2 z-[200] w-[min(90vw,460px)] rounded-xl border border-slate-300 bg-white/95 p-2 text-[11px] leading-4 text-slate-700 shadow-lg backdrop-blur">
          <p className="font-semibold text-slate-900">KnexChat Debug UI</p>
          <p>route: {debugUiSnapshot.route}</p>
          <p>env: {debugUiSnapshot.env}</p>
          <p>viewport: {debugUiSnapshot.viewport}</p>
          <p>visualViewport: {debugUiSnapshot.visualViewport}</p>
          <p>root font-size: {debugUiSnapshot.rootFontSize}</p>
          <p className="truncate">ua: {debugUiSnapshot.userAgent}</p>
        </div>
      ) : null}
    </main>
  );
}

