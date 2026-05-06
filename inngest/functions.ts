import { inngest } from "./client";
import { createGoogleGenerativeAI} from "@ai-sdk/google";
import { generateText } from "ai";

const google = createGoogleGenerativeAI();

// Create a curriculum and save it to the database

export const createCurriculum = inngest.createFunction(
  { id: "process-curriculum", triggers: { event: "app/curriculum.created" } },
  async ({ event, step }) => {
      const { content } = await step.ai.wrap("gemini-generate-text", generateText, {
        model: google("gemini-2.5-flash-lite"),
        system: `You are a helpful assistant that generates a curriculum for a given topic.`,
        prompt: `Create a personalized curriculum for the following topic: ${event.data.subject} at the ${event.data.level} level. The student's goal is to ${event.data.goal}.

Return ONLY valid JSON matching this schema. Do not include any other text or comments.

{
  "title": string,
  "overview": string,
  "level": string,
  "estimatedDuration": string,
  "objectives": [
    {
      "title": string,
      "description": string,
      "order": number
    }
  ],
  "modules": [
    {
      "title": string,
      "summary": string,
      "objectives": string[],
      "lessons": [
        {
          "title": string,
          "description": string,
          "activityType": "reading" | "quiz" | "project" | "practice" | "discussion"
        }
      ]
    }
  ],
  "recommendedResources": [
    {
      "title": string,
      "type": "book" | "video" | "article" | "course" | "website" | "paper",
      "reason": string,
      "searchQuery": string
    }
  ]
}`,
      });
      return { rawAiResponse: JSON.stringify(content), structuredDataJson: content };
  }
);