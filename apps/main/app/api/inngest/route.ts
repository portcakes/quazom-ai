import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import {
  createCurriculum,
  backfillCurriculumModules,
  extendCurriculumLevel,
  generateAssessmentQuestions,
  generateLesson,
  gradeSubmission,
  replyToDiscussion,
} from "@/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    createCurriculum,
    backfillCurriculumModules,
    extendCurriculumLevel,
    generateAssessmentQuestions,
    generateLesson,
    gradeSubmission,
    replyToDiscussion,
  ],
});
