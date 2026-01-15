"use client";

import { useEffect, useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import type { AnswerType, DisplayOption } from "@/lib/types";
import InsightsChart from "@/app/(site)/insights/insights-chart";

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
  question_templates?: {
    id?: string;
    title?: string;
    answer_types?: { type?: string | null; meta?: Record<string, unknown> | null } | null;
  } | null;
};

type Props = {
  questionTitle: string;
  answerTypes: AnswerType[];
  displayOptions: DisplayOption[];
  defaultDisplayOption: DisplayOption;
  answerTypeId: string;
};

type DemoValue = boolean | number | string | string[] | null;

const generateDemoValues = (answerType: AnswerType, days: number = 7): DemoValue[] => {
  const random = () => Math.random();
  const meta = answerType.meta || {};
  const minNumber = typeof meta.min === "number" ? meta.min : 0;
  const maxNumber = typeof meta.max === "number" ? meta.max : 100;
  const minScale = typeof meta.min === "number" ? meta.min : 1;
  const maxScale = typeof meta.max === "number" ? meta.max : 5;
  const emojiItems = answerType.items || ["😀", "🙂", "😐", "😞", "😡"];
  const textSamples = ["Good", "Great", "Okay", "Fine", "Excellent", "Rough", "Calm"];
  const listItems = answerType.items || [];

  return Array.from({ length: days }).map(() => {
    switch (answerType.type) {
      case "boolean":
        return random() > 0.4;
      case "number":
        return Math.round(minNumber + random() * (maxNumber - minNumber));
      case "scale":
        return Math.round(minScale + random() * (maxScale - minScale));
      case "emoji":
        return emojiItems[Math.floor(random() * emojiItems.length)];
      case "text":
        return textSamples[Math.floor(random() * textSamples.length)];
      case "yes_no_list": {
        if (listItems.length === 0) return [];
        return listItems.filter((item) => random() > 0.5).slice(0, listItems.length);
      }
      default:
        return null;
    }
  });
};

const parseDemoValues = (raw: string): { values: DemoValue[]; error: string | null } => {
  if (!raw.trim()) {
    return { values: [], error: "Provide a JSON array with 7 values." };
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return { values: [], error: "Demo data must be a JSON array." };
    }
    if (parsed.length !== 7) {
      return { values: [], error: "Provide exactly 7 values." };
    }
    return { values: parsed as DemoValue[], error: null };
  } catch {
    return { values: [], error: "Demo data must be valid JSON." };
  }
};

const buildDemoAnswersFromValues = (
  answerType: AnswerType,
  values: DemoValue[],
  templateId: string,
  questionTitle: string,
): AnswerRow[] => {
  const today = new Date();
  const meta = answerType.meta || {};
  const minNumber = typeof meta.min === "number" ? meta.min : 0;
  const maxNumber = typeof meta.max === "number" ? meta.max : 100;
  const minScale = typeof meta.min === "number" ? meta.min : 1;
  const maxScale = typeof meta.max === "number" ? meta.max : 5;

  const toNumber = (value: DemoValue, fallback: number) => {
    if (typeof value === "number" && !Number.isNaN(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isNaN(parsed) ? fallback : parsed;
    }
    return fallback;
  };

  const toBoolean = (value: DemoValue) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value > 0;
    if (typeof value === "string") return value.toLowerCase() === "true";
    return false;
  };

  const toStringValue = (value: DemoValue, fallback: string) => {
    if (typeof value === "string") return value;
    if (value === null || typeof value === "undefined") return fallback;
    return String(value);
  };

  const toStringArray = (value: DemoValue): string[] => {
    if (Array.isArray(value)) {
      return value.filter((entry) => typeof entry === "string");
    }
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed.filter((entry) => typeof entry === "string");
        }
      } catch {
        return [];
      }
    }
    return [];
  };

  return values.map((value, index) => {
    const date = subDays(today, values.length - 1 - index);
    const dateStr = format(date, "yyyy-MM-dd");
    const timestamp = `${dateStr}T00:00:00.000Z`;
    const baseAnswer: Omit<AnswerRow, "bool_value" | "number_value" | "scale_value" | "emoji_value" | "text_value"> = {
      id: `preview-${answerType.id}-${index}`,
      user_id: "preview-user",
      template_id: templateId,
      question_date: dateStr,
      prompt_snapshot: null,
      category_snapshot: null,
      created_at: timestamp,
      updated_at: timestamp,
      question_templates: {
        id: templateId,
        title: questionTitle,
        answer_types: {
          type: answerType.type,
          meta: answerType.meta || null,
        },
      },
    };

    switch (answerType.type) {
      case "boolean":
        return {
          ...baseAnswer,
          bool_value: toBoolean(value),
          number_value: null,
          scale_value: null,
          emoji_value: null,
          text_value: null,
        };
      case "number":
        return {
          ...baseAnswer,
          bool_value: null,
          number_value: Math.min(maxNumber, Math.max(minNumber, toNumber(value, minNumber))),
          scale_value: null,
          emoji_value: null,
          text_value: null,
        };
      case "scale":
        return {
          ...baseAnswer,
          bool_value: null,
          number_value: null,
          scale_value: Math.min(maxScale, Math.max(minScale, toNumber(value, minScale))),
          emoji_value: null,
          text_value: null,
        };
      case "emoji":
        return {
          ...baseAnswer,
          bool_value: null,
          number_value: null,
          scale_value: null,
          emoji_value: toStringValue(value, "🙂"),
          text_value: null,
        };
      case "text":
        return {
          ...baseAnswer,
          bool_value: null,
          number_value: null,
          scale_value: null,
          emoji_value: null,
          text_value: toStringValue(value, "Okay"),
        };
      case "yes_no_list": {
        const selectedItems = toStringArray(value);
        return {
          ...baseAnswer,
          bool_value: selectedItems.length > 0,
          number_value: null,
          scale_value: null,
          emoji_value: null,
          text_value: selectedItems.length > 0 ? JSON.stringify(selectedItems) : null,
        };
      }
      default:
        return {
          ...baseAnswer,
          bool_value: null,
          number_value: null,
          scale_value: null,
          emoji_value: null,
          text_value: null,
        };
    }
  });
};

