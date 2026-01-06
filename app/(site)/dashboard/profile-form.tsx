"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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

const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

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
  const timeOptions = useMemo(
    () =>
      Array.from({ length: (24 * 60) / 5 }, (_, idx) => {
        const totalMinutes = idx * 5;
        const hh = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
        const mm = String(totalMinutes % 60).padStart(2, "0");
        return `${hh}:${mm}`;
      }),
    [],
  );
  const [pushOptIn, setPushOptIn] = useState(!!profile?.push_opt_in);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [blockedNoticeShown, setBlockedNoticeShown] = useState(false);
  const router = useRouter();

  const saveProfile = async (updates?: {
    timezone?: string;
    reminderTime?: string;
    pushOptIn?: boolean;
  }) => {
    const payload = {
      timezone: updates?.timezone ?? timezone,
      reminder_time: updates?.reminderTime ?? reminderTime,
      push_opt_in: updates?.pushOptIn ?? pushOptIn,
    };

    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMessage(data.error || "Unable to save profile");
      return;
    }
    setMessage("Saved");
    router.refresh();
  };

  const enablePush = async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setMessage("Push not supported in this browser");
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setMessage("Push permission not granted");
        return;
      }
      if (!vapidPublic) {
        setMessage("Missing VAPID public key");
        return;
      }

      // Ensure the service worker is active before subscribing.
      await navigator.serviceWorker.register("/sw.js");
      const reg = await navigator.serviceWorker.ready;

      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ||
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublic),
        }));

      const { endpoint, keys } = sub.toJSON();
      await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint,
          p256dh: keys?.p256dh,
          auth: keys?.auth,
          ua: navigator.userAgent,
        }),
      });
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
      if ("serviceWorker" in navigator) {
        const reg =
          (await navigator.serviceWorker.getRegistration().catch(() => null)) ||
          (await navigator.serviceWorker.ready.catch(() => null));
        const sub = await reg?.pushManager.getSubscription();
        await sub?.unsubscribe();
      }
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

        const reg = await navigator.serviceWorker.getRegistration().catch(() => null);
        if (!reg) {
          await turnOff("No service worker registered. Toggle to enable push.");
          return;
        }

        const sub = await reg.pushManager.getSubscription();
        const allowed = perm === "granted" && !!sub;

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
  }, [profile?.push_opt_in]);

  return (
    <section className="bujo-card bujo-ruled">
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
            {timeOptions.map((time) => (
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
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-200 ${
                pushOptIn ? "bg-green-500" : "bg-gray-300"
              }`}
            >
              <span className="sr-only">Toggle push reminders</span>
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition duration-200 ${
                  pushOptIn ? "translate-x-7" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>
      {message && <p className="bujo-message mt-3 text-sm">{message}</p>}
    </section>
  );
}
