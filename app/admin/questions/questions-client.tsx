"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnswerType, Category, DisplayOption, QuestionTemplate } from "@/lib/types";
import ConfirmDialog from "@/components/confirm-dialog";

type Props = {
  categories: Category[];
  answerTypes: AnswerType[];
  templates: QuestionTemplate[];
};

export default function AdminForms({ categories, answerTypes, templates }: Props) {
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [answerTypeId, setAnswerTypeId] = useState("");
  const [meta, setMeta] = useState("{}");
  const [allowedAnswerTypeIds, setAllowedAnswerTypeIds] = useState<string[]>([]);
  const [defaultDisplayOption, setDefaultDisplayOption] = useState<DisplayOption>("graph");
  const [allowedDisplayOptions, setAllowedDisplayOptions] = useState<DisplayOption[]>(["graph"]);
  const [defaultColors, setDefaultColors] = useState("{}");
  const [message, setMessage] = useState<string | null>(null);
  const [templateEdits, setTemplateEdits] = useState<
    Record<
      string,
      {
        title: string;
        category_id: string | null;
        meta: string;
        is_active: boolean;
        answer_type_id: string;
        allowed_answer_type_ids: string[];
        default_display_option: DisplayOption;
        allowed_display_options: DisplayOption[];
        default_colors: string;
      }
    >
  >({});
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const displayOptions: DisplayOption[] = useMemo(() => ["graph", "list", "grid", "count"], []);

  const categoryNameById = (id: string | null) => {
    if (!id) return "";
    const match = categories.find((c) => c.id === id);
    return match?.name ?? "";
  };

  const answerTypeNameById = (id: string | null) => {
    if (!id) return "";
    const match = answerTypes.find((at) => at.id === id);
    return match?.name ?? "";
  };

  const filteredTemplates = templates.filter((t) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      t.title.toLowerCase().includes(q) ||
      categoryNameById(t.category_id)?.toLowerCase().includes(q) ||
      answerTypeNameById(t.answer_type_id)?.toLowerCase().includes(q) ||
      (t.answer_types?.type ?? "").toLowerCase().includes(q)
    );
  });

  const toggleAllowedAnswerType = (current: string[], id: string) => {
    if (current.includes(id)) {
      return current.filter((val) => val !== id);
    }
    return [...current, id];
  };

  const toggleDisplayOption = (current: DisplayOption[], value: DisplayOption, fallback: DisplayOption) => {
    if (current.includes(value)) {
      const next = current.filter((v) => v !== value);
      return next.length === 0 ? [fallback] : next;
    }
    return [...current, value];
  };

  useEffect(() => {
    const nextTemplateEdits: Record<
      string,
      {
        title: string;
        category_id: string | null;
        meta: string;
        is_active: boolean;
        answer_type_id: string;
        allowed_answer_type_ids: string[];
        default_display_option: DisplayOption;
        allowed_display_options: DisplayOption[];
        default_colors: string;
      }
    > = {};
    templates.forEach((t) => {
      nextTemplateEdits[t.id] = {
        title: t.title,
        category_id: t.category_id ?? "",
        meta: JSON.stringify(t.meta ?? {}),
        is_active: !!t.is_active,
        answer_type_id: t.answer_type_id,
        allowed_answer_type_ids: t.allowed_answer_type_ids || [],
        default_display_option: (t.default_display_option as DisplayOption) || "graph",
        allowed_display_options:
          (t.allowed_display_options as DisplayOption[] | null | undefined)?.filter((opt): opt is DisplayOption =>
            displayOptions.includes(opt as DisplayOption),
          ) || ["graph"],
        default_colors: JSON.stringify(t.default_colors ?? {}),
      };
    });
    setTemplateEdits(nextTemplateEdits);
  }, [templates, displayOptions]);

  const addTemplate = async () => {
    setMessage(null);
    if (!answerTypeId) {
      setMessage("Answer type is required");
      return;
    }
    let metaJson: Record<string, unknown> = {};
    try {
      metaJson = JSON.parse(meta || "{}");
    } catch {
      setMessage("Meta must be valid JSON");
      return;
    }

    const normalizedAllowedTypes = Array.from(new Set([answerTypeId, ...allowedAnswerTypeIds.filter(Boolean)]));
    const normalizedDisplayOptions =
      allowedDisplayOptions.length > 0 ? Array.from(new Set([...allowedDisplayOptions, defaultDisplayOption])) : [defaultDisplayOption];

    let parsedColors: Record<string, unknown> = {};
    if (defaultColors.trim()) {
      try {
        const parsed = JSON.parse(defaultColors);
        if (typeof parsed === "object" && !Array.isArray(parsed)) {
          parsedColors = parsed;
        }
      } catch {
        setMessage("Default colors must be valid JSON");
        return;
      }
    }

    const res = await fetch("/api/question-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        category_id: categoryId || null,
        meta: metaJson,
        answer_type_id: answerTypeId,
        allowed_answer_type_ids: normalizedAllowedTypes,
        default_display_option: defaultDisplayOption,
        allowed_display_options: normalizedDisplayOptions,
        default_colors: parsedColors,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Could not add template");
      return;
    }
    setMessage("Template added");
    setTitle("");
    setCategoryId("");
    setAnswerTypeId("");
    setMeta("{}");
    window.location.reload();
  };

  const updateTemplate = async (id: string) => {
    setMessage(null);
    const edit = templateEdits[id];
    if (!edit) return;
    if (!edit.answer_type_id) {
      setMessage("Answer type is required");
      return;
    }

    let metaJson: Record<string, unknown> = {};
    try {
      metaJson = JSON.parse(edit.meta || "{}");
    } catch {
      setMessage("Meta must be valid JSON");
      return;
    }

    let parsedDefaultColors: Record<string, unknown> = {};
    if (edit.default_colors.trim()) {
      try {
        const parsed = JSON.parse(edit.default_colors);
        if (typeof parsed === "object" && !Array.isArray(parsed)) {
          parsedDefaultColors = parsed;
        }
      } catch {
        setMessage("Default colors must be valid JSON");
        return;
      }
    }

    const res = await fetch("/api/question-templates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        title: edit.title,
        category_id: edit.category_id || null,
        meta: metaJson,
        is_active: edit.is_active,
        answer_type_id: edit.answer_type_id,
        allowed_answer_type_ids: edit.allowed_answer_type_ids,
        default_display_option: edit.default_display_option,
        allowed_display_options: edit.allowed_display_options,
        default_colors: parsedDefaultColors,
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

  const deleteTemplate = async () => {
    if (!pendingDeleteId) return;
    setMessage(null);
    const res = await fetch("/api/question-templates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: pendingDeleteId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Could not delete template");
      setPendingDeleteId(null);
      return;
    }
    setMessage("Template deleted");
    setPendingDeleteId(null);
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <div className="bujo-card bujo-torn">
        <h2 className="text-lg font-semibold text-[var(--bujo-ink)]">Add template</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bujo-input"
            />
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="bujo-input"
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={answerTypeId}
              onChange={(e) => setAnswerTypeId(e.target.value)}
              className="bujo-input"
            >
              <option value="">Select answer type (required)</option>
              {answerTypes.map((at) => (
                <option key={at.id} value={at.id}>
                  {at.name} ({at.type})
                </option>
              ))}
            </select>
            <div className="space-y-1 rounded-md border border-[var(--bujo-border)] p-2 text-xs">
              <p className="font-semibold text-[var(--bujo-ink)]">Allowed answer types</p>
              <p className="text-[var(--bujo-subtle)]">Pick alternates users can switch to.</p>
              <div className="grid grid-cols-2 gap-2">
                {answerTypes.map((at) => (
                  <label key={at.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={allowedAnswerTypeIds.includes(at.id) || at.id === answerTypeId}
                      onChange={() =>
                        setAllowedAnswerTypeIds((prev) =>
                          at.id === answerTypeId ? prev : toggleAllowedAnswerType(prev, at.id),
                        )
                      }
                      className="bujo-range"
                    />
                    <span>
                      {at.name} <span className="text-[var(--bujo-subtle)]">({at.type})</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--bujo-ink)]">Default display</label>
                <select
                  value={defaultDisplayOption}
                  onChange={(e) => setDefaultDisplayOption(e.target.value as DisplayOption)}
                  className="bujo-input text-sm"
                >
                  {displayOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-[var(--bujo-ink)]">Allowed displays</p>
                <div className="flex flex-wrap gap-2">
                  {displayOptions.map((opt) => (
                    <label key={opt} className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={allowedDisplayOptions.includes(opt)}
                        onChange={() =>
                          setAllowedDisplayOptions((prev) => toggleDisplayOption(prev, opt, defaultDisplayOption))
                        }
                        className="bujo-range"
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <textarea
              placeholder='Meta JSON e.g. {}'
              value={meta}
              onChange={(e) => setMeta(e.target.value)}
              rows={5}
              className="bujo-input"
            />
            <textarea
              placeholder='Default colors JSON e.g. {"accent":"#5f8b7a"}'
              value={defaultColors}
              onChange={(e) => setDefaultColors(e.target.value)}
              rows={4}
              className="bujo-input text-xs"
            />
            <button
              onClick={addTemplate}
              className="bujo-btn w-full text-sm"
            >
              Add template
            </button>
          </div>
        </div>
      </div>

      <div className="bujo-card bujo-torn">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-[var(--bujo-ink)]">Manage templates</h2>
            <span className="bujo-chip text-xs">
              {filteredTemplates.length} / {templates.length} shown
            </span>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by title, category, or answer type"
            className="bujo-input w-full max-w-xs text-sm"
          />
        </div>
        <div className="mt-3 space-y-4">
          {filteredTemplates.length === 0 ? (
            <p className="text-sm text-[var(--bujo-subtle)]">No templates yet.</p>
          ) : (
            filteredTemplates.map((t) => (
              <div
                key={t.id}
                className="space-y-2 rounded-md border border-[var(--bujo-border)] bg-[var(--bujo-paper)] p-3"
              >
                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    value={templateEdits[t.id]?.title ?? ""}
                    onChange={(e) =>
                      setTemplateEdits((prev) => ({ ...prev, [t.id]: { ...prev[t.id], title: e.target.value } }))
                    }
                    className="bujo-input text-sm"
                  />
                  <select
                    value={templateEdits[t.id]?.category_id ?? ""}
                    onChange={(e) =>
                      setTemplateEdits((prev) => ({
                        ...prev,
                        [t.id]: { ...prev[t.id], category_id: e.target.value },
                      }))
                    }
                    className="bujo-input text-sm"
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
                    value={templateEdits[t.id]?.answer_type_id ?? ""}
                    onChange={(e) =>
                      setTemplateEdits((prev) => ({
                        ...prev,
                        [t.id]: { ...prev[t.id], answer_type_id: e.target.value },
                      }))
                    }
                    className="bujo-input text-sm"
                  >
                    <option value="">Select answer type (required)</option>
                    {answerTypes.map((at) => (
                      <option key={at.id} value={at.id}>
                        {at.name} ({at.type})
                      </option>
                    ))}
                  </select>
                  <select
                    value={templateEdits[t.id]?.default_display_option ?? "graph"}
                    onChange={(e) =>
                      setTemplateEdits((prev) => ({
                        ...prev,
                        [t.id]: {
                          ...prev[t.id],
                          default_display_option: e.target.value as DisplayOption,
                          allowed_display_options: prev[t.id].allowed_display_options.includes(
                            e.target.value as DisplayOption,
                          )
                            ? prev[t.id].allowed_display_options
                            : [...prev[t.id].allowed_display_options, e.target.value as DisplayOption],
                        },
                      }))
                    }
                    className="bujo-input text-sm"
                  >
                    {displayOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-sm text-[var(--bujo-ink)]">
                    <input
                      type="checkbox"
                      checked={!!templateEdits[t.id]?.is_active}
                      onChange={(e) =>
                        setTemplateEdits((prev) => ({
                          ...prev,
                          [t.id]: { ...prev[t.id], is_active: e.target.checked },
                        }))
                      }
                      className="bujo-range"
                    />
                    Active
                  </label>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="space-y-1 rounded-md border border-[var(--bujo-border)] p-2 text-xs">
                    <p className="font-semibold text-[var(--bujo-ink)]">Allowed answer types</p>
                    <div className="grid grid-cols-2 gap-2">
                      {answerTypes.map((at) => {
                        const defaultId = templateEdits[t.id]?.answer_type_id;
                        const current = templateEdits[t.id]?.allowed_answer_type_ids || [];
                        const checked = current.includes(at.id) || at.id === defaultId;
                        return (
                          <label key={at.id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setTemplateEdits((prev) => {
                                  const next = toggleAllowedAnswerType(current, at.id);
                                  const withDefault =
                                    defaultId && !next.includes(defaultId) ? [...next, defaultId] : next;
                                  return { ...prev, [t.id]: { ...prev[t.id], allowed_answer_type_ids: withDefault } };
                                })
                              }
                              className="bujo-range"
                            />
                            <span>
                              {at.name} <span className="text-[var(--bujo-subtle)]">({at.type})</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-1 rounded-md border border-[var(--bujo-border)] p-2 text-xs">
                    <p className="font-semibold text-[var(--bujo-ink)]">Allowed displays</p>
                    <div className="flex flex-wrap gap-2">
                      {displayOptions.map((opt) => {
                        const current = templateEdits[t.id]?.allowed_display_options || [];
                        const fallback = templateEdits[t.id]?.default_display_option || "graph";
                        return (
                          <label key={opt} className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={current.includes(opt)}
                              onChange={() =>
                                setTemplateEdits((prev) => ({
                                  ...prev,
                                  [t.id]: {
                                    ...prev[t.id],
                                    allowed_display_options: toggleDisplayOption(current, opt, fallback),
                                  },
                                }))
                              }
                              className="bujo-range"
                            />
                            <span>{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
                {t.answer_types && (
                  <div className="flex items-center gap-2 text-xs text-[var(--bujo-subtle)]">
                    <span className="bujo-chip">Type: {t.answer_types.type}</span>
                    <span className="bujo-chip">Answer Type: {t.answer_types.name}</span>
                  </div>
                )}
                <textarea
                  value={templateEdits[t.id]?.meta ?? "{}"}
                  onChange={(e) =>
                    setTemplateEdits((prev) => ({ ...prev, [t.id]: { ...prev[t.id], meta: e.target.value } }))
                  }
                  rows={3}
                  className="bujo-input text-sm"
                />
                <textarea
                  value={templateEdits[t.id]?.default_colors ?? "{}"}
                  onChange={(e) =>
                    setTemplateEdits((prev) => ({ ...prev, [t.id]: { ...prev[t.id], default_colors: e.target.value } }))
                  }
                  rows={3}
                  className="bujo-input text-xs"
                  placeholder="Default colors JSON"
                />
                <div className="flex gap-2">
                  <button onClick={() => updateTemplate(t.id)} className="bujo-btn flex-1 text-sm">
                    Update
                  </button>
                  <button onClick={() => setPendingDeleteId(t.id)} className="bujo-btn-danger text-sm">
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
        title="Delete question template?"
        description="This will remove the template immediately."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmTone="danger"
        onConfirm={deleteTemplate}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
