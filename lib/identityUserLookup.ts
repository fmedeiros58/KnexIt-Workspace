import type { SupabaseClient, User } from "@supabase/supabase-js";

type FindUserResult = {
  user: User | null;
  error: Error | null;
};

const toError = (value: unknown) => {
  if (value instanceof Error) return value;
  if (typeof value === "string" && value.trim()) return new Error(value);
  return new Error("Unknown identity lookup error.");
};

export const findUserByEmail = async (
  admin: SupabaseClient,
  email: string,
): Promise<FindUserResult> => {
  const normalizedEmail = email.toLowerCase();
  let page = 1;
  const perPage = 200;

  for (;;) {
    let data: Awaited<ReturnType<typeof admin.auth.admin.listUsers>>["data"] | null = null;
    let error: Awaited<ReturnType<typeof admin.auth.admin.listUsers>>["error"] | null = null;
    try {
      const response = await admin.auth.admin.listUsers({ page, perPage });
      data = response.data;
      error = response.error;
    } catch (lookupError) {
      return { user: null, error: toError(lookupError) };
    }
    if (error) {
      return { user: null, error };
    }
    const user = data?.users?.find(
      (entry) => (entry.email ?? "").toLowerCase() === normalizedEmail,
    );
    if (user) {
      return { user, error: null };
    }
    if (!data?.users || data.users.length < perPage) {
      return { user: null, error: null };
    }
    if (data?.nextPage && data.nextPage !== page) {
      page = data.nextPage;
      continue;
    }
    if (data?.lastPage && page < data.lastPage) {
      page += 1;
      continue;
    }
    return { user: null, error: null };
  }
};
