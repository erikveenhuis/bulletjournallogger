"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { type ChartPalette, type ChartStyle } from "@/lib/types";

type ProfileFormProps = {
  profile:
    | {
        timezone: string | null;
        reminder_time: string | null;
        push_opt_in: boolean | null;
        chart_palette?: ChartPalette | null;
        chart_style?: ChartStyle | null;
      }
    | null;
  timezoneOptions: string[];
};

const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

const defaultPalette: ChartPalette = {
  accent: "#5f8b7a",
  accentSoft: "#5f8b7a",
  booleanYes: "#5ce695",
  booleanNo: "#f98c80",
  scaleLow: "#ffeacc",
  scaleHigh: "#ff813d",
};

function mergePalette(value?: ChartPalette | null): ChartPalette {
  return {
    accent: value?.accent || defaultPalette.accent,
    accentSoft: value?.accentSoft || value?.accent || defaultPalette.accentSoft,
    booleanYes: value?.booleanYes || defaultPalette.booleanYes,
    booleanNo: value?.booleanNo || defaultPalette.booleanNo,
    scaleLow: value?.scaleLow || defaultPalette.scaleLow,
    scaleHigh: value?.scaleHigh || defaultPalette.scaleHigh,
  };
}

function hexToRgba(hex: string, alpha: number, fallback: string) {
  const normalized = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex) ? hex : null;
  if (!normalized) return fallback;
  const raw = normalized.slice(1);
  const expanded = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  const r = Number.parseInt(expanded.slice(0, 2), 16);
  const g = Number.parseInt(expanded.slice(2, 4), 16);
  const b = Number.parseInt(expanded.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

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
  const [chartStyle, setChartStyle] = useState<ChartStyle>(
    profile?.chart_style === "brush" || profile?.chart_style === "solid" ? profile.chart_style : "gradient",
  );
  const [chartPalette, setChartPalette] = useState<ChartPalette>(() =>
    mergePalette((profile?.chart_palette as ChartPalette | null) ?? null),
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
  const makeDayStyle = (style: ChartStyle) => {
    if (style === "brush") {
      return {
        background:
          `repeating-linear-gradient(-14deg, ${hexToRgba(chartPalette.accent, 0.08, "rgba(95,139,122,0.08)")} 0 12px, transparent 12px 24px), ${chartPalette.scaleHigh}`,
        boxShadow: "inset 0 0 0 1px rgba(47,74,61,0.08), 0 4px 0 var(--bujo-shadow)",
        borderColor: "rgba(47, 74, 61, 0.35)",
      };
    }
    if (style === "solid") {
      return {
        background: chartPalette.scaleHigh,
        boxShadow: "inset 0 0 0 1px rgba(47,74,61,0.06), 0 3px 0 var(--bujo-shadow)",
        borderColor: "rgba(47, 74, 61, 0.25)",
      };
    }
    return {
      background: `linear-gradient(135deg, ${chartPalette.scaleLow} 0%, ${chartPalette.scaleHigh} 100%)`,
    };
  };
  const colorFields: Array<{ key: keyof ChartPalette; label: string; helper: string }> = [
    { key: "accent", label: "Accent", helper: "Trend line & bar borders" },
    { key: "accentSoft", label: "Accent fill", helper: "Line fill & gradients" },
    { key: "booleanYes", label: "Yes color", helper: "Yes/true values" },
    { key: "booleanNo", label: "No color", helper: "No/false values" },
    { key: "scaleLow", label: "Scale low", helper: "Lower end of scales" },
    { key: "scaleHigh", label: "Scale high", helper: "Higher end of scales" },
  ];
  const styleOptions = useMemo(
    () => {
      const accent = chartPalette.accent;
      const accentSoft = chartPalette.accentSoft;
      const low = chartPalette.scaleLow;
      const high = chartPalette.scaleHigh;
      return [
        {
          value: "gradient" as ChartStyle,
          title: "Gradient",
          description: "Soft blended fills",
          previewClass: "bujo-chart",
          previewStyle: {
            background:
              `radial-gradient(var(--bujo-grid) 1px, transparent 0) 0 0 / 22px 22px, ` +
              `linear-gradient(135deg, ${accent} 0%, ${accentSoft} 45%, ${high} 100%)`,
          },
          previewInnerClass: "border border-white/60 bg-white/25 shadow-inner backdrop-blur-[1px]",
        },
        {
          value: "brush" as ChartStyle,
          title: "Brush",
          description: "Textured strokes",
          previewClass: "bujo-chart",
          previewStyle: {
            background:
              `repeating-linear-gradient(-12deg, ${hexToRgba(accent, 0.08, "rgba(95,139,122,0.08)")} 0 14px, transparent 14px 28px), ` +
              `radial-gradient(var(--bujo-grid) 1px, transparent 0) 0 0 / 22px 22px, ` +
              `linear-gradient(135deg, ${low} 0%, ${high} 100%)`,
          },
          previewInnerClass: "border border-white/60 bg-white/30 shadow-inner backdrop-blur-[1px]",
        },
        {
          value: "solid" as ChartStyle,
          title: "Solid",
          description: "Flat fills & crisp lines",
          previewClass: "bujo-chart bujo-chart--solid",
          previewStyle: {
            background: `linear-gradient(135deg, ${low} 0%, ${high} 100%)`,
          },
          previewInnerClass: "border border-white/60 bg-white/30 shadow-inner backdrop-blur-[1px]",
        },
      ];
    },
    [chartPalette],
  );

  const saveProfile = async (updates?: {
    timezone?: string;
    reminderTime?: string;
    pushOptIn?: boolean;
    chartPalette?: ChartPalette;
    chartStyle?: ChartStyle;
  }) => {
    const payload = {
      timezone: updates?.timezone ?? timezone,
      reminder_time: updates?.reminderTime ?? reminderTime,
      push_opt_in: updates?.pushOptIn ?? pushOptIn,
      chart_palette: updates?.chartPalette ?? chartPalette,
      chart_style: updates?.chartStyle ?? chartStyle,
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

  const handlePaletteChange = (key: keyof ChartPalette, value: string) => {
    const next = mergePalette({ ...chartPalette, [key]: value });
    setChartPalette(next);
    void saveProfile({ chartPalette: next });
  };

  const handleChartStyleChange = (value: ChartStyle) => {
    setChartStyle(value);
    void saveProfile({ chartStyle: value });
  };

  const handlePaletteReset = () => {
    const next = mergePalette(defaultPalette);
    setChartPalette(next);
    void saveProfile({ chartPalette: next });
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
              className={`relative inline-flex h-[44px] w-[84px] items-center rounded-full transition-colors duration-200 ${
                pushOptIn ? "bg-[var(--bujo-accent)]" : "bg-gray-300"
              }`}
            >
              <span className="sr-only">Toggle push reminders</span>
              <span
                className={`inline-block h-9 w-9 transform rounded-full bg-white shadow transition duration-200 ${
                  pushOptIn ? "translate-x-[44px]" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-4 rounded-xl border border-dashed border-[var(--bujo-border)] bg-white/70 p-4 shadow-inner">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Graph colors</h3>
            <p className="text-sm text-gray-700">
              Override the default palette used in insights charts.
            </p>
          </div>
          <button
            type="button"
            onClick={handlePaletteReset}
            className="bujo-btn-secondary w-full justify-center text-sm sm:w-auto"
          >
            Reset to defaults
          </button>
        </div>
        <div className="grid gap-3">
          <div className="space-y-2">
            <p className="text-base font-semibold text-gray-900">Chart style</p>
            <p className="text-sm text-gray-700">
              Pick between the existing gradient look, the new brush texture, or a clean solid fill.
            </p>
            <div className="grid gap-4 lg:grid-cols-[1.5fr_minmax(240px,1fr)]">
              <div className="grid gap-4 sm:grid-cols-3">
                {styleOptions.map(({ value, title, description, previewClass }) => {
                  const isActive = chartStyle === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleChartStyleChange(value)}
                      aria-pressed={isActive}
                      className={`group flex h-full w-full flex-col gap-3 rounded-2xl border px-4 py-4 text-left shadow-sm transition ${
                        isActive
                          ? "border-[var(--bujo-accent-ink)] bg-amber-50/70 text-[var(--bujo-accent-ink)] shadow-md ring-2 ring-[var(--bujo-accent-ink)] ring-offset-2 ring-offset-[#fffbf4]"
                          : "border-gray-200 bg-white text-gray-800 hover:border-[var(--bujo-border)] hover:bg-amber-50/40"
                      }`}
                    >
                      <div className={`${previewClass} relative h-20 w-full overflow-hidden rounded-xl text-[var(--bujo-accent-ink)] shadow-sm p-3`}>
                        <div
                          className={`bujo-calendar-day h-full w-full ${value === "brush" ? "bujo-calendar-day--brush" : ""} ${value === "solid" ? "bujo-calendar-day--solid" : ""}`}
                          style={makeDayStyle(value)}
                          aria-hidden
                        />
                      </div>
                      <div className="flex flex-col leading-tight">
                        <span className="text-[15px] font-semibold">{title}</span>
                        <span className="text-xs font-normal text-gray-600">{description}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="rounded-2xl border border-dashed border-[var(--bujo-border)] bg-white/80 p-4 shadow-inner">
                <p className="text-sm font-semibold text-gray-800">Preview</p>
                <p className="text-xs text-gray-600">Uses your palette and selected style.</p>
                <div className="mt-3 space-y-3">
                  <div className={`${chartStyle === "solid" ? "bujo-calendar-day--solid" : chartStyle === "brush" ? "bujo-calendar-day--brush" : ""} bujo-calendar-day h-14 w-full`} style={makeDayStyle(chartStyle)} aria-hidden />
                  <div className="bujo-chart relative h-24 overflow-hidden rounded-xl border border-dashed border-[var(--bujo-border)] bg-white/80">
                    <svg viewBox="0 0 140 70" className="h-full w-full opacity-95">
                      {(() => {
                        const fill =
                          chartStyle === "brush"
                            ? hexToRgba(chartPalette.accent, 0.12, "rgba(95,139,122,0.12)")
                            : chartStyle === "solid"
                              ? hexToRgba(chartPalette.accentSoft, 0.12, "rgba(95,139,122,0.12)")
                              : hexToRgba(chartPalette.accentSoft, 0.18, "rgba(95,139,122,0.18)");
                        const stroke = hexToRgba(chartPalette.accent, 0.9, "rgba(47,74,61,0.9)");
                        const strokeWidth = chartStyle === "brush" ? 3.1 : chartStyle === "solid" ? 2.2 : 2.6;
                        const dash = chartStyle === "brush" ? "2 3.5" : chartStyle === "gradient" ? "6 4" : undefined;
                        return (
                          <>
                            <polygon
                              points="0,58 10,50 25,46 40,52 55,34 70,40 85,28 100,36 115,24 130,32 140,58"
                              fill={fill}
                              stroke="none"
                            />
                            <polyline
                              points="0,50 10,42 25,38 40,44 55,26 70,32 85,20 100,28 115,16 130,24"
                              fill="none"
                              stroke={stroke}
                              strokeWidth={strokeWidth}
                              strokeDasharray={dash}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-semibold text-gray-800">
                    <span className="flex items-center gap-2 rounded-lg border border-dashed border-[var(--bujo-border)] bg-white px-2 py-1 shadow-sm">
                      <span
                        className="h-4 w-4 rounded-sm"
                        style={{ backgroundColor: chartPalette.booleanYes }}
                        aria-hidden
                      />
                      Yes
                    </span>
                    <span className="flex items-center gap-2 rounded-lg border border-dashed border-[var(--bujo-border)] bg-white px-2 py-1 shadow-sm">
                      <span
                        className="h-4 w-4 rounded-sm"
                        style={{ backgroundColor: chartPalette.booleanNo }}
                        aria-hidden
                      />
                      No
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {colorFields.map(({ key, label, helper }) => (
            <div key={key} className="space-y-2">
              <label className="text-sm font-medium text-gray-800">{label}</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={chartPalette[key]}
                  onChange={(e) => handlePaletteChange(key, e.target.value)}
                  className="h-12 w-16 cursor-pointer rounded-md border border-gray-200 bg-white p-1 shadow-sm"
                  aria-label={`${label} color`}
                />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-gray-900">{chartPalette[key]}</p>
                  <p className="text-xs text-gray-600">{helper}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {message && <p className="bujo-message mt-3 text-sm">{message}</p>}
    </section>
  );
}
