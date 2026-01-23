import { getEffectiveUser, getEffectiveSupabaseClient, getEffectiveAdminStatus, isImpersonating } from "@/lib/auth";
import { getThemeDefaults } from "@/lib/theme-defaults";
import { AnswerType, QuestionTemplate, UserQuestion } from "@/lib/types";
import TemplatesClient from "../templates-client";
import SelectedQuestions from "../selected-questions";
import CustomQuestions from "../custom-questions";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_tier, chart_palette, chart_style, is_admin")
    .eq("user_id", effectiveUser.id)
    .maybeSingle();

  const themeDefaults = await getThemeDefaults();
  const accountTier = profile?.account_tier ?? 0;
  const isCurrentlyImpersonating = await isImpersonating();
  const isAdmin = profile?.is_admin || (!isCurrentlyImpersonating && (await getEffectiveAdminStatus()));
  const effectiveTier = isAdmin ? 4 : accountTier;

  const { data: answerTypes } = await supabase
    .from("answer_types")
    .select("*")
    .eq("is_active", true)
    .order("name");

  const { data: templates } = await supabase
    .from("question_templates")
    .select("*, categories(name), answer_types(*)")
    .is("created_by", null)
    .eq("is_active", true)
    .order("title");

  const { data: customTemplates } = await supabase
    .from("question_templates")
    .select("*, categories(name), answer_types(*)")
    .eq("created_by", effectiveUser.id)
    .order("created_at", { ascending: false });

  const { data: userQuestions } = await supabase
    .from("user_questions")
    .select(
      "*, template:question_templates(*, categories(name), answer_types(*))",
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

      {effectiveTier >= 3 ? (
        <CustomQuestions
          categories={categories || []}
          answerTypes={(answerTypes || []) as AnswerType[]}
          templates={(customTemplates || []) as QuestionTemplate[]}
          userQuestions={(userQuestions || []) as UserQuestion[]}
        />
      ) : (
        <div className="rounded-lg border border-[var(--bujo-border)] bg-white p-4 text-sm text-gray-700">
          Want to build your own questions? <a href="/profile/account" className="underline">Upgrade your account</a> to unlock custom
          questions and answer combinations.
        </div>
      )}

      <SelectedQuestions
        userQuestions={(userQuestions || []) as UserQuestion[]}
        accountTier={effectiveTier}
        userId={effectiveUser.id}
        chartPalette={profile?.chart_palette ?? null}
        chartStyle={profile?.chart_style ?? null}
        defaultPalette={themeDefaults.chart_palette}
        defaultStyle={themeDefaults.chart_style}
      />
    </div>
  );
}