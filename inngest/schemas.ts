import { z } from "zod";

// AI-facing activity types are lower-case; we normalise to the Prisma enum
// (UPPER_CASE) at the persistence boundary. `practice` is accepted from the
// LLM but treated as `exercise` per product spec.
export const lessonActivityTypes = [
  "reading",
  "quiz",
  "project",
  "practice",
  "discussion",
  "video",
  "exercise",
  "other",
] as const;
export type LessonActivityType = (typeof lessonActivityTypes)[number];

export const resourceTypes = [
  "book",
  "video",
  "article",
  "course",
  "website",
  "paper",
] as const;
export type ResourceType = (typeof resourceTypes)[number];

export const projectTypes = [
  "presentation",
  "report",
  "article",
  "essay",
  "research paper",
  "thesis",
  "code snippet",
  "code project",
  "other",
] as const;
export type ProjectType = (typeof projectTypes)[number];

export const curriculumObjectiveSchema = z.object({
  title: z.string(),
  description: z.string(),
  order: z.number().int().describe("1-indexed ordering of the objective."),
});

export const curriculumLessonSchema = z.object({
  title: z.string(),
  description: z.string(),
  activityType: z.enum(lessonActivityTypes),
});

export const curriculumModuleSchema = z.object({
  title: z.string(),
  summary: z.string(),
  objectives: z.array(z.string()).describe("Objective titles this module addresses."),
  lessons: z.array(curriculumLessonSchema),
});

export const curriculumResourceSchema = z.object({
  title: z.string(),
  type: z.enum(resourceTypes),
  reason: z.string().describe("Why this resource is recommended for the learner."),
  searchQuery: z.string().describe("Query the learner can paste into a search engine to find it."),
});

export const curriculumSchema = z.object({
  title: z.string().describe("Concise title for the curriculum."),
  overview: z.string().describe("1-3 sentence summary of what the learner will achieve."),
  level: z.string().describe("Difficulty level: beginner, intermediate, or advanced."),
  estimatedDuration: z.string().describe("Human-readable estimate, e.g. '6 weeks' or '20 hours'."),
  objectives: z.array(curriculumObjectiveSchema).describe("Top-level learning objectives, ordered."),
  modules: z.array(curriculumModuleSchema).describe("Sequenced modules, each containing lessons."),
  recommendedResources: z.array(curriculumResourceSchema),
});

// Used by the dev "backfill modules" tool on the curriculum page. Produces a
// fresh module-skeleton (no per-lesson AI content) for an existing curriculum.
// Sized to 4-5 modules with 5-8 lessons each per the dev tool spec.
export const modulesBackfillSchema = z.object({
  modules: z
    .array(curriculumModuleSchema)
    .min(4)
    .max(5)
    .describe(
      "4-5 modules sequenced foundational → advanced. Each module must contain 5-8 concrete lessons with a defined activityType.",
    ),
});

// Generic body shared by every lesson type. The activityType-specific child
// content lives in `*Schema` below and is generated alongside this base.
export const lessonBaseSchema = z.object({
  title: z.string(),
  summary: z.string().describe("1-3 sentence summary of the lesson."),
  description: z.string().describe("A short paragraph that orients the learner."),
  duration: z.string().describe("Human-readable estimate, e.g. '10 minutes' or '30 minutes'."),
  objectives: z
    .array(curriculumObjectiveSchema)
    .describe("Objectives this lesson addresses."),
  recommendedResources: z
    .array(curriculumResourceSchema)
    .describe("Resources recommended for the lesson."),
});

// ---------------------------------------------------------------------------
// Per-type content schemas (paired with lessonBaseSchema during generation)
// ---------------------------------------------------------------------------

export const videoContentSchema = z.object({
  title: z.string(),
  description: z.string().describe("Short description of the video."),
  overview: z
    .string()
    .describe(
      "AI-written overview shown above the embed: what the video covers, key takeaways, watch tips. 2-4 short paragraphs.",
    ),
  // The LLM may not know real video URLs. We accept either an embed URL (we'll
  // try to embed YouTube, otherwise fall back) and/or an external link.
  embedUrl: z
    .string()
    .describe(
      "A reasonable YouTube watch URL or embed URL for the topic. May be the same as externalUrl. If unknown, leave empty.",
    )
    .default(""),
  externalUrl: z
    .string()
    .describe("External link the learner can open if embedding fails.")
    .default(""),
  thumbnailUrl: z.string().default(""),
  duration: z.string().describe("Human-readable estimate, e.g. '10 minutes'."),
});

export const quizQuestionSchema = z.object({
  question: z.string().describe("The question text."),
  answers: z
    .array(z.string())
    .min(3)
    .max(6)
    .describe("4-6 answer choices. Exactly one must be correct."),
  correctAnswerIndex: z
    .number()
    .int()
    .min(0)
    .describe(
      "0-indexed position of the correct answer within `answers`. Must be a valid index.",
    ),
  explanation: z
    .string()
    .describe("Why the correct answer is correct (shown after submission).")
    .default(""),
});

export const quizContentSchema = z.object({
  title: z.string(),
  questions: z
    .array(quizQuestionSchema)
    .min(3)
    .max(10)
    .describe("5-10 multiple choice questions. Each must have exactly one correct answer."),
});

