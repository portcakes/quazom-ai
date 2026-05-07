import { inngest } from "./client";
import { userChannel } from "./channels";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import prisma from "@/lib/db";

const google = createGoogleGenerativeAI();

const curriculumSchema = z.object({
  title: z.string().describe("Concise title for the curriculum."),
  overview: z.string().describe("1-3 sentence summary of what the learner will achieve."),
  level: z.string().describe("Difficulty level: beginner, intermediate, or advanced."),
  estimatedDuration: z.string().describe("Human-readable estimate, e.g. '6 weeks' or '20 hours'."),
  objectives: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        order: z.number().int().describe("1-indexed ordering of the objective."),
      }),
    )
    .describe("Top-level learning objectives, ordered."),
  modules: z
    .array(
      z.object({
        title: z.string(),
        summary: z.string(),
        objectives: z.array(z.string()).describe("Objective titles this module addresses."),
        lessons: z.array(
          z.object({
            title: z.string(),
            description: z.string(),
            activityType: z.enum(["reading", "quiz", "project", "practice", "discussion"]),
          }),
        ),
      }),
    )
    .describe("Sequenced modules, each containing lessons."),
  recommendedResources: z.array(
    z.object({
      title: z.string(),
      type: z.enum(["book", "video", "article", "course", "website", "paper"]),
      reason: z.string().describe("Why this resource is recommended for the learner."),
      searchQuery: z.string().describe("Query the learner can paste into a search engine to find it."),
    }),
  ),
});

export type Curriculum = z.infer<typeof curriculumSchema>;

export const createCurriculum = inngest.createFunction(
  { id: "process-curriculum", triggers: { event: "app/curriculum.created" } },
  async ({ event, step }) => {
    const result = await step.ai.wrap("gemini-generate-object", generateObject, {
      model: google("gemini-2.5-flash-lite"),
      schema: curriculumSchema,
      system:
        "You are an expert instructional designer. Generate clear, well-structured personalized curricula. Be specific, actionable, and avoid filler.",
      prompt: `Create a personalized curriculum.

Subject: ${event.data.subject}
Level: ${event.data.level}
Learner goal: ${event.data.goal}

Sequence modules from foundational to advanced. Each lesson must have a concrete activityType. Recommended resources should be high-quality and reputable.`,
    });

    // step.ai.wrap serializes through JSON, so the schema generic is lost.
    // Re-parse to recover the typed Curriculum and validate at runtime.
    const curriculum = curriculumSchema.parse(
      (result as { object: unknown }).object,
    );

    const saved = await step.run("save-curriculum", async () => {
      return prisma.curriculum.create({
        data: {
          id: event.data.id,
          userId: event.data.userId,
          title: curriculum.title,
          subject: event.data.subject,
          level: event.data.level,
          goal: event.data.goal,
          overview: curriculum.overview,
          estimatedDuration: curriculum.estimatedDuration,
          objectives: curriculum.objectives,
          modules: curriculum.modules,
          recommendedResources: curriculum.recommendedResources,
          raw_ai_response: JSON.stringify(curriculum),
          structured_data_json: curriculum,
        },
        select: { id: true, title: true },
      });
    });

    await step.realtime.publish(
      "publish-curriculum-ready",
      userChannel(event.data.userId).curriculumReady,
      { id: saved.id, title: saved.title },
    );

    return { curriculumId: saved.id, title: saved.title };
  },
);
