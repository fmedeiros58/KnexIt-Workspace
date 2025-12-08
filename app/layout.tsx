// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "KnexIT",
  description: "Ecossistema central — autenticação, billing, integração e painel único",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      {/* O body global NÃO tem Nav. Cada route group decide seu layout. */}
      <body className="min-h-screen bg-white text-slate-900">
        {children}
      </body>
    </html>
  );
}
