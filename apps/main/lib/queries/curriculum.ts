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

// Lightweight shape for a curriculum's source list rendered on the
// curriculum hero / Sources panel. The full Resource object isn't pulled
// in — just enough to label + link each entry.
export type CurriculumSourceSummary =
  | {
      id: string;
      kind: "TOPIC";
      order: number;
      topicText: string;
    }
  | {
      id: string;
      kind: "LINK_RESOURCE" | "FILE_RESOURCE";
      order: number;
      resourceId: string | null;
      resourceTitle: string | null;
      resourceUrl: string | null;
      resourceDomain: string | null;
      resourceFileType: string | null;
    }
  | {
      id: string;
      kind: "CONTINUITY_NOTE";
      order: number;
      continuityNoteId: string | null;
      continuityNoteTitle: string | null;
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
  // SINGLE | CONTINUITY — drives the "Continuity" badge on the hero.
  kind: "SINGLE" | "CONTINUITY";
  // PENDING | READY | FAILED — drives which page shell renders.
  status: "PENDING" | "READY" | "FAILED";
  statusMessage: string | null;
  // Optional thesis for continuity curricula.
  thesis: string | null;
  // Activity-type filter the user picked at creation time. The settings
  // panel surfaces this so the user can see why their curriculum has no
  // discussion lessons.
  includedActivityTypes: (
    | "VIDEO"
    | "QUIZ"
    | "EXERCISE"
    | "PROJECT"
    | "DISCUSSION"
    | "READING"
    | "OTHER"
  )[];
  objectives: CurriculumObjective[];
  modules: CurriculumModuleWithLessons[];
  recommendedResources: CurriculumResource[];
  // Inputs the user fed in. Empty for legacy single-source curricula that
  // were created before this column existed.
  sources: CurriculumSourceSummary[];
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
      kind: true,
      status: true,
      statusMessage: true,
      thesis: true,
      includedActivityTypes: true,
      objectives: true,
      recommendedResources: true,
      sources: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          kind: true,
          order: true,
          topicText: true,
          resourceId: true,
          continuityNoteId: true,
          resource: {
            select: {
              id: true,
              title: true,
              url: true,
              domain: true,
              fileType: true,
            },
          },
        },
      },
    },
  });

  if (!curriculum) return null;

  const modules = await getCurriculumModulesWithLessons(curriculum.id);
  const progress = computeCurriculumProgress(modules, curriculum.level);

  // Surface continuity-note titles when present (a small extra round-trip,
  // but we only do it when the curriculum actually references notes).
  const continuityNoteIds = curriculum.sources
    .filter((s) => s.kind === "CONTINUITY_NOTE" && s.continuityNoteId)
    .map((s) => s.continuityNoteId as string);
  const noteTitleById = new Map<string, string | null>();
  if (continuityNoteIds.length > 0) {
    const notes = await prisma.continuityNote.findMany({
      where: { id: { in: continuityNoteIds }, userId: session.user.id },
      select: { id: true, title: true },
    });
    for (const n of notes) noteTitleById.set(n.id, n.title);
  }

  const sources: CurriculumSourceSummary[] = curriculum.sources.map((s) => {
    if (s.kind === "TOPIC") {
      return {
        id: s.id,
        kind: "TOPIC",
        order: s.order,
        topicText: s.topicText ?? "",
      };
    }
    if (s.kind === "CONTINUITY_NOTE") {
      return {
        id: s.id,
        kind: "CONTINUITY_NOTE",
        order: s.order,
        continuityNoteId: s.continuityNoteId,
        continuityNoteTitle: s.continuityNoteId
          ? (noteTitleById.get(s.continuityNoteId) ?? null)
          : null,
      };
    }
    return {
      id: s.id,
      kind: s.kind,
      order: s.order,
      resourceId: s.resourceId,
      resourceTitle: s.resource?.title ?? null,
      resourceUrl: s.resource?.url ?? null,
      resourceDomain: s.resource?.domain ?? null,
      resourceFileType: s.resource?.fileType ?? null,
    };
  });

  return {
    id: curriculum.id,
    title: curriculum.title,
    overview: curriculum.overview,
    subject: curriculum.subject,
    level: curriculum.level,
    goal: curriculum.goal,
    estimatedDuration: curriculum.estimatedDuration,
    isHidden: curriculum.isHidden,
    kind: curriculum.kind,
    status: curriculum.status,
    statusMessage: curriculum.statusMessage,
    thesis: curriculum.thesis,
    includedActivityTypes: curriculum.includedActivityTypes,
    objectives: z.array(curriculumObjectiveSchema).parse(curriculum.objectives),
    modules,
    recommendedResources: z
      .array(curriculumResourceSchema)
      .parse(curriculum.recommendedResources),
    sources,
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
