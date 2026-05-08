import { dayKey, startOfLocalDay } from "./generator";

/**
 * Given a sorted-newest-first list of check-in dates, compute:
 *   - the active streak (consecutive days ending at the latest check-in,
 *     where the latest must be today or yesterday for the streak to be live),
 *   - whether today has already been checked in.
 *
 * The "streak still alive if you checked in yesterday but not today" rule
 * means the user can lose their streak by failing to check in tomorrow.
 */
export function computeStreak(checkInDates: Date[], now: Date = new Date()): {
  streak: number;
  checkedInToday: boolean;
  lastCheckIn: Date | null;
} {
  if (checkInDates.length === 0) {
    return { streak: 0, checkedInToday: false, lastCheckIn: null };
  }

  const today = startOfLocalDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Dedupe by day key in case of accidental dupes, preserve order.
  const uniqueDays: Date[] = [];
  const seen = new Set<string>();
  for (const d of checkInDates) {
    const k = dayKey(startOfLocalDay(d));
    if (seen.has(k)) continue;
    seen.add(k);
    uniqueDays.push(startOfLocalDay(d));
  }
  uniqueDays.sort((a, b) => b.getTime() - a.getTime());

  const last = uniqueDays[0];
  if (!last) return { streak: 0, checkedInToday: false, lastCheckIn: null };
  const checkedInToday = last.getTime() === today.getTime();

  // Streak is alive only if the latest check-in is today or yesterday.
  const isLive =
    last.getTime() === today.getTime() ||
    last.getTime() === yesterday.getTime();

  if (!isLive) {
    return { streak: 0, checkedInToday: false, lastCheckIn: last };
  }

  let streak = 1;
  for (let i = 1; i < uniqueDays.length; i += 1) {
    const prev = uniqueDays[i - 1]!;
    const cur = uniqueDays[i]!;
    const diff = Math.round(
      (prev.getTime() - cur.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diff === 1) streak += 1;
    else break;
  }

  return { streak, checkedInToday, lastCheckIn: last };
}
