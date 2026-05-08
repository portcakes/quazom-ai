// Parses the AI-emitted free-form `duration` strings on Lesson rows
// (e.g. "30 minutes", "1 hour", "2 hr 15 min") into total minutes.
//
// Conservative defaults: when nothing parses, we fall back to a 30-minute
// estimate. Better to slightly over-allocate study time than to drop lessons
// out of the schedule.
export function parseDurationToMinutes(input: string | null | undefined): number {
  const FALLBACK = 30;
  if (!input) return FALLBACK;

  const text = input.toLowerCase();
  let total = 0;

  // Hours: "1 hour", "2 hours", "1.5 hours", "1.5h"
  const hourRe = /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h\b)/g;
  for (const match of text.matchAll(hourRe)) {
    if (match[1]) total += parseFloat(match[1]) * 60;
  }

  // Minutes: "30 minutes", "30 min", "30m"
  const minRe = /(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m\b)/g;
  for (const match of text.matchAll(minRe)) {
    if (match[1]) total += parseFloat(match[1]);
  }

  if (total > 0) return Math.round(total);

  // Fallback: try to parse a bare number as minutes ("45").
  const bare = text.match(/(\d+(?:\.\d+)?)/);
  if (bare?.[1]) {
    const n = parseFloat(bare[1]);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }

  return FALLBACK;
}
