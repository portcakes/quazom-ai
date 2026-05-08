import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import {
  createCurriculum,
  backfillCurriculumModules,
  generateLesson,
  gradeSubmission,
  replyToDiscussion,
} from "@/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    createCurriculum,
    backfillCurriculumModules,
    generateLesson,
    gradeSubmission,
    replyToDiscussion,
  ],
});
