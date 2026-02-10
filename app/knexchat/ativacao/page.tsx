import { Suspense } from "react";
import ActivationClient from "./ActivationClient";

export default function KnexchatActivationPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#f2f6fb] text-slate-900 flex items-center justify-center px-4">
          <p className="text-sm text-slate-600">Carregando...</p>
        </main>
      }
    >
      <ActivationClient />
    </Suspense>
  );
}
