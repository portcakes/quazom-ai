import "server-only";

import prisma from "@quazom-ai/db";

import type { PlanKey } from "./plans";

/**
 * Per-plan generation caps. Plans without a cap (Scholar's unlimited
 * generation, for instance) use `null` so the API guards can short-circuit
 * before counting rows.
 *
 * "Period" hints how the cap rolls over for the UI. ALPHA's curricula cap
 * is the only lifetime cap left over from the original alpha rules; every
 * paid tier is monthly-or-unlimited.
 */
export type EffectivePlan = "ALPHA" | PlanKey | "FREE";

export type Cap = {
  /** Hard cap. `null` means unlimited. */
  limit: number | null;
  /** "lifetime" or "month". Drives the helper functions below. */
  period: "lifetime" | "month";
};

export type PlanLimits = {
  curricula: Cap;
  /**
   * Multi-source ("Continuity") curriculum cap. Counts independently from
   * the single-source `curricula` cap — every plan has its own bucket of
   * continuity generations because they run on a much larger prompt and
   * cost significantly more tokens per call.
   */
  continuityCurricula: Cap;
  lessonsPerMonth: Cap;
  discussionsPerMonth: Cap;
  ttsPerMonth: Cap;
};

/**
 * Single source of truth for what each plan permits. Surfaced on the
 * settings page and enforced by the activeUserProcedure guards in the tRPC
 * router. New tiers should be added here first; the rest of the app reads
 * from this map.
 */
export const LIMITS_BY_PLAN: Record<EffectivePlan, PlanLimits> = {
  // Open-alpha grant. Same shape as FREE today — the column is kept so we
  // can revisit alpha-specific perks in the future without a migration.
  ALPHA: {
    curricula: { limit: 5, period: "lifetime" },
    continuityCurricula: { limit: 2, period: "lifetime" },
    lessonsPerMonth: { limit: 30, period: "month" },
    discussionsPerMonth: { limit: 10, period: "month" },
    ttsPerMonth: { limit: 10, period: "month" },
  },
  // No paid plan and no alpha grant. Currently mirrors ALPHA so users
  // never silently lose access when their alpha flag is removed.
  FREE: {
    curricula: { limit: 5, period: "lifetime" },
    continuityCurricula: { limit: 2, period: "lifetime" },
    lessonsPerMonth: { limit: 30, period: "month" },
    discussionsPerMonth: { limit: 10, period: "month" },
    ttsPerMonth: { limit: 10, period: "month" },
  },
  EXPLORER: {
    curricula: { limit: 10, period: "month" },
    continuityCurricula: { limit: 5, period: "month" },
    lessonsPerMonth: { limit: 100, period: "month" },
    discussionsPerMonth: { limit: 30, period: "month" },
    ttsPerMonth: { limit: 50, period: "month" },
  },
  SCHOLAR: {
    curricula: { limit: null, period: "month" },
    continuityCurricula: { limit: 20, period: "month" },
    lessonsPerMonth: { limit: null, period: "month" },
    discussionsPerMonth: { limit: null, period: "month" },
    ttsPerMonth: { limit: null, period: "month" },
  },
};

export type UsageRow = {
  used: number;
  limit: number | null;
  remaining: number | null;
  period: Cap["period"];
};

export type PlanUsageSnapshot = {
  /** Effective plan after combining `subscriptionPlan` + `isAlpha`. */
  plan: EffectivePlan;
  /** Raw paid plan (NULL when no Polar subscription is active). */
  paidPlan: PlanKey | null;
  /** Whether the user still carries the alpha grant. */
  isAlpha: boolean;
  /** Single-source curriculum usage. */
  curricula: UsageRow;
  /** Multi-source (Continuity) curriculum usage — separate counter. */
  continuityCurricula: UsageRow;
  lessonsThisMonth: UsageRow;
  discussionsThisMonth: UsageRow;
  ttsThisMonth: UsageRow;
};

/**
 * First-of-the-month boundary used for monthly limits. Anchored to UTC so
 * a user crossing a tz boundary doesn't see a different reset window.
 */
export function startOfThisMonthUTC(reference: Date = new Date()): Date {
  return new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1),
  );
}

/**
 * Resolve the plan we should apply for a given (subscriptionPlan, isAlpha).
 * Paid plans always win over the alpha grant; alpha wins over the post-alpha
 * "free" tier.
 */
export function resolveEffectivePlan(input: {
  subscriptionPlan: string | null;
  isAlpha: boolean;
}): EffectivePlan {
  if (input.subscriptionPlan === "EXPLORER") return "EXPLORER";
  if (input.subscriptionPlan === "SCHOLAR") return "SCHOLAR";
  if (input.isAlpha) return "ALPHA";
  return "FREE";
}

// Single-source (kind=SINGLE) curriculum lifetime count. The kind filter
// ensures continuity curricula don't double-count against the single bucket.
export async function countCurriculaForUser(userId: string): Promise<number> {
  return prisma.curriculum.count({ where: { userId, kind: "SINGLE" } });
}

