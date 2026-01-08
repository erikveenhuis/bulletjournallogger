import { getEffectiveUser, getEffectiveSupabaseClient } from "@/lib/auth";
import type { UserQuestion } from "@/lib/types";
import Link from "next/link";
import JournalForm from "./journal-form";

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  const supabase = await getEffectiveSupabaseClient();
  const { user: effectiveUser } = await getEffectiveUser();


  if (!effectiveUser) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
        Please <Link href="/sign-in">sign in</Link> to log your answers.
      </div>
    );
  }

  const { data: userQuestions } = await supabase
    .from("user_questions")
    .select("*, template:question_templates(*, categories(name), answer_types(*))")
    .eq("user_id", effectiveUser.id)
    .eq("is_active", true)
    .order("sort_order");


  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="bujo-section-title text-xs">Today&apos;s spread</p>
          <h1 className="text-3xl font-semibold text-gray-900">Today&apos;s questions</h1>
          <p className="text-sm text-gray-700">
            Pick a date on the calendar and log answers for that day.
          </p>
        </div>
        <Link href="/profile" className="bujo-btn-secondary w-full justify-center text-sm sm:w-auto">
          Edit questions
        </Link>
      </div>
      <JournalForm
        date={today}
        userQuestions={(userQuestions || []) as UserQuestion[]}
      />
    </div>
  );
}
