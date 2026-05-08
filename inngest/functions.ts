import { inngest } from "./client";
import { userChannel } from "./channels";
import {
  curriculumSchema,
  lessonGenerationSchema,
  modulesBackfillSchema,
  submissionFeedbackSchema,
  activityTypeToDb,
  type LessonActivityType,
  type QuizQuestion,
} from "./schemas";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject, generateText } from "ai";
import prisma from "@/lib/db";

const google = createGoogleGenerativeAI();
const MODEL = "gemini-2.5-flash-lite";

// --------------------------------------------------------------------------
// createCurriculum
//
// Generates the curriculum body, then pre-creates Module and Lesson STUB rows
// so each lesson in the curriculum has a stable id/url. Lessons stay in STUB
// status until the user clicks "Generate Lesson" on the curriculum page.
// --------------------------------------------------------------------------
export const createCurriculum = inngest.createFunction(
  { id: "process-curriculum", triggers: { event: "app/curriculum.created" } },
  async ({ event, step }) => {
    const result = await step.ai.wrap("gemini-generate-curriculum", generateObject, {
      model: google(MODEL),
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

    const saved = await step.run("save-curriculum-and-stubs", async () => {
      // Single transaction: write the curriculum row and pre-create Module +
      // Lesson STUBs so the UI can link to each lesson immediately.
      return prisma.$transaction(async (tx) => {
        const created = await tx.curriculum.create({
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

        // Build Module + Lesson stubs in deterministic order.
        for (const [moduleIdx, mod] of curriculum.modules.entries()) {
          const moduleId = crypto.randomUUID();
          await tx.module.create({
            data: {
              id: moduleId,
              curriculumId: created.id,
              title: mod.title,
              summary: mod.summary,
              order: moduleIdx + 1,
              objectives: mod.objectives,
            },
          });

          if (mod.lessons.length === 0) continue;

          await tx.lesson.createMany({
            data: mod.lessons.map((lesson, lessonIdx) => ({
              id: crypto.randomUUID(),
              moduleId,
              title: lesson.title,
              description: lesson.description,
              activityType: activityTypeToDb(lesson.activityType),
              order: lessonIdx + 1,
              status: "STUB",
            })),
          });
        }

        return created;
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

// --------------------------------------------------------------------------
// backfillCurriculumModules
//
// Dev-only tool: regenerates a fresh 4-5 module / 5-8 lesson skeleton for an
// existing curriculum and creates the matching Module + Lesson STUB rows.
// Used to recover curricula that pre-date the change to pre-create stubs at
// curriculum-creation time. Refuses to run if the curriculum already has any
// modules to avoid clobbering real data.
// --------------------------------------------------------------------------
type BackfillModulesEvent = {
  data: {
    curriculumId: string;
    userId: string;
  };
};

export const backfillCurriculumModules = inngest.createFunction(
  {
    id: "backfill-curriculum-modules",
    triggers: { event: "app/curriculum.backfill_modules" },
  },
  async ({
    event,
    step,
  }: {
    event: BackfillModulesEvent;
    step: Parameters<Parameters<typeof inngest.createFunction>[1]>[0]["step"];
  }) => {
    const { curriculumId, userId } = event.data;

    const curriculum = await step.run("load-curriculum", async () => {
      const row = await prisma.curriculum.findUnique({
        where: { id: curriculumId },
        select: {
          id: true,
          userId: true,
          title: true,
          subject: true,
          level: true,
          goal: true,
          overview: true,
          curriculumModules: { select: { id: true } },
        },
      });
      if (!row) throw new Error(`Curriculum ${curriculumId} not found`);
      if (row.userId !== userId) {
        throw new Error("Curriculum does not belong to the requesting user");
      }
      if (row.curriculumModules.length > 0) {
        throw new Error(
          "Curriculum already has modules; refusing to overwrite",
        );
      }
      return row;
    });

    const result = await step.ai.wrap(
      "gemini-backfill-modules",
      generateObject,
      {
        model: google(MODEL),
        schema: modulesBackfillSchema,
        system:
          "You are an expert instructional designer. Generate a clear, well-structured set of modules and lessons for an existing curriculum. Be specific, actionable, and avoid filler.",
        prompt: `Generate the module structure for the following existing curriculum.

Title: ${curriculum.title}
Subject: ${curriculum.subject}
Level: ${curriculum.level}
Learner goal: ${curriculum.goal}
Curriculum overview: ${curriculum.overview}

Constraints:
- Output exactly 4 to 5 modules.
- Each module must contain 5 to 8 lessons.
- Sequence modules from foundational to advanced.
- Each lesson must have a concrete activityType (one of: reading, video, quiz, exercise, project, discussion).
- Vary activityType across lessons within a module so the learner is not just reading.`,
      },
    );

    const parsed = modulesBackfillSchema.parse(
      (result as { object: unknown }).object,
    );

    const saved = await step.run("save-modules-and-lessons", async () => {
      return prisma.$transaction(async (tx) => {
        // Re-check inside the transaction in case the user clicked twice.
        const existing = await tx.module.count({ where: { curriculumId } });
        if (existing > 0) {
          throw new Error(
            "Curriculum already has modules (race); refusing to overwrite",
          );
        }

        let lessonCount = 0;
        for (const [moduleIdx, mod] of parsed.modules.entries()) {
          const moduleId = crypto.randomUUID();
          await tx.module.create({
            data: {
              id: moduleId,
              curriculumId,
              title: mod.title,
              summary: mod.summary,
              order: moduleIdx + 1,
              objectives: mod.objectives,
            },
          });

          if (mod.lessons.length === 0) continue;

          await tx.lesson.createMany({
            data: mod.lessons.map((lesson, lessonIdx) => ({
              id: crypto.randomUUID(),
              moduleId,
              title: lesson.title,
              description: lesson.description,
              activityType: activityTypeToDb(lesson.activityType),
              order: lessonIdx + 1,
              status: "STUB",
            })),
          });
          lessonCount += mod.lessons.length;
        }

        // Keep the curriculum.modules JSON in sync for any future caller that
        // still reads from it. Not strictly required since the UI reads from
        // the relational rows, but cheap to do here.
        await tx.curriculum.update({
          where: { id: curriculumId },
          data: { modules: parsed.modules },
        });

        return { moduleCount: parsed.modules.length, lessonCount };
      });
    });

    // Reuse the curriculumReady topic so the existing layout-level listener
    // refreshes the curriculum page automatically.
    await step.realtime.publish(
      "publish-curriculum-ready",
      userChannel(userId).curriculumReady,
      { id: curriculum.id, title: curriculum.title },
    );

    return {
      curriculumId,
      moduleCount: saved.moduleCount,
      lessonCount: saved.lessonCount,
    };
  },
);

// --------------------------------------------------------------------------
// generateLesson
//
// Triggered when the user clicks "Generate Lesson". Loads the STUB row, asks
// the model for the base lesson body and the type-specific child content in a
// single object call, then persists both atomically and flips status to READY.
// --------------------------------------------------------------------------
type GenerateLessonEvent = {
  data: {
    lessonId: string;
    userId: string;
  };
};

export const generateLesson = inngest.createFunction(
  { id: "generate-lesson", triggers: { event: "app/lesson.generate" } },
  async ({ event, step }: { event: GenerateLessonEvent; step: Parameters<Parameters<typeof inngest.createFunction>[1]>[0]["step"] }) => {
    const { lessonId, userId } = event.data;

    // Load context: lesson + module + curriculum so we can craft a focused prompt.
    const context = await step.run("load-lesson-context", async () => {
      const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        include: {
          module: {
            include: {
              curriculum: {
                select: {
                  id: true,
                  userId: true,
                  subject: true,
                  level: true,
                  goal: true,
                  title: true,
                },
              },
            },
          },
        },
      });
      if (!lesson) throw new Error(`Lesson ${lessonId} not found`);
      if (lesson.module.curriculum.userId !== userId) {
        throw new Error("Lesson does not belong to the requesting user");
      }
      return lesson;
    });

    // Mark as GENERATING so the page knows to render the pending state.
    await step.run("mark-generating", async () => {
      await prisma.lesson.update({
        where: { id: lessonId },
        data: { status: "GENERATING" },
      });
    });

    const activity = dbActivityToPrompt(context.activityType);

    const prompt = buildLessonPrompt({
      curriculumTitle: context.module.curriculum.title,
      curriculumSubject: context.module.curriculum.subject,
      curriculumLevel: context.module.curriculum.level,
      curriculumGoal: context.module.curriculum.goal,
      moduleTitle: context.module.title,
      moduleSummary: context.module.summary,
      lessonTitle: context.title,
      lessonDescription: context.description,
      activity,
    });

    let generated: ReturnType<typeof lessonGenerationSchema.parse>;
    try {
      const result = await step.ai.wrap("gemini-generate-lesson", generateObject, {
        model: google(MODEL),
        schema: lessonGenerationSchema,
        system:
          "You are an expert instructional designer. Generate one complete lesson. Populate the `base` field always, plus exactly the one child field that matches the requested activity type. Do not populate child fields that were not requested. Be concrete, accurate, and avoid filler.",
        prompt,
      });
      generated = lessonGenerationSchema.parse(
        (result as { object: unknown }).object,
      );
    } catch (err) {
      await step.run("mark-failed", async () => {
        await prisma.lesson.update({
          where: { id: lessonId },
          data: { status: "FAILED" },
        });
      });
      await step.realtime.publish(
        "publish-lesson-failed",
        userChannel(userId).lessonFailed,
        { id: lessonId, message: (err as Error).message ?? "Generation failed" },
      );
      throw err;
    }

    const saved = await step.run("save-lesson-content", async () => {
      return prisma.$transaction(async (tx) => {
        // Update the base Lesson row.
        const updated = await tx.lesson.update({
          where: { id: lessonId },
          data: {
            title: generated.base.title,
            description: generated.base.description,
            summary: generated.base.summary,
            duration: generated.base.duration,
            objectives: generated.base.objectives,
            recommendedResources: generated.base.recommendedResources,
            content: "",
            status: "READY",
          },
          select: { id: true, title: true, activityType: true },
        });

        // Wipe any prior child rows (regenerations replace them entirely).
        await Promise.all([
          tx.video.deleteMany({ where: { lessonId } }),
          tx.quiz.deleteMany({ where: { lessonId } }),
          tx.exercise.deleteMany({ where: { lessonId } }),
          tx.project.deleteMany({ where: { lessonId } }),
          tx.discussion.deleteMany({ where: { lessonId } }),
          tx.readings.deleteMany({ where: { lessonId } }),
        ]);

        switch (updated.activityType) {
          case "VIDEO":
            if (generated.video) {
              await tx.video.create({
                data: {
                  id: crypto.randomUUID(),
                  lessonId,
                  title: generated.video.title,
                  description: generated.video.description,
                  overview: generated.video.overview,
                  embedUrl: generated.video.embedUrl ?? "",
                  externalUrl: generated.video.externalUrl || generated.video.embedUrl || null,
                  thumbnailUrl: generated.video.thumbnailUrl || null,
                  duration: generated.video.duration ?? "",
                },
              });
            }
            break;
          case "QUIZ":
            if (generated.quiz) {
              await tx.quiz.create({
                data: {
                  id: crypto.randomUUID(),
                  lessonId,
                  title: generated.quiz.title,
                  questions: normalizeQuestions(generated.quiz.questions),
                },
              });
            }
            break;
          case "EXERCISE":
            if (generated.exercise) {
              await tx.exercise.create({
                data: {
                  id: crypto.randomUUID(),
                  lessonId,
                  title: generated.exercise.title,
                  description: generated.exercise.description,
                  questions: normalizeQuestions(generated.exercise.questions),
                  hints: generated.exercise.hints ?? [],
                },
              });
            }
            break;
          case "PROJECT":
            if (generated.project) {
              await tx.project.create({
                data: {
                  id: crypto.randomUUID(),
                  lessonId,
                  title: generated.project.title,
                  summary: generated.project.summary,
                  objectives: generated.project.objectives,
                  recommendedResources: generated.project.recommendedResources,
                  projectType: projectTypeToDb(generated.project.projectType),
                },
              });
            }
            break;
          case "DISCUSSION":
            if (generated.discussion) {
              await tx.discussion.create({
                data: {
                  id: crypto.randomUUID(),
                  lessonId,
                  title: generated.discussion.title,
                  summary: generated.discussion.summary,
                  objectives: generated.discussion.objectives,
                  recommendedResources: generated.discussion.recommendedResources,
                  chatHistory: [
                    {
                      role: "assistant",
                      content: generated.discussion.openingMessage,
                      createdAt: new Date().toISOString(),
                    },
                  ],
                },
              });
            }
            break;
          case "READING":
          default:
            if (generated.reading) {
              await tx.readings.create({
                data: {
                  id: crypto.randomUUID(),
                  lessonId,
                  title: generated.reading.title,
                  summary: generated.reading.summary,
                  overview: generated.reading.overview,
                  content: generated.reading.content,
                  recommendedResources: generated.reading.recommendedResources,
                },
              });
            }
            break;
        }

        return updated;
      });
    });

    await step.realtime.publish(
      "publish-lesson-ready",
      userChannel(userId).lessonReady,
      { id: saved.id, title: saved.title },
    );

    return { lessonId: saved.id, title: saved.title };
  },
);

// --------------------------------------------------------------------------
// gradeSubmission
//
// Generates AI feedback for a quiz/exercise after the learner submits answers.
// Correctness scoring is computed in the tRPC mutation (deterministic); this
// function just adds the qualitative feedback (strengths / weak areas / etc).
// --------------------------------------------------------------------------
type GradeSubmissionEvent = {
  data: {
    kind: "quiz" | "exercise";
    id: string;
    lessonId: string;
    userId: string;
  };
};

export const gradeSubmission = inngest.createFunction(
  { id: "grade-submission", triggers: { event: "app/submission.grade" } },
  async ({ event, step }: { event: GradeSubmissionEvent; step: Parameters<Parameters<typeof inngest.createFunction>[1]>[0]["step"] }) => {
    const { kind, id, lessonId, userId } = event.data;

    const submission = await step.run("load-submission", async () => {
      if (kind === "quiz") {
        const row = await prisma.quiz.findUnique({ where: { id } });
        if (!row) throw new Error(`Quiz ${id} not found`);
        return row;
      }
      const row = await prisma.exercise.findUnique({ where: { id } });
      if (!row) throw new Error(`Exercise ${id} not found`);
      return row;
    });

    const questions = (submission.questions ?? []) as QuizQuestion[];
    const userAnswers = (submission.userAnswers ?? []) as number[];

    const summaryLines = questions.map((q, idx) => {
      const userIdx = userAnswers[idx];
      const correct = userIdx === q.correctAnswerIndex;
      const userAnswer =
        typeof userIdx === "number" && q.answers[userIdx] !== undefined
          ? q.answers[userIdx]
          : "(no answer)";
      return `Q${idx + 1}: ${q.question}
  Correct answer: ${q.answers[q.correctAnswerIndex]}
  Learner answer: ${userAnswer} ${correct ? "✓" : "✗"}`;
    });

    const result = await step.ai.wrap("gemini-grade-submission", generateObject, {
      model: google(MODEL),
      schema: submissionFeedbackSchema,
      system:
        "You are a supportive but precise tutor. Given a learner's multiple-choice submission, identify their strengths and weak areas and suggest concrete next steps. Reference the specific topics from the questions. Keep each list to 2-5 items.",
      prompt: `Submission type: ${kind}
Score: ${submission.score} / ${submission.maxScore}
${submission.isPassed ? "Status: PASSED" : "Status: not yet passed"}

Per-question results:
${summaryLines.join("\n")}`,
    });

    const feedback = submissionFeedbackSchema.parse(
      (result as { object: unknown }).object,
    );

    await step.run("save-feedback", async () => {
      if (kind === "quiz") {
        await prisma.quiz.update({ where: { id }, data: { feedback } });
      } else {
        await prisma.exercise.update({ where: { id }, data: { feedback } });
      }
    });

    await step.realtime.publish(
      "publish-feedback-ready",
      userChannel(userId).feedbackReady,
      { kind, id, lessonId },
    );

    return { kind, id };
  },
);

// --------------------------------------------------------------------------
// replyToDiscussion
//
// Generates the next assistant turn for a discussion lesson.
// --------------------------------------------------------------------------
type DiscussionMessage = { role: "assistant" | "user"; content: string; createdAt: string };

type ReplyDiscussionEvent = {
  data: {
    discussionId: string;
    lessonId: string;
    userId: string;
  };
};

export const replyToDiscussion = inngest.createFunction(
  { id: "reply-to-discussion", triggers: { event: "app/discussion.reply" } },
  async ({ event, step }: { event: ReplyDiscussionEvent; step: Parameters<Parameters<typeof inngest.createFunction>[1]>[0]["step"] }) => {
    const { discussionId, lessonId, userId } = event.data;

    const discussion = await step.run("load-discussion", async () => {
      const d = await prisma.discussion.findUnique({
        where: { id: discussionId },
        include: {
          lesson: {
            include: { module: { include: { curriculum: true } } },
          },
        },
      });
      if (!d) throw new Error(`Discussion ${discussionId} not found`);
      if (d.lesson.module.curriculum.userId !== userId) {
        throw new Error("Discussion does not belong to the requesting user");
      }
      return d;
    });

    const history = (discussion.chatHistory ?? []) as DiscussionMessage[];
    const objectivesText = JSON.stringify(discussion.objectives);

    const reply = await step.ai.wrap("gemini-discussion-reply", generateText, {
      model: google(MODEL),
      system: `You are an inquisitive, supportive tutor leading a Socratic discussion on "${discussion.title}". Push the learner with thoughtful follow-up questions, gently correct misconceptions, and reference the discussion's objectives. Keep replies under 200 words.

Discussion summary: ${discussion.summary}
Objectives: ${objectivesText}`,
      messages: history.map((m) => ({ role: m.role, content: m.content })),
    });

    const reply_text = (reply as { text: string }).text;

    await step.run("append-reply", async () => {
      const next: DiscussionMessage[] = [
        ...history,
        { role: "assistant", content: reply_text, createdAt: new Date().toISOString() },
      ];
      await prisma.discussion.update({
        where: { id: discussionId },
        data: { chatHistory: next },
      });
    });

    await step.realtime.publish(
      "publish-discussion-ready",
      userChannel(userId).discussionMessageReady,
      { discussionId, lessonId },
    );

    return { discussionId };
  },
);

// --------------------------------------------------------------------------
// helpers
// --------------------------------------------------------------------------

function buildLessonPrompt(args: {
  curriculumTitle: string;
  curriculumSubject: string;
  curriculumLevel: string;
  curriculumGoal: string;
  moduleTitle: string;
  moduleSummary: string;
  lessonTitle: string;
  lessonDescription: string;
  activity: LessonActivityType;
}): string {
  const typeInstruction = ACTIVITY_INSTRUCTIONS[args.activity] ?? ACTIVITY_INSTRUCTIONS.reading;
  return `Generate a single complete lesson.

Curriculum: ${args.curriculumTitle} (${args.curriculumSubject}, ${args.curriculumLevel})
Learner goal: ${args.curriculumGoal}
Module: ${args.moduleTitle} — ${args.moduleSummary}
Lesson title: ${args.lessonTitle}
Lesson description: ${args.lessonDescription}
Activity type: ${args.activity}

Always populate the \`base\` field with the lesson's title, summary, description, duration, objectives, and recommended resources.

${typeInstruction}

Do not populate any child field other than the one matching this activity type.`;
}

const ACTIVITY_INSTRUCTIONS: Record<LessonActivityType, string> = {
  reading: `Populate the \`reading\` field. The reading must include:
  - a 2-4 paragraph topic overview
  - a thorough deep-dive in markdown with multiple headings/subheadings, examples, and clear explanations`,
  quiz: `Populate the \`quiz\` field with 5-10 multiple choice questions. Every question must have 4-6 plausible answers and exactly one correct answer; \`correctAnswerIndex\` must be a valid 0-based index. Include short explanations.`,
  exercise: `Populate the \`exercise\` field. Like a quiz: 5-10 multiple choice questions with one correct answer each. Add 2-4 helpful hints.`,
  practice: `Populate the \`exercise\` field. Like a quiz: 5-10 multiple choice questions with one correct answer each. Add 2-4 helpful hints.`,
  project: `Populate the \`project\` field. The objectives array is the rubric the learner will be graded against — each objective should be a concrete, demonstrable criterion. Choose a fitting projectType.`,
  video: `Populate the \`video\` field. The overview should give the learner an AI summary of the video before they watch it. If you can confidently provide a real, working YouTube URL for the topic, do so; otherwise leave \`embedUrl\` empty and use \`externalUrl\` for a search link.`,
  discussion: `Populate the \`discussion\` field. The openingMessage should be a thought-provoking opening prompt the AI tutor uses to start the conversation.`,
  other: `Populate the \`reading\` field as a fallback general lesson.`,
};

function normalizeQuestions(qs: QuizQuestion[]): QuizQuestion[] {
  return qs.map((q) => {
    // Defensive: clamp the correct index inside the answer array length so a
    // bad LLM output can't poison submissions.
    const max = Math.max(0, q.answers.length - 1);
    const idx = Math.max(0, Math.min(q.correctAnswerIndex, max));
    return { ...q, correctAnswerIndex: idx };
  });
}

function dbActivityToPrompt(
  type: string,
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
      return "reading";
  }
}

function projectTypeToDb(
  type: import("./schemas").ProjectType,
): "PRESENTATION" | "REPORT" | "ARTICLE" | "ESSAY" | "RESEARCH_PAPER" | "THESIS" | "CODE_SNIPPET" | "CODE_PROJECT" | "OTHER" {
  switch (type) {
    case "presentation":
      return "PRESENTATION";
    case "report":
      return "REPORT";
    case "article":
      return "ARTICLE";
    case "essay":
      return "ESSAY";
    case "research paper":
      return "RESEARCH_PAPER";
    case "thesis":
      return "THESIS";
    case "code snippet":
      return "CODE_SNIPPET";
    case "code project":
      return "CODE_PROJECT";
    default:
      return "OTHER";
  }
}
