import { NextRequest } from "next/server";
import { getSupabaseAdmin, requireKnexchatEntitlement } from "@/app/api/knexchat/_auth";
import type { Database } from "@/types/supabase";

export const runtime = "nodejs";

type ContactRequestRow = Database["public"]["Tables"]["knexchat_contact_requests"]["Row"];
type ContactRequestStatus = ContactRequestRow["status"];

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const isValidEmail = (value: string) => Boolean(value) && /\S+@\S+\.\S+/.test(value);

const isContactRequestStatus = (value: string): value is ContactRequestStatus =>
  value === "pending" ||
  value === "accepted" ||
  value === "rejected" ||
  value === "blocked" ||
  value === "canceled";

const toApiRequest = (
  authEmail: string,
  row: ContactRequestRow,
  nameByEmail: Map<string, string>,
) => {
  const requesterEmail = normalizeEmail(row.requester_email);
  const targetEmail = normalizeEmail(row.target_email);
  const isOutgoing = requesterEmail === authEmail;
  const peerEmail = isOutgoing ? targetEmail : requesterEmail;

  return {
    id: row.id,
    email: peerEmail,
    ...(nameByEmail.get(peerEmail) ? { name: nameByEmail.get(peerEmail) } : {}),
    status: row.status,
    direction: isOutgoing ? "outgoing" : "incoming",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

async function loadRequestsForEmail(authEmail: string, includeResolved = false) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error("Supabase service role not configured");
  }

  let query = admin
    .from("knexchat_contact_requests")
    .select("id, requester_email, target_email, status, created_at, updated_at")
    .or(`requester_email.eq.${authEmail},target_email.eq.${authEmail}`);

  if (!includeResolved) {
    query = query.eq("status", "pending");
  }

  const { data, error } = await query.order("updated_at", { ascending: false }).limit(500);
  if (error) throw error;

  const rows = (data ?? []) as ContactRequestRow[];
  if (!rows.length) return [];

  const peerEmails = Array.from(
    new Set(
      rows.map((row) =>
        normalizeEmail(row.requester_email) === authEmail
          ? normalizeEmail(row.target_email)
          : normalizeEmail(row.requester_email),
      ),
    ),
  );

  const nameByEmail = new Map<string, string>();
  if (peerEmails.length) {
    const { data: directoryRows, error: directoryError } = await admin
      .from("knexchat_directory")
      .select("email, name")
      .in("email", peerEmails);
    if (directoryError) throw directoryError;
    (directoryRows ?? []).forEach((row) => {
      const normalized = normalizeEmail(row.email);
      const name = typeof row.name === "string" ? row.name.trim() : "";
      if (!normalized || !name) return;
      nameByEmail.set(normalized, name);
    });
  }

  return rows
    .filter((row) => isContactRequestStatus(row.status))
    .map((row) => toApiRequest(authEmail, row, nameByEmail));
}

