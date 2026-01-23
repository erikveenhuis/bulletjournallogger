"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { format, subDays } from "date-fns";
import type { AnswerType, ChartPalette, ChartStyle, DisplayOption, UserQuestion } from "@/lib/types";
import { defaultThemeDefaults } from "@/lib/theme-constants";
import ConfirmDialog from "@/components/confirm-dialog";
import InsightsChart from "@/app/(site)/insights/insights-chart";

const hexColorPattern = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

type Props = {
  userQuestions: UserQuestion[];
  accountTier: number;
  userId: string;
  chartPalette?: ChartPalette | null;
  chartStyle?: ChartStyle | null;
  defaultPalette?: ChartPalette;
  defaultStyle?: ChartStyle;
};

type OverrideEdit = {
  display_option_override: DisplayOption | null;
  color_palette: Partial<ChartPalette> | null;
};

type DemoValue = boolean | number | string | string[] | null;
type SaveState = "idle" | "saving" | "saved" | "error";
type SaveStatus = { state: SaveState; message?: string };

export default function SelectedQuestions({
  userQuestions,
  accountTier,
  userId,
  chartPalette,
  chartStyle,
  defaultPalette,
  defaultStyle,
}: Props) {
  const [mounted] = useState(() => typeof window !== "undefined");
  const fallbackPalette = useMemo(
    () => defaultPalette ?? defaultThemeDefaults.chart_palette,
    [defaultPalette],
  );
  const validUserQuestions = userQuestions
    .filter(
      (u): u is UserQuestion & { template: NonNullable<UserQuestion["template"]> } => !!u.template,
    )
    .filter((u) => {
      const answerType = u.template.answer_types;
      return !!answerType; // Must have a valid answer type
    });
  const missingTemplateQuestions = userQuestions.filter((u) => !u.template);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [activePopupId, setActivePopupId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, OverrideEdit>>({});
  const overridesRef = useRef<Record<string, OverrideEdit>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saveStatusById, setSaveStatusById] = useState<Record<string, SaveStatus>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const saveTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const colorOverrideFields: Array<{ key: keyof ChartPalette; label: string }> = [
    { key: "accent", label: "Accent" },
    { key: "accentSoft", label: "Accent fill" },
    { key: "booleanYes", label: "Yes color" },
    { key: "booleanNo", label: "No color" },
    { key: "scaleLow", label: "Scale low" },
    { key: "scaleHigh", label: "Scale high" },
  ];


  const overridesSeed = useMemo(
    () =>
      validUserQuestions
        .map(
          (u) =>
            `${u.id}|${u.display_option_override ?? ""}|${JSON.stringify(
              u.color_palette ?? {},
            )}`,
        )
        .join(";"),
    [validUserQuestions],
  );

  useEffect(() => {
    const initial: Record<string, OverrideEdit> = {};
    validUserQuestions.forEach((u) => {
      initial[u.id] = {
        display_option_override: (u.display_option_override as DisplayOption | null) ?? null,
        color_palette: (u.color_palette as Partial<ChartPalette> | null) ?? null,
      };
    });
    const next = JSON.stringify(initial);
    const current = JSON.stringify(overrides);
    if (next !== current) {
      setOverrides(initial);
      overridesRef.current = initial;
    }
  }, [overridesSeed, overrides, validUserQuestions]);

  const remove = async () => {
    if (!pendingRemoveId) return;
    await fetch(`/api/user-questions?id=${pendingRemoveId}`, { method: "DELETE" });
    setPendingRemoveId(null);
    window.location.reload();
  };

  const saveOverrides = async (id: string, templateId: string) => {
    const payload = overridesRef.current[id];
    if (!payload) return;
    const normalizedPalette =
      accountTier >= 2 ? normalizeOverridePalette(payload.color_palette) : null;
    const res = await fetch("/api/user-questions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        template_id: templateId,
        display_option_override: payload.display_option_override,
        ...(accountTier >= 2 ? { color_palette: normalizedPalette } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setSaveStatusById((prev) => ({
        ...prev,
        [id]: { state: "error", message: data.error || "Could not save overrides" },
      }));
      return;
    }
    setSaveStatusById((prev) => ({
      ...prev,
      [id]: { state: "saved" },
    }));
  };

  const scheduleSave = (id: string, templateId: string) => {
    if (saveTimeouts.current[id]) {
      clearTimeout(saveTimeouts.current[id]);
    }
    setSaveStatusById((prev) => ({
      ...prev,
      [id]: { state: "saving" },
    }));
    saveTimeouts.current[id] = setTimeout(() => {
      void saveOverrides(id, templateId);
    }, 500);
  };

  const updateSortOrder = async (id: string, sortOrder: number) => {
    const res = await fetch("/api/user-questions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, sort_order: sortOrder }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Could not update order");
    }
  };

  const persistOrder = async (
    list: (UserQuestion & { template: NonNullable<UserQuestion["template"]> })[],
  ) => {
    await Promise.all(
      list.map((item, index) => updateSortOrder(item.id, index)),
    );
  };

  const moveByDrag = async (
    list: (UserQuestion & { template: NonNullable<UserQuestion["template"]> })[],
    toIndex: number,
  ) => {
    if (!draggingId) return;
    const fromIndex = list.findIndex((item) => item.id === draggingId);
    if (fromIndex < 0 || fromIndex === toIndex) return;
    const reordered = [...list];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    setMessage(null);
    try {
      await persistOrder(reordered);
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update order");
    } finally {
      setDraggingId(null);
    }
  };

  const getDisplayConfig = (u: UserQuestion & { template: NonNullable<UserQuestion["template"]> }) => {
    const answerType = u.template.answer_types;
    const defaultDisplay = (answerType?.default_display_option as DisplayOption) || "graph";
    const allowedDisplays =
      (answerType?.allowed_display_options && answerType.allowed_display_options.length > 0
        ? answerType.allowed_display_options
        : [defaultDisplay]) || [];
    return { defaultDisplay, allowedDisplays };
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

  const demoValuesByTypeId = useMemo(() => {
    const map = new Map<string, DemoValue[]>();
    validUserQuestions.forEach((u) => {
      const answerType = u.template.answer_types as AnswerType | null;
      if (!answerType?.id || map.has(answerType.id)) return;
      map.set(answerType.id, generateDemoValues(answerType, 7));
    });
    return map;
  }, [validUserQuestions]);

  const buildDemoAnswersFromValues = (
    answerType: AnswerType,
    values: DemoValue[],
    templateId: string,
    questionTitle: string,
    categoryName?: string | null,
    templateMeta?: Record<string, unknown> | null,
  ) => {
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
      const baseAnswer = {
        id: `preview-${answerType.id}-${index}`,
        user_id: "preview-user",
        template_id: templateId,
        question_date: dateStr,
        prompt_snapshot: questionTitle,
        category_snapshot: categoryName ?? null,
        created_at: timestamp,
        updated_at: timestamp,
        question_templates: {
          id: templateId,
          title: questionTitle,
          meta: templateMeta ?? null,
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

  const normalizeHexColor = useCallback((value?: string | null) => {
    if (!value || typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!hexColorPattern.test(trimmed)) return null;
    const raw = trimmed.slice(1);
    const expanded = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
    return `#${expanded.toLowerCase()}`;
  }, []);

  const normalizeOverridePalette = (input?: Partial<ChartPalette> | null) => {
    if (!input) return null;
    const result: Partial<ChartPalette> = {};
    colorOverrideFields.forEach(({ key }) => {
      const normalized = normalizeHexColor(input[key] || undefined);
      if (normalized) {
        result[key] = normalized;
      }
    });
    return Object.keys(result).length > 0 ? result : null;
  };

  const sanitizePalette = useCallback(
    (input?: Partial<ChartPalette> | null, fallback?: ChartPalette): ChartPalette => {
    const palette = { ...(fallback ?? fallbackPalette) };
    if (!input) return palette;
    (Object.keys(palette) as Array<keyof ChartPalette>).forEach((key) => {
      const normalized = normalizeHexColor(input[key] || undefined);
      if (normalized) {
        palette[key] = normalized;
      }
    });
    return palette;
    },
    [fallbackPalette, normalizeHexColor],
  );

  const basePalette = useMemo(
    () => sanitizePalette(chartPalette ?? null, fallbackPalette),
    [chartPalette, fallbackPalette, sanitizePalette],
  );

  const getPaletteForQuestion = (u: UserQuestion & { template: NonNullable<UserQuestion["template"]> }) => {
    const draftPalette = overrides[u.id]?.color_palette ?? null;
    return sanitizePalette(draftPalette, basePalette);
  };

  const renderTable = (
    title: string,
    list: (UserQuestion & { template: NonNullable<UserQuestion["template"]> })[],
    options?: { lockedIds?: Set<string> },
  ) => {
    if (list.length === 0) return null;
    const lockedIds = options?.lockedIds;
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-[var(--bujo-ink)]">{title}</h3>
        <div className="overflow-x-auto rounded-md border border-[var(--bujo-border)] bg-[var(--bujo-paper)]">
          <table className="min-w-[720px] w-full border-collapse text-left text-xs text-[var(--bujo-ink)]">
            <thead className="bg-[var(--bujo-paper)]">
              <tr className="border-b border-[var(--bujo-border)]">
                <th className="px-3 py-2 font-semibold"></th>
                <th className="px-3 py-2 font-semibold">Question</th>
                <th className="px-3 py-2 font-semibold">Owner</th>
                <th className="px-3 py-2 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((u, index) => {
                const isPersonal = u.template.created_by === userId;
                const isTierLocked = isPersonal && accountTier < 3;
                const isLimitLocked = lockedIds?.has(u.id) ?? false;
                const isLockedRow = isTierLocked || isLimitLocked;
                return (
                  <tr
                    key={u.id}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", u.id);
                      event.dataTransfer.effectAllowed = "move";
                      setDraggingId(u.id);
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      void moveByDrag(list, index);
                    }}
                    className={`border-b border-[var(--bujo-border)] last:border-0 ${
                      isLockedRow ? "opacity-60" : ""
                    }`}
                  >
                    <td className="px-3 py-2">
                      <div className="flex flex-col items-start gap-1">
                        <span className="text-base font-semibold text-[var(--bujo-subtle)]">=</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold text-[var(--bujo-ink)]">{u.custom_label || u.template.title}</p>
                        <p className="text-xs text-[var(--bujo-subtle)]">
                          {u.template.answer_types?.type ?? "unknown"} • {u.template.categories?.name}
                        </p>
                        {isLockedRow ? (
                          <>
                            <a
                              href="/profile/account"
                              className="mt-1 inline-flex text-[10px] font-semibold uppercase tracking-wide text-[var(--bujo-subtle)] underline"
                            >
                              Upgrade your account
                            </a>{" "}
                            to re-enable
                          </>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--bujo-subtle)]">
                      {isPersonal ? "You" : "Everyone"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                        <button
                          onClick={() => setActivePopupId(u.id)}
                          disabled={isLimitLocked}
                          className="bujo-btn-secondary w-full justify-center text-xs sm:w-auto disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          Customize
                        </button>
                        <button
                          onClick={() => setPendingRemoveId(u.id)}
                          className="bujo-btn-danger w-full justify-center text-xs sm:w-auto"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const sortedQuestions = useMemo(
    () =>
      [...validUserQuestions].sort((a, b) => {
        const aOrder = typeof a.sort_order === "number" ? a.sort_order : Number.POSITIVE_INFINITY;
        const bOrder = typeof b.sort_order === "number" ? b.sort_order : Number.POSITIVE_INFINITY;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return (a.custom_label || a.template.title).localeCompare(b.custom_label || b.template.title);
      }),
    [validUserQuestions],
  );
  const freeTierLimit = accountTier < 1 ? 3 : null;
  const lockedQuestionIds = useMemo(() => {
    if (!freeTierLimit) return null;
    return new Set(sortedQuestions.slice(freeTierLimit).map((q) => q.id));
  }, [freeTierLimit, sortedQuestions]);

  return (
    <section className="bujo-card bujo-torn">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[var(--bujo-ink)]">Your daily list</h2>
          <p className="text-sm text-[var(--bujo-subtle)]">
            Questions you will see each day (tap the reminder notification).
          </p>
        </div>
      </div>
      <div className="mt-3 space-y-6">
        {validUserQuestions.length === 0 && userQuestions.length === 0 && (
          <p className="text-sm text-[var(--bujo-subtle)]">No questions selected yet.</p>
        )}
        {freeTierLimit && sortedQuestions.length > freeTierLimit ? (
          <div className="rounded-md border border-[var(--bujo-border)] bg-white px-3 py-2 text-xs text-[var(--bujo-subtle)]">
            Free tier includes 3 enabled questions.{" "}
            <a href="/profile/account" className="underline">
              Upgrade your account
            </a>{" "}
            to enable more.
          </div>
        ) : null}
        {renderTable(
          freeTierLimit ? "All questions (top 3 enabled)" : "All questions",
          sortedQuestions,
          { lockedIds: lockedQuestionIds ?? undefined },
        )}

        {missingTemplateQuestions.map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2"
          >
            <div>
              <p className="text-sm font-semibold text-red-900">{u.custom_label || "Missing template"}</p>
              <p className="text-xs text-red-800">This template was removed. Remove to clean up.</p>
            </div>
            <button onClick={() => setPendingRemoveId(u.id)} className="bujo-btn-danger text-xs">
              Remove
            </button>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!pendingRemoveId}
        title="Remove question?"
        description="This will remove the question from your daily list."
        confirmLabel="Remove"
        cancelLabel="Cancel"
        confirmTone="danger"
        onConfirm={remove}
        onCancel={() => setPendingRemoveId(null)}
      />
      {message && <p className="bujo-message text-xs">{message}</p>}
      {mounted && activePopupId && (() => {
        const activeQuestion =
          validUserQuestions.find((q) => q.id === activePopupId) ??
          null;
        if (!activeQuestion) return null;
        const answerType = activeQuestion.template.answer_types as AnswerType | null;
        if (!answerType) return null;
        const { defaultDisplay, allowedDisplays } = getDisplayConfig(activeQuestion);
        const currentDisplay =
          overrides[activeQuestion.id]?.display_option_override || defaultDisplay;
        const saveStatus = saveStatusById[activeQuestion.id];
        const saveIndicator =
          saveStatus?.state === "saving"
            ? "Saving..."
            : saveStatus?.state === "saved"
              ? "Saved"
              : saveStatus?.state === "error"
                ? saveStatus.message || "Save failed"
                : null;
        const palette = getPaletteForQuestion(activeQuestion);
        const demoValues = demoValuesByTypeId.get(answerType.id) ?? generateDemoValues(answerType, 7);
        const demoAnswers = buildDemoAnswersFromValues(
          answerType,
          demoValues,
          activeQuestion.template_id,
          activeQuestion.custom_label || activeQuestion.template.title,
          activeQuestion.template.categories?.name ?? null,
          (activeQuestion.template.meta as Record<string, unknown> | null) ?? null,
        );
        const modalContent = (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
            <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border-2 border-[var(--bujo-border)] bg-[var(--bujo-paper)] p-6 shadow-2xl">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Customize question</h2>
                  <p className="text-sm text-gray-700">
                    {activeQuestion.custom_label || activeQuestion.template.title}
                  </p>
                </div>
                <div className="flex flex-col gap-2 md:items-end">
                  {saveIndicator ? (
                    <span
                      className={`text-xs font-semibold ${
                        saveStatus?.state === "error" ? "text-red-600" : "text-[var(--bujo-subtle)]"
                      }`}
                    >
                      {saveIndicator}
                    </span>
                  ) : null}
                  <button onClick={() => setActivePopupId(null)} className="bujo-btn-secondary w-full justify-center text-sm md:w-auto">
                    Close
                  </button>
                </div>
              </div>
              <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
                <div className="space-y-6">
                  <div className="space-y-2 rounded-md border border-[var(--bujo-border)] bg-white p-4">
                    <h3 className="text-sm font-semibold text-[var(--bujo-ink)]">Display</h3>
                    <div className="flex flex-wrap items-center gap-2">
                      {allowedDisplays.map((opt) => {
                        const checked = currentDisplay === opt;
                        return (
                          <label key={opt} className="flex items-center gap-1 text-[10px] text-[var(--bujo-subtle)]">
                            <input
                              type="radio"
                              name={`display-${activeQuestion.id}`}
                              value={opt}
                              checked={checked}
                              onChange={() => {
                                const nextValue = opt === defaultDisplay ? null : opt;
                                setOverrides((prev) => {
                                  const next = {
                                    ...prev,
                                    [activeQuestion.id]: {
                                      ...(prev[activeQuestion.id] || { color_palette: null }),
                                      display_option_override: nextValue,
                                    },
                                  };
                                  overridesRef.current = next;
                                  return next;
                                });
                                scheduleSave(activeQuestion.id, activeQuestion.template_id);
                              }}
                              disabled={allowedDisplays.length <= 1}
                            />
                            {opt}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-2 rounded-md border border-[var(--bujo-border)] bg-white p-4">
                    <h3 className="text-sm font-semibold text-[var(--bujo-ink)]">Color overrides</h3>
                    {accountTier >= 2 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {colorOverrideFields.map(({ key, label }) => {
                          const inputId = `color-${activeQuestion.id}-${key}`;
                          const currentColor = palette[key];
                          return (
                            <div key={key} className="flex items-center gap-2 text-[10px] text-[var(--bujo-subtle)]">
                              <input
                                id={inputId}
                                type="color"
                                value={palette[key]}
                                onChange={(event) => {
                                  const nextValue = event.target.value;
                                  setOverrides((prev) => {
                                    const next = {
                                      ...prev,
                                      [activeQuestion.id]: {
                                        ...(prev[activeQuestion.id] || { display_option_override: null, color_palette: null }),
                                        color_palette: {
                                          ...(prev[activeQuestion.id]?.color_palette || {}),
                                          [key]: nextValue,
                                        },
                                      },
                                    };
                                    overridesRef.current = next;
                                    return next;
                                  });
                                  scheduleSave(activeQuestion.id, activeQuestion.template_id);
                                }}
                                className="h-8 w-10 rounded border border-[var(--bujo-border)] bg-white p-0.5 shadow-sm"
                                aria-label={`${label} override`}
                              />
                              <span
                                className="h-4 w-4 rounded-full border border-[var(--bujo-border)]"
                                style={{ backgroundColor: currentColor }}
                                aria-hidden="true"
                              />
                              <label htmlFor={inputId}>{label}</label>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--bujo-subtle)]">
                        <a href="/profile/account" className="underline">
                          Upgrade your account
                        </a>{" "}
                        to set custom color overrides.
                      </p>
                    )}
                  </div>
                </div>
                <div className="rounded-md border border-[var(--bujo-border)] bg-white p-4">
                  <h3 className="text-sm font-semibold text-[var(--bujo-ink)]">Live preview</h3>
                  <p className="text-xs text-[var(--bujo-subtle)]">
                    Demo data for {answerType.name || "Answer type"} ({answerType.type}).
                  </p>
                  <div className="mt-3">
                    <InsightsChart
                      answers={demoAnswers}
                      chartPalette={palette}
                      chartStyle={chartStyle ?? defaultStyle ?? defaultThemeDefaults.chart_style}
                      displayOption={currentDisplay}
                      userQuestions={[]}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
        return createPortal(modalContent, document.body);
      })()}
    </section>
  );
}
