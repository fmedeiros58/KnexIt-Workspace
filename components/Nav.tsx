// components/Nav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabaseClient";

/* ===== Tipos fortes p/ apps ===== */
type AppSize = "sm" | "md" | "lg";
type AppItem = {
  title: string;
  href: string;
  icon: ReactNode;
  external?: boolean;
  size?: AppSize;
};

/* ============ Deep-links externos Google ============ */
const searchUrl = () => `https://www.google.com/?hl=pt-BR`;
const mapsUrl = () => `https://maps.google.com/`;
const youtubeUrl = () => `https://www.youtube.com/?app=desktop&persist_app=1`;
const playUrl = () => `https://play.google.com/store?hl=pt-BR`;
const newsUrl = () => `https://news.google.com/?hl=pt-BR&gl=BR&ceid=BR:pt-419`;
const translateUrl = () => `https://translate.google.com/?hl=pt-BR`;
const photosUrl = () => `https://photos.google.com/`;
const docsUrl = () => `https://docs.google.com/document/`;
const sheetsUrl = () => `https://docs.google.com/spreadsheets/`;
const slidesUrl = () => `https://docs.google.com/presentation/`;
const formsUrl = () => `https://forms.google.com/`;
const keepUrl = () => `https://keep.google.com/`;
const chatUrl = () => `https://chat.google.com/`;
const classroomUrl = () => `https://classroom.google.com/`;
function gmailUrl(email?: string | null) {
  return email
    ? `https://mail.google.com/mail/?authuser=${encodeURIComponent(email)}`
    : `https://mail.google.com/`;
}
function meetUrl(email?: string | null) {
  return email
    ? `https://meet.google.com/?authuser=${encodeURIComponent(email)}`
    : `https://meet.google.com/`;
}

