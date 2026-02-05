"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, Line, getElementAtEvent } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend as ChartLegend,
  type ChartOptions,
  type LinearScaleOptions,
  type TooltipItem,
} from "chart.js";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subMonths,
} from "date-fns";
import { formatDateValue, normalizeDateFormat } from "@/lib/date-format";
import { type ChartPalette, type ChartStyle, type DateFormat, type DisplayOption } from "@/lib/types";
import { defaultThemeDefaults } from "@/lib/theme-constants";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, ChartLegend);

type AnswerRow = {
  id: string;
  user_id: string;
  template_id: string;
  question_date: string;
  prompt_snapshot: string | null;
  category_snapshot: string | null;
  bool_value: boolean | null;
  number_value: number | null;
  scale_value: number | null;
  text_value: string | null;
  created_at: string;
  updated_at: string;
  question_templates?:
    | {
        id?: string;
        title?: string;
        meta?: Record<string, unknown> | null;
        answer_types?: {
          type?: string | null;
          meta?: Record<string, unknown> | null;
          default_display_option?: DisplayOption | null;
          allowed_display_options?: DisplayOption[] | null;
        } | null;
      }
    | null;
};

type QuestionSeries = {
  id: string;
  templateId?: string;
  promptSnapshot?: string | null;
  categorySnapshot?: string | null;
  label: string;
  type: "number" | "boolean" | "text" | "single_choice" | "multi_choice" | "other";
  typeLabel: string;
  unit?: string;
  decimals?: number;
  points: Array<{ date: string; value: number }>;
  textPoints?: Array<{ date: string; value: string; rawValue?: string | string[] }>;
  palette?: ChartPalette;
  defaultDisplayOption?: DisplayOption;
  allowedDisplayOptions?: DisplayOption[];
  choiceSteps?: string[];
};

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const defaultPalette = defaultThemeDefaults.chart_palette;
const defaultStyle = defaultThemeDefaults.chart_style;
const defaultChoiceSteps = ["1", "2", "3", "4", "5"];
const displayOptionLabels: Record<DisplayOption, string> = {
  graph: "Graph",
  list: "List",
  grid: "Grid",
  count: "Count",
};

const normalizeDecimals = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  const rounded = Math.round(numeric);
  if (rounded < 0 || rounded > 4) return null;
  return rounded;
};

const getNumberStep = (decimals: number) => {
  if (decimals <= 0) return 1;
  return Number(`0.${"0".repeat(Math.max(0, decimals - 1))}1`);
};
const uncategorizedId = "uncategorized";

type ScaleColors = {
  veryLow: string;
  low: string;
  mid: string;
  high: string;
  veryHigh: string;
};

const hexColorPattern = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function normalizeHexColor(value?: string | null) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!hexColorPattern.test(trimmed)) return null;
  const raw = trimmed.slice(1);
  const expanded = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  return `#${expanded.toLowerCase()}`;
}

function normalizeDisplayOption(value: unknown): DisplayOption | null {
  return value === "list" || value === "grid" || value === "count" || value === "graph" ? value : null;
}

function normalizeDisplayOptions(values: unknown): DisplayOption[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => normalizeDisplayOption(value))
    .filter((value): value is DisplayOption => value !== null);
}

function isEmojiOnly(value: string) {
  const cleaned = value.replace(/\s+/g, "");
  if (!cleaned) return false;
  return /^[\p{Extended_Pictographic}\uFE0F\u200D\u{1F3FB}-\u{1F3FF}]+$/u.test(cleaned);
}

function normalizeCategory(value?: string | null) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    return { id: uncategorizedId, label: "Uncategorized" };
  }
  return { id: trimmed.toLowerCase(), label: trimmed };
}

function getChoiceSteps(meta?: Record<string, unknown> | null) {
  const rawSteps = meta?.["steps"];
  if (Array.isArray(rawSteps)) {
    const normalized = rawSteps.map((step) => String(step).trim()).filter((step) => step.length > 0);
    if (normalized.length >= 2) return normalized;
  }
  return defaultChoiceSteps;
}

type ChoiceScale = {
  steps: string[];
  values: number[];
  min: number;
  max: number;
  isNumeric: boolean;
  labelByValue: Map<number, string>;
};

function buildChoiceScale(steps: string[]) {
  const resolved = steps.length > 0 ? steps : defaultChoiceSteps;
  const numericSteps = resolved.map((step) => Number(step));
  const isNumeric = numericSteps.every((value) => Number.isFinite(value));
  const values = isNumeric ? numericSteps : resolved.map((_, index) => index + 1);
  const labelByValue = new Map<number, string>();
  values.forEach((value, index) => {
    labelByValue.set(value, resolved[index] ?? String(value));
  });
  return {
    steps: resolved,
    values,
    min: Math.min(...values),
    max: Math.max(...values),
    isNumeric,
    labelByValue,
  };
}

function mapChoiceToValue(raw: string | string[] | null | undefined, scale: ChoiceScale) {
  if (!raw) return null;
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (!candidate) return null;
  const trimmed = candidate.trim();
  if (!trimmed) return null;
  const index = scale.steps.findIndex((step) => step === trimmed);
  if (index >= 0) return scale.values[index] ?? null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function sanitizePalette(input?: Partial<ChartPalette> | null, fallback?: ChartPalette): ChartPalette {
  const palette = { ...(fallback ?? defaultPalette) };
  if (!input) return palette;
  (Object.keys(palette) as Array<keyof ChartPalette>).forEach((key) => {
    const normalized = normalizeHexColor(input[key] || undefined);
    if (normalized) {
      palette[key] = normalized;
    }
  });
  return palette;
}

function hexToRgb(hex: string) {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return null;
  const raw = normalized.slice(1);
  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16),
  };
}

