"use client";

import AuthGuard from "@/components/AuthGuard";

export default function VioClassLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
