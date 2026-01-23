import { NextResponse } from "next/server";
import { getEffectiveUser, getEffectiveSupabaseClient } from "@/lib/auth";

export async function GET() {
  const supabase = await getEffectiveSupabaseClient();
  const { user } = await getEffectiveUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("answers")
    .select("*, answer_types(type), question_templates(title, categories(name), answer_types(type))")
    .eq("user_id", user.id)
    .order("question_date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const headers = [
    "date",
    "question",
    "category",
    "type",
    "value",
    "prompt_snapshot",
    "category_snapshot",
  ];
  type AnswerRow = {
    question_date: string;
    answer_types?: { type: string | null } | null;
    question_templates: {
      title: string | null;
      categories?: { name: string | null };
      answer_types?: { type: string | null } | null;
    } | null;
    bool_value: boolean | null;
    number_value: number | null;
    scale_value: number | null;
    text_value: string | null;
    prompt_snapshot: string | null;
    category_snapshot: string | null;
  };

  const rows = data.map((row) => {
    const type =
      (row as AnswerRow).answer_types?.type ?? row.question_templates?.answer_types?.type ?? "";
    let value: string | number | boolean = "";
    if (type === "multi_choice" && row.text_value) {
      try {
        const parsed = JSON.parse(row.text_value);
        if (Array.isArray(parsed)) {
          value = parsed.map((entry) => String(entry)).join(", ");
        } else {
          value = row.text_value ?? "";
        }
      } catch {
        value = row.text_value ?? "";
      }
    } else if (type === "single_choice" || type === "text") {
      value = row.text_value ?? "";
    } else {
      value =
        row.bool_value ??
        row.number_value ??
        row.scale_value ??
        row.text_value ??
        "";
    }
    return [
      (row as AnswerRow).question_date,
      row.question_templates?.title ?? "",
      row.question_templates?.categories?.name ?? "",
      type,
      value,
      row.prompt_snapshot ?? "",
      row.category_snapshot ?? "",
    ]
      .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
      .join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="answers.csv"',
    },
  });
}
