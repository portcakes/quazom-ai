import "server-only";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@quazom-ai/db";
import type { StudyTimeSlot } from "@quazom-ai/db/enums";
import {
  dayKey,
  normalizeDateFromDb,
  slotKey,
  startOfLocalDay,
  type SlotKey,
  type TakenSlots,
} from "@/lib/schedule/generator";
import { computeStreak } from "@/lib/schedule/streak";

// ---------------------------------------------------------------------------
// Shape returned to UI. Sessions carry pre-computed lesson titles so the
// calendar doesn't need a join per row.
// ---------------------------------------------------------------------------

export type ScheduleSessionDetail = {
  id: string;
  scheduleId: string;
  date: Date;
  timeSlot: StudyTimeSlot;
  durationMin: number;
  lessonIds: string[];
  lessonTitles: string[];
  isCompleted: boolean;
  curriculum: { id: string; title: string };
};

export type ScheduleDetail = {
  id: string;
  curriculumId: string;
  curriculumTitle: string;
  daysOfWeek: number[];
  minutesPerDay: number;
  preferredTimeSlots: StudyTimeSlot[];
  startDate: Date;
  targetCompletionDate: Date;
  warningsAccepted: boolean;
  sessionCount: number;
  completedSessionCount: number;
};

// ---------------------------------------------------------------------------
// User-scoped fetchers. Each verifies ownership via the session before
// returning anything.
// ---------------------------------------------------------------------------

async function getUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.id ?? null;
}

export async function getCurriculumSchedule(
  curriculumId: string,
): Promise<ScheduleDetail | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const schedule = await prisma.studySchedule.findUnique({
    where: { curriculumId },
    include: {
      curriculum: { select: { userId: true, title: true } },
      _count: { select: { sessions: true } },
    },
  });
  if (!schedule || schedule.curriculum.userId !== userId) return null;

  const completedCount = await prisma.studySession.count({
    where: { scheduleId: schedule.id, isCompleted: true },
  });

  return {
    id: schedule.id,
    curriculumId: schedule.curriculumId,
    curriculumTitle: schedule.curriculum.title,
    daysOfWeek: schedule.daysOfWeek,
    minutesPerDay: schedule.minutesPerDay,
    preferredTimeSlots: schedule.preferredTimeSlots,
    startDate: schedule.startDate,
    targetCompletionDate: schedule.targetCompletionDate,
    warningsAccepted: schedule.warningsAccepted,
    sessionCount: schedule._count.sessions,
    completedSessionCount: completedCount,
  };
}

export async function getMySchedules(): Promise<ScheduleDetail[]> {
  const userId = await getUserId();
  if (!userId) return [];

  const schedules = await prisma.studySchedule.findMany({
    where: { userId },
    include: {
      curriculum: { select: { title: true } },
      _count: { select: { sessions: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  if (schedules.length === 0) return [];

  const completedCounts = await prisma.studySession.groupBy({
    by: ["scheduleId"],
    where: {
      scheduleId: { in: schedules.map((s) => s.id) },
      isCompleted: true,
    },
    _count: { _all: true },
  });
  const completedByScheduleId = new Map(
    completedCounts.map((c) => [c.scheduleId, c._count._all]),
  );

  return schedules.map((s) => ({
    id: s.id,
    curriculumId: s.curriculumId,
    curriculumTitle: s.curriculum.title,
    daysOfWeek: s.daysOfWeek,
    minutesPerDay: s.minutesPerDay,
    preferredTimeSlots: s.preferredTimeSlots,
    startDate: s.startDate,
    targetCompletionDate: s.targetCompletionDate,
    warningsAccepted: s.warningsAccepted,
    sessionCount: s._count.sessions,
    completedSessionCount: completedByScheduleId.get(s.id) ?? 0,
  }));
}

export type SessionsRangeOptions = {
  /** Inclusive lower bound (local-day midnight). */
  from: Date;
  /** Exclusive upper bound (local-day midnight). */
  to: Date;
  /** When set, restrict to a single curriculum's sessions. */
  curriculumId?: string;
};

export async function getSessionsInRange(
  opts: SessionsRangeOptions,
): Promise<ScheduleSessionDetail[]> {
  const userId = await getUserId();
  if (!userId) return [];

  type SessionWhere = NonNullable<
    NonNullable<Parameters<typeof prisma.studySession.findMany>[0]>["where"]
  >;
  const where: SessionWhere = {
    userId,
    date: { gte: opts.from, lt: opts.to },
  };
  if (opts.curriculumId) {
    where.schedule = { curriculumId: opts.curriculumId };
  }

  const rows = await prisma.studySession.findMany({
    where,
    orderBy: [{ date: "asc" }, { timeSlot: "asc" }],
    include: {
      schedule: {
        select: {
          curriculumId: true,
          curriculum: { select: { title: true } },
        },
      },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    scheduleId: r.scheduleId,
    date: normalizeDateFromDb(r.date),
    timeSlot: r.timeSlot,
    durationMin: r.durationMin,
    lessonIds: Array.isArray(r.lessonIds) ? (r.lessonIds as string[]) : [],
    lessonTitles: Array.isArray(r.lessonTitles) ? (r.lessonTitles as string[]) : [],
    isCompleted: r.isCompleted,
    curriculum: {
      id: r.schedule.curriculumId,
      title: r.schedule.curriculum.title,
    },
  }));
}

// ---------------------------------------------------------------------------
// Slot conflict map for the generator. Returns the set of slot keys already
// booked by *other* schedules (i.e. excluding `excludeScheduleId` if given).
// ---------------------------------------------------------------------------

export async function getTakenSlotsForUser(opts: {
  userId: string;
  from: Date;
  to: Date;
  excludeScheduleId?: string;
}): Promise<TakenSlots> {
  const rows = await prisma.studySession.findMany({
    where: {
      userId: opts.userId,
      date: { gte: opts.from, lte: opts.to },
      ...(opts.excludeScheduleId
        ? { scheduleId: { not: opts.excludeScheduleId } }
        : {}),
    },
    select: { date: true, timeSlot: true },
  });

  const set = new Set<SlotKey>();
  for (const r of rows) {
    set.add(slotKey(normalizeDateFromDb(r.date), r.timeSlot));
  }
  return set;
}

// ---------------------------------------------------------------------------
// Streak / check-in
// ---------------------------------------------------------------------------

export type StreakSummary = {
  streak: number;
  checkedInToday: boolean;
  lastCheckIn: Date | null;
  recentDays: string[];
};

export async function getStreakSummary(): Promise<StreakSummary> {
  const userId = await getUserId();
  if (!userId) {
    return { streak: 0, checkedInToday: false, lastCheckIn: null, recentDays: [] };
  }

  const checkIns = await prisma.checkIn.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take: 365,
    select: { date: true },
  });

  const dates = checkIns.map((c) => c.date);
  const summary = computeStreak(dates);

  return {
    streak: summary.streak,
    checkedInToday: summary.checkedInToday,
    lastCheckIn: summary.lastCheckIn,
    recentDays: dates.map((d) => dayKey(startOfLocalDay(d))),
  };
}
