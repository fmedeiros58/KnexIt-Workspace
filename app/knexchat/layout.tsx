"use client";

import AuthGuard from "@/components/AuthGuard";

export default function KnexChatLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
