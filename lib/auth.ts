import { createServerSupabaseClient } from "./supabase/server";

export async function getCurrentUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return { user: null, error };
  }

  return { user, error: null };
}

export async function getSession() {
  const supabase = await createServerSupabaseClient();
  const session = await supabase.auth.getSession();
  return session.data.session;
}
