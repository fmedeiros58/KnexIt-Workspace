"use client";

import AuthGuard from "@/components/AuthGuard";

export default function SupaDriveLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
