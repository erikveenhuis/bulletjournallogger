import { createServerSupabaseClient } from "@/lib/supabase/server";
import Link from "next/link";
import AdminForms from "./questions-client";

export const dynamic = "force-dynamic";

export default async function AdminQuestionsPage() {
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

  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .order("name");

  const { data: templates } = await supabase
    .from("question_templates")
    .select("*, categories(name)")
    .order("title");

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--bujo-ink)]">Admin: questions</h1>
          <p className="text-sm text-[var(--bujo-subtle)]">Manage question templates.</p>
        </div>
        <Link href="/admin" className="bujo-btn-secondary text-sm">
          Back to admin
        </Link>
      </div>

      <AdminForms categories={categories || []} templates={templates || []} />
    </div>
  );
}
