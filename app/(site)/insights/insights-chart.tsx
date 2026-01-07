"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, Line } from "react-chartjs-2";
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
} from "chart.js";
import { addDays, format, parseISO, startOfWeek, subWeeks } from "date-fns";
import { type ChartPalette, type ChartStyle } from "@/lib/types";

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
  emoji_value: string | null;
  text_value: string | null;
  created_at: string;
  updated_at: string;
  question_templates?:
    | { id?: string; title?: string; type?: string | null; meta?: Record<string, unknown> | null }
    | null;
};

type QuestionSeries = {
  id: string;
  templateId?: string;
  promptSnapshot?: string | null;
  categorySnapshot?: string | null;
  label: string;
  type: "scale" | "number" | "boolean" | "other";
  typeLabel: string;
  unit?: string;
  scaleRange?: { min: number; max: number };
  points: Array<{ date: string; value: number }>;
};

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const defaultPalette: ChartPalette = {
  accent: "#2f4a3d",
  accentSoft: "#5f8b7a",
  booleanYes: "#5ce695",
  booleanNo: "#f98c80",
  scaleLow: "#ffeacc",
  scaleHigh: "#ff813d",
};

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

function sanitizePalette(input?: Partial<ChartPalette> | null): ChartPalette {
  const palette = { ...defaultPalette };
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

function toQuestionSeries(answers: AnswerRow[]): QuestionSeries[] {
  return Object.values(
    answers.reduce<Record<string, QuestionSeries>>((acc, row) => {
      const meta = (row.question_templates?.meta as Record<string, unknown> | null) || null;
      const metaUnit = meta?.["unit"];
      const metaMin = meta?.["min"];
      const metaMax = meta?.["max"];
      const unit = typeof metaUnit === "string" ? metaUnit : undefined;
      const scaleMinValue = typeof metaMin === "number" ? metaMin : 1;
      const scaleMaxValue =
        typeof metaMax === "number" ? metaMax : typeof metaMin === "number" ? metaMin + 4 : 5;
      const scaleRange =
        typeof metaMin === "number" || typeof metaMax === "number"
          ? scaleMaxValue > scaleMinValue
            ? { min: scaleMinValue, max: scaleMaxValue }
            : { min: scaleMinValue, max: scaleMinValue + 4 }
          : { min: 1, max: 5 };
      const type = (row.question_templates?.type as QuestionSeries["type"]) || "other";
      const templateId = row.template_id || undefined;
      const value =
        type === "boolean"
          ? row.bool_value === null || row.bool_value === undefined
            ? null
            : row.bool_value
              ? 1
              : 0
          : type === "number"
            ? row.number_value
            : type === "scale"
              ? row.scale_value
              : row.scale_value ?? row.number_value ?? (row.bool_value === null || row.bool_value === undefined ? null : row.bool_value ? 1 : 0);

      if (value === null || value === undefined) return acc;

      const id = row.template_id || row.prompt_snapshot || "unknown-question";
      const label = row.prompt_snapshot || row.question_templates?.title || "Untitled question";
      const typeLabel =
        type === "scale"
          ? "Scale"
          : type === "number"
            ? "Number"
            : type === "boolean"
              ? "Yes / No"
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
          scaleRange: type === "scale" ? scaleRange : undefined,
          points: [],
        };
      }
      acc[id].points.push({ date: row.question_date, value: Number(value) });
      return acc;
    }, {}),
  ).map((series) => ({
    ...series,
    points: series.points.sort((a, b) => a.date.localeCompare(b.date)),
  }));
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
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

