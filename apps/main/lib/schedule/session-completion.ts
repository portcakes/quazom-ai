import prisma from "@quazom-ai/db";
import type { LessonActivityType } from "@quazom-ai/db/enums";
import { startOfDayInTimezone } from "@/lib/schedule/generator";

// Derive whether a lesson is complete from its activity-specific child rows.
// Mirrors `lessonIsCompleted` in lib/queries/lesson.ts: pick the row that
// matches the lesson's activityType so a stale child from a prior generation
// can't flip the flag.
function deriveLessonCompleted(lesson: {
  activityType: LessonActivityType;
  videos: { isCompleted: boolean }[];
  readings: { isCompleted: boolean }[];
  quizzes: { isCompleted: boolean }[];
  exercises: { isCompleted: boolean }[];
  projects: { isCompleted: boolean }[];
  discussions: { isCompleted: boolean }[];
}): boolean {
  switch (lesson.activityType) {
    case "VIDEO":
      return lesson.videos[0]?.isCompleted ?? false;
    case "READING":
    case "OTHER":
      return lesson.readings[0]?.isCompleted ?? false;
    case "QUIZ":
      return lesson.quizzes[0]?.isCompleted ?? false;
    case "EXERCISE":
      return lesson.exercises[0]?.isCompleted ?? false;
    case "PROJECT":
      return lesson.projects[0]?.isCompleted ?? false;
    case "DISCUSSION":
      return lesson.discussions[0]?.isCompleted ?? false;
    default:
      return false;
  }
}

const lessonCompletionInclude = {
  videos: { take: 1, select: { isCompleted: true } },
  readings: { take: 1, select: { isCompleted: true } },
  quizzes: { take: 1, select: { isCompleted: true } },
  exercises: { take: 1, select: { isCompleted: true } },
  projects: { take: 1, select: { isCompleted: true } },
  discussions: { take: 1, select: { isCompleted: true } },
} as const;

// Ensure a check-in row exists for the user's *current* local day. Idempotent
// (keyed on the user+date unique constraint), so completing several lessons in
// the same day only ever produces a single check-in.
export async function ensureCheckInForToday(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  const today = startOfDayInTimezone(new Date(), user?.timezone ?? "UTC");
  await prisma.checkIn.upsert({
    where: { userId_date: { userId, date: today } },
    create: { id: crypto.randomUUID(), userId, date: today },
    update: {},
  });
}

// Recompute `isCompleted` for every study session that packs the given lesson.
// Sessions reference lessons through the `lessonIds` JSON array (no FK), and a
// single slot can bundle several lessons, so a session only counts as done once
// *all* of its lessons are complete. We recompute the flag from scratch (rather
// than blindly setting it true) so toggling a lesson back to incomplete keeps
// the session state honest.
export async function syncStudySessionsForLesson(
  userId: string,
  lessonId: string,
): Promise<void> {
  const sessions = await prisma.studySession.findMany({
    where: { userId, lessonIds: { array_contains: lessonId } },
    select: { id: true, lessonIds: true, isCompleted: true },
  });
  if (sessions.length === 0) return;

  // Resolve completion for every lesson referenced across the affected
  // sessions in a single query.
  const referencedLessonIds = Array.from(
    new Set(
      sessions.flatMap((s) =>
        Array.isArray(s.lessonIds) ? (s.lessonIds as string[]) : [],
      ),
    ),
  );
  const lessons = await prisma.lesson.findMany({
    where: { id: { in: referencedLessonIds } },
    select: { id: true, activityType: true, ...lessonCompletionInclude },
  });
  const completedById = new Map(
    lessons.map((l) => [l.id, deriveLessonCompleted(l)]),
  );

  await Promise.all(
    sessions.map((session) => {
      const ids = Array.isArray(session.lessonIds)
        ? (session.lessonIds as string[])
        : [];
      // A session with no resolvable lessons can never be "all complete".
      const isCompleted =
        ids.length > 0 && ids.every((id) => completedById.get(id) === true);
      if (isCompleted === session.isCompleted) return Promise.resolve();
      return prisma.studySession.update({
        where: { id: session.id },
        data: { isCompleted },
      });
    }),
  );
}

// Called whenever a lesson's completion state may have changed. Always resyncs
// the study sessions that contain the lesson; when the lesson was just
// *completed* we also check the user in for the day (only if they hadn't
// already). Toggling a lesson back to incomplete just resyncs the sessions
// without touching check-ins — you don't "un-show-up" for a day.
export async function onLessonCompletionChanged({
  userId,
  lessonId,
  completed,
}: {
  userId: string;
  lessonId: string;
  completed: boolean;
}): Promise<void> {
  await syncStudySessionsForLesson(userId, lessonId);
  if (completed) {
    await ensureCheckInForToday(userId);
  }
}
