"use client";

import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import ConfirmDialog from "@/components/confirm-dialog";
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
  accountTier: number;
};

type AnswerValue = string | number | boolean | string[] | null;

type AnswerRow = {
  template_id: string;
  question_date: string;
  bool_value: boolean | null;
  number_value: number | null;
  scale_value: number | null;
  text_value: string | null;
  answer_types?:
    | {
        type?: string | null;
        meta?: Record<string, unknown> | null;
        items?: string[] | null;
      }
    | null;
  question_templates?:
    | {
        id?: string;
        title?: string;
        answer_types?: {
          type?: string | null;
          meta?: Record<string, unknown> | null;
          items?: string[] | null;
        } | null;
      }
    | null;
};

type DayStatus = "full" | "partial";

export default function JournalForm({ date, userQuestions, accountTier }: Props) {
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
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description?: string;
    onConfirm: () => void;
  } | null>(null);

  // Only work with questions that still have an attached template (can be null if deleted).
  const validUserQuestions = useMemo(
    () =>
      userQuestions.filter(
        (uq): uq is UserQuestion & { template: NonNullable<UserQuestion["template"]> } => !!uq.template,
      ),
    [userQuestions],
  );

  const filteredUserQuestions = useMemo(() => {
    let filtered = [...validUserQuestions];
    if (accountTier < 3) {
      filtered = filtered.filter((uq) => !uq.template.created_by || uq.template.created_by !== uq.user_id);
    }
    return filtered;
  }, [accountTier, validUserQuestions]);

  const eligibleUserQuestions = useMemo(() => {
    if (accountTier === 0) {
      return filteredUserQuestions.slice(0, 3);
    }
    return filteredUserQuestions;
  }, [accountTier, filteredUserQuestions]);

  const freeTierLockedQuestions = useMemo(() => {
    if (accountTier !== 0) return [];
    return filteredUserQuestions.slice(3);
  }, [accountTier, filteredUserQuestions]);

  const validTemplateIds = useMemo(
    () => eligibleUserQuestions.map((uq) => uq.template_id),
    [eligibleUserQuestions],
  );

  const getAnswerTypeForQuestion = (uq: UserQuestion & { template: NonNullable<UserQuestion["template"]> }) =>
    uq.template.answer_types;

  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const defaultChoiceSteps = ["1", "2", "3", "4", "5"];
  const maxTextLength = 120;
  const selectedDateObj = selectedDate ? parseISO(selectedDate) : todayDate;
  const canGoNextMonth = !isAfter(startOfMonth(addMonths(currentMonth, 1)), todayDate);

  const isEmojiOnly = (value: string) => {
    const cleaned = value.replace(/\s+/g, "");
    if (!cleaned) return false;
    return /^[\p{Extended_Pictographic}\uFE0F\u200D\u{1F3FB}-\u{1F3FF}]+$/u.test(cleaned);
  };

  const getChoiceSteps = (meta?: Record<string, unknown> | null) => {
    const rawSteps = meta?.steps;
    if (Array.isArray(rawSteps)) {
      const normalized = rawSteps.map((step) => String(step).trim()).filter((step) => step.length > 0);
      if (normalized.length >= 2) return normalized;
    }
    return defaultChoiceSteps;
  };

  const setValue = (id: string, value: AnswerValue) => {
    setHasUserEdited(true);
    setValues((prev) => ({ ...prev, [id]: value }));
  };

  const isValueAnswered = (value: AnswerValue) => {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
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
          // Check for multi-choice entries that are stored as JSON arrays
          const answerType =
            ans.answer_types?.type ??
            ans.question_templates?.answer_types?.type;
          if (answerType === "multi_choice") {
            if (ans.text_value === null || ans.text_value === undefined) {
              map[ans.template_id] = null;
              return;
            }
            try {
              const parsed = JSON.parse(ans.text_value);
              if (Array.isArray(parsed)) {
                map[ans.template_id] = parsed.map((val) => String(val)).filter((val) => val.length > 0);
                return;
              }
            } catch {
              map[ans.template_id] = null;
              return;
            }
          }
          if (answerType === "single_choice") {
            if (ans.text_value !== null && ans.text_value !== undefined) {
              map[ans.template_id] = ans.text_value;
              return;
            }
            if (ans.scale_value !== null && ans.scale_value !== undefined) {
              map[ans.template_id] = String(ans.scale_value);
              return;
            }
          }
          if (answerType === "text") {
            if (ans.text_value !== null && ans.text_value !== undefined) {
              map[ans.template_id] = ans.text_value;
              return;
            }
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
          if (ans.text_value !== null && ans.text_value !== undefined) {
            map[ans.template_id] = ans.text_value;
          }
        });
        setValues(map);
        setLastSavedValues(map);
        setHasUserEdited(false);
      } catch {
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

          // Only count this as answered if it has a meaningful value
          const hasValue =
            (ans.bool_value !== null && ans.bool_value !== undefined) ||
            (ans.number_value !== null && ans.number_value !== undefined) ||
            (ans.scale_value !== null && ans.scale_value !== undefined) ||
            (ans.text_value !== null && ans.text_value !== undefined && ans.text_value.trim() !== "");


          if (hasValue) {
            if (!counts[ans.question_date]) counts[ans.question_date] = new Set<string>();
            counts[ans.question_date]!.add(templateId);
          }
        });

        Object.entries(counts).forEach(([dateKey, templateSet]) => {
          statusMap[dateKey] = templateSet.size >= validTemplateIds.length ? "full" : "partial";
        });
        setAnsweredDates(statusMap);
      } catch {
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
      if (eligibleUserQuestions.length === 0) {
        if (!auto) setError("No questions to save. Add questions in your profile first.");
        return;
      }
      if (saving) return;

      if (!auto) setError(null);
      setSaving(true);

      const payload = eligibleUserQuestions.map((uq) => {
        const template = uq.template;
        const answerType = getAnswerTypeForQuestion(uq);
        const answerTypeId = uq.template.answer_type_id;
        return {
          template_id: uq.template_id,
          type: answerType?.type ?? "text",
          answer_type_id: answerTypeId,
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
          const next = { ...prev };
          delete next[dateToSave];
          return next;
        }
        return { ...prev, [dateToSave]: status };
      });
      setError(null);
    },
    [selectedDate, values, saving, computeDayStatus, eligibleUserQuestions],
  );

  const handleClearAllAnswers = useCallback(async () => {
    if (!selectedDate) return;

    const performClearAll = async () => {
      setSaving(true);
      setError(null);
      try {
        const params = new URLSearchParams({ question_date: selectedDate });
        const res = await fetch(`/api/answers?${params.toString()}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to clear answers");
        }

        // Clear local state
        const clearedValues: Record<string, AnswerValue> = {};
        validTemplateIds.forEach((templateId) => {
          clearedValues[templateId] = null;
        });
        setValues(clearedValues);
        setLastSavedValues(clearedValues);
        setHasUserEdited(false);

        // Update calendar status
        setAnsweredDates((prev) => {
          const next = { ...prev };
          delete next[selectedDate];
          return next;
        });
      } catch (error) {
        setError(error instanceof Error ? error.message : "Failed to clear answers");
      } finally {
        setSaving(false);
        setConfirmDialog(null);
      }
    };

    setConfirmDialog({
      open: true,
      title: "Clear All Answers",
      description: `Are you sure you want to clear all answers for ${format(selectedDateObj, "MMMM d, yyyy")}? This action cannot be undone.`,
      onConfirm: performClearAll,
    });
  }, [selectedDate, selectedDateObj, validTemplateIds]);

  const handleClearSingleAnswer = useCallback(async (templateId: string) => {
    if (!selectedDate) return;

    const performClearSingle = async () => {
      setSaving(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          question_date: selectedDate,
          template_id: templateId
        });
        const res = await fetch(`/api/answers?${params.toString()}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to clear answer");
        }

        // Update local state for this specific answer
        const newValues = { ...values, [templateId]: null };
        setValues(newValues);
        setLastSavedValues({ ...lastSavedValues, [templateId]: null });
        setHasUserEdited(false);

        // Update calendar status
        const newDayStatus = computeDayStatus(newValues);
        setAnsweredDates((prev) => {
          if (!newDayStatus) {
            const next = { ...prev };
            delete next[selectedDate];
            return next;
          }
          return { ...prev, [selectedDate]: newDayStatus };
        });
      } catch (error) {
        setError(error instanceof Error ? error.message : "Failed to clear answer");
      } finally {
        setSaving(false);
        setConfirmDialog(null);
      }
    };

    const questionTitle = validUserQuestions.find(uq => uq.template_id === templateId)?.template?.title || "this question";
    setConfirmDialog({
      open: true,
      title: "Clear Answer",
      description: `Are you sure you want to clear the answer for "${questionTitle}"? This action cannot be undone.`,
      onConfirm: performClearSingle,
    });
  }, [selectedDate, values, lastSavedValues, computeDayStatus, validUserQuestions]);

  useEffect(() => {
    if (!hasUserEdited) return;
    if (loadingExisting) return;
    if (saving) return;
    if (eligibleUserQuestions.length === 0) return;
    const timer = setTimeout(() => {
      void saveAnswers({ auto: true, targetDate: selectedDate, currentValues: values });
    }, 800);
    return () => clearTimeout(timer);
  }, [values, hasUserEdited, saveAnswers, selectedDate, loadingExisting, eligibleUserQuestions.length, saving]);

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
    // Only show "Saved" if the question has been answered
    if (isValueAnswered(saved)) {
      return { label: "Saved", tone: "success" as const };
    }
    // Return null for unanswered questions to hide the status indicator
    return null;
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
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleClearAllAnswers}
                disabled={saving || loadingExisting}
                className="bujo-btn-secondary px-3 py-1 text-xs disabled:opacity-50"
              >
                Clear All
              </button>
              <span className="font-semibold text-gray-800">
                Selected: {format(selectedDateObj, "MMMM d, yyyy")}
              </span>
            </div>
          </div>
          {loadingMonth && <p className="text-xs text-gray-600">Updating calendar…</p>}
          {loadingExisting && <p className="text-sm text-gray-600">Loading saved answers for that date…</p>}
        </div>
        {eligibleUserQuestions.map((uq) => {
          const t = uq.template;
          const prompt = uq.custom_label || t.title;
          const isWaterQuestion = (t.title ?? "").trim().toLowerCase() === "how many cups of water?";
          const status = getStatusMeta(uq.template_id);
          const answerType = getAnswerTypeForQuestion(uq);
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
                  {status && (
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-2 py-0.5 ${statusToneClass[status.tone]}`}
                    >
                      <span className={`h-2 w-2 rounded-full ${statusDotClass[status.tone]}`} />
                      {status.label}
                    </span>
                  )}
                  {isValueAnswered(values[uq.template_id]) && (
                    <button
                      type="button"
                      onClick={() => handleClearSingleAnswer(uq.template_id)}
                      disabled={saving}
                      className="bujo-btn-secondary px-2 py-0.5 text-xs disabled:opacity-50"
                    >
                      Clear
                    </button>
                  )}
                  <span className="bujo-tag">{answerType?.type ?? "unknown"}</span>
                  {t.categories?.name ? (
                    <span className="bujo-tag">{t.categories.name}</span>
                  ) : null}
                </div>
              </div>
              {answerType?.type === "boolean" && (
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-800">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`bool-${uq.template_id}`}
                      className="h-4 w-4 accent-[#7c5cff]"
                      checked={values[uq.template_id] === true}
                      onChange={() => setValue(uq.template_id, true)}
                    />
                    <span>&nbsp;Yes</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`bool-${uq.template_id}`}
                      className="h-4 w-4 accent-[#7c5cff]"
                      checked={values[uq.template_id] === false}
                      onChange={() => setValue(uq.template_id, false)}
                    />
                    <span>&nbsp;No</span>
                  </label>
                </div>
              )}
              {answerType?.type === "number" && (
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
              {(answerType?.type === "single_choice" || answerType?.type === "multi_choice") && (() => {
                const steps = getChoiceSteps(uq.template.meta as Record<string, unknown> | null);
                const currentValue = values[uq.template_id];
                const selectedItems = Array.isArray(currentValue) ? currentValue : [];
                const selectedValue = typeof currentValue === "string" ? currentValue : "";
                if (answerType?.type === "single_choice") {
                  return (
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-800">
                      {steps.map((step) => (
                        <label key={step} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`single-${uq.template_id}`}
                            className="h-4 w-4 accent-[#7c5cff]"
                            checked={selectedValue === step}
                            onChange={() => setValue(uq.template_id, step)}
                          />
                          <span
                            className="bujo-emoji-value"
                            data-emoji-only={isEmojiOnly(step) ? "true" : "false"}
                          >
                            &nbsp;{step}
                          </span>
                        </label>
                      ))}
                    </div>
                  );
                }
                return (
                  <div className="flex w-full flex-wrap gap-x-6 gap-y-2 rounded-md border border-[var(--bujo-border)] bg-[var(--bujo-paper)] p-3">
                    {steps.map((step) => (
                      <label
                        key={step}
                        className="inline-flex min-w-[220px] flex-1 items-start gap-4 pr-4 text-sm text-gray-800"
                      >
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(step)}
                          onChange={(e) => {
                            const next = new Set(selectedItems);
                            if (e.target.checked) {
                              next.add(step);
                            } else {
                              next.delete(step);
                            }
                            setValue(uq.template_id, Array.from(next));
                          }}
                          className="h-4 w-4 accent-[#7c5cff]"
                        />
                        <span
                          className="bujo-emoji-value leading-snug break-words"
                          data-emoji-only={isEmojiOnly(step) ? "true" : "false"}
                        >
                          &nbsp;{step}
                        </span>
                      </label>
                    ))}
                  </div>
                );
              })()}
              {answerType?.type === "text" && (
                <div className="space-y-2">
                  {(() => {
                    const rawValue =
                      typeof values[uq.template_id] === "string" ? String(values[uq.template_id]) : "";
                    const safeValue = rawValue.slice(0, maxTextLength);
                    const remaining = maxTextLength - safeValue.length;
                    return (
                      <>
                        <textarea
                          className="bujo-input"
                          rows={3}
                          maxLength={maxTextLength}
                          value={safeValue}
                          onChange={(e) => setValue(uq.template_id, e.target.value.slice(0, maxTextLength))}
                        />
                        <p className="text-xs text-[var(--bujo-subtle)]">
                          {remaining} characters left
                        </p>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}
        {userQuestions.length === 0 && (
          <p className="bujo-note text-sm text-gray-700">
            You have no questions yet. Add some from your profile.
          </p>
        )}
        {userQuestions.length > 0 && validUserQuestions.length === 0 && (
          <p className="bujo-note text-sm text-red-800">
            Your saved questions reference missing templates. Re-add them from your profile.
          </p>
        )}
        {accountTier < 3 &&
          validUserQuestions.some((uq) => uq.template?.created_by && uq.template.created_by === uq.user_id) && (
            <p className="bujo-note text-sm text-amber-800">
              Some custom questions are disabled on your current tier.{" "}
              <a href="/profile/account" className="underline">
                Upgrade your account
              </a>{" "}
              or remove them from My questions.
            </p>
          )}
        {accountTier === 0 && freeTierLockedQuestions.length > 0 && (
          <>
            <p className="bujo-note text-sm text-amber-800">
              Free tier answers only the first 3 questions in your list.{" "}
              <a href="/profile/account" className="underline">
                Upgrade your account
              </a>{" "}
              to answer more or adjust your list in{" "}
              <a href="/profile/questions" className="underline">
                My questions
              </a>
              .
            </p>
            {freeTierLockedQuestions.map((uq) => {
              const t = uq.template;
              const prompt = uq.custom_label || t.title;
              const answerType = getAnswerTypeForQuestion(uq);
              return (
                <div key={`locked-${uq.id}`} className="bujo-question space-y-3 opacity-60" aria-disabled="true">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900">
                      {prompt}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="bujo-tag">{answerType?.type ?? "unknown"}</span>
                      {t.categories?.name ? (
                        <span className="bujo-tag">{t.categories.name}</span>
                      ) : null}
                      <span className="bujo-tag">Locked on free tier</span>
                    </div>
                  </div>
                  {answerType?.type === "boolean" && (
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-800">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          disabled
                          className="h-4 w-4 accent-[#7c5cff]"
                        />
                        <span>&nbsp;Yes</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          disabled
                          className="h-4 w-4 accent-[#7c5cff]"
                        />
                        <span>&nbsp;No</span>
                      </label>
                    </div>
                  )}
                  {answerType?.type === "number" && (
                    <input
                      type="number"
                      className="bujo-input"
                      disabled
                      value=""
                      placeholder="Upgrade to answer"
                      readOnly
                    />
                  )}
                  {(answerType?.type === "single_choice" || answerType?.type === "multi_choice") && (() => {
                    const steps = getChoiceSteps(uq.template.meta as Record<string, unknown> | null);
                    if (answerType?.type === "single_choice") {
                      return (
                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-800">
                          {steps.map((step) => (
                            <label key={step} className="flex items-center gap-2">
                              <input type="radio" disabled className="h-4 w-4 accent-[#7c5cff]" />
                              <span
                                className="bujo-emoji-value"
                                data-emoji-only={isEmojiOnly(step) ? "true" : "false"}
                              >
                                &nbsp;{step}
                              </span>
                            </label>
                          ))}
                        </div>
                      );
                    }
                    return (
                      <div className="flex w-full flex-wrap gap-x-6 gap-y-2 rounded-md border border-[var(--bujo-border)] bg-[var(--bujo-paper)] p-3">
                        {steps.map((step) => (
                          <label
                            key={step}
                            className="inline-flex min-w-[220px] flex-1 items-start gap-4 pr-4 text-sm text-gray-800"
                          >
                            <input type="checkbox" disabled className="h-4 w-4 accent-[#7c5cff]" />
                            <span
                              className="bujo-emoji-value leading-snug break-words"
                              data-emoji-only={isEmojiOnly(step) ? "true" : "false"}
                            >
                              &nbsp;{step}
                            </span>
                          </label>
                        ))}
                      </div>
                    );
                  })()}
                  {answerType?.type === "text" && (
                    <textarea
                      className="bujo-input"
                      rows={3}
                      disabled
                      value=""
                      placeholder="Upgrade to answer"
                      readOnly
                    />
                  )}
                </div>
              );
            })}
          </>
        )}
        {error && <p className="bujo-message text-sm text-red-700">{error}</p>}
      </div>
      {confirmDialog && (
        <ConfirmDialog
          open={confirmDialog.open}
          title={confirmDialog.title}
          description={confirmDialog.description}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </section>
  );
}