function colorForValue(
  value: number,
  type: QuestionSeries["type"],
  maxValue: number,
  palette: ChartPalette,
  scaleColors: ScaleColors,
  scaleRange?: QuestionSeries["scaleRange"],
) {
  if (type === "boolean") {
    return value >= 1 ? palette.booleanYes : palette.booleanNo;
  }
  if (type === "scale") {
    const min = scaleRange?.min ?? 1;
    const max = scaleRange?.max ?? Math.max(min + 4, maxValue || min + 4);
    const range = Math.max(1, max - min);
    const normalized = Math.min(1, Math.max(0, (value - min) / range));
    if (normalized >= 0.8) return scaleColors.veryHigh;
    if (normalized >= 0.6) return scaleColors.high;
    if (normalized >= 0.4) return scaleColors.mid;
    if (normalized >= 0.2) return scaleColors.low;
    return scaleColors.veryLow;
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

function LegendKey({
  type,
  scaleColors,
  palette,
}: {
  type: QuestionSeries["type"];
  scaleColors: ScaleColors;
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
  if (type === "scale") {
    return (
      <div className="mt-2 flex items-center gap-3 text-xs text-gray-700">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: scaleColors.veryLow }} />
          Very low
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: scaleColors.low }} />
          Low
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: scaleColors.mid }} />
          Mid
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: scaleColors.high }} />
          High
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: scaleColors.veryHigh }} />
          Very high
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
}: {
  series: QuestionSeries;
  onSelectDay: (date: string, value: number | undefined, isFuture: boolean) => void;
  palette: ChartPalette;
  scaleColors: ScaleColors;
  chartStyle: ChartStyle;
}) {
  const today = new Date();
  const calendarEnd = startOfWeek(today, { weekStartsOn: 0 });
  const calendarStart = startOfWeek(subWeeks(calendarEnd, 5), { weekStartsOn: 0 });
  const isBrush = chartStyle === "brush";
  const isSolid = chartStyle === "solid";

  const daily = buildDailyAverages(series);
  const valueMap = daily.reduce<Record<string, number>>((map, d) => {
    map[d.date] = d.value;
    return map;
  }, {});
  const observedMax = daily.reduce((m, d) => Math.max(m, d.value), 0);
  const maxValue =
    series.type === "scale" ? series.scaleRange?.max ?? Math.max(observedMax, 0) : observedMax;

  const days: Date[] = [];
  let cursor = calendarStart;
  while (cursor <= addDays(calendarEnd, 6)) {
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
            const value = valueMap[dayStr];
            const hasValue = value !== undefined;
            const isFuture = day > today;
            const bg =
              hasValue
                ? colorForValue(value, series.type, maxValue, palette, scaleColors, series.scaleRange)
                : "#f3f4f6";
            const brushLayer =
              !isFuture && isBrush && hasValue
                ? `repeating-linear-gradient(-12deg, rgba(47,74,61,0.06) 0 9px, transparent 9px 18px), ${bg}`
                : undefined;
            const solidLayer =
              !isFuture && isSolid && hasValue
                ? bg
                : undefined;
            const gradientLayer =
              !isFuture && !isBrush && !isSolid && hasValue
                ? `linear-gradient(135deg, ${bg} 0%, ${palette.scaleHigh} 100%)`
                : undefined;
            const title =
              value !== undefined
                ? series.type === "boolean"
                  ? `${dayStr}: ${value >= 1 ? "Yes" : "No"}`
                  : `${dayStr}: ${value.toFixed(1)}`
                : isFuture
                  ? `${dayStr}: future dates cannot be set`
                  : dayStr;

            return (
              <div
                key={dayStr}
                className={`bujo-calendar-day h-14 ${
                  isFuture ? "bujo-calendar-day--future" : "cursor-pointer"
                } ${isBrush && hasValue ? "bujo-calendar-day--brush" : ""} ${isSolid && hasValue ? "bujo-calendar-day--solid" : ""}`}
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
                  onSelectDay(dayStr, value, isFuture);
                }}
              >
                <span className="bujo-calendar-day__date text-sm">{format(day, "d")}</span>
                <span className="bujo-calendar-day__note">
                  {value === undefined ? "—" : series.type === "boolean" ? (value >= 1 ? "Yes" : "No") : value.toFixed(0)}
                </span>
                <span className="sr-only">{title}</span>
              </div>
            );
          })}
        </div>
        <LegendKey type={series.type} scaleColors={scaleColors} palette={palette} />
      </div>
    </div>
  );
}

