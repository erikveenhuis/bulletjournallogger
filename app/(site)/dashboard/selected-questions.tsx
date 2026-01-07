"use client";

import { useState } from "react";
import type { UserQuestion } from "@/lib/types";
import ConfirmDialog from "@/components/confirm-dialog";

type Props = {
  userQuestions: UserQuestion[];
};

export default function SelectedQuestions({ userQuestions }: Props) {
  const validUserQuestions = userQuestions.filter(
    (u): u is UserQuestion & { template: NonNullable<UserQuestion["template"]> } => !!u.template,
  );
  const missingTemplateQuestions = userQuestions.filter((u) => !u.template);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);

  const remove = async () => {
    if (!pendingRemoveId) return;
    await fetch(`/api/user-questions?id=${pendingRemoveId}`, { method: "DELETE" });
    setPendingRemoveId(null);
    window.location.reload();
  };

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
      <div className="mt-3 space-y-2">
        {validUserQuestions.map((u) => (
          <div
            key={u.id}
            className="flex flex-col gap-2 rounded-md border border-[var(--bujo-border)] bg-[var(--bujo-paper)] px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-semibold text-[var(--bujo-ink)]">{u.custom_label || u.template.title}</p>
              <p className="text-xs text-[var(--bujo-subtle)]">{u.template.answer_types?.type ?? "unknown"} • {u.template.categories?.name}</p>
            </div>
            <button onClick={() => setPendingRemoveId(u.id)} className="bujo-btn-danger w-full justify-center text-xs sm:w-auto">
              Remove
            </button>
          </div>
        ))}
        {validUserQuestions.length === 0 && userQuestions.length === 0 && (
          <p className="text-sm text-[var(--bujo-subtle)]">No questions selected yet.</p>
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
            <button
              onClick={() => setPendingRemoveId(u.id)}
              className="bujo-btn-danger text-xs"
            >
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
    </section>
  );
}
