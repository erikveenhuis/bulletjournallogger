"use client";

import { useEffect, useState } from "react";
import type { Category, QuestionTemplate } from "@/lib/types";

type Props = {
  categories: Category[];
  templates: QuestionTemplate[];
};

const questionTypes = ["boolean", "number", "scale", "text", "emoji"];

export default function AdminForms({ categories, templates }: Props) {
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [type, setType] = useState("boolean");
  const [meta, setMeta] = useState("{}");
  const [message, setMessage] = useState<string | null>(null);

  const [catEdits, setCatEdits] = useState<Record<string, { name: string; description: string }>>({});
  const [templateEdits, setTemplateEdits] = useState<
    Record<string, { title: string; category_id: string | null; type: string; meta: string; is_active: boolean }>
  >({});

  useEffect(() => {
    const nextCatEdits: Record<string, { name: string; description: string }> = {};
    categories.forEach((c) => {
      nextCatEdits[c.id] = { name: c.name, description: c.description ?? "" };
    });
    setCatEdits(nextCatEdits);
  }, [categories]);

  useEffect(() => {
    const nextTemplateEdits: Record<
      string,
      { title: string; category_id: string | null; type: string; meta: string; is_active: boolean }
    > = {};
    templates.forEach((t) => {
      nextTemplateEdits[t.id] = {
        title: t.title,
        category_id: t.category_id ?? "",
        type: t.type,
        meta: JSON.stringify(t.meta ?? {}),
        is_active: !!t.is_active,
      };
    });
    setTemplateEdits(nextTemplateEdits);
  }, [templates]);

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

  const addTemplate = async () => {
    setMessage(null);
    let metaJson: Record<string, unknown> = {};
    try {
      metaJson = JSON.parse(meta || "{}");
    } catch {
      setMessage("Meta must be valid JSON");
      return;
    }
    const res = await fetch("/api/question-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        category_id: categoryId || null,
        type,
        meta: metaJson,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Could not add template");
      return;
    }
    setMessage("Template added");
    window.location.reload();
  };

  const updateTemplate = async (id: string) => {
    setMessage(null);
    const edit = templateEdits[id];
    if (!edit) return;

    let metaJson: Record<string, unknown> = {};
    try {
      metaJson = JSON.parse(edit.meta || "{}");
    } catch {
      setMessage("Meta must be valid JSON");
      return;
    }

    const res = await fetch("/api/question-templates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        title: edit.title,
        category_id: edit.category_id || null,
        type: edit.type,
        meta: metaJson,
        is_active: edit.is_active,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Could not update template");
      return;
    }
    setMessage("Template updated");
    window.location.reload();
  };

  const deleteTemplate = async (id: string) => {
    setMessage(null);
    const res = await fetch("/api/question-templates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Could not delete template");
      return;
    }
    setMessage("Template deleted");
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
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
          <h2 className="text-lg font-semibold text-gray-900">Add template</h2>
          <div className="mt-3 space-y-2">
            <input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {questionTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <textarea
              placeholder='Meta JSON e.g. {"min":1,"max":5,"emoji_set":["😀","🙂"]}'
              value={meta}
              onChange={(e) => setMeta(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              onClick={addTemplate}
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Add template
            </button>
          </div>
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

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Manage templates</h2>
        <div className="mt-3 space-y-4">
          {templates.length === 0 ? (
            <p className="text-sm text-gray-600">No templates yet.</p>
          ) : (
            templates.map((t) => (
              <div key={t.id} className="space-y-2 rounded-md border border-gray-100 p-3">
                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    value={templateEdits[t.id]?.title ?? ""}
                    onChange={(e) =>
                      setTemplateEdits((prev) => ({ ...prev, [t.id]: { ...prev[t.id], title: e.target.value } }))
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  <select
                    value={templateEdits[t.id]?.category_id ?? ""}
                    onChange={(e) =>
                      setTemplateEdits((prev) => ({
                        ...prev,
                        [t.id]: { ...prev[t.id], category_id: e.target.value },
                      }))
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">Select category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <select
                    value={templateEdits[t.id]?.type ?? "boolean"}
                    onChange={(e) =>
                      setTemplateEdits((prev) => ({ ...prev, [t.id]: { ...prev[t.id], type: e.target.value } }))
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    {questionTypes.map((qt) => (
                      <option key={qt} value={qt}>
                        {qt}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={!!templateEdits[t.id]?.is_active}
                      onChange={(e) =>
                        setTemplateEdits((prev) => ({
                          ...prev,
                          [t.id]: { ...prev[t.id], is_active: e.target.checked },
                        }))
                      }
                    />
                    Active
                  </label>
                </div>
                <textarea
                  value={templateEdits[t.id]?.meta ?? "{}"}
                  onChange={(e) =>
                    setTemplateEdits((prev) => ({ ...prev, [t.id]: { ...prev[t.id], meta: e.target.value } }))
                  }
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => updateTemplate(t.id)}
                    className="flex-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    Update
                  </button>
                  <button
                    onClick={() => deleteTemplate(t.id)}
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
