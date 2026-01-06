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

export async function GET() {
  const result = await requireAdmin();
  if ("response" in result) return result.response;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("push_subscriptions")
    .select(
      "id,user_id,endpoint,ua,created_at,profiles:profiles!push_subscriptions_user_id_fkey(timezone,reminder_time,push_opt_in)",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data || []);
}

export async function DELETE(request: Request) {
  const result = await requireAdmin();
  if ("response" in result) return result.response;

  const body = await request.json();
  const { id } = body;
  if (!id) {
    return NextResponse.json({ error: "Subscription id is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("push_subscriptions").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
