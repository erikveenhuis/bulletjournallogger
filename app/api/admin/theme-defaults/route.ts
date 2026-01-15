import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { type ChartPalette } from "@/lib/types";
import { defaultThemeDefaults } from "@/lib/theme-constants";

const hexColorPattern = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const allowedPaletteKeys = [
  "accent",
  "accentSoft",
  "booleanYes",
  "booleanNo",
  "scaleLow",
  "scaleHigh",
  "cardBackground",
  "cardText",
  "countBackground",
  "countAccent",
] as const;
const allowedChartStyles = ["gradient", "brush", "solid"] as const;
type ChartStyle = (typeof allowedChartStyles)[number];

async function requireAdmin() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return { response: NextResponse.json({ error: error.message }, { status: 400 }) };
  }

  if (!profile?.is_admin) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { supabase };
}

function normalizeHexColor(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!hexColorPattern.test(trimmed)) return null;
  const raw = trimmed.slice(1);
  const expanded = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  return `#${expanded.toLowerCase()}`;
}

function normalizePalette(input: unknown) {
  if (input === undefined) return undefined;
  if (input === null) return null;
  if (typeof input !== "object" || Array.isArray(input)) return { error: "chart_palette must be an object of hex colors." };

  const palette: Record<string, string> = {};

  for (const key of allowedPaletteKeys) {
    const value = (input as Record<string, unknown>)[key];
    if (value === undefined) continue;
    const normalized = normalizeHexColor(value);
    if (!normalized) {
      return { error: `Invalid color for ${key}. Use a hex value like #336699.` };
    }
    palette[key] = normalized;
  }

  return palette;
}

function mergePalette(palette?: Partial<ChartPalette> | null) {
  return { ...defaultThemeDefaults.chart_palette, ...(palette ?? {}) };
}

export async function GET() {
  const result = await requireAdmin();
  if ("response" in result) return result.response;

  const { supabase } = result;
  const { data, error } = await supabase
    .from("theme_defaults")
    .select("chart_palette, chart_style")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const chartStyle =
    data?.chart_style && allowedChartStyles.includes(data.chart_style as ChartStyle)
      ? (data.chart_style as ChartStyle)
      : defaultThemeDefaults.chart_style;

  return NextResponse.json({
    chart_palette: mergePalette((data?.chart_palette as ChartPalette | null) ?? null),
    chart_style: chartStyle,
  });
}

export async function PUT(request: Request) {
  const result = await requireAdmin();
  if ("response" in result) return result.response;

  const { supabase } = result;
  const body = await request.json();
  const { chart_palette, chart_style } = body ?? {};

  const normalizedPalette = normalizePalette(chart_palette);
  if (normalizedPalette && "error" in normalizedPalette) {
    return NextResponse.json({ error: normalizedPalette.error }, { status: 400 });
  }

  let normalizedChartStyle: ChartStyle | undefined;
  if (chart_style !== undefined) {
    if (chart_style === null) {
      normalizedChartStyle = defaultThemeDefaults.chart_style;
    } else if (!allowedChartStyles.includes(chart_style)) {
      return NextResponse.json({ error: "chart_style must be one of gradient, brush, or solid." }, { status: 400 });
    } else {
      normalizedChartStyle = chart_style;
    }
  }

  const { data: existing, error: existingError } = await supabase
    .from("theme_defaults")
    .select("chart_palette, chart_style")
    .eq("id", 1)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 400 });
  }

  const nextPalette =
    normalizedPalette === undefined
      ? mergePalette((existing?.chart_palette as ChartPalette | null) ?? null)
      : mergePalette((normalizedPalette as ChartPalette | null) ?? null);
  const nextStyle =
    normalizedChartStyle ??
    (existing?.chart_style && allowedChartStyles.includes(existing.chart_style as ChartStyle)
      ? (existing.chart_style as ChartStyle)
      : defaultThemeDefaults.chart_style);

  const { error } = await supabase
    .from("theme_defaults")
    .upsert({ id: 1, chart_palette: nextPalette, chart_style: nextStyle })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
