import { NextRequest } from "next/server";
import crypto from "crypto";
import { identitySupabase } from "@/lib/identitySupabaseClient";
import { identitySupabaseAdmin } from "@/lib/identitySupabaseAdmin";

export const runtime = "nodejs";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const tokenRegex = /^\d{6}$/;
const VERIFY_WINDOW_MS = 15 * 60 * 1000;
const VERIFY_LIMIT = 5;

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim().toLowerCase();
  const token = String(body?.token ?? "").trim();
  const rawType = String(body?.type ?? "email").trim();
  const otpType =
    rawType === "signup" || rawType === "magiclink" || rawType === "recovery" || rawType === "email"
      ? rawType
      : "email";

  if (!emailRegex.test(email)) {
    return Response.json({ message: "E-mail inválido." }, { status: 400 });
  }
  if (!tokenRegex.test(token)) {
    return Response.json({ message: "Código inválido." }, { status: 400 });
  }

  let admin;
  try {
    admin = identitySupabaseAdmin();
  } catch (err) {
    return Response.json({ message: "Identity service role not configured." }, { status: 500 });
  }
  const since = new Date(Date.now() - VERIFY_WINDOW_MS).toISOString();
  const tokenHash = hashToken(token);

  const { count: attemptCount, error: attemptError } = await admin
    .from("auth_email_otps")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .eq("kind", "verify")
    .eq("token_hash", tokenHash)
    .gte("created_at", since);

  if (attemptError) {
    return Response.json(
      {
        message:
          process.env.NODE_ENV === "development" ? attemptError.message : "Falha ao validar limite.",
      },
      { status: 500 },
    );
  }

  if ((attemptCount ?? 0) >= VERIFY_LIMIT) {
    return Response.json({ message: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  }

  const { error: insertError } = await admin.from("auth_email_otps").insert({
    email,
    kind: "verify",
    token_hash: tokenHash,
  });

  if (insertError) {
    return Response.json(
      {
        message:
          process.env.NODE_ENV === "development" ? insertError.message : "Falha ao registrar tentativa.",
      },
      { status: 500 },
    );
  }

  const { data, error } = await identitySupabase().auth.verifyOtp({
    email,
    token,
    type: otpType,
  });

  if (error) {
    return Response.json({ message: error.message }, { status: 401 });
  }

  return Response.json({ session: data?.session ?? null }, { status: 200 });
}
