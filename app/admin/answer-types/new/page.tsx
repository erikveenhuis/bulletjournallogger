import Link from "next/link";
import AnswerTypeForm from "../answer-type-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminAnswerTypeCreatePage() {
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
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--bujo-ink)]">Add answer type</h1>
          <p className="text-sm text-[var(--bujo-subtle)]">Create a reusable answer type for templates.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/answer-types" className="bujo-btn-secondary text-sm">
            Back to answer types
          </Link>
        </div>
      </div>

      <AnswerTypeForm mode="create" />
    </div>
  );
}
