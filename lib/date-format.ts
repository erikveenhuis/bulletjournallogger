import { format, isValid, parseISO } from "date-fns";
import type { DateFormat } from "@/lib/types";

export const dateFormatOptions: Array<{ value: DateFormat; label: string }> = [
  { value: "mdy", label: "MM-DD-YYYY (01-23-2026)" },
  { value: "dmy", label: "DD-MM-YYYY (23-01-2026)" },
  { value: "ymd", label: "YYYY-MM-DD (2026-01-23)" },
];

const formatPatterns: Record<DateFormat, { short: string; long: string }> = {
  mdy: { short: "MM-dd", long: "MM-dd-yyyy" },
  dmy: { short: "dd-MM", long: "dd-MM-yyyy" },
  ymd: { short: "yyyy-MM-dd", long: "yyyy-MM-dd" },
};

export function normalizeDateFormat(value?: string | null): DateFormat {
  if (value === "mdy" || value === "dmy" || value === "ymd") return value;
  return "mdy";
}

function coerceDate(input: Date | string): Date {
  if (input instanceof Date) return input;
  return parseISO(input);
}

export function formatDateValue(
  input: Date | string,
  dateFormat: DateFormat,
  variant: "short" | "long" | "monthYear" = "short",
) {
  const date = coerceDate(input);
  if (!isValid(date)) return "";
  if (variant === "monthYear") return format(date, "MMMM yyyy");
  return format(date, formatPatterns[dateFormat][variant]);
}
