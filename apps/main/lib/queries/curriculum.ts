import "server-only";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";

export type CurriculumDetail = {
  id: string;
  title: string;
  overview: string;
  subject: string;
  level: string;
  goal: string;
  estimatedDuration: string;
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
    },
  });

  return curriculum;
}
