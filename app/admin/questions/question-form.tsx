"use client";

import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import type { AnswerType, Category, DisplayOption, QuestionTemplate } from "@/lib/types";
import PreviewSection from "./preview-section";

type Props = {
  mode: "create" | "edit";
  initialData?: QuestionTemplate;
  categories: Category[];
  answerTypes: AnswerType[];
};

export default function QuestionForm({ mode, initialData, categories, answerTypes }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [categoryId, setCategoryId] = useState(initialData?.category_id ?? "");
  const [answerTypeId, setAnswerTypeId] = useState(initialData?.answer_type_id ?? "");
  const [meta, setMeta] = useState(() => JSON.stringify(initialData?.meta ?? {}));
  const [isActive, setIsActive] = useState(initialData?.is_active ?? true);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedAnswerTypes = useMemo(() => {
    if (!answerTypeId) return [];
    return answerTypes.filter((at) => at.id === answerTypeId);
  }, [answerTypes, answerTypeId]);

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
    try {
      metaJson = JSON.parse(meta || "{}");
    } catch {
      setMessage("Meta must be valid JSON");
      return;
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
                  setAnswerTypeId(e.target.value);
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
            <label className="space-y-1 text-sm text-[var(--bujo-ink)]">
              <span className="font-medium">Meta JSON</span>
              <textarea
                placeholder='e.g. {"min":0,"max":10}'
                value={meta}
                onChange={(e) => setMeta(e.target.value)}
                rows={5}
                className="bujo-input"
              />
              <span className="text-xs text-[var(--bujo-subtle)]">
                Per-question settings consumed by the answer type.
              </span>
            </label>
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
