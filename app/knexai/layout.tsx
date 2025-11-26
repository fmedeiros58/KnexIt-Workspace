"use client";

import AuthGuard from "@/components/AuthGuard";

export default function KnexAiLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
