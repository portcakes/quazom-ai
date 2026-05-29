import "server-only";

import prisma from "@quazom-ai/db";
import { resolveRange, type RangeId } from "@/lib/range";

// Shape every "in-range" Prisma where clause needs. Centralising it here
// keeps the per-metric callsites tiny and means we drop the `gte` cleanly
// for the `all` range (where `from` is null).
function inRangeFilter(rangeId: RangeId) {
  const { from, to } = resolveRange(rangeId);
  if (!from) return { lte: to };
  return { gte: from, lte: to };
}

export type DashboardOverview = {
  rangeId: RangeId;
  totalUsers: number;
  totalAdmins: number;
  // Sign-ups in range.
  newSignups: number;
  // Sessions created in range (= login events).
  signIns: number;
  // Distinct users that signed in at least once in range.
  activeUsers: number;
  curriculaGenerated: number;
  // Knowledge Sandboxes created in range, plus the all-time total.
  sandboxesCreated: number;
  totalSandboxes: number;
  lessonsGenerated: number;
  notesCreated: number;
  annotationsCreated: number;
  noteSummarizations: number;
  schedulesCreated: number;
  // GeneratedAudio rows created in range — one per unique TTS clip we
  // actually synthesised (cache hits don't write a row, so this matches
  // billable Gemini calls).
  ttsGenerated: number;
  // Sum of every AiUsage row inside the range, regardless of `kind`.
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  // Pretty-printed total signups across all time. Helps anchor the "growth"
  // intuition on the page next to the in-range delta.
  signupsAllTime: number;
  signInsAllTime: number;
};

export async function getDashboardOverview(rangeId: RangeId): Promise<DashboardOverview> {
  const range = inRangeFilter(rangeId);

  // Run everything in parallel — each metric is a tiny aggregate and the
  // dashboard SSR latency budget is just "feels fast", not strict.
  const [
    totalUsers,
    totalAdmins,
    newSignups,
    signIns,
    activeUsersAgg,
    curriculaGenerated,
    sandboxesCreated,
    totalSandboxes,
    lessonsGenerated,
    notesCreated,
    annotationsCreated,
    noteSummarizations,
    schedulesCreated,
    ttsGenerated,
    aiTokens,
    signupsAllTime,
    signInsAllTime,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isAdmin: true } }),
    prisma.user.count({ where: { createdAt: range } }),
    prisma.session.count({ where: { createdAt: range } }),
    // For "active users", we group by userId on Sessions within the range
    // and count the distinct group keys.
    prisma.session.groupBy({
      by: ["userId"],
      where: { createdAt: range },
    }),
    // Exclude the hidden curricula that back Knowledge Sandboxes so the
    // curricula metric only counts standalone curricula.
    prisma.curriculum.count({ where: { createdAt: range, sandboxId: null } }),
    prisma.sandbox.count({ where: { createdAt: range } }),
    prisma.sandbox.count(),
    prisma.lesson.count({
      where: { status: "READY", updatedAt: range },
    }),
    prisma.note.count({
      // Exclude auto-annotation notes so the metric tracks human-written
      // notes (the auto note is created the first time you add an annotation
      // and is reused for every subsequent one).
      where: { createdAt: range, isAnnotation: false },
    }),
    prisma.annotation.count({ where: { createdAt: range } }),
    prisma.aiUsage.count({
      where: { createdAt: range, kind: "NOTE_SUMMARY" },
    }),
    prisma.studySchedule.count({ where: { createdAt: range } }),
    prisma.generatedAudio.count({ where: { createdAt: range } }),
    prisma.aiUsage.aggregate({
      where: { createdAt: range },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
      },
    }),
    prisma.user.count(),
    prisma.session.count(),
  ]);

  return {
    rangeId,
    totalUsers,
    totalAdmins,
    newSignups,
    signIns,
    activeUsers: activeUsersAgg.length,
    curriculaGenerated,
    sandboxesCreated,
    totalSandboxes,
    lessonsGenerated,
    notesCreated,
    annotationsCreated,
    noteSummarizations,
    schedulesCreated,
    ttsGenerated,
    tokens: {
      input: aiTokens._sum.inputTokens ?? 0,
      output: aiTokens._sum.outputTokens ?? 0,
      total: aiTokens._sum.totalTokens ?? 0,
    },
    signupsAllTime,
    signInsAllTime,
  };
}

