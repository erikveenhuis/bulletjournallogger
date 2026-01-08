import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AnswerType, QuestionTemplate, UserQuestion } from "@/lib/types";
import Link from "next/link";
import ProfileForm from "./profile-form";
import TemplatesClient from "./templates-client";
import SelectedQuestions from "./selected-questions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
        Please <Link href="/sign-in">sign in</Link> to manage your questions.
      </div>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

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
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("sort_order");

  const timezoneOptions = [
    "UTC",
    "Europe/Amsterdam",
    "Europe/London",
    "America/New_York",
    "America/Los_Angeles",
    "Asia/Singapore",
    "Asia/Tokyo",
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="bujo-section-title text-xs">Setup</p>
          <h1 className="text-3xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-700">
            Configure your reminders and daily questions.
          </p>
        </div>
        <Link
          href="/journal"
          className="bujo-btn w-full justify-center text-sm sm:w-auto"
        >
          Go to today&apos;s questions
        </Link>
      </div>

      <ProfileForm
        profile={profile}
        timezoneOptions={timezoneOptions}
      />

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
