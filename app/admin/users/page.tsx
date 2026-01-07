import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AdminProfile } from "@/lib/types";
import UsersClient from "./users-client";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
        Please <Link href="/sign-in">sign in</Link> as admin.
      </div>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        Admin access required.
      </div>
    );
  }

  const adminClient = createAdminClient();
  const [profilesResult, authUsersResult] = await Promise.all([
    adminClient
      .from("profiles")
      .select("user_id,timezone,reminder_time,push_opt_in,is_admin,created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    adminClient.auth.admin.listUsers({ page: 1, perPage: 200 }),
  ]);

  const authUserMap = new Map(
    (authUsersResult.data?.users || []).map((u) => [
      u.id,
      {
        email: u.email,
        last_sign_in_at: u.last_sign_in_at,
        auth_created_at: u.created_at,
      },
    ]),
  );

  const profiles: AdminProfile[] = (profilesResult.data || []).map((p) => {
    const authUser = authUserMap.get(p.user_id);
    return {
      ...p,
      email: authUser?.email ?? null,
      last_sign_in_at: authUser?.last_sign_in_at ?? null,
      auth_created_at: authUser?.auth_created_at ?? null,
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--bujo-ink)]">Admin: users</h1>
          <p className="text-sm text-[var(--bujo-subtle)]">View user profiles, timezones, and admin access.</p>
        </div>
        <Link href="/admin" className="bujo-btn-secondary text-sm">
          Back to admin
        </Link>
      </div>

      <UsersClient profiles={profiles} currentUserId={user.id} />
    </div>
  );
}
