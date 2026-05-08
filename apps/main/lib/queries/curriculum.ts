import "server-only";

import { z } from "zod";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import {
  curriculumObjectiveSchema,
  curriculumResourceSchema,
  type CurriculumObjective,
  type CurriculumResource,
} from "@/inngest/schemas";
import {
  getCurriculumModulesWithLessons,
  type CurriculumModuleWithLessons,
} from "./lesson";

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
  };
}
