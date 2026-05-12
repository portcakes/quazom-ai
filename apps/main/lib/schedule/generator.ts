import { parseDurationToMinutes } from "./duration";
import {
  STUDY_TIME_SLOTS,
  STUDY_TIME_SLOT_META,
  isDayOfWeek,
  type DayOfWeek,
  type StudyTimeSlot,
} from "./time-slots";

// ---------------------------------------------------------------------------
// Date helpers
//
// All scheduling math operates in the user's local day. We model "day" as a
// JS Date pinned to UTC midnight so we can use ISO strings as map keys
// without worrying about timezone bleed.
// ---------------------------------------------------------------------------

/**
 * Normalises a JS Date to noon UTC of the user's local calendar day.
 *
 * Anchoring at noon UTC (rather than 00:00 local) keeps the YYYY-MM-DD
 * representation stable across the common ±UTC11 timezone range. We always
 * round-trip dates through this function so calendar UI and comparisons
 * stay consistent regardless of local timezone.
 */
export function startOfLocalDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0),
  );
}

/**
 * Same idea as `startOfLocalDay`, but the calendar day is computed in the
 * supplied IANA timezone rather than the runtime's local zone. Used by the
 * check-in / streak logic so a learner in Tokyo gets a fresh day at midnight
 * Tokyo time, not midnight wherever the server happens to be running.
 *
 * If the timezone string is invalid we fall back to UTC so a corrupted user
 * preference can't crash the check-in flow.
 */
export function startOfDayInTimezone(date: Date, timezone: string): Date {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const lookup = Object.fromEntries(
      parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]),
    ) as Record<string, string>;
    const year = Number(lookup.year);
    const month = Number(lookup.month);
    const day = Number(lookup.day);
    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    }
  } catch {
    // Unknown timezone string — fall through to UTC.
  }
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      12,
      0,
      0,
    ),
  );
}

/**
 * Re-anchor a Date returned from a Postgres `DATE` column (which Prisma
 * deserialises as UTC midnight) to noon UTC of the same calendar day.
 *
 * Without this, in a negative-UTC zone like PDT a session returned by the
 * server would render with the previous day's label after `format()`. We
 * apply this to every Date that comes back from the schedule tables.
 */
export function normalizeDateFromDb(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0),
  );
}

export function dayKey(date: Date): string {
  // YYYY-MM-DD using *local* parts. Calling toISOString() would shift to UTC
  // and could swap the day across a midnight boundary.
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, n: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + n);
  return next;
}

