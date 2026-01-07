"use client";

import { useMemo, useState } from "react";
import type { Category, QuestionTemplate, UserQuestion } from "@/lib/types";

type Props = {
  categories: Category[];
  templates: QuestionTemplate[];
  userQuestions: UserQuestion[];
};

export default function TemplatesClient({
  categories,
  templates,
  userQuestions,
}: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const selectedTemplateIds = new Set(userQuestions.map((u) => u.template_id));

  const filtered = useMemo(() => {
    return templates.filter((t) => {
      const matchesQuery = t.title.toLowerCase().includes(query.toLowerCase());
      const matchesCategory = category === "all" || t.category_id === category;
      return matchesQuery && matchesCategory;
    });
  }, [templates, query, category]);

  const addTemplate = async (template_id: string) => {
    setLoadingId(template_id);
    await fetch("/api/user-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template_id }),
    });
    setLoadingId(null);
    window.location.reload();
  };

  return (
    <section className="bujo-card bujo-torn">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Browse templates</h2>
          <p className="text-sm text-gray-700">Search categories and add questions to your daily list.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <input
            placeholder="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bujo-input w-full min-w-0 sm:w-48"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bujo-input w-full min-w-0 sm:w-40"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {filtered.map((t) => (
          <div key={t.id} className="bujo-question space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">{t.title}</p>
                <p className="text-xs text-gray-600">
                  {t.type} •{" "}
                  {categories.find((c) => c.id === t.category_id)?.name ||
                    "Uncategorized"}
                </p>
              </div>
              <button
                disabled={selectedTemplateIds.has(t.id) || loadingId === t.id}
                onClick={() => addTemplate(t.id)}
                className="bujo-btn text-xs disabled:cursor-not-allowed disabled:opacity-70"
              >
                {selectedTemplateIds.has(t.id)
                  ? "Added"
                  : loadingId === t.id
                    ? "Adding..."
                    : "Add"}
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-gray-600">No templates match.</p>
        )}
      </div>
    </section>
  );
}
