import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  let query = supabase
    .from("answers")
    .select("*, question_templates(title,category_id, categories(name), answer_types(*))")
    .eq("user_id", user.id)
    .order("question_date", { ascending: false });
  if (start) query = query.gte("question_date", start);
  if (end) query = query.lte("question_date", end);
  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const { question_date, answers } = body as {
    question_date: string;
    answers: Array<{
      template_id: string;
      type: string;
      value: unknown;
      prompt_snapshot?: string;
      category_snapshot?: string;
    }>;
  };

  const rows = answers.map((a) => {
    const base = {
      user_id: user.id,
      template_id: a.template_id,
      question_date,
      prompt_snapshot: a.prompt_snapshot ?? null,
      category_snapshot: a.category_snapshot ?? null,
    };
    switch (a.type) {
      case "boolean":
        return { ...base, bool_value: !!a.value };
      case "yes_no_list":
        // If value is false or null, store as bool_value: false
        // If value is true or an array, store JSON array in text_value
        if (a.value === false || a.value === null) {
          return { ...base, bool_value: false };
        }
        if (Array.isArray(a.value)) {
          return { ...base, text_value: JSON.stringify(a.value) };
        }
        // If value is true but not an array yet, store empty array
        if (a.value === true) {
          return { ...base, text_value: JSON.stringify([]) };
        }
        return { ...base, text_value: JSON.stringify(a.value) };
      case "number":
        return { ...base, number_value: Number(a.value) };
      case "scale":
        return { ...base, scale_value: Number(a.value) };
      case "emoji":
        return { ...base, emoji_value: String(a.value ?? "") };
      default:
        return { ...base, text_value: String(a.value ?? "") };
    }
  });

  const { error } = await supabase
    .from("answers")
    .upsert(rows, { onConflict: "user_id,template_id,question_date" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
