"use client";

import { useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import type { AnswerType, DisplayOption, ChartPalette } from "@/lib/types";
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
  defaultColors: string;
  answerTypeId: string;
};

function generateDemoAnswers(
  answerType: AnswerType,
  days: number = 30,
  templateId: string = "preview-template",
  questionTitle: string = "Preview Question",
): AnswerRow[] {
  const today = new Date();
  const answers: AnswerRow[] = [];

  for (let i = 0; i < days; i++) {
    const date = subDays(today, days - 1 - i);
    const dateStr = format(date, "yyyy-MM-dd");
    const baseAnswer: Omit<AnswerRow, "bool_value" | "number_value" | "scale_value" | "emoji_value" | "text_value"> = {
      id: `preview-${i}`,
      user_id: "preview-user",
      template_id: templateId,
      question_date: dateStr,
      prompt_snapshot: null,
      category_snapshot: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
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
      case "boolean": {
        // Generate roughly 60% yes, 40% no with some randomness
        const value = Math.random() > 0.4;
        answers.push({
          ...baseAnswer,
          bool_value: value,
          number_value: null,
          scale_value: null,
          emoji_value: null,
          text_value: null,
        });
        break;
      }
      case "number": {
        // Generate numbers between 0 and 100 with some variation
        const meta = answerType.meta || {};
        const min = (typeof meta.min === "number" ? meta.min : 0) as number;
        const max = (typeof meta.max === "number" ? meta.max : 100) as number;
        const value = Math.floor(Math.random() * (max - min + 1)) + min;
        answers.push({
          ...baseAnswer,
          bool_value: null,
          number_value: value,
          scale_value: null,
          emoji_value: null,
          text_value: null,
        });
        break;
      }
      case "scale": {
        // Generate scale values based on meta min/max
        const meta = answerType.meta || {};
        const min = (typeof meta.min === "number" ? meta.min : 1) as number;
        const max = (typeof meta.max === "number" ? meta.max : 5) as number;
        const value = Math.floor(Math.random() * (max - min + 1)) + min;
        answers.push({
          ...baseAnswer,
          bool_value: null,
          number_value: null,
          scale_value: value,
          emoji_value: null,
          text_value: null,
        });
        break;
      }
      case "emoji": {
        // Pick a random emoji from items
        const items = answerType.items || ["😀", "🙂", "😐", "😞", "😡"];
        const value = items[Math.floor(Math.random() * items.length)];
        answers.push({
          ...baseAnswer,
          bool_value: null,
          number_value: null,
          scale_value: null,
          emoji_value: value,
          text_value: null,
        });
        break;
      }
      case "text": {
        // Generate simple text values
        const samples = ["Good", "Great", "Okay", "Fine", "Excellent"];
        const value = samples[Math.floor(Math.random() * samples.length)];
        answers.push({
          ...baseAnswer,
          bool_value: null,
          number_value: null,
          scale_value: null,
          emoji_value: null,
          text_value: value,
        });
        break;
      }
      case "yes_no_list": {
        // Generate yes/no list as JSON array
        const items = answerType.items || [];
        const selectedItems = items.filter(() => Math.random() > 0.5);
        answers.push({
          ...baseAnswer,
          bool_value: selectedItems.length > 0 ? true : false,
          number_value: null,
          scale_value: null,
          emoji_value: null,
          text_value: selectedItems.length > 0 ? JSON.stringify(selectedItems) : null,
        });
        break;
      }
      default:
        break;
    }
  }

  return answers;
}

