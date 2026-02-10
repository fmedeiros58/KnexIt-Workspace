import { identitySupabase } from "./identitySupabaseClient";

export async function getCurrentUser() {
  const { data, error } = await identitySupabase().auth.getUser();
  if (error) return null;
  return data.user;
}

export async function getCurrentSession() {
  const { data, error } = await identitySupabase().auth.getSession();
  if (error) return null;
  return data.session;
}
