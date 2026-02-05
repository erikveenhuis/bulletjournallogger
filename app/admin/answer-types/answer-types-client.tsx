"use client";

import { useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import { useRouter } from "next/navigation";
import type { AnswerType, DisplayOption } from "@/lib/types";
import InsightsChart from "@/app/(site)/insights/insights-chart";

type Props = {
  answerTypes: AnswerType[];
};

const displayOptions: DisplayOption[] = ["graph", "list", "grid", "count"];
type DraftState = {
  defaultDisplayOption: DisplayOption;
  allowedDisplayOptions: DisplayOption[];
  isActive: boolean;
  saving: boolean;
  message: string | null;
};

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
  question_templates?: {
    id?: string;
    title?: string;
    answer_types?: { type?: string | null; meta?: Record<string, unknown> | null } | null;
  } | null;
};

type DemoValue = boolean | number | string | string[] | null;

const getDefaultDisplay = (answerType: AnswerType): DisplayOption =>
  (answerType.default_display_option as DisplayOption) || "graph";

const getAllowedDisplays = (answerType: AnswerType, fallback: DisplayOption): DisplayOption[] => {
  const allowed = Array.isArray(answerType.allowed_display_options) ? answerType.allowed_display_options : [];
  if (allowed.length === 0) return [fallback];
  return allowed.includes(fallback) ? allowed : [...allowed, fallback];
};

