"use client";

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
} from "chart.js";
import { addDays, format, startOfWeek, subWeeks } from "date-fns";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, ChartLegend);

type AnswerRow = {
  question_date: string;
  template_id: string;
  prompt_snapshot: string | null;
  scale_value: number | null;
  number_value: number | null;
  bool_value?: boolean | null;
  question_templates?: { id?: string; title?: string; type?: string | null } | null;
};

type QuestionSeries = {
  id: string;
  label: string;
  type: "scale" | "number" | "boolean" | "other";
  typeLabel: string;
  points: Array<{ date: string; value: number }>;
};

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toQuestionSeries(answers: AnswerRow[]): QuestionSeries[] {
  return Object.values(
    answers.reduce<Record<string, QuestionSeries>>((acc, row) => {
      const type = (row.question_templates?.type as QuestionSeries["type"]) || "other";
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
        acc[id] = { id, label, type, typeLabel, points: [] };
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
    if (value >= 7) return "#7c5cff";
    if (value >= 4) return "#b6a3ff";
    return "#e8e1ff";
  }
  // number or other — use relative scale
  if (maxValue <= 0) return "#e5e7eb";
  const ratio = Math.min(1, value / maxValue);
  const alpha = 0.2 + 0.6 * ratio;
  return `rgba(124, 92, 255, ${alpha.toFixed(2)})`;
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
          <span className="h-3 w-3 rounded-sm bg-[#e8e1ff]" />
          Low
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm bg-[#b6a3ff]" />
          Mid
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm bg-[#7c5cff]" />
          High
        </span>
      </div>
    );
  }
  return null;
}

function QuestionCalendar({ series }: { series: QuestionSeries }) {
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
    <div className="mt-3 space-y-2 overflow-x-auto">
      <div className="min-w-[460px] space-y-2">
        <div className="grid grid-cols-7 gap-1 text-[11px] font-semibold text-gray-600">
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
            const textColor = isFuture ? "text-gray-400" : "text-gray-800";
            const title =
              value !== undefined
                ? series.type === "boolean"
                  ? `${dayStr}: ${value >= 1 ? "Yes" : "No"}`
                  : `${dayStr}: ${value.toFixed(1)}`
                : dayStr;

            return (
              <div
                key={dayStr}
                className={`flex h-12 flex-col items-center justify-center rounded border border-gray-200 ${textColor}`}
                style={{ backgroundColor: isFuture ? "#f9fafb" : bg }}
                title={title}
                aria-label={title}
              >
                <span className="text-xs font-semibold text-gray-800">{format(day, "d")}</span>
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

  const data = {
    labels: last.map((d) => d.date.slice(5)), // show MM-DD
    datasets: [
      {
        label: "Recent values",
        data: last.map((d) => d.value),
        backgroundColor: "rgba(124, 92, 255, 0.5)",
        borderColor: "rgb(124, 92, 255)",
      },
    ],
  };

  return (
    <div className="mt-4">
      <Bar data={data} />
    </div>
  );
}

export default function InsightsChart({ answers }: { answers: AnswerRow[] }) {
  const questionSeries = toQuestionSeries(answers);

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
      {questionSeries.map((series) => (
        <div key={series.id} className="bujo-card bujo-ruled">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{series.label}</h2>
              <p className="text-xs text-gray-600">Daily {series.typeLabel}</p>
            </div>
          </div>

          <QuestionCalendar series={series} />

          {series.type === "number" ? (
            <NumberBarChart series={series} />
          ) : series.type === "boolean" ? null : (
            <div className="mt-4">
              <Line
                data={{
                  labels: buildDailyAverages(series).map((d) => d.date.slice(5)),
                  datasets: [
                    {
                      label: `${series.typeLabel} trend`,
                      data: buildDailyAverages(series).map((d) => d.value),
                      borderColor: "rgb(124, 92, 255)",
                      backgroundColor: "rgba(124, 92, 255, 0.2)",
                    },
                  ],
                }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
