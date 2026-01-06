import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const fiveMinutePattern = /^([01]\d|2[0-3]):([0-5]\d)(?::\d{2})?$/;

function isFiveMinuteIncrement(value: unknown) {
  if (typeof value !== "string") return false;
  const match = value.match(fiveMinutePattern);
  if (!match) return false;
  const minutes = Number.parseInt(match[2], 10);
  return minutes % 5 === 0;
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { timezone, reminder_time, push_opt_in } = body;

  if (
    reminder_time !== undefined &&
    reminder_time !== null &&
    !isFiveMinuteIncrement(reminder_time)
  ) {
    return NextResponse.json(
      { error: "Reminder time must be in 5-minute increments (HH:MM)." },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("profiles")
    .upsert({
      user_id: user.id,
      timezone,
      reminder_time: typeof reminder_time === "string" ? reminder_time.slice(0, 5) : reminder_time,
      push_opt_in,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
