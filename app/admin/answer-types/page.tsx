import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import AnswerTypesClient from "./answer-types-client";
import type { AnswerType } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminAnswerTypesPage() {
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

  const { data: answerTypes } = await supabase.from("answer_types").select("*").order("name");
  const { data: templateTypes } = await supabase.from("question_templates").select("answer_type_id");

  const usageMap = new Map<string, number>();
  (templateTypes as { answer_type_id: string }[] | null)?.forEach((row) => {
    const current = usageMap.get(row.answer_type_id) ?? 0;
    usageMap.set(row.answer_type_id, current + 1);
  });

  const answerTypesWithUsage = (answerTypes as AnswerType[] | null)?.map((at) => ({
    ...at,
    usageCount: usageMap.get(at.id) ?? 0,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--bujo-ink)]">Admin: answer types</h1>
          <p className="text-sm text-[var(--bujo-subtle)]">View usage, edit existing types, or remove unused ones.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin" className="bujo-btn-secondary text-sm">
            Back to admin
          </Link>
          <Link href="/admin/answer-types/new" className="bujo-btn text-sm">
            Add answer type
          </Link>
        </div>
      </div>
      <AnswerTypesClient answerTypes={answerTypesWithUsage || []} />
    </div>
  );
}