// Single-source curricula created this calendar month.
export async function countCurriculaThisMonth(userId: string): Promise<number> {
  const since = startOfThisMonthUTC();
  return prisma.curriculum.count({
    where: { userId, kind: "SINGLE", createdAt: { gte: since } },
  });
}

/**
 * Multi-source (kind=CONTINUITY) curriculum counters. FREE / ALPHA use the
 * lifetime variant; EXPLORER / SCHOLAR use the monthly one. We filter on
 * kind so the per-user single-source counts remain accurate even as users
 * mix the two flavours.
 */
export async function countContinuityCurriculaForUser(
  userId: string,
): Promise<number> {
  return prisma.curriculum.count({ where: { userId, kind: "CONTINUITY" } });
}

export async function countContinuityCurriculaThisMonth(
  userId: string,
): Promise<number> {
  const since = startOfThisMonthUTC();
  return prisma.curriculum.count({
    where: { userId, kind: "CONTINUITY", createdAt: { gte: since } },
  });
}

/**
 * Lessons generated this calendar month. Anything past STUB counts so a
 * retry on a FAILED row still costs a slot — those retries cost AI tokens
 * too.
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

/**
 * Distinct TTS clips generated by this user this calendar month. The
 * `generated_audio` row is only created on a cache-miss generation, so this
 * naturally only counts the events that actually cost a Gemini call.
 */
export async function countTtsGenerationsThisMonth(
  userId: string,
): Promise<number> {
  const since = startOfThisMonthUTC();
  return prisma.generatedAudio.count({
    where: { userId, createdAt: { gte: since } },
  });
}

function buildRow(used: number, cap: Cap): UsageRow {
  if (cap.limit === null) {
    return { used, limit: null, remaining: null, period: cap.period };
  }
  return {
    used,
    limit: cap.limit,
    remaining: Math.max(0, cap.limit - used),
    period: cap.period,
  };
}

/** Compose a usage snapshot for the settings page / pre-flight checks. */
export async function getPlanUsage(
  userId: string,
): Promise<PlanUsageSnapshot> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAlpha: true, subscriptionPlan: true },
  });
  const plan = resolveEffectivePlan({
    subscriptionPlan: user?.subscriptionPlan ?? null,
    isAlpha: user?.isAlpha ?? false,
  });
  const limits = LIMITS_BY_PLAN[plan];

  // Read whichever curriculum count matches the plan's accounting period.
  // Lifetime for ALPHA / FREE; monthly otherwise. We only run the count
  // when there's a non-null cap to avoid pointless DB work for SCHOLAR.
  const curriculaCount = await (limits.curricula.limit === null
    ? Promise.resolve(0)
    : limits.curricula.period === "lifetime"
      ? countCurriculaForUser(userId)
      : countCurriculaThisMonth(userId));
  // Continuity curricula always count regardless of plan (SCHOLAR still
  // has a 20/month cap), so we run the query unconditionally — there's
  // no "unlimited" tier for this feature.
  const continuityCount = await (limits.continuityCurricula.period ===
  "lifetime"
    ? countContinuityCurriculaForUser(userId)
    : countContinuityCurriculaThisMonth(userId));
  const [lessons, discussions, tts] = await Promise.all([
    limits.lessonsPerMonth.limit === null
      ? Promise.resolve(0)
      : countLessonGenerationsThisMonth(userId),
    limits.discussionsPerMonth.limit === null
      ? Promise.resolve(0)
      : countDiscussionGenerationsThisMonth(userId),
    limits.ttsPerMonth.limit === null
      ? Promise.resolve(0)
      : countTtsGenerationsThisMonth(userId),
  ]);

  return {
    plan,
    paidPlan:
      user?.subscriptionPlan === "EXPLORER" ||
      user?.subscriptionPlan === "SCHOLAR"
        ? user.subscriptionPlan
        : null,
    isAlpha: user?.isAlpha ?? false,
    curricula: buildRow(curriculaCount, limits.curricula),
    continuityCurricula: buildRow(continuityCount, limits.continuityCurricula),
    lessonsThisMonth: buildRow(lessons, limits.lessonsPerMonth),
    discussionsThisMonth: buildRow(discussions, limits.discussionsPerMonth),
    ttsThisMonth: buildRow(tts, limits.ttsPerMonth),
  };
}

/** Server-side cap check used by the tRPC mutation guards. */
export type LimitCheckArgs = {
  plan: EffectivePlan;
  /** Which counter to check. */
  feature:
    | "curricula"
    | "continuityCurricula"
    | "lessonsThisMonth"
    | "discussionsThisMonth"
    | "ttsThisMonth";
  /** Current usage (already-counted) to compare against the cap. */
  used: number;
};

export function isOverLimit(args: LimitCheckArgs): boolean {
  const limits = LIMITS_BY_PLAN[args.plan];
  const cap =
    args.feature === "curricula"
      ? limits.curricula
      : args.feature === "continuityCurricula"
        ? limits.continuityCurricula
        : args.feature === "lessonsThisMonth"
          ? limits.lessonsPerMonth
          : args.feature === "discussionsThisMonth"
            ? limits.discussionsPerMonth
            : limits.ttsPerMonth;
  if (cap.limit === null) return false;
  return args.used >= cap.limit;
}
