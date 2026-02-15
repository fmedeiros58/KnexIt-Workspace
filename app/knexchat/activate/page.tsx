import { Suspense } from "react";
import ActivationPageClient from "./ActivationPageClient";

export default function KnexchatActivatePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#f2f6fb] text-slate-900 flex items-center justify-center px-4">
          <p className="text-sm text-slate-600">Carregando...</p>
        </main>
      }
    >
      <ActivationPageClient />
    </Suspense>
  );
}
