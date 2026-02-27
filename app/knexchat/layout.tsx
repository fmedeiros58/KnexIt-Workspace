import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import KnexchatGuardClient from "./KnexchatGuardClient";

export const metadata: Metadata = {
  title: "SpaceHub",
  applicationName: "SpaceHub",
  manifest: "/knexchat/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/knexchat/icons/favicon-32.png?v=20260224d", sizes: "32x32", type: "image/png" },
      { url: "/knexchat/icons/favicon-48.png?v=20260224d", sizes: "48x48", type: "image/png" },
      { url: "/knexchat/icons/favicon-16.png?v=20260224d", sizes: "16x16", type: "image/png" },
      { url: "/knexchat/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/knexchat/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/knexchat/icons/favicon-48.png?v=20260224d",
    apple: [{ url: "/knexchat/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "SpaceHub",
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
          <span className="text-sm">Carregando SpaceHub...</span>
        </div>
      }
    >
      <KnexchatGuardClient>{children}</KnexchatGuardClient>
    </Suspense>
  );
}
