import { getEffectiveUser, getEffectiveSupabaseClient, getEffectiveAdminStatus, isImpersonating } from "@/lib/auth";
import { getThemeDefaults } from "@/lib/theme-defaults";
import Link from "next/link";
import InsightsChart from "./insights-chart";
import { type ChartStyle } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const supabase = await getEffectiveSupabaseClient();
  const { user: effectiveUser } = await getEffectiveUser();

  if (!effectiveUser) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
        Please <Link href="/sign-in">sign in</Link> to view insights.
      </div>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("chart_palette, chart_style, account_tier, is_admin, date_format")
    .eq("user_id", effectiveUser.id)
    .maybeSingle();

  const themeDefaults = await getThemeDefaults();
  const accountTier = profile?.account_tier ?? 0;
  const isCurrentlyImpersonating = await isImpersonating();
  const isAdmin = profile?.is_admin || (!isCurrentlyImpersonating && (await getEffectiveAdminStatus()));
  const effectiveTier = isAdmin ? 4 : accountTier;
  const canUseCustomColors = effectiveTier >= 2;

  const { data: answers } = await supabase
    .from("answers")
    .select("*, question_templates(id,title, meta, answer_types(*))")
    .eq("user_id", effectiveUser.id)
    .order("question_date", { ascending: true });

  const { data: userQuestions } = await supabase
    .from("user_questions")
    .select("template_id, color_palette, sort_order, display_option_override")
    .eq("user_id", effectiveUser.id)
    .eq("is_active", true)
    .order("sort_order");

  const normalizedUserQuestions = canUseCustomColors
    ? userQuestions?.map((uq) => ({
        template_id: uq.template_id,
        color_palette: uq.color_palette,
        sort_order: uq.sort_order,
        display_option_override: uq.display_option_override,
      })) ?? []
    : [];

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
          className="bujo-btn w-full justify-center text-sm sm:w-auto"
        >
          Download CSV
        </a>
      </div>
      <InsightsChart
        answers={answers || []}
        chartPalette={
          canUseCustomColors ? (profile?.chart_palette as Record<string, string> | undefined) : null
        }
        chartStyle={canUseCustomColors ? ((profile?.chart_style as ChartStyle | null) || null) : null}
        userQuestions={normalizedUserQuestions}
        defaultPalette={themeDefaults.chart_palette}
        defaultStyle={themeDefaults.chart_style}
        dateFormat={profile?.date_format ?? null}
      />
    </div>
  );
}
