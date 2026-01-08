import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is actually an admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const cookieStore = await cookies();
  const currentOverride = cookieStore.get("admin_view_override")?.value;
  const newOverride = currentOverride === "user" ? "admin" : "user";

  // Set cookie to override admin status
  cookieStore.set("admin_view_override", newOverride, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return NextResponse.json({
    success: true,
    viewMode: newOverride,
    message: `Switched to ${newOverride} view`
  });
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

  // Check if user is actually an admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const cookieStore = await cookies();
  const currentOverride = cookieStore.get("admin_view_override")?.value || "admin";

  return NextResponse.json({
    viewMode: currentOverride,
    isAdmin: currentOverride === "admin"
  });
}