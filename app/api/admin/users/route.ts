import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return { response: NextResponse.json({ error: error.message }, { status: 400 }) };
  }

  if (!profile?.is_admin) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { userId: user.id };
}

export async function PUT(request: Request) {
  const result = await requireAdmin();
  if ("response" in result) return result.response;

  const adminClient = createAdminClient();
  const body = await request.json();
  const { user_id, is_admin } = body || {};

  if (!user_id || typeof user_id !== "string") {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  }
  if (typeof is_admin !== "boolean") {
    return NextResponse.json({ error: "is_admin must be boolean" }, { status: 400 });
  }
  if (!is_admin && user_id === result.userId) {
    return NextResponse.json({ error: "You cannot remove your own admin access." }, { status: 400 });
  }

  const { data: target, error: targetError } = await adminClient.auth.admin.getUserById(user_id);
  if (targetError || !target?.user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const { data, error } = await adminClient
    .from("profiles")
    .upsert({ user_id, is_admin }, { onConflict: "user_id" })
    .select("user_id,timezone,reminder_time,push_opt_in,is_admin,created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, profile: data });
}
