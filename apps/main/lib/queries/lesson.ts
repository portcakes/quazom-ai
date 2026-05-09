import "server-only";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@quazom-ai/db";
import type {
  LessonActivityType,
  LessonStatus,
  ProjectType,
} from "@quazom-ai/db/enums";
import {
  curriculumObjectiveSchema,
  curriculumResourceSchema,
  type CurriculumObjective,
  type CurriculumResource,
  type QuizQuestion,
} from "@/inngest/schemas";
import { z } from "zod";

const objectivesArray = z.array(curriculumObjectiveSchema);
const resourcesArray = z.array(curriculumResourceSchema);

export type LessonChatMessage = {
  role: "assistant" | "user";
  content: string;
  createdAt: string;
};

export type LessonFeedback = {
  summary: string;
  strengths: string[];
  weakAreas: string[];
  nextSteps: string[];
};

export type QuizDetail = {
  id: string;
  title: string;
  questions: QuizQuestion[];
  userAnswers: number[] | null;
  feedback: LessonFeedback | null;
  score: number;
  maxScore: number;
  passScore: number;
  isPassed: boolean;
  isCompleted: boolean;
};

export type ExerciseDetail = QuizDetail & {
  description: string;
  hints: string[];
};

export type VideoDetail = {
  id: string;
  title: string;
  description: string;
  overview: string;
  embedUrl: string;
  externalUrl: string | null;
  thumbnailUrl: string | null;
  duration: string;
  isCompleted: boolean;
};

export type ReadingDetail = {
  id: string;
  title: string;
  summary: string;
  overview: string;
  content: string;
  recommendedResources: CurriculumResource[];
  isCompleted: boolean;
};

export type ProjectDetail = {
  id: string;
  title: string;
  summary: string;
  objectives: CurriculumObjective[];
  recommendedResources: CurriculumResource[];
  projectType: ProjectType;
  submissionUrl: string | null;
  isCompleted: boolean;
  feedback: LessonFeedback | null;
};

export type DiscussionDetail = {
  id: string;
  title: string;
  summary: string;
  objectives: CurriculumObjective[];
  recommendedResources: CurriculumResource[];
  chatHistory: LessonChatMessage[];
  isCompleted: boolean;
};

export type LessonDetail = {
  id: string;
  title: string;
  description: string;
  summary: string;
  duration: string;
  activityType: LessonActivityType;
  status: LessonStatus;
  objectives: CurriculumObjective[];
  recommendedResources: CurriculumResource[];
  module: {
    id: string;
    title: string;
    curriculum: { id: string; title: string };
  };
  quiz: QuizDetail | null;
  exercise: ExerciseDetail | null;
  video: VideoDetail | null;
  reading: ReadingDetail | null;
  project: ProjectDetail | null;
  discussion: DiscussionDetail | null;
};

/**
 * Fetch a fully-hydrated lesson the current user owns. Returns null if the
 * lesson doesn't exist, the user isn't logged in, or the lesson belongs to a
 * different user.
 */
export async function getLessonById(id: string): Promise<LessonDetail | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: {
      module: {
        include: {
          curriculum: { select: { id: true, title: true, userId: true } },
        },
      },
      quizzes: { take: 1 },
      exercises: { take: 1 },
      videos: { take: 1 },
      readings: { take: 1 },
      projects: { take: 1 },
      discussions: { take: 1 },
    },
  });

  if (!lesson || lesson.module.curriculum.userId !== session.user.id) return null;

  const quiz = lesson.quizzes[0]
    ? toQuizDetail(lesson.quizzes[0])
    : null;
  const exercise = lesson.exercises[0]
    ? toExerciseDetail(lesson.exercises[0])
    : null;
  const video = lesson.videos[0] ? toVideoDetail(lesson.videos[0]) : null;
  const reading = lesson.readings[0] ? toReadingDetail(lesson.readings[0]) : null;
  const project = lesson.projects[0] ? toProjectDetail(lesson.projects[0]) : null;
  const discussion = lesson.discussions[0]
    ? toDiscussionDetail(lesson.discussions[0])
    : null;

  return {
    id: lesson.id,
    title: lesson.title,
    description: lesson.description,
    summary: lesson.summary,
    duration: lesson.duration,
    activityType: lesson.activityType,
    status: lesson.status,
    objectives: parseObjectives(lesson.objectives),
    recommendedResources: parseResources(lesson.recommendedResources),
    module: {
      id: lesson.module.id,
      title: lesson.module.title,
      curriculum: {
        id: lesson.module.curriculum.id,
        title: lesson.module.curriculum.title,
      },
    },
    quiz,
    exercise,
    video,
    reading,
    project,
    discussion,
  };
}

// --------------------------------------------------------------------------
// JSON parsers — defensive because the columns are user-readable JSON blobs.
// --------------------------------------------------------------------------

function parseObjectives(value: unknown): CurriculumObjective[] {
  const result = objectivesArray.safeParse(value);
  return result.success ? result.data : [];
}

function parseResources(value: unknown): CurriculumResource[] {
  const result = resourcesArray.safeParse(value);
  return result.success ? result.data : [];
}

const quizQuestionsArray = z.array(
  z.object({
    question: z.string(),
    answers: z.array(z.string()),
    correctAnswerIndex: z.number().int(),
    explanation: z.string().optional().default(""),
  }),
);

function parseQuestions(value: unknown): QuizQuestion[] {
  const result = quizQuestionsArray.safeParse(value);
  return result.success
    ? (result.data as QuizQuestion[])
    : [];
}

