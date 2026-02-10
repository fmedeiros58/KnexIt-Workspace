import { Suspense } from "react";
import AuthCallbackClient from "./AuthCallbackClient";

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-white text-slate-700">
          <p>Finalizando acesso...</p>
        </main>
      }
    >
      <AuthCallbackClient />
    </Suspense>
  );
}
