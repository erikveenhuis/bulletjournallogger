import Link from "next/link";
import QuestionForm from "../../question-form";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { QuestionTemplate } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = {
  params: {
    id: string;
  };
};

export default async function AdminQuestionEditPage({ params }: Params) {
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

  const resolvedParams = await Promise.resolve(params as Params["params"] | Promise<Params["params"]>);
  const rawId = Array.isArray(resolvedParams?.id) ? resolvedParams.id[0] : resolvedParams?.id;
  const templateId = typeof rawId === "string" ? rawId : "";
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(templateId);
  if (!templateId || !isUuid) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        Invalid question template id: {String(rawId ?? "")}
      </div>
    );
  }

  const adminClient = createAdminClient();
  const [templateResult, categoriesResult, answerTypesResult] = await Promise.all([
    adminClient
      .from("question_templates")
      .select("*, categories(name), answer_types(*)")
      .eq("id", templateId)
      .maybeSingle(),
    adminClient.from("categories").select("*").order("name"),
    adminClient.from("answer_types").select("*").order("name"),
  ]);

  if (templateResult.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        Failed to load question template: {templateResult.error.message}
      </div>
    );
  }

  const questionTemplate = templateResult.data;
  if (!questionTemplate) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        Question template not found.
      </div>
    );
  }

  if (categoriesResult.error || answerTypesResult.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        Failed to load supporting data. Please refresh and try again.
      </div>
    );
  }

  const categories = categoriesResult.data;
  const answerTypes = answerTypesResult.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--bujo-ink)]">Edit question</h1>
          <p className="text-sm text-[var(--bujo-subtle)]">Update question template and preview answer type defaults.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/questions" className="bujo-btn-secondary text-sm">
            Back to questions
          </Link>
        </div>
      </div>

      <QuestionForm
        mode="edit"
        initialData={questionTemplate as QuestionTemplate}
        categories={categories || []}
        answerTypes={answerTypes || []}
      />
    </div>
  );
}
