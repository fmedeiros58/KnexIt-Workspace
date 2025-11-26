"use client";

import AuthGuard from "@/components/AuthGuard";

export default function KnexReviewLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