export type ReferralSourceRow = {
  source: string | null;
  signups: number;
};

/**
 * Counts users by `referralSource` for the given range. The `null` bucket
 * represents users who either skipped the onboarding survey or signed up
 * before the survey shipped.
 */
export async function getReferralSources(rangeId: RangeId): Promise<ReferralSourceRow[]> {
  const range = inRangeFilter(rangeId);

  const grouped = await prisma.user.groupBy({
    by: ["referralSource"],
    where: { createdAt: range },
    _count: { _all: true },
    orderBy: { _count: { id: "desc" } },
  });

  return grouped.map((row) => ({
    source: row.referralSource,
    signups: row._count._all,
  }));
}

export type RecentSignupRow = {
  id: string;
  email: string;
  name: string;
  referralSource: string | null;
  createdAt: Date;
  isAdmin: boolean;
};

/**
 * Most recent signups, oldest-first cut off at the page's limit. Used as a
 * "what's coming in" stream on the overview dashboard. We never expose
 * content metadata here — just the bare account info.
 */
export async function getRecentSignups(limit = 8): Promise<RecentSignupRow[]> {
  const rows = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      email: true,
      name: true,
      referralSource: true,
      createdAt: true,
      isAdmin: true,
    },
  });
  return rows;
}

export type UserActivityRow = {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  isAlpha: boolean;
  isDisabled: boolean;
  isOnboarded: boolean;
  referralSource: string | null;
  createdAt: Date;
  signInsInRange: number;
  curriculaInRange: number;
  sandboxesInRange: number;
  lessonsInRange: number;
  notesInRange: number;
  annotationsInRange: number;
  schedulesInRange: number;
  noteSummariesInRange: number;
  tokensInRange: number;
  // Sessions across all time, used to show "login frequency" alongside the
  // in-range count.
  signInsAllTime: number;
};

/**
 * Builds a per-user activity table for the /users page. We do this by
 * fetching the user list and then running parallel `groupBy` aggregates,
 * which is a lot cleaner than N+1 counts at the small scale we run at.
 *
 * If user volume grows past ~10k we'll want to convert this into a single
 * SQL query with conditional aggregates, but the current shape is fine for
 * the alpha period.
 */