export async function GET(req: NextRequest) {
  if (!getSupabaseAdmin()) {
    return Response.json({ message: "Supabase service role not configured" }, { status: 500 });
  }

  const entitlement = await requireKnexchatEntitlement(req);
  if (entitlement.response) return entitlement.response;

  const authEmail = normalizeEmail(entitlement.user?.email ?? "");
  if (!isValidEmail(authEmail)) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const includeResolved = searchParams.get("includeResolved") === "1";

  try {
    const requests = await loadRequestsForEmail(authEmail, includeResolved);
    return Response.json({ requests }, { status: 200 });
  } catch {
    return Response.json({ message: "Lookup failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!getSupabaseAdmin()) {
    return Response.json({ message: "Supabase service role not configured" }, { status: 500 });
  }

  const entitlement = await requireKnexchatEntitlement(req);
  if (entitlement.response) return entitlement.response;

  const authEmail = normalizeEmail(entitlement.user?.email ?? "");
  if (!isValidEmail(authEmail)) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      targetEmail?: string;
    };
    const targetEmail = normalizeEmail(body.targetEmail ?? body.email ?? "");
    if (!isValidEmail(targetEmail)) {
      return Response.json({ message: "Invalid target email" }, { status: 400 });
    }
    if (targetEmail === authEmail) {
      return Response.json({ message: "Cannot request yourself" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return Response.json({ message: "Supabase service role not configured" }, { status: 500 });
    }

    const { data: targetDirectory, error: targetDirectoryError } = await admin
      .from("knexchat_directory")
      .select("email, name")
      .eq("email", targetEmail)
      .maybeSingle();
    if (targetDirectoryError) throw targetDirectoryError;
    if (!targetDirectory?.email) {
      return Response.json({ message: "Target user not found in directory" }, { status: 422 });
    }

    const { data: reversePending, error: reversePendingError } = await admin
      .from("knexchat_contact_requests")
      .select("id")
      .eq("requester_email", targetEmail)
      .eq("target_email", authEmail)
      .eq("status", "pending")
      .maybeSingle();
    if (reversePendingError) throw reversePendingError;
    if (reversePending?.id) {
      return Response.json(
        { code: "INCOMING_PENDING", message: "Ja existe uma solicitacao recebida deste usuario." },
        { status: 409 },
      );
    }

    const { data: existing, error: existingError } = await admin
      .from("knexchat_contact_requests")
      .select("id, status")
      .eq("requester_email", authEmail)
      .eq("target_email", targetEmail)
      .maybeSingle();
    if (existingError) throw existingError;

    const now = new Date().toISOString();
    const { data: row, error: upsertError } = await admin
      .from("knexchat_contact_requests")
      .upsert(
        {
          requester_email: authEmail,
          target_email: targetEmail,
          status: "pending",
          responded_at: null,
          updated_at: now,
        },
        { onConflict: "requester_email,target_email" },
      )
      .select("id, requester_email, target_email, status, created_at, updated_at")
      .single();
    if (upsertError) throw upsertError;

    const nameByEmail = new Map<string, string>();
    const targetName = typeof targetDirectory.name === "string" ? targetDirectory.name.trim() : "";
    if (targetName) {
      nameByEmail.set(targetEmail, targetName);
    }

    return Response.json(
      { request: toApiRequest(authEmail, row as ContactRequestRow, nameByEmail) },
      { status: existing?.id ? 200 : 201 },
    );
  } catch {
    return Response.json({ message: "Insert failed" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!getSupabaseAdmin()) {
    return Response.json({ message: "Supabase service role not configured" }, { status: 500 });
  }

  const entitlement = await requireKnexchatEntitlement(req);
  if (entitlement.response) return entitlement.response;

  const authEmail = normalizeEmail(entitlement.user?.email ?? "");
  if (!isValidEmail(authEmail)) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      targetEmail?: string;
      action?: string;
    };
    const peerEmail = normalizeEmail(body.targetEmail ?? body.email ?? "");
    const action = typeof body.action === "string" ? body.action.trim().toLowerCase() : "";

    if (!isValidEmail(peerEmail)) {
      return Response.json({ message: "Invalid peer email" }, { status: 400 });
    }

    const incomingAction = action === "accept" || action === "reject" || action === "block";
    const outgoingAction = action === "cancel" || action === "delete" || action === "remove";
    if (!incomingAction && !outgoingAction) {
      return Response.json({ message: "Invalid action" }, { status: 400 });
    }

    const nextStatus: ContactRequestStatus =
      action === "accept"
        ? "accepted"
        : action === "block"
          ? "blocked"
          : action === "reject"
            ? "rejected"
            : "canceled";

    const now = new Date().toISOString();
    const admin = getSupabaseAdmin();
    if (!admin) {
      return Response.json({ message: "Supabase service role not configured" }, { status: 500 });
    }

    let updateQuery = admin
      .from("knexchat_contact_requests")
      .update({
        status: nextStatus,
        responded_at: now,
        updated_at: now,
      })
      .eq("status", "pending");

    if (incomingAction) {
      updateQuery = updateQuery.eq("requester_email", peerEmail).eq("target_email", authEmail);
    } else {
      updateQuery = updateQuery.eq("requester_email", authEmail).eq("target_email", peerEmail);
    }

    const { data: row, error: updateError } = await updateQuery
      .select("id, requester_email, target_email, status, created_at, updated_at")
      .maybeSingle();
    if (updateError) throw updateError;

    if (!row?.id) {
      return Response.json({ message: "Pending request not found" }, { status: 404 });
    }

    const nameByEmail = new Map<string, string>();
    const { data: directoryRow, error: directoryError } = await admin
      .from("knexchat_directory")
      .select("email, name")
      .eq("email", peerEmail)
      .maybeSingle();
    if (directoryError) throw directoryError;
    const peerName = typeof directoryRow?.name === "string" ? directoryRow.name.trim() : "";
    if (peerName) {
      nameByEmail.set(peerEmail, peerName);
    }

    return Response.json({ request: toApiRequest(authEmail, row as ContactRequestRow, nameByEmail) }, { status: 200 });
  } catch {
    return Response.json({ message: "Update failed" }, { status: 500 });
  }
}
