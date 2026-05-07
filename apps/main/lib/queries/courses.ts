import "server-only";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";

export type CourseSummary = {
  id: string;
  name: string;
};

export async function getUserCourses(): Promise<CourseSummary[]> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return [];

  const curricula = await prisma.curriculum.findMany({
    where: { userId: session.user.id },
    select: { id: true, title: true },
    orderBy: { createdAt: "desc" },
  });

  return curricula.map((c) => ({ id: c.id, name: c.title }));
}