function NumberBarChart({
  series,
  palette,
  scaleColors,
  chartStyle,
}: {
  series: QuestionSeries;
  palette: ChartPalette;
  scaleColors: ScaleColors;
  chartStyle: ChartStyle;
}) {
  const daily = buildDailyAverages(series);
  const last = daily.slice(-14);
  if (last.length === 0) return null;
  const isBrush = chartStyle === "brush";
  const isSolid = chartStyle === "solid";

  const maxValue = last.reduce((m, d) => Math.max(m, d.value), 0);
  const colors = last.map((d) =>
    colorForValue(d.value, series.type, maxValue, palette, scaleColors, series.scaleRange),
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
    labels: last.map((d) => d.date.slice(5)), // show MM-DD
    datasets: [
      {
        label: series.unit ? `Recent ${series.unit}` : "Recent values",
        data: last.map((d) => d.value),
        backgroundColor: colors,
        borderColor: colors,
      },
    ],
  };

  return (
    <div className={`mt-4 bujo-chart ${isBrush ? "bujo-chart--brush" : ""} ${isSolid ? "bujo-chart--solid" : ""}`}>
      <Bar data={data} options={options} />
    </div>
  );
}

type ModalState = {
  series: QuestionSeries;
  date: string;
  initialValue: number | undefined;
  isFuture: boolean;
};

