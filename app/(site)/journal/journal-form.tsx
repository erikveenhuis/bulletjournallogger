"use client";

import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfToday,
  startOfWeek,
} from "date-fns";
import type { UserQuestion } from "@/lib/types";

type Props = {
  date: string;
  userQuestions: UserQuestion[];
};

type AnswerValue = string | number | boolean | boolean[] | null;

type AnswerRow = {
  template_id: string;
  question_date: string;
  bool_value: boolean | null;
  number_value: number | null;
  scale_value: number | null;
  emoji_value: string | null;
  text_value: string | null;
  question_templates?:
    | {
        id?: string;
        title?: string;
        answer_types?: { type?: string | null; meta?: Record<string, unknown> | null } | null;
      }
    | null;
};

type DayStatus = "full" | "partial";

export default function JournalForm({ date, userQuestions }: Props) {
  const todayDate = startOfToday();
  const [selectedDate, setSelectedDate] = useState(date);
  const [currentMonth, setCurrentMonth] = useState(() => parseISO(date));
  const [answeredDates, setAnsweredDates] = useState<Record<string, DayStatus>>({});
  const [values, setValues] = useState<Record<string, AnswerValue>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [hasUserEdited, setHasUserEdited] = useState(false);
  const [lastSavedValues, setLastSavedValues] = useState<Record<string, AnswerValue>>({});

  // Only work with questions that still have an attached template (can be null if deleted).
  const validUserQuestions = useMemo(
    () =>
      userQuestions.filter(
        (uq): uq is UserQuestion & { template: NonNullable<UserQuestion["template"]> } => !!uq.template,
      ),
    [userQuestions],
  );
  const validTemplateIds = useMemo(() => validUserQuestions.map((uq) => uq.template_id), [validUserQuestions]);

  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const selectedDateObj = selectedDate ? parseISO(selectedDate) : todayDate;
  const canGoNextMonth = !isAfter(startOfMonth(addMonths(currentMonth, 1)), todayDate);

  const setValue = (id: string, value: AnswerValue) => {
    setHasUserEdited(true);
    setValues((prev) => ({ ...prev, [id]: value }));
  };

  const isValueAnswered = (value: AnswerValue) => {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return true; // Array means "Yes" was selected
    return true; // booleans and numbers (including 0 / false) count as answered
  };

  const computeDayStatus = useCallback(
    (vals: Record<string, AnswerValue>): DayStatus | null => {
      if (validTemplateIds.length === 0) return null;

      let answeredCount = 0;
      validTemplateIds.forEach((templateId) => {
        if (isValueAnswered(vals[templateId])) answeredCount += 1;
      });

      if (answeredCount === 0) return null;
      return answeredCount >= validTemplateIds.length ? "full" : "partial";
    },
    [validTemplateIds],
  );

  const fetchExistingAnswers = useCallback(
    async (targetDate: string) => {
      if (!targetDate) return;
      setLoadingExisting(true);
      setError(null);
      try {
        const params = new URLSearchParams({ start: targetDate, end: targetDate });
        const res = await fetch(`/api/answers?${params.toString()}`);
        if (!res.ok) {
          throw new Error("Failed to load");
        }
        const data = (await res.json()) as AnswerRow[];
        const map: Record<string, AnswerValue> = {};
        data.forEach((ans) => {
          if (!ans.template_id) return;
          // Check if this is a yes_no_list type by looking at the template from the answer
          const answerType = ans.question_templates?.answer_types?.type;
          if (answerType === "yes_no_list") {
            // For yes_no_list: if bool_value is false, it's "No"
            // If text_value exists, parse it as JSON array (it's "Yes" with selections)
            if (ans.bool_value === false) {
              map[ans.template_id] = false;
              return;
            }
            if (ans.text_value !== null && ans.text_value !== undefined) {
              try {
                const parsed = JSON.parse(ans.text_value);
                if (Array.isArray(parsed)) {
                  map[ans.template_id] = parsed;
                  return;
                }
              } catch {
                // If parsing fails, treat as empty array
                map[ans.template_id] = [];
                return;
              }
            }
            return;
          }
          if (ans.bool_value !== null && ans.bool_value !== undefined) {
            map[ans.template_id] = ans.bool_value;
            return;
          }
          if (ans.number_value !== null && ans.number_value !== undefined) {
            map[ans.template_id] = ans.number_value;
            return;
          }
          if (ans.scale_value !== null && ans.scale_value !== undefined) {
            map[ans.template_id] = ans.scale_value;
            return;
          }
          if (ans.emoji_value !== null && ans.emoji_value !== undefined) {
            map[ans.template_id] = ans.emoji_value;
            return;
          }
          if (ans.text_value !== null && ans.text_value !== undefined) {
            map[ans.template_id] = ans.text_value;
          }
        });
        setValues(map);
        setLastSavedValues(map);
        setHasUserEdited(false);
      } catch (error) {
        setError("Could not load saved answers for that date.");
        setValues({});
        setLastSavedValues({});
        setHasUserEdited(false);
      } finally {
        setLoadingExisting(false);
      }
    },
    [],
  );

  const fetchAnsweredDays = useCallback(
    async (month: Date) => {
      setLoadingMonth(true);
      try {
        const start = format(startOfMonth(month), "yyyy-MM-dd");
        const end = format(endOfMonth(month), "yyyy-MM-dd");
        const params = new URLSearchParams({ start, end });
        const res = await fetch(`/api/answers?${params.toString()}`);
        if (!res.ok) {
          throw new Error("Failed to load answered days");
        }
        const data = (await res.json()) as AnswerRow[];
        if (validTemplateIds.length === 0) {
          setAnsweredDates({});
          return;
        }

        const templateIdSet = new Set(validTemplateIds);
        const counts: Record<string, Set<string>> = {};
        const statusMap: Record<string, DayStatus> = {};

        data.forEach((ans) => {
          if (!ans.question_date) return;
          const templateId = ans.template_id;

          if (!templateId || !templateIdSet.has(templateId)) {
            // We saw some activity for this date, but we can't match it to active questions.
            // Treat as partial so the user knows the day needs attention.
            statusMap[ans.question_date] = "partial";
            return;
          }

          if (!counts[ans.question_date]) counts[ans.question_date] = new Set<string>();
          counts[ans.question_date]!.add(templateId);
        });

        Object.entries(counts).forEach(([dateKey, templateSet]) => {
          statusMap[dateKey] = templateSet.size >= validTemplateIds.length ? "full" : "partial";
        });

        setAnsweredDates(statusMap);
      } catch (error) {
        setError("Could not load calendar status.");
        setAnsweredDates({});
      } finally {
        setLoadingMonth(false);
      }
    },
    [validTemplateIds],
  );

  useEffect(() => {
    fetchExistingAnswers(selectedDate);
  }, [selectedDate, fetchExistingAnswers]);

  useEffect(() => {
    fetchAnsweredDays(currentMonth);
  }, [currentMonth, fetchAnsweredDays]);

  const saveAnswers = useCallback(
    async ({
      auto = false,
      targetDate,
      currentValues,
    }: {
      auto?: boolean;
      targetDate?: string;
      currentValues?: Record<string, AnswerValue>;
    } = {}) => {
      const dateToSave = targetDate ?? selectedDate;
      const valuesToUse = currentValues ?? values;

      if (!dateToSave) {
        if (!auto) setError("Pick a date first.");
        return;
      }
      if (validUserQuestions.length === 0) {
        if (!auto) setError("No questions to save. Add questions in the dashboard first.");
        return;
      }
      if (saving) return;

      if (!auto) setError(null);
      setSaving(true);

      const payload = validUserQuestions.map((uq) => {
        const template = uq.template;
        return {
          template_id: uq.template_id,
          type: template.answer_types?.type ?? "text",
          value: valuesToUse[uq.template_id],
          prompt_snapshot: template.title,
          category_snapshot: template.categories?.name,
        };
      });

      const res = await fetch("/api/answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_date: dateToSave, answers: payload }),
      });

      let data: { error?: string } | null = null;
      try {
        data = (await res.json()) as { error?: string } | null;
      } catch {
        data = null;
      }

      setSaving(false);
      if (!res.ok) {
        setHasUserEdited(true);
        setError(auto ? data?.error ? `Auto-save failed: ${data.error}` : "Auto-save failed" : data?.error || "Could not save");
        return;
      }

      setHasUserEdited(false);
      setLastSavedValues(valuesToUse);
      const status = computeDayStatus(valuesToUse);
      setAnsweredDates((prev) => {
        if (!status) {
          const { [dateToSave]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [dateToSave]: status };
      });
      setError(null);
    },
    [selectedDate, values, saving, computeDayStatus, validUserQuestions],
  );

  useEffect(() => {
    if (!hasUserEdited) return;
    if (loadingExisting) return;
    if (saving) return;
    if (validUserQuestions.length === 0) return;
    const timer = setTimeout(() => {
      void saveAnswers({ auto: true, targetDate: selectedDate, currentValues: values });
    }, 800);
    return () => clearTimeout(timer);
  }, [values, hasUserEdited, saveAnswers, selectedDate, loadingExisting, validUserQuestions.length, saving]);

  const getStatusMeta = (templateId: string) => {
    const current = values[templateId] ?? null;
    const saved = lastSavedValues[templateId] ?? null;
    const differs = JSON.stringify(current) !== JSON.stringify(saved);

    if (saving && differs) {
      return { label: "Saving…", tone: "info" as const };
    }
    if (differs) {
      return { label: "Unsaved changes", tone: "warn" as const };
    }
    return { label: "Saved", tone: "success" as const };
  };

  const statusToneClass = {
    success: "bg-emerald-100 text-emerald-800 border border-emerald-200",
    warn: "bg-amber-100 text-amber-800 border border-amber-200",
    info: "bg-blue-100 text-blue-800 border border-blue-200",
  };

  const statusDotClass = {
    success: "bg-emerald-500",
    warn: "bg-amber-500",
    info: "bg-blue-500",
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const weeks: ReactElement[] = [];
  let day = calendarStart;
  let weekIndex = 0;
  while (day <= calendarEnd) {
    const days: ReactElement[] = [];
    for (let i = 0; i < 7; i += 1) {
      const cellDate = day;
      const dayString = format(cellDate, "yyyy-MM-dd");
      const isDisabledFuture = isAfter(cellDate, todayDate);
      const isSelected = isSameDay(cellDate, selectedDateObj);
      const isToday = isSameDay(cellDate, todayDate);
      const inactiveMonth = !isSameMonth(cellDate, currentMonth);
      const dayStatus = answeredDates[dayString];
      const hasAnswers = !!dayStatus;

      const classes = [
        "flex flex-col items-center gap-1 rounded-md border p-2 text-sm transition",
        isSelected ? "border-[#7c5cff] bg-[#f6f1ff] ring-2 ring-[#7c5cff]/30" : "border-gray-200 bg-white",
        inactiveMonth ? "text-gray-400" : "text-gray-800",
        isDisabledFuture ? "cursor-not-allowed bg-gray-50 opacity-60" : "cursor-pointer hover:border-gray-400",
      ];
      if (isToday) classes.push("font-semibold text-[#7c5cff]");

      const handleSelect = async () => {
        if (isDisabledFuture) return;
        if (hasUserEdited) {
          await saveAnswers({ auto: true, targetDate: selectedDate, currentValues: values });
        }
        setSelectedDate(dayString);
        setCurrentMonth(cellDate);
      };

      days.push(
        <button
          type="button"
          key={dayString}
          aria-pressed={isSelected}
          aria-disabled={isDisabledFuture}
          onClick={handleSelect}
          disabled={isDisabledFuture}
          className={classes.join(" ")}
        >
          <span>{format(cellDate, "d")}</span>
          {isToday ? <span className="text-[10px] font-semibold text-[#7c5cff]">Today</span> : null}
          {hasAnswers ? (
            <span
              className={`h-2 w-2 rounded-full ${dayStatus === "full" ? "bg-emerald-500" : "bg-amber-500"}`}
              aria-label={dayStatus === "full" ? "All questions answered" : "Partially answered"}
            />
          ) : (
            <span className="h-2 w-2" />
          )}
        </button>,
      );

      day = addDays(cellDate, 1);
    }
    weeks.push(
      <div key={`week-${weekIndex}`} className="grid grid-cols-7 gap-2">
        {days}
      </div>,
    );
    weekIndex += 1;
  }

  return (
    <section className="bujo-card bujo-torn">
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Journal date</p>
              <p className="text-sm text-gray-700">
                Calendar shows today highlighted. Future days are disabled. Green dots mark days with all answers saved; orange dots mark partially answered days.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="bujo-btn-secondary px-3 py-1 text-xs"
                onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
              >
                ← Prev
              </button>
              <div className="text-sm font-semibold text-gray-900">{format(currentMonth, "MMMM yyyy")}</div>
              <button
                type="button"
                className="bujo-btn-secondary px-3 py-1 text-xs disabled:opacity-40"
                disabled={!canGoNextMonth}
                onClick={() => {
                  if (canGoNextMonth) setCurrentMonth(addMonths(currentMonth, 1));
                }}
              >
                Next →
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[520px] space-y-2">
              <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                {weekdayLabels.map((d) => (
                  <div key={d} className="py-1">
                    {d}
                  </div>
                ))}
              </div>
              <div className="space-y-2">{weeks}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#7c5cff]" />
              <span>Today</span>
              <span className="ml-3 h-2 w-2 rounded-full bg-emerald-500" />
              <span>Answered</span>
              <span className="ml-3 h-2 w-2 rounded-full bg-amber-500" />
              <span>Partially answered</span>
            </div>
            <span className="font-semibold text-gray-800">
              Selected: {format(selectedDateObj, "MMMM d, yyyy")}
            </span>
          </div>
          {loadingMonth && <p className="text-xs text-gray-600">Updating calendar…</p>}
          {loadingExisting && <p className="text-sm text-gray-600">Loading saved answers for that date…</p>}
        </div>
        {validUserQuestions.map((uq) => {
          const t = uq.template;
          const prompt = uq.custom_label || t.title;
          const isWaterQuestion = (t.title ?? "").trim().toLowerCase() === "how many cups of water?";
          const status = getStatusMeta(uq.template_id);
        const numericValue = values[uq.template_id];
        const numberInputValue = typeof numericValue === "number" ? numericValue : "";
          const questionClassName = isWaterQuestion
            ? "doodle-border space-y-3 bg-[var(--bujo-paper)] p-4"
            : "bujo-question space-y-3";
          return (
            <div key={uq.id} className={questionClassName}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900">
                  {prompt}
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-2 py-0.5 ${statusToneClass[status.tone]}`}
                  >
                    <span className={`h-2 w-2 rounded-full ${statusDotClass[status.tone]}`} />
                    {status.label}
                  </span>
                  <span className="bujo-tag">{t.answer_types?.type ?? "unknown"}</span>
                  {t.categories?.name ? (
                    <span className="bujo-tag">{t.categories.name}</span>
                  ) : null}
                </div>
              </div>
              {t.answer_types?.type === "boolean" && (
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-800">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`bool-${uq.template_id}`}
                      className="h-4 w-4 accent-[#7c5cff]"
                      checked={values[uq.template_id] === true}
                      onChange={() => setValue(uq.template_id, true)}
                    />
                    Yes
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`bool-${uq.template_id}`}
                      className="h-4 w-4 accent-[#7c5cff]"
                      checked={values[uq.template_id] === false}
                      onChange={() => setValue(uq.template_id, false)}
                    />
                    No
                  </label>
                </div>
              )}
              {t.answer_types?.type === "number" && (
                <input
                  type="number"
                  className={isWaterQuestion ? "w-full px-3 py-2" : "bujo-input"}
                  value={numberInputValue}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setValue(uq.template_id, raw === "" ? null : Number(raw));
                  }}
                />
              )}
              {t.answer_types?.type === "scale" && (
                <div className="flex flex-wrap items-center gap-3">
                  {(() => {
                    const meta = (t.answer_types?.meta as Record<string, unknown>) || {};
                    const min = typeof meta.min === "number" ? meta.min : 1;
                    const max = typeof meta.max === "number" ? meta.max : 5;
                    const currentValue =
                      typeof values[uq.template_id] === "number" ? Number(values[uq.template_id]) : min;
                    return (
                      <>
                        <input
                          type="range"
                          min={min}
                          max={max}
                          value={currentValue}
                          onChange={(e) => setValue(uq.template_id, Number(e.target.value))}
                          className="bujo-range w-full"
                        />
                        <span className="text-sm font-semibold text-gray-800">
                          {currentValue}
                        </span>
                      </>
                    );
                  })()}
                </div>
              )}
              {t.answer_types?.type === "emoji" && (
                <select
                  className="bujo-input"
                  value={typeof values[uq.template_id] === "string" ? String(values[uq.template_id]) : ""}
                  onChange={(e) => setValue(uq.template_id, e.target.value)}
                >
                  <option value="" disabled>
                    Select
                  </option>
                  {(() => {
                    const items = t.answer_types?.items;
                    const meta = (t.answer_types?.meta as Record<string, unknown>) || {};
                    const emojiSetRaw = (meta as Record<string, unknown>)["emoji_set"];
                    const emojiSet = Array.isArray(emojiSetRaw)
                      ? emojiSetRaw.map((e) => String(e))
                      : null;
                    const options = emojiSet ?? (items && items.length > 0 ? items : ["😀", "🙂", "😐", "😞", "😡"]);
                    return options.map((emoji) => (
                      <option key={emoji} value={emoji}>
                        {emoji}
                      </option>
                    ));
                  })()}
                </select>
              )}
              {t.answer_types?.type === "text" && (
                <textarea
                  className="bujo-input"
                  rows={3}
                  value={typeof values[uq.template_id] === "string" ? String(values[uq.template_id]) : ""}
                  onChange={(e) => setValue(uq.template_id, e.target.value)}
                />
              )}
              {t.answer_types?.type === "yes_no_list" && (() => {
                const answerType = t.answer_types;
                if (!answerType) {
                  return (
                    <p className="text-sm text-red-600">
                      Answer type not configured. Please contact an admin.
                    </p>
                  );
                }
                const items = Array.isArray(answerType.items) ? answerType.items : [];
                const currentValue = values[uq.template_id];
                const isYes = Array.isArray(currentValue);
                const isNo = currentValue === false;
                const booleanArray = Array.isArray(currentValue) ? currentValue : [];

                return (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-800">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`yesno-${uq.template_id}`}
                          className="h-4 w-4 accent-[#7c5cff]"
                          checked={isYes}
                          onChange={() => {
                            // Initialize with all false values
                            setValue(uq.template_id, new Array(items.length).fill(false));
                          }}
                        />
                        Yes
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`yesno-${uq.template_id}`}
                          className="h-4 w-4 accent-[#7c5cff]"
                          checked={isNo}
                          onChange={() => setValue(uq.template_id, false)}
                        />
                        No
                      </label>
                    </div>
                    {isYes && (
                      <div className="space-y-2 rounded-md border border-[var(--bujo-border)] bg-[var(--bujo-paper)] p-3">
                        {items.map((item, index) => (
                          <label key={index} className="flex items-center gap-2 text-sm text-gray-800">
                            <input
                              type="checkbox"
                              checked={booleanArray[index] === true}
                              onChange={(e) => {
                                const newArray = [...booleanArray];
                                // Ensure array is long enough
                                while (newArray.length <= index) {
                                  newArray.push(false);
                                }
                                newArray[index] = e.target.checked;
                                setValue(uq.template_id, newArray);
                              }}
                              className="h-4 w-4 accent-[#7c5cff]"
                            />
                            {item}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })}
        {userQuestions.length === 0 && (
          <p className="bujo-note text-sm text-gray-700">
            You have no questions yet. Add some from the dashboard.
          </p>
        )}
        {userQuestions.length > 0 && validUserQuestions.length === 0 && (
          <p className="bujo-note text-sm text-red-800">
            Your saved questions reference missing templates. Re-add them from the dashboard.
          </p>
        )}
        {error && <p className="bujo-message text-sm text-red-700">{error}</p>}
      </div>
    </section>
  );
}
