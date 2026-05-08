import "server-only";

import prisma from "@/lib/db";

/**
 * Per-user generation caps for users on the alpha plan (`User.isAlpha === true`).
 * Lesson + discussion counts use a calendar-month window; curriculum count is
 * lifetime for the user.
 */
export const ALPHA_LIMITS = {
  curricula: 5,
  lessonsPerMonth: 30,
  discussionsPerMonth: 10,
} as const;

export type AlphaUsageSnapshot = {
  isAlpha: boolean;
  curricula: { used: number; limit: number; remaining: number };
  lessonsThisMonth: { used: number; limit: number; remaining: number };
  discussionsThisMonth: { used: number; limit: number; remaining: number };
};

/**
 * First-of-the-month boundary used for the rolling monthly limits. Anchored to
 * UTC because the limit is applied at the API layer and we don't want clients
 * in different timezones to see different windows.
 */
export function startOfThisMonthUTC(reference: Date = new Date()): Date {
  return new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1),
  );
}

/** Total curricula owned by the user — visible + hidden, lifetime. */
export async function countCurriculaForUser(userId: string): Promise<number> {
  return prisma.curriculum.count({ where: { userId } });
}

/**
 * Lessons this user has generated (or attempted to generate) so far this
 * calendar month. Anything past STUB counts so retries on FAILED still cost a
 * slot — they cost AI tokens too.
 */
export async function countLessonGenerationsThisMonth(
  userId: string,
): Promise<number> {
  const since = startOfThisMonthUTC();
  return prisma.lesson.count({
    where: {
      module: { curriculum: { userId } },
      status: { not: "STUB" },
      updatedAt: { gte: since },
    },
  });
}

/**
 * DISCUSSION-typed lessons this user has generated this month. Discussions are
 * a strict subset of {@link countLessonGenerationsThisMonth} — they count
 * against both caps.
 */
export async function countDiscussionGenerationsThisMonth(
  userId: string,
): Promise<number> {
  const since = startOfThisMonthUTC();
  return prisma.lesson.count({
    where: {
      module: { curriculum: { userId } },
      activityType: "DISCUSSION",
      status: { not: "STUB" },
      updatedAt: { gte: since },
    },
  });
}

/** Compose a usage snapshot for the settings page / pre-flight checks. */
export async function getAlphaUsage(userId: string): Promise<AlphaUsageSnapshot> {
  const [user, curricula, lessons, discussions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { isAlpha: true },
    }),
    countCurriculaForUser(userId),
    countLessonGenerationsThisMonth(userId),
    countDiscussionGenerationsThisMonth(userId),
  ]);

  const isAlpha = user?.isAlpha ?? false;
  return {
    isAlpha,
    curricula: {
      used: curricula,
      limit: ALPHA_LIMITS.curricula,
      remaining: Math.max(0, ALPHA_LIMITS.curricula - curricula),
    },
    lessonsThisMonth: {
      used: lessons,
      limit: ALPHA_LIMITS.lessonsPerMonth,
      remaining: Math.max(0, ALPHA_LIMITS.lessonsPerMonth - lessons),
    },
    discussionsThisMonth: {
      used: discussions,
      limit: ALPHA_LIMITS.discussionsPerMonth,
      remaining: Math.max(0, ALPHA_LIMITS.discussionsPerMonth - discussions),
    },
  };
}
