import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { DisplayOption } from "@/lib/types";

async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

async function requireAdmin(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
) {
  const { data } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("user_id", userId)
    .single();
  return !!data?.is_admin;
}

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const url = new URL(request.url);
  const categoryId = url.searchParams.get("category_id");
  let query = supabase
    .from("question_templates")
    .select("*, categories(name), answer_types(*)");
  if (categoryId) {
    query = query.eq("category_id", categoryId);
  }
  query = query.eq("is_active", true).order("title", { ascending: true });
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
  const isAdmin = await requireAdmin(supabase, user.id);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const {
    title,
    category_id,
    meta,
    is_active = true,
    answer_type_id,
    allowed_answer_type_ids,
    default_display_option,
    allowed_display_options,
    default_colors,
  } = body;
  if (!answer_type_id) {
    return NextResponse.json({ error: "answer_type_id is required" }, { status: 400 });
  }

  const normalizedAllowedTypes =
    Array.isArray(allowed_answer_type_ids) && allowed_answer_type_ids.length > 0
      ? Array.from(new Set(allowed_answer_type_ids.filter((v) => typeof v === "string")))
      : [];

  const allowedDisplayOptions: DisplayOption[] =
    Array.isArray(allowed_display_options) && allowed_display_options.length > 0
      ? (Array.from(
          new Set(
            allowed_display_options.filter((v: unknown): v is DisplayOption =>
              ["graph", "list", "grid", "count"].includes(String(v)),
            ),
          ),
        ) as DisplayOption[])
      : [];

  const defaultDisplay: DisplayOption = (() => {
    const fallback = "graph" as DisplayOption;
    if (typeof default_display_option === "string" && ["graph", "list", "grid", "count"].includes(default_display_option)) {
      return default_display_option as DisplayOption;
    }
    return fallback;
  })();

  if (normalizedAllowedTypes.length > 0 && !normalizedAllowedTypes.includes(answer_type_id)) {
    normalizedAllowedTypes.push(answer_type_id);
  }

  const displayOptionsToPersist =
    allowedDisplayOptions.length > 0 ? allowedDisplayOptions : ([defaultDisplay] as DisplayOption[]);

  if (displayOptionsToPersist.length > 0 && !displayOptionsToPersist.includes(defaultDisplay)) {
    displayOptionsToPersist.push(defaultDisplay);
  }

  const normalizedDefaultColors = default_colors && typeof default_colors === "object" && !Array.isArray(default_colors) ? default_colors : {};
  const { error } = await supabase.from("question_templates").insert({
    title,
    category_id,
    meta,
    is_active,
    answer_type_id,
    allowed_answer_type_ids: normalizedAllowedTypes,
    default_display_option: defaultDisplay,
    allowed_display_options: displayOptionsToPersist,
    default_colors: normalizedDefaultColors,
    created_by: user.id,
  });
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
  const isAdmin = await requireAdmin(supabase, user.id);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const {
    id,
    title,
    category_id,
    meta,
    is_active,
    answer_type_id,
    allowed_answer_type_ids,
    default_display_option,
    allowed_display_options,
    default_colors,
  } = body;
  if (!id) {
    return NextResponse.json({ error: "Template id is required" }, { status: 400 });
  }

  const { data: existingTemplate, error: fetchError } = await supabase
    .from("question_templates")
    .select("allowed_display_options, allowed_answer_type_ids, answer_type_id, default_display_option")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 400 });
  }
  if (!existingTemplate) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title;
  if (category_id !== undefined) updates.category_id = category_id;
  if (meta !== undefined) updates.meta = meta;
  if (is_active !== undefined) updates.is_active = is_active;
  if (answer_type_id !== undefined) updates.answer_type_id = answer_type_id;

  if (allowed_answer_type_ids !== undefined) {
    const normalized =
      Array.isArray(allowed_answer_type_ids) && allowed_answer_type_ids.length > 0
        ? Array.from(new Set(allowed_answer_type_ids.filter((v) => typeof v === "string")))
        : [];
    const targetAnswerType = (answer_type_id as string | undefined) ?? (existingTemplate.answer_type_id as string | undefined);
    if (targetAnswerType && normalized.length > 0 && !normalized.includes(targetAnswerType)) {
      normalized.push(targetAnswerType);
    }
    updates.allowed_answer_type_ids = normalized;
  }

  if (default_display_option !== undefined) {
    if (typeof default_display_option !== "string" || !["graph", "list", "grid", "count"].includes(default_display_option)) {
      return NextResponse.json({ error: "default_display_option must be one of graph, list, grid, count" }, { status: 400 });
    }
    updates.default_display_option = default_display_option;
  }

  if (allowed_display_options !== undefined) {
    const normalized =
      Array.isArray(allowed_display_options) && allowed_display_options.length > 0
        ? Array.from(
            new Set(
              allowed_display_options.filter((v: unknown): v is DisplayOption =>
                ["graph", "list", "grid", "count"].includes(String(v)),
              ),
            ),
          )
        : [];
    const targetDefault =
      (updates.default_display_option as DisplayOption | undefined) ||
      (default_display_option as DisplayOption | undefined) ||
      (existingTemplate.default_display_option as DisplayOption | undefined);
    if (targetDefault && !normalized.includes(targetDefault)) {
      normalized.push(targetDefault);
    }
    updates.allowed_display_options = normalized;
  } else if (updates.default_display_option) {
    // Ensure the new default is present in the existing allowed set
    const currentAllowed = Array.isArray(existingTemplate.allowed_display_options)
      ? [...existingTemplate.allowed_display_options]
      : [];
    if (!currentAllowed.includes(updates.default_display_option as DisplayOption)) {
      updates.allowed_display_options = [...currentAllowed, updates.default_display_option as DisplayOption];
    }
  }

  if (default_colors !== undefined) {
    if (default_colors !== null && (typeof default_colors !== "object" || Array.isArray(default_colors))) {
      return NextResponse.json({ error: "default_colors must be an object" }, { status: 400 });
    }
    updates.default_colors = default_colors ?? {};
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { error } = await supabase.from("question_templates").update(updates).eq("id", id);
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
  const isAdmin = await requireAdmin(supabase, user.id);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { id } = body;
  if (!id) {
    return NextResponse.json({ error: "Template id is required" }, { status: 400 });
  }

  const { error } = await supabase.from("question_templates").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}