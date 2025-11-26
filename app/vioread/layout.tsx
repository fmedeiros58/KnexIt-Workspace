"use client";

import AuthGuard from "@/components/AuthGuard";

export default function VioReadLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