function toRgba(hex: string, alpha: number, fallback: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return fallback;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function mixHex(from: string, to: string, ratio: number, fallback: string) {
  const start = hexToRgb(from);
  const end = hexToRgb(to);
  if (!start || !end) return fallback;
  const mix = (a: number, b: number) => Math.round(a + (b - a) * ratio);
  const r = mix(start.r, end.r).toString(16).padStart(2, "0");
  const g = mix(start.g, end.g).toString(16).padStart(2, "0");
  const b = mix(start.b, end.b).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}

function buildScaleColors(palette: ChartPalette): ScaleColors {
  return {
    veryLow: palette.scaleLow,
    low: mixHex(palette.scaleLow, palette.scaleHigh, 0.25, palette.scaleLow),
    mid: mixHex(palette.scaleLow, palette.scaleHigh, 0.5, palette.scaleLow),
    high: mixHex(palette.scaleLow, palette.scaleHigh, 0.75, palette.scaleHigh),
    veryHigh: palette.scaleHigh,
  };
}

type UserQuestionOverride = {
  template_id: string;
  color_palette?: ChartPalette | null;
  sort_order?: number | null;
  display_option_override?: DisplayOption | null;
};

function toQuestionSeries(answers: AnswerRow[], overrides?: Map<string, UserQuestionOverride>): QuestionSeries[] {
  return Object.values(
    answers.reduce<Record<string, QuestionSeries>>((acc, row) => {
      const override = row.template_id ? overrides?.get(row.template_id) : undefined;
      const templateMeta = (row.question_templates?.meta as Record<string, unknown> | null) || null;
      const answerTypeMeta =
        ((row.question_templates?.answer_types?.meta as Record<string, unknown> | null) || null);
      const metaUnit = templateMeta?.["unit"] ?? answerTypeMeta?.["unit"];
      const unit = typeof metaUnit === "string" ? metaUnit : undefined;
      const metaDecimals = templateMeta?.["decimals"] ?? answerTypeMeta?.["decimals"];
      const decimals = normalizeDecimals(metaDecimals) ?? 0;
      const defaultDisplay = normalizeDisplayOption(
        row.question_templates?.answer_types?.default_display_option,
      );
      const allowedDisplays = normalizeDisplayOptions(
        row.question_templates?.answer_types?.allowed_display_options,
      );
      const rawType = row.question_templates?.answer_types?.type as QuestionSeries["type"] | undefined;
      const type =
        rawType === "boolean" ||
        rawType === "number" ||
        rawType === "text" ||
        rawType === "single_choice" ||
        rawType === "multi_choice"
          ? rawType
          : "other";
      const templateId = row.template_id || undefined;
      const palette = (override?.color_palette as ChartPalette | undefined) || undefined;
      const choiceSteps =
        type === "single_choice" || type === "multi_choice"
          ? getChoiceSteps(templateMeta ?? answerTypeMeta ?? null)
          : undefined;
      const choiceScale = type === "single_choice" ? buildChoiceScale(choiceSteps ?? defaultChoiceSteps) : null;
      const textEntry = (() => {
        if (type === "text" || type === "single_choice") {
          const raw = row.text_value ?? null;
          return raw ? { display: raw, raw } : null;
        }
        if (type === "multi_choice") {
          if (!row.text_value) return null;
          try {
            const parsed = JSON.parse(row.text_value);
            if (Array.isArray(parsed)) {
              const normalized = parsed.map((entry) => String(entry));
              return {
                display: normalized.join(", "),
                raw: normalized,
              };
            }
          } catch {
            return null;
          }
        }
        return null;
      })();
      const value =
        type === "boolean"
          ? row.bool_value === null || row.bool_value === undefined
            ? null
            : row.bool_value
              ? 1
              : 0
          : type === "number"
            ? row.number_value ?? row.scale_value
            : null;

      if (type === "text" || type === "single_choice" || type === "multi_choice") {
        if (!textEntry?.display || textEntry.display.trim().length === 0) return acc;
      } else if (value === null || value === undefined) {
        return acc;
      }

      const id = row.template_id || row.prompt_snapshot || "unknown-question";
      const label = row.prompt_snapshot || row.question_templates?.title || "Untitled question";
      const typeLabel =
        type === "number"
          ? "Number"
          : type === "boolean"
            ? "Yes / No"
            : type === "text"
              ? "Text"
              : type === "single_choice"
                ? "Single choice"
                : type === "multi_choice"
                  ? "Multiple choice"
                  : "Value";

      if (!acc[id]) {
        acc[id] = {
          id,
          templateId,
          promptSnapshot: row.prompt_snapshot,
          categorySnapshot: row.category_snapshot,
          label,
          type,
          typeLabel,
          unit,
          decimals,
          points: [],
          textPoints:
            type === "text" || type === "single_choice" || type === "multi_choice"
              ? []
              : undefined,
          palette,
          defaultDisplayOption: defaultDisplay ?? undefined,
          allowedDisplayOptions: allowedDisplays.length > 0 ? allowedDisplays : undefined,
          choiceSteps,
        };
      } else if (palette && !acc[id].palette) {
        acc[id].palette = palette;
      }
      if (type === "text" || type === "single_choice" || type === "multi_choice") {
        if (textEntry) {
          acc[id].textPoints?.push({
            date: row.question_date,
            value: textEntry.display,
            rawValue: textEntry.raw,
          });
        }
        if (type === "single_choice") {
          const numericChoice = mapChoiceToValue(textEntry?.raw ?? null, choiceScale ?? buildChoiceScale(defaultChoiceSteps));
          if (numericChoice !== null) {
            acc[id].points.push({ date: row.question_date, value: numericChoice });
          }
        }
      } else {
        acc[id].points.push({ date: row.question_date, value: Number(value) });
      }
      return acc;
    }, {}),
  ).map((series) => ({
    ...series,
    points: series.points.sort((a, b) => a.date.localeCompare(b.date)),
    textPoints: series.textPoints?.sort((a, b) => a.date.localeCompare(b.date)),
  }));
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

function isFutureDate(date: string) {
  const today = new Date();
  const target = parseISO(date);
  return target > today;
}

function buildDailyAverages(series: QuestionSeries) {
  const grouped = series.points.reduce<Record<string, number[]>>((map, p) => {
    map[p.date] = map[p.date] ? [...map[p.date], p.value] : [p.value];
    return map;
  }, {});
  const entries = Object.entries(grouped).map(([date, vals]) => ({
    date,
    value: average(vals),
  }));
  entries.sort((a, b) => a.date.localeCompare(b.date));
  return entries;
}

function buildTextMap(series: QuestionSeries) {
  if (!series.textPoints || series.textPoints.length === 0) return {};
  return series.textPoints.reduce<Record<string, string>>((acc, point) => {
    acc[point.date] = point.value;
    return acc;
  }, {});
}

function colorForValue(
  value: number,
  type: QuestionSeries["type"],
  maxValue: number,
  palette: ChartPalette,
  scaleColors: ScaleColors,
) {
  if (type === "boolean") {
    return value >= 1 ? palette.booleanYes : palette.booleanNo;
  }
  if (type === "number") {
    if (maxValue <= 0) return "#e5e7eb";
    const ratio = Math.min(1, Math.max(0, value / maxValue));
    if (ratio >= 0.8) return scaleColors.veryHigh;
    if (ratio >= 0.6) return scaleColors.high;
    if (ratio >= 0.4) return scaleColors.mid;
    if (ratio >= 0.2) return scaleColors.low;
    return scaleColors.veryLow;
  }
  // other — fall back to accent with alpha
  if (maxValue <= 0) return "#e5e7eb";
  const ratio = Math.min(1, value / maxValue);
  const alpha = 0.2 + 0.6 * ratio;
  return toRgba(palette.accent, alpha, `rgba(124, 92, 255, ${alpha.toFixed(2)})`);
}

function upsertPoint(points: Array<{ date: string; value: number }>, date: string, value: number) {
  const filtered = points.filter((p) => p.date !== date);
  return [...filtered, { date, value }].sort((a, b) => a.date.localeCompare(b.date));
}

function upsertTextPoint(
  points: Array<{ date: string; value: string; rawValue?: string | string[] }>,
  date: string,
  value: string | null,
  rawValue?: string | string[],
) {
  const filtered = points.filter((p) => p.date !== date);
  const shouldRemove =
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim().length === 0) ||
    (Array.isArray(rawValue) && rawValue.length === 0);
  if (shouldRemove) return filtered;
  return [...filtered, { date, value, rawValue }].sort((a, b) => a.date.localeCompare(b.date));
}

function LegendKey({
  type,
  palette,
}: {
  type: QuestionSeries["type"];
  palette: ChartPalette;
}) {
  if (type === "boolean") {
    return (
      <div className="mt-2 flex items-center gap-3 text-xs text-gray-700">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: palette.booleanYes }} />
          Yes
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: palette.booleanNo }} />
          No
        </span>
      </div>
    );
  }
  return null;
}