export async function getUserActivity(rangeId: RangeId): Promise<UserActivityRow[]> {
  const range = inRangeFilter(rangeId);

  const [
    users,
    sessionAgg,
    sessionAllAgg,
    curriculaAgg,
    sandboxAgg,
    notesAgg,
    annotationsAgg,
    schedulesAgg,
    summaryAgg,
    tokensAgg,
  ] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        isAdmin: true,
        isAlpha: true,
        isDisabled: true,
        isOnboarded: true,
        referralSource: true,
        createdAt: true,
      },
    }),
    prisma.session.groupBy({
      by: ["userId"],
      where: { createdAt: range },
      _count: { _all: true },
    }),
    prisma.session.groupBy({
      by: ["userId"],
      _count: { _all: true },
    }),
    prisma.curriculum.groupBy({
      by: ["userId"],
      where: { createdAt: range, sandboxId: null },
      _count: { _all: true },
    }),
    prisma.sandbox.groupBy({
      by: ["userId"],
      where: { createdAt: range },
      _count: { _all: true },
    }),
    prisma.note.groupBy({
      by: ["userId"],
      where: { createdAt: range, isAnnotation: false },
      _count: { _all: true },
    }),
    prisma.annotation.groupBy({
      by: ["userId"],
      where: { createdAt: range },
      _count: { _all: true },
    }),
    prisma.studySchedule.groupBy({
      by: ["userId"],
      where: { createdAt: range },
      _count: { _all: true },
    }),
    prisma.aiUsage.groupBy({
      by: ["userId"],
      where: { createdAt: range, kind: "NOTE_SUMMARY" },
      _count: { _all: true },
    }),
    prisma.aiUsage.groupBy({
      by: ["userId"],
      where: { createdAt: range },
      _sum: { totalTokens: true },
    }),
  ]);

  // Lesson generations don't live directly on `Lesson` with a userId, so
  // we walk via the curriculum back to the owner. Group on the curriculum's
  // userId by joining manually in JS — Prisma's groupBy doesn't let us
  // group across a relation in one go.
  const lessonRows = await prisma.lesson.findMany({
    where: { status: "READY", updatedAt: range },
    select: {
      module: { select: { curriculum: { select: { userId: true } } } },
    },
  });
  const lessonsByUser = new Map<string, number>();
  for (const row of lessonRows) {
    const uid = row.module.curriculum.userId;
    lessonsByUser.set(uid, (lessonsByUser.get(uid) ?? 0) + 1);
  }

  const byId = <T extends { userId: string }>(rows: T[]) =>
    new Map<string, T>(rows.map((r) => [r.userId, r]));

  // `AiUsage.userId` is nullable (we keep usage rows around after a user is
  // deleted for ops accounting), so `groupBy` returns `string | null`. Filter
  // those orphan rows out before bucketing — per-user analytics don't surface
  // them anyway.
  const withUserId = <T extends { userId: string | null }>(rows: T[]) =>
    rows.filter((r): r is T & { userId: string } => r.userId !== null);

  const sessionByUser = byId(sessionAgg);
  const sessionAllByUser = byId(sessionAllAgg);
  const curriculaByUser = byId(curriculaAgg);
  const sandboxByUser = byId(sandboxAgg);
  const notesByUser = byId(notesAgg);
  const annotationsByUser = byId(annotationsAgg);
  const schedulesByUser = byId(schedulesAgg);
  const summaryByUser = byId(withUserId(summaryAgg));
  const tokensByUser = byId(withUserId(tokensAgg));

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    isAdmin: u.isAdmin,
    isAlpha: u.isAlpha,
    isDisabled: u.isDisabled,
    isOnboarded: u.isOnboarded,
    referralSource: u.referralSource,
    createdAt: u.createdAt,
    signInsInRange: sessionByUser.get(u.id)?._count._all ?? 0,
    signInsAllTime: sessionAllByUser.get(u.id)?._count._all ?? 0,
    curriculaInRange: curriculaByUser.get(u.id)?._count._all ?? 0,
    sandboxesInRange: sandboxByUser.get(u.id)?._count._all ?? 0,
    lessonsInRange: lessonsByUser.get(u.id) ?? 0,
    notesInRange: notesByUser.get(u.id)?._count._all ?? 0,
    annotationsInRange: annotationsByUser.get(u.id)?._count._all ?? 0,
    schedulesInRange: schedulesByUser.get(u.id)?._count._all ?? 0,
    noteSummariesInRange: summaryByUser.get(u.id)?._count._all ?? 0,
    tokensInRange: tokensByUser.get(u.id)?._sum.totalTokens ?? 0,
  }));
}

export type UserDetail = {
  user: {
    id: string;
    name: string;
    email: string;
    isAdmin: boolean;
    isAlpha: boolean;
    isDisabled: boolean;
    isOnboarded: boolean;
    referralSource: string | null;
    createdAt: Date;
    emailVerified: boolean;
  };
  stats: {
    signInsInRange: number;
    signInsAllTime: number;
    lastSignInAt: Date | null;
    curriculaInRange: number;
    curriculaAllTime: number;
    sandboxesInRange: number;
    sandboxesAllTime: number;
    lessonsInRange: number;
    lessonsAllTime: number;
    notesInRange: number;
    notesAllTime: number;
    annotationsInRange: number;
    annotationsAllTime: number;
    schedulesInRange: number;
    schedulesAllTime: number;
    noteSummariesInRange: number;
    ttsInRange: number;
    ttsAllTime: number;
    tokensInRange: number;
    tokensAllTime: number;
  };
  /** Tokens used, grouped by AI feature, scoped to range. */
  tokensByKind: Array<{
    kind: string;
    totalTokens: number;
    callCount: number;
  }>;
  /** Most recent sign-in events, ascending = oldest first. */
  recentSignIns: Array<{
    id: string;
    createdAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
  }>;
};

