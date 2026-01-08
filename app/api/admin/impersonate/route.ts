import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

  const body = await request.json();
  const { action, targetUserId } = body;

  const cookieStore = await cookies();

  if (action === "start" && targetUserId) {
    // Verify the target user exists in auth system
    const adminClient = createAdminClient();
    try {
      const { data: authUser, error: authError } = await adminClient.auth.admin.getUserById(targetUserId);

      if (authError || !authUser.user) {
        return NextResponse.json({ error: "Target user not found" }, { status: 404 });
      }
    } catch (error) {
      return NextResponse.json({ error: "Target user not found" }, { status: 404 });
    }

    // Ensure target user has a profile
    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("user_id")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (!existingProfile) {
      // Create profile for the user if it doesn't exist
      const { error: profileError } = await adminClient
        .from("profiles")
        .upsert({
          user_id: targetUserId,
          timezone: 'UTC',
          reminder_time: '09:00',
          push_opt_in: false,
          is_admin: false, // Default to non-admin for impersonated users
        }, {
          onConflict: 'user_id'
        });

      if (profileError) {
        console.error("Failed to create profile for user:", profileError);
        return NextResponse.json({
          error: "Failed to prepare user profile",
          details: profileError.message
        }, { status: 500 });
      }
    }

    // Prevent impersonating oneself
    if (targetUserId === user.id) {
      return NextResponse.json({ error: "Cannot impersonate yourself" }, { status: 400 });
    }

    // Start impersonation
    cookieStore.set("bulletjournal_impersonated_user_id", targetUserId, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    // Clear admin view override when starting impersonation
    cookieStore.delete("admin_view_override");

    return NextResponse.json({
      success: true,
      message: "Impersonation started",
      impersonating: targetUserId
    });

  } else if (action === "stop") {
    // Stop impersonation
    cookieStore.delete("bulletjournal_impersonated_user_id");

    return NextResponse.json({
      success: true,
      message: "Impersonation stopped"
    });

  } else {
    return NextResponse.json({ error: "Invalid action or missing targetUserId" }, { status: 400 });
  }
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
  const impersonatedUserId = cookieStore.get("bulletjournal_impersonated_user_id")?.value;

  if (impersonatedUserId) {
    // Get impersonated user details
    const { data: impersonatedProfile } = await supabase
      .from("profiles")
      .select("user_id, timezone, reminder_time, push_opt_in, is_admin")
      .eq("user_id", impersonatedUserId)
      .maybeSingle();

    return NextResponse.json({
      isImpersonating: true,
      impersonatedUser: impersonatedProfile
    });
  }

  return NextResponse.json({
    isImpersonating: false
  });
}