function QuestionCalendar({
  series,
  onSelectDay,
  palette,
  scaleColors,
  chartStyle,
  dateFormat,
  month,
}: {
  series: QuestionSeries;
  onSelectDay: (date: string, value: number | undefined, isFuture: boolean) => void;
  palette: ChartPalette;
  scaleColors: ScaleColors;
  chartStyle: ChartStyle;
  dateFormat: DateFormat;
  month: Date;
}) {
  const today = new Date();
  const calendarStart = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
  const isBrush = chartStyle === "brush";
  const isSolid = chartStyle === "solid";
  const isEditable = series.type === "boolean" || series.type === "number";
  const isTextType =
    series.type === "text" || series.type === "single_choice" || series.type === "multi_choice";
  const isChoiceType = series.type === "single_choice" || series.type === "multi_choice";
  const [activeTextDay, setActiveTextDay] = useState<string | null>(null);

  const daily = buildDailyAverages(series);
  const valueMap = daily.reduce<Record<string, number>>((map, d) => {
    map[d.date] = d.value;
    return map;
  }, {});
  const textMap = buildTextMap(series);
  const observedMax = daily.reduce((m, d) => Math.max(m, d.value), 0);
  const maxValue = series.type === "boolean" ? 1 : observedMax;

  const days: Date[] = [];
  let cursor = calendarStart;
  while (cursor <= calendarEnd) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return (
    <div className="mt-3 overflow-x-auto">
      <div
        className={`bujo-calendar min-w-[520px] space-y-3 ${isSolid ? "bujo-calendar--solid" : ""}`}
      >
        <div className="grid grid-cols-7 gap-1 text-[11px] font-semibold text-gray-700">
          {weekdayLabels.map((w) => (
            <span key={w} className="text-center">
              {w}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 text-sm">
          {days.map((day) => {
            const dayStr = format(day, "yyyy-MM-dd");
            const displayDate = formatDateValue(day, dateFormat, "long");
            const value = valueMap[dayStr];
            const textValue = textMap[dayStr];
            const hasValue = isTextType ? textValue !== undefined : value !== undefined;
            const isFuture = day > today;
            const numberDecimals = typeof series.decimals === "number" ? series.decimals : 0;
            const bg =
              hasValue
                ? isTextType
                  ? toRgba(palette.accentSoft, 0.22, "#f3f4f6")
                  : colorForValue(value ?? 0, series.type, maxValue, palette, scaleColors)
                : "#f3f4f6";
            const brushLayer =
              !isFuture && isBrush && hasValue
                ? `repeating-linear-gradient(-12deg, rgba(47,74,61,0.06) 0 9px, transparent 9px 18px), ${bg}`
                : undefined;
            const solidLayer =
              !isFuture && isSolid && hasValue
                ? bg
                : undefined;
            const shouldUseGradient =
              !isFuture && !isBrush && !isSolid && hasValue && series.type !== "boolean" && !isTextType;
            const gradientLayer = shouldUseGradient
              ? `linear-gradient(135deg, ${bg} 0%, ${palette.scaleHigh} 100%)`
              : undefined;
            const title =
              isTextType
                ? textValue
                  ? `${displayDate}: ${textValue}`
                  : isFuture
                    ? `${displayDate}: future dates cannot be set`
                    : displayDate
                : value !== undefined
                  ? series.type === "boolean"
                    ? `${displayDate}: ${value >= 1 ? "Yes" : "No"}`
                    : `${displayDate}: ${value.toFixed(numberDecimals)}`
                  : isFuture
                    ? `${displayDate}: future dates cannot be set`
                    : displayDate;
            const isTextPopoverOpen = activeTextDay === dayStr;

            return (
              <div
                key={dayStr}
                className={`bujo-calendar-day group relative h-14 ${
                  isFuture ? "bujo-calendar-day--future" : isEditable ? "cursor-pointer" : "cursor-default"
                } ${isBrush && hasValue ? "bujo-calendar-day--brush" : ""} ${isSolid && hasValue ? "bujo-calendar-day--solid" : ""} ${
                  isTextType ? "hover:z-20" : ""
                } ${isTextPopoverOpen ? "z-20" : ""}`}
                style={{
                  background: isFuture
                    ? "#f8f1e0"
                    : brushLayer || solidLayer || gradientLayer || bg,
                  boxShadow: isBrush
                    ? "inset 0 0 0 1px rgba(47,74,61,0.08), 0 4px 0 var(--bujo-shadow)"
                    : undefined,
                  borderColor: isBrush ? "rgba(47,74,61,0.35)" : isSolid ? "rgba(47,74,61,0.25)" : undefined,
                }}
                title={title}
                aria-label={title}
                role="button"
                onClick={() => {
                  if (isFuture) return;
                  if (isTextType && textValue) {
                    setActiveTextDay((prev) => (prev === dayStr ? null : dayStr));
                    return;
                  }
                  if (!isEditable) return;
                  onSelectDay(dayStr, value, isFuture);
                }}
              >
                <span className="bujo-calendar-day__date text-sm">{format(day, "d")}</span>
                <span className="bujo-calendar-day__note">
                  {isChoiceType ? (
                    <span
                      className="bujo-emoji-value"
                      data-emoji-only={textValue && isEmojiOnly(textValue) ? "true" : "false"}
                    >
                      {textValue ?? "—"}
                    </span>
                  ) : isTextType ? (
                    hasValue ? (
                      "✓"
                    ) : (
                      "—"
                    )
                  ) : value === undefined ? (
                    "—"
                  ) : series.type === "boolean" ? (
                    value >= 1 ? (
                      "Yes"
                    ) : (
                      "No"
                    )
                  ) : (
                    value.toFixed(numberDecimals)
                  )}
                </span>
                {isTextType && textValue && (
                  <div
                    className={`absolute left-1/2 top-1/2 z-50 w-44 -translate-x-1/2 -translate-y-1/2 rounded-md border border-[var(--bujo-border)] bg-white p-2 text-xs text-gray-800 shadow-lg transition-opacity ${
                      isTextPopoverOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    {textValue}
                  </div>
                )}
                <span className="sr-only">{title}</span>
              </div>
            );
          })}
        </div>
        <LegendKey type={series.type} palette={palette} />
      </div>
    </div>
  );
}

function NumberBarChart({
  series,
  palette,
  scaleColors,
  chartStyle,
  onSelectDay,
  dateFormat,
  daily,
  periodLabel,
}: {
  series: QuestionSeries;
  palette: ChartPalette;
  scaleColors: ScaleColors;
  chartStyle: ChartStyle;
  onSelectDay: (date: string, value: number | undefined, isFuture: boolean) => void;
  dateFormat: DateFormat;
  daily: Array<{ date: string; value: number }>;
  periodLabel: string;
}) {
  const chartRef = useRef<ChartJS<"bar"> | null>(null);
  const visible = daily;
  const isBrush = chartStyle === "brush";
  const isSolid = chartStyle === "solid";

  const maxValue = visible.reduce((m, d) => Math.max(m, d.value), 0);
  const colors = visible.map((d) =>
    colorForValue(d.value, series.type, maxValue, palette, scaleColors),
  );

  const options = useMemo<ChartOptions<"bar">>(
    () => ({
      responsive: true,
      plugins: {
        legend: {
          labels: {
            color: "var(--bujo-ink)",
            font: { weight: 700 },
          },
        },
        tooltip: {
          backgroundColor: "rgba(47, 74, 61, 0.92)",
          titleColor: "#fffbf4",
          bodyColor: "#fffbf4",
          borderColor: "rgba(47, 74, 61, 0.6)",
          borderWidth: 1.2,
        },
      },
      scales: {
        x: {
          ticks: {
            color: "var(--bujo-accent-ink)",
            font: { weight: 600 },
          },
          grid: {
            color: "rgba(214, 197, 170, 0.45)",
            borderDash: [3, 6],
            drawTicks: false,
          },
        },
        y: {
          ticks: {
            color: "var(--bujo-accent-ink)",
            font: { weight: 600 },
          },
          grid: {
            color: "rgba(214, 197, 170, 0.35)",
            borderDash: [3, 6],
            drawTicks: false,
          },
        },
      },
      elements: {
        bar: {
          borderRadius: isBrush ? 3 : isSolid ? 4 : 8,
          borderWidth: isBrush ? 0.8 : isSolid ? 1.1 : 1.4,
          borderColor: isBrush ? "rgba(47, 74, 61, 0.45)" : "rgba(47, 74, 61, 0.55)",
        },
      },
    }),
    [isBrush, isSolid],
  );

  const data = {
    labels: visible.map((d) => formatDateValue(d.date, dateFormat, "short")),
    datasets: [
      {
        label: series.unit ? `${periodLabel} (${series.unit})` : periodLabel,
        data: visible.map((d) => d.value),
        backgroundColor: colors,
        borderColor: colors,
      },
    ],
  };

  if (visible.length === 0) return null;

  return (
    <div className={`mt-4 bujo-chart ${isBrush ? "bujo-chart--brush" : ""} ${isSolid ? "bujo-chart--solid" : ""}`}>
      <Bar
        ref={chartRef}
        data={data}
        options={options}
        onClick={(event) => {
          const elements = chartRef.current ? getElementAtEvent(chartRef.current, event) : [];
          if (!elements.length) return;
          const index = elements[0]?.index;
          if (typeof index !== "number") return;
          const point = visible[index];
          if (!point) return;
          onSelectDay(point.date, point.value, isFutureDate(point.date));
        }}
      />
    </div>
  );
}

function LineTrendChart({
  series,
  daily,
  palette,
  options,
  isBrush,
  isSolid,
  onSelectDay,
  dateFormat,
}: {
  series: QuestionSeries;
  daily: Array<{ date: string; value: number }>;
  palette: ChartPalette;
  options: ChartOptions<"line">;
  isBrush: boolean;
  isSolid: boolean;
  onSelectDay: (date: string, value: number | undefined, isFuture: boolean) => void;
  dateFormat: DateFormat;
}) {
  const chartRef = useRef<ChartJS<"line"> | null>(null);
  return (
    <div className={`mt-4 bujo-chart ${isBrush ? "bujo-chart--brush" : ""} ${isSolid ? "bujo-chart--solid" : ""}`}>
      <Line
        ref={chartRef}
        data={{
          labels: daily.map((d) => formatDateValue(d.date, dateFormat, "short")),
          datasets: [
            {
              label: `${series.typeLabel} trend`,
              data: daily.map((d) => d.value),
              borderColor: toRgba(palette.accent, 0.9, "rgba(47, 74, 61, 0.85)"),
              backgroundColor: isBrush
                ? toRgba(palette.accent, 0.12, "rgba(47, 74, 61, 0.12)")
                : isSolid
                  ? toRgba(palette.accentSoft, 0.12, "rgba(95, 139, 122, 0.12)")
                  : toRgba(palette.accentSoft, 0.18, "rgba(95, 139, 122, 0.18)"),
            },
          ],
        }}
        options={options}
        onClick={(event) => {
          const elements = chartRef.current ? getElementAtEvent(chartRef.current, event) : [];
          if (!elements.length) return;
          const index = elements[0]?.index;
          if (typeof index !== "number") return;
          const point = daily[index];
          if (!point) return;
          onSelectDay(point.date, point.value, isFutureDate(point.date));
        }}
      />
    </div>
  );
}

type ModalState = {
  series: QuestionSeries;
  date: string;
  initialValue: number | undefined;
  initialTextValue?: string | string[] | null;
  isFuture: boolean;
};

function DayValueModal({
  state,
  onClose,
  onSave,
  saving,
  error,
  dateFormat,
}: {
  state: ModalState | null;
  onClose: () => void;
  onSave: (value: number | boolean | string | string[] | null) => void;
  saving: boolean;
  error: string | null;
  dateFormat: DateFormat;
}) {
  const series = state?.series;
  const initialValue =
    state && series
      ? series.type === "boolean"
        ? state.initialValue !== undefined && state.initialValue !== null
          ? state.initialValue >= 1
          : null
        : series.type === "number"
          ? state.initialValue ?? null
          : series.type === "multi_choice"
            ? Array.isArray(state.initialTextValue)
              ? state.initialTextValue
              : []
            : typeof state.initialTextValue === "string"
              ? state.initialTextValue
              : ""
      : null;
  const [value, setValue] = useState<number | boolean | string | string[] | null>(initialValue);

  if (!state || !series) return null;

  const dateLabel = formatDateValue(state.date, dateFormat, "long");
  const disableSave =
    saving ||
    (series.type === "boolean" || series.type === "number"
      ? value === null || value === undefined
      : false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{dateLabel}</p>
            <h3 className="text-lg font-semibold text-gray-900">{series.label}</h3>
            <p className="text-xs text-gray-600">Update {series.typeLabel.toLowerCase()} for this day.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="relative z-10 -m-1 cursor-pointer rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-200"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {series.type === "boolean" ? (
            <div className="flex gap-2">
              <button
                type="button"
                aria-pressed={value === true}
                className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                  value === true
                    ? "border-purple-500 bg-purple-50 text-purple-700 ring-2 ring-purple-200"
                    : "border-gray-200 text-gray-800"
                }`}
                onClick={() => setValue(true)}
              >
                <span className={`text-xs ${value === true ? "opacity-100" : "opacity-0"}`}>✓</span>
                Yes
              </button>
              <button
                type="button"
                aria-pressed={value === false}
                className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                  value === false
                    ? "border-purple-500 bg-purple-50 text-purple-700 ring-2 ring-purple-200"
                    : "border-gray-200 text-gray-800"
                }`}
                onClick={() => setValue(false)}
              >
                <span className={`text-xs ${value === false ? "opacity-100" : "opacity-0"}`}>✓</span>
                No
              </button>
            </div>
          ) : series.type === "number" ? (
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Numeric value</label>
              <input
                type="number"
                step={getNumberStep(typeof series.decimals === "number" ? series.decimals : 0)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                value={typeof value === "number" ? value : ""}
                onChange={(e) => {
                  const next = e.target.value === "" ? null : Number(e.target.value);
                  setValue(Number.isNaN(next) ? null : next);
                }}
              />
            </div>
          ) : series.type === "text" ? (
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Text value</label>
              <textarea
                rows={3}
                maxLength={120}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                value={typeof value === "string" ? value : ""}
                onChange={(e) => setValue(e.target.value)}
              />
              <p className="text-[11px] text-gray-500">{`${typeof value === "string" ? value.length : 0}/120`}</p>
            </div>
          ) : series.type === "single_choice" ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-600">Select one</p>
              <div className="space-y-3">
                {(series.choiceSteps || defaultChoiceSteps).map((step) => (
                  <label
                    key={step}
                    className="flex items-center gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800"
                  >
                    <input
                      type="radio"
                      name={`choice-${series.id}-${state.date}`}
                      value={step}
                      checked={value === step}
                      onChange={() => setValue(step)}
                    />
                    {step}
                  </label>
                ))}
              </div>
            </div>
          ) : series.type === "multi_choice" ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-600">Select all that apply</p>
              <div className="space-y-3">
                {(series.choiceSteps || defaultChoiceSteps).map((step) => {
                  const selected = Array.isArray(value) && value.includes(step);
                  return (
                    <label
                      key={step}
                      className="flex items-center gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800"
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => {
                          if (!Array.isArray(value)) {
                            setValue([step]);
                            return;
                          }
                          setValue(selected ? value.filter((v) => v !== step) : [...value, step]);
                        }}
                      />
                      {step}
                    </label>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Value</label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                value={typeof value === "string" ? value : ""}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
          )}

          {state.isFuture ? (
            <p className="rounded-md bg-yellow-50 px-3 py-2 text-xs text-yellow-700">
              You&apos;re setting a value for a future date.
            </p>
          ) : null}

          {!series.templateId ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              Cannot save because this question is missing a template id.
            </p>
          ) : null}

          {error ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          ) : null}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={disableSave || !series.templateId}
            onClick={() => onSave(value ?? null)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition ${
              disableSave || !series.templateId
                ? "cursor-not-allowed bg-gray-300"
                : "cursor-pointer bg-purple-600 hover:bg-purple-700"
            }`}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InsightsChart({
  answers,
  chartPalette,
  chartStyle,
  userQuestions,
  displayOption,
  defaultPalette: fallbackPalette,
  defaultStyle: fallbackStyle,
  dateFormat,
}: {
  answers: AnswerRow[];
  chartPalette?: Partial<ChartPalette> | null;
  chartStyle?: ChartStyle | null;
  userQuestions?: UserQuestionOverride[] | null;
  displayOption?: DisplayOption | null;
  defaultPalette?: ChartPalette;
  defaultStyle?: ChartStyle;
  dateFormat?: DateFormat | null;
}) {
  const overrideMap = useMemo(
    () => new Map((userQuestions || []).map((uq) => [uq.template_id, uq])),
    [userQuestions],
  );
  const questionSeries = useMemo(() => toQuestionSeries(answers, overrideMap), [answers, overrideMap]);
  const orderedSeries = useMemo(() => {
    if (!userQuestions || userQuestions.length === 0) return questionSeries;
    const orderMap = new Map(
      userQuestions.map((uq, index) => [
        uq.template_id,
        typeof uq.sort_order === "number" ? uq.sort_order : index,
      ]),
    );
    return [...questionSeries].sort((a, b) => {
      const aOrder = a.templateId ? orderMap.get(a.templateId) : undefined;
      const bOrder = b.templateId ? orderMap.get(b.templateId) : undefined;
      const aRank = typeof aOrder === "number" ? aOrder : Number.POSITIVE_INFINITY;
      const bRank = typeof bOrder === "number" ? bOrder : Number.POSITIVE_INFINITY;
      if (aRank !== bRank) return aRank - bRank;
      return a.label.localeCompare(b.label);
    });
  }, [questionSeries, userQuestions]);
  const [seriesData, setSeriesData] = useState<QuestionSeries[]>(orderedSeries);
  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>();
    questionSeries.forEach((series) => {
      const normalized = normalizeCategory(series.categorySnapshot ?? null);
      if (!map.has(normalized.id)) {
        map.set(normalized.id, normalized.label);
      }
    });
    return Array.from(map, ([id, label]) => ({ id, label })).sort((a, b) => {
      if (a.id === uncategorizedId && b.id !== uncategorizedId) return 1;
      if (b.id === uncategorizedId && a.id !== uncategorizedId) return -1;
      return a.label.localeCompare(b.label);
    });
  }, [questionSeries]);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    () => new Set(categoryOptions.map((category) => category.id)),
  );
  const [modalState, setModalState] = useState<ModalState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayOverrides, setDisplayOverrides] = useState<Record<string, DisplayOption | null>>(() => {
    const initial: Record<string, DisplayOption | null> = {};
    (userQuestions || []).forEach((uq) => {
      initial[uq.template_id] = (uq.display_option_override as DisplayOption | null) ?? null;
    });
    return initial;
  });
  const [selectedMonth, setSelectedMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [monthInput, setMonthInput] = useState(() => format(startOfMonth(new Date()), "yyyy-MM"));
  const [displaySavingById, setDisplaySavingById] = useState<Record<string, boolean>>({});
  const [displayErrorById, setDisplayErrorById] = useState<Record<string, string | null>>({});
  const palette = useMemo(
    () => sanitizePalette(chartPalette ?? null, fallbackPalette ?? defaultPalette),
    [chartPalette, fallbackPalette],
  );
  const resolvedDateFormat = normalizeDateFormat(dateFormat);
  const resolvedStyle: ChartStyle =
    chartStyle === "brush" || chartStyle === "solid"
      ? chartStyle
      : fallbackStyle ?? defaultStyle;
  const globalDisplayOption = normalizeDisplayOption(displayOption);
  const isBrush = resolvedStyle === "brush";
  const isSolid = resolvedStyle === "solid";
  const selectedMonthStart = startOfMonth(selectedMonth);
  const selectedMonthEnd = endOfMonth(selectedMonth);
  const monthLabel = format(selectedMonth, "LLLL yyyy");
  const currentMonthStart = startOfMonth(new Date());
  const canGoNextMonth = selectedMonthStart.getTime() < currentMonthStart.getTime();
  const monthControlLabel =
    selectedMonth.getFullYear() === new Date().getFullYear()
      ? format(selectedMonth, "LLLL")
      : format(selectedMonth, "LLLL yyyy");

  const buildLineOptions = (paletteForSeries: ChartPalette): ChartOptions<"line"> => ({
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(47, 74, 61, 0.92)",
        titleColor: "#fffbf4",
        bodyColor: "#fffbf4",
        borderColor: "rgba(47, 74, 61, 0.6)",
        borderWidth: 1.2,
      },
    },
    elements: {
      line: {
        tension: isBrush ? 0.22 : 0.35,
        borderDash: isBrush ? [2, 3.5] : isSolid ? [] : [6, 4],
        borderWidth: isBrush ? 3.1 : isSolid ? 2.2 : 2.6,
        borderCapStyle: "round",
        borderJoinStyle: "round",
      },
      point: {
        radius: isBrush ? 5.2 : isSolid ? 4.8 : 4.4,
        borderWidth: isBrush ? 2 : isSolid ? 1.8 : 1.6,
        backgroundColor: isBrush
          ? toRgba(paletteForSeries.accentSoft, 0.52, "#fef3c7")
          : isSolid
            ? toRgba(paletteForSeries.accentSoft, 0.24, "#fdf3c4")
            : "#fffbf4",
        borderColor: toRgba(paletteForSeries.accent, 1, "var(--bujo-accent-ink)"),
        hoverRadius: isBrush ? 6.8 : isSolid ? 6.2 : 6,
      },
    },
    scales: {
      x: {
        ticks: {
          color: "var(--bujo-accent-ink)",
          font: { weight: 600 },
        },
        grid: {
          color: "rgba(214, 197, 170, 0.45)",
          drawTicks: false,
        },
      },
      y: {
        ticks: {
          color: "var(--bujo-accent-ink)",
          font: { weight: 600 },
        },
        grid: {
          color: "rgba(214, 197, 170, 0.35)",
          drawTicks: false,
        },
      },
    },
  });

  useEffect(() => {
    setSeriesData(orderedSeries);
  }, [orderedSeries]);

  useEffect(() => {
    setMonthInput(format(selectedMonth, "yyyy-MM"));
  }, [selectedMonth]);

  useEffect(() => {
    setSelectedCategories((prev) => {
      if (categoryOptions.length === 0) return new Set<string>();
      const next = new Set<string>();
      categoryOptions.forEach((option) => {
        if (prev.has(option.id) || prev.size === 0) {
          next.add(option.id);
        }
      });
      return next;
    });
  }, [categoryOptions]);

  useEffect(() => {
    const next: Record<string, DisplayOption | null> = {};
    (userQuestions || []).forEach((uq) => {
      next[uq.template_id] = (uq.display_option_override as DisplayOption | null) ?? null;
    });
    setDisplayOverrides(next);
  }, [userQuestions]);

  const handleSelectDay = (
    series: QuestionSeries,
    date: string,
    value: number | undefined,
    isFuture: boolean,
    textValue?: string | string[] | null,
  ) => {
    setError(null);
    setModalState({
      series,
      date,
      initialValue: value,
      initialTextValue: textValue ?? null,
      isFuture,
    });
  };

  const handleSave = async (newValue: number | boolean | string | string[] | null) => {
    if (!modalState?.series) return;
    const series = modalState.series;
    if (!series.templateId) {
      setError("Cannot save because this question is missing a template id.");
      return;
    }
    setSaving(true);
    setError(null);

    const payloadValue = (() => {
      if (series.type === "boolean") {
        return newValue === null || newValue === undefined ? null : Boolean(newValue);
      }
      if (series.type === "number") {
        return newValue === null || newValue === undefined ? null : Number(newValue ?? 0);
      }
      if (series.type === "multi_choice") {
        return Array.isArray(newValue) ? newValue : [];
      }
      if (series.type === "single_choice" || series.type === "text") {
        return typeof newValue === "string" ? newValue : "";
      }
      return newValue === null || newValue === undefined ? null : String(newValue);
    })();

    const res = await fetch("/api/answers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question_date: modalState.date,
        answers: [
          {
            template_id: series.templateId,
            type: series.type,
            value: payloadValue,
            prompt_snapshot: series.promptSnapshot ?? series.label,
            category_snapshot: series.categorySnapshot ?? null,
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Failed to save value.");
      setSaving(false);
      return;
    }

    setSeriesData((prev) =>
      prev.map((s) => {
        if (s.id !== series.id) return s;
        if (series.type === "boolean" || series.type === "number") {
          const numericValue =
            series.type === "boolean" ? (payloadValue ? 1 : 0) : Number(payloadValue ?? 0);
          return { ...s, points: upsertPoint(s.points, modalState.date, numericValue) };
        }
        const displayValue =
          series.type === "multi_choice"
            ? Array.isArray(payloadValue)
              ? payloadValue.join(", ")
              : ""
            : typeof payloadValue === "string"
              ? payloadValue
              : "";
        const updatedTextPoints = upsertTextPoint(
          s.textPoints ?? [],
          modalState.date,
          displayValue,
          Array.isArray(payloadValue) ? payloadValue : displayValue,
        );
        if (series.type === "single_choice") {
          const choiceScale = buildChoiceScale(series.choiceSteps ?? defaultChoiceSteps);
          const numericChoice = mapChoiceToValue(displayValue, choiceScale);
          const nextPoints =
            numericChoice === null
              ? s.points.filter((point) => point.date !== modalState.date)
              : upsertPoint(s.points, modalState.date, numericChoice);
          return { ...s, textPoints: updatedTextPoints, points: nextPoints };
        }
        return { ...s, textPoints: updatedTextPoints };
      }),
    );

    setSaving(false);
    setModalState(null);
  };

  const updateDisplayOption = async (series: QuestionSeries, nextOption: DisplayOption) => {
    if (!series.templateId) return;
    const defaultDisplay = series.defaultDisplayOption ?? "graph";
    const nextOverride = nextOption === defaultDisplay ? null : nextOption;
    const prevOverride = displayOverrides[series.templateId] ?? null;

    setDisplayOverrides((prev) => ({ ...prev, [series.templateId as string]: nextOverride }));
    setDisplaySavingById((prev) => ({ ...prev, [series.templateId as string]: true }));
    setDisplayErrorById((prev) => ({ ...prev, [series.templateId as string]: null }));

    try {
      const res = await fetch("/api/user-questions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: series.templateId,
          display_option_override: nextOverride,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setDisplayOverrides((prev) => ({ ...prev, [series.templateId as string]: prevOverride }));
        setDisplayErrorById((prev) => ({
          ...prev,
          [series.templateId as string]: body.error || "Failed to update display option.",
        }));
      }
    } catch {
      setDisplayOverrides((prev) => ({ ...prev, [series.templateId as string]: prevOverride }));
      setDisplayErrorById((prev) => ({
        ...prev,
        [series.templateId as string]: "Failed to update display option.",
      }));
    } finally {
      setDisplaySavingById((prev) => ({ ...prev, [series.templateId as string]: false }));
    }
  };

  if (questionSeries.length === 0) {
    return (
      <div className={`bujo-card bujo-torn ${isBrush ? "bujo-card--brush" : ""} ${isSolid ? "bujo-card--solid" : ""}`}>
        <h2 className="text-xl font-semibold text-gray-900">Trends</h2>
        <p className="text-sm text-gray-700">No data yet.</p>
      </div>
    );
  }

  const filteredSeries = seriesData.filter((series) =>
    selectedCategories.has(normalizeCategory(series.categorySnapshot ?? null).id),
  );

  return (
    <div className="space-y-4">
      <div className={`bujo-card bujo-torn ${isBrush ? "bujo-card--brush" : ""} ${isSolid ? "bujo-card--solid" : ""}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="sm:flex-1">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">
              {monthControlLabel}
            </h2>
          </div>
          <div className="flex w-full items-center justify-end gap-2 sm:w-auto sm:flex-1">
            <button
              type="button"
              className="bujo-btn-secondary px-3 py-1 text-xs"
              onClick={() => setSelectedMonth((prev) => subMonths(prev, 1))}
            >
              ← Prev
            </button>
            <label htmlFor="insights-month-jump" className="sr-only">
              Jump to month
            </label>
            <input
              id="insights-month-jump"
              type="text"
              inputMode="numeric"
              placeholder="YYYY-MM"
              className="w-28 rounded-md border border-gray-200 px-2 py-1 text-center text-xs font-semibold text-gray-900 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
              value={monthInput}
              onChange={(event) => {
                const value = event.target.value;
                setMonthInput(value);
                if (!/^\d{4}-\d{2}$/.test(value)) return;
                const [year, month] = value.split("-").map((part) => Number(part));
                if (!year || !month) return;
                const nextMonth = startOfMonth(new Date(year, month - 1, 1));
                const currentMonthStart = startOfMonth(new Date());
                setSelectedMonth(nextMonth > currentMonthStart ? currentMonthStart : nextMonth);
              }}
            />
            <button
              type="button"
              className="bujo-btn-secondary px-3 py-1 text-xs disabled:opacity-40"
              onClick={() => setSelectedMonth((prev) => addMonths(prev, 1))}
              disabled={!canGoNextMonth}
            >
              Next →
            </button>
          </div>
        </div>
      </div>
      {categoryOptions.length > 0 ? (
        <div className={`bujo-card bujo-torn ${isBrush ? "bujo-card--brush" : ""} ${isSolid ? "bujo-card--solid" : ""}`}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Filter categories</h2>
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-700">
            {categoryOptions.map((category) => {
              const checked = selectedCategories.has(category.id);
              return (
                <label
                  key={category.id}
                  className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setSelectedCategories((prev) => {
                        const next = new Set(prev);
                        if (checked) {
                          next.delete(category.id);
                        } else {
                          next.add(category.id);
                        }
                        return next;
                      });
                    }}
                  />
                  <span>{category.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}

      {filteredSeries.length === 0 ? (
        <div className={`bujo-card bujo-torn ${isBrush ? "bujo-card--brush" : ""} ${isSolid ? "bujo-card--solid" : ""}`}>
          <h2 className="text-xl font-semibold text-gray-900">Trends</h2>
          <p className="text-sm text-gray-700">
            {categoryOptions.length === 0 ? "No data yet." : "No categories selected."}
          </p>
        </div>
      ) : null}

      {filteredSeries.map((series) => (
        <div
          key={series.id}
          className={`bujo-card bujo-torn ${isBrush ? "bujo-card--brush" : ""} ${isSolid ? "bujo-card--solid" : ""}`}
        >
          {(() => {
            const seriesPalette = series.palette ? sanitizePalette(series.palette, palette) : palette;
            const seriesScaleColors = buildScaleColors(seriesPalette);
            const daily = buildDailyAverages(series);
            const textPoints = series.textPoints ?? [];
            const isInSelectedMonth = (date: string) => {
              const parsed = parseISO(date);
              return parsed >= selectedMonthStart && parsed <= selectedMonthEnd;
            };
            const monthlyTextPoints = textPoints.filter((point) => isInSelectedMonth(point.date));
            const monthlyDaily = daily.filter((item) => isInSelectedMonth(item.date));
            const recentText = monthlyTextPoints.slice(-7);
            const recentNumeric = monthlyDaily.slice(-7);
            const isTextType =
              series.type === "text" || series.type === "single_choice" || series.type === "multi_choice";
            const choiceScale =
              series.type === "single_choice"
                ? buildChoiceScale(series.choiceSteps ?? defaultChoiceSteps)
                : null;
            const hasRecent = isTextType ? recentText.length > 0 : recentNumeric.length > 0;
            const formatValue = (value: number) => {
              if (series.type === "boolean") return value >= 1 ? "Yes" : "No";
              const decimals = typeof series.decimals === "number" ? series.decimals : 0;
              return Number.isFinite(value) ? value.toFixed(decimals) : "—";
            };
            const formatTextValue = (value: string) =>
              value.length > 120 ? `${value.slice(0, 117)}...` : value;
            const getTextValueForDate = (date: string) => {
              if (!textPoints.length) return null;
              const match = textPoints.find((point) => point.date === date);
              return match ? (match.rawValue ?? match.value) : null;
            };
            const choiceSteps = series.choiceSteps ?? defaultChoiceSteps;
            const yearStart = startOfYear(selectedMonth);
            const yearEnd = endOfYear(selectedMonth);
            const yearLabel = format(selectedMonth, "yyyy");
            const isInSelectedYear = (date: string) => {
              const parsed = parseISO(date);
              return parsed >= yearStart && parsed <= yearEnd;
            };
            const yearlyTextPoints = textPoints.filter((point) => isInSelectedYear(point.date));
            const yearlyDaily = daily.filter((item) => isInSelectedYear(item.date));
            const choiceCounts = (() => {
              if (series.type !== "single_choice" && series.type !== "multi_choice") return null;
              const counts = new Map<string, number>(choiceSteps.map((step) => [step, 0]));
              monthlyTextPoints.forEach((point) => {
                if (series.type === "single_choice") {
                  const raw = typeof point.rawValue === "string" ? point.rawValue : point.value;
                  const key = raw?.trim();
                  if (key && counts.has(key)) {
                    counts.set(key, (counts.get(key) ?? 0) + 1);
                  }
                  return;
                }
                const rawValues = Array.isArray(point.rawValue)
                  ? point.rawValue
                  : typeof point.rawValue === "string"
                    ? point.rawValue.split(",")
                    : typeof point.value === "string"
                      ? point.value.split(",")
                      : [];
                rawValues
                  .map((entry) => entry.trim())
                  .filter((entry) => entry.length > 0)
                  .forEach((entry) => {
                    if (counts.has(entry)) {
                      counts.set(entry, (counts.get(entry) ?? 0) + 1);
                    }
                  });
              });
              return choiceSteps.map((step) => ({ step, count: counts.get(step) ?? 0 }));
            })();
            const countValue =
              isTextType
                ? monthlyTextPoints.length
                : series.type === "boolean"
                  ? monthlyDaily.reduce((sum, item) => sum + (item.value >= 1 ? 1 : 0), 0)
                  : monthlyDaily.length;
            const yearCountValue =
              isTextType
                ? yearlyTextPoints.length
                : series.type === "boolean"
                  ? yearlyDaily.reduce((sum, item) => sum + (item.value >= 1 ? 1 : 0), 0)
                  : yearlyDaily.length;
            const monthlyTotal =
              series.type === "number" ? monthlyDaily.reduce((sum, item) => sum + item.value, 0) : null;
            const yearlyTotal =
              series.type === "number" ? yearlyDaily.reduce((sum, item) => sum + item.value, 0) : null;
            const latestText =
              monthlyTextPoints.length > 0
                ? monthlyTextPoints[monthlyTextPoints.length - 1]?.value
                : textPoints.length > 0
                  ? textPoints[textPoints.length - 1]?.value
                  : null;
            const formatNumberWithUnit = (value: number) =>
              series.unit ? `${formatValue(value)} ${series.unit}` : formatValue(value);
            const overrideDisplay = series.templateId
              ? normalizeDisplayOption(displayOverrides[series.templateId])
              : null;
            const seriesDisplayOption =
              globalDisplayOption ?? overrideDisplay ?? series.defaultDisplayOption ?? "graph";
            const baseOptions =
              series.allowedDisplayOptions && series.allowedDisplayOptions.length > 0
                ? series.allowedDisplayOptions
                : [series.defaultDisplayOption ?? "graph"];
            const displayOptions = baseOptions.includes(seriesDisplayOption)
              ? baseOptions
              : [...baseOptions, seriesDisplayOption];
            const displaySaving = series.templateId ? displaySavingById[series.templateId] : false;
            const displayError = series.templateId ? displayErrorById[series.templateId] : null;
            return (
              <>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{series.label}</h2>
                    <p className="text-xs text-gray-600">Daily {series.typeLabel}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <label htmlFor={`display-${series.id}`} className="font-semibold uppercase tracking-wide">
                      View
                    </label>
                    <select
                      id={`display-${series.id}`}
                      className="min-w-[104px] rounded-md border border-gray-200 bg-white px-2 py-1 pr-12 text-xs font-medium text-gray-800 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                      value={seriesDisplayOption}
                      onChange={(event) => updateDisplayOption(series, event.target.value as DisplayOption)}
                      disabled={
                        !series.templateId ||
                        displayOptions.length <= 1 ||
                        displaySaving
                      }
                    >
                      {displayOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {displayOptionLabels[opt]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {displayError ? (
                  <p className="mt-2 text-xs text-red-600">{displayError}</p>
                ) : null}

                {(() => {
                  return (
                <>
                {seriesDisplayOption === "graph" && (
                  <>
                    {series.type === "text" || series.type === "multi_choice" ? (
                      <p className="mt-3 text-sm text-gray-600">
                        Graph view isn&apos;t available for text or multi-choice answers. Use list, grid, or count instead.
                      </p>
                    ) : series.type === "number" ? (
                      <NumberBarChart
                        series={series}
                        palette={seriesPalette}
                        scaleColors={seriesScaleColors}
                        chartStyle={resolvedStyle}
                        dateFormat={resolvedDateFormat}
                        daily={monthlyDaily}
                        periodLabel={`Values in ${monthLabel}`}
                        onSelectDay={(date, value, isFuture) => handleSelectDay(series, date, value, isFuture)}
                      />
                    ) : (
                      <LineTrendChart
                        series={series}
                        daily={monthlyDaily}
                        palette={seriesPalette}
                        isBrush={isBrush}
                        isSolid={isSolid}
                        dateFormat={resolvedDateFormat}
                        onSelectDay={(date, value, isFuture) =>
                          handleSelectDay(
                            series,
                            date,
                            value,
                            isFuture,
                            series.type === "single_choice" ? getTextValueForDate(date) : undefined,
                          )
                        }
                        options={(() => {
                          const baseLineOptions = buildLineOptions(seriesPalette);
                          const choiceMin = choiceScale?.min;
                          const choiceMax = choiceScale?.max;
                          const yMinBase =
                            series.type === "boolean"
                              ? 0
                              : series.type === "single_choice"
                                ? choiceMin
                                : undefined;
                          const yMaxBase =
                            series.type === "boolean"
                              ? 1
                              : series.type === "single_choice"
                                ? choiceMax
                                : undefined;
                          const verticalPadding = 0;
                          const yMin =
                            series.type === "boolean"
                              ? -0.1
                              : series.type === "single_choice"
                                ? (choiceMin ?? 0) - 0.4
                                : yMinBase !== undefined
                                  ? yMinBase - verticalPadding
                                  : undefined;
                          const yMax =
                            series.type === "boolean"
                              ? 1.1
                              : series.type === "single_choice"
                                ? (choiceMax ?? 1) + 0.4
                                : undefined;
                          const baseStepSize =
                            (baseLineOptions.scales?.y as LinearScaleOptions | undefined)?.ticks?.stepSize;
                          const stepSize =
                            series.type === "boolean" && yMinBase !== undefined && yMaxBase !== undefined
                              ? Math.max(1, Math.round((yMaxBase - yMinBase) / 4))
                              : series.type === "single_choice" && choiceScale && !choiceScale.isNumeric
                                ? 1
                                : baseStepSize;
                          const tickCallback =
                            series.type === "boolean"
                              ? (value: string | number) => {
                                  const numeric = typeof value === "string" ? Number(value) : value;
                                  if (numeric === 1) return "Yes";
                                  if (numeric === 0) return "No";
                                  return "";
                                }
                              : series.type === "single_choice" && choiceScale
                                ? (value: string | number) => {
                                    const numeric = typeof value === "string" ? Number(value) : value;
                                    const label = choiceScale.labelByValue.get(numeric);
                                    if (label) return label;
                                    return choiceScale.isNumeric ? String(numeric) : "";
                                  }
                              : baseLineOptions.scales?.y?.ticks?.callback;
                          const tooltipCallbacks =
                            series.type === "single_choice" && choiceScale
                              ? {
                                  callbacks: {
                                    label: (context: TooltipItem<"line">) => {
                                      const value = context.parsed.y;
                                      if (value === null || value === undefined) return "";
                                      const label = choiceScale.labelByValue.get(value);
                                      return label ?? String(value);
                                    },
                                  },
                                }
                              : {};

                          return {
                            ...baseLineOptions,
                            plugins: { ...(baseLineOptions.plugins || {}), tooltip: {
                              ...(baseLineOptions.plugins?.tooltip || {}),
                              ...tooltipCallbacks,
                            } },
                            elements: { ...(baseLineOptions.elements || {}) },
                            scales: {
                              ...baseLineOptions.scales,
                              y: {
                                ...baseLineOptions.scales?.y,
                                min: yMin,
                                max: yMax,
                                suggestedMin: yMinBase,
                                suggestedMax: yMaxBase,
                                ticks: {
                                  ...(baseLineOptions.scales?.y?.ticks || {}),
                                  stepSize,
                                  callback: tickCallback,
                                },
                              },
                            },
                          };
                        })()}
                      />
                    )}
                  </>
                )}

                {seriesDisplayOption === "grid" && (
                  <QuestionCalendar
                    series={series}
                    onSelectDay={(date, value, isFuture) => handleSelectDay(series, date, value, isFuture)}
                    palette={seriesPalette}
                    scaleColors={seriesScaleColors}
                    chartStyle={resolvedStyle}
                    dateFormat={resolvedDateFormat}
                    month={selectedMonthStart}
                  />
                )}

                {seriesDisplayOption === "list" && (
                  <div className="mt-3 space-y-2">
                    {!hasRecent ? (
                      <p className="text-sm text-gray-700">No data yet.</p>
                    ) : (
                      <ul className="space-y-1 text-sm text-gray-800">
                        {isTextType
                          ? recentText.map((item) => (
                              <li
                                key={`${series.id}-${item.date}`}
                                className="flex items-center justify-between gap-2"
                              >
                                <button
                                  type="button"
                                  className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left hover:bg-gray-50"
                                  onClick={() =>
                                    handleSelectDay(
                                      series,
                                      item.date,
                                      undefined,
                                      isFutureDate(item.date),
                                      item.rawValue ?? item.value,
                                    )
                                  }
                                >
                                  <span className="text-xs text-gray-600">
                                    {formatDateValue(item.date, resolvedDateFormat, "short")}
                                  </span>
                                  <span
                                    className="text-right bujo-emoji-value"
                                    data-emoji-only={isEmojiOnly(item.value) ? "true" : "false"}
                                  >
                                    {formatTextValue(item.value)}
                                  </span>
                                </button>
                              </li>
                            ))
                          : recentNumeric.map((item) => (
                              <li
                                key={`${series.id}-${item.date}`}
                                className="flex items-center justify-between"
                              >
                                <button
                                  type="button"
                                  className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left hover:bg-gray-50"
                                  onClick={() =>
                                    handleSelectDay(
                                      series,
                                      item.date,
                                      item.value,
                                      isFutureDate(item.date),
                                    )
                                  }
                                >
                                  <span className="text-xs text-gray-600">
                                    {formatDateValue(item.date, resolvedDateFormat, "short")}
                                  </span>
                                  <span className="font-semibold">{formatValue(item.value)}</span>
                                </button>
                              </li>
                            ))}
                      </ul>
                    )}
                  </div>
                )}

                {seriesDisplayOption === "count" && (
                  <div className="mt-3 flex items-center justify-center rounded-md border border-[var(--bujo-border)] bg-[var(--bujo-paper)] py-6">
                    {choiceCounts ? (
                      <div className="w-full max-w-sm space-y-2 px-4 text-sm text-gray-800">
                        {choiceCounts.map((item) => (
                          <div key={item.step} className="flex items-center justify-between">
                            <span
                              className="bujo-emoji-value"
                              data-emoji-only={isEmojiOnly(item.step) ? "true" : "false"}
                            >
                              {item.step}
                            </span>
                            <span className="font-semibold tabular-nums">{item.count}</span>
                          </div>
                        ))}
                        <p className="pt-1 text-[11px] text-[var(--bujo-subtle)]">
                          {monthlyTextPoints.length} {monthlyTextPoints.length === 1 ? "entry" : "entries"}{" "}
                          {`in ${monthLabel}`}
                        </p>
                        <p className="text-[11px] text-[var(--bujo-subtle)]">
                          {yearlyTextPoints.length} {yearlyTextPoints.length === 1 ? "entry" : "entries"}{" "}
                          {`in ${yearLabel}`}
                        </p>
                      </div>
                    ) : isTextType ? (
                      <div className="text-center">
                        <p className="text-sm font-semibold text-[var(--bujo-ink)]">
                          {latestText ? formatTextValue(latestText) : "—"}
                        </p>
                        <p className="text-xs text-[var(--bujo-subtle)]">Latest entry</p>
                        <p className="mt-1 text-[11px] text-[var(--bujo-subtle)]">
                          {countValue} {countValue === 1 ? "entry" : "entries"} {`in ${monthLabel}`}
                        </p>
                        <p className="text-[11px] text-[var(--bujo-subtle)]">
                          {yearCountValue} {yearCountValue === 1 ? "entry" : "entries"} {`in ${yearLabel}`}
                        </p>
                      </div>
                    ) : (
                      <div className="text-center">
                        {series.type === "number" ? (
                          <>
                            <p className="text-3xl font-semibold text-[var(--bujo-ink)]">
                              {formatNumberWithUnit(monthlyTotal ?? 0)}
                            </p>
                            <p className="text-xs text-[var(--bujo-subtle)]">{`Total in ${monthLabel}`}</p>
                            <p className="mt-1 text-xl font-semibold text-[var(--bujo-ink)]">
                              {formatNumberWithUnit(yearlyTotal ?? 0)}
                            </p>
                            <p className="text-[11px] text-[var(--bujo-subtle)]">{`Total in ${yearLabel}`}</p>
                            <p className="mt-1 text-[11px] text-[var(--bujo-subtle)]">
                              {countValue} {countValue === 1 ? "entry" : "entries"} {`in ${monthLabel}`}
                            </p>
                            <p className="text-[11px] text-[var(--bujo-subtle)]">
                              {yearCountValue} {yearCountValue === 1 ? "entry" : "entries"} {`in ${yearLabel}`}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-3xl font-semibold text-[var(--bujo-ink)]">{countValue}</p>
                            <p className="text-xs text-[var(--bujo-subtle)]">
                              {series.type === "boolean" ? `Yes days in ${monthLabel}` : `Entries in ${monthLabel}`}
                            </p>
                            <p className="mt-1 text-xl font-semibold text-[var(--bujo-ink)]">{yearCountValue}</p>
                            <p className="text-[11px] text-[var(--bujo-subtle)]">
                              {series.type === "boolean" ? `Yes days in ${yearLabel}` : `Entries in ${yearLabel}`}
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
                </>
                  );
                })()}
          </>
        );
          })()}
        </div>
      ))}

      <DayValueModal
        key={modalState ? `${modalState.series.id}-${modalState.date}` : "modal-empty"}
        state={modalState}
        onClose={() => setModalState(null)}
        onSave={handleSave}
        saving={saving}
        error={error}
        dateFormat={resolvedDateFormat}
      />
    </div>
  );
}
