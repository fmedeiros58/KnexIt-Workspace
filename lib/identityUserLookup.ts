import type { SupabaseClient, User } from "@supabase/supabase-js";

type FindUserResult = {
  user: User | null;
  error: Error | null;
};

export const findUserByEmail = async (
  admin: SupabaseClient,
  email: string,
): Promise<FindUserResult> => {
  const normalizedEmail = email.toLowerCase();
  let page = 1;
  const perPage = 200;

  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
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