export function diffInDays(a: Date, b: Date): number {
  const ms = startOfLocalDay(a).getTime() - startOfLocalDay(b).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export type LessonForScheduling = {
  id: string;
  title: string;
  durationStr: string | null;
  /** Order within the curriculum (module.order, lesson.order combined). */
  globalOrder: number;
};

export type SlotKey = `${string}:${StudyTimeSlot}`;

/** Build the unique key the DB also enforces on (userId, date, timeSlot). */
export function slotKey(date: Date, timeSlot: StudyTimeSlot): SlotKey {
  return `${dayKey(date)}:${timeSlot}` as SlotKey;
}

export type TakenSlots = Set<SlotKey>;

export type GeneratorInput = {
  /** Lessons to schedule, in the order they should be presented. */
  lessons: LessonForScheduling[];
  daysOfWeek: DayOfWeek[];
  minutesPerDay: number;
  preferredTimeSlots: StudyTimeSlot[];
  /** Inclusive range bounds (local-day midnights). */
  startDate: Date;
  targetCompletionDate: Date;
  /**
   * Slot keys already booked by *other* schedules belonging to this user.
   * The generator skips these to respect the no-double-booking rule.
   */
  takenSlots: TakenSlots;
};

export type ScheduledSession = {
  date: Date;
  timeSlot: StudyTimeSlot;
  durationMin: number;
  lessons: LessonForScheduling[];
};

export type GenerationResult = {
  sessions: ScheduledSession[];
  diagnostics: PacingDiagnostics;
};

export type PacingDiagnostics = {
  totalLessonMinutes: number;
  totalAvailableMinutes: number;
  scheduledDayCount: number;
  blockedSlotCount: number;
  unscheduledLessonCount: number;
  endsBeforeTarget: boolean;
  finalSessionDate: Date | null;
  warnings: ScheduleWarning[];
};

export type ScheduleWarning = {
  code:
    | "TARGET_TOO_SOON"
    | "ALL_SLOTS_BLOCKED"
    | "NO_DAYS_SELECTED"
    | "NO_SLOTS_SELECTED"
    | "TARGET_IN_PAST"
    | "NO_LESSONS";
  message: string;
};

/**
 * Generate a study schedule deterministically.
 *
 * Algorithm:
 *   1. Build the chronological list of candidate slots — one per
 *      (scheduled-day, preferred-slot), filtered by `takenSlots`.
 *   2. Walk lessons in order, allocating each to the next available slot
 *      whose remaining minute budget can hold it.
 *   3. Once a slot's budget runs out, move to the next slot.
 *
 * Lessons that don't fit before the target date are surfaced in
 * `diagnostics.unscheduledLessonCount` and produce a warning.
 */
export function generateSchedule(input: GeneratorInput): GenerationResult {
  const warnings: ScheduleWarning[] = [];

  if (input.lessons.length === 0) {
    warnings.push({
      code: "NO_LESSONS",
      message: "This curriculum has no lessons to schedule.",
    });
  }

  if (input.daysOfWeek.length === 0) {
    warnings.push({
      code: "NO_DAYS_SELECTED",
      message: "Pick at least one day of the week.",
    });
  }

  if (input.preferredTimeSlots.length === 0) {
    warnings.push({
      code: "NO_SLOTS_SELECTED",
      message: "Pick at least one preferred study time.",
    });
  }

  const startDay = startOfLocalDay(input.startDate);
  const targetDay = startOfLocalDay(input.targetCompletionDate);

  if (targetDay.getTime() < startDay.getTime()) {
    warnings.push({
      code: "TARGET_IN_PAST",
      message: "Your target completion date is before today.",
    });
  }

  const orderedSlots = [...input.preferredTimeSlots].sort(
    (a, b) => STUDY_TIME_SLOT_META[a].startHour - STUDY_TIME_SLOT_META[b].startHour,
  );
  const dayOfWeekSet = new Set<number>(input.daysOfWeek);

  // Allocate budgets per (day, slot). Each slot gets `minutesPerDay /
  // slotsPerDay` minutes of lesson time so heavy days use multiple slots
  // proportionally rather than overloading the first one.
  const minutesPerSlot =
    orderedSlots.length > 0
      ? Math.floor(input.minutesPerDay / orderedSlots.length)
      : 0;

  type Candidate = { date: Date; timeSlot: StudyTimeSlot; budget: number };
  const candidates: Candidate[] = [];

  for (
    let cursor = new Date(startDay);
    cursor.getTime() <= targetDay.getTime();
    cursor = addDays(cursor, 1)
  ) {
    if (!isDayOfWeek(cursor.getDay()) || !dayOfWeekSet.has(cursor.getDay())) continue;
    for (const slot of orderedSlots) {
      const key = slotKey(cursor, slot);
      if (input.takenSlots.has(key)) continue;
      candidates.push({
        date: new Date(cursor),
        timeSlot: slot,
        budget: minutesPerSlot,
      });
    }
  }

  const totalLessonMinutes = input.lessons.reduce(
    (acc, l) => acc + parseDurationToMinutes(l.durationStr),
    0,
  );
  const totalAvailableMinutes = candidates.length * minutesPerSlot;
  const scheduledDayCount = new Set(candidates.map((c) => dayKey(c.date))).size;

  // Count blocked-by-other-schedule slots so the UI can explain shortfalls.
  let blockedSlotCount = 0;
  for (
    let cursor = new Date(startDay);
    cursor.getTime() <= targetDay.getTime();
    cursor = addDays(cursor, 1)
  ) {
    if (!dayOfWeekSet.has(cursor.getDay())) continue;
    for (const slot of orderedSlots) {
      if (input.takenSlots.has(slotKey(cursor, slot))) blockedSlotCount += 1;
    }
  }

  // Pack lessons into candidates.
  const sessions: ScheduledSession[] = [];
  let candidateIdx = 0;
  let unscheduledCount = 0;

  for (const lesson of input.lessons) {
    const lessonMin = parseDurationToMinutes(lesson.durationStr);

    // Find the next candidate that has enough remaining budget. If no slot
    // can hold the lesson, place it in the next available slot anyway (it'll
    // just run a little long) — better than dropping content.
    let placed = false;
    while (candidateIdx < candidates.length) {
      const c = candidates[candidateIdx];
      if (!c) {
        candidateIdx += 1;
        continue;
      }
      if (c.budget >= lessonMin || c.budget === minutesPerSlot) {
        const session = sessions.find(
          (s) => s.date.getTime() === c.date.getTime() && s.timeSlot === c.timeSlot,
        );
        if (session) {
          session.lessons.push(lesson);
          session.durationMin += lessonMin;
        } else {
          sessions.push({
            date: c.date,
            timeSlot: c.timeSlot,
            durationMin: lessonMin,
            lessons: [lesson],
          });
        }
        c.budget -= lessonMin;
        if (c.budget <= 0) candidateIdx += 1;
        placed = true;
        break;
      }
      candidateIdx += 1;
    }

    if (!placed) unscheduledCount += 1;
  }

  if (unscheduledCount > 0) {
    warnings.push({
      code: "TARGET_TOO_SOON",
      message:
        unscheduledCount === input.lessons.length && blockedSlotCount > 0
          ? "Every preferred study slot in this date range is already booked by another curriculum's schedule."
          : `${unscheduledCount} lesson${
              unscheduledCount === 1 ? "" : "s"
            } won't fit in your study window. Push the target date out, add more days, or increase minutes per day.`,
    });
  }

  if (
    blockedSlotCount > 0 &&
    candidates.length === 0 &&
    !warnings.some((w) => w.code === "ALL_SLOTS_BLOCKED")
  ) {
    warnings.push({
      code: "ALL_SLOTS_BLOCKED",
      message:
        "All your preferred study slots are already taken by another schedule.",
    });
  }

  const finalSessionDate =
    sessions.length > 0
      ? sessions.reduce<Date>(
          (acc, s) => (s.date.getTime() > acc.getTime() ? s.date : acc),
          sessions[0]!.date,
        )
      : null;

  return {
    sessions,
    diagnostics: {
      totalLessonMinutes,
      totalAvailableMinutes,
      scheduledDayCount,
      blockedSlotCount,
      unscheduledLessonCount: unscheduledCount,
      endsBeforeTarget:
        finalSessionDate !== null && finalSessionDate.getTime() <= targetDay.getTime(),
      finalSessionDate,
      warnings,
    },
  };
}

// Re-export the slot list for callers that don't want the helper imports.
export const ALL_TIME_SLOTS = STUDY_TIME_SLOTS;
