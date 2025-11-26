"use client";

import AuthGuard from "@/components/AuthGuard";

export default function VioLiveLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
