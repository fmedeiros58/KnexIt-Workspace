"use client";

import AuthGuard from "@/components/AuthGuard";

export default function KnexFlowLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
