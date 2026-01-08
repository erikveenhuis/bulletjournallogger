import { createServerSupabaseClient } from "./supabase/server";
import { cookies } from "next/headers";

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

export async function getEffectiveAdminStatus() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    return false;
  }

  // Admins should always have access to admin panel, even when impersonating
  // The impersonation affects data access, not admin panel visibility
  return true;
}

export async function getImpersonatedUser() {
  const cookieStore = await cookies();
  const impersonatedUserId = cookieStore.get("bulletjournal_impersonated_user_id")?.value;


  if (!impersonatedUserId) {
    return null;
  }

  // Use admin client to check for impersonated user
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = await createAdminClient();

  // Verify the impersonated user exists
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", impersonatedUserId)
    .maybeSingle();


  return profile;
}

export async function isImpersonating() {
  const cookieStore = await cookies();
  const impersonatedUserId = cookieStore.get("bulletjournal_impersonated_user_id")?.value;
  return !!impersonatedUserId;
}

export async function getEffectiveUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user: actualUser },
  } = await supabase.auth.getUser();

  if (!actualUser) {
    return { user: null, error: "No user" };
  }

  // Check if we're impersonating
  const impersonatedUser = await getImpersonatedUser();


  if (impersonatedUser) {
    // Return impersonated user data but keep the actual auth session
    return {
      user: {
        ...actualUser,
        id: impersonatedUser.user_id,
        email: actualUser.email, // Keep actual email for auth purposes
        impersonating: true,
        actual_user_id: actualUser.id,
        impersonated_user_id: impersonatedUser.user_id,
      },
      error: null
    };
  }

  return { user: actualUser, error: null };
}

export async function getEffectiveSupabaseClient() {
  const isCurrentlyImpersonating = await isImpersonating();

  if (isCurrentlyImpersonating) {
    // When impersonating, use admin client to bypass RLS
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const adminClient = createAdminClient();
    return adminClient;
  } else {
    // When not impersonating, use regular client with RLS
    return createServerSupabaseClient();
  }
}
