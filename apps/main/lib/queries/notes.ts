import "server-only";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@quazom-ai/db";

export type NoteSummary = {
  id: string;
  title: string | null;
  description: string | null;
  content: string;
  isAnnotation: boolean;
  lessonId: string | null;
  curriculumId: string | null;
  resourceId: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  lesson: {
    id: string;
    title: string;
    moduleId: string;
    curriculumId: string;
  } | null;
  curriculum: {
    id: string;
    title: string;
  } | null;
  resource: {
    id: string;
    title: string;
  } | null;
};

type ListOptions = {
  /** Restrict to notes attached directly to this curriculum, OR to lessons within it. */
  curriculumId?: string;
  /** Restrict to notes attached to this lesson. */
  lessonId?: string;
  /** Restrict to notes attached to this resource. */
  resourceId?: string;
  /** Only free-form (no lesson, no curriculum, no resource) user notes. */
  scope?: "all" | "user" | "curriculum" | "lesson" | "resource";
};

export async function getUserNotes(opts: ListOptions = {}): Promise<NoteSummary[]> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return [];

  type NoteWhere = NonNullable<
    NonNullable<Parameters<typeof prisma.note.findMany>[0]>["where"]
  >;
  const where: NoteWhere = { userId: session.user.id };

  if (opts.lessonId) {
    where.lessonId = opts.lessonId;
  } else if (opts.resourceId) {
    where.resourceId = opts.resourceId;
  } else if (opts.curriculumId) {
    // Either notes scoped directly to the curriculum, or to a lesson that
    // belongs to the curriculum.
    where.OR = [
      { curriculumId: opts.curriculumId },
      { lesson: { module: { curriculumId: opts.curriculumId } } },
    ];
  } else if (opts.scope === "user") {
    where.lessonId = null;
    where.curriculumId = null;
    where.resourceId = null;
  }

  const rows = await prisma.note.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      lesson: {
        select: {
          id: true,
          title: true,
          moduleId: true,
          module: { select: { curriculumId: true } },
        },
      },
      curriculum: { select: { id: true, title: true } },
      resource: { select: { id: true, title: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    content: row.content,
    isAnnotation: row.isAnnotation,
    lessonId: row.lessonId,
    curriculumId: row.curriculumId,
    resourceId: row.resourceId,
    tags: row.tags,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lesson: row.lesson
      ? {
          id: row.lesson.id,
          title: row.lesson.title,
          moduleId: row.lesson.moduleId,
          curriculumId: row.lesson.module.curriculumId,
        }
      : null,
    curriculum: row.curriculum
      ? { id: row.curriculum.id, title: row.curriculum.title }
      : null,
    resource: row.resource
      ? { id: row.resource.id, title: row.resource.title }
      : null,
  }));
}

export type NoteDetail = NoteSummary & {
  prevId: string | null;
  nextId: string | null;
};

/**
 * Fetches a single note by id, scoped to the current user, plus the
 * neighbouring note ids in the user's reverse-chronological order. Returns
 * null when the note doesn't exist or belongs to another user — the page
 * uses this to drive a `notFound()` so non-owners get a 404, not a 403.
 */
export async function getNoteForCurrentUser(
  noteId: string,
): Promise<NoteDetail | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const note = await prisma.note.findFirst({
    where: { id: noteId, userId: session.user.id },
    include: {
      lesson: {
        select: {
          id: true,
          title: true,
          moduleId: true,
          module: { select: { curriculumId: true } },
        },
      },
      curriculum: { select: { id: true, title: true } },
      resource: { select: { id: true, title: true } },
    },
  });
  if (!note) return null;

  const ordered = await prisma.note.findMany({
    where: { userId: session.user.id },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: { id: true },
  });
  const idx = ordered.findIndex((n) => n.id === note.id);
  const prevId = idx > 0 ? ordered[idx - 1]!.id : null;
  const nextId =
    idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1]!.id : null;

  return {
    id: note.id,
    title: note.title,
    description: note.description,
    content: note.content,
    isAnnotation: note.isAnnotation,
    lessonId: note.lessonId,
    curriculumId: note.curriculumId,
    resourceId: note.resourceId,
    tags: note.tags,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    lesson: note.lesson
      ? {
          id: note.lesson.id,
          title: note.lesson.title,
          moduleId: note.lesson.moduleId,
          curriculumId: note.lesson.module.curriculumId,
        }
      : null,
    curriculum: note.curriculum
      ? { id: note.curriculum.id, title: note.curriculum.title }
      : null,
    resource: note.resource
      ? { id: note.resource.id, title: note.resource.title }
      : null,
    prevId,
    nextId,
  };
}
