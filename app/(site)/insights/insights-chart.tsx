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
  points: Array<{ date: string; value: number }>;
};

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const scaleColors = {
  veryLow: "#f1edff",
  low: "#d9ceff",
  mid: "#b6a3ff",
  high: "#9277ff",
  veryHigh: "#6f3dff",
};

function toQuestionSeries(answers: AnswerRow[]): QuestionSeries[] {
  return Object.values(
    answers.reduce<Record<string, QuestionSeries>>((acc, row) => {
      const meta = (row.question_templates?.meta as Record<string, unknown> | null) || null;
      const metaUnit = meta?.["unit"];
      const unit = typeof metaUnit === "string" ? metaUnit : undefined;
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

function colorForValue(value: number, type: QuestionSeries["type"], maxValue: number) {
  if (type === "boolean") {
    return value >= 1 ? "#2ecc71" : "#e74c3c";
  }
  if (type === "scale") {
    if (value >= 9) return scaleColors.veryHigh;
    if (value >= 7) return scaleColors.high;
    if (value >= 5) return scaleColors.mid;
    if (value >= 3) return scaleColors.low;
    return scaleColors.veryLow;
  }
  // number or other — use relative scale
  if (maxValue <= 0) return "#e5e7eb";
  const ratio = Math.min(1, value / maxValue);
  const alpha = 0.2 + 0.6 * ratio;
  return `rgba(124, 92, 255, ${alpha.toFixed(2)})`;
}

function upsertPoint(points: Array<{ date: string; value: number }>, date: string, value: number) {
  const filtered = points.filter((p) => p.date !== date);
  return [...filtered, { date, value }].sort((a, b) => a.date.localeCompare(b.date));
}

function LegendKey({ type }: { type: QuestionSeries["type"] }) {
  if (type === "boolean") {
    return (
      <div className="mt-2 flex items-center gap-3 text-xs text-gray-700">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm bg-[#2ecc71]" />
          Yes
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm bg-[#e74c3c]" />
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
}: {
  series: QuestionSeries;
  onSelectDay: (date: string, value: number | undefined, isFuture: boolean) => void;
}) {
  const today = new Date();
  const calendarEnd = startOfWeek(today, { weekStartsOn: 0 });
  const calendarStart = startOfWeek(subWeeks(calendarEnd, 5), { weekStartsOn: 0 });

  const daily = buildDailyAverages(series);
  const valueMap = daily.reduce<Record<string, number>>((map, d) => {
    map[d.date] = d.value;
    return map;
  }, {});
  const maxValue = daily.reduce((m, d) => Math.max(m, d.value), 0);

  const days: Date[] = [];
  let cursor = calendarStart;
  while (cursor <= addDays(calendarEnd, 6)) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return (
    <div className="mt-3 overflow-x-auto">
      <div className="bujo-calendar min-w-[520px] space-y-3">
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
            const isFuture = day > today;
            const bg = value !== undefined ? colorForValue(value, series.type, maxValue) : "#f3f4f6";
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
                className={`bujo-calendar-day h-14 ${isFuture ? "bujo-calendar-day--future" : "cursor-pointer"}`}
                style={{
                  background: isFuture
                    ? "#f8f1e0"
                    : `linear-gradient(135deg, ${bg} 0%, ${bg} 68%, rgba(255,255,255,0.92) 100%)`,
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
        <LegendKey type={series.type} />
      </div>
    </div>
  );
}

function NumberBarChart({ series }: { series: QuestionSeries }) {
  const daily = buildDailyAverages(series);
  const last = daily.slice(-14);
  if (last.length === 0) return null;

  const maxValue = last.reduce((m, d) => Math.max(m, d.value), 0);
  const colors = last.map((d) => colorForValue(d.value, series.type, maxValue));

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
          borderRadius: 8,
          borderWidth: 1.4,
          borderColor: "rgba(47, 74, 61, 0.55)",
        },
      },
    }),
    [],
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
    <div className="mt-4 bujo-chart">
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
                {series.type === "scale" ? "Scale value (0-10)" : "Numeric value"}
              </label>
              <input
                type="number"
                min={0}
                max={10}
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

export default function InsightsChart({ answers }: { answers: AnswerRow[] }) {
  const questionSeries = useMemo(() => toQuestionSeries(answers), [answers]);
  const [seriesData, setSeriesData] = useState<QuestionSeries[]>(questionSeries);
  const [modalState, setModalState] = useState<ModalState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lineOptions = useMemo<ChartOptions<"line">>(
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
        line: { tension: 0.35, borderDash: [6, 4], borderWidth: 2.6 },
        point: {
          radius: 4.4,
          borderWidth: 1.6,
          backgroundColor: "#fffbf4",
          borderColor: "var(--bujo-accent-ink)",
          hoverRadius: 6,
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
    [],
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
      <div className="bujo-card bujo-ruled">
        <h2 className="text-xl font-semibold text-gray-900">Trends</h2>
        <p className="text-sm text-gray-700">No data yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {seriesData.map((series) => (
        <div key={series.id} className="bujo-card bujo-ruled">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{series.label}</h2>
              <p className="text-xs text-gray-600">Daily {series.typeLabel}</p>
            </div>
          </div>

          <QuestionCalendar
            series={series}
            onSelectDay={(date, value, isFuture) => handleSelectDay(series, date, value, isFuture)}
          />

          {series.type === "number" ? (
            <NumberBarChart series={series} />
          ) : series.type === "boolean" ? null : (
            <div className="mt-4 bujo-chart">
              <Line
                data={{
                  labels: buildDailyAverages(series).map((d) => d.date.slice(5)),
                  datasets: [
                    {
                      label: `${series.typeLabel} trend`,
                      data: buildDailyAverages(series).map((d) => d.value),
                      borderColor: "rgba(47, 74, 61, 0.85)",
                      backgroundColor: "rgba(95, 139, 122, 0.18)",
                    },
                  ],
                }}
                options={lineOptions}
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
