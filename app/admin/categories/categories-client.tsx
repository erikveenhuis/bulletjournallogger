"use client";

import { useEffect, useState } from "react";
import type { Category } from "@/lib/types";

type Props = {
  categories: Category[];
};

export default function CategoriesClient({ categories }: Props) {
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [catEdits, setCatEdits] = useState<Record<string, { name: string; description: string }>>({});

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

  const deleteCategory = async (id: string) => {
    setMessage(null);
    const res = await fetch("/api/categories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Could not delete category");
      return;
    }
    setMessage("Category deleted");
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Add category</h2>
        <div className="mt-3 space-y-2">
          <input
            placeholder="Name"
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Description"
            value={catDesc}
            onChange={(e) => setCatDesc(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            onClick={addCategory}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Add category
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Manage categories</h2>
        <div className="mt-3 space-y-3">
          {categories.length === 0 ? (
            <p className="text-sm text-gray-600">No categories yet.</p>
          ) : (
            categories.map((c) => (
              <div key={c.id} className="grid gap-2 rounded-md border border-gray-100 p-3 md:grid-cols-3">
                <input
                  value={catEdits[c.id]?.name ?? ""}
                  onChange={(e) =>
                    setCatEdits((prev) => ({ ...prev, [c.id]: { ...prev[c.id], name: e.target.value } }))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                <input
                  value={catEdits[c.id]?.description ?? ""}
                  onChange={(e) =>
                    setCatEdits((prev) => ({ ...prev, [c.id]: { ...prev[c.id], description: e.target.value } }))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => updateCategory(c.id)}
                    className="flex-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    Update
                  </button>
                  <button
                    onClick={() => deleteCategory(c.id)}
                    className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {message && <p className="text-sm text-gray-700">{message}</p>}
    </div>
  );
}
