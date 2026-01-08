import { getEffectiveUser, getEffectiveSupabaseClient } from "@/lib/auth";
import { AnswerType, QuestionTemplate, UserQuestion } from "@/lib/types";
import TemplatesClient from "../templates-client";
import SelectedQuestions from "../selected-questions";

export const dynamic = "force-dynamic";

export default async function QuestionsPage() {
  const supabase = await getEffectiveSupabaseClient();
  const { user: effectiveUser } = await getEffectiveUser();

  if (!effectiveUser) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
        Please <a href="/sign-in" className="underline">sign in</a> to manage your questions.
      </div>
    );
  }

  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .order("name");

  const { data: answerTypes } = await supabase.from("answer_types").select("*").order("name");

  const { data: templates } = await supabase
    .from("question_templates")
    .select("*, categories(name), answer_types(*)")
    .eq("is_active", true)
    .order("title");

  const { data: userQuestions } = await supabase
    .from("user_questions")
    .select(
      "*, template:question_templates(*, categories(name), answer_types(*)), answer_type_override:answer_types!answer_type_override_id(*)",
    )
    .eq("user_id", effectiveUser.id)
    .eq("is_active", true)
    .order("sort_order");

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="bujo-section-title text-xs">Profile</p>
          <h1 className="text-3xl font-semibold text-gray-900">My questions</h1>
          <p className="text-sm text-gray-700">
            Browse templates and customize your daily questions.
          </p>
        </div>
      </div>

      <TemplatesClient
        categories={categories || []}
        templates={(templates || []) as QuestionTemplate[]}
        userQuestions={(userQuestions || []) as UserQuestion[]}
      />

      <SelectedQuestions
        userQuestions={(userQuestions || []) as UserQuestion[]}
        answerTypes={(answerTypes || []) as AnswerType[]}
      />
    </div>
  );
}