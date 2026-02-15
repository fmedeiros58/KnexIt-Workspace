import type { Metadata, Viewport } from "next";
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
  themeColor: "#0b111c",
};

export default function KnexchatLayout({ children }: { children: React.ReactNode }) {
  return <KnexchatGuardClient>{children}</KnexchatGuardClient>;
}