const userAnswersArray = z.array(z.number().int());
function parseUserAnswers(value: unknown): number[] | null {
  if (value === null || value === undefined) return null;
  const result = userAnswersArray.safeParse(value);
  return result.success ? result.data : null;
}

const feedbackSchema = z.object({
  summary: z.string(),
  strengths: z.array(z.string()),
  weakAreas: z.array(z.string()),
  nextSteps: z.array(z.string()),
});
function parseFeedback(value: unknown): LessonFeedback | null {
  if (!value) return null;
  const result = feedbackSchema.safeParse(value);
  return result.success ? result.data : null;
}

const chatHistoryArray = z.array(
  z.object({
    role: z.enum(["assistant", "user"]),
    content: z.string(),
    createdAt: z.string(),
  }),
);
function parseChatHistory(value: unknown): LessonChatMessage[] {
  const result = chatHistoryArray.safeParse(value);
  return result.success ? result.data : [];
}

function toQuizDetail(q: {
  id: string;
  title: string;
  questions: unknown;
  userAnswers: unknown;
  feedback: unknown;
  score: number;
  maxScore: number;
  passScore: number;
  isPassed: boolean;
  isCompleted: boolean;
}): QuizDetail {
  return {
    id: q.id,
    title: q.title,
    questions: parseQuestions(q.questions),
    userAnswers: parseUserAnswers(q.userAnswers),
    feedback: parseFeedback(q.feedback),
    score: q.score,
    maxScore: q.maxScore,
    passScore: q.passScore,
    isPassed: q.isPassed,
    isCompleted: q.isCompleted,
  };
}

function toExerciseDetail(e: {
  id: string;
  title: string;
  description: string;
  questions: unknown;
  hints: unknown;
  userAnswers: unknown;
  feedback: unknown;
  score: number;
  maxScore: number;
  passScore: number;
  isPassed: boolean;
  isCompleted: boolean;
}): ExerciseDetail {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    questions: parseQuestions(e.questions),
    hints: Array.isArray(e.hints) ? (e.hints as string[]) : [],
    userAnswers: parseUserAnswers(e.userAnswers),
    feedback: parseFeedback(e.feedback),
    score: e.score,
    maxScore: e.maxScore,
    passScore: e.passScore,
    isPassed: e.isPassed,
    isCompleted: e.isCompleted,
  };
}

function toVideoDetail(v: {
  id: string;
  title: string;
  description: string;
  overview: string;
  embedUrl: string;
  externalUrl: string | null;
  thumbnailUrl: string | null;
  duration: string;
  isCompleted: boolean;
}): VideoDetail {
  return { ...v };
}

function toReadingDetail(r: {
  id: string;
  title: string;
  summary: string;
  overview: string;
  content: string;
  recommendedResources: unknown;
  isCompleted: boolean;
}): ReadingDetail {
  return {
    id: r.id,
    title: r.title,
    summary: r.summary,
    overview: r.overview,
    content: r.content,
    recommendedResources: parseResources(r.recommendedResources),
    isCompleted: r.isCompleted,
  };
}

function toProjectDetail(p: {
  id: string;
  title: string;
  summary: string;
  objectives: unknown;
  recommendedResources: unknown;
  projectType: ProjectType;
  submissionUrl: string | null;
  isCompleted: boolean;
  feedback: unknown;
}): ProjectDetail {
  return {
    id: p.id,
    title: p.title,
    summary: p.summary,
    objectives: parseObjectives(p.objectives),
    recommendedResources: parseResources(p.recommendedResources),
    projectType: p.projectType,
    submissionUrl: p.submissionUrl,
    isCompleted: p.isCompleted,
    feedback: parseFeedback(p.feedback),
  };
}

function toDiscussionDetail(d: {
  id: string;
  title: string;
  summary: string;
  objectives: unknown;
  recommendedResources: unknown;
  chatHistory: unknown;
  isCompleted: boolean;
}): DiscussionDetail {
  return {
    id: d.id,
    title: d.title,
    summary: d.summary,
    objectives: parseObjectives(d.objectives),
    recommendedResources: parseResources(d.recommendedResources),
    chatHistory: parseChatHistory(d.chatHistory),
    isCompleted: d.isCompleted,
  };
}

// --------------------------------------------------------------------------
// Lessons grouped by module — used by the curriculum page to render a real
// lessons list (with status), backed by Lesson rows instead of curriculum JSON.
// --------------------------------------------------------------------------

export type CurriculumModuleWithLessons = {
  id: string;
  title: string;
  summary: string;
  order: number;
  objectives: string[];
  lessons: {
    id: string;
    title: string;
    description: string;
    activityType: LessonActivityType;
    status: LessonStatus;
    order: number;
  }[];
};

export async function getCurriculumModulesWithLessons(
  curriculumId: string,
): Promise<CurriculumModuleWithLessons[]> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return [];

  const curriculum = await prisma.curriculum.findUnique({
    where: { id: curriculumId },
    select: { userId: true },
  });
  if (!curriculum || curriculum.userId !== session.user.id) return [];

  const modules = await prisma.module.findMany({
    where: { curriculumId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: {
      lessons: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          description: true,
          activityType: true,
          status: true,
          order: true,
        },
      },
    },
  });

  return modules.map((m) => ({
    id: m.id,
    title: m.title,
    summary: m.summary,
    order: m.order,
    objectives: Array.isArray(m.objectives) ? (m.objectives as string[]) : [],
    lessons: m.lessons,
  }));
}
