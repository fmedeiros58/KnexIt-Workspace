"use client";

import AuthGuard from "@/components/AuthGuard";

export default function KnexSearchLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
