"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AnswerType, Category, QuestionTemplate, UserQuestion } from "@/lib/types";
import ConfirmDialog from "@/components/confirm-dialog";
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
  categories: Category[];
  answerTypes: AnswerType[];
  templates: QuestionTemplate[];
  userQuestions: UserQuestion[];
  accountTier: number;
};

export default function CustomQuestions({
  categories,
  answerTypes,
  templates,
  userQuestions,
  accountTier,
}: Props) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [answerTypeId, setAnswerTypeId] = useState("");
  const [unit, setUnit] = useState("");
  const [steps, setSteps] = useState<string[]>(() => {
    const initialSteps = stepsFromMeta(null);
    if (initialSteps.length > 0) return initialSteps;
    return [];
  });
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<QuestionTemplate | null>(null);
  const selectedTemplateIds = new Set(userQuestions.map((u) => u.template_id));

  const selectedAnswerType = answerTypes.find((at) => at.id === answerTypeId);
  const isChoiceType =
    selectedAnswerType?.type === "single_choice" || selectedAnswerType?.type === "multi_choice";
  const isNumberType = selectedAnswerType?.type === "number";
  const isTierLocked = accountTier < 3;
  const isTierLimited = accountTier === 3 && templates.length >= 5;
  const isCreateLocked = isTierLocked || isTierLimited;
  const isSubmitLocked = editingId ? isTierLocked : isCreateLocked;
  const tierExplanation = isTierLocked
    ? "Custom questions require Tier 3+. Upgrade to add or edit questions."
    : !editingId && isTierLimited
      ? "Tier 3 includes up to 5 custom questions. Upgrade to add more."
      : null;

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setCategoryId("");
    setAnswerTypeId("");
    setUnit("");
    setSteps([]);
  };

  const loadTemplate = (template: QuestionTemplate) => {
    setEditingId(template.id);
    setTitle(template.title);
    setCategoryId(template.category_id || "");
    setAnswerTypeId(template.answer_type_id);
    setUnit(typeof template.meta?.unit === "string" ? template.meta.unit : "");
    const initialSteps = stepsFromMeta(template.meta);
    setSteps(initialSteps.length > 0 ? initialSteps : []);
  };


  const submit = async () => {
    setMessage(null);
    if (isSubmitLocked) {
      if (tierExplanation) {
        setMessage(tierExplanation);
      }
      return;
    }
    if (!title.trim()) {
      setMessage("Title is required");
      return;
    }
    if (!answerTypeId) {
      setMessage("Answer type is required");
      return;
    }

    const meta: Record<string, unknown> = {};
    if (isChoiceType) {
      const normalized = normalizeSteps(steps);
      const resolvedSteps = normalized.length > 0 ? normalized : defaultSteps;
      if (resolvedSteps.length < 2) {
        setMessage("Add at least two options for choice questions.");
        return;
      }
      meta.steps = resolvedSteps;
    } else if (isNumberType) {
      const trimmed = unit.trim();
      if (trimmed) {
        meta.unit = trimmed;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/question-templates", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          title: title.trim(),
          category_id: categoryId || null,
          meta,
          is_active: true,
          answer_type_id: answerTypeId,
        }),
      });
      let data: { error?: string } | null = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (!res.ok) {
        setMessage(data?.error || `Could not ${editingId ? "update" : "add"} question`);
        return;
      }
      resetForm();
      setMessage(editingId ? "Question updated." : "Question added.");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed.";
      setMessage(message);
    } finally {
      setSubmitting(false);
    }
  };

  const deleteTemplate = async () => {
    if (!pendingDelete) return;
    const res = await fetch("/api/question-templates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: pendingDelete.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Could not delete question");
      return;
    }
    setPendingDelete(null);
    router.refresh();
  };

  const addToDailyList = async (templateId: string) => {
    setAddingId(templateId);
    setMessage(null);
    try {
      const res = await fetch("/api/user-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: templateId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error || "Could not add question.");
        return;
      }
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed.";
      setMessage(message);
    } finally {
      setAddingId(null);
    }
  };

  return (
    <section className="bujo-card bujo-torn space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Custom questions</h2>
        <p className="text-sm text-gray-700">
          Build your own questions and choose a default answer type.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <input
            placeholder="Type your question here"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bujo-input"
          />
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="bujo-input"
          >
            <option value="">Select category (optional)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
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
            {answerTypes.map((at) => (
              <option key={at.id} value={at.id}>
                {at.name} ({at.type})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={submit}
              className="bujo-btn text-sm disabled:cursor-not-allowed disabled:opacity-70"
              disabled={submitting || isSubmitLocked}
              title={isSubmitLocked && tierExplanation ? tierExplanation : undefined}
            >
              {submitting ? "Saving..." : editingId ? "Save changes" : "Add question"}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="bujo-btn-secondary text-sm">
                Cancel
              </button>
            )}
          </div>
          {tierExplanation && (
            <p className="text-xs text-[var(--bujo-subtle)]">
              {tierExplanation}{" "}
              <a href="/profile/account" className="underline">
                Manage your plan
              </a>
              .
            </p>
          )}
          {message && <p className="bujo-message text-sm">{message}</p>}
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
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-800">Your custom questions</h3>
        {templates.length === 0 && (
          <p className="text-sm text-gray-600">No custom questions yet.</p>
        )}
        {templates.map((t) => (
          <div
            key={t.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--bujo-border)] bg-white px-3 py-2"
          >
            <div>
              <p className="text-sm font-semibold text-gray-900">{t.title}</p>
              <p className="text-xs text-gray-600">
                {t.answer_types?.type ?? "unknown"} •{" "}
                {categories.find((c) => c.id === t.category_id)?.name || "Uncategorized"}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => addToDailyList(t.id)}
                disabled={selectedTemplateIds.has(t.id) || addingId === t.id}
                className="bujo-btn text-xs disabled:cursor-not-allowed disabled:opacity-70"
              >
                {selectedTemplateIds.has(t.id)
                  ? "Added"
                  : addingId === t.id
                    ? "Adding..."
                    : "Add to daily list"}
              </button>
              <button onClick={() => loadTemplate(t)} className="bujo-btn-secondary text-xs">
                Edit
              </button>
              <button onClick={() => setPendingDelete(t)} className="bujo-btn-danger text-xs">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete question?"
        description="This will remove the question template."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmTone="danger"
        onConfirm={deleteTemplate}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  );
}
