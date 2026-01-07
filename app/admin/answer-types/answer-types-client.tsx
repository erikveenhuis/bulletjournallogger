"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnswerType } from "@/lib/types";
import ConfirmDialog from "@/components/confirm-dialog";

type Props = {
  answerTypes: AnswerType[];
};

const answerTypeOptions = ["boolean", "number", "scale", "text", "emoji", "yes_no_list"];

export default function AnswerTypesClient({ answerTypes }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<AnswerType["type"]>("boolean");
  const [items, setItems] = useState<string[]>(["Yes", "No"]);
  const [meta, setMeta] = useState("{}");
  const [newItem, setNewItem] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [answerTypeEdits, setAnswerTypeEdits] = useState<
    Record<string, { name: string; description: string; type: AnswerType["type"]; items: string[] | null; meta: string }>
  >({});
  const [editNewItems, setEditNewItems] = useState<Record<string, string>>({});
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const needsItems = (t: AnswerType["type"]) => t === "boolean" || t === "emoji" || t === "yes_no_list";
  const needsMeta = (t: AnswerType["type"]) => t === "scale" || t === "emoji" || t === "number";
  const isFixedItems = (t: AnswerType["type"]) => t === "boolean"; // Boolean always has Yes/No

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return answerTypes;
    return answerTypes.filter(
      (at) =>
        at.name.toLowerCase().includes(q) ||
        (at.description?.toLowerCase() ?? "").includes(q) ||
        at.type.toLowerCase().includes(q) ||
        (at.items ?? []).some((item) => item.toLowerCase().includes(q)),
    );
  }, [answerTypes, query]);

  useEffect(() => {
    const nextEdits: Record<string, { name: string; description: string; type: AnswerType["type"]; items: string[] | null; meta: string }> = {};
    answerTypes.forEach((at) => {
      // For boolean types, ensure items are exactly ["Yes", "No"]
      let items = at.items ? [...at.items] : null;
      if (at.type === "boolean") {
        items = ["Yes", "No"];
      }
      nextEdits[at.id] = {
        name: at.name,
        description: at.description ?? "",
        type: at.type,
        items,
        meta: JSON.stringify(at.meta ?? {}),
      };
    });
    setAnswerTypeEdits(nextEdits);
  }, [answerTypes]);

  const addItem = () => {
    if (newItem.trim()) {
      setItems([...items, newItem.trim()]);
      setNewItem("");
    }
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const addItemToEdit = (id: string, item: string) => {
    if (item.trim()) {
      const edit = answerTypeEdits[id];
      if (edit) {
        const currentItems = edit.items ?? [];
        setAnswerTypeEdits({
          ...answerTypeEdits,
          [id]: { ...edit, items: [...currentItems, item.trim()] },
        });
      }
    }
  };

  const removeItemFromEdit = (id: string, index: number) => {
    const edit = answerTypeEdits[id];
    if (edit && edit.items) {
      setAnswerTypeEdits({
        ...answerTypeEdits,
        [id]: { ...edit, items: edit.items.filter((_, i) => i !== index) },
      });
    }
  };

  const addAnswerType = async () => {
    setMessage(null);
    if (!name.trim()) {
      setMessage("Name is required");
      return;
    }
    if (!type) {
      setMessage("Type is required");
      return;
    }
    if (needsItems(type)) {
      if (type === "boolean") {
        // Boolean must have exactly Yes/No
        if (items.length !== 2 || !items.includes("Yes") || !items.includes("No")) {
          setItems(["Yes", "No"]);
        }
      } else if (items.length === 0) {
        setMessage("At least one item is required for this type");
        return;
      }
    }
    let metaJson: Record<string, unknown> = {};
    if (needsMeta(type)) {
      try {
        metaJson = JSON.parse(meta || "{}");
      } catch {
        setMessage("Meta must be valid JSON");
        return;
      }
    }
    const res = await fetch("/api/answer-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || null,
        type,
        items: type === "boolean" ? ["Yes", "No"] : needsItems(type) ? items : null,
        meta: metaJson,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Could not add answer type");
      return;
    }
    setMessage("Answer type added");
    setName("");
    setDescription("");
    setType("boolean");
    setItems(["Yes", "No"]);
    setMeta("{}");
    window.location.reload();
  };

  const updateAnswerType = async (id: string) => {
    setMessage(null);
    const edit = answerTypeEdits[id];
    if (!edit) return;
    if (!edit.name.trim()) {
      setMessage("Name is required");
      return;
    }
    if (!edit.type) {
      setMessage("Type is required");
      return;
    }
    if (needsItems(edit.type)) {
      if (edit.type === "boolean") {
        // Boolean must have exactly Yes/No
        if (!edit.items || edit.items.length !== 2 || !edit.items.includes("Yes") || !edit.items.includes("No")) {
          setAnswerTypeEdits((prev) => ({
            ...prev,
            [id]: { ...prev[id], items: ["Yes", "No"] },
          }));
        }
      } else if (!edit.items || edit.items.length === 0) {
        setMessage("At least one item is required for this type");
        return;
      }
    }
    let metaJson: Record<string, unknown> = {};
    if (needsMeta(edit.type)) {
      try {
        metaJson = JSON.parse(edit.meta || "{}");
      } catch {
        setMessage("Meta must be valid JSON");
        return;
      }
    }
    const res = await fetch("/api/answer-types", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        name: edit.name.trim(),
        description: edit.description.trim() || null,
        type: edit.type,
        items: edit.type === "boolean" ? ["Yes", "No"] : needsItems(edit.type) ? edit.items : null,
        meta: metaJson,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Could not update answer type");
      return;
    }
    setMessage("Answer type updated");
    window.location.reload();
  };

  const deleteAnswerType = async () => {
    if (!pendingDeleteId) return;
    setMessage(null);
    const res = await fetch("/api/answer-types", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: pendingDeleteId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Could not delete answer type");
      setPendingDeleteId(null);
      return;
    }
    setMessage("Answer type deleted");
    setPendingDeleteId(null);
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <div className="bujo-card bujo-torn">
        <h2 className="text-lg font-semibold text-[var(--bujo-ink)]">Add answer type</h2>
        <div className="mt-3 space-y-2">
          <input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bujo-input"
          />
          <input
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="bujo-input"
          />
          <select value={type} onChange={(e) => {
            const newType = e.target.value as AnswerType["type"];
            setType(newType);
            if (newType === "boolean") {
              setItems(["Yes", "No"]);
            } else if (!needsItems(newType)) {
              setItems([]);
            }
          }} className="bujo-input">
            {answerTypeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {needsItems(type) && (
            <div className="space-y-2">
              {isFixedItems(type) ? (
                <div className="rounded-md border border-[var(--bujo-border)] bg-[var(--bujo-paper)] p-3">
                  <p className="text-sm text-[var(--bujo-subtle)] mb-2">Boolean types are fixed to Yes/No:</p>
                  <div className="space-y-1">
                    {["Yes", "No"].map((item) => (
                      <div key={item} className="flex items-center gap-2 rounded-md border border-[var(--bujo-border)] bg-white p-2">
                        <span className="flex-1 text-sm">{item}</span>
                        <span className="text-xs text-[var(--bujo-subtle)]">Fixed</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      placeholder="Add item"
                      value={newItem}
                      onChange={(e) => setNewItem(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addItem();
                        }
                      }}
                      className="bujo-input flex-1"
                    />
                    <button onClick={addItem} className="bujo-btn text-sm">
                      Add
                    </button>
                  </div>
                  {items.length > 0 && (
                    <div className="space-y-1">
                      {items.map((item, index) => (
                        <div key={index} className="flex items-center gap-2 rounded-md border border-[var(--bujo-border)] bg-[var(--bujo-paper)] p-2">
                          <span className="flex-1 text-sm">{item}</span>
                          <button
                            onClick={() => removeItem(index)}
                            className="bujo-btn-danger text-xs px-2 py-1"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          {needsMeta(type) && (
            <textarea
              placeholder='Meta JSON e.g. {"min":1,"max":5} for scale, {"emoji_set":["😀","🙂"]} for emoji, {"unit":"cups"} for number'
              value={meta}
              onChange={(e) => setMeta(e.target.value)}
              rows={3}
              className="bujo-input"
            />
          )}
          <button onClick={addAnswerType} className="bujo-btn w-full text-sm">
            Add answer type
          </button>
        </div>
      </div>

      <div className="bujo-card bujo-torn">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-[var(--bujo-ink)]">Manage answer types</h2>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name, description, type, or items"
            className="bujo-input w-full max-w-xs text-sm"
          />
        </div>
        <div className="mt-3 space-y-3">
          {filtered.length === 0 ? (
            <p className="text-sm text-[var(--bujo-subtle)]">No answer types yet.</p>
          ) : (
            filtered.map((at) => {
              const edit = answerTypeEdits[at.id];
              const newEditItem = editNewItems[at.id] || "";
              return (
                <div
                  key={at.id}
                  className="space-y-2 rounded-md border border-[var(--bujo-border)] bg-[var(--bujo-paper)] p-3"
                >
                  <div className="grid gap-2 md:grid-cols-2">
                    <input
                      value={edit?.name ?? ""}
                      onChange={(e) =>
                        setAnswerTypeEdits((prev) => ({
                          ...prev,
                          [at.id]: { ...prev[at.id], name: e.target.value },
                        }))
                      }
                      className="bujo-input text-sm"
                    />
                    <input
                      value={edit?.description ?? ""}
                      onChange={(e) =>
                        setAnswerTypeEdits((prev) => ({
                          ...prev,
                          [at.id]: { ...prev[at.id], description: e.target.value },
                        }))
                      }
                      placeholder="Description"
                      className="bujo-input text-sm"
                    />
                  </div>
                  <select
                    value={edit?.type ?? "boolean"}
                    onChange={(e) => {
                      const newType = e.target.value as AnswerType["type"];
                      setAnswerTypeEdits((prev) => ({
                        ...prev,
                        [at.id]: {
                          ...prev[at.id],
                          type: newType,
                          items: newType === "boolean" ? ["Yes", "No"] : needsItems(newType) ? (prev[at.id]?.items ?? []) : null,
                        },
                      }));
                    }}
                    className="bujo-input text-sm"
                  >
                    {answerTypeOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  {needsItems(edit?.type ?? "boolean") && (
                    <div className="space-y-2">
                      {isFixedItems(edit?.type ?? "boolean") ? (
                        <div className="rounded-md border border-[var(--bujo-border)] bg-[var(--bujo-paper)] p-3">
                          <p className="text-sm text-[var(--bujo-subtle)] mb-2">Boolean types are fixed to Yes/No:</p>
                          <div className="space-y-1">
                            {["Yes", "No"].map((item) => (
                              <div key={item} className="flex items-center gap-2 rounded-md border border-[var(--bujo-border)] bg-white p-2">
                                <span className="flex-1 text-sm">{item}</span>
                                <span className="text-xs text-[var(--bujo-subtle)]">Fixed</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex gap-2">
                            <input
                              placeholder="Add item"
                              value={newEditItem}
                              onChange={(e) =>
                                setEditNewItems((prev) => ({ ...prev, [at.id]: e.target.value }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  addItemToEdit(at.id, newEditItem);
                                  setEditNewItems((prev) => ({ ...prev, [at.id]: "" }));
                                }
                              }}
                              className="bujo-input flex-1 text-sm"
                            />
                            <button
                              onClick={() => {
                                addItemToEdit(at.id, newEditItem);
                                setEditNewItems((prev) => ({ ...prev, [at.id]: "" }));
                              }}
                              className="bujo-btn text-xs px-2 py-1"
                            >
                              Add
                            </button>
                          </div>
                          {edit?.items && edit.items.length > 0 && (
                            <div className="space-y-1">
                              {edit.items.map((item, index) => (
                                <div
                                  key={index}
                                  className="flex items-center gap-2 rounded-md border border-[var(--bujo-border)] bg-white p-2"
                                >
                                  <span className="flex-1 text-sm">{item}</span>
                                  <button
                                    onClick={() => removeItemFromEdit(at.id, index)}
                                    className="bujo-btn-danger text-xs px-2 py-1"
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  {needsMeta(edit?.type ?? "boolean") && (
                    <textarea
                      placeholder='Meta JSON e.g. {"min":1,"max":5}'
                      value={edit?.meta ?? "{}"}
                      onChange={(e) =>
                        setAnswerTypeEdits((prev) => ({
                          ...prev,
                          [at.id]: { ...prev[at.id], meta: e.target.value },
                        }))
                      }
                      rows={3}
                      className="bujo-input text-sm"
                    />
                  )}
                  <div className="flex items-center gap-2 text-xs text-[var(--bujo-subtle)]">
                    <span className="bujo-chip">Type: {edit?.type ?? at.type}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => updateAnswerType(at.id)} className="bujo-btn flex-1 text-sm">
                      Update
                    </button>
                    <button onClick={() => setPendingDeleteId(at.id)} className="bujo-btn-danger text-sm">
                      Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {message && <p className="bujo-message text-sm">{message}</p>}

      <ConfirmDialog
        open={!!pendingDeleteId}
        title="Delete answer type?"
        description="This will remove the answer type immediately. Questions using this answer type will need to be updated."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmTone="danger"
        onConfirm={deleteAnswerType}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
