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

// Used by the "Generate intermediate / advanced modules" button on a
// curriculum once the learner has completed every lesson at the current top
// level. Produces a fresh batch of modules that build on the prior level's
// learning rather than repeating it.
export const levelExtensionSchema = z.object({
  modules: z
    .array(curriculumModuleSchema)
    .min(3)
    .max(5)
    .describe(
      "3-5 modules that extend the curriculum into the next difficulty tier. Each module must contain 5-8 concrete lessons with a defined activityType, and should build on the prior level's material instead of repeating it.",
    ),
});

// Curriculum levels we support, ordered from easiest to hardest. Used by the
// progression logic to determine the next available tier (or whether the
// curriculum is at the cap).
export const curriculumLevels = ["beginner", "intermediate", "advanced"] as const;
export type CurriculumLevel = (typeof curriculumLevels)[number];

// Returns the next level the learner can extend into, or null if they're
// already at the top.
export function nextCurriculumLevel(
  current: string,
): CurriculumLevel | null {
  const normalized = current.toLowerCase() as CurriculumLevel;
  const idx = curriculumLevels.indexOf(normalized);
  if (idx === -1) return "intermediate";
  if (idx >= curriculumLevels.length - 1) return null;
  return curriculumLevels[idx + 1] ?? null;
}

// Question-count ranges per level. The phase-2 AI prompt uses these to size
// quizzes/exercises so beginner assessments stay short and advanced ones get
// progressively harder.
export const ASSESSMENT_LENGTH_BY_LEVEL: Record<
  CurriculumLevel,
  { min: number; max: number }
> = {
  beginner: { min: 5, max: 10 },
  intermediate: { min: 10, max: 25 },
  advanced: { min: 25, max: 40 },
};

export function assessmentLengthForLevel(level: string): {
  min: number;
  max: number;
} {
  const normalized = level.toLowerCase() as CurriculumLevel;
  return ASSESSMENT_LENGTH_BY_LEVEL[normalized] ?? ASSESSMENT_LENGTH_BY_LEVEL.beginner;
}

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
      "AI-written overview of the topic. 4-6 paragraphs.",
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

// Quiz and Exercise lessons are now generated in two phases:
//   1. The initial lesson generation produces the *pre-assessment* content —
//      a topic overview, a markdown deep-dive, and a set of recommended
//      readings (Google search) and videos (YouTube search). No questions
//      yet.
//   2. The learner clicks "Generate quiz/exercise" and we fire a second AI
//      call that produces just the question set, sized to the module level.
//
// The schemas below mirror that split.

export const quizContentSchema = z.object({
  title: z.string(),
  overview: z
    .string()
    .describe(
      "AI-written topic overview shown above the deep-dive: what this assessment covers and why it matters. 2-4 short paragraphs.",
    ),
  content: z
    .string()
    .describe(
      "A focused markdown reading on the lesson topic. Should give the learner enough background to take the quiz: headings, short examples, key terms. Do NOT include questions.",
    ),
  recommendedResources: z
    .array(curriculumResourceSchema)
    .describe(
      "A mix of resources to help the learner study before the quiz. Include at least one resource of type 'article' or 'website' (rendered as a Google search) and at least one of type 'video' (rendered as a YouTube search).",
    ),
});

// Phase-2 schema: questions only, length-driven by module level.
export const quizQuestionsOnlySchema = z.object({
  questions: z
    .array(quizQuestionSchema)
    .min(5)
    .max(40)
    .describe(
      "Multiple choice questions sized to the module level. Each must have exactly one correct answer.",
    ),
});

