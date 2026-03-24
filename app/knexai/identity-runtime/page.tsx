"use client";

import { Suspense } from "react";
import IdentityRuntimePageClient from "../../../knexai/identity-runtime/page";

export default function IdentityRuntimePage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#05070d]" />}>
      <IdentityRuntimePageClient />
    </Suspense>
  );
}

