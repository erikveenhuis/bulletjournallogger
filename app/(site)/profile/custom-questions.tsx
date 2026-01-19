"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AnswerType, Category, QuestionTemplate } from "@/lib/types";
import ConfirmDialog from "@/components/confirm-dialog";

type Props = {
  categories: Category[];
  answerTypes: AnswerType[];
  templates: QuestionTemplate[];
};

export default function CustomQuestions({ categories, answerTypes, templates }: Props) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [answerTypeId, setAnswerTypeId] = useState("");
  const [meta, setMeta] = useState<Record<string, unknown>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<QuestionTemplate | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setCategoryId("");
    setAnswerTypeId("");
    setMeta({});
  };

  const loadTemplate = (template: QuestionTemplate) => {
    setEditingId(template.id);
    setTitle(template.title);
    setCategoryId(template.category_id || "");
    setAnswerTypeId(template.answer_type_id);
    setMeta(template.meta || {});
  };

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
            placeholder="Question title"
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
              setAnswerTypeId(e.target.value);
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
              className="bujo-btn text-sm"
              disabled={submitting}
            >
              {submitting ? "Saving..." : editingId ? "Save changes" : "Add question"}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="bujo-btn-secondary text-sm">
                Cancel
              </button>
            )}
          </div>
          {message && <p className="bujo-message text-sm">{message}</p>}
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