const generateDemoValues = (answerType: AnswerType, days: number = 7): DemoValue[] => {
  const random = () => Math.random();
  const meta = answerType.meta || {};
  const minNumber = typeof meta.min === "number" ? meta.min : 0;
  const maxNumber = typeof meta.max === "number" ? meta.max : 100;
  const choiceSteps = Array.isArray(meta.steps)
    ? meta.steps.map((step) => String(step))
    : ["1", "2", "3", "4", "5"];
  const textSamples = ["Good", "Great", "Okay", "Fine", "Excellent", "Rough", "Calm"];
  const listItems = choiceSteps;

  return Array.from({ length: days }).map(() => {
    switch (answerType.type) {
      case "boolean":
        return random() > 0.4;
      case "number":
        return Math.round(minNumber + random() * (maxNumber - minNumber));
      case "text":
        return textSamples[Math.floor(random() * textSamples.length)];
      case "single_choice":
        return listItems[Math.floor(random() * listItems.length)];
      case "multi_choice": {
        if (listItems.length === 0) return [];
        return listItems.filter(() => random() > 0.5).slice(0, listItems.length);
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
  questionTitle: string,
): AnswerRow[] => {
  const today = new Date();
  const meta = answerType.meta || {};
  const minNumber = typeof meta.min === "number" ? meta.min : 0;
  const maxNumber = typeof meta.max === "number" ? meta.max : 100;

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
    const templateId = `preview-${answerType.id}`;
    const baseAnswer: Omit<AnswerRow, "bool_value" | "number_value" | "scale_value" | "text_value"> = {
      id: `preview-${answerType.id}-${index}`,
      user_id: "preview-user",
      template_id: templateId,
      question_date: dateStr,
      prompt_snapshot: questionTitle,
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
          text_value: null,
        };
      case "number":
        return {
          ...baseAnswer,
          bool_value: null,
          number_value: Math.min(maxNumber, Math.max(minNumber, toNumber(value, minNumber))),
          scale_value: null,
          text_value: null,
        };
      case "text":
        return {
          ...baseAnswer,
          bool_value: null,
          number_value: null,
          scale_value: null,
          text_value: toStringValue(value, "Okay"),
        };
      case "single_choice":
        return {
          ...baseAnswer,
          bool_value: null,
          number_value: null,
          scale_value: null,
          text_value: toStringValue(value, "1"),
        };
      case "multi_choice": {
        const selectedItems = toStringArray(value);
        return {
          ...baseAnswer,
          bool_value: null,
          number_value: null,
          scale_value: null,
          text_value: selectedItems.length > 0 ? JSON.stringify(selectedItems) : null,
        };
      }
      default:
        return {
          ...baseAnswer,
          bool_value: null,
          number_value: null,
          scale_value: null,
          text_value: null,
        };
    }
  });
};

export default function AnswerTypesClient({ answerTypes }: Props) {
  const router = useRouter();
  const [demoDataByTypeId, setDemoDataByTypeId] = useState<Record<string, string>>(() => {
    const next: Record<string, string> = {};
    answerTypes.forEach((at) => {
      next[at.id] = JSON.stringify(generateDemoValues(at, 7));
    });
    return next;
  });
  const [drafts, setDrafts] = useState<Record<string, DraftState>>(() => {
    const next: Record<string, DraftState> = {};
    answerTypes.forEach((at) => {
      const defaultDisplay = getDefaultDisplay(at);
      next[at.id] = {
        defaultDisplayOption: defaultDisplay,
        allowedDisplayOptions: getAllowedDisplays(at, defaultDisplay),
        isActive: at.is_active !== false,
        saving: false,
        message: null,
      };
    });
    return next;
  });

  const demoDataByTypeIdResolved = useMemo(() => {
    const next = { ...demoDataByTypeId };
    answerTypes.forEach((at) => {
      if (!next[at.id]) {
        next[at.id] = JSON.stringify(generateDemoValues(at, 7));
      }
    });
    return next;
  }, [answerTypes, demoDataByTypeId]);

  const filtered = useMemo(() => {
    return answerTypes.slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [answerTypes]);

  const parsedDemoByTypeId = useMemo(() => {
    const next: Record<string, { values: DemoValue[]; error: string | null }> = {};
    answerTypes.forEach((at) => {
      next[at.id] = parseDemoValues(demoDataByTypeIdResolved[at.id] ?? "");
    });
    return next;
  }, [answerTypes, demoDataByTypeIdResolved]);

  const updateDraft = (id: string, updates: Partial<DraftState>) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        ...updates,
        message: Object.prototype.hasOwnProperty.call(updates, "message")
          ? updates.message ?? null
          : prev[id]?.message ?? null,
      },
    }));
  };

  const setDefaultDisplay = (id: string, value: DisplayOption) => {
    const current = drafts[id];
    if (!current) return;
    const allowed = current.allowedDisplayOptions.includes(value)
      ? current.allowedDisplayOptions
      : [...current.allowedDisplayOptions, value];
    updateDraft(id, { defaultDisplayOption: value, allowedDisplayOptions: allowed, message: null });
  };

  const toggleAllowedDisplay = (id: string, value: DisplayOption) => {
    const current = drafts[id];
    if (!current) return;
    if (value === current.defaultDisplayOption) {
      return;
    }
    const allowed = current.allowedDisplayOptions.includes(value)
      ? current.allowedDisplayOptions.filter((opt) => opt !== value)
      : [...current.allowedDisplayOptions, value];
    updateDraft(id, { allowedDisplayOptions: allowed.length > 0 ? allowed : [current.defaultDisplayOption], message: null });
  };

  const save = async (id: string) => {
    const draft = drafts[id];
    if (!draft) return;
    updateDraft(id, { saving: true, message: null });
    const res = await fetch("/api/answer-types", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        default_display_option: draft.defaultDisplayOption,
        allowed_display_options: draft.allowedDisplayOptions,
        is_active: draft.isActive,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      updateDraft(id, { saving: false, message: data.error || "Could not update display options" });
      return;
    }
    const updated = data?.answer_type as AnswerType | undefined;
    if (updated) {
      const defaultDisplay = getDefaultDisplay(updated);
      updateDraft(id, {
        saving: false,
        message: "Saved",
        defaultDisplayOption: defaultDisplay,
        allowedDisplayOptions: getAllowedDisplays(updated, defaultDisplay),
        isActive: updated.is_active !== false,
      });
    } else {
      updateDraft(id, { saving: false, message: "Saved" });
    }
    router.refresh();
  };

  return (
    <div className="bujo-card bujo-torn">
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <p className="text-sm text-[var(--bujo-subtle)]">No answer types found.</p>
        ) : (
          filtered.map((at) => {
            const draft = drafts[at.id];
            if (!draft) return null;
            return (
              <div
                key={at.id}
                className="space-y-3 rounded-md border border-[var(--bujo-border)] bg-[var(--bujo-paper)] p-3"
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--bujo-ink)]">{at.name}</p>
                  <p className="text-xs text-[var(--bujo-subtle)]">{at.type}</p>
                  {at.description && <p className="text-xs text-[var(--bujo-subtle)]">{at.description}</p>}
                </div>
                <label className="flex items-center gap-2 text-xs text-[var(--bujo-ink)]">
                  <input
                    type="checkbox"
                    checked={draft.isActive}
                    onChange={(e) => updateDraft(at.id, { isActive: e.target.checked, message: null })}
                    className="bujo-range"
                  />
                  Active
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[var(--bujo-ink)]">Default display</label>
                    <select
                      value={draft.defaultDisplayOption}
                      onChange={(e) => setDefaultDisplay(at.id, e.target.value as DisplayOption)}
                      className="bujo-input text-sm"
                    >
                      {displayOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-[var(--bujo-ink)]">Allowed displays</p>
                    <div className="flex flex-wrap gap-3">
                      {displayOptions.map((opt) => (
                        <label
                          key={opt}
                          className={`flex items-center gap-2 rounded-md border border-[var(--bujo-border)] bg-[var(--bujo-paper)] px-3 py-2 text-xs ${
                            opt === draft.defaultDisplayOption ? "opacity-90" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={draft.allowedDisplayOptions.includes(opt)}
                            onChange={() => toggleAllowedDisplay(at.id, opt)}
                            className="bujo-range"
                            disabled={opt === draft.defaultDisplayOption}
                          />
                          <div className="flex flex-col">
                            <span className="font-semibold">{opt}</span>
                            {opt === draft.defaultDisplayOption && (
                              <span className="text-[10px] uppercase tracking-wide text-[var(--bujo-subtle)]">Default</span>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-semibold text-[var(--bujo-ink)]">Demo data (7 days)</p>
                    <p className="text-[11px] text-[var(--bujo-subtle)]">
                      Provide a JSON array with 7 values for preview.
                    </p>
                  </div>
                  <textarea
                    value={demoDataByTypeIdResolved[at.id] ?? ""}
                    onChange={(e) =>
                      setDemoDataByTypeId((prev) => ({
                        ...prev,
                        [at.id]: e.target.value,
                      }))
                    }
                    rows={3}
                    className="bujo-input text-xs"
                  />
                  {parsedDemoByTypeId[at.id]?.error && (
                    <p className="text-xs text-[var(--bujo-subtle)]">{parsedDemoByTypeId[at.id].error}</p>
                  )}
                  {(() => {
                    const parsed = parsedDemoByTypeId[at.id];
                    if (!parsed || parsed.error || parsed.values.length === 0) return null;
                    const previewAnswers = buildDemoAnswersFromValues(at, parsed.values, `${at.name} preview`);
                    return (
                      <div className="mt-2 space-y-2">
                        <p className="text-xs font-semibold text-[var(--bujo-ink)]">Display previews</p>
                        <div className="grid gap-3 lg:grid-cols-2">
                          {displayOptions.map((opt) => (
                            <div key={`${at.id}-${opt}`} className="rounded-md border border-[var(--bujo-border)] bg-white p-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--bujo-subtle)]">
                                {opt}
                              </p>
                              <div className="mt-2">
                                <InsightsChart
                                  answers={previewAnswers}
                                  chartPalette={null}
                                  chartStyle="gradient"
                                  userQuestions={[]}
                                  displayOption={opt}
                                  dateFormat={null}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => save(at.id)} className="bujo-btn text-sm" disabled={draft.saving}>
                    {draft.saving ? "Saving..." : "Save display options"}
                  </button>
                  {draft.message && <p className="text-xs text-[var(--bujo-subtle)]">{draft.message}</p>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
