"use client";

import AuthGuard from "@/components/AuthGuard";

export default function DriveLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
