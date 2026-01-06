import { NextResponse } from "next/server";
import webPush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: "Missing VAPID keys" }, { status: 500 });
  }

  webPush.setVapidDetails(
    "mailto:admin@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth,user_id,profiles(timezone,reminder_time,push_opt_in)")
    .eq("profiles.push_opt_in", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const nowUtc = new Date();
  type SubscriptionRow = {
    endpoint: string;
    p256dh: string;
    auth: string;
    profiles: { timezone: string | null; reminder_time: string | null } | null;
  };

  const due = (data || []).filter((row: SubscriptionRow) => {
    const tz = row.profiles?.timezone || "UTC";
    const reminder = row.profiles?.reminder_time;
    if (!reminder) return false;
    const local = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: tz,
    }).format(nowUtc);
    return local === reminder.slice(0, 5);
  });

  const results = [];
  for (const row of due) {
    const subscription = {
      endpoint: row.endpoint,
      keys: {
        p256dh: row.p256dh,
        auth: row.auth,
      },
    };
    try {
      await webPush.sendNotification(
        subscription,
        JSON.stringify({
          title: "Time to log your day",
          body: "Tap to answer today’s questions.",
          data: { url: "/journal" },
        }),
      );
      results.push({ endpoint: row.endpoint, status: "sent" });
    } catch (err) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      const message = err instanceof Error ? err.message : "unknown error";
      const shouldRemove = statusCode === 404 || statusCode === 410 || statusCode === 400;

      if (shouldRemove) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", row.endpoint);
      }

      results.push({
        endpoint: row.endpoint,
        status: "error",
        message,
        removed: shouldRemove || undefined,
        statusCode,
      });
    }
  }

  return NextResponse.json({ sent: results.length, results });
}