function DayValueModal({
  state,
  onClose,
  onSave,
  saving,
  error,
}: {
  state: ModalState | null;
  onClose: () => void;
  onSave: (value: number | boolean | null) => void;
  saving: boolean;
  error: string | null;
}) {
  const series = state?.series;
  const [value, setValue] = useState<number | boolean | null>(null);
  const scaleMin = series?.scaleRange?.min ?? 1;
  const scaleMax = series?.scaleRange?.max ?? 5;

  useEffect(() => {
    if (!state || !series) return;
    if (series.type === "boolean") {
      setValue(state.initialValue !== undefined ? state.initialValue >= 1 : false);
    } else {
      setValue(state.initialValue ?? null);
    }
  }, [series, state]);

  if (!state || !series) return null;

  const dateLabel = format(parseISO(state.date), "MMM d, yyyy");
  const disableSave = saving || (series.type !== "boolean" && (value === null || value === undefined));

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
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
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
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${value === true ? "border-purple-500 bg-purple-50 text-purple-700" : "border-gray-200 text-gray-800"}`}
                onClick={() => setValue(true)}
              >
                Yes
              </button>
              <button
                type="button"
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${value === false ? "border-purple-500 bg-purple-50 text-purple-700" : "border-gray-200 text-gray-800"}`}
                onClick={() => setValue(false)}
              >
                No
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">
                {series.type === "scale" ? `Scale value (${scaleMin}-${scaleMax})` : "Numeric value"}
              </label>
              <input
                type="number"
                min={series.type === "scale" ? scaleMin : undefined}
                max={series.type === "scale" ? scaleMax : undefined}
                step={1}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                value={typeof value === "number" ? value : ""}
                onChange={(e) => {
                  const next = e.target.value === "" ? null : Number(e.target.value);
                  setValue(Number.isNaN(next) ? null : next);
                }}
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
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
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
                : "bg-purple-600 hover:bg-purple-700"
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
}: {
  answers: AnswerRow[];
  chartPalette?: Partial<ChartPalette> | null;
  chartStyle?: ChartStyle | null;
}) {
  const questionSeries = useMemo(() => toQuestionSeries(answers), [answers]);
  const [seriesData, setSeriesData] = useState<QuestionSeries[]>(questionSeries);
  const [modalState, setModalState] = useState<ModalState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const palette = useMemo(() => sanitizePalette(chartPalette ?? null), [chartPalette]);
  const scaleColors = useMemo(() => buildScaleColors(palette), [palette]);
  const resolvedStyle: ChartStyle =
    chartStyle === "brush" || chartStyle === "solid" ? chartStyle : "gradient";
  const isBrush = resolvedStyle === "brush";
  const isSolid = resolvedStyle === "solid";

  const baseLineOptions = useMemo<ChartOptions<"line">>(
    () => ({
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
            ? toRgba(palette.accentSoft, 0.52, "#fef3c7")
            : isSolid
              ? toRgba(palette.accentSoft, 0.24, "#fdf3c4")
              : "#fffbf4",
          borderColor: toRgba(palette.accent, 1, "var(--bujo-accent-ink)"),
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
    }),
    [palette, isBrush, isSolid],
  );

  useEffect(() => {
    setSeriesData(questionSeries);
  }, [questionSeries]);

  const handleSelectDay = (series: QuestionSeries, date: string, value: number | undefined, isFuture: boolean) => {
    setError(null);
    setModalState({ series, date, initialValue: value, isFuture });
  };

  const handleSave = async (newValue: number | boolean | null) => {
    if (!modalState?.series) return;
    const series = modalState.series;
    if (!series.templateId) {
      setError("Cannot save because this question is missing a template id.");
      return;
    }
    setSaving(true);
    setError(null);

    const payloadValue =
      series.type === "boolean" ? Boolean(newValue) : newValue === null ? null : Number(newValue ?? 0);

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

    const numericValue =
      series.type === "boolean" ? (payloadValue ? 1 : 0) : Number(payloadValue ?? 0);

    setSeriesData((prev) =>
      prev.map((s) =>
        s.id === series.id ? { ...s, points: upsertPoint(s.points, modalState.date, numericValue) } : s,
      ),
    );

    setSaving(false);
    setModalState(null);
  };

  if (questionSeries.length === 0) {
    return (
      <div className={`bujo-card bujo-torn ${isBrush ? "bujo-card--brush" : ""} ${isSolid ? "bujo-card--solid" : ""}`}>
        <h2 className="text-xl font-semibold text-gray-900">Trends</h2>
        <p className="text-sm text-gray-700">No data yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {seriesData.map((series) => (
        <div
          key={series.id}
          className={`bujo-card bujo-torn ${isBrush ? "bujo-card--brush" : ""} ${isSolid ? "bujo-card--solid" : ""}`}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{series.label}</h2>
              <p className="text-xs text-gray-600">Daily {series.typeLabel}</p>
            </div>
          </div>

          <QuestionCalendar
            series={series}
            onSelectDay={(date, value, isFuture) => handleSelectDay(series, date, value, isFuture)}
            palette={palette}
            scaleColors={scaleColors}
            chartStyle={resolvedStyle}
          />

          {series.type === "number" ? (
            <NumberBarChart
              series={series}
              palette={palette}
              scaleColors={scaleColors}
              chartStyle={resolvedStyle}
            />
          ) : series.type === "boolean" ? null : (
            <div className={`mt-4 bujo-chart ${isBrush ? "bujo-chart--brush" : ""} ${isSolid ? "bujo-chart--solid" : ""}`}>
              <Line
                data={(() => {
                  const daily = buildDailyAverages(series);
                  return {
                    labels: daily.map((d) => d.date.slice(5)),
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
                  };
                })()}
                options={(() => {
                  const yMinBase = series.type === "scale" ? series.scaleRange?.min ?? 1 : undefined;
                  const yMaxBase = series.type === "scale" ? series.scaleRange?.max ?? 5 : undefined;
                  const verticalPadding = series.type === "scale" ? 0.35 : 0;
                  const yMin = yMinBase !== undefined ? Math.max(0, yMinBase - verticalPadding) : undefined;
                  const yMax = yMaxBase !== undefined ? yMaxBase + verticalPadding : undefined;
                  const stepSize =
                    series.type === "scale" && yMinBase !== undefined && yMaxBase !== undefined
                      ? Math.max(1, Math.round((yMaxBase - yMinBase) / 4))
                      : baseLineOptions.scales?.y?.ticks?.stepSize;
                  const tickCallback =
                    series.type === "scale"
                      ? (value: string | number) => {
                          const numeric = typeof value === "string" ? Number(value) : value;
                          return Number.isInteger(numeric) ? numeric.toString() : "";
                        }
                      : baseLineOptions.scales?.y?.ticks?.callback;

                  return {
                    ...baseLineOptions,
                    plugins: { ...(baseLineOptions.plugins || {}) },
                    elements: { ...(baseLineOptions.elements || {}) },
                    scales: {
                      ...baseLineOptions.scales,
                      y: {
                        ...baseLineOptions.scales?.y,
                        min: yMin,
                        max: yMax,
                        suggestedMin: yMinBase,
                        suggestedMax: yMaxBase,
                        ticks: { ...(baseLineOptions.scales?.y?.ticks || {}), stepSize, callback: tickCallback },
                      },
                    },
                  };
                })()}
              />
            </div>
          )}
        </div>
      ))}

      <DayValueModal
        state={modalState}
        onClose={() => setModalState(null)}
        onSave={handleSave}
        saving={saving}
        error={error}
      />
    </div>
  );
}
