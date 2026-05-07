import "server-only";

import { z } from "zod";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import {
  curriculumObjectiveSchema,
  curriculumModuleSchema,
  curriculumResourceSchema,
  type CurriculumObjective,
  type CurriculumModule,
  type CurriculumResource,
} from "@/inngest/schemas";

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
  modules: CurriculumModule[];
  recommendedResources: CurriculumResource[];
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
      modules: true,
      recommendedResources: true,
    },
  });

  if (!curriculum) return null;

  // The JSON columns came from the LLM at write time, but parse defensively
  // here so the page can rely on the typed shape.
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
    modules: z.array(curriculumModuleSchema).parse(curriculum.modules),
    recommendedResources: z
      .array(curriculumResourceSchema)
      .parse(curriculum.recommendedResources),
  };
}
