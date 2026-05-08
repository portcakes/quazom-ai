import { channel } from "inngest/realtime";
import { z } from "zod";

export const userChannel = channel({
  name: (userId: string) => `user:${userId}`,
  topics: {
    curriculumReady: {
      schema: z.object({
        id: z.string(),
        title: z.string(),
      }),
    },
    // Fired once a lesson's full content + per-type child row are persisted and
    // the lesson is `READY`. The `/lessons/[id]` page polls until this lands.
    lessonReady: {
      schema: z.object({
        id: z.string(),
        title: z.string(),
      }),
    },
    // Fired on lesson generation failure so the UI can surface it.
    lessonFailed: {
      schema: z.object({
        id: z.string(),
        message: z.string(),
      }),
    },
    // Fired after Quiz/Exercise feedback is generated.
    feedbackReady: {
      schema: z.object({
        kind: z.enum(["quiz", "exercise"]),
        id: z.string(),
        lessonId: z.string(),
      }),
    },
    // Fired after the AI tutor replies in a discussion.
    discussionMessageReady: {
      schema: z.object({
        discussionId: z.string(),
        lessonId: z.string(),
      }),
    },
  },
});

// All topics the client can subscribe to. Listed here so the realtime token
// procedure and the UI hooks stay in sync.
export const userChannelTopics = [
  "curriculumReady",
  "lessonReady",
  "lessonFailed",
  "feedbackReady",
  "discussionMessageReady",
] as const;
