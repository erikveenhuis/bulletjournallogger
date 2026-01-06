"use client";

import type { UserQuestion } from "@/lib/types";

type Props = {
  userQuestions: UserQuestion[];
};

export default function SelectedQuestions({ userQuestions }: Props) {
  const validUserQuestions = userQuestions.filter((u): u is UserQuestion & { template: NonNullable<UserQuestion["template"]> } => !!u.template);
  const missingTemplateQuestions = userQuestions.filter((u) => !u.template);

  const remove = async (id: string) => {
    await fetch(`/api/user-questions?id=${id}`, { method: "DELETE" });
    window.location.reload();
  };

  return (
    <section className="bujo-card bujo-ruled">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Your daily list</h2>
          <p className="text-sm text-gray-700">
            Questions you will see each day (tap the reminder notification).
          </p>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {validUserQuestions.map((u) => (
          <div
            key={u.id}
            className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white/70 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {u.custom_label || u.template.title}
              </p>
              <p className="text-xs text-gray-600">
                {u.template.type} • {u.template.categories?.name}
              </p>
            </div>
            <button
              onClick={() => remove(u.id)}
              className="w-full text-left text-xs font-semibold text-red-600 underline-offset-4 hover:underline sm:w-auto sm:text-right"
            >
              Remove
            </button>
          </div>
        ))}
        {validUserQuestions.length === 0 && userQuestions.length === 0 && (
          <p className="text-sm text-gray-600">No questions selected yet.</p>
        )}
        {missingTemplateQuestions.map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2"
          >
            <div>
              <p className="text-sm font-semibold text-red-900">
                {u.custom_label || "Missing template"}
              </p>
              <p className="text-xs text-red-800">This template was removed. Remove to clean up.</p>
            </div>
            <button
              onClick={() => remove(u.id)}
              className="text-xs font-semibold text-red-700 underline-offset-4 hover:underline"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