export async function getUserDetail(
  userId: string,
  rangeId: RangeId,
): Promise<UserDetail | null> {
  const range = inRangeFilter(rangeId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      isAdmin: true,
      isAlpha: true,
      isDisabled: true,
      isOnboarded: true,
      referralSource: true,
      createdAt: true,
      emailVerified: true,
    },
  });
  if (!user) return null;

  const [
    signInsInRange,
    signInsAllTime,
    lastSignInRow,
    curriculaInRange,
    curriculaAllTime,
    sandboxesInRange,
    sandboxesAllTime,
    lessonsInRange,
    lessonsAllTime,
    notesInRange,
    notesAllTime,
    annotationsInRange,
    annotationsAllTime,
    schedulesInRange,
    schedulesAllTime,
    noteSummariesInRange,
    ttsInRange,
    ttsAllTime,
    tokensInRange,
    tokensAllTime,
    tokensByKindAgg,
    recentSignIns,
  ] = await Promise.all([
    prisma.session.count({ where: { userId, createdAt: range } }),
    prisma.session.count({ where: { userId } }),
    prisma.session.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.curriculum.count({
      where: { userId, createdAt: range, sandboxId: null },
    }),
    prisma.curriculum.count({ where: { userId, sandboxId: null } }),
    prisma.sandbox.count({ where: { userId, createdAt: range } }),
    prisma.sandbox.count({ where: { userId } }),
    prisma.lesson.count({
      where: {
        status: "READY",
        updatedAt: range,
        module: { curriculum: { userId } },
      },
    }),
    prisma.lesson.count({
      where: {
        status: "READY",
        module: { curriculum: { userId } },
      },
    }),
    prisma.note.count({
      where: { userId, createdAt: range, isAnnotation: false },
    }),
    prisma.note.count({ where: { userId, isAnnotation: false } }),
    prisma.annotation.count({ where: { userId, createdAt: range } }),
    prisma.annotation.count({ where: { userId } }),
    prisma.studySchedule.count({ where: { userId, createdAt: range } }),
    prisma.studySchedule.count({ where: { userId } }),
    prisma.aiUsage.count({
      where: { userId, createdAt: range, kind: "NOTE_SUMMARY" },
    }),
    prisma.generatedAudio.count({ where: { userId, createdAt: range } }),
    prisma.generatedAudio.count({ where: { userId } }),
    prisma.aiUsage.aggregate({
      where: { userId, createdAt: range },
      _sum: { totalTokens: true },
    }),
    prisma.aiUsage.aggregate({
      where: { userId },
      _sum: { totalTokens: true },
    }),
    prisma.aiUsage.groupBy({
      by: ["kind"],
      where: { userId, createdAt: range },
      _sum: { totalTokens: true },
      _count: { _all: true },
    }),
    prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        createdAt: true,
        ipAddress: true,
        userAgent: true,
      },
    }),
  ]);

  return {
    user,
    stats: {
      signInsInRange,
      signInsAllTime,
      lastSignInAt: lastSignInRow?.createdAt ?? null,
      curriculaInRange,
      curriculaAllTime,
      sandboxesInRange,
      sandboxesAllTime,
      lessonsInRange,
      lessonsAllTime,
      notesInRange,
      notesAllTime,
      annotationsInRange,
      annotationsAllTime,
      schedulesInRange,
      schedulesAllTime,
      noteSummariesInRange,
      ttsInRange,
      ttsAllTime,
      tokensInRange: tokensInRange._sum.totalTokens ?? 0,
      tokensAllTime: tokensAllTime._sum.totalTokens ?? 0,
    },
    tokensByKind: tokensByKindAgg.map((row) => ({
      kind: row.kind,
      totalTokens: row._sum.totalTokens ?? 0,
      callCount: row._count._all,
    })),
    recentSignIns,
  };
}
