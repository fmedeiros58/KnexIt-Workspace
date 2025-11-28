"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const DEFAULT_AFTER_AUTH = "/planos";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const postAuthRedirect = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const url = new URL(window.location.href);
    const origin = window.location.origin;
    const redirect = url.searchParams.get("redirect");
    if (redirect) return new URL(redirect, origin).toString();
    return new URL(DEFAULT_AFTER_AUTH, origin).toString();
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") document.title = "KNEXIT | Login";
  }, []);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && typeof window !== "undefined") {
        const next = localStorage.getItem("postAuthRedirect") || postAuthRedirect;
        if (next) {
          localStorage.removeItem("postAuthRedirect");
          window.location.href = next;
        }
      }
    });
    return () => data.subscription.unsubscribe();
  }, [postAuthRedirect]);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    if (typeof window !== "undefined" && postAuthRedirect) {
      localStorage.setItem("postAuthRedirect", postAuthRedirect);
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-semibold text-slate-900">Entrar no KnexIT</h1>
        <p className="text-sm text-slate-600">
          Use o link mágico enviado para seu e-mail. Você será redirecionado automaticamente após o login.
        </p>
        <form onSubmit={handleMagicLink} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            E-mail
            <input
              type="email"
              placeholder="seu@email.com"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button
            type="submit"
            disabled={loading || !email}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Enviando..." : "Enviar link mágico"}
          </button>
        </form>
        {sent && (
          <p className="text-sm text-emerald-600">
            Link enviado! Abra o e-mail no mesmo navegador para completar a autenticação.
          </p>
        )}
      </div>
    </div>
  );
}
