import { NextResponse } from "next/server";
import { getEffectiveUser, getEffectiveSupabaseClient } from "@/lib/auth";

const fiveMinutePattern = /^([01]\d|2[0-3]):([0-5]\d)(?::\d{2})?$/;
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

function isFiveMinuteIncrement(value: unknown) {
  if (typeof value !== "string") return false;
  const match = value.match(fiveMinutePattern);
  if (!match) return false;
  const minutes = Number.parseInt(match[2], 10);
  return minutes % 5 === 0;
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
  if (input === undefined) return undefined; // no update requested
  if (input === null) return null; // explicit clear
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

export async function GET() {
  const supabase = await getEffectiveSupabaseClient();
  const { user } = await getEffectiveUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const supabase = await getEffectiveSupabaseClient();
  const { user } = await getEffectiveUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { timezone, reminder_time, push_opt_in, chart_palette, chart_style } = body;

  if (
    reminder_time !== undefined &&
    reminder_time !== null &&
    !isFiveMinuteIncrement(reminder_time)
  ) {
    return NextResponse.json(
      { error: "Reminder time must be in 5-minute increments (HH:MM)." },
      { status: 400 },
    );
  }

  const normalizedPalette = normalizePalette(chart_palette);
  if (normalizedPalette && "error" in normalizedPalette) {
    return NextResponse.json({ error: normalizedPalette.error }, { status: 400 });
  }

  const isValidChartStyle = (value: unknown): value is ChartStyle =>
    typeof value === "string" && allowedChartStyles.includes(value as ChartStyle);

  let normalizedChartStyle: ChartStyle | undefined;
  if (chart_style !== undefined) {
    if (chart_style === null) {
      normalizedChartStyle = "gradient";
    } else if (!isValidChartStyle(chart_style)) {
      return NextResponse.json({ error: "chart_style must be one of gradient, brush, or solid." }, { status: 400 });
    } else {
      normalizedChartStyle = chart_style;
    }
  }

  const { error } = await supabase
    .from("profiles")
    .upsert({
      user_id: user.id,
      timezone,
      reminder_time: typeof reminder_time === "string" ? reminder_time.slice(0, 5) : reminder_time,
      push_opt_in,
      chart_palette: normalizedPalette === undefined ? undefined : normalizedPalette,
      chart_style: normalizedChartStyle,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
