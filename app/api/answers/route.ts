import { NextResponse } from "next/server";
import { getEffectiveUser, getEffectiveSupabaseClient } from "@/lib/auth";

async function requireUser() {
  const supabase = await getEffectiveSupabaseClient();
  const { user } = await getEffectiveUser();
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

  // Separate answers into those to save and those to delete
  const answersToSave = answers.filter((a) => {
    // Only save answers that have actual values (not null/undefined/empty)
    if (a.value === null || a.value === undefined) return false;
    if (typeof a.value === "string" && a.value.trim() === "") return false;
    if (Array.isArray(a.value) && a.value.length === 0) return false;
    return true;
  });

  const answersToDelete = answers.filter((a) => {
    // Delete answers that are now empty
    if (a.value === null || a.value === undefined) return true;
    if (typeof a.value === "string" && a.value.trim() === "") return true;
    if (Array.isArray(a.value) && a.value.length === 0) return true;
    return false;
  });

  // Delete empty answers first
  if (answersToDelete.length > 0) {
    const deleteConditions = answersToDelete.map((a) => ({
      user_id: user.id,
      template_id: a.template_id,
      question_date,
    }));
    const { error: deleteError } = await supabase
      .from("answers")
      .delete()
      .eq("user_id", user.id)
      .eq("question_date", question_date)
      .in("template_id", answersToDelete.map((a) => a.template_id));
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }
  }

  // Save non-empty answers
  if (answersToSave.length > 0) {
    const rows = answersToSave.map((a) => {
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
          // If value is false, store as bool_value: false
          // If value is true or an array, store JSON array in text_value
          if (a.value === false) {
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
          return { ...base, emoji_value: String(a.value) };
        default:
          return { ...base, text_value: String(a.value) };
      }
    });

    const { error: upsertError } = await supabase
      .from("answers")
      .upsert(rows, { onConflict: "user_id,template_id,question_date" });
    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 400 });
    }
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const questionDate = url.searchParams.get("question_date");
  const templateId = url.searchParams.get("template_id");

  if (!questionDate) {
    return NextResponse.json({ error: "question_date parameter is required" }, { status: 400 });
  }

  let query = supabase
    .from("answers")
    .delete()
    .eq("user_id", user.id)
    .eq("question_date", questionDate);

  // If template_id is provided, only delete that specific answer
  // Otherwise, delete all answers for the given date
  if (templateId) {
    query = query.eq("template_id", templateId);
  }

  const { error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
