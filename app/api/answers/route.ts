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
    .select("*, answer_types(*), question_templates(title,category_id, categories(name), answer_types(*))")
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
      answer_type_id?: string | null;
      value: unknown;
      prompt_snapshot?: string;
      category_snapshot?: string;
    }>;
  };
  if (!answers || answers.length === 0) {
    return NextResponse.json({ success: true });
  }

  const maxTextLength = 120;
  const defaultChoiceSteps = ["1", "2", "3", "4", "5"];
  const templateIds = Array.from(new Set(answers.map((a) => a.template_id)));
  const templateMetaMap = {} as Record<string, { type?: string; meta?: Record<string, unknown> }>;
  if (templateIds.length > 0) {
    const { data: templates, error: templateMetaError } = await supabase
      .from("question_templates")
      .select("id, meta, answer_types(type)")
      .in("id", templateIds);
    if (templateMetaError) {
      return NextResponse.json({ error: templateMetaError.message }, { status: 400 });
    }
    (templates || []).reduce<Record<string, { type?: string; meta?: Record<string, unknown> }>>(
    (acc, row) => {
      if (row?.id) {
        const answerType = Array.isArray(row.answer_types) ? row.answer_types[0] : row.answer_types;
        acc[row.id] = {
          type: answerType?.type ?? undefined,
          meta: (row.meta as Record<string, unknown> | null) ?? undefined,
        };
      }
      return acc;
    },
    templateMetaMap,
    );
  }

  const getChoiceSteps = (meta?: Record<string, unknown>) => {
    const rawSteps = meta?.steps;
    if (Array.isArray(rawSteps)) {
      const normalized = rawSteps.map((step) => String(step).trim()).filter((step) => step.length > 0);
      if (normalized.length >= 2) return normalized;
    }
    return defaultChoiceSteps;
  };

  const normalizeAnswer = (answer: (typeof answers)[number]) => {
    const templateMeta = templateMetaMap[answer.template_id];
    const resolvedType = templateMeta?.type ?? answer.type;
    const steps = resolvedType === "single_choice" || resolvedType === "multi_choice"
      ? getChoiceSteps(templateMeta?.meta)
      : [];
    const allowed = new Set(steps);
    const rawValue = answer.value;
    let value: unknown = null;

    switch (resolvedType) {
      case "boolean":
        value = rawValue === null || rawValue === undefined ? null : Boolean(rawValue);
        break;
      case "number": {
        if (rawValue === null || rawValue === undefined) {
          value = null;
          break;
        }
        if (typeof rawValue === "string" && rawValue.trim() === "") {
          value = null;
          break;
        }
        const numeric = typeof rawValue === "number" ? rawValue : Number(rawValue);
        value = Number.isNaN(numeric) ? null : numeric;
        break;
      }
      case "single_choice": {
        const candidate = Array.isArray(rawValue)
          ? rawValue[0]
          : rawValue === null || rawValue === undefined
            ? null
            : String(rawValue);
        if (!candidate) {
          value = null;
          break;
        }
        const normalized = String(candidate);
        value = allowed.has(normalized) ? normalized : null;
        break;
      }
      case "multi_choice": {
        let list: string[] = [];
        if (Array.isArray(rawValue)) {
          list = rawValue.map((entry) => String(entry));
        } else if (typeof rawValue === "string") {
          try {
            const parsed = JSON.parse(rawValue);
            if (Array.isArray(parsed)) {
              list = parsed.map((entry) => String(entry));
            } else {
              list = [rawValue];
            }
          } catch {
            list = [rawValue];
          }
        }
        const filtered = list.filter((entry) => allowed.has(entry));
        value = filtered;
        break;
      }
      case "text": {
        const text = rawValue === null || rawValue === undefined ? "" : String(rawValue);
        const trimmed = text.trim();
        value = trimmed.length === 0 ? null : trimmed.slice(0, maxTextLength);
        break;
      }
      default: {
        const text = rawValue === null || rawValue === undefined ? "" : String(rawValue);
        const trimmed = text.trim();
        value = trimmed.length === 0 ? null : trimmed;
        break;
      }
    }

    return { ...answer, value, type: resolvedType };
  };

  const normalizedAnswers = answers.map(normalizeAnswer);
  const answersToSave = normalizedAnswers.filter((a) => {
    if (a.value === null || a.value === undefined) return false;
    if (typeof a.value === "string" && a.value.trim() === "") return false;
    if (Array.isArray(a.value) && a.value.length === 0) return false;
    return true;
  });

  const answersToDelete = normalizedAnswers.filter((a) => {
    if (a.value === null || a.value === undefined) return true;
    if (typeof a.value === "string" && a.value.trim() === "") return true;
    if (Array.isArray(a.value) && a.value.length === 0) return true;
    return false;
  });

  // Delete empty answers first
  if (answersToDelete.length > 0) {
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
    const missingTypeIds = Array.from(
      new Set(
        answersToSave
          .filter((a) => !a.answer_type_id)
          .map((a) => a.template_id),
      ),
    );
    let templateAnswerTypeMap: Record<string, string> = {};
    if (missingTypeIds.length > 0) {
      const { data: templates, error: templateError } = await supabase
        .from("question_templates")
        .select("id, answer_type_id")
        .in("id", missingTypeIds);
      if (templateError) {
        return NextResponse.json({ error: templateError.message }, { status: 400 });
      }
      templateAnswerTypeMap = (templates || []).reduce<Record<string, string>>((acc, row) => {
        if (row?.id && row?.answer_type_id) {
          acc[row.id] = row.answer_type_id as string;
        }
        return acc;
      }, {});
    }

    const rows = answersToSave.map((a) => {
      const resolvedAnswerTypeId = a.answer_type_id ?? templateAnswerTypeMap[a.template_id] ?? null;
      const base = {
        user_id: user.id,
        template_id: a.template_id,
        answer_type_id: resolvedAnswerTypeId,
        question_date,
        prompt_snapshot: a.prompt_snapshot ?? null,
        category_snapshot: a.category_snapshot ?? null,
      };
      switch (a.type) {
        case "boolean":
          return { ...base, bool_value: !!a.value };
        case "number":
          return { ...base, number_value: Number(a.value) };
        case "single_choice":
          return { ...base, text_value: String(a.value) };
        case "multi_choice": {
          const normalized = Array.isArray(a.value) ? a.value.map((val) => String(val)) : [];
          return { ...base, text_value: JSON.stringify(normalized) };
        }
        case "text":
          return { ...base, text_value: String(a.value) };
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
