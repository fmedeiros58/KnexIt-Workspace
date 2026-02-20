import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import KnexchatGuardClient from "./KnexchatGuardClient";

export const metadata: Metadata = {
  title: "Knexchat",
  applicationName: "Knexchat",
  manifest: "/knexchat/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Knexchat",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b111c",
};

export default function KnexchatLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen min-h-[100dvh] items-center justify-center bg-[var(--kx-bg)] text-slate-500">
          <span className="text-sm">Carregando KnexChat...</span>
        </div>
      }
    >
      <KnexchatGuardClient>{children}</KnexchatGuardClient>
    </Suspense>
  );
}
