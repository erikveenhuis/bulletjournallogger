import { createServerSupabaseClient } from "@/lib/supabase/server";
import Link from "next/link";
import InsightsChart from "./insights-chart";
import { type ChartStyle } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="bujo-note text-sm text-yellow-900">
        Please <Link href="/sign-in">sign in</Link> to view insights.
      </div>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("chart_palette, chart_style")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: answers } = await supabase
    .from("answers")
    .select("*, question_templates(id,title, answer_types(*))")
    .eq("user_id", user.id)
    .order("question_date", { ascending: true });

  const { data: userQuestions } = await supabase
    .from("user_questions")
    .select("template_id, color_palette, answer_type_override:answer_types!answer_type_override_id(*)")
    .eq("user_id", user.id);

  const normalizedUserQuestions =
    userQuestions?.map((uq) => ({
      template_id: uq.template_id,
      color_palette: uq.color_palette,
      answer_type_override: Array.isArray(uq.answer_type_override)
        ? uq.answer_type_override[0] ?? null
        : uq.answer_type_override ?? null,
    })) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="bujo-section-title text-xs">Patterns</p>
          <h1 className="text-3xl font-semibold text-gray-900">Insights</h1>
          <p className="text-sm text-gray-700">Quick trends and export.</p>
        </div>
        <a
          href="/api/export"
          className="bujo-btn-secondary w-full justify-center text-sm sm:w-auto"
        >
          Download CSV
        </a>
      </div>
      <InsightsChart
        answers={answers || []}
        chartPalette={profile?.chart_palette as Record<string, string> | undefined}
        chartStyle={(profile?.chart_style as ChartStyle | null) || undefined}
        userQuestions={normalizedUserQuestions}
      />
    </div>
  );
}
