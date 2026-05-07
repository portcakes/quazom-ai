import { inngest } from "./client";
import { userChannel } from "./channels";
import { curriculumSchema } from "./schemas";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import prisma from "@/lib/db";

const google = createGoogleGenerativeAI();

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
