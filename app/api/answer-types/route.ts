import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

async function getProfileAccess(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
) {
  const { data } = await supabase
    .from("profiles")
    .select("is_admin, account_tier")
    .eq("user_id", userId)
    .single();
  const accountTier = typeof data?.account_tier === "number" ? data.account_tier : 0;
  return { isAdmin: !!data?.is_admin, accountTier };
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("answer_types")
    .select("*")
    .order("name", { ascending: true });
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
  const { isAdmin } = await getProfileAccess(supabase, user.id);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const adminClient = createAdminClient();

  const body = await request.json();
  const { name, description, type, items, meta, is_active } = body;
  const allowedTypes = ["boolean", "number", "text", "single_choice", "multi_choice"];
  if (!type || !allowedTypes.includes(type)) {
    return NextResponse.json({ error: "Type is required and must be one of: " + allowedTypes.join(", ") }, { status: 400 });
  }
  if (items !== undefined && items !== null && !Array.isArray(items)) {
    return NextResponse.json({ error: "Items must be an array or null" }, { status: 400 });
  }
  let metaJson: Record<string, unknown> = {};
  if (meta !== undefined) {
    if (typeof meta === "string") {
      try {
        metaJson = JSON.parse(meta);
      } catch {
        return NextResponse.json({ error: "Meta must be valid JSON" }, { status: 400 });
      }
    } else if (typeof meta === "object") {
      metaJson = meta;
    }
  }
  const { error } = await adminClient.from("answer_types").insert({
    name,
    description,
    type,
    items: items || null,
    meta: metaJson,
    ...(is_active !== undefined ? { is_active } : {}),
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
  const { isAdmin } = await getProfileAccess(supabase, user.id);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const adminClient = createAdminClient();

  const body = await request.json();
  const { id, name, description, type, items, meta, default_display_option, allowed_display_options, is_active } = body;
  if (!id) {
    return NextResponse.json({ error: "Answer type id is required" }, { status: 400 });
  }
  const updates: Record<string, unknown> = {};
  const allowedDisplayOptions = ["graph", "list", "grid", "count"];

  if (name !== undefined || description !== undefined || type !== undefined || items !== undefined || meta !== undefined) {
    return NextResponse.json(
      { error: "Admins can only update display options and active status for answer types." },
      { status: 403 },
    );
  }

  if (default_display_option !== undefined) {
    if (typeof default_display_option !== "string" || !allowedDisplayOptions.includes(default_display_option)) {
      return NextResponse.json(
        { error: "default_display_option must be one of graph, list, grid, count" },
        { status: 400 },
      );
    }
    updates.default_display_option = default_display_option;
  }

  if (allowed_display_options !== undefined) {
    const normalized =
      Array.isArray(allowed_display_options) && allowed_display_options.length > 0
        ? Array.from(
            new Set(
              allowed_display_options.filter((v: unknown): v is string =>
                allowedDisplayOptions.includes(String(v)),
              ),
            ),
          )
        : [];
    const targetDefault =
      (updates.default_display_option as string | undefined) ||
      (default_display_option as string | undefined) ||
      undefined;
    if (targetDefault && !normalized.includes(targetDefault)) {
      normalized.push(targetDefault);
    }
    updates.allowed_display_options = normalized;
  } else if (updates.default_display_option) {
    const { data: existing } = await adminClient
      .from("answer_types")
      .select("allowed_display_options")
      .eq("id", id)
      .maybeSingle();
    const currentAllowed = Array.isArray(existing?.allowed_display_options)
      ? [...existing.allowed_display_options]
      : [];
    if (!currentAllowed.includes(updates.default_display_option as string)) {
      updates.allowed_display_options = [...currentAllowed, updates.default_display_option as string];
    }
  }

  if (is_active !== undefined) {
    if (typeof is_active !== "boolean") {
      return NextResponse.json({ error: "is_active must be a boolean" }, { status: 400 });
    }
    updates.is_active = is_active;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data: updated, error } = await adminClient
    .from("answer_types")
    .update(updates)
    .eq("id", id)
    .select("id, default_display_option, allowed_display_options, is_active");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: "No answer type was updated." }, { status: 400 });
  }
  return NextResponse.json({ success: true, answer_type: updated[0] });
}

export async function DELETE(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { isAdmin } = await getProfileAccess(supabase, user.id);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const adminClient = createAdminClient();

  const body = await request.json();
  const { id } = body;
  if (!id) {
    return NextResponse.json({ error: "Answer type id is required" }, { status: 400 });
  }
  const { count, error: usageError } = await adminClient
    .from("question_templates")
    .select("id", { count: "exact", head: true })
    .eq("answer_type_id", id);

  if (usageError) {
    return NextResponse.json({ error: usageError.message }, { status: 400 });
  }

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "Cannot delete an answer type that is used by existing question templates." },
      { status: 400 },
    );
  }

  const { error } = await adminClient.from("answer_types").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
