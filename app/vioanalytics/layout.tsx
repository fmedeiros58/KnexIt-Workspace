"use client";

import AuthGuard from "@/components/AuthGuard";

export default function VioAnalyticsLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
