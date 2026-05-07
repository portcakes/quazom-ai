import "server-only";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";

export type CourseSummary = {
  id: string;
  name: string;
};

export type CurriculumCardSummary = {
  id: string;
  title: string;
  level: string;
  estimatedDuration: string;
  overview: string;
  isHidden: boolean;
};

/**
 * Visible curricula for the sidebar list.
 * Hidden ones are excluded.
 */
export async function getUserCourses(): Promise<CourseSummary[]> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return [];

  const curricula = await prisma.curriculum.findMany({
    where: { userId: session.user.id, isHidden: false },
    select: { id: true, title: true },
    orderBy: { createdAt: "desc" },
  });

  return curricula.map((c) => ({ id: c.id, name: c.title }));
}

/**
 * Total count of curricula for the user, including hidden ones.
 * Drives the "See all Curricula" link visibility in the sidebar.
 */
export async function getUserCurriculaCount(): Promise<number> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return 0;

  return await prisma.curriculum.count({
    where: { userId: session.user.id },
  });
}

/**
 * All curricula for the collection page grid (visible + hidden).
 */
export async function getUserCurricula(): Promise<CurriculumCardSummary[]> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return [];

  const curricula = await prisma.curriculum.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      title: true,
      level: true,
      estimatedDuration: true,
      overview: true,
      isHidden: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return curricula;
}
