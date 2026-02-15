"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthScaffold from "../_components/AuthScaffold";
import { buildAccessStepHref, isEmail, normalizeEmail } from "../_lib/authFlow";

type LookupPayload = {
  exists?: boolean;
  hasPassword?: boolean;
  methods?: {
    otp?: boolean;
    password?: boolean;
    google?: boolean;
    facebook?: boolean;
  };
};

export default function MethodStepClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = useMemo(() => normalizeEmail(searchParams.get("email") ?? ""), [searchParams]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exists, setExists] = useState(searchParams.get("exists") === "1");
  const [hasPassword, setHasPassword] = useState(searchParams.get("hasPassword") === "1");

  const refreshLookup = useCallback(async () => {
    if (!isEmail(email)) {
      router.replace(buildAccessStepHref("email", searchParams));
      return;
    }

    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/lookup-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    setLoading(false);

    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { message?: string };
      setError(payload.message ?? "Falha ao validar o e-mail.");
      return;
    }

    const payload = (await res.json().catch(() => ({}))) as LookupPayload;
    setExists(Boolean(payload.exists));
    setHasPassword(Boolean(payload.hasPassword));
  }, [email, router, searchParams]);

  useEffect(() => {
    void refreshLookup();
  }, [refreshLookup]);

  const onChangeEmail = () => {
    router.push(buildAccessStepHref("email", searchParams, { email }));
  };

  const onPassword = () => {
    router.push(
      buildAccessStepHref("senha", searchParams, {
        email,
        exists: exists ? "1" : "0",
        hasPassword: hasPassword ? "1" : "0",
      }),
    );
  };

  const onOtp = () => {
    router.push(
      buildAccessStepHref("codigo", searchParams, {
        email,
        purpose: exists ? "login" : "signup",
      }),
    );
  };

  const onRecovery = () => {
    router.push(
      buildAccessStepHref("codigo", searchParams, {
        email,
        purpose: "recovery",
      }),
    );
  };

  const showPasswordOption = !exists || hasPassword;

  return (
    <AuthScaffold>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="w-full text-center">
          <h2 className="text-lg font-semibold text-slate-900">Entrar ou criar conta</h2>
          <p className="mt-2 text-sm text-slate-600">Escolha o metodo para continuar com sua conta.</p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Acesso</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
        <span>
          {exists ? "Conta encontrada" : "E-mail novo"}: <strong>{email}</strong>
        </span>
        <button type="button" onClick={onChangeEmail} className="font-semibold text-blue-700 hover:underline">
          Alterar e-mail
        </button>
      </div>

      {loading ? <p className="text-sm text-slate-600">Validando metodos disponiveis...</p> : null}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>
      ) : null}

      {!loading ? (
        <div className="space-y-3">
          {exists && !hasPassword ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
              Esta conta nao tem senha cadastrada. Continue com codigo por e-mail.
            </div>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            {showPasswordOption ? (
              <button
                type="button"
                onClick={onPassword}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-blue-600 bg-blue-600 px-3 text-xs font-semibold text-white transition hover:brightness-110"
              >
                {exists ? "Entrar com senha" : "Criar conta com senha"}
              </button>
            ) : null}

            <button
              type="button"
              onClick={onOtp}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Codigo por e-mail
            </button>
          </div>

          {exists && hasPassword ? (
            <div className="flex justify-end">
              <button type="button" onClick={onRecovery} className="text-xs font-semibold text-blue-700 hover:underline">
                Esqueci minha senha
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </AuthScaffold>
  );
}
