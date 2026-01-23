"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  subscribeToPush,
  saveSubscriptionToServer,
  unsubscribeFromPush,
  checkPushSupport,
} from "@/lib/push-subscription";

type ProfileFormProps = {
  profile:
    | {
        timezone: string | null;
        reminder_time: string | null;
        push_opt_in: boolean | null;
      }
    | null;
  timezoneOptions: string[];
};

function normalizeToFiveMinutes(value?: string | null) {
  if (!value) return "09:00";
  const [hourPart = "0", minutePart = "0"] = value.split(":");
  const hours = Number.parseInt(hourPart, 10);
  const minutes = Number.parseInt(minutePart, 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return "09:00";
  const totalMinutes = Math.min(Math.max(hours * 60 + minutes, 0), 23 * 60 + 59);
  const rounded = Math.floor(totalMinutes / 5) * 5; // enforce 5-minute increments
  const hh = String(Math.floor(rounded / 60)).padStart(2, "0");
  const mm = String(rounded % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}


export default function ProfileForm({
  profile,
  timezoneOptions,
}: ProfileFormProps) {
  const [timezone, setTimezone] = useState(profile?.timezone || "UTC");
  const [reminderTime, setReminderTime] = useState(() =>
    normalizeToFiveMinutes(profile?.reminder_time || "09:00"),
  );
  const [pushOptIn, setPushOptIn] = useState(!!profile?.push_opt_in);
  const [message, setMessage] = useState<string | null>(null);
  const [blockedNoticeShown, setBlockedNoticeShown] = useState(false);
  const router = useRouter();

  const saveProfile = useCallback(
    async (updates?: {
      timezone?: string;
      reminderTime?: string;
      pushOptIn?: boolean;
    }) => {
      const payload = {
        timezone: updates?.timezone ?? timezone,
        reminder_time: updates?.reminderTime ?? reminderTime,
        push_opt_in: updates?.pushOptIn ?? pushOptIn,
      };

      setMessage(null);
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Unable to save profile");
        return;
      }
      setMessage("Saved");
      router.refresh();
    },
    [pushOptIn, reminderTime, router, timezone],
  );


  const enablePush = async () => {
    setMessage(null);
    try {
      const result = await subscribeToPush();
      
      if (!result.success) {
        setMessage(result.error || "Unable to enable push");
        return;
      }

      if (!result.subscription) {
        setMessage("Failed to create subscription");
        return;
      }

      // Save subscription to server
      const saved = await saveSubscriptionToServer(result.subscription);
      if (!saved) {
        setMessage("Failed to save subscription");
        return;
      }

      setPushOptIn(true);
      await saveProfile({ pushOptIn: true });
      setMessage("Push enabled");
    } catch (err) {
      console.error(err);
      setMessage("Unable to enable push");
    }
  };

  const disablePush = async () => {
    setMessage(null);
    try {
      await unsubscribeFromPush();
    } catch (err) {
      console.error(err);
    }
    setPushOptIn(false);
    await saveProfile({ pushOptIn: false });
    setMessage("Push disabled");
  };

  // Keep toggle in sync with actual notification permission and subscription state.
  useEffect(() => {
    let cancelled = false;
    const reconcile = async () => {
      try {
        if (typeof window === "undefined") return;

        const showBlockedGuide = () => {
          const guide =
            "Notifications are blocked by your browser. Click the padlock near the address bar, allow notifications, then reload this page and toggle push again.";
          setMessage(guide);
          if (!blockedNoticeShown) {
            alert(
              `${guide}\n\nChrome/Edge: Lock icon > Permissions > Notifications > Allow\nSafari: Settings > Websites > Notifications > Allow for this site`,
            );
            setBlockedNoticeShown(true);
          }
        };

        const turnOff = async (message?: string) => {
          if (cancelled) return;
          setPushOptIn(false);
          if (profile?.push_opt_in) {
            await saveProfile({ pushOptIn: false });
          }
          if (message) setMessage(message);
        };

        if (!("Notification" in window)) {
          await turnOff("Push not supported in this browser.");
          return;
        }

        const perm = Notification.permission;
        if (perm === "denied") {
          await turnOff();
          showBlockedGuide();
          return;
        }

        if (!("serviceWorker" in navigator)) {
          await turnOff("Service worker support is unavailable in this browser.");
          return;
        }

        const support = await checkPushSupport();
        const allowed = support.supported && support.permission === "granted" && support.subscribed;

        if (!cancelled) {
          setPushOptIn(allowed);
          if (!allowed && profile?.push_opt_in) {
            await saveProfile({ pushOptIn: false });
          }
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          await saveProfile({ pushOptIn: false });
          setPushOptIn(false);
          setMessage("Push unavailable due to an error. Please retry.");
        }
      }
    };

    reconcile();
    return () => {
      cancelled = true;
    };
  }, [blockedNoticeShown, profile?.push_opt_in, saveProfile]);

  return (
    <section className="bujo-card bujo-torn">
      <h2 className="text-xl font-semibold text-gray-900">Reminders</h2>
      <p className="text-sm text-gray-700">
        Pick your timezone and reminder time. Enable push to receive daily notifications.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-800">Timezone</label>
          <select
            value={timezone}
            onChange={(e) => {
              const nextTz = e.target.value;
              setTimezone(nextTz);
              saveProfile({ timezone: nextTz });
            }}
            className="bujo-input"
          >
            {timezoneOptions.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-800">Reminder time</label>
          <select
            value={reminderTime}
            onChange={(e) => {
              const nextTime = normalizeToFiveMinutes(e.target.value);
              setReminderTime(nextTime);
              saveProfile({ reminderTime: nextTime });
            }}
            className="bujo-input"
          >
            {Array.from({ length: (24 * 60) / 5 }, (_, idx) => {
              const totalMinutes = idx * 5;
              const hh = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
              const mm = String(totalMinutes % 60).padStart(2, "0");
              return `${hh}:${mm}`;
            }).map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-800">Push reminders</label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => (pushOptIn ? disablePush() : enablePush())}
              aria-pressed={pushOptIn}
              className={`group relative inline-flex h-[58px] w-28 items-center overflow-hidden rounded-lg border-2 px-1 transition-all duration-200 ${
                pushOptIn
                  ? "justify-end border-[var(--bujo-accent-ink)] bg-[var(--bujo-accent)]/15 shadow-[0_6px_0_var(--bujo-shadow)]"
                  : "justify-start border-[var(--bujo-border)] bg-white shadow-sm hover:border-[var(--bujo-ink)]/30"
              }`}
            >
              <span className="sr-only">Toggle push reminders</span>
              <span
                className={`flex h-[50px] w-[56px] items-center justify-center rounded-md text-[11px] font-semibold uppercase tracking-tight text-white shadow transition-all duration-200 ${
                  pushOptIn ? "bg-[var(--bujo-accent-ink)]" : "bg-[var(--bujo-ink)]/80"
                }`}
              >
                {pushOptIn ? "On" : "Off"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {message && <p className="bujo-message mt-3 text-sm">{message}</p>}
    </section>
  );
}