export default function PreviewSection({
  questionTitle,
  answerTypes,
  displayOptions,
  defaultDisplayOption,
  answerTypeId,
}: Props) {
  const [demoDataByTypeId, setDemoDataByTypeId] = useState<Record<string, string>>(() => {
    const next: Record<string, string> = {};
    answerTypes.forEach((at) => {
      next[at.id] = JSON.stringify(generateDemoValues(at, 7));
    });
    return next;
  });

  const primaryAnswerType = useMemo(() => {
    return answerTypes.find((at) => at.id === answerTypeId);
  }, [answerTypes, answerTypeId]);

  useEffect(() => {
    setDemoDataByTypeId((prev) => {
      const next = { ...prev };
      answerTypes.forEach((at) => {
        if (!next[at.id]) {
          next[at.id] = JSON.stringify(generateDemoValues(at, 7));
        }
      });
      return next;
    });
  }, [answerTypes]);

  const parsedDemoByTypeId = useMemo(() => {
    const next: Record<string, { values: DemoValue[]; error: string | null }> = {};
    answerTypes.forEach((at) => {
      next[at.id] = parseDemoValues(demoDataByTypeId[at.id] ?? "");
    });
    return next;
  }, [answerTypes, demoDataByTypeId]);

  const demoAnswers = useMemo(() => {
    if (!primaryAnswerType || answerTypes.length === 0) return [];
    const parsed = parsedDemoByTypeId[primaryAnswerType.id];
    if (!parsed || parsed.error) return [];
    return buildDemoAnswersFromValues(primaryAnswerType, parsed.values, "preview-template", questionTitle);
  }, [primaryAnswerType, answerTypes.length, parsedDemoByTypeId, questionTitle]);

  if (!primaryAnswerType || answerTypes.length === 0) {
    return null;
  }

  return (
    <div className="bujo-card bujo-torn">
      <h2 className="text-lg font-semibold text-[var(--bujo-ink)]">Preview</h2>
      <p className="mt-1 text-sm text-[var(--bujo-subtle)]">
        See how this question will look with the selected answer type and its display defaults.
      </p>

      <div className="mt-4 space-y-4 rounded-md border border-[var(--bujo-border)] bg-[var(--bujo-paper)] p-4">
        <p className="text-xs text-[var(--bujo-subtle)]">
          Provide demo data as JSON arrays with exactly 7 values (newest at the end).
        </p>
        <div className="space-y-4">
          {answerTypes.map((at) => {
            const parsed = parsedDemoByTypeId[at.id];
            return (
              <div key={at.id} className="space-y-2">
                <div>
                  <p className="text-xs font-semibold text-[var(--bujo-ink)]">
                    {at.name} ({at.type})
                  </p>
                  <p className="text-[11px] text-[var(--bujo-subtle)]">Demo data (7 days)</p>
                </div>
                <textarea
                  value={demoDataByTypeId[at.id] ?? ""}
                  onChange={(e) =>
                    setDemoDataByTypeId((prev) => ({
                      ...prev,
                      [at.id]: e.target.value,
                    }))
                  }
                  rows={3}
                  className="bujo-input text-xs"
                />
                {parsed?.error && <p className="text-xs text-[var(--bujo-subtle)]">{parsed.error}</p>}
              </div>
            );
          })}
        </div>
      </div>

      {demoAnswers.length > 0 && (
        <div className="mt-4">
          <InsightsChart
            answers={demoAnswers}
            chartPalette={null}
            chartStyle="gradient"
            userQuestions={[]}
          />
        </div>
      )}

      {answerTypes.length > 1 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-[var(--bujo-ink)]">Allowed Answer Types</h3>
          <p className="text-xs text-[var(--bujo-subtle)]">
            Users can switch between these answer types. Each will render differently.
          </p>
          <div className="mt-2 space-y-2">
            {answerTypes.map((at) => {
              const parsed = parsedDemoByTypeId[at.id];
              const typeAnswers =
                parsed && !parsed.error
                  ? buildDemoAnswersFromValues(at, parsed.values, `preview-${at.id}`, questionTitle)
                  : [];
              return (
                <div key={at.id} className="rounded-md border border-[var(--bujo-border)] bg-[var(--bujo-paper)] p-3">
                  <p className="text-xs font-semibold text-[var(--bujo-ink)]">
                    {at.name} ({at.type})
                  </p>
                  {typeAnswers.length > 0 && (
                    <div className="mt-2">
                      <InsightsChart
                        answers={typeAnswers}
                        chartPalette={null}
                        chartStyle="gradient"
                        userQuestions={[]}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {displayOptions.length > 1 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-[var(--bujo-ink)]">Display Options</h3>
          <p className="text-xs text-[var(--bujo-subtle)]">
            Preview of allowed display options for this answer type. Note: Only "graph" display is currently previewed
            here.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {displayOptions.map((opt) => (
              <span
                key={opt}
                className={`bujo-chip text-xs ${opt === defaultDisplayOption ? "bg-[var(--bujo-accent)] text-white" : ""}`}
              >
                {opt} {opt === defaultDisplayOption && "(default)"}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
