"use client";

import AuthGuard from "@/components/AuthGuard";

export default function KnexMailLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
