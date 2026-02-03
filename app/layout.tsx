// app/layout.tsx
import "./globals.css";
import type { Metadata, Viewport } from "next";
import AppShell from "@/components/shell/AppShell";

export const metadata: Metadata = {
  title: "KnexIT",
  description: "Ecossistema central de autenticação, billing, integração e painel único",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="h-full bg-slate-50 text-slate-900 antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
