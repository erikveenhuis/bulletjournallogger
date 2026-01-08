"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AnswerType } from "@/lib/types";

type Props = {
  mode: "create" | "edit";
  initialData?: AnswerType;
};

const answerTypeOptions: AnswerType["type"][] = ["boolean", "number", "scale", "text", "emoji", "yes_no_list"];

const needsItems = (t: AnswerType["type"]) => t === "boolean" || t === "emoji" || t === "yes_no_list";
const needsMeta = (t: AnswerType["type"]) => t === "scale" || t === "emoji" || t === "number";
const isFixedItems = (t: AnswerType["type"]) => t === "boolean";

export default function AnswerTypeForm({ mode, initialData }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [type, setType] = useState<AnswerType["type"]>(initialData?.type ?? "boolean");
  const [items, setItems] = useState<string[]>(
    initialData?.type === "boolean" || !initialData ? ["Yes", "No"] : initialData.items ?? [],
  );
  const [meta, setMeta] = useState(() => JSON.stringify(initialData?.meta ?? {}));
  const [newItem, setNewItem] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const addItem = () => {
    if (!newItem.trim()) return;
    setItems((prev) => [...prev, newItem.trim()]);
    setNewItem("");
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const submit = async () => {
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
        setItems(["Yes", "No"]);
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

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      type,
      items: type === "boolean" ? ["Yes", "No"] : needsItems(type) ? items : null,
      meta: metaJson,
    } as Partial<AnswerType> & { id?: string };

    if (mode === "edit" && initialData?.id) {
      payload.id = initialData.id;
    }

    setSubmitting(true);
    const res = await fetch("/api/answer-types", {
      method: mode === "create" ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || `Could not ${mode === "create" ? "add" : "update"} answer type`);
      setSubmitting(false);
      return;
    }

    router.push("/admin/answer-types");
    router.refresh();
  };

  return (
    <div className="bujo-card bujo-torn">
      <h2 className="text-lg font-semibold text-[var(--bujo-ink)]">
        {mode === "create" ? "Add answer type" : "Edit answer type"}
      </h2>
      <div className="mt-3 space-y-3">
        <input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bujo-input"
        />
        <input
          placeholder="Description"
          value={description ?? ""}
          onChange={(e) => setDescription(e.target.value)}
          className="bujo-input"
        />
        <select
          value={type}
          onChange={(e) => {
            const newType = e.target.value as AnswerType["type"];
            setType(newType);
            if (newType === "boolean") {
              setItems(["Yes", "No"]);
            } else if (!needsItems(newType)) {
              setItems([]);
            }
          }}
          className="bujo-input"
        >
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
                <p className="mb-2 text-sm text-[var(--bujo-subtle)]">Boolean types are fixed to Yes/No.</p>
                <div className="space-y-1">
                  {["Yes", "No"].map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-2 rounded-md border border-[var(--bujo-border)] bg-white p-2"
                    >
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
                      <div
                        key={`${item}-${index}`}
                        className="flex items-center gap-2 rounded-md border border-[var(--bujo-border)] bg-white p-2"
                      >
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

        <div className="flex flex-wrap gap-2">
          <button
            onClick={submit}
            className="bujo-btn text-sm"
            disabled={submitting}
          >
            {submitting ? "Saving..." : mode === "create" ? "Add answer type" : "Save changes"}
          </button>
          <button
            type="button"
            className="bujo-btn-secondary text-sm"
            onClick={() => router.push("/admin/answer-types")}
            disabled={submitting}
          >
            Cancel
          </button>
        </div>

        {message && <p className="bujo-message text-sm">{message}</p>}
      </div>
    </div>
  );
}
