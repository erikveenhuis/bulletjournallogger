"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AnswerType, Category, QuestionTemplate } from "@/lib/types";
import ConfirmDialog from "@/components/confirm-dialog";

type Props = {
  categories: Category[];
  answerTypes: AnswerType[];
  templates: QuestionTemplate[];
};

export default function AdminForms({ categories, answerTypes, templates }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const categoryNameById = useMemo(() => {
    return categories.reduce<Map<string, string>>((map, category) => {
      map.set(category.id, category.name);
      return map;
    }, new Map());
  }, [categories]);

  const answerTypeNameById = useMemo(() => {
    return answerTypes.reduce<Map<string, string>>((map, answerType) => {
      map.set(answerType.id, answerType.name);
      return map;
    }, new Map());
  }, [answerTypes]);

  const filteredTemplates = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => {
      return (
        t.title.toLowerCase().includes(q) ||
        (categoryNameById.get(t.category_id ?? "") ?? "").toLowerCase().includes(q) ||
        (answerTypeNameById.get(t.answer_type_id ?? "") ?? "").toLowerCase().includes(q) ||
        (t.answer_types?.type ?? "").toLowerCase().includes(q) ||
        (t.answer_types?.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [templates, query, categoryNameById, answerTypeNameById]);

  const deleteTemplate = async () => {
    if (!pendingDeleteId) return;
    setDeleting(true);
    setMessage(null);
    const res = await fetch("/api/question-templates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: pendingDeleteId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Could not delete template");
      setDeleting(false);
      setPendingDeleteId(null);
      return;
    }
    setPendingDeleteId(null);
    setDeleting(false);
    router.refresh();
  };

  return (
    <div className="bujo-card bujo-torn">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--bujo-ink)]">Existing questions</h2>
          <p className="text-sm text-[var(--bujo-subtle)]">Edit on dedicated pages and delete when no longer needed.</p>
        </div>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by title, category, or answer type"
            className="bujo-input w-full max-w-xs text-sm"
          />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {filteredTemplates.length === 0 ? (
          <p className="text-sm text-[var(--bujo-subtle)]">
            {query.trim() ? "No questions match your filter." : "No questions yet."}
          </p>
        ) : (
          filteredTemplates.map((t) => (
            <div
              key={t.id}
              className="space-y-2 rounded-md border border-[var(--bujo-border)] bg-[var(--bujo-paper)] p-3"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[var(--bujo-ink)]">{t.title}</p>
                  {t.categories?.name && (
                    <p className="text-sm text-[var(--bujo-subtle)]">Category: {t.categories.name}</p>
                  )}
                  {t.answer_types && (
                    <p className="text-xs text-[var(--bujo-subtle)]">
                      Answer Type: {t.answer_types.name} ({t.answer_types.type})
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`bujo-chip text-xs ${t.is_active ? "" : "opacity-50"}`}>
                    {t.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/admin/questions/${t.id}/edit`} className="bujo-btn text-sm">
                  Edit
                </Link>
                <button
                  onClick={() => setPendingDeleteId(t.id)}
                  className="bujo-btn-danger text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {message && <p className="bujo-message mt-4 text-sm">{message}</p>}

      <ConfirmDialog
        open={!!pendingDeleteId}
        title="Delete question template?"
        description="This will remove the template immediately."
        confirmLabel={deleting ? "Deleting..." : "Delete"}
        cancelLabel="Cancel"
        confirmTone="danger"
        onConfirm={deleteTemplate}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
