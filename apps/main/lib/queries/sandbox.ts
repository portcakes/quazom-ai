import "server-only";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@quazom-ai/db";
import type { LessonActivityType } from "@quazom-ai/db/enums";

// ---------------------------------------------------------------------------
// Card / list shapes
// ---------------------------------------------------------------------------

export type SandboxCardSummary = {
  id: string;
  title: string;
  description: string;
  isHidden: boolean;
  createdAt: Date;
  sourceCount: number;
  researchSessionCount: number;
  totalMaterialCount: number;
  completedMaterialCount: number;
};

// Minimal shape for the sidebar list (visible sandboxes only).
export type SandboxSidebarSummary = {
  id: string;
  title: string;
};

// ---------------------------------------------------------------------------
// Detail shapes
// ---------------------------------------------------------------------------

export type SandboxSourceSummary = {
  id: string;
  kind:
    | "TOPIC"
    | "LINK_RESOURCE"
    | "FILE_RESOURCE"
    | "CONTINUITY_NOTE"
    | "THESIS"
    | "QUESTION";
  order: number;
  label: string;
  text: string | null;
  resourceId: string | null;
  resourceUrl: string | null;
  resourceDomain: string | null;
  resourceFileType: string | null;
  continuityNoteId: string | null;
};

export type SandboxResearchSessionSummary = {
  id: string;
  title: string;
  sourceCount: number;
  messageCount: number;
  updatedAt: Date;
};

export type SandboxMaterialSummary = {
  id: string;
  lessonId: string;
  kind: "READING" | "QUIZ" | "PROJECT";
  title: string;
  status: "STUB" | "GENERATING" | "READY" | "FAILED";
  activityType: LessonActivityType;
  isCompleted: boolean;
  createdAt: Date;
};

export type SandboxDetail = {
  id: string;
  title: string;
  description: string;
  thesis: string | null;
  isHidden: boolean;
  createdAt: Date;
  sources: SandboxSourceSummary[];
  researchSessions: SandboxResearchSessionSummary[];
  materials: SandboxMaterialSummary[];
};

// Lesson child-row shape for completion derivation. Mirrors the local helper
// in `courses.ts` so the sandbox query stays self-contained.
type LessonCompletionRows = {
  activityType: LessonActivityType;
  videos: { isCompleted: boolean }[];
  readings: { isCompleted: boolean }[];
  quizzes: { isCompleted: boolean }[];
  exercises: { isCompleted: boolean }[];
  projects: { isCompleted: boolean }[];
  discussions: { isCompleted: boolean }[];
};

function lessonCompletedFromRows(lesson: LessonCompletionRows): boolean {
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

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Total sandbox count (visible + hidden) for the user. Drives the combined
 * "See all Studies" sidebar link alongside the curricula count.
 */
export async function getUserSandboxesCount(): Promise<number> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return 0;
  return prisma.sandbox.count({ where: { userId: session.user.id } });
}

/**
 * Visible sandboxes for the sidebar list. Hidden ones are excluded so the
 * sidebar mirrors the curricula behaviour.
 */
export async function getUserSandboxSummaries(): Promise<SandboxSidebarSummary[]> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return [];
  const sandboxes = await prisma.sandbox.findMany({
    where: { userId: session.user.id, isHidden: false },
    select: { id: true, title: true },
    orderBy: { createdAt: "desc" },
  });
  return sandboxes.map((s) => ({ id: s.id, title: s.title }));
}

/**
 * All sandboxes (visible + hidden) for the collection / Studies grid, with
 * per-sandbox material completion so each card can render a progress bar.
 */
export async function getUserSandboxes(): Promise<SandboxCardSummary[]> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return [];

  const sandboxes = await prisma.sandbox.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      isHidden: true,
      createdAt: true,
      _count: { select: { sources: true, researchSessions: true } },
      materials: {
        select: {
          lesson: {
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
  });

  return sandboxes.map((s) => {
    let total = 0;
    let completed = 0;
    for (const m of s.materials) {
      total += 1;
      if (lessonCompletedFromRows(m.lesson)) completed += 1;
    }
    return {
      id: s.id,
      title: s.title,
      description: s.description,
      isHidden: s.isHidden,
      createdAt: s.createdAt,
      sourceCount: s._count.sources,
      researchSessionCount: s._count.researchSessions,
      totalMaterialCount: total,
      completedMaterialCount: completed,
    };
  });
}

/**
 * Full sandbox detail for the `/sandboxes/[id]` page. Returns null when the
 * sandbox doesn't exist or isn't owned by the current user.
 */
export async function getSandboxById(id: string): Promise<SandboxDetail | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const sandbox = await prisma.sandbox.findFirst({
    where: { id, userId: session.user.id },
    select: {
      id: true,
      title: true,
      description: true,
      thesis: true,
      isHidden: true,
      createdAt: true,
      sources: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          kind: true,
          order: true,
          label: true,
          text: true,
          resourceId: true,
          continuityNoteId: true,
          resource: { select: { url: true, domain: true, fileType: true } },
        },
      },
      researchSessions: {
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          sourceIds: true,
          chatHistory: true,
          updatedAt: true,
        },
      },
      materials: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          kind: true,
          createdAt: true,
          lesson: {
            select: {
              id: true,
              title: true,
              status: true,
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
  });

  if (!sandbox) return null;

  const sources: SandboxSourceSummary[] = sandbox.sources.map((s) => ({
    id: s.id,
    kind: s.kind,
    order: s.order,
    label: s.label,
    text: s.text,
    resourceId: s.resourceId,
    resourceUrl: s.resource?.url ?? null,
    resourceDomain: s.resource?.domain ?? null,
    resourceFileType: s.resource?.fileType ?? null,
    continuityNoteId: s.continuityNoteId,
  }));

  const researchSessions: SandboxResearchSessionSummary[] =
    sandbox.researchSessions.map((rs) => {
      const sourceIds = Array.isArray(rs.sourceIds)
        ? (rs.sourceIds as string[])
        : [];
      const history = Array.isArray(rs.chatHistory)
        ? (rs.chatHistory as unknown[])
        : [];
      return {
        id: rs.id,
        title: rs.title,
        sourceCount: sourceIds.length,
        messageCount: history.length,
        updatedAt: rs.updatedAt,
      };
    });

  const materials: SandboxMaterialSummary[] = sandbox.materials.map((m) => ({
    id: m.id,
    lessonId: m.lesson.id,
    kind: m.kind,
    title: m.lesson.title,
    status: m.lesson.status,
    activityType: m.lesson.activityType,
    isCompleted: lessonCompletedFromRows(m.lesson),
    createdAt: m.createdAt,
  }));

  return {
    id: sandbox.id,
    title: sandbox.title,
    description: sandbox.description,
    thesis: sandbox.thesis,
    isHidden: sandbox.isHidden,
    createdAt: sandbox.createdAt,
    sources,
    researchSessions,
    materials,
  };
}
