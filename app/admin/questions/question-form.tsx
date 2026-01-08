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

const displayOptions: DisplayOption[] = ["graph", "list", "grid", "count"];

export default function QuestionForm({ mode, initialData, categories, answerTypes }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [categoryId, setCategoryId] = useState(initialData?.category_id ?? "");
  const [answerTypeId, setAnswerTypeId] = useState(initialData?.answer_type_id ?? "");
  const [meta, setMeta] = useState(() => JSON.stringify(initialData?.meta ?? {}));
  const [allowedAnswerTypeIds, setAllowedAnswerTypeIds] = useState<string[]>(
    initialData?.allowed_answer_type_ids || [],
  );
  const [defaultDisplayOption, setDefaultDisplayOption] = useState<DisplayOption>(
    (initialData?.default_display_option as DisplayOption) || "graph",
  );
  const [allowedDisplayOptions, setAllowedDisplayOptions] = useState<DisplayOption[]>(
    (initialData?.allowed_display_options as DisplayOption[]) || ["graph"],
  );
  const [defaultColors, setDefaultColors] = useState(() =>
    JSON.stringify(initialData?.default_colors ?? {}),
  );
  const [isActive, setIsActive] = useState(initialData?.is_active ?? true);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const toggleAllowedAnswerType = (id: string) => {
    if (allowedAnswerTypeIds.includes(id)) {
      setAllowedAnswerTypeIds((prev) => prev.filter((val) => val !== id));
    } else {
      setAllowedAnswerTypeIds((prev) => [...prev, id]);
    }
  };

  const toggleDisplayOption = (value: DisplayOption) => {
    if (allowedDisplayOptions.includes(value)) {
      const next = allowedDisplayOptions.filter((v) => v !== value);
      setAllowedDisplayOptions(next.length === 0 ? [defaultDisplayOption] : next);
    } else {
      setAllowedDisplayOptions([...allowedDisplayOptions, value]);
    }
  };

  const normalizedAllowedTypes = useMemo(() => {
    if (!answerTypeId) return [];
    return Array.from(new Set([answerTypeId, ...allowedAnswerTypeIds.filter(Boolean)]));
  }, [answerTypeId, allowedAnswerTypeIds]);

  const normalizedDisplayOptions = useMemo(() => {
    return allowedDisplayOptions.length > 0
      ? Array.from(new Set([...allowedDisplayOptions, defaultDisplayOption]))
      : [defaultDisplayOption];
  }, [allowedDisplayOptions, defaultDisplayOption]);

  const selectedAnswerTypes = useMemo(() => {
    return answerTypes.filter((at) => normalizedAllowedTypes.includes(at.id));
  }, [answerTypes, normalizedAllowedTypes]);

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

    let parsedColors: Record<string, unknown> = {};
    if (defaultColors.trim()) {
      try {
        const parsed = JSON.parse(defaultColors);
        if (typeof parsed === "object" && !Array.isArray(parsed)) {
          parsedColors = parsed;
        }
      } catch {
        setMessage("Default colors must be valid JSON");
        return;
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
        allowed_answer_type_ids: normalizedAllowedTypes,
        default_display_option: defaultDisplayOption,
        allowed_display_options: normalizedDisplayOptions,
        default_colors: parsedColors,
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
            <input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bujo-input"
            />
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
            <select
              value={answerTypeId}
              onChange={(e) => {
                const newAnswerTypeId = e.target.value;
                setAnswerTypeId(newAnswerTypeId);
                // Ensure the new answer type is included in allowed types
                if (newAnswerTypeId && !normalizedAllowedTypes.includes(newAnswerTypeId)) {
                  setAllowedAnswerTypeIds((prev) => [...prev, newAnswerTypeId]);
                }
              }}
              className="bujo-input"
            >
              <option value="">Select answer type (required)</option>
              {answerTypes.map((at) => (
                <option key={at.id} value={at.id}>
                  {at.name} ({at.type})
                </option>
              ))}
            </select>
            <div className="space-y-1 rounded-md border border-[var(--bujo-border)] p-2 text-xs">
              <p className="font-semibold text-[var(--bujo-ink)]">Allowed answer types</p>
              <p className="text-[var(--bujo-subtle)]">Pick alternates users can switch to.</p>
              <div className="grid grid-cols-2 gap-2">
                {answerTypes.map((at) => {
                  const checked = normalizedAllowedTypes.includes(at.id);
                  return (
                    <label key={at.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAllowedAnswerType(at.id)}
                        disabled={at.id === answerTypeId}
                        className="bujo-range"
                      />
                      <span>
                        {at.name} <span className="text-[var(--bujo-subtle)]">({at.type})</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--bujo-ink)]">Default display</label>
                <select
                  value={defaultDisplayOption}
                  onChange={(e) => {
                    const newValue = e.target.value as DisplayOption;
                    setDefaultDisplayOption(newValue);
                    if (!allowedDisplayOptions.includes(newValue)) {
                      setAllowedDisplayOptions([...allowedDisplayOptions, newValue]);
                    }
                  }}
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
                <div className="flex flex-wrap gap-2">
                  {displayOptions.map((opt) => (
                    <label key={opt} className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={allowedDisplayOptions.includes(opt)}
                        onChange={() => toggleDisplayOption(opt)}
                        className="bujo-range"
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
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
            <textarea
              placeholder='Meta JSON e.g. {}'
              value={meta}
              onChange={(e) => setMeta(e.target.value)}
              rows={5}
              className="bujo-input"
            />
            <textarea
              placeholder='Default colors JSON e.g. {"accent":"#5f8b7a"}'
              value={defaultColors}
              onChange={(e) => setDefaultColors(e.target.value)}
              rows={4}
              className="bujo-input text-xs"
            />
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
          displayOptions={normalizedDisplayOptions}
          defaultDisplayOption={defaultDisplayOption}
          defaultColors={defaultColors}
          answerTypeId={answerTypeId}
        />
      )}
    </div>
  );
}