// Exercises are MC assessments — same shape as quiz, plus optional hints.
export const exerciseContentSchema = z.object({
  title: z.string(),
  description: z.string(),
  instructions: z
    .string()
    .describe("Short paragraph telling the learner what to do.")
    .default(""),
  questions: z
    .array(quizQuestionSchema)
    .min(15)
    .max(20)
    .describe("15-20 multiple choice questions, same shape as a quiz."),
  hints: z
    .array(z.string())
    .describe("Optional hints the learner can reveal.")
    .default([]),
});

export const projectContentSchema = z.object({
  title: z.string(),
  projectType: z.enum(projectTypes),
  summary: z.string(),
  objectives: z
    .array(curriculumObjectiveSchema)
    .describe(
      "Rubric-style objectives the submission must satisfy. The learner is graded against these.",
    ),
  recommendedResources: z
    .array(curriculumResourceSchema)
    .describe("Resources recommended for the project."),
});

export const readingContentSchema = z.object({
  title: z.string(),
  summary: z.string().describe("1-3 sentence summary of the reading."),
  overview: z
    .string()
    .describe("Topic overview shown above the deep-dive. 2-4 short paragraphs."),
  content: z
    .string()
    .describe(
      "The full deep-dive content as markdown with headings and subheadings. Should read like a structured document.",
    ),
  recommendedResources: z
    .array(curriculumResourceSchema)
    .describe("Resources for further reading."),
});

export const discussionContentSchema = z.object({
  title: z.string(),
  summary: z.string().describe("1-3 sentence framing of the discussion topic."),
  objectives: z
    .array(curriculumObjectiveSchema)
    .describe("Talking points / objectives the discussion should explore."),
  // The first assistant message that opens the discussion in the chat panel.
  openingMessage: z
    .string()
    .describe(
      "The first message from the AI tutor. Should pose an open-ended question or thesis to spark a productive exchange.",
    ),
  recommendedResources: z
    .array(curriculumResourceSchema)
    .describe("Resources recommended for the discussion."),
});

export const lessonGenerationSchema = z.object({
  base: lessonBaseSchema,
  video: videoContentSchema.optional(),
  quiz: quizContentSchema.optional(),
  exercise: exerciseContentSchema.optional(),
  project: projectContentSchema.optional(),
  reading: readingContentSchema.optional(),
  discussion: discussionContentSchema.optional(),
});

// ---------------------------------------------------------------------------
// Submission feedback (generated when the learner submits a quiz/exercise)
// ---------------------------------------------------------------------------

export const submissionFeedbackSchema = z.object({
  summary: z
    .string()
    .describe("2-4 sentence overall assessment of the learner's performance."),
  strengths: z
    .array(z.string())
    .describe("Concrete things the learner did well."),
  weakAreas: z
    .array(z.string())
    .describe("Concrete topics the learner should review."),
  nextSteps: z
    .array(z.string())
    .describe("Actionable suggestions for what to study next."),
});

export type CurriculumObjective = z.infer<typeof curriculumObjectiveSchema>;
export type CurriculumLesson = z.infer<typeof curriculumLessonSchema>;
export type CurriculumModule = z.infer<typeof curriculumModuleSchema>;
export type CurriculumResource = z.infer<typeof curriculumResourceSchema>;
export type CurriculumPayload = z.infer<typeof curriculumSchema>;
export type ModulesBackfillPayload = z.infer<typeof modulesBackfillSchema>;
export type LessonBase = z.infer<typeof lessonBaseSchema>;
export type LessonGeneration = z.infer<typeof lessonGenerationSchema>;
export type VideoContent = z.infer<typeof videoContentSchema>;
export type QuizContent = z.infer<typeof quizContentSchema>;
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
export type ExerciseContent = z.infer<typeof exerciseContentSchema>;
export type ProjectContent = z.infer<typeof projectContentSchema>;
export type ReadingContent = z.infer<typeof readingContentSchema>;
export type DiscussionContent = z.infer<typeof discussionContentSchema>;
export type SubmissionFeedback = z.infer<typeof submissionFeedbackSchema>;

// Map the AI-emitted activity type to our DB enum. `practice` collapses into
// `EXERCISE` — the product treats the two as the same MC assessment.
export function activityTypeToDb(
  type: LessonActivityType,
): "VIDEO" | "QUIZ" | "EXERCISE" | "PROJECT" | "DISCUSSION" | "READING" | "OTHER" {
  switch (type) {
    case "video":
      return "VIDEO";
    case "quiz":
      return "QUIZ";
    case "exercise":
    case "practice":
      return "EXERCISE";
    case "project":
      return "PROJECT";
    case "discussion":
      return "DISCUSSION";
    case "reading":
      return "READING";
    default:
      return "OTHER";
  }
}

// Inverse for callers that read the DB enum and want to drive the AI prompt.
export function dbToActivityType(
  type: "VIDEO" | "QUIZ" | "EXERCISE" | "PROJECT" | "DISCUSSION" | "READING" | "OTHER",
): LessonActivityType {
  switch (type) {
    case "VIDEO":
      return "video";
    case "QUIZ":
      return "quiz";
    case "EXERCISE":
      return "exercise";
    case "PROJECT":
      return "project";
    case "DISCUSSION":
      return "discussion";
    case "READING":
      return "reading";
    default:
      return "other";
  }
}

export const NOTE_MAX_LENGTH = 5000;
