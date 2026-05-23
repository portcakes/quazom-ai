import "server-only";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@quazom-ai/db";

export type ContinuityNoteSummary = {
  id: string;
  title: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type ContinuityNoteDetail = ContinuityNoteSummary & {
  content: string;
};

/**
 * Returns every continuity note the current user owns, ordered by most
 * recently updated. The sidebar uses this to render the section list, so we
 * intentionally keep the payload light — the body lives behind a separate
 * fetch when the user actually opens the editor.
 */
export async function getUserContinuityNotes(): Promise<ContinuityNoteSummary[]> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return [];

  const rows = await prisma.continuityNote.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      tags: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return rows;
}

/** Single note fetch (used by the editor panel when it loads a specific id). */
export async function getContinuityNoteForCurrentUser(
  noteId: string,
): Promise<ContinuityNoteDetail | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const note = await prisma.continuityNote.findFirst({
    where: { id: noteId, userId: session.user.id },
    select: {
      id: true,
      title: true,
      content: true,
      tags: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return note ?? null;
}

/**
 * Lightweight link-source list for the editor's "Insert link" picker. We
 * surface everything the user can link to — curricula, the lessons inside
 * them, and saved resources — in one round trip so the picker can filter
 * locally as the user types.
 */
export type ContinuityLinkSources = {
  curricula: { id: string; title: string }[];
  lessons: {
    id: string;
    title: string;
    curriculumId: string;
    curriculumTitle: string;
  }[];
  resources: { id: string; title: string }[];
};

export async function getContinuityLinkSources(): Promise<ContinuityLinkSources> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { curricula: [], lessons: [], resources: [] };
  }

  const [curricula, lessons, resources] = await Promise.all([
    prisma.curriculum.findMany({
      where: { userId: session.user.id },
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.lesson.findMany({
      where: { module: { curriculum: { userId: session.user.id } } },
      select: {
        id: true,
        title: true,
        module: {
          select: {
            curriculumId: true,
            curriculum: { select: { title: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.resource.findMany({
      where: { userId: session.user.id },
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return {
    curricula,
    lessons: lessons.map((l) => ({
      id: l.id,
      title: l.title,
      curriculumId: l.module.curriculumId,
      curriculumTitle: l.module.curriculum.title,
    })),
    resources,
  };
}
