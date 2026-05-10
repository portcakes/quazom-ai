import {
  startOfDay,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from "date-fns";

// Identifiers used in the `?range=` query string. We keep them URL-friendly
// strings so a deep link to a specific time window is obvious.
export const RANGE_IDS = [
  "day",
  "week",
  "month",
  "3m",
  "6m",
  "ytd",
  "year",
  "all",
] as const;

export type RangeId = (typeof RANGE_IDS)[number];

export const DEFAULT_RANGE: RangeId = "month";

const LABELS: Record<RangeId, string> = {
  day: "Today",
  week: "Last 7 days",
  month: "Last 30 days",
  "3m": "Last 3 months",
  "6m": "Last 6 months",
  ytd: "Year to date",
  year: "Last 12 months",
  all: "All time",
};

const SHORT_LABELS: Record<RangeId, string> = {
  day: "Today",
  week: "7d",
  month: "30d",
  "3m": "3m",
  "6m": "6m",
  ytd: "YTD",
  year: "1y",
  all: "All",
};

export function parseRangeId(value: string | string[] | undefined): RangeId {
  const v = Array.isArray(value) ? value[0] : value;
  if (v && (RANGE_IDS as readonly string[]).includes(v)) {
    return v as RangeId;
  }
  return DEFAULT_RANGE;
}

export function rangeLabel(id: RangeId): string {
  return LABELS[id];
}

export function rangeShortLabel(id: RangeId): string {
  return SHORT_LABELS[id];
}

/**
 * Resolves a {@link RangeId} into a concrete `[from, to]` window. `to` is
 * always "now" so the range is right-open: items at exactly `to` are
 * counted, items in the future are not (there shouldn't be any). `from`
 * is null for `all` so the caller can drop the `gte` filter entirely.
 *
 * `now` is injected so tests / cron-style code can fake the clock; in
 * normal Next.js use we pass `new Date()` at the top of each page.
 */
export function resolveRange(id: RangeId, now: Date = new Date()): {
  from: Date | null;
  to: Date;
} {
  switch (id) {
    case "day":
      return { from: startOfDay(now), to: now };
    case "week":
      return { from: subDays(now, 7), to: now };
    case "month":
      return { from: subDays(now, 30), to: now };
    case "3m":
      return { from: subMonths(now, 3), to: now };
    case "6m":
      return { from: subMonths(now, 6), to: now };
    case "ytd":
      return { from: startOfYear(now), to: now };
    case "year":
      return { from: subYears(now, 1), to: now };
    case "all":
    default:
      return { from: null, to: now };
  }
}
