import { createAdminClient } from "@/lib/supabase/admin";
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

  const adminClient = createAdminClient();
  const [categoriesResult, answerTypesResult, templatesResult] = await Promise.all([
    adminClient.from("categories").select("*").order("name"),
    adminClient.from("answer_types").select("*").order("name"),
    adminClient.from("question_templates").select("*, categories(name), answer_types(*)").order("title"),
  ]);

  if (categoriesResult.error || answerTypesResult.error || templatesResult.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        Failed to load question templates. Please refresh and try again.
      </div>
    );
  }

  const categories = categoriesResult.data;
  const answerTypes = answerTypesResult.data;
  const templates = templatesResult.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--bujo-ink)]">Admin: questions</h1>
          <p className="text-sm text-[var(--bujo-subtle)]">Manage question templates.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin" className="bujo-btn-secondary text-sm">
            Back to admin
          </Link>
          <Link href="/admin/questions/new" className="bujo-btn text-sm">
            Add question
          </Link>
        </div>
      </div>

      <AdminForms
        categories={categories || []}
        answerTypes={answerTypes || []}
        templates={templates || []}
      />
    </div>
  );
}
