"use client";

import AuthGuard from "@/components/AuthGuard";

export default function VioStudioLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
