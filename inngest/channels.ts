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
  },
});
