import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { type ChartPalette, type ChartStyle } from "@/lib/types";
import { defaultThemeDefaults } from "@/lib/theme-constants";

const allowedChartStyles: ChartStyle[] = ["gradient", "brush", "solid"];

const mergePalette = (input?: Partial<ChartPalette> | null): ChartPalette => ({
  ...defaultThemeDefaults.chart_palette,
  ...(input ?? {}),
});

const normalizeStyle = (value?: string | null): ChartStyle =>
  allowedChartStyles.includes(value as ChartStyle) ? (value as ChartStyle) : defaultThemeDefaults.chart_style;

export async function getThemeDefaults() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("theme_defaults")
    .select("chart_palette, chart_style")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    return defaultThemeDefaults;
  }

  return {
    chart_palette: mergePalette((data?.chart_palette as ChartPalette | null) ?? null),
    chart_style: normalizeStyle(data?.chart_style ?? null),
  };
}
