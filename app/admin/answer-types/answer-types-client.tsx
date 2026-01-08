"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AnswerType } from "@/lib/types";
import ConfirmDialog from "@/components/confirm-dialog";

type AnswerTypeWithUsage = AnswerType & { usageCount: number };

type Props = {
  answerTypes: AnswerTypeWithUsage[];
};

export default function AnswerTypesClient({ answerTypes }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return answerTypes;
    return answerTypes.filter((at) => {
      const inItems = (at.items ?? []).some((item) => item.toLowerCase().includes(q));
      const inMeta = JSON.stringify(at.meta ?? {}).toLowerCase().includes(q);
      return (
        at.name.toLowerCase().includes(q) ||
        (at.description?.toLowerCase() ?? "").includes(q) ||
        at.type.toLowerCase().includes(q) ||
        inItems ||
        inMeta
      );
    });
  }, [answerTypes, query]);

  const pendingDelete = useMemo(
    () => answerTypes.find((at) => at.id === pendingDeleteId),
    [answerTypes, pendingDeleteId],
  );

  const deleteAnswerType = async () => {
    if (!pendingDeleteId) return;
    if (pendingDelete?.usageCount && pendingDelete.usageCount > 0) {
      setMessage("Cannot delete an answer type that is in use.");
      setPendingDeleteId(null);
      return;
    }
    setDeleting(true);
    setMessage(null);
    const res = await fetch("/api/answer-types", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: pendingDeleteId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Could not delete answer type");
      setDeleting(false);
      setPendingDeleteId(null);
      return;
    }
    setPendingDeleteId(null);
    router.refresh();
  };

  const metaSummary = (meta: AnswerType["meta"]) => {
    const text = JSON.stringify(meta ?? {});
    if (text === "{}") return "Meta: none";
    return text.length > 80 ? `Meta: ${text.slice(0, 77)}...` : `Meta: ${text}`;
  };

  const itemsSummary = (items: string[] | null) => {
    if (!items || items.length === 0) return "Items: none";
    const joined = items.join(", ");
    return joined.length > 80 ? `Items: ${joined.slice(0, 77)}...` : `Items: ${joined}`;
  };

  return (
    <div className="bujo-card bujo-torn">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--bujo-ink)]">Existing answer types</h2>
          <p className="text-sm text-[var(--bujo-subtle)]">Edit on dedicated pages and delete only when unused.</p>
        </div>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name, description, type, items, or meta"
            className="bujo-input w-full max-w-xs text-sm"
          />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {filtered.length === 0 ? (
          <p className="text-sm text-[var(--bujo-subtle)]">No answer types match your filter.</p>
        ) : (
          filtered.map((at) => (
            <div
              key={at.id}
              className="space-y-2 rounded-md border border-[var(--bujo-border)] bg-[var(--bujo-paper)] p-3"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[var(--bujo-ink)]">{at.name}</p>
                  {at.description && <p className="text-sm text-[var(--bujo-subtle)]">{at.description}</p>}
                  <p className="text-xs text-[var(--bujo-subtle)]">{itemsSummary(at.items)}</p>
                  <p className="text-xs text-[var(--bujo-subtle)]">{metaSummary(at.meta)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="bujo-chip text-xs">Type: {at.type}</span>
                  <span className="bujo-chip text-xs">
                    {at.usageCount > 0 ? `${at.usageCount} template${at.usageCount === 1 ? "" : "s"} in use` : "Unused"}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/admin/answer-types/${at.id}/edit`} className="bujo-btn text-sm">
                  Edit
                </Link>
                <button
                  onClick={() => setPendingDeleteId(at.id)}
                  className="bujo-btn-danger text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={at.usageCount > 0}
                  title={at.usageCount > 0 ? "This answer type is used by existing templates" : "Delete answer type"}
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
        title="Delete answer type?"
        description={
          pendingDelete?.usageCount
            ? "You cannot delete an answer type that is still referenced by question templates."
            : "This will remove the answer type. Make sure no templates depend on it."
        }
        confirmLabel={deleting ? "Deleting..." : "Delete"}
        cancelLabel="Cancel"
        confirmTone="danger"
        onConfirm={deleteAnswerType}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
