import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const adminSections = [
  {
    href: "/admin/categories",
    title: "Categories",
    description: "Create, rename, and remove categories for questions.",
  },
  {
    href: "/admin/questions",
    title: "Questions",
    description: "Manage question templates and their metadata.",
  },
  {
    href: "/admin/users",
    title: "Users",
    description: "Review user profiles, timezones, and admin access.",
  },
  {
    href: "/admin/notifications",
    title: "Notifications",
    description: "View push subscription stats and clean up stale entries.",
  },
];

export default async function AdminHomePage() {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Admin panel</h1>
        <p className="text-sm text-gray-600">Choose a section to manage.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {adminSections.map((section) => (
          <div key={section.href} className="bujo-card bujo-torn">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--bujo-ink)]">{section.title}</h2>
                <p className="text-sm text-[var(--bujo-subtle)]">{section.description}</p>
              </div>
              <span className="bujo-chip text-xs">Admin</span>
            </div>
            <div className="mt-4">
              <Link href={section.href} className="bujo-btn text-sm">
                Open
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
