import { NextResponse } from "next/server";
import { getEffectiveUser, getEffectiveSupabaseClient } from "@/lib/auth";
import type { DisplayOption } from "@/lib/types";

async function requireUser() {
  const supabase = await getEffectiveSupabaseClient();
  const { user } = await getEffectiveUser();
  return { supabase, user };
}

const allowedDisplayOptions: DisplayOption[] = ["graph", "list", "grid", "count"];

function normalizePalette(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const allowedKeys = [
    "accent",
    "accentSoft",
    "booleanYes",
    "booleanNo",
    "scaleLow",
    "scaleHigh",
    "cardBackground",
    "cardText",
    "countBackground",
    "countAccent",
  ];
  const result: Record<string, unknown> = {};
  allowedKeys.forEach((k) => {
    const val = (input as Record<string, unknown>)[k];
    if (typeof val === "string") result[k] = val;
  });
  return result;
}

async function fetchTemplate(
  supabase: any,
  templateId: string,
) {
  return supabase
    .from("question_templates")
    .select("id, answer_type_id, allowed_answer_type_ids, default_display_option, allowed_display_options, default_colors")
    .eq("id", templateId)
    .maybeSingle();
}

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data, error } = await supabase
    .from("user_questions")
    .select(
      "*, template:question_templates(*, categories(name), answer_types(*)), answer_type_override:answer_types!answer_type_override_id(*)",
    )
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
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
  const {
    template_id,
    custom_label,
    sort_order = 0,
    answer_type_override_id,
    display_option_override,
    color_palette,
  } = body;
  if (!template_id) {
    return NextResponse.json({ error: "template_id is required" }, { status: 400 });
  }

  const { data: template, error: templateError } = await fetchTemplate(supabase, template_id);
  if (templateError) {
    return NextResponse.json({ error: templateError.message }, { status: 400 });
  }
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const allowedAnswerTypes =
    Array.isArray(template.allowed_answer_type_ids) && template.allowed_answer_type_ids.length > 0
      ? template.allowed_answer_type_ids
      : [template.answer_type_id];

  if (answer_type_override_id && !allowedAnswerTypes.includes(answer_type_override_id)) {
    return NextResponse.json({ error: "answer_type_override_id is not allowed for this question" }, { status: 400 });
  }

  const allowedDisplays =
    Array.isArray(template.allowed_display_options) && template.allowed_display_options.length > 0
      ? template.allowed_display_options
      : [template.default_display_option];

  if (
    display_option_override &&
    (typeof display_option_override !== "string" || !allowedDisplays.includes(display_option_override as DisplayOption))
  ) {
    return NextResponse.json({ error: "display_option_override is not allowed for this question" }, { status: 400 });
  }

  if (display_option_override && !allowedDisplayOptions.includes(display_option_override as DisplayOption)) {
    return NextResponse.json({ error: "display_option_override must be one of graph, list, grid, count" }, { status: 400 });
  }

  const normalizedPalette = normalizePalette(color_palette);

  const { error } = await supabase
    .from("user_questions")
    .upsert(
      {
        user_id: user.id,
        template_id,
        custom_label,
        sort_order,
        is_active: true,
        answer_type_override_id: answer_type_override_id ?? null,
        display_option_override: (display_option_override as DisplayOption | null) ?? null,
        color_palette: normalizedPalette,
      },
      { onConflict: "user_id,template_id" },
    );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}

export async function PUT(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    id,
    template_id,
    custom_label,
    sort_order,
    is_active,
    answer_type_override_id,
    display_option_override,
    color_palette,
  } = body;

  const updates: Record<string, unknown> = {};
  if (custom_label !== undefined) updates.custom_label = custom_label;
  if (sort_order !== undefined) updates.sort_order = sort_order;
  if (is_active !== undefined) updates.is_active = is_active;

  let targetTemplateId: string | null = template_id || null;

  if (!targetTemplateId && id) {
    const { data: row, error: rowError } = await supabase
      .from("user_questions")
      .select("template_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (rowError) {
      return NextResponse.json({ error: rowError.message }, { status: 400 });
    }
    if (!row) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }
    targetTemplateId = row.template_id;
  }

  if (!targetTemplateId) {
    return NextResponse.json({ error: "template_id is required" }, { status: 400 });
  }

  const { data: template, error: templateError } = await fetchTemplate(supabase, targetTemplateId);
  if (templateError) {
    return NextResponse.json({ error: templateError.message }, { status: 400 });
  }
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const allowedAnswerTypes =
    Array.isArray(template.allowed_answer_type_ids) && template.allowed_answer_type_ids.length > 0
      ? template.allowed_answer_type_ids
      : [template.answer_type_id];

  if (answer_type_override_id !== undefined) {
    if (answer_type_override_id && !allowedAnswerTypes.includes(answer_type_override_id)) {
      return NextResponse.json({ error: "answer_type_override_id is not allowed for this question" }, { status: 400 });
    }
    updates.answer_type_override_id = answer_type_override_id ?? null;
  }

  const allowedDisplays =
    Array.isArray(template.allowed_display_options) && template.allowed_display_options.length > 0
      ? template.allowed_display_options
      : [template.default_display_option];

  if (display_option_override !== undefined) {
    if (
      display_option_override &&
      (typeof display_option_override !== "string" || !allowedDisplays.includes(display_option_override as DisplayOption))
    ) {
      return NextResponse.json({ error: "display_option_override is not allowed for this question" }, { status: 400 });
    }
    if (display_option_override && !allowedDisplayOptions.includes(display_option_override as DisplayOption)) {
      return NextResponse.json({ error: "display_option_override must be one of graph, list, grid, count" }, { status: 400 });
    }
    updates.display_option_override = (display_option_override as DisplayOption | null) ?? null;
  }

  if (color_palette !== undefined) {
    updates.color_palette = normalizePalette(color_palette);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  if (id) {
    const { error } = await supabase.from("user_questions").update(updates).eq("id", id).eq("user_id", user.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  }

  const { error } = await supabase
    .from("user_questions")
    .upsert(
      {
        user_id: user.id,
        template_id: targetTemplateId,
        ...updates,
      },
      { onConflict: "user_id,template_id" },
    );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const { error } = await supabase
    .from("user_questions")
    .delete()
    .eq("user_id", user.id)
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