export default function PreviewSection({
  questionTitle,
  answerTypes,
  displayOptions,
  defaultDisplayOption,
  defaultColors,
  answerTypeId,
}: Props) {
  const [previewDays, setPreviewDays] = useState(30);
  const [previewNumberMin, setPreviewNumberMin] = useState(0);
  const [previewNumberMax, setPreviewNumberMax] = useState(100);
  const [previewScaleMin, setPreviewScaleMin] = useState(1);
  const [previewScaleMax, setPreviewScaleMax] = useState(5);
  const [previewBooleanRatio, setPreviewBooleanRatio] = useState(60);

  const parsedColors = useMemo(() => {
    try {
      const parsed = JSON.parse(defaultColors || "{}");
      return typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }, [defaultColors]);

  const primaryAnswerType = useMemo(() => {
    return answerTypes.find((at) => at.id === answerTypeId);
  }, [answerTypes, answerTypeId]);

  const demoAnswers = useMemo(() => {
    if (!primaryAnswerType || answerTypes.length === 0) return [];
    return generateDemoAnswers(primaryAnswerType, previewDays, "preview-template", questionTitle);
  }, [primaryAnswerType, answerTypes.length, previewDays, questionTitle]);

  const demoAnswersWithMeta = useMemo(() => {
    if (!primaryAnswerType) return [];
    return demoAnswers.map((answer) => {
      const answerType = primaryAnswerType;
      if (!answerType) return answer;

      // Override meta for number/scale types based on preview settings
      if (answerType.type === "number" && answer.question_templates) {
        return {
          ...answer,
          question_templates: {
            ...answer.question_templates,
            answer_types: {
              ...answer.question_templates.answer_types,
              meta: {
                ...answer.question_templates.answer_types?.meta,
                min: previewNumberMin,
                max: previewNumberMax,
              },
            },
          },
        };
      }
      if (answerType.type === "scale" && answer.question_templates) {
        return {
          ...answer,
          question_templates: {
            ...answer.question_templates,
            answer_types: {
              ...answer.question_templates.answer_types,
              meta: {
                ...answer.question_templates.answer_types?.meta,
                min: previewScaleMin,
                max: previewScaleMax,
              },
            },
          },
        };
      }
      return answer;
    });
  }, [demoAnswers, primaryAnswerType, previewNumberMin, previewNumberMax, previewScaleMin, previewScaleMax]);

  if (!primaryAnswerType || answerTypes.length === 0) {
    return null;
  }

  return (
    <div className="bujo-card bujo-torn">
      <h2 className="text-lg font-semibold text-[var(--bujo-ink)]">Preview</h2>
      <p className="mt-1 text-sm text-[var(--bujo-subtle)]">
        See how this question will look with different answer types and display options.
      </p>

      <div className="mt-4 space-y-4 rounded-md border border-[var(--bujo-border)] bg-[var(--bujo-paper)] p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-[var(--bujo-ink)]">Preview days</label>
            <input
              type="number"
              min="7"
              max="90"
              value={previewDays}
              onChange={(e) => setPreviewDays(Math.max(7, Math.min(90, Number(e.target.value))))}
              className="bujo-input text-sm"
            />
          </div>
          {primaryAnswerType?.type === "number" && (
            <>
              <div>
                <label className="text-xs font-semibold text-[var(--bujo-ink)]">Number min</label>
                <input
                  type="number"
                  value={previewNumberMin}
                  onChange={(e) => setPreviewNumberMin(Number(e.target.value))}
                  className="bujo-input text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--bujo-ink)]">Number max</label>
                <input
                  type="number"
                  value={previewNumberMax}
                  onChange={(e) => setPreviewNumberMax(Number(e.target.value))}
                  className="bujo-input text-sm"
                />
              </div>
            </>
          )}
          {primaryAnswerType?.type === "scale" && (
            <>
              <div>
                <label className="text-xs font-semibold text-[var(--bujo-ink)]">Scale min</label>
                <input
                  type="number"
                  value={previewScaleMin}
                  onChange={(e) => setPreviewScaleMin(Number(e.target.value))}
                  className="bujo-input text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--bujo-ink)]">Scale max</label>
                <input
                  type="number"
                  value={previewScaleMax}
                  onChange={(e) => setPreviewScaleMax(Number(e.target.value))}
                  className="bujo-input text-sm"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {demoAnswersWithMeta.length > 0 && (
        <div className="mt-4">
          <InsightsChart
            answers={demoAnswersWithMeta}
            chartPalette={parsedColors as Partial<ChartPalette>}
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
              const typeAnswers = generateDemoAnswers(
                at,
                Math.min(previewDays, 14),
                `preview-${at.id}`,
                questionTitle,
              );
              return (
                <div key={at.id} className="rounded-md border border-[var(--bujo-border)] bg-[var(--bujo-paper)] p-3">
                  <p className="text-xs font-semibold text-[var(--bujo-ink)]">
                    {at.name} ({at.type})
                  </p>
                  {typeAnswers.length > 0 && (
                    <div className="mt-2">
                      <InsightsChart
                        answers={typeAnswers}
                        chartPalette={parsedColors as Partial<ChartPalette>}
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
            Preview of how the question will look with different display options. Note: Only "graph" display is
            currently previewed here.
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
