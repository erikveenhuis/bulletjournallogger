"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { AnswerType, Category, DisplayOption, QuestionTemplate } from "@/lib/types";
import PreviewSection from "./preview-section";
import StepListEditor from "@/components/step-list-editor";

const defaultSteps = ["1", "2", "3", "4", "5"];

const normalizeSteps = (steps: string[]) =>
  steps.map((step) => step.trim()).filter((step) => step.length > 0);

const stepsFromMeta = (meta: Record<string, unknown> | null | undefined) => {
  const raw = meta?.steps;
  if (!Array.isArray(raw)) return [];
  return raw.map((step) => String(step));
};

type Props = {
  mode: "create" | "edit";
  initialData?: QuestionTemplate;
  categories: Category[];
  answerTypes: AnswerType[];
};

export default function QuestionForm({ mode, initialData, categories, answerTypes }: Props) {
  const router = useRouter();
  const scope = "global";
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [categoryId, setCategoryId] = useState(initialData?.category_id ?? "");
  const [answerTypeId, setAnswerTypeId] = useState(initialData?.answer_type_id ?? "");
  const [unit, setUnit] = useState(() =>
    typeof initialData?.meta?.unit === "string" ? initialData.meta.unit : "",
  );
  const [steps, setSteps] = useState(() => {
    const initialSteps = stepsFromMeta(initialData?.meta);
    if (initialSteps.length > 0) return initialSteps;
    const initialAnswerType = answerTypes.find((at) => at.id === initialData?.answer_type_id);
    if (initialAnswerType?.type === "single_choice" || initialAnswerType?.type === "multi_choice") {
      return defaultSteps;
    }
    return [];
  });
  const [isActive, setIsActive] = useState(initialData?.is_active ?? true);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedAnswerTypes = useMemo(() => {
    if (!answerTypeId) return [];
    return answerTypes.filter((at) => at.id === answerTypeId);
  }, [answerTypes, answerTypeId]);

  const selectedAnswerType = selectedAnswerTypes[0];
  const isChoiceType =
    selectedAnswerType?.type === "single_choice" || selectedAnswerType?.type === "multi_choice";
  const isNumberType = selectedAnswerType?.type === "number";


  const displayDefaults = useMemo(() => {
    const selected = selectedAnswerTypes[0];
    const defaultDisplay = (selected?.default_display_option as DisplayOption) || "graph";
    const allowed = Array.isArray(selected?.allowed_display_options) ? selected?.allowed_display_options : [];
    const normalized = allowed.length > 0 ? allowed : [defaultDisplay];
    return {
      defaultDisplayOption: defaultDisplay,
      allowedDisplayOptions: normalized.includes(defaultDisplay) ? normalized : [...normalized, defaultDisplay],
    };
  }, [selectedAnswerTypes]);

  const submit = async () => {
    setMessage(null);
    if (!title.trim()) {
      setMessage("Title is required");
      return;
    }
    if (!answerTypeId) {
      setMessage("Answer type is required");
      return;
    }

    let metaJson: Record<string, unknown> = {};
    if (isChoiceType) {
      const normalized = normalizeSteps(steps);
      const resolvedSteps = normalized.length > 0 ? normalized : defaultSteps;
      if (resolvedSteps.length < 2) {
        setMessage("Provide at least two options for choice questions.");
        return;
      }
      metaJson = { steps: resolvedSteps };
    } else if (isNumberType) {
      const trimmed = unit.trim();
      if (trimmed) {
        metaJson = { unit: trimmed };
      }
    }

    setSubmitting(true);
    const res = await fetch("/api/question-templates", {
      method: mode === "create" ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(mode === "edit" && initialData?.id ? { id: initialData.id } : {}),
        title: title.trim(),
        category_id: categoryId || null,
        meta: metaJson,
        is_active: mode === "edit" ? isActive : true,
        answer_type_id: answerTypeId,
        scope,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || `Could not ${mode === "create" ? "add" : "update"} question`);
      setSubmitting(false);
      return;
    }

    router.push("/admin/questions");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="bujo-card bujo-torn">
        <h2 className="text-lg font-semibold text-[var(--bujo-ink)]">
          {mode === "create" ? "Add question" : "Edit question"}
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <label className="space-y-1 text-sm text-[var(--bujo-ink)]">
              <span className="font-medium">Question prompt</span>
              <input
                placeholder="e.g. How did today feel?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bujo-input"
              />
              <span className="text-xs text-[var(--bujo-subtle)]">What the user will see and answer.</span>
            </label>
            <label className="space-y-1 text-sm text-[var(--bujo-ink)]">
              <span className="font-medium">Category</span>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="bujo-input"
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <span className="text-xs text-[var(--bujo-subtle)]">Groups the question in admin and user views.</span>
            </label>
            <label className="space-y-1 text-sm text-[var(--bujo-ink)]">
              <span className="font-medium">Answer type</span>
              <select
                value={answerTypeId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setAnswerTypeId(nextId);
                  const nextType = answerTypes.find((at) => at.id === nextId)?.type;
                  if ((nextType === "single_choice" || nextType === "multi_choice") && steps.length === 0) {
                    setSteps(defaultSteps);
                  }
                }}
                className="bujo-input"
              >
                <option value="">Select answer type (required)</option>
                {answerTypes.map((at) => {
                  const isInactive = at.is_active === false;
                  const isSelected = at.id === answerTypeId;
                  return (
                    <option key={at.id} value={at.id} disabled={isInactive && !isSelected}>
                      {at.name} ({at.type}){isInactive ? " (inactive)" : ""}
                    </option>
                  );
                })}
              </select>
              <span className="text-xs text-[var(--bujo-subtle)]">
                Controls the input widget and preview behavior.
              </span>
            </label>
            {mode === "edit" && (
              <label className="flex items-center gap-2 text-sm text-[var(--bujo-ink)]">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="bujo-range"
                />
                Active
              </label>
            )}
          </div>
          <div className="space-y-2">
            {isChoiceType && (
              <StepListEditor
                steps={steps}
                onChange={setSteps}
                label="Choice options"
                helperText="Add at least two options. Drag to reorder."
              />
            )}
            {isNumberType && (
              <label className="space-y-1 text-sm text-[var(--bujo-ink)]">
                <span className="font-medium">Unit</span>
                <input
                  placeholder="e.g. cups, steps"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="bujo-input"
                />
                <span className="text-xs text-[var(--bujo-subtle)]">
                  Optional label used in Insights.
                </span>
              </label>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={submit}
                className="bujo-btn text-sm"
                disabled={submitting}
              >
                {submitting ? "Saving..." : mode === "create" ? "Add question" : "Save changes"}
              </button>
              <button
                type="button"
                className="bujo-btn-secondary text-sm"
                onClick={() => router.push("/admin/questions")}
                disabled={submitting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
        {message && <p className="bujo-message mt-3 text-sm">{message}</p>}
      </div>

      {mode === "edit" && answerTypeId && selectedAnswerTypes.length > 0 && (
        <PreviewSection
          questionTitle={title || "Preview Question"}
          answerTypes={selectedAnswerTypes}
          displayOptions={displayDefaults.allowedDisplayOptions}
          defaultDisplayOption={displayDefaults.defaultDisplayOption}
          answerTypeId={answerTypeId}
        />
      )}
    </div>
  );
}
