import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
  const isAdmin = await requireAdmin(supabase, user.id);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { name, description, type, items, meta } = body;
  const allowedTypes = ["boolean", "number", "scale", "text", "emoji", "yes_no_list"];
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
  const { error } = await supabase.from("answer_types").insert({
    name,
    description,
    type,
    items: items || null,
    meta: metaJson,
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
  const { id, name, description, type, items, meta } = body;
  if (!id) {
    return NextResponse.json({ error: "Answer type id is required" }, { status: 400 });
  }
  const allowedTypes = ["boolean", "number", "scale", "text", "emoji", "yes_no_list"];
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (type !== undefined) {
    if (!allowedTypes.includes(type)) {
      return NextResponse.json({ error: "Type must be one of: " + allowedTypes.join(", ") }, { status: 400 });
    }
    updates.type = type;
  }
  if (items !== undefined) {
    if (items !== null && !Array.isArray(items)) {
      return NextResponse.json({ error: "Items must be an array or null" }, { status: 400 });
    }
    updates.items = items;
  }
  if (meta !== undefined) {
    let metaJson: Record<string, unknown> = {};
    if (typeof meta === "string") {
      try {
        metaJson = JSON.parse(meta);
      } catch {
        return NextResponse.json({ error: "Meta must be valid JSON" }, { status: 400 });
      }
    } else if (typeof meta === "object") {
      metaJson = meta;
    }
    updates.meta = metaJson;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { error } = await supabase.from("answer_types").update(updates).eq("id", id);
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
    return NextResponse.json({ error: "Answer type id is required" }, { status: 400 });
  }

  const { error } = await supabase.from("answer_types").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