export default function Nav() {
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);

  const [appsOpen, setAppsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-apps-popover]")) setAppsOpen(false);
      if (!t.closest("[data-profile-popover]")) setProfileOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const currentPath = pathname ?? "";
  const isActive = (href: string) =>
    href === "/" ? currentPath === "/" : currentPath.startsWith(href);
  const userInitial = email?.charAt(0)?.toUpperCase() ?? "U";

  /* ============ APPS (agrupados por seÃ§Ãµes) ============ */
  const APPS_MAIN: AppItem[] = [
    { title: "Pesquisa", href: searchUrl(), external: true, icon: <IconGoogleG className="h-8 w-8" /> },
    { title: "Maps", href: mapsUrl(), external: true, icon: <IconMaps className="h-8 w-8" /> },
    { title: "YouTube", href: youtubeUrl(), external: true, icon: <IconYouTube className="h-8 w-8" /> },
    { title: "Play", href: playUrl(), external: true, icon: <IconPlay className="h-8 w-8" /> },
    { title: "NotÃ­cias", href: newsUrl(), external: true, icon: <IconNews className="h-8 w-8" /> },
    { title: "Gmail", href: gmailUrl(email), external: true, icon: <IconGmail className="h-8 w-8" /> },
    { title: "Meet", href: meetUrl(email), external: true, icon: <IconMeet className="h-8 w-8" /> },
    { title: "Contatos", href: "/contatos", icon: <IconContacts className="h-8 w-8" /> },
    { title: "Drive", href: "/drive", icon: <IconDrive className="h-8 w-8" /> },
  ];

  const APPS_PRODUCTIVITY: AppItem[] = [
    { title: "Agenda", href: "/agenda", icon: <IconCalendar className="h-8 w-8" /> },
    { title: "Tradutor", href: translateUrl(), external: true, icon: <IconTranslate className="h-8 w-8" /> },
    { title: "VioLive", href: "/violive", icon: <IconUpConect className="h-10 w-10" />, size: "lg" },
    { title: "VioRead", href: "/vioread", icon: <IconDocs className="h-8 w-8" /> },
  ];

  const APPS_EXTRAS: AppItem[] = [
    { title: "Fotos", href: photosUrl(), external: true, icon: <IconPhotos className="h-8 w-8" /> },
    { title: "Docs", href: docsUrl(), external: true, icon: <IconDocs className="h-8 w-8" /> },
    { title: "Planilhas", href: sheetsUrl(), external: true, icon: <IconSheets className="h-8 w-8" /> },
    { title: "ApresentaÃ§Ãµes", href: slidesUrl(), external: true, icon: <IconSlides className="h-8 w-8" /> },
    { title: "FormulÃ¡rios", href: formsUrl(), external: true, icon: <IconForms className="h-8 w-8" /> },
    { title: "Keep", href: keepUrl(), external: true, icon: <IconKeep className="h-8 w-8" /> },
    { title: "Chat", href: chatUrl(), external: true, icon: <IconChat className="h-8 w-8" /> },
    { title: "Classroom", href: classroomUrl(), external: true, icon: <IconClassroom className="h-8 w-8" /> },
  ];

  return (
    <>
      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="mx-auto w-full max-w-7xl px-6 py-2 flex items-center gap-4">
          <Link
            href="/"
            className="no-underline select-none leading-none"
            aria-label="KnexIT â€” InÃ­cio"
          >
            <span className="inline-flex items-baseline gap-1">
              <span className="text-rose-500 text-3xl md:text-4xl font-black tracking-tight">KN</span>
              <span className="text-slate-900 text-3xl md:text-4xl font-black tracking-tight">EXIT</span>
            </span>
          </Link>

          <div className="flex-1 flex items-center justify-center">
            <p className="text-base md:text-lg text-slate-900 text-center">
              <span className="font-semibold text-rose-600">KnexIT:</span>{" "}
              ecossistema central para autenticaÃ§Ã£o, billing, integraÃ§Ã£o e um painel Ãºnico.
            </p>
          </div>

          <Link
            href="/pricing"
            className="hidden md:inline-flex no-underline rounded-2xl bg-rose-500 hover:bg-rose-400 text-white px-6 py-3 text-lg font-bold"
          >
            ConheÃ§a os planos â†’
          </Link>

          {!email && (
            <Link
              href="/login"
              className="ml-2 inline-flex items-center gap-3 no-underline rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 text-sm font-semibold"
              title="Entrar"
            >
              <AvatarSquare color="white" borderColor="transparent" bg="bg-indigo-500/0" />
              Entrar
            </Link>
          )}
        </div>

        <div className="mx-auto w-full max-w-7xl px-6 pb-2 mt-3 md:mt-6">
          <nav className="w-full flex flex-wrap justify-between gap-x-3 md:gap-x-4 gap-y-2 text-[16px] md:text-[17px]">
            <NavItem href="/dashboard" active={isActive("/dashboard")}>
              QuestÃµes GrÃ¡tis
            </NavItem>
            <NavItem href="/aprovados" active={isActive("/aprovados")}>
              Aprovados
            </NavItem>
            <NavItem href="/courses" active={isActive("/courses")}>
              Cursos
            </NavItem>
            <NavItem href="/questions" active={isActive("/questions")}>
              QuestÃµes
            </NavItem>
            <NavItem href="/dashboard" active={isActive("/dashboard")}>
              Minha Ã¡rea
            </NavItem>
            <NavItem href="/mentorias" active={isActive("/mentorias")}>
              Mentorias
            </NavItem>
            <NavItem href="/conteudo-gratuito" active={isActive("/conteudo-gratuito")}>
              ConteÃºdo gratuito
            </NavItem>
            {/* SubstituiÃ§Ã£o: Blog -> Pergunte Ã  LetÃ­cia */}
            <NavItem href="/leticia" active={isActive("/leticia")}>
              Pergunte Ã  LetÃ­cia
            </NavItem>
          </nav>
        </div>
      </nav>

      {/* DOCK / LAUNCHER */}
      <div className="fixed right-4 top-4 z-[70]">
        <div className="flex items-center gap-2">
          {/* Config */}
          <Link
            href="/settings"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white shadow-md hover:bg-slate-800"
            aria-label="Abrir configuraÃ§Ãµes"
            title="ConfiguraÃ§Ãµes"
          >
            <IconGear className="h-5 w-5" />
          </Link>

          {/* BotÃ£o Launcher */}
          <div className="relative" data-apps-popover>
            <button
              type="button"
              onClick={() => setAppsOpen((s) => !s)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-md hover:bg-indigo-500"
              aria-haspopup="menu"
              aria-expanded={appsOpen}
              aria-label="Abrir grade de apps"
              title="Apps"
            >
              <IconDotsGrid className="h-5 w-5" />
            </button>

            {appsOpen && (
              <div className="absolute right-0 mt-3" role="menu" aria-label="Aplicativos">
                <div className="relative rounded-[22px] p-[4px] bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 shadow-[0_10px_30px_rgba(0,0,0,0.14)]">
                  <div className="rounded-[20px] bg-white ring-1 ring-slate-200 w-80 overflow-hidden">
                    <div
                      className="max-h-[420px] overflow-y-auto"
                      style={{ scrollbarGutter: "stable" }}
                    >
                      <SectionGrid apps={APPS_MAIN} />
                      <Divider />
                      <SectionGrid apps={APPS_PRODUCTIVITY} />
                      <Divider />
                      <SectionGrid apps={APPS_EXTRAS} />
                    </div>

                    <div className="px-3 pt-3 pb-3 border-t border-slate-200 bg-white">
                      <Link
                        href="/apps"
                        className="flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-slate-50 hover:bg-slate-100 px-4 py-2 text-sm font-medium text-indigo-700 no-underline"
                      >
                        <span>Mais do KnexIT</span>
                        <span aria-hidden>â†’</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Perfil */}
          {email ? (
            <div className="relative" data-profile-popover>
              <button
                type="button"
                onClick={() => setProfileOpen((s) => !s)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white border border-slate-300 shadow-md text-slate-900 font-bold hover:bg-slate-50"
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                aria-label="Abrir menu do usuÃ¡rio"
                title={email ?? "Conta"}
              >
                {userInitial}
              </button>

              {profileOpen && (
                <div
                  role="menu"
                  aria-label="Menu do usuÃ¡rio"
                  className="absolute right-0 mt-3 w-64 rounded-xl bg-white ring-1 ring-slate-200 shadow-2xl overflow-hidden"
                >
                  <div className="p-3">
                    <p className="text-sm text-slate-500">Conectado como</p>
                    <p className="text-sm font-medium text-slate-900 truncate">{email}</p>
                  </div>
                  <div className="border-t border-slate-200" />
                  <div className="p-2">
                    <Link
                      href="/dashboard"
                      className="block rounded-lg px-3 py-2 text-sm text-slate-800 hover:bg-slate-50 no-underline"
                    >
                      Minha Ã¡rea
                    </Link>
                    <Link
                      href="/settings"
                      className="block rounded-lg px-3 py-2 text-sm text-slate-800 hover:bg-slate-50 no-underline"
                    >
                      ConfiguraÃ§Ãµes
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        await supabase.auth.signOut();
                        setProfileOpen(false);
                        setAppsOpen(false);
                        location.href = "/";
                      }}
                      className="w-full text-left rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
                    >
                      Sair
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white border border-slate-300 shadow-md hover:bg-slate-50"
              title="Entrar"
              aria-label="Entrar"
            >
              <IconUser className="h-5 w-5 text-slate-800" />
            </Link>
          )}
        </div>
      </div>
    </>
  );
}

/* ====== SeÃ§Ã£o de grid + divisor ====== */
function SectionGrid({ apps }: { apps: AppItem[] }) {
  return (
    <div className="px-3 py-3">
      <div className="grid grid-cols-3 gap-x-3 gap-y-3">
        {apps.map((app) => {
          const sizeCls =
            app.size === "lg"
              ? "h-14 w-14"
              : app.size === "sm"
              ? "h-10 w-10"
              : "h-12 w-12";

          const Tile = (
            <span
              className={[
                "inline-flex items-center justify-center rounded-xl",
                sizeCls,
                "transition-colors hover:bg-slate-100",
                "[&>svg]:h-10 [&>svg]:w-10",
              ].join(" ")}
              aria-hidden
            >
              {app.icon}
            </span>
          );

          const Label = (
            <span className="text-[12px] leading-4 text-slate-700 text-center">
              {app.title}
            </span>
          );

          const baseCls =
            "group rounded-xl border border-transparent p-2.5 flex flex-col items-center gap-1.5 no-underline";

          return app.external ? (
            <a
              key={app.title}
              href={app.href}
              target="_blank"
              rel="noopener noreferrer"
              className={baseCls}
              title={app.title}
            >
              {Tile}
              {Label}
            </a>
          ) : (
            <Link key={app.title} href={app.href} className={baseCls} title={app.title}>
              {Tile}
              {Label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Divider() {
  return (
    <div className="px-3">
      <div className="h-px bg-slate-200" />
    </div>
  );
}

/* ====== Item do menu ====== */
function NavItem({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={[
        "no-underline px-3 py-1.5 rounded-lg",
        "transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        active
          ? "text-indigo-900 bg-indigo-100 ring-1 ring-indigo-200"
          : "text-slate-800 hover:text-indigo-900 hover:bg-indigo-50 hover:ring-1 hover:ring-indigo-200 focus-visible:bg-indigo-50 focus-visible:text-indigo-900",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

/* ====== Avatar quadrado ====== */
function AvatarSquare({
  color = "currentColor",
  borderColor = "#CBD5E1",
  bg = "bg-transparent",
}: {
  color?: string;
  borderColor?: string;
  bg?: string;
}) {
  return (
    <span
      className={`inline-flex h-8 w-10 items-center justify-center rounded-lg ${bg}`}
      style={{ border: `1px solid ${borderColor}` }}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke={color}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="8.5" r="6" />
        <path d="M4 19.5c1.9-3.2 5-4.8 8-4.8s6.1 1.6 8 4.8" />
      </svg>
    </span>
  );
}

/* ====== Ãcones utilitÃ¡rios ====== */
function IconGear({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9v.2a2 2 0 0 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6h-.2a2 2 0 0 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9v-.2a2 2 0 0 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6h.2a2 2 0 0 1 0 4h-.2a1 1 0 0 0-.9.6Z" />
    </svg>
  );
}
function IconDotsGrid({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <g transform="translate(2 2)">
        {[0, 1, 2].map((r) =>
          [0, 1, 2].map((c) => <circle key={`${r}-${c}`} cx={c * 8 + 2} cy={r * 8 + 2} r="1.6" />)
        )}
      </g>
    </svg>
  );
}
function IconUser({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c2.3-3.5 5.7-5 8-5s5.7 1.5 8 5" />
    </svg>
  );
}

/* ====== Ãcone UpConect (original) ====== */
function IconUpConect({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id="upcx" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#22C55E" />
        </linearGradient>
      </defs>
      <rect x="2" y="4" width="20" height="16" rx="5" fill="url(#upcx)" />
      <path d="M17 9l3-2v10l-3-2z" fill="#fff" opacity=".95" />
      <circle cx="10.5" cy="12" r="3.8" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="10.5" cy="12" r="1.2" fill="#fff" />
    </svg>
  );
}

/* ====== Ãcones Google-like ====== */
function IconGoogleG({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#4285F4"
        d="M22 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.6c-.2 1.3-.9 2.4-2 3.2v2.7h3.3c1.9-1.7 3.1-4.2 3.1-7.7Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 5-0.9 6.6-2.5l-3.3-2.7c-.9.6-2 .9-3.3.9-2.6 0-4.7-1.8-5.5-4.2H3.1v2.7C4.8 19.8 8.1 22 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.5 13.5a6 6 0 0 1 0-3.1V7.7H3.1A10 10 0 0 0 2 12a10 10 0 0 0 1.1 4.3l3.4-2.8Z"
      />
      <path
        fill="#EA4335"
        d="M12 6.1c1.5 0 2.8.5 3.9 1.5l2.9-2.9A10 10 0 0 0 12 2 10 10 0 0 0 3.1 7.7l3.4 2.7C7.3 7.9 9.4 6.1 12 6.1Z"
      />
    </svg>
  );
}
function IconYouTube({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#FF0000"
        d="M23 7.5a4 4 0 0 0-2.8-2.8C18.3 4.3 12 4.3 12 4.3s-6.3 0-8.2.4A4 4 0 0 0 1 7.5 42 42 0 0 0 1 12a42 42 0 0 0 .8 4.5 4 4 0 0 0 2.8 2.8c1.9.4 8.2.4 8.2.4s6.3 0 8.2-.4a4 4 0 0 0 2.8-2.8c.4-1.9.4-4.5.4-4.5s0-2.6-.4-4.5Z"
      />
      <path fill="#fff" d="M10 9.75v4.5L14.5 12 10 9.75Z" />
    </svg>
  );
}
function IconMaps({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#34A853" d="M3 6l7-3 11 4v14l-7 3L3 20V6z" />
      <path fill="#4285F4" d="M10 3v17l7 3V6l-7-3z" />
      <path fill="#FBBC05" d="M3 6v14l7 3V6L3 6z" />
      <circle cx="14.5" cy="9.5" r="2.5" fill="#EA4335" />
    </svg>
  );
}
function IconPlay({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M4 4l16 8-16 8z" fill="#34A853" />
      <path d="M4 4l8 4v16l-8-4z" fill="#4285F4" />
      <path d="M12 8l8 4-8 4z" fill="#FBBC05" />
    </svg>
  );
}
function IconNews({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="3" fill="#4285F4" />
      <rect x="6" y="7" width="8" height="5" fill="#fff" />
      <rect x="6" y="13" width="12" height="3" fill="#BBDEFB" />
      <rect x="6" y="17" width="10" height="2.2" fill="#BBDEFB" />
    </svg>
  );
}
function IconGmail({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#EA4335" d="M6 12v24c0 2.2 1.8 4 4 4h6V21L6 12z" />
      <path fill="#34A853" d="M42 12v24c0 2.2-1.8 4-4 4h-6V21l10-9z" />
      <path fill="#FBBC05" d="M16 21V40h16V21L24 28 16 21z" />
      <path fill="#4285F4" d="M6 12l18 14L42 12 24 6 6 12z" />
    </svg>
  );
}
function IconMeet({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="3.5" y="6" width="12" height="12" rx="3" fill="#34A853" />
      <path d="M15.5 9l5-3v12l-5-3z" fill="#4285F4" />
      <circle cx="10" cy="12" r="2.6" fill="#fff" />
    </svg>
  );
}
function IconContacts({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="9" r="4" fill="#1E88E5" />
      <path d="M4 21c2.6-4 6-5.5 8-5.5s5.4 1.5 8 5.5" fill="#90CAF9" />
    </svg>
  );
}
function IconDrive({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#0F9D58" d="M8.7 4H15l5 8h-6.3z" />
      <path fill="#4285F4" d="M4 20l4.7-8H15l-4.7 8z" />
      <path fill="#F4B400" d="M20 20h-5.7l4.7-8H20z" />
    </svg>
  );
}
function IconCalendar({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="3" fill="#4285F4" />
      <rect x="3" y="7" width="18" height="3" fill="#1E3A8A" />
      <rect x="7" y="12" width="5" height="5" fill="#fff" />
    </svg>
  );
}
function IconTranslate({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="3" y="4" width="8.5" height="16" rx="2" fill="#4285F4" />
      <rect x="12.5" y="4" width="8.5" height="16" rx="2" fill="#34A853" />
      <path d="M8 12H6m3-4l4 8m-2-4h4" stroke="#fff" strokeWidth="1.7" fill="none" />
      <path d="M15 8h6m-5 3h4m-4 7l3-6 3 6" stroke="#fff" strokeWidth="1.7" fill="none" />
    </svg>
  );
}
function IconPhotos({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M12 2v10L2 12A10 10 0 0 1 12 2Z" fill="#EA4335" />
      <path d="M12 2v10l10-.1A10 10 0 0 0 12 2Z" fill="#FBBC05" />
      <path d="M12 22V12L2 12.1A10 10 0 0 0 12 22Z" fill="#34A853" />
      <path d="M12 22V12l10-.1A10 10 0 0 1 12 22Z" fill="#4285F4" />
    </svg>
  );
}
function IconDocs({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="4" y="3" width="16" height="18" rx="2" fill="#1A73E8" />
      <rect x="7" y="7" width="10" height="2" fill="#fff" />
      <rect x="7" y="11" width="10" height="2" fill="#fff" />
      <rect x="7" y="15" width="7" height="2" fill="#fff" />
    </svg>
  );
}
function IconSheets({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="4" y="3" width="16" height="18" rx="2" fill="#0F9D58" />
      <rect x="7" y="7" width="10" height="2" fill="#fff" />
      <rect x="7" y="11" width="10" height="2" fill="#fff" />
      <rect x="7" y="15" width="10" height="2" fill="#fff" />
    </svg>
  );
}
function IconSlides({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="4" y="3" width="16" height="18" rx="2" fill="#F4B400" />
      <rect x="7" y="8" width="10" height="8" fill="#fff" />
    </svg>
  );
}
function IconForms({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="4" y="3" width="16" height="18" rx="2" fill="#673AB7" />
      <rect x="8" y="7" width="8" height="2" fill="#fff" />
      <rect x="8" y="11" width="8" height="2" fill="#fff" />
      <rect x="8" y="15" width="6" height="2" fill="#fff" />
    </svg>
  );
}
function IconKeep({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="4" y="3" width="16" height="18" rx="2" fill="#F4B400" />
      <path d="M12 7a4 4 0 0 1 2 7l0 3h-4l0-3a4 4 0 0 1 2-7Z" fill="#fff" />
    </svg>
  );
}
function IconChat({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="3" y="4" width="18" height="14" rx="3" fill="#00AC47" />
      <rect x="6" y="7" width="12" height="3" fill="#fff" />
      <rect x="6" y="11" width="9" height="3" fill="#C8E6C9" />
      <path d="M8 20l3-2h7a3 3 0 0 0 3-3" stroke="#00AC47" strokeWidth="2" fill="none" />
    </svg>
  );
}
function IconClassroom({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" fill="#1E8E3E" />
      <rect x="5" y="7" width="14" height="10" fill="#2BB673" />
      <circle cx="12" cy="10" r="2.4" fill="#fff" />
      <rect x="8" y="13" width="8" height="2.5" fill="#fff" />
    </svg>
  );
}




