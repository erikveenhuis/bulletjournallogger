import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import NotificationsClient from "./notifications-client";
import type { PushSubscription } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
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
  const { data: subscriptions } = await adminClient
    .from("push_subscriptions")
    // Explicitly join on the FK to ensure profile fields are returned.
    .select(
      "id,user_id,endpoint,ua,created_at,profiles:profiles!push_subscriptions_user_id_fkey(timezone,reminder_time,push_opt_in)",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--bujo-ink)]">Admin: notifications</h1>
          <p className="text-sm text-[var(--bujo-subtle)]">View and prune push subscription entries.</p>
        </div>
        <Link href="/admin" className="bujo-btn-secondary text-sm">
          Back to admin
        </Link>
      </div>

      <NotificationsClient subscriptions={(subscriptions || []) as PushSubscription[]} />
    </div>
  );
}
