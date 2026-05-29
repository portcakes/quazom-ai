import "server-only";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@quazom-ai/db";
import type { LessonActivityType } from "@quazom-ai/db/enums";

export type CourseSummary = {
  id: string;
  name: string;
  // SINGLE | CONTINUITY. Lets the sidebar pin a small "Continuity" badge
  // next to multi-source curricula without an extra round trip.
  kind: "SINGLE" | "CONTINUITY";
  // Lifecycle. PENDING entries can render a tiny spinner while Inngest
  // works; FAILED ones can show a warning icon.
  status: "PENDING" | "READY" | "FAILED";
};

export type CurriculumCardSummary = {
  id: string;
  title: string;
  level: string;
  estimatedDuration: string;
  overview: string;
  isHidden: boolean;
  kind: "SINGLE" | "CONTINUITY";
  status: "PENDING" | "READY" | "FAILED";
  // Aggregated completion stats so the collection card can render a progress
  // bar without each card hitting the DB individually.
  completedLessonCount: number;
  totalLessonCount: number;
  progressPercent: number;
};

/**
 * Visible curricula for the sidebar list.
 * Hidden ones are excluded.
 */
export async function getUserCourses(): Promise<CourseSummary[]> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return [];

  const curricula = await prisma.curriculum.findMany({
    // `sandboxId: null` excludes the hidden curricula that back Knowledge
    // Sandboxes — those are never shown as standalone curricula.
    where: { userId: session.user.id, isHidden: false, sandboxId: null },
    select: { id: true, title: true, kind: true, status: true },
    orderBy: { createdAt: "desc" },
  });

  return curricula.map((c) => ({
    id: c.id,
    name: c.title,
    kind: c.kind,
    status: c.status,
  }));
}

/**
 * Total count of curricula for the user, including hidden ones.
 * Drives the "See all Curricula" link visibility in the sidebar.
 */
export async function getUserCurriculaCount(): Promise<number> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return 0;

  return await prisma.curriculum.count({
    where: { userId: session.user.id, sandboxId: null },
  });
}

/**
 * All curricula for the collection page grid (visible + hidden), with the
 * per-curriculum completion stats so each card can render a progress bar.
 */
export async function getUserCurricula(): Promise<CurriculumCardSummary[]> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return [];

  const curricula = await prisma.curriculum.findMany({
    where: { userId: session.user.id, sandboxId: null },
    select: {
      id: true,
      title: true,
      level: true,
      estimatedDuration: true,
      overview: true,
      isHidden: true,
      kind: true,
      status: true,
      curriculumModules: {
        select: {
          lessons: {
            select: {
              activityType: true,
              videos: { take: 1, select: { isCompleted: true } },
              readings: { take: 1, select: { isCompleted: true } },
              quizzes: { take: 1, select: { isCompleted: true } },
              exercises: { take: 1, select: { isCompleted: true } },
              projects: { take: 1, select: { isCompleted: true } },
              discussions: { take: 1, select: { isCompleted: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return curricula.map((c) => {
    let total = 0;
    let completed = 0;
    for (const m of c.curriculumModules) {
      for (const l of m.lessons) {
        total += 1;
        if (lessonCompletedFromRows(l)) completed += 1;
      }
    }
    const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return {
      id: c.id,
      title: c.title,
      level: c.level,
      estimatedDuration: c.estimatedDuration,
      overview: c.overview,
      isHidden: c.isHidden,
      kind: c.kind,
      status: c.status,
      completedLessonCount: completed,
      totalLessonCount: total,
      progressPercent,
    };
  });
}

// Local copy of the lesson-completion derivation kept here so the courses
// query stays self-contained and Next.js doesn't have to import the more
// expensive lesson query module for the collection page.
function lessonCompletedFromRows(lesson: {
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
