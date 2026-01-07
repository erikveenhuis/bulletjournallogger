"use client";

import { useEffect, useState } from "react";
import type { Category } from "@/lib/types";
import ConfirmDialog from "@/components/confirm-dialog";

type Props = {
  categories: Category[];
};

export default function CategoriesClient({ categories }: Props) {
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [catEdits, setCatEdits] = useState<Record<string, { name: string; description: string }>>({});
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const nextCatEdits: Record<string, { name: string; description: string }> = {};
    categories.forEach((c) => {
      nextCatEdits[c.id] = { name: c.name, description: c.description ?? "" };
    });
    setCatEdits(nextCatEdits);
  }, [categories]);

  const addCategory = async () => {
    setMessage(null);
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: catName, description: catDesc }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Could not add category");
      return;
    }
    setMessage("Category added");
    window.location.reload();
  };

  const updateCategory = async (id: string) => {
    setMessage(null);
    const edit = catEdits[id];
    const res = await fetch("/api/categories", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: edit?.name, description: edit?.description }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Could not update category");
      return;
    }
    setMessage("Category updated");
    window.location.reload();
  };

  const deleteCategory = async () => {
    if (!pendingDeleteId) return;
    setMessage(null);
    const res = await fetch("/api/categories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: pendingDeleteId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Could not delete category");
      setPendingDeleteId(null);
      return;
    }
    setMessage("Category deleted");
    setPendingDeleteId(null);
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <div className="bujo-card bujo-ruled">
        <h2 className="text-lg font-semibold text-[var(--bujo-ink)]">Add category</h2>
        <div className="mt-3 space-y-2">
          <input
            placeholder="Name"
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            className="bujo-input"
          />
          <input
            placeholder="Description"
            value={catDesc}
            onChange={(e) => setCatDesc(e.target.value)}
            className="bujo-input"
          />
          <button onClick={addCategory} className="bujo-btn w-full text-sm">
            Add category
          </button>
        </div>
      </div>

      <div className="bujo-card bujo-ruled">
        <h2 className="text-lg font-semibold text-[var(--bujo-ink)]">Manage categories</h2>
        <div className="mt-3 space-y-3">
          {categories.length === 0 ? (
            <p className="text-sm text-[var(--bujo-subtle)]">No categories yet.</p>
          ) : (
            categories.map((c) => (
              <div
                key={c.id}
                className="grid gap-2 rounded-md border border-[var(--bujo-border)] bg-[var(--bujo-paper)] p-3 md:grid-cols-3"
              >
                <input
                  value={catEdits[c.id]?.name ?? ""}
                  onChange={(e) =>
                    setCatEdits((prev) => ({ ...prev, [c.id]: { ...prev[c.id], name: e.target.value } }))
                  }
                  className="bujo-input text-sm"
                />
                <input
                  value={catEdits[c.id]?.description ?? ""}
                  onChange={(e) =>
                    setCatEdits((prev) => ({ ...prev, [c.id]: { ...prev[c.id], description: e.target.value } }))
                  }
                  className="bujo-input text-sm"
                />
                <div className="flex gap-2">
                  <button onClick={() => updateCategory(c.id)} className="bujo-btn flex-1 text-sm">
                    Update
                  </button>
                  <button onClick={() => setPendingDeleteId(c.id)} className="bujo-btn-danger text-sm">
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {message && <p className="bujo-message text-sm">{message}</p>}

      <ConfirmDialog
        open={!!pendingDeleteId}
        title="Delete category?"
        description="This will remove the category immediately."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmTone="danger"
        onConfirm={deleteCategory}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
