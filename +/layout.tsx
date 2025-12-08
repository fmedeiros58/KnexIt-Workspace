import "./globals.css";

export const metadata = {
  title: "KnexIT Workspace",
  description: "Suite KnexIT com VioClass, VioLive, SupaDrive, VioRead, KnexReview, KnexMail e mais.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
