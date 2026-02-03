"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Header from "./Header";
import KnexspaceMenu from "./KnexspaceMenu";
import { NAV_ITEMS, getActiveNavItem } from "./navigation";

type AppShellProps = {
  children: React.ReactNode;
};

const SHELL_PREFIXES = [
  "/knexit-workspace",
  "/knexchat",
  "/supadrive",
  "/knexai",
  "/knexdocs",
  "/knexflow",
  "/knexmail",
  "/knexpay",
  "/knexreview",
  "/knexsearch",
  "/vioanalytics",
  "/vioclass",
  "/viohub",
  "/violive",
  "/vioread",
  "/viorecord",
  "/viostudio",
];

const HIDE_SHELL_PREFIXES = ["/knexit-workspace/acesso", "/login", "/admin"];

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const shouldUseShell = useMemo(() => {
    if (!pathname) return true;
    if (HIDE_SHELL_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return false;
    return SHELL_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  }, [pathname]);

  const activeItem = useMemo(() => getActiveNavItem(pathname, NAV_ITEMS), [pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (!shouldUseShell) {
    return <div className="h-screen overflow-y-auto bg-[#E5F3F4] text-slate-900">{children}</div>;
  }

  return (
    <div className="flex h-screen min-w-0 flex-col bg-[#E5F3F4] text-slate-900">
      <div className="relative z-30">
        <Header
          title={activeItem?.label ?? "Knexspace One"}
          onMenuClick={() => setMobileOpen((prev) => !prev)}
          rightSlot={
            <>
              <KnexspaceMenu variant="desktop" layout="full" />
              <KnexspaceMenu variant="desktop" layout="actions" />
            </>
          }
          bottomSlot={
            <div className="hidden min-h-[3.85rem] items-center border-t border-slate-200/70 px-6 md:flex xl:hidden">
              <KnexspaceMenu variant="desktop" layout="nav" />
            </div>
          }
        />
        {mobileOpen ? (
          <div className="absolute left-0 right-0 top-full border-b border-slate-200 bg-white shadow-md md:hidden">
            <div className="max-h-[calc(100svh-3.5rem)] overflow-y-auto">
              <KnexspaceMenu onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        ) : null}
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden pl-0 pr-0 pt-0 pb-4">
          {children}
        </main>
      </div>
    </div>
  );
}
