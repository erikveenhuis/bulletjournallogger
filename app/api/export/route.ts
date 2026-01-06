import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("answers")
    .select("*, question_templates(title,type, categories(name))")
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
    question_templates: { title: string | null; type: string | null; categories?: { name: string | null } } | null;
    bool_value: boolean | null;
    number_value: number | null;
    scale_value: number | null;
    emoji_value: string | null;
    text_value: string | null;
    prompt_snapshot: string | null;
    category_snapshot: string | null;
  };

  const rows = data.map((row) => {
    const value =
      row.bool_value ??
      row.number_value ??
      row.scale_value ??
      row.emoji_value ??
      row.text_value ??
      "";
    return [
      (row as AnswerRow).question_date,
      row.question_templates?.title ?? "",
      row.question_templates?.categories?.name ?? "",
      row.question_templates?.type ?? "",
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