// Exercises mirror quizzes for the pre-assessment phase plus optional hints
// once questions have been generated. `description`/`instructions` are still
// emitted in phase 1 so the learner sees framing copy alongside the reading.
export const exerciseContentSchema = z.object({
  title: z.string(),
  description: z.string(),
  instructions: z
    .string()
    .describe("Short paragraph telling the learner what to do.")
    .default(""),
  overview: z
    .string()
    .describe(
      "AI-written topic overview shown above the deep-dive. 2-4 short paragraphs.",
    ),
  content: z
    .string()
    .describe(
      "A focused markdown reading on the lesson topic. Should give the learner enough background to tackle the exercise. Do NOT include questions.",
    ),
  recommendedResources: z
    .array(curriculumResourceSchema)
    .describe(
      "Resources to help the learner study. Include at least one Google-searchable reading and one YouTube-searchable video.",
    ),
  hints: z
    .array(z.string())
    .describe("Optional hints the learner can reveal.")
    .default([]),
});

export const exerciseQuestionsOnlySchema = z.object({
  questions: z
    .array(quizQuestionSchema)
    .min(5)
    .max(40)
    .describe(
      "Multiple choice questions sized to the module level. Each must have exactly one correct answer.",
    ),
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
// Continuity Curriculum + thesis generation
// ---------------------------------------------------------------------------

// Single-string thesis returned by the "generate thesis from continuity
// notes" Inngest function. We keep it as a structured object so the AI SDK's
// generateObject helper validates the response shape and so we can extend it
// later (working title, recommended sources, etc.) without changing callers.
export const thesisGenerationSchema = z.object({
  thesis: z
    .string()
    .min(1)
    .describe(
      "A single, well-formed thesis statement (1-3 sentences) that synthesises the supplied continuity notes into a clear research direction for a multi-source curriculum.",
    ),
});
export type ThesisGeneration = z.infer<typeof thesisGenerationSchema>;

// Per-source content cap fed to the continuity curriculum prompt. Each
// uploaded file or extracted link is truncated to this many characters
// before being interleaved into the prompt so a single 200k-char source
// can't blow the context budget for the whole call.
export const CONTINUITY_SOURCE_CHAR_CAP = 12_000;
// Total cap across every source after per-source truncation. Acts as a
// belt-and-suspenders limit when the user attaches many small files.
export const CONTINUITY_TOTAL_CHAR_CAP = 60_000;

export type ContinuityPromptSource =
  | { kind: "topic"; text: string }
  | { kind: "link"; title: string; url: string; content: string }
  | { kind: "file"; title: string; fileType: string; content: string };

// Stitch the user's inputs into the prompt body shown to the AI. Topics
// come first (they anchor the framing), then any extracted source text
// labelled with its title so the model can cite it back in lesson
// descriptions. Total character output is capped at
// `CONTINUITY_TOTAL_CHAR_CAP` to keep token spend bounded.
export function buildContinuityPromptBody(
  sources: ContinuityPromptSource[],
): string {
  let total = 0;
  const segments: string[] = [];
  for (const [idx, source] of sources.entries()) {
    let block: string;
    if (source.kind === "topic") {
      block = `### Source ${idx + 1} — Additional topic\n${source.text.trim()}`;
    } else if (source.kind === "link") {
      const body = source.content.slice(0, CONTINUITY_SOURCE_CHAR_CAP).trim();
      block = `### Source ${idx + 1} — Link: ${source.title} (${source.url})\n${body}`;
    } else {
      const body = source.content.slice(0, CONTINUITY_SOURCE_CHAR_CAP).trim();
      block = `### Source ${idx + 1} — Uploaded ${source.fileType} file: ${source.title}\n${body}`;
    }
    const remaining = CONTINUITY_TOTAL_CHAR_CAP - total;
    if (remaining <= 0) break;
    const sized = block.length > remaining ? block.slice(0, remaining) : block;
    segments.push(sized);
    total += sized.length;
  }
  return segments.join("\n\n---\n\n");
}

// Render the user's lesson-type filter into a human-readable list the model
// can be told to respect. Falls back to the full set when the array is
// empty so we never generate a curriculum with zero lesson types.
export function formatActivityTypesForPrompt(
  types: readonly LessonActivityType[],
): string {
  const effective = types.length > 0 ? types : [...lessonActivityTypes];
  return effective.map((t) => `\`${t}\``).join(", ");
}

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
export type LevelExtensionPayload = z.infer<typeof levelExtensionSchema>;
export type LessonBase = z.infer<typeof lessonBaseSchema>;
export type LessonGeneration = z.infer<typeof lessonGenerationSchema>;
export type VideoContent = z.infer<typeof videoContentSchema>;
export type QuizContent = z.infer<typeof quizContentSchema>;
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
export type QuizQuestionsOnly = z.infer<typeof quizQuestionsOnlySchema>;
export type ExerciseContent = z.infer<typeof exerciseContentSchema>;
export type ExerciseQuestionsOnly = z.infer<typeof exerciseQuestionsOnlySchema>;
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

// Notes now hold rich markdown plus accumulated annotation quotes, so the
// per-note ceiling is more generous. Still capped to keep the column from
// growing without bound.
export const NOTE_MAX_LENGTH = 20000;
export const NOTE_DESCRIPTION_MAX_LENGTH = 500;
export const ANNOTATION_QUOTE_MAX_LENGTH = 2000;
export const ANNOTATION_TEXT_MAX_LENGTH = 2000;

// Per-tag character cap and how many tags we let a single note carry. The
// note editor enforces these client-side, and tRPC re-validates so a bad
// client can't smuggle a 50-tag note past us.
export const NOTE_TAG_MAX_LENGTH = 32;
export const NOTE_MAX_TAGS = 12;

// Resource feature constants. These are intentionally generous — files
// over the cap should fail at the signed-URL step rather than client-side
// so users see a clear error.
export const RESOURCE_TITLE_MAX_LENGTH = 200;
export const RESOURCE_DESCRIPTION_MAX_LENGTH = 1000;
export const RESOURCE_URL_MAX_LENGTH = 2048;
export const RESOURCE_FILE_MAX_BYTES = 50 * 1024 * 1024; // 50 MB
export const RESOURCE_CONTENT_MAX_LENGTH = 200_000; // ~200k chars for extracted/cached text

// Hex colours we expose to the highlight toolbar. The DB stores the enum
// (uppercase) so the renderer is free to remap to Tailwind classes; this
// constant is the source of truth for "which colours can the user pick".
export const annotationColors = [
  "YELLOW",
  "PINK",
  "BLUE",
  "ORANGE",
  "GREEN",
] as const;
export type AnnotationColor = (typeof annotationColors)[number];

// Resource file types we accept for upload right now. PDFs are rendered in
// an iframe; TXT/MD have their body cached on Resource.content so they
// render through the existing markdown pipeline.
export const resourceFileTypes = ["TXT", "PDF", "MD"] as const;
export type ResourceFileType = (typeof resourceFileTypes)[number];

export const resourceKinds = ["LINK", "FILE"] as const;
export type ResourceKind = (typeof resourceKinds)[number];

// Status of a Resource. Mirrors the Prisma enum. LINKs go straight to READY
// when extraction is queued lazily; FILE resources start at PENDING and flip
// to READY after the client confirms an R2 upload.
export const resourceStatuses = ["PENDING", "READY", "FAILED"] as const;
export type ResourceStatus = (typeof resourceStatuses)[number];

// Map the Prisma enum to the MIME types we accept on upload. The signed
// PUT URL pins the content type, so spoofing this would require also
// spoofing the file extension AND the content-type — both server-checked.
export const resourceMimeTypes: Record<ResourceFileType, string[]> = {
  TXT: ["text/plain"],
  PDF: ["application/pdf"],
  MD: ["text/markdown", "text/x-markdown", "text/plain"],
};

export const resourceFileExtensions: Record<ResourceFileType, string[]> = {
  TXT: [".txt"],
  PDF: [".pdf"],
  MD: [".md", ".markdown"],
};
