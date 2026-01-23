"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { type ChartPalette, type ChartStyle } from "@/lib/types";
import { defaultThemeDefaults } from "@/lib/theme-constants";

type ThemeFormProps = {
  profile:
    | {
        chart_palette?: ChartPalette | null;
        chart_style?: ChartStyle | null;
      }
    | null;
  title?: string;
  description?: string;
  readOnly?: boolean;
  paletteOverride?: ChartPalette;
  styleOverride?: ChartStyle;
  defaultPaletteOverride?: ChartPalette;
  defaultStyleOverride?: ChartStyle;
  saveEndpoint?: string;
  showReset?: boolean;
};

const defaultPalette = defaultThemeDefaults.chart_palette;
const defaultStyle = defaultThemeDefaults.chart_style;

function mergePalette(value?: ChartPalette | null, fallback?: ChartPalette): ChartPalette {
  const base = fallback ?? defaultPalette;
  return {
    accent: value?.accent || base.accent,
    accentSoft: value?.accentSoft || value?.accent || base.accentSoft,
    booleanYes: value?.booleanYes || base.booleanYes,
    booleanNo: value?.booleanNo || base.booleanNo,
    scaleLow: value?.scaleLow || base.scaleLow,
    scaleHigh: value?.scaleHigh || base.scaleHigh,
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

export default function ThemeForm({
  profile,
  title = "Chart Theme",
  description = "Customize the appearance of your insights charts and data visualizations.",
  readOnly = false,
  paletteOverride,
  styleOverride,
  defaultPaletteOverride,
  defaultStyleOverride,
  saveEndpoint = "/api/profile",
  showReset = true,
}: ThemeFormProps) {
  const resolvedDefaultPalette = defaultPaletteOverride ?? defaultPalette;
  const resolvedDefaultStyle = defaultStyleOverride ?? defaultStyle;
  const [chartStyle, setChartStyle] = useState<ChartStyle>(() => {
    if (styleOverride) {
      return styleOverride;
    }
    return profile?.chart_style === "brush" || profile?.chart_style === "solid"
      ? profile.chart_style
      : resolvedDefaultStyle;
  });
  const [chartPalette, setChartPalette] = useState<ChartPalette>(() =>
    mergePalette(paletteOverride ?? ((profile?.chart_palette as ChartPalette | null) ?? null), resolvedDefaultPalette),
  );
  const [message, setMessage] = useState<string | null>(null);
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

  const saveTheme = async (updates?: {
    chartPalette?: ChartPalette;
    chartStyle?: ChartStyle;
  }) => {
    if (readOnly) return;
    const payload = {
      chart_palette: updates?.chartPalette ?? chartPalette,
      chart_style: updates?.chartStyle ?? chartStyle,
    };

    setMessage(null);
    const res = await fetch(saveEndpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Unable to save theme");
      return;
    }
    setMessage("Saved");
    router.refresh();
  };

  const handlePaletteChange = (key: keyof ChartPalette, value: string) => {
    if (readOnly) return;
    const next = mergePalette({ ...chartPalette, [key]: value }, resolvedDefaultPalette);
    setChartPalette(next);
    void saveTheme({ chartPalette: next });
  };

  const handleChartStyleChange = (value: ChartStyle) => {
    if (readOnly) return;
    setChartStyle(value);
    void saveTheme({ chartStyle: value });
  };

  const handlePaletteReset = () => {
    if (readOnly) return;
    const next = mergePalette(resolvedDefaultPalette, resolvedDefaultPalette);
    setChartPalette(next);
    void saveTheme({ chartPalette: next });
  };

  return (
    <section className="bujo-card bujo-torn">
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      <p className="text-sm text-gray-700">
        {description}
      </p>

      <div className="mt-6 space-y-4 rounded-xl border border-dashed border-[var(--bujo-border)] bg-white/70 p-4 shadow-inner">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Graph colors</h3>
            <p className="text-sm text-gray-700">
              Override the default palette used in insights charts.
            </p>
          </div>
          {showReset && (
            <button
              type="button"
              onClick={handlePaletteReset}
              className="bujo-btn-secondary w-full justify-center text-sm sm:w-auto"
              disabled={readOnly}
            >
              Reset to defaults
            </button>
          )}
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
                      disabled={readOnly}
                      className={`group flex h-full w-full flex-col gap-3 rounded-2xl border px-4 py-4 text-left shadow-sm transition ${
                        isActive
                          ? "border-[var(--bujo-accent-ink)] bg-amber-50/70 text-[var(--bujo-accent-ink)] shadow-md ring-2 ring-[var(--bujo-accent-ink)] ring-offset-2 ring-offset-[#fffbf4]"
                          : "border-gray-200 bg-white text-gray-800 hover:border-[var(--bujo-border)] hover:bg-amber-50/40"
                      } ${readOnly ? "cursor-not-allowed opacity-70" : ""}`}
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
                  className={`h-12 w-16 rounded-md border border-gray-200 bg-white p-1 shadow-sm ${readOnly ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                  aria-label={`${label} color`}
                  disabled={readOnly}
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
      {message && !readOnly && <p className="bujo-message mt-3 text-sm">{message}</p>}
    </section>
  );
}