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
    // Explicitly join on the FK to ensure profile fields are returned and filtered.
    .select(
      "endpoint,p256dh,auth,user_id,profiles:profiles!push_subscriptions_user_id_fkey(timezone,reminder_time,push_opt_in)",
    )
    .eq("profiles.push_opt_in", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const nowUtc = new Date();
  type ProfileRow = { timezone: string | null; reminder_time: string | null; push_opt_in?: boolean | null };
  type SubscriptionRow = {
    endpoint: string;
    p256dh: string;
    auth: string;
    profiles: ProfileRow | ProfileRow[] | null;
  };

  const rows = (data ?? []) as SubscriptionRow[];
  const due = rows.filter((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const tz = profile?.timezone || "UTC";
    const reminder = profile?.reminder_time;
    if (!reminder) return false;
    const parts = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: tz,
    })
      .formatToParts(nowUtc)
      .reduce<Record<string, string>>((acc, part) => {
        if (part.type === "hour" || part.type === "minute") acc[part.type] = part.value;
        return acc;
      }, {});

    const hour = Number(parts.hour ?? "0");
    const minute = Number(parts.minute ?? "0");
    const [remHourStr, remMinuteStr] = reminder.split(":");
    const remHour = Number(remHourStr);
    const remMinute = Number(remMinuteStr);
    if (Number.isNaN(remHour) || Number.isNaN(remMinute)) return false;

    const localMinutes = hour * 60 + minute;
    const reminderMinutes = remHour * 60 + remMinute;
    const diff = localMinutes - reminderMinutes;
    // Treat a 5-minute window as "due" to avoid missing reminders when the cron
    // tick is slightly late.
    return diff >= 0 && diff < 5;
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
