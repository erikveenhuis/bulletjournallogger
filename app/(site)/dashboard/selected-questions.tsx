"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnswerType, DisplayOption, UserQuestion } from "@/lib/types";
import ConfirmDialog from "@/components/confirm-dialog";

type Props = {
  userQuestions: UserQuestion[];
  answerTypes: AnswerType[];
};

type OverrideEdit = {
  answer_type_override_id: string | null;
  display_option_override: DisplayOption | null;
  color_palette: string;
};

export default function SelectedQuestions({ userQuestions, answerTypes }: Props) {
  const validUserQuestions = userQuestions.filter(
    (u): u is UserQuestion & { template: NonNullable<UserQuestion["template"]> } => !!u.template,
  );
  const missingTemplateQuestions = userQuestions.filter((u) => !u.template);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, OverrideEdit>>({});
  const [message, setMessage] = useState<string | null>(null);

  const overridesSeed = useMemo(
    () =>
      validUserQuestions
        .map(
          (u) =>
            `${u.id}|${u.answer_type_override_id ?? ""}|${u.display_option_override ?? ""}|${JSON.stringify(
              u.color_palette ?? {},
            )}`,
        )
        .join(";"),
    [validUserQuestions],
  );

  useEffect(() => {
    const initial: Record<string, OverrideEdit> = {};
    validUserQuestions.forEach((u) => {
      initial[u.id] = {
        answer_type_override_id: u.answer_type_override_id ?? null,
        display_option_override: (u.display_option_override as DisplayOption | null) ?? null,
        color_palette: u.color_palette ? JSON.stringify(u.color_palette) : "",
      };
    });
    const next = JSON.stringify(initial);
    const current = JSON.stringify(overrides);
    if (next !== current) {
      setOverrides(initial);
    }
  }, [overridesSeed]);

  const remove = async () => {
    if (!pendingRemoveId) return;
    await fetch(`/api/user-questions?id=${pendingRemoveId}`, { method: "DELETE" });
    setPendingRemoveId(null);
    window.location.reload();
  };

  const saveOverrides = async (id: string, templateId: string) => {
    const payload = overrides[id];
    if (!payload) return;
    setMessage(null);
    let parsedPalette: Record<string, unknown> | undefined;
    if (payload.color_palette.trim()) {
      try {
        const parsed = JSON.parse(payload.color_palette);
        if (typeof parsed === "object" && !Array.isArray(parsed)) {
          parsedPalette = parsed;
        } else {
          setMessage("Color overrides must be an object");
          return;
        }
      } catch {
        setMessage("Color overrides must be valid JSON");
        return;
      }
    }
    const res = await fetch("/api/user-questions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        template_id: templateId,
        answer_type_override_id: payload.answer_type_override_id,
        display_option_override: payload.display_option_override,
        color_palette: parsedPalette,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Could not save overrides");
      return;
    }
    setMessage("Saved overrides");
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
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[var(--bujo-ink)]">{u.custom_label || u.template.title}</p>
                  <p className="text-xs text-[var(--bujo-subtle)]">
                    Default: {u.template.answer_types?.type ?? "unknown"} • {u.template.categories?.name}
                  </p>
                </div>
                <button
                  onClick={() => setPendingRemoveId(u.id)}
                  className="bujo-btn-danger w-auto justify-center text-xs"
                >
                  Remove
                </button>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                {(() => {
                  const allowedIds =
                    (u.template.allowed_answer_type_ids && u.template.allowed_answer_type_ids.length > 0
                      ? u.template.allowed_answer_type_ids
                      : [u.template.answer_type_id]) || [];
                  const allowed = answerTypes.filter((at) => allowedIds.includes(at.id));
                  if (allowed.length <= 1) return null;
                  return (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[var(--bujo-ink)]">Answer type override</label>
                      <select
                        value={overrides[u.id]?.answer_type_override_id ?? ""}
                        onChange={(e) =>
                          setOverrides((prev) => ({
                            ...prev,
                            [u.id]: { ...(prev[u.id] || { color_palette: "" }), answer_type_override_id: e.target.value || null },
                          }))
                        }
                        className="bujo-input text-xs"
                      >
                        <option value="">Use default ({u.template.answer_types?.name || "default"})</option>
                        {allowed.map((at) => (
                          <option key={at.id} value={at.id}>
                            {at.name} ({at.type})
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })()}

                {(() => {
                  const allowedDisplays =
                    (u.template.allowed_display_options && u.template.allowed_display_options.length > 0
                      ? u.template.allowed_display_options
                      : [u.template.default_display_option || "graph"]) || [];
                  if (allowedDisplays.length <= 1) return null;
                  return (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[var(--bujo-ink)]">Display override</label>
                      <select
                        value={overrides[u.id]?.display_option_override ?? ""}
                        onChange={(e) =>
                          setOverrides((prev) => ({
                            ...prev,
                            [u.id]: {
                              ...(prev[u.id] || { color_palette: "" }),
                              display_option_override: (e.target.value || null) as DisplayOption | null,
                            },
                          }))
                        }
                        className="bujo-input text-xs"
                      >
                        <option value="">Use default ({u.template.default_display_option || "graph"})</option>
                        {allowedDisplays.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })()}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--bujo-ink)]">Color overrides (JSON)</label>
                <textarea
                  value={overrides[u.id]?.color_palette ?? ""}
                  onChange={(e) =>
                    setOverrides((prev) => ({
                      ...prev,
                      [u.id]: { ...(prev[u.id] || { answer_type_override_id: null, display_option_override: null }), color_palette: e.target.value },
                    }))
                  }
                  rows={3}
                  className="bujo-input text-xs"
                  placeholder='{"accent":"#5f8b7a"}'
                />
              </div>

              <button
                onClick={() => saveOverrides(u.id, u.template_id)}
                className="bujo-btn w-full justify-center text-xs sm:w-auto"
              >
                Save overrides
              </button>
            </div>
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
      {message && <p className="bujo-message text-xs">{message}</p>}
    </section>
  );
}
