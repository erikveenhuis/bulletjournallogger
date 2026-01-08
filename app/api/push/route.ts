import { NextResponse } from "next/server";
import { getEffectiveUser, getEffectiveSupabaseClient } from "@/lib/auth";

async function requireUser() {
  const supabase = await getEffectiveSupabaseClient();
  const { user } = await getEffectiveUser();
  return { supabase, user };
}

export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const { endpoint, p256dh, auth, ua } = body;
  const { error } = await supabase.from("push_subscriptions").upsert({
    user_id: user.id,
    endpoint,
    p256dh,
    auth,
    ua,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
