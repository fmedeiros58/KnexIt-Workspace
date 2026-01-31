"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  BellOff,
  ArrowRight,
  X,
  XCircle,
  Camera,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Download,
  Flag,
  HelpCircle,
  Hash,
  Radio,
  Shapes,
  Grip,
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
  Plus,
  FolderOpen,
  Smartphone,
  Star,
  Users2,
  Pause,
  Phone,
  Play,
  SendHorizontal,
  UserPlus,
  ZoomIn,
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
import EmojiPicker, { Theme } from "emoji-picker-react";
import { Manrope, Space_Grotesk } from "next/font/google";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabaseClient";

const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });

const STORAGE_KEY = "knexchat.identity";
const CHAT_STATE_KEY = "knexchat.state.v1";
const DIRECTORY_KEY = "knexchat.directory.v1";
const INBOX_KEY = "knexchat.inbox.v1";
const SHOW_OTP_PREVIEW = process.env.NEXT_PUBLIC_KNEXCHAT_SHOW_OTP === "1";
const MOCK_RESEND_WARNING =
  "The knexit.com domain is not verified. Please, add and verify your domain on https://resend.com/domains";
const OTP_CODE_REGEX = /^\d{6}$/;

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
      .knex-bubble {
        display: inline-flex;
        flex-direction: column;
        max-width: 75%;
        width: fit-content;
        padding: 10px 14px;
        border-radius: 18px;
        line-height: 1.35;
        word-break: break-word;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
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
        border-radius: 18px 4px 18px 18px;
      }
      .knex-bubble__text {
        font-size: 14px;
      }
      .knex-bubble--media {
        padding: 8px;
      }
      .knex-bubble__media {
        width: clamp(180px, 22vw, 240px);
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .knex-bubble__image {
        width: 100%;
        aspect-ratio: 9 / 16;
        border-radius: 12px;
        display: block;
        object-fit: cover;
      }
      .knex-bubble__time {
        font-size: 11px;
        margin-top: 4px;
        align-self: flex-end;
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
};

type DirectoryEntry = {
  email: string;
  name?: string;
  createdAt: string;
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
type FilterKey = "all" | "unread" | "groups" | "contacts";
type MediaTabKey = "media" | "docs" | "links";

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
  participantRoles?: { email: string; role: "admin" | "member"; name?: string | null }[];
};

type ThreadMenuItem = {
  label: string;
  icon: LucideIcon;
  action?: "contact-info" | "group-info";
  tone?: "danger";
};

type ApiParticipant = { email: string; role: "admin" | "member"; name?: string | null };

type ApiThread = {
  id: string;
  kind: "direct" | "group" | "forum";
  title?: string | null;
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
  created_at: string;
};

type Message = {
  id: string;
  author: "me" | "them";
  body: string;
  time: string;
  senderName?: string;
  audioUrl?: string;
  audioDuration?: string;
  imageUrl?: string;
  imageName?: string;
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

function getThreadActivityTimestamp(thread: Thread) {
  return typeof thread.lastActivityAt === "number" ? thread.lastActivityAt : 0;
}

function getContactPrimaryKey(thread: Thread) {
  if (thread.contactEmail) return normalizeEmail(thread.contactEmail);
  const previewEmail = extractEmail(thread.preview);
  if (previewEmail) return previewEmail;
  return thread.id;
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
    const createdAt =
      typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString();
    entries.push({ email, name: name || undefined, createdAt });
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
  const [authSession, setAuthSession] = useState<Session | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [activationLayout, setActivationLayout] = useState<ActivationLayout>(() =>
    computeActivationLayout(1440, 900),
  );
  const [directoryEntries, setDirectoryEntries] = useState<DirectoryEntry[]>([]);
  const [directoryLookupCache, setDirectoryLookupCache] = useState<Record<string, boolean>>({});
  const serverMessagingEnabled = true;
  const [isServerSyncing, setIsServerSyncing] = useState(false);
  const [serverSyncError, setServerSyncError] = useState<string | null>(null);
  const [realtimeKey, setRealtimeKey] = useState(0);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [registeringName, setRegisteringName] = useState("");
  const [registeringEmail, setRegisteringEmail] = useState("");
  const [activationStep, setActivationStep] = useState<"email" | "otp">("email");
  const [otpGenerated, setOtpGenerated] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [activationError, setActivationError] = useState<string | null>(null);
  const [activationNotice, setActivationNotice] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
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
  const [messagesByThread, setMessagesByThread] = useState<Record<string, Message[]>>(MESSAGE_SEED);
  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "paused">("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [activeNavKey, setActiveNavKey] = useState<
    "conversations" | "calls" | "status" | "channels" | "communities" | "contacts" | "images" | "settings"
  >("conversations");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileTarget, setProfileTarget] = useState<"thread" | "self" | null>(null);
  const [isProfileAvatarPreviewOpen, setIsProfileAvatarPreviewOpen] = useState(false);
  const [profileNameDraft, setProfileNameDraft] = useState("");
  const [profileRecadoDraft, setProfileRecadoDraft] = useState("");
  const [chatListWidth, setChatListWidth] = useState(384);
  const [isChatListResizing, setIsChatListResizing] = useState(false);
  const [isThreadMenuOpen, setIsThreadMenuOpen] = useState(false);
  const [isContactInfoOpen, setIsContactInfoOpen] = useState(false);
  const [isContactEditOpen, setIsContactEditOpen] = useState(false);
  const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);
  const [isGroupPermissionsOpen, setIsGroupPermissionsOpen] = useState(false);
  const [isGroupAdminsModalOpen, setIsGroupAdminsModalOpen] = useState(false);
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
  const [isNewChatEmailOpen, setIsNewChatEmailOpen] = useState(false);
  const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);
  const [isNewGroupCreateOpen, setIsNewGroupCreateOpen] = useState(false);
  const [isGroupsPanelOpen, setIsGroupsPanelOpen] = useState(false);
  const [isGroupCreateOpen, setIsGroupCreateOpen] = useState(false);
  const [isCommunityListOpen, setIsCommunityListOpen] = useState(false);
  const [isNewContactOpen, setIsNewContactOpen] = useState(false);
  const [isGroupEmojiOpen, setIsGroupEmojiOpen] = useState(false);
  const [isGroupMembersExpanded, setIsGroupMembersExpanded] = useState(false);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
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
  const [isGroupsExpanded, setIsGroupsExpanded] = useState(false);
  const [conversationSearch, setConversationSearch] = useState("");
  const [newChatSearch, setNewChatSearch] = useState("");
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
  const [isWallpaperModalOpen, setIsWallpaperModalOpen] = useState(false);
  const [wallpaperHoverKey, setWallpaperHoverKey] = useState<string | null>(null);
  const [headerInfoStep, setHeaderInfoStep] = useState(0);
  const chatStateKey = useMemo(() => {
    if (!identity?.email) return null;
    return `${CHAT_STATE_KEY}:${normalizeEmail(identity.email)}`;
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
  const audioChunksRef = useRef<Blob[]>([]);
  const messageImageInputRef = useRef<HTMLInputElement | null>(null);
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
  const [shareAudioPlayingId, setShareAudioPlayingId] = useState<string | null>(null);
  const [shareAudioIsPaused, setShareAudioIsPaused] = useState(false);
  const incomingCountRef = useRef<Record<string, number>>({});
  const unreadInitializedRef = useRef(false);
  const chatListResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const threadMenuAnchorRef = useRef<HTMLButtonElement | null>(null);
  const threadMenuRef = useRef<HTMLDivElement | null>(null);

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
      avatarUrl: selfAvatarUrl,
      avatarText: getAvatarText(avatarSource),
    };
  }, [identity, selfAvatarUrl]);

  const resetChatState = useCallback(() => {
    setConversations(INITIAL_CONVERSATIONS);
    setGroups(INITIAL_GROUPS);
    setContacts(INITIAL_CONTACTS);
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
    setSettingsState({ ...DEFAULT_SETTINGS_STATE });
    setGroupDescriptions({});
    setGroupPermissionsById({});
    setGroupAdminIdsByGroup({});
    setSelfAvatarUrl(null);
    setThreadAvatarOverrides({});
    setMediaLibrary(MEDIA_LIBRARY_SEED);
    setActiveFilter("all");
    setActiveThreadId(INITIAL_CONVERSATIONS[0]?.id ?? "");
  }, []);

  const contactNameByEmail = useMemo(() => {
    const map = new Map<string, { name: string; avatarUrl?: string | null }>();
    contacts.forEach((contact) => {
      const email = contact.contactEmail
        ? normalizeEmail(contact.contactEmail)
        : extractEmail(contact.preview) ?? "";
      if (!email) return;
      if (!map.has(email)) {
        map.set(email, { name: contact.title, avatarUrl: contact.avatarUrl ?? null });
      }
    });
    return map;
  }, [contacts]);

  const allThreads = useMemo(() => [...conversations, ...groups, ...contacts], [conversations, groups, contacts]);
  const allThreadsRef = useRef<Thread[]>([]);
  useEffect(() => {
    allThreadsRef.current = allThreads;
  }, [allThreads]);
  const contactsWithMessages = useMemo(
    () =>
      contacts.filter((contact) => (messagesByThread[contact.id] ?? []).length > 0),
    [contacts, messagesByThread],
  );
  const conversationThreads = useMemo(
    () => [...conversations, ...groups, ...contactsWithMessages],
    [conversations, groups, contactsWithMessages],
  );
  const activeThreads = useMemo(() => {
    const conversationKeys = new Set(conversations.map((thread) => getContactPrimaryKey(thread)));
    let base = conversationThreads;
    if (activeFilter === "groups") {
      base = groups;
    } else if (activeFilter === "contacts") {
      base = [...conversations, ...contactsWithMessages];
    } else if (activeFilter === "unread") {
      base = conversationThreads.filter(
        (thread) => (unreadByThread[thread.id] ?? thread.unread ?? 0) > 0,
      );
    }
    const sorted = [...base].sort(
      (a, b) => getThreadActivityTimestamp(b) - getThreadActivityTimestamp(a),
    );
    const seen = new Set<string>();
    return sorted.filter((thread) => {
      if (thread.tab !== "contacts") return true;
      const key = getContactPrimaryKey(thread);
      if (conversationKeys.has(key)) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [activeFilter, contactsWithMessages, conversationThreads, conversations, groups, unreadByThread]);
  const activeThread = useMemo(() => {
    return allThreads.find((thread) => thread.id === activeThreadId) ?? activeThreads[0] ?? null;
  }, [activeThreadId, activeThreads, allThreads]);
  const filteredActiveThreads = useMemo(() => {
    const query = conversationSearch.trim().toLowerCase();
    if (!query) return activeThreads;
    return activeThreads.filter((thread) => {
      const haystack = `${thread.title} ${thread.preview}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [activeThreads, conversationSearch]);
  const baseContacts = useMemo(
    () =>
      contacts.map((contact) => ({
        id: contact.id,
        title: contact.title,
        preview: contact.preview,
        avatarUrl: contact.avatarUrl ?? null,
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
      },
      ...sortedBaseContacts,
    ];
  }, [currentUser, sortedBaseContacts]);
  const groupContacts = useMemo(() => sortedBaseContacts, [sortedBaseContacts]);
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
    const nextIncoming = { ...incomingCountRef.current };
    if (!unreadInitializedRef.current) {
      allThreads.forEach((thread) => {
        const totalCount = (messagesByThread[thread.id] ?? []).length;
        nextIncoming[thread.id] = totalCount;
      });
      incomingCountRef.current = nextIncoming;
      unreadInitializedRef.current = true;
      return;
    }
    const increments: Record<string, number> = {};
    allThreads.forEach((thread) => {
      const totalCount = (messagesByThread[thread.id] ?? []).length;
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
  }, [activeThreadId, allThreads, messagesByThread]);
  useEffect(() => {
    if (!activeThreadId) return;
    setUnreadByThread((prev) => {
      if (!prev[activeThreadId]) return prev;
      return { ...prev, [activeThreadId]: 0 };
    });
    const totalCount = (messagesByThread[activeThreadId] ?? []).length;
    incomingCountRef.current = { ...incomingCountRef.current, [activeThreadId]: totalCount };
  }, [activeThreadId, messagesByThread]);
  const isShareAudioLimitReached = shareAudioFiles.length >= shareAudioLimit;
  const filteredGroupContacts = useMemo(() => {
    const query = newGroupSearch.trim().toLowerCase();
    if (!query) return groupContacts;
    return groupContacts.filter((contact) => {
      const haystack = `${contact.title} ${contact.preview}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [groupContacts, newGroupSearch]);
  const selectedGroupMembers = useMemo(
    () => groupContacts.filter((contact) => selectedGroupMemberIds.includes(contact.id)),
    [groupContacts, selectedGroupMemberIds],
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
    const timeLabel = new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const activityAt = Date.now();
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
    }
  }, [isGroupInfoOpen]);
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
  const openContactThread = useCallback(
    (threadId: string) => {
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
        setActiveFilter("all");
        setActiveThreadId(existingThread.id);
      } else {
        setActiveFilter((prev) => (prev === "contacts" || prev === "all" ? prev : "all"));
        setActiveThreadId(threadId);
      }
      setIsNewChatOpen(false);
      setIsNewChatEmailOpen(false);
      setIsNewGroupOpen(false);
      setIsNewGroupCreateOpen(false);
      setIsCommunityListOpen(false);
      setIsNewContactOpen(false);
      setIsProfileOpen(false);
      setProfileTarget(null);
    },
    [contacts, conversations],
  );
  const authTokenRef = useRef<string | null>(null);
  useEffect(() => {
    authTokenRef.current = authSession?.access_token ?? null;
  }, [authSession?.access_token]);

  const authFetch = useCallback(
    (input: RequestInfo | URL, init: RequestInit = {}) => {
      const headers = new Headers(init.headers ?? {});
      const token = authTokenRef.current ?? authSession?.access_token;
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      return fetch(input, { ...init, headers });
    },
    [authSession?.access_token],
  );
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
  const ensureRecipientRegistered = useCallback(
    async (thread: Thread | null) => {
      if (!thread || (thread.tab !== "contacts" && thread.tab !== "conversations")) return true;
      const recipientEmail = getThreadRecipientEmail(thread);
      if (!recipientEmail) return true;
      if (isRegisteredEmail(recipientEmail)) return true;
      const exists = await checkEmailRegistered(recipientEmail);
      if (exists) return true;
      setMessageSendNotice(
        "Este e-mail ainda não está cadastrado no KnexChat. Convide o contato para poder enviar mensagens.",
      );
      return false;
    },
    [checkEmailRegistered, getThreadRecipientEmail, isRegisteredEmail],
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
            lastActivity: message.time,
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
              lastActivity: message.time,
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
              lastActivity: message.time,
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
          const incomingMessage: Message = {
            id: message.id,
            author: "them",
            body: message.body || (message.imageUrl ? "Imagem recebida" : message.audioUrl ? "Mensagem de áudio" : "Mensagem recebida"),
            time: message.time,
            senderName: message.fromName,
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
  }, [contacts, identity?.email, serverMessagingEnabled, setContacts, setConversations, setMessagesByThread]);

  const previewFromApiMessage = useCallback((message?: ApiMessage | null) => {
    if (!message) return "Sem mensagens";
    if (message.kind === "image") return "Imagem enviada";
    if (message.kind === "audio") return "Mensagem de áudio";
    if (message.kind === "file") return message.media_name ?? "Arquivo enviado";
    return message.body?.trim() || "Mensagem enviada";
  }, []);

  const mapApiThreadToThread = useCallback(
    (thread: ApiThread): Thread => {
      const identityEmail = identity?.email ? normalizeEmail(identity.email) : "";
      const participants = thread.participants ?? [];
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
        const contactInfo = otherEmail ? contactNameByEmail.get(otherEmail) : undefined;
        const displayName = contactInfo?.name ?? otherParticipant?.name ?? "";
        title = displayName || (otherEmail ? formatNameFromEmail(otherEmail) : "Conversa direta");
        avatarUrl = contactInfo?.avatarUrl ?? undefined;
      }

      if (tab === "groups") {
        title = title || "Grupo";
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
    [contactNameByEmail, identity?.email, previewFromApiMessage],
  );

  const mapApiMessageToMessage = useCallback(
    (message: ApiMessage): Message => {
      const senderEmail = normalizeEmail(message.sender_email);
      const author: "me" | "them" =
        identity?.email && normalizeEmail(identity.email) === senderEmail ? "me" : "them";
      const timeLabel = formatTimestampLabel(message.created_at) || "Agora";
      if (message.kind === "image") {
        return {
          id: message.id,
          author,
          body: message.media_name ?? "Imagem enviada",
          time: timeLabel,
          imageUrl: message.media_url ?? undefined,
          imageName: message.media_name ?? undefined,
        };
      }
      if (message.kind === "audio") {
        return {
          id: message.id,
          author,
          body: "Mensagem de áudio",
          time: timeLabel,
          audioUrl: message.media_url ?? undefined,
          audioDuration: message.media_name ?? undefined,
        };
      }
      if (message.kind === "file") {
        return {
          id: message.id,
          author,
          body: message.media_name ?? "Arquivo enviado",
          time: timeLabel,
        };
      }
      return {
        id: message.id,
        author,
        body: message.body ?? "",
        time: timeLabel,
      };
    },
    [identity?.email],
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

  const refreshRealtime = useCallback(() => {
    setRealtimeKey((prev) => prev + 1);
  }, []);

  const fetchThreadsFromServer = useCallback(async () => {
    if (!serverMessagingEnabled || !identity?.email) return;
    setIsServerSyncing(true);
    setServerSyncError(null);
    try {
      const res = await authFetch(
        `/api/knexchat/threads?email=${encodeURIComponent(identity.email)}&includeParticipants=1&includeLastMessage=1`,
      );
      if (!res.ok) throw new Error("threads_failed");
      const payload = (await res.json().catch(() => ({}))) as { threads?: ApiThread[] };
      const rawThreads = Array.isArray(payload?.threads) ? payload.threads : [];
      const mapped = rawThreads.map(mapApiThreadToThread);
      const nextConversations = mapped.filter((thread) => thread.tab === "conversations");
      const nextGroups = mapped.filter((thread) => thread.tab === "groups");
      setConversations(nextConversations);
      setGroups(nextGroups);
      setGroupAdminIdsByGroup((prev) => {
        const next = { ...prev };
        const selfEmail = identity?.email ? normalizeEmail(identity.email) : "";
        mapped.forEach((thread) => {
          if (thread.tab !== "groups" || !thread.participantRoles?.length) return;
          const adminIds = thread.participantRoles
            .filter((participant) => participant.role === "admin")
            .map((participant) => {
              const normalized = normalizeEmail(participant.email);
              return selfEmail && normalized === selfEmail ? "self" : participant.email;
            });
          if (adminIds.length) {
            next[thread.id] = adminIds;
          }
        });
        return next;
      });
      refreshRealtime();
    } catch {
      setServerSyncError("Não foi possível sincronizar suas conversas.");
    } finally {
      setIsServerSyncing(false);
    }
  }, [authFetch, identity?.email, mapApiThreadToThread, refreshRealtime, serverMessagingEnabled]);

  const fetchMessagesForThread = useCallback(
    async (threadId: string) => {
      if (!serverMessagingEnabled || !identity?.email || !isUuid(threadId)) return;
      try {
        const res = await authFetch(`/api/knexchat/messages?threadId=${encodeURIComponent(threadId)}&limit=200`);
        if (!res.ok) throw new Error("messages_failed");
        const payload = (await res.json().catch(() => ({}))) as { messages?: ApiMessage[] };
        const rawMessages = Array.isArray(payload?.messages) ? payload.messages : [];
        const mappedMessages = rawMessages.map(mapApiMessageToMessage);
        setMessagesByThread((prev) => ({ ...prev, [threadId]: mappedMessages }));
        const lastMessage = rawMessages[rawMessages.length - 1];
        if (lastMessage) {
          const preview = previewFromApiMessage(lastMessage);
          const activityAt = toTimestampMs(lastMessage.created_at) ?? Date.now();
          updateThreadActivity(threadId, preview, activityAt);
        }
      } catch {
        // Ignore fetch errors for now.
      }
    },
    [authFetch, identity?.email, mapApiMessageToMessage, previewFromApiMessage, serverMessagingEnabled, updateThreadActivity],
  );

  const ensureServerThreadForSend = useCallback(
    async (thread: Thread) => {
      if (!serverMessagingEnabled) return thread.id;
      if (isUuid(thread.id)) return thread.id;
      if (!identity?.email) return null;
      if (thread.tab !== "contacts" && thread.tab !== "conversations") return null;
      const recipientEmail = getThreadRecipientEmail(thread);
      if (!recipientEmail) return null;
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
    [authFetch, getThreadRecipientEmail, identity?.email, mapApiThreadToThread, refreshRealtime, serverMessagingEnabled],
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
    const timeLabel = "Agora";
    const activityAt = Date.now();
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
  const activeThreadAvatarUrl = useMemo(() => {
    if (!activeThread) return null;
    return threadAvatarOverrides[activeThread.id] ?? activeThread.avatarUrl ?? null;
  }, [activeThread, threadAvatarOverrides]);
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
  const profileAvatarCta = canEditProfile
    ? profileData?.avatarUrl
      ? "Mudar foto de perfil"
      : "Adicionar foto de perfil"
    : null;
  useEffect(() => {
    if (!isProfileOpen || profileTarget !== "self") return;
    setProfileNameDraft(identity?.name ?? "");
    setProfileRecadoDraft(settingsState.profileRecado ?? DEFAULT_SETTINGS_STATE.profileRecado);
  }, [identity?.name, isProfileOpen, profileTarget, settingsState.profileRecado]);

  const handleOpenProfile = (target: "thread" | "self") => {
    setIsProfileOpen(true);
    setProfileTarget(target);
    setIsProfileAvatarPreviewOpen(false);
    setIsNewChatOpen(false);
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
  };
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
  const handleCloseProfileAndCommit = useCallback(() => {
    commitProfileName();
    commitProfileRecado();
    setIsProfileOpen(false);
    setProfileTarget(null);
    setIsProfileAvatarPreviewOpen(false);
  }, [commitProfileName, commitProfileRecado]);

  const handleProfileAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (profileTarget !== "self") {
      event.target.value = "";
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      if (!result) return;
      setSelfAvatarUrl(result);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleCreateGroup = async () => {
    if (!identity?.email) return;
    const trimmedName = newGroupName.trim();
    const memberEmails = selectedGroupMemberIds
      .map((id) => contacts.find((contact) => contact.id === id))
      .map((contact) => {
        if (!contact) return "";
        if (contact.contactEmail) return normalizeEmail(contact.contactEmail);
        const previewEmail = extractEmail(contact.preview);
        return previewEmail ? normalizeEmail(previewEmail) : "";
      })
      .filter(Boolean);
    if (serverMessagingEnabled) {
      try {
        const res = await authFetch("/api/knexchat/threads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "group",
            title: trimmedName || "Novo grupo",
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
        if (newGroupImageUrl) {
          setThreadAvatarOverrides((prev) => ({ ...prev, [mapped.id]: newGroupImageUrl }));
        }
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
    if (typeof window === "undefined") return;
    const updateLayout = () => {
      setActivationLayout(computeActivationLayout(window.innerWidth, window.innerHeight));
    };
    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

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
    if (!isAuthReady) return;
    if (!authSession?.user?.email) {
      setIdentity(null);
      return;
    }
    const normalizedEmail = normalizeEmail(authSession.user.email);
    const metadata = authSession.user.user_metadata as { name?: string; full_name?: string } | null;
    const normalizedName = normalizeName(metadata?.name ?? metadata?.full_name ?? "");
    const nextIdentity: Identity = {
      userId: authSession.user.id,
      email: normalizedEmail,
      emailVerified: Boolean(authSession.user.email_confirmed_at),
      deviceId: `dev_${Math.random().toString(16).slice(2)}`,
      createdAt: authSession.user.created_at ?? new Date().toISOString(),
      name: normalizedName || undefined,
    };
    setIdentity(nextIdentity);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextIdentity));
    } catch {
      // Ignore storage errors.
    }
    const directoryEntry: DirectoryEntry = {
      email: normalizedEmail,
      name: normalizedName || undefined,
      createdAt: new Date().toISOString(),
    };
    setDirectoryEntries((prev) => {
      if (prev.some((entry) => normalizeEmail(entry.email) === normalizedEmail)) return prev;
      return [directoryEntry, ...prev];
    });
    setDirectoryLookupCache((prev) => ({ ...prev, [normalizedEmail]: true }));
    void (async () => {
      try {
        const res = await authFetch("/api/knexchat/directory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail, name: normalizedName || undefined }),
        });
        if (res.status === 409) return;
      } catch {
        // Ignore directory registration errors.
      }
    })();
  }, [authFetch, authSession, isAuthReady]);

  useEffect(() => {
    if (!chatStateKey) {
      resetChatState();
      setIsChatStateHydrated(true);
      return;
    }
    resetChatState();
    try {
      let raw = localStorage.getItem(chatStateKey);
      if (!raw || !raw.trim()) {
        const legacyRaw = localStorage.getItem(CHAT_STATE_KEY);
        if (legacyRaw && legacyRaw.trim()) {
          raw = legacyRaw;
          localStorage.setItem(chatStateKey, legacyRaw);
        }
      }
      if (!raw || !raw.trim()) {
        setIsChatStateHydrated(true);
        return;
      }
      const parsed = safeParseJson<Partial<{
        conversations: Thread[];
        groups: Thread[];
        contacts: Thread[];
        messagesByThread: Record<string, Message[]>;
        unreadByThread: Record<string, number>;
        settingsState: typeof DEFAULT_SETTINGS_STATE;
        selfAvatarUrl: string | null;
        threadAvatarOverrides: Record<string, string>;
        mediaLibrary: MediaItem[];
        groupDescriptions: Record<string, string>;
        groupPermissions: Record<string, GroupPermissions>;
        groupAdmins: Record<string, string[]>;
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
      if (parsed.activeFilter) {
        setActiveFilter(parsed.activeFilter);
      }
      if (parsed.activeThreadId) {
        setActiveThreadId(parsed.activeThreadId);
      }
    } catch {
      localStorage.removeItem(chatStateKey);
    } finally {
      setIsChatStateHydrated(true);
    }
  }, [chatStateKey, resetChatState]);

  useEffect(() => {
    if (typeof window === "undefined") {
      setDirectoryEntries([]);
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
    } catch {
      setDirectoryEntries([]);
      setDirectoryLookupCache({});
    }
  }, []);

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
    void fetchThreadsFromServer();
  }, [fetchThreadsFromServer, identity?.email, isChatStateHydrated, serverMessagingEnabled]);

  useEffect(() => {
    if (!serverMessagingEnabled || !identity?.email || !isChatStateHydrated) return;
    if (!authSession?.access_token) return;
    const source = new EventSource(
      `/api/knexchat/realtime?token=${encodeURIComponent(authSession.access_token)}&t=${realtimeKey}`,
    );
    setIsRealtimeConnected(false);

    const handleReady = () => {
      setIsRealtimeConnected(true);
    };

    const handleMessage = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as { message?: ApiMessage };
        const message = payload?.message;
        if (!message || !message.thread_id) return;
        const mapped = mapApiMessageToMessage(message);
        setMessagesByThread((prev) => {
          const existing = prev[message.thread_id] ?? [];
          if (existing.some((item) => item.id === mapped.id)) return prev;
          return { ...prev, [message.thread_id]: [...existing, mapped] };
        });
        const activityAt = toTimestampMs(message.created_at) ?? Date.now();
        updateThreadActivity(message.thread_id, previewFromApiMessage(message), activityAt);
        const hasThread = allThreadsRef.current.some((thread) => thread.id === message.thread_id);
        if (!hasThread) {
          void fetchThreadsFromServer();
        }
      } catch {
        // ignore payload errors
      }
    };

    const handleError = () => {
      setIsRealtimeConnected(false);
    };

    source.addEventListener("ready", handleReady as EventListener);
    source.addEventListener("message", handleMessage as EventListener);
    source.addEventListener("error", handleError as EventListener);

    return () => {
      source.removeEventListener("ready", handleReady as EventListener);
      source.removeEventListener("message", handleMessage as EventListener);
      source.removeEventListener("error", handleError as EventListener);
      source.close();
    };
  }, [
    fetchThreadsFromServer,
    authSession?.access_token,
    identity?.email,
    isChatStateHydrated,
    mapApiMessageToMessage,
    previewFromApiMessage,
    realtimeKey,
    serverMessagingEnabled,
    updateThreadActivity,
  ]);

  useEffect(() => {
    if (!serverMessagingEnabled || !identity?.email || !isChatStateHydrated) return;
    if (!activeThreadId || !isUuid(activeThreadId)) return;
    let cancelled = false;
    const loadMessages = async () => {
      if (cancelled) return;
      await fetchMessagesForThread(activeThreadId);
    };
    void loadMessages();
    if (isRealtimeConnected) return;
    const interval = window.setInterval(loadMessages, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    activeThreadId,
    fetchMessagesForThread,
    identity?.email,
    isChatStateHydrated,
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
            messagesByThread,
            unreadByThread,
            settingsState,
            groupDescriptions,
            groupPermissions: groupPermissionsById,
            groupAdmins: groupAdminIdsByGroup,
            selfAvatarUrl,
            threadAvatarOverrides,
            mediaLibrary,
            activeFilter,
            activeThreadId,
          }),
        );
      } catch {
        // Ignore storage errors.
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [
    activeFilter,
    activeThreadId,
    chatStateKey,
    contacts,
    conversations,
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
      lastActivityAt: Date.now(),
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
      const existing = allThreads.find((thread) => thread.id === activeThreadId);
      if (existing && existing.tab === "contacts") return;
      setActiveThreadId(activeThreads[0].id);
    }
  }, [activeThreads, activeThreadId, allThreads]);

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
    setIsSendingOtp(true);
    setActivationError(null);
    setActivationNotice(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: normalized,
        options: {
          data: { name: normalizedName },
        },
      });
      if (error) {
        throw new Error(error.message);
      }
      if (SHOW_OTP_PREVIEW) {
        setOtpGenerated("000000");
      } else {
        setOtpGenerated(null);
      }
      setOtpInput("");
      setActivationError(null);
      setActivationNotice("Código de 6 dígitos enviado para seu e-mail.");
      setActivationStep("otp");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao enviar código.";
      setActivationError(message);
      setActivationNotice(null);
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleConfirmOtp = async () => {
    const normalized = normalizeEmail(registeringEmail);
    const token = otpInput.trim();
    if (!normalized || !token) {
      setActivationError("Código inválido.");
      return;
    }
    if (!OTP_CODE_REGEX.test(token)) {
      setActivationError("Informe o código de 6 dígitos.");
      return;
    }
    setIsSendingOtp(true);
    setActivationError(null);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: normalized,
        token,
        type: "email",
      });
      if (error) {
        throw new Error(error.message);
      }
      setActivationStep("email");
      setOtpGenerated(null);
      setOtpInput("");
      setActivationError(null);
      setActivationNotice(null);
      router.replace(chatHref);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao validar o código.";
      setActivationError(message);
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleLogout = async () => {
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
    setRegisteringName("");
    setRegisteringEmail("");
    setOtpGenerated(null);
    setOtpInput("");
    setActivationError(null);
    setActivationNotice(null);
    setIsSendingOtp(false);
    setActivationStep("email");
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

  const handleSendMessage = async () => {
    if (!activeThread || !currentUser) return;
    const trimmed = messageDraft.trim();
    if (!trimmed) return;
    if (!(await ensureRecipientRegistered(activeThread))) return;
    if (messageSendNotice) setMessageSendNotice(null);
    const threadId = await ensureServerThreadForSend(activeThread);
    if (!threadId) return;

    if (serverMessagingEnabled && identity?.email) {
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

    const timeLabel = new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const activityAt = Date.now();
    const newMessage: Message = {
      id: `m_${Date.now()}`,
      author: "me",
      body: trimmed,
      time: timeLabel,
    };
    setMessagesByThread((prev) => ({
      ...prev,
      [threadId]: [...(prev[threadId] ?? []), newMessage],
    }));
    updateThreadActivity(threadId, trimmed, activityAt);
    setMessageDraft("");
  };

  const handleSendImage = async (file: File) => {
    if (!activeThread || !currentUser) return;
    if (!(await ensureRecipientRegistered(activeThread))) return;
    if (messageSendNotice) setMessageSendNotice(null);
    const threadId = await ensureServerThreadForSend(activeThread);
    if (!threadId) return;
    let imageUrl = "";
    try {
      imageUrl = await readFileAsDataUrl(file);
    } catch {
      return;
    }
    if (!imageUrl) return;

    if (serverMessagingEnabled && identity?.email) {
      try {
        const res = await authFetch("/api/knexchat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId,
            senderEmail: identity.email,
            kind: "image",
            body: file.name ?? "Imagem enviada",
            mediaUrl: imageUrl,
            mediaName: file.name ?? "Imagem enviada",
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
        setMessageSendNotice("Não foi possível enviar a imagem agora.");
        return;
      }
    } else {
      const timeLabel = new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const activityAt = Date.now();
      const newMessage: Message = {
        id: `m_${Date.now()}`,
        author: "me",
        body: file.name ?? "Imagem enviada",
        time: timeLabel,
        imageUrl,
        imageName: file.name,
      };
      setMessagesByThread((prev) => ({
        ...prev,
        [threadId]: [...(prev[threadId] ?? []), newMessage],
      }));
      updateThreadActivity(threadId, "Imagem enviada", activityAt);
    }

    const mediaItem: MediaItem = {
      id: `media_${Date.now()}`,
      threadId,
      label: file.name ?? "Imagem",
      caption: `Enviado por ${currentUser.name ?? "Você"}`,
      src: imageUrl,
      sizeKb: file.size ? Math.max(1, Math.round(file.size / 1024)) : undefined,
      isFavorite: false,
      mediaType: "image",
    };
    setMediaLibrary((prev) => [mediaItem, ...prev]);
  };
  const handleMessageImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleSendImage(file);
    event.target.value = "";
  };

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
      updateShareAudioDuration,
    ],
  );

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
    if (
      action === "send" &&
      blob &&
      activeThread &&
      currentUser &&
      (await ensureRecipientRegistered(activeThread))
    ) {
      if (messageSendNotice) setMessageSendNotice(null);
      const threadId = await ensureServerThreadForSend(activeThread);
      if (threadId) {
        if (serverMessagingEnabled && identity?.email) {
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
          const timeLabel = new Date().toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          });
          const activityAt = Date.now();
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
          ? "bg-blue-600 text-white shadow-[0_12px_24px_rgba(0,0,0,0.45)]"
          : "bg-blue-600 text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)]"
        : isDarkTheme
          ? "text-slate-300 hover:bg-blue-600 hover:text-white"
          : "text-slate-900 hover:bg-blue-600 hover:text-white"
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
          avatarUrl: contactInfo?.avatarUrl ?? null,
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
          avatarUrl: contactInfo?.avatarUrl ?? null,
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
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!activeThread || activeThread.tab !== "groups" || !canEditGroupSettings) {
        event.target.value = "";
        return;
      }
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : null;
        if (!result) return;
        setThreadAvatarOverrides((prev) => ({ ...prev, [activeThread.id]: result }));
      };
      reader.readAsDataURL(file);
    },
    [activeThread, canEditGroupSettings, setThreadAvatarOverrides],
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
  const navRailBase = isDarkTheme ? "bg-[var(--knex-850)]/60" : "bg-[#F5F5F5]";
  const navRailDivider = "bg-slate-200";
  const shellSurface = isDarkTheme ? "bg-[var(--knex-850)]/60" : "bg-[#F5F5F5]";
  const headerLineLeft = isSettingsOpen ? "calc(3.5rem + 340px)" : "calc(3.5rem + 24rem)";
  const messagePanelBg = isDarkTheme ? "bg-[#141414]" : "bg-slate-50";
  const messagePanelBodyStyle = wallpaperColor ? { backgroundColor: wallpaperColor } : undefined;

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
          className={`relative flex flex-wrap items-center justify-between gap-3 ${shellSurface} px-4 py-2`}
        >
        <div className="flex items-center gap-3">
          <div>
            <p className={`${spaceGrotesk.className} text-lg font-semibold`}>
              <span className="bg-gradient-to-r from-blue-600 via-sky-500 via-indigo-500 to-cyan-400 bg-clip-text text-transparent">
                KnexChat
              </span>
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

        <div className={`relative flex min-h-0 flex-1 flex-col lg:flex-row ${shellSurface}`}>
        <nav
          className={`hidden w-14 flex-col items-center gap-4 ${navRailBase} py-5 lg:flex`}
        >
          <div className="relative group">
            <button
              type="button"
              className={navButtonClass(activeNavKey === "conversations")}
              onClick={() => {
                setActiveNavKey("conversations");
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
            <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-orange-600 px-1.5 text-[10px] font-semibold text-white">
              67
            </span>
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
              onClick={() => setActiveNavKey("calls")}
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
              onClick={() => setActiveNavKey("status")}
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
              onClick={() => setActiveNavKey("channels")}
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
              className={navButtonClass(activeNavKey === "contacts")}
              aria-label="Novo contato ou conversa"
              title="Novo contato ou conversa"
              onClick={() => setActiveNavKey("contacts")}
            >
              <UserPlus
                className={`h-5 w-5 ${
                  activeNavKey === "contacts" ? "text-white" : "text-blue-600 group-hover:text-white"
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
                title="Configurações"
              >
                <Settings className="h-5 w-5" />
              </button>
              <span
                className={`pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold shadow transition ${
                  isDarkTheme ? "bg-slate-900 text-slate-100" : "bg-slate-900 text-white"
                } opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0`}
              >
                Configurações
              </span>
            </div>
          </div>
        </nav>
        {isSettingsOpen ? (
          <>
            <aside
              className={`flex w-full flex-col border-b border-t ${settingsBorder} ${settingsPanelBase} lg:w-[340px] lg:border-b-0 lg:border-l lg:border-r lg:rounded-tl-md`}
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
                        <p className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                          {currentUser?.name ?? "Participante"}
                        </p>
                        <p className={`text-xs ${isDarkTheme ? "text-slate-400" : "text-slate-600"}`}>
                          {currentUser?.email}
                        </p>
                        <p className={`text-[10px] ${settingsMuted}`}>
                          {settingsState.profileRecado ?? DEFAULT_SETTINGS_STATE.profileRecado}
                        </p>
                      </div>
                    </button>
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
            <section
              className={`flex min-h-0 flex-1 border-t ${settingsBorder} ${
                isDarkTheme ? "bg-[#141414]" : "bg-slate-50"
              }`}
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
        {isProfileOpen ? (
          <aside
            style={chatListWidthStyle}
            className={`relative flex w-full flex-col border-b border-t ${settingsBorder} ${
              isDarkTheme ? "bg-[var(--knex-850)]/60" : "bg-slate-50"
            } lg:w-[var(--chat-list-width)] lg:border-b-0 lg:border-l lg:border-r lg:rounded-tl-md lg:overflow-visible`}
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
            <div className="flex flex-col items-center gap-3 px-4 py-6">
              <div className="flex items-center gap-3">
                {canEditProfile ? (
                  <label
                    className="group relative cursor-pointer"
                    aria-label={profileAvatarCta ?? "Adicionar foto de perfil"}
                    title={profileAvatarCta ?? undefined}
                  >
                    {profileData?.avatarUrl ? (
                      <img
                        src={profileData.avatarUrl}
                        alt={`Avatar de ${profileData.title}`}
                        className={`h-32 w-32 ${avatarFrameLg} object-cover`}
                      />
                    ) : (
                      <div
                        className={`grid h-32 w-32 place-items-center ${avatarFrameLg} text-lg font-semibold ${
                          isDarkTheme ? "bg-slate-900 text-slate-200" : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {profileData?.avatarText ?? "KN"}
                      </div>
                    )}
                    <span
                      className={`absolute inset-0 flex flex-col items-center justify-center gap-2 ${avatarFrameLg} bg-black/55 px-3 text-center text-[11px] font-semibold text-white opacity-0 transition group-hover:opacity-100 ${
                        isDarkTheme ? "bg-black/60" : "bg-slate-900/65"
                      }`}
                    >
                      <ImageIcon className="h-5 w-5" />
                      <span>{profileAvatarCta}</span>
                    </span>
                    <input type="file" accept="image/*" className="sr-only" onChange={handleProfileAvatarChange} />
                  </label>
                ) : (
                  <div className="relative">
                    {profileData?.avatarUrl ? (
                      <img
                        src={profileData.avatarUrl}
                        alt={`Avatar de ${profileData.title}`}
                        className={`h-32 w-32 ${avatarFrameLg} object-cover`}
                      />
                    ) : (
                      <div
                        className={`grid h-32 w-32 place-items-center ${avatarFrameLg} text-lg font-semibold ${
                          isDarkTheme ? "bg-slate-900 text-slate-200" : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {profileData?.avatarText ?? "KN"}
                      </div>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setIsProfileAvatarPreviewOpen(true)}
                  className={`flex h-11 w-11 items-center justify-center rounded-full border transition ${
                    isDarkTheme
                      ? "border-white/10 text-slate-200 hover:bg-white/10"
                      : "border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                  aria-label="Ampliar foto de perfil"
                  title="Ampliar foto de perfil"
                >
                  <ZoomIn className="h-5 w-5" />
                </button>
              </div>
              <p className={`text-base font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                {profileData?.title ?? "Perfil"}
              </p>
            </div>
            <div className="space-y-5 px-4 pb-6 text-sm">
              <div className="space-y-1">
                <p className={`text-[11px] uppercase tracking-[0.2em] ${settingsMuted}`}>Nome</p>
                {canEditProfile ? (
                  <input
                    type="text"
                    value={profileNameDraft}
                    onChange={(event) => setProfileNameDraft(event.target.value)}
                    onBlur={commitProfileName}
                    placeholder="Seu nome"
                    className={`w-full rounded-xl border px-3 py-2 text-sm ${settingsField}`}
                  />
                ) : (
                  <p className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                    {profileData?.title ?? "Perfil"}
                  </p>
                )}
              </div>
              {canEditProfile ? (
                <div className="space-y-1">
                  <p className={`text-[11px] uppercase tracking-[0.2em] ${settingsMuted}`}>E-mail</p>
                  <input
                    type="email"
                    value={currentUser?.email ?? ""}
                    readOnly
                    aria-readonly="true"
                    className={`w-full cursor-not-allowed rounded-xl border px-3 py-2 text-sm opacity-70 ${settingsField}`}
                  />
                </div>
              ) : null}
              <div className="space-y-1">
                <p className={`text-[11px] uppercase tracking-[0.2em] ${settingsMuted}`}>Recado</p>
                {canEditProfile ? (
                  <textarea
                    value={profileRecadoDraft}
                    onChange={(event) => setProfileRecadoDraft(event.target.value)}
                    onBlur={commitProfileRecado}
                    rows={3}
                    placeholder="Escreva um recado"
                    className={`w-full resize-none rounded-xl border px-3 py-2 text-sm ${settingsField}`}
                  />
                ) : (
                  <p className={`${isDarkTheme ? "text-slate-300" : "text-slate-700"}`}>
                    {profileData?.recado ?? "Sem recado"}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <p className={`text-[11px] uppercase tracking-[0.2em] ${settingsMuted}`}>Telefone</p>
                <p className={`${isDarkTheme ? "text-slate-300" : "text-slate-700"}`}>
                  {profileData?.phone ?? "Não informado"}
                </p>
              </div>
            </div>
          </aside>
        ) : (
          <aside
            style={chatListWidthStyle}
            className={`relative flex w-full flex-col border-b border-t ${settingsBorder} ${
              isDarkTheme ? "bg-[var(--knex-850)]/60" : "bg-slate-50"
            } lg:w-[var(--chat-list-width)] lg:border-b-0 lg:border-l lg:border-r lg:rounded-tl-md lg:overflow-visible`}
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
              <div className={`flex flex-col gap-3 border-b px-4 py-3 ${settingsBorder}`}>
                <div className="flex items-center gap-3">
                  {currentUser?.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={`Avatar de ${currentUser?.name ?? "Participante"}`}
                      className={`h-12 w-12 ${avatarFrameMd} object-cover`}
                    />
                  ) : (
                    <div
                      className={`grid h-12 w-12 place-items-center ${avatarFrameMd} bg-slate-900 text-base font-semibold text-emerald-200`}
                    >
                      {currentUser?.avatarText ?? "KN"}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{currentUser?.name}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className={`text-base font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                    Conversas
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition ${
                        isDarkTheme
                          ? "text-blue-300 hover:bg-white/10"
                          : "text-blue-600 hover:bg-blue-50"
                      }`}
                      aria-label="Nova conversa"
                      title="Nova conversa"
                      onClick={() => {
                        setIsNewChatOpen(true);
                        setIsNewChatEmailOpen(false);
                        setIsNewGroupOpen(false);
                        setIsCommunityListOpen(false);
                        setIsGroupsPanelOpen(false);
                        setIsGroupCreateOpen(false);
                        setIsGroupsExpanded(false);
                        setIsNewContactOpen(false);
                      }}
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
                {isNewChatOpen ? null : (
                  <div
                    className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${
                      isDarkTheme
                        ? "border-blue-400/60 bg-slate-900/60 text-slate-200"
                        : "border-blue-400 bg-slate-100 text-slate-600"
                    }`}
                  >
                    <Search className={`${isDarkTheme ? "text-blue-300" : "text-blue-600"} h-4 w-4`} />
                    <input
                      type="text"
                      placeholder="Pesquisar conversas"
                      value={conversationSearch}
                      onChange={(event) => setConversationSearch(event.target.value)}
                      className={`w-full bg-transparent text-xs placeholder:font-medium focus:outline-none ${
                        isDarkTheme
                          ? "placeholder:text-slate-400 text-slate-100"
                          : "placeholder:text-slate-400 text-slate-700"
                      }`}
                    />
                  </div>
                )}
                {isNewChatOpen ? null : (
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
                )}
              </div>
            )}
            <div className={`flex-1 overflow-y-auto ${isNewChatOpen ? "px-0 py-0" : "px-3 py-4"}`}>
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
              ) : isNewChatOpen ? (
                <div className={`flex h-full flex-col ${isDarkTheme ? "bg-[#0f1012]/40" : "bg-white"}`}>
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
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <p className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
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
                        <Grip className="h-4 w-4" />
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
                              <EmojiPicker
                                width={groupEmojiSize.width}
                                height={groupEmojiSize.height}
                                onEmojiClick={(emojiData) => setNewGroupName((prev) => `${prev}${emojiData.emoji}`)}
                                theme={isDarkTheme ? Theme.DARK : Theme.LIGHT}
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
                          className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs ${
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
                            className={`w-full bg-transparent text-xs focus:outline-none ${
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
                          {filteredGroupContacts.map((contact) => (
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
                          ))}
                        </div>
                        {selectedGroupMembers.length ? (
                          <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                            <button
                              type="button"
                              onClick={() => setIsNewGroupCreateOpen(true)}
                              className={`flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition ${
                                isDarkTheme ? "bg-blue-600 hover:bg-blue-500" : "bg-blue-600 hover:bg-blue-700"
                              }`}
                              aria-label="Avançar"
                            >
                              <ArrowRight className="h-5 w-5" />
                            </button>
                          </div>
                        ) : null}
                      </div>
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
                          <button key={community.id} type="button" className="flex w-full items-center gap-3 text-left">
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
                              className={`w-full bg-transparent text-sm font-['Arial'] focus:outline-none ${
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
                    <>
                      <div className="border-b px-4 py-3">
                        <div
                          className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs ${
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
                            className={`w-full bg-transparent text-xs focus:outline-none ${
                              isDarkTheme
                                ? "placeholder:text-slate-400 text-slate-100"
                                : "placeholder:text-slate-400 text-slate-700"
                            }`}
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-3 border-b px-4 py-4">
                        <button
                          type="button"
                          onClick={() => {
                            setIsNewGroupOpen(true);
                            setIsNewChatEmailOpen(false);
                            setIsNewGroupCreateOpen(false);
                            setSelectedGroupMemberIds([]);
                          }}
                          className="flex items-center gap-3 text-left"
                        >
                          <span className="flex h-11 w-11 items-center justify-center gap-[1px] rounded-2xl bg-blue-600 text-white">
                            <Users2 className="h-5 w-5" />
                            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                          </span>
                          <span className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
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
                          <span className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
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
                          <span className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                            Nova comunidade
                          </span>
                        </button>
                        <button type="button" className="flex items-center gap-3 text-left">
                          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-600 text-white">
                            <MessageSquare className="h-5 w-5" />
                          </span>
                          <span className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
                            Novo Fórum
                          </span>
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto px-4 py-4">
                        <p className={`text-xs font-semibold ${settingsMuted}`}>Contatos no KnexChat</p>
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
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredActiveThreads.map((thread) => {
                    const isActive = thread.id === activeThread?.id;
                    const threadAvatarUrl = threadAvatarOverrides[thread.id] ?? thread.avatarUrl;
                    const unreadCount = unreadByThread[thread.id] ?? thread.unread ?? 0;
                    return (
                      <button
                        key={thread.id}
                        type="button"
                        onClick={() => {
                          if (thread.tab === "contacts") {
                            openContactThread(thread.id);
                          } else {
                            setActiveThreadId(thread.id);
                          }
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-1 text-left transition ${
                          isDarkTheme ? "" : "font-['Arial']"
                        } ${
                          isActive
                            ? isDarkTheme
                              ? "ring-2 ring-emerald-500/40 ring-inset bg-emerald-500/10"
                              : "ring-2 ring-blue-300 ring-inset bg-blue-100"
                            : isDarkTheme
                              ? "hover:bg-emerald-500/10"
                              : "hover:bg-blue-100"
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
                              className={`grid h-12 w-12 place-items-center ${avatarFrameMd} text-xs font-semibold ${
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
                          <span
                            className={`text-[11px] font-semibold ${
                              isDarkTheme ? "text-blue-300" : "text-blue-600"
                            }`}
                          >
                            {thread.lastActivity}
                          </span>
                          {unreadCount ? (
                            <span
                              className={`inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${
                                isDarkTheme ? "bg-orange-600 text-white" : "bg-orange-600 text-white"
                              }`}
                            >
                              {unreadCount}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
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
                    ? "w-1 bg-blue-500/60"
                    : "w-px bg-slate-300/70 group-hover:w-1 group-hover:bg-slate-400/80"
                }`}
              />
            </div>
          </aside>
        )}

        <section className={`flex min-h-0 flex-1 flex-col overflow-hidden ${messagePanelBg}`}>
          {isProfileOpen ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className={`border-b border-t ${settingsBorder} px-6 py-4`}>
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
              <div
                className={`relative flex flex-wrap items-center justify-between gap-3 border-b border-t ${settingsBorder} ${
                  isDarkTheme ? "bg-[var(--knex-850)]/40 text-white" : "bg-slate-50"
                } px-4 py-0`}
              >
                <button
                  type="button"
                  onClick={() => handleOpenProfile("thread")}
                  className="flex items-center gap-3 text-left"
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
                  <div className="min-w-0">
                    <p
                      className={`${spaceGrotesk.className} text-lg font-semibold ${
                        isDarkTheme ? "text-slate-100" : "text-slate-900"
                      } truncate max-w-[200px] sm:max-w-[260px] lg:max-w-[320px]`}
                    >
                      {activeThread?.title ?? "Selecione uma conversa"}
                    </p>
                    <div className={`mt-1 flex items-center gap-2 text-xs ${isDarkTheme ? "text-slate-300" : "text-slate-500"}`}>
                      <span className={`h-2 w-2 rounded-full ${headerInfo.dotClass}`} />
                      <span>{headerInfoItems[headerInfoStep] ?? ""}</span>
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

              <div
                className={`relative flex-1 min-h-0 transition-colors ${messagePanelBg}`}
                style={messagePanelBodyStyle}
              >
                <div className="absolute inset-0 overflow-y-auto px-6 py-6">
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
                      const isGroupChat = activeThread?.tab === "groups";
                      const showSender = !isMe && isGroupChat;
                      const senderLabel = message.senderName ?? "Participante";
                      const senderColorClass = getSenderColorClass(senderLabel);
                      const bubbleVariant = isMe ? "knex-bubble--out" : "knex-bubble--in";
                      const isMediaMessage = Boolean(message.imageUrl);
                      const bubble = (
                        <div className={`knex-bubble ${bubbleVariant} ${isMediaMessage ? "knex-bubble--media" : ""}`}>
                          {showSender ? (
                            <p className={`text-[11px] font-semibold ${senderColorClass}`}>{senderLabel}</p>
                          ) : null}
                          {message.imageUrl ? (
                            <div className="knex-bubble__media">
                              <img
                                src={message.imageUrl}
                                alt={message.imageName ?? "Imagem enviada"}
                                className="knex-bubble__image"
                              />
                              {message.body ? <p className="knex-bubble__text">{message.body}</p> : null}
                            </div>
                          ) : (
                            <p className="knex-bubble__text">{message.body}</p>
                          )}
                          <p className="knex-bubble__time">{message.time}</p>
                        </div>
                      );
                  const incomingAvatar = isGroupChat && activeThreadAvatarUrl ? (
                    <img
                      src={activeThreadAvatarUrl}
                      alt={`Avatar de ${activeThread.title}`}
                      className={`h-9 w-9 ${avatarFrameXs} object-cover`}
                    />
                  ) : (
                    <div
                      className={`grid h-9 w-9 place-items-center ${avatarFrameXs} bg-slate-900 text-xs font-semibold text-slate-200`}
                    >
                      {getAvatarText(activeThread?.title ?? "KN")}
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
                  })}
                  </div>
                </div>

                <div className="absolute inset-x-4 bottom-0.5">
                  <form
                    className="flex flex-wrap items-center gap-2 rounded-2xl bg-[var(--knex-850)]/70 p-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (recordingState === "idle") {
                        handleSendMessage();
                      }
                    }}
                  >
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
                    <div className="flex min-w-[200px] flex-1 items-center gap-4 rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-within:border-blue-600">
                      <button
                        type="button"
                        aria-label="Adicionar"
                        onClick={() => messageImageInputRef.current?.click()}
                        className="text-3xl leading-none text-slate-600 transition hover:text-slate-900"
                      >
                        +
                      </button>
                      <input
                        ref={messageImageInputRef}
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={handleMessageImageChange}
                      />
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
                        onChange={(event) => {
                          setMessageDraft(event.target.value);
                          if (messageSendNotice) setMessageSendNotice(null);
                        }}
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
            </>
          )}
        </section>
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
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      isDarkTheme ? "text-slate-100 hover:bg-white/10" : "text-slate-700 hover:bg-slate-100"
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
          </>
        )}
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
      {isProfileOpen && isProfileAvatarPreviewOpen ? (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setIsProfileAvatarPreviewOpen(false)}
          role="presentation"
        >
          <div
            className={`relative flex w-[92vw] max-w-none flex-col items-center gap-6 rounded-3xl p-8 shadow-2xl ${
              isDarkTheme ? "bg-[#1b1b1b]" : "bg-white"
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsProfileAvatarPreviewOpen(false)}
              className={`absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full transition ${
                isDarkTheme ? "text-slate-200 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"
              }`}
              aria-label="Fechar pré-visualização"
            >
              <ChevronDown className="h-5 w-5" />
            </button>
            {profileData?.avatarUrl ? (
              <img
                src={profileData.avatarUrl}
                alt={`Avatar ampliado de ${profileData.title}`}
                className={`h-[min(78vh,78vw)] w-[min(78vh,78vw)] ${avatarFrameLg} object-cover`}
              />
            ) : (
              <div
                className={`grid h-[min(78vh,78vw)] w-[min(78vh,78vw)] place-items-center ${avatarFrameLg} text-2xl font-semibold ${
                  isDarkTheme ? "bg-slate-900 text-slate-200" : "bg-slate-100 text-slate-700"
                }`}
              >
                {profileData?.avatarText ?? "KN"}
              </div>
            )}
            <p className={`text-sm font-semibold ${isDarkTheme ? "text-slate-100" : "text-slate-900"}`}>
              Foto de perfil
            </p>
          </div>
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
                      className={`flex items-center gap-2 rounded-full border border-[1.5px] px-3 py-2 text-xs ${
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
  return (
    <div className="relative flex min-h-[100svh] w-full items-center justify-center px-4 py-6 sm:px-6 sm:py-10 lg:py-12">
      <div className="relative z-10 w-full max-w-lg rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-2xl shadow-black/20 backdrop-blur sm:p-6 lg:p-8">
        <div className="text-center">
          <h1 className={`${headingClassName} text-3xl font-semibold sm:text-4xl md:text-5xl`}>
            <span className="bg-gradient-to-r from-blue-600 via-sky-500 via-indigo-500 to-cyan-400 bg-clip-text text-transparent">
              KnexChat
            </span>
          </h1>
        </div>
        <div className="mt-5 space-y-2 text-left sm:mt-6">
          <p className={`${headingClassName} text-base font-semibold text-slate-900 sm:text-lg`}>Ativar KnexChat</p>
          <p className="text-sm text-slate-700 sm:text-base">
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
