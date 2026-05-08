import "server-only";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";

export type NoteSummary = {
  id: string;
  title: string | null;
  content: string;
  lessonId: string | null;
  curriculumId: string | null;
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
};

type ListOptions = {
  /** Restrict to notes attached directly to this curriculum, OR to lessons within it. */
  curriculumId?: string;
  /** Restrict to notes attached to this lesson. */
  lessonId?: string;
  /** Only free-form (no lesson, no curriculum) user notes. */
  scope?: "all" | "user" | "curriculum" | "lesson";
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
    },
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    lessonId: row.lessonId,
    curriculumId: row.curriculumId,
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
  }));
}
