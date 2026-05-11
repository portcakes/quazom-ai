import "server-only";

import { z } from "zod";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@quazom-ai/db";
import {
  curriculumLevels,
  curriculumObjectiveSchema,
  curriculumResourceSchema,
  nextCurriculumLevel,
  type CurriculumLevel,
  type CurriculumObjective,
  type CurriculumResource,
} from "@/inngest/schemas";
import {
  getCurriculumModulesWithLessons,
  type CurriculumModuleWithLessons,
} from "./lesson";

export type CurriculumProgress = {
  completedLessonCount: number;
  totalLessonCount: number;
  // Integer percent (0-100). 0 when there are no lessons yet.
  percent: number;
  // True when every lesson at the current top level is complete. Drives the
  // "Generate <next level> modules" CTA.
  topLevelComplete: boolean;
  // Highest level any module on this curriculum currently belongs to.
  currentTopLevel: CurriculumLevel;
  // null when the curriculum is already at the cap (advanced).
  nextLevel: CurriculumLevel | null;
};

export type CurriculumDetail = {
  id: string;
  title: string;
  overview: string;
  subject: string;
  level: string;
  goal: string;
  estimatedDuration: string;
  isHidden: boolean;
  objectives: CurriculumObjective[];
  modules: CurriculumModuleWithLessons[];
  recommendedResources: CurriculumResource[];
  progress: CurriculumProgress;
};

export async function getCurriculumById(
  id: string,
): Promise<CurriculumDetail | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const curriculum = await prisma.curriculum.findFirst({
    where: { id, userId: session.user.id },
    select: {
      id: true,
      title: true,
      overview: true,
      subject: true,
      level: true,
      goal: true,
      estimatedDuration: true,
      isHidden: true,
      objectives: true,
      recommendedResources: true,
    },
  });

  if (!curriculum) return null;

  const modules = await getCurriculumModulesWithLessons(curriculum.id);
  const progress = computeCurriculumProgress(modules, curriculum.level);

  return {
    id: curriculum.id,
    title: curriculum.title,
    overview: curriculum.overview,
    subject: curriculum.subject,
    level: curriculum.level,
    goal: curriculum.goal,
    estimatedDuration: curriculum.estimatedDuration,
    isHidden: curriculum.isHidden,
    objectives: z.array(curriculumObjectiveSchema).parse(curriculum.objectives),
    modules,
    recommendedResources: z
      .array(curriculumResourceSchema)
      .parse(curriculum.recommendedResources),
    progress,
  };
}

// Compute the aggregate completion / level state for a curriculum from its
// hydrated module list. Pure so it can be unit-tested without hitting the DB
// and re-used by other call sites (e.g. tRPC routes that need progress).
export function computeCurriculumProgress(
  modules: CurriculumModuleWithLessons[],
  initialLevel: string,
): CurriculumProgress {
  const totalLessonCount = modules.reduce(
    (acc, m) => acc + m.totalLessonCount,
    0,
  );
  const completedLessonCount = modules.reduce(
    (acc, m) => acc + m.completedLessonCount,
    0,
  );
  const percent =
    totalLessonCount > 0
      ? Math.round((completedLessonCount / totalLessonCount) * 100)
      : 0;

  // Highest level present across the modules, falling back to the
  // curriculum's seed level when there are no modules yet (fresh stub).
  const presentLevels = new Set(
    modules.map((m) => m.level.toLowerCase() as CurriculumLevel),
  );
  let currentTopLevel: CurriculumLevel = (initialLevel.toLowerCase() as CurriculumLevel) ?? "beginner";
  for (const lvl of curriculumLevels) {
    if (presentLevels.has(lvl)) currentTopLevel = lvl;
  }
  if (!curriculumLevels.includes(currentTopLevel)) currentTopLevel = "beginner";

  const topLevelModules = modules.filter(
    (m) => m.level.toLowerCase() === currentTopLevel,
  );
  const topLevelComplete =
    topLevelModules.length > 0 &&
    topLevelModules.every((m) => m.totalLessonCount > 0 && m.isCompleted);

  return {
    completedLessonCount,
    totalLessonCount,
    percent,
    topLevelComplete,
    currentTopLevel,
    nextLevel: nextCurriculumLevel(currentTopLevel),
  };
}
