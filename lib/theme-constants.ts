import { type ChartPalette, type ChartStyle } from "@/lib/types";

export const defaultThemeDefaults: { chart_palette: ChartPalette; chart_style: ChartStyle } = {
  chart_palette: {
    accent: "#2f4a3d",
    accentSoft: "#5f8b7a",
    booleanYes: "#5ce695",
    booleanNo: "#f98c80",
    scaleLow: "#ffeacc",
    scaleHigh: "#ff813d",
  },
  chart_style: "gradient",
};
