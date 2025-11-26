"use client";

import AuthGuard from "@/components/AuthGuard";

export default function KnexDocsLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
