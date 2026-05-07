import { z } from "zod";

export const lessonActivityTypes = ["reading", "quiz", "project", "practice", "discussion"] as const;
export type LessonActivityType = (typeof lessonActivityTypes)[number];

export const resourceTypes = ["book", "video", "article", "course", "website", "paper"] as const;
export type ResourceType = (typeof resourceTypes)[number];

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

export type CurriculumObjective = z.infer<typeof curriculumObjectiveSchema>;
export type CurriculumLesson = z.infer<typeof curriculumLessonSchema>;
export type CurriculumModule = z.infer<typeof curriculumModuleSchema>;
export type CurriculumResource = z.infer<typeof curriculumResourceSchema>;
export type CurriculumPayload = z.infer<typeof curriculumSchema>;
