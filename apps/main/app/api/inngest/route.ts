import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import {
  createCurriculum,
  generateLesson,
  gradeSubmission,
  replyToDiscussion,
} from "@/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [createCurriculum, generateLesson, gradeSubmission, replyToDiscussion],
});
