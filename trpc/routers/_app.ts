import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  activeUserProcedure,
  baseProcedure,
  createTRPCRouter,
  protectedcProcedure,
} from '../init';
import { inngest } from '@/inngest/client';
import { userChannel, userChannelTopics } from '@/inngest/channels';
import { getSubscriptionToken } from 'inngest/realtime';
import prisma from '@quazom-ai/db';
import {
  ANNOTATION_QUOTE_MAX_LENGTH,
  ANNOTATION_TEXT_MAX_LENGTH,
  NOTE_DESCRIPTION_MAX_LENGTH,
  NOTE_MAX_LENGTH,
  curriculumLevels,
  nextCurriculumLevel,
  type CurriculumLevel,
  type QuizQuestion,
} from '@/inngest/schemas';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { recordAiUsage } from '@/inngest/ai-usage';
import {
  ALPHA_LIMITS,
  countCurriculaForUser,
  countLessonGenerationsThisMonth,
  countDiscussionGenerationsThisMonth,
  type AlphaUsageSnapshot,
} from '@/lib/alpha-limits';
import {
  generateSchedule,
  normalizeDateFromDb,
  startOfLocalDay,
  type LessonForScheduling,
} from '@/lib/schedule/generator';
import {
  STUDY_TIME_SLOTS,
  isDayOfWeek,
  type StudyTimeSlot as StudyTimeSlotConst,
} from '@/lib/schedule/time-slots';
import { computeStreak } from '@/lib/schedule/streak';
import type { StudyTimeSlot as PrismaStudyTimeSlot } from '@quazom-ai/db/enums';

// Shared note input — title and description are optional, content is required,
// all three length-capped so a runaway client can't blow up the table.
const noteInputBase = z.object({
  title: z.string().max(120).optional(),
  description: z.string().max(NOTE_DESCRIPTION_MAX_LENGTH).optional(),
  content: z.string().min(1, 'Content is required').max(NOTE_MAX_LENGTH),
});

// Lazy-initialised Google client. The SDK reads GOOGLE_GENERATIVE_AI_API_KEY
// from env on first use; we allocate at module load time so the client is
// reused across requests in the same lambda.
const googleClient = createGoogleGenerativeAI();
const SUMMARIZE_MODEL = 'gemini-2.5-flash-lite';

const summarizeNoteSchema = z.object({
  title: z
    .string()
    .min(1)
    .max(80)
    .describe('A concise, specific title for the note. Max ~10 words.'),
  description: z
    .string()
    .min(1)
    .max(NOTE_DESCRIPTION_MAX_LENGTH)
    .describe(
      'A 1-2 sentence summary capturing the gist of the note. Max ~280 characters.',
    ),
});

// Shared schedule input. Used by both `previewSchedule` and `upsertSchedule`.
const scheduleInputSchema = z.object({
  curriculumId: z.string(),
  daysOfWeek: z
    .array(z.number().int().min(0).max(6))
    .min(1, 'Pick at least one day per week')
    .max(7),
  minutesPerDay: z.number().int().min(10).max(480),
  targetCompletionDate: z.iso.datetime(),
  preferredTimeSlots: z
    .array(z.enum(STUDY_TIME_SLOTS))
    .min(1, 'Pick at least one preferred study time')
    .max(4),
});

type ScheduleInput = z.infer<typeof scheduleInputSchema>;

export const appRouter = createTRPCRouter({
  hello: baseProcedure
    .input(
      z.object({
        text: z.string(),
      }),
    )
    .query((opts) => {
      return {
        greeting: `hello ${opts.input.text}`,
      };
    }),
  createCurriculum: activeUserProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        subject: z.string(),
        level: z.string(),
        goal: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Alpha-tier cost guard: cap total curricula at ALPHA_LIMITS.curricula
      // to keep generation spend bounded while we're free.
      const user = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { isAlpha: true },
      });
      if (user?.isAlpha) {
        const used = await countCurriculaForUser(ctx.userId);
        if (used >= ALPHA_LIMITS.curricula) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: `Alpha plan is limited to ${ALPHA_LIMITS.curricula} curricula. Delete one to free up a slot.`,
          });
        }
      }
      return await inngest.send({
        name: 'app/curriculum.created',
        data: {
          id: input.id,
          userId: ctx.userId,
          subject: input.subject,
          level: input.level,
          goal: input.goal,
        },
      });
    }),
  getCurriculum: protectedcProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return await prisma.curriculum.findFirst({
        where: { id: input.id, userId: ctx.userId },
        select: {
          id: true,
          title: true,
          overview: true,
          subject: true,
          level: true,
          goal: true,
          estimatedDuration: true,
        },
      });
    }),
  setCurriculumHidden: protectedcProcedure
    .input(z.object({ id: z.string(), isHidden: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const result = await prisma.curriculum.updateMany({
        where: { id: input.id, userId: ctx.userId },
        data: { isHidden: input.isHidden },
      });
      return { updated: result.count };
    }),
  deleteCurriculum: protectedcProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await prisma.curriculum.deleteMany({
        where: { id: input.id, userId: ctx.userId },
      });
      return { deleted: result.count };
    }),
  // Dev-only backfill: regenerate modules + lesson stubs for a curriculum that
  // has none. Refuses if any modules already exist so we can't accidentally
  // wipe real data on a curriculum that was created post-migration.
  backfillCurriculumModules: protectedcProcedure
    .input(z.object({ curriculumId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const curriculum = await prisma.curriculum.findFirst({
        where: { id: input.curriculumId, userId: ctx.userId },
        select: { id: true, _count: { select: { curriculumModules: true } } },
      });
      if (!curriculum) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Curriculum not found' });
      }
      if (curriculum._count.curriculumModules > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This curriculum already has modules.',
        });
      }
      await inngest.send({
        name: 'app/curriculum.backfill_modules',
        data: { curriculumId: curriculum.id, userId: ctx.userId },
      });
      return { ok: true };
    }),

  // ---------------------------------------------------------------------
  // Lessons
  // ---------------------------------------------------------------------
  generateLesson: activeUserProcedure
    .input(z.object({ lessonId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Auth check: the lesson must belong to a curriculum the user owns.
      const lesson = await prisma.lesson.findUnique({
        where: { id: input.lessonId },
        select: {
          id: true,
          status: true,
          activityType: true,
          module: {
            select: { curriculum: { select: { userId: true } } },
          },
        },
      });
      if (!lesson || lesson.module.curriculum.userId !== ctx.userId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Lesson not found' });
      }
      // Idempotency-ish: don't re-fire if it's already generating. Allow retry
      // when status is FAILED so the user can recover.
      if (lesson.status === 'GENERATING') {
        return { ok: true, alreadyRunning: true };
      }

      // Alpha-tier monthly caps. We only count towards the cap when this is a
      // *fresh* generation — a STUB lesson going to GENERATING. Retries on a
      // FAILED lesson would have already counted the first time around, so
      // they don't count again here.
      const user = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { isAlpha: true },
      });
      if (user?.isAlpha && lesson.status === 'STUB') {
        const [lessonsUsed, discussionsUsed] = await Promise.all([
          countLessonGenerationsThisMonth(ctx.userId),
          lesson.activityType === 'DISCUSSION'
            ? countDiscussionGenerationsThisMonth(ctx.userId)
            : Promise.resolve(0),
        ]);
        if (lessonsUsed >= ALPHA_LIMITS.lessonsPerMonth) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: `Alpha plan is limited to ${ALPHA_LIMITS.lessonsPerMonth} lesson generations per month. The cap resets on the 1st.`,
          });
        }
        if (
          lesson.activityType === 'DISCUSSION' &&
          discussionsUsed >= ALPHA_LIMITS.discussionsPerMonth
        ) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: `Alpha plan is limited to ${ALPHA_LIMITS.discussionsPerMonth} discussion lessons per month. The cap resets on the 1st.`,
          });
        }
      }

      await inngest.send({
        name: 'app/lesson.generate',
        data: { lessonId: input.lessonId, userId: ctx.userId },
      });
      return { ok: true, alreadyRunning: false };
    }),
  getLessonStatus: protectedcProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const lesson = await prisma.lesson.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          status: true,
          title: true,
          activityType: true,
          module: { select: { curriculum: { select: { userId: true, id: true } } } },
        },
      });
      if (!lesson || lesson.module.curriculum.userId !== ctx.userId) return null;
      return {
        id: lesson.id,
        status: lesson.status,
        title: lesson.title,
        activityType: lesson.activityType,
        curriculumId: lesson.module.curriculum.id,
      };
    }),
  submitQuiz: protectedcProcedure
    .input(z.object({ quizId: z.string(), answers: z.array(z.number().int()) }))
    .mutation(async ({ ctx, input }) => {
      const quiz = await prisma.quiz.findUnique({
        where: { id: input.quizId },
        include: {
          lesson: {
            select: {
              id: true,
              module: { select: { curriculum: { select: { userId: true } } } },
            },
          },
        },
      });
      if (!quiz || quiz.lesson.module.curriculum.userId !== ctx.userId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Quiz not found' });
      }

      const { score, maxScore, isPassed } = scoreQuestions(
        quiz.questions as unknown as QuizQuestion[],
        input.answers,
        quiz.passScore,
      );

      await prisma.quiz.update({
        where: { id: quiz.id },
        data: {
          userAnswers: input.answers,
          score,
          maxScore,
          isPassed,
          isCompleted: true,
          // Reset prior feedback so the UI knows to wait for the new pass.
          feedback: null as unknown as object,
        },
      });

      await inngest.send({
        name: 'app/submission.grade',
        data: {
          kind: 'quiz',
          id: quiz.id,
          lessonId: quiz.lesson.id,
          userId: ctx.userId,
        },
      });

      return { score, maxScore, isPassed };
    }),
  submitExercise: protectedcProcedure
    .input(z.object({ exerciseId: z.string(), answers: z.array(z.number().int()) }))
    .mutation(async ({ ctx, input }) => {
      const exercise = await prisma.exercise.findUnique({
        where: { id: input.exerciseId },
        include: {
          lesson: {
            select: {
              id: true,
              module: { select: { curriculum: { select: { userId: true } } } },
            },
          },
        },
      });
      if (!exercise || exercise.lesson.module.curriculum.userId !== ctx.userId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Exercise not found' });
      }

      const { score, maxScore, isPassed } = scoreQuestions(
        exercise.questions as unknown as QuizQuestion[],
        input.answers,
        exercise.passScore,
      );

      await prisma.exercise.update({
        where: { id: exercise.id },
        data: {
          userAnswers: input.answers,
          score,
          maxScore,
          isPassed,
          isCompleted: true,
          feedback: null as unknown as object,
        },
      });

      await inngest.send({
        name: 'app/submission.grade',
        data: {
          kind: 'exercise',
          id: exercise.id,
          lessonId: exercise.lesson.id,
          userId: ctx.userId,
        },
      });

      return { score, maxScore, isPassed };
    }),
  // Phase-2 generation for QUIZ / EXERCISE lessons. After the lesson's
  // pre-assessment reading is in place (phase 1), the learner clicks
  // "Generate quiz/exercise" and we fire an Inngest job to produce the
  // actual question set sized to the module's level.
  generateAssessmentQuestions: activeUserProcedure
    .input(
      z.object({
        kind: z.enum(['quiz', 'exercise']),
        id: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.kind === 'quiz') {
        const quiz = await prisma.quiz.findUnique({
          where: { id: input.id },
          select: {
            id: true,
            lesson: {
              select: {
                id: true,
                module: { select: { curriculum: { select: { userId: true } } } },
              },
            },
          },
        });
        if (!quiz || quiz.lesson.module.curriculum.userId !== ctx.userId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Quiz not found' });
        }
        await inngest.send({
          name: 'app/assessment.generate',
          data: {
            kind: 'quiz',
            id: quiz.id,
            lessonId: quiz.lesson.id,
            userId: ctx.userId,
          },
        });
      } else {
        const exercise = await prisma.exercise.findUnique({
          where: { id: input.id },
          select: {
            id: true,
            lesson: {
              select: {
                id: true,
                module: { select: { curriculum: { select: { userId: true } } } },
              },
            },
          },
        });
        if (!exercise || exercise.lesson.module.curriculum.userId !== ctx.userId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Exercise not found' });
        }
        await inngest.send({
          name: 'app/assessment.generate',
          data: {
            kind: 'exercise',
            id: exercise.id,
            lessonId: exercise.lesson.id,
            userId: ctx.userId,
          },
        });
      }
      return { ok: true };
    }),
  // Generate the next batch of modules at a higher difficulty tier. Only
  // valid when every lesson at the current top level is complete and the
  // curriculum hasn't already hit advanced.
  extendCurriculumLevel: activeUserProcedure
    .input(
      z.object({
        curriculumId: z.string(),
        targetLevel: z.enum(['intermediate', 'advanced']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const curriculum = await prisma.curriculum.findFirst({
        where: { id: input.curriculumId, userId: ctx.userId },
        select: {
          id: true,
          level: true,
          curriculumModules: {
            select: {
              id: true,
              level: true,
              lessons: {
                select: {
                  id: true,
                  activityType: true,
                  videos: { take: 1, select: { isCompleted: true } },
                  readings: { take: 1, select: { isCompleted: true } },
                  quizzes: { take: 1, select: { isCompleted: true } },
                  exercises: { take: 1, select: { isCompleted: true } },
                  projects: { take: 1, select: { isCompleted: true } },
                  discussions: { take: 1, select: { isCompleted: true } },
                },
              },
            },
          },
        },
      });
      if (!curriculum) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Curriculum not found' });
      }

      // Highest level currently represented in the curriculum.
      let currentTopLevel: CurriculumLevel = (curriculum.level
        .toLowerCase() as CurriculumLevel) ?? 'beginner';
      const present = new Set(
        curriculum.curriculumModules.map((m) => m.level.toLowerCase() as CurriculumLevel),
      );
      for (const lvl of curriculumLevels) {
        if (present.has(lvl)) currentTopLevel = lvl;
      }

      const expected = nextCurriculumLevel(currentTopLevel);
      if (expected !== input.targetLevel) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Curriculum can only extend to ${expected ?? 'no further level'}.`,
        });
      }

      // Every lesson at the current top level must be complete.
      const topLevelModules = curriculum.curriculumModules.filter(
        (m) => m.level.toLowerCase() === currentTopLevel,
      );
      if (topLevelModules.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No modules to extend yet.',
        });
      }
      const allComplete = topLevelModules.every((m) =>
        m.lessons.length > 0 &&
        m.lessons.every((l) => {
          switch (l.activityType) {
            case 'VIDEO':
              return l.videos[0]?.isCompleted ?? false;
            case 'READING':
            case 'OTHER':
              return l.readings[0]?.isCompleted ?? false;
            case 'QUIZ':
              return l.quizzes[0]?.isCompleted ?? false;
            case 'EXERCISE':
              return l.exercises[0]?.isCompleted ?? false;
            case 'PROJECT':
              return l.projects[0]?.isCompleted ?? false;
            case 'DISCUSSION':
              return l.discussions[0]?.isCompleted ?? false;
            default:
              return false;
          }
        }),
      );
      if (!allComplete) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'Complete every lesson at the current level before unlocking the next one.',
        });
      }

      await inngest.send({
        name: 'app/curriculum.extend_level',
        data: {
          curriculumId: curriculum.id,
          userId: ctx.userId,
          targetLevel: input.targetLevel,
        },
      });
      return { ok: true };
    }),
  submitProjectUrl: protectedcProcedure
    .input(z.object({ projectId: z.string(), submissionUrl: z.url() }))
    .mutation(async ({ ctx, input }) => {
      const project = await prisma.project.findUnique({
        where: { id: input.projectId },
        select: {
          id: true,
          lesson: {
            select: { module: { select: { curriculum: { select: { userId: true } } } } },
          },
        },
      });
      if (!project || project.lesson.module.curriculum.userId !== ctx.userId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }
      await prisma.project.update({
        where: { id: project.id },
        data: { submissionUrl: input.submissionUrl, isCompleted: true },
      });
      return { ok: true };
    }),
  markVideoComplete: protectedcProcedure
    .input(z.object({ videoId: z.string(), isCompleted: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const video = await prisma.video.findUnique({
        where: { id: input.videoId },
        select: {
          id: true,
          lesson: {
            select: { module: { select: { curriculum: { select: { userId: true } } } } },
          },
        },
      });
      if (!video || video.lesson.module.curriculum.userId !== ctx.userId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Video not found' });
      }
      await prisma.video.update({
        where: { id: video.id },
        data: { isCompleted: input.isCompleted },
      });
      return { ok: true };
    }),
  markReadingComplete: protectedcProcedure
    .input(z.object({ readingId: z.string(), isCompleted: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const reading = await prisma.readings.findUnique({
        where: { id: input.readingId },
        select: {
          id: true,
          lesson: {
            select: { module: { select: { curriculum: { select: { userId: true } } } } },
          },
        },
      });
      if (!reading || reading.lesson.module.curriculum.userId !== ctx.userId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Reading not found' });
      }
      await prisma.readings.update({
        where: { id: reading.id },
        data: { isCompleted: input.isCompleted },
      });
      return { ok: true };
    }),
  sendDiscussionMessage: activeUserProcedure
    .input(
      z.object({
        discussionId: z.string(),
        content: z.string().min(1).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const discussion = await prisma.discussion.findUnique({
        where: { id: input.discussionId },
        include: {
          lesson: {
            select: {
              id: true,
              module: { select: { curriculum: { select: { userId: true } } } },
            },
          },
        },
      });
      if (!discussion || discussion.lesson.module.curriculum.userId !== ctx.userId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Discussion not found' });
      }
      if (discussion.isCompleted) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'This discussion is already complete.',
        });
      }

      const history = Array.isArray(discussion.chatHistory)
        ? (discussion.chatHistory as Array<{ role: string; content: string; createdAt: string }>)
        : [];

      // Discussions are intentionally short — opening prompt → user → AI →
      // user → AI (final). Cap the learner at 2 turns so a runaway client
      // can't extend the chat past the close.
      const userTurns = history.filter((m) => m.role === 'user').length;
      if (userTurns >= 2) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Discussions only allow two replies before closing.',
        });
      }

      const next = [
        ...history,
        { role: 'user' as const, content: input.content, createdAt: new Date().toISOString() },
      ];

      await prisma.discussion.update({
        where: { id: discussion.id },
        data: { chatHistory: next },
      });

      await inngest.send({
        name: 'app/discussion.reply',
        data: {
          discussionId: discussion.id,
          lessonId: discussion.lesson.id,
          userId: ctx.userId,
        },
      });

      return { ok: true };
    }),

  // ---------------------------------------------------------------------
  // Notes
  // ---------------------------------------------------------------------
  createNote: protectedcProcedure
    .input(
      noteInputBase.extend({
        lessonId: z.string().optional(),
        curriculumId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // If pinning to a lesson/curriculum, verify ownership first.
      if (input.lessonId) {
        const owns = await prisma.lesson.findFirst({
          where: {
            id: input.lessonId,
            module: { curriculum: { userId: ctx.userId } },
          },
          select: { id: true, module: { select: { curriculumId: true } } },
        });
        if (!owns) throw new TRPCError({ code: 'NOT_FOUND', message: 'Lesson not found' });
        // Mirror the lesson's curriculum id onto the note for easier aggregation.
        if (!input.curriculumId) input.curriculumId = owns.module.curriculumId;
      }
      if (input.curriculumId) {
        const owns = await prisma.curriculum.findFirst({
          where: { id: input.curriculumId, userId: ctx.userId },
          select: { id: true },
        });
        if (!owns) throw new TRPCError({ code: 'NOT_FOUND', message: 'Curriculum not found' });
      }

      const note = await prisma.note.create({
        data: {
          id: crypto.randomUUID(),
          userId: ctx.userId,
          title: input.title?.trim() || null,
          description: input.description?.trim() || null,
          content: input.content,
          lessonId: input.lessonId ?? null,
          curriculumId: input.curriculumId ?? null,
        },
      });
      return note;
    }),
  updateNote: protectedcProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().max(120).nullable().optional(),
        description: z
          .string()
          .max(NOTE_DESCRIPTION_MAX_LENGTH)
          .nullable()
          .optional(),
        content: z.string().min(1).max(NOTE_MAX_LENGTH).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await prisma.note.updateMany({
        where: { id: input.id, userId: ctx.userId },
        data: {
          ...(input.title !== undefined ? { title: input.title?.trim() || null } : {}),
          ...(input.description !== undefined
            ? { description: input.description?.trim() || null }
            : {}),
          ...(input.content !== undefined ? { content: input.content } : {}),
        },
      });
      if (result.count === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Note not found' });
      }
      return { ok: true };
    }),
  // Single-note fetch for the dedicated /notes/[id] page. Includes the
  // surrounding ordered note ids (prev/next) so the page can render its
  // navigation arrows in one round trip and stay enforced server-side.
  getNote: protectedcProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const note = await prisma.note.findFirst({
        where: { id: input.id, userId: ctx.userId },
        include: {
          lesson: {
            select: {
              id: true,
              title: true,
              moduleId: true,
              module: { select: { curriculumId: true } },
            },
          },
          curriculum: { select: { id: true, title: true } },
        },
      });
      if (!note) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Note not found' });
      }

      // Order matches the notes grid (most recently updated first), so prev =
      // newer note and next = older note.
      const ordered = await prisma.note.findMany({
        where: { userId: ctx.userId },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        select: { id: true },
      });
      const idx = ordered.findIndex((n) => n.id === note.id);
      const prevId = idx > 0 ? ordered[idx - 1]!.id : null;
      const nextId = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1]!.id : null;

      return {
        id: note.id,
        title: note.title,
        description: note.description,
        content: note.content,
        isAnnotation: note.isAnnotation,
        lessonId: note.lessonId,
        curriculumId: note.curriculumId,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        lesson: note.lesson
          ? {
              id: note.lesson.id,
              title: note.lesson.title,
              curriculumId: note.lesson.module.curriculumId,
            }
          : null,
        curriculum: note.curriculum
          ? { id: note.curriculum.id, title: note.curriculum.title }
          : null,
        prevId,
        nextId,
      };
    }),
  // AI-generated title + description for a note. Available even when the user
  // already supplied their own — they can re-roll until they like the result.
  summarizeNote: activeUserProcedure
    .input(
      z.object({
        // Either a saved note (we'll load the canonical content) or an
        // ad-hoc draft from the editor.
        id: z.string().optional(),
        content: z.string().min(1).max(NOTE_MAX_LENGTH).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      let content = input.content?.trim() ?? '';
      if (!content && input.id) {
        const note = await prisma.note.findFirst({
          where: { id: input.id, userId: ctx.userId },
          select: { content: true },
        });
        if (!note) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Note not found' });
        }
        content = note.content;
      }
      if (!content) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Provide note content to summarize.',
        });
      }

      const result = await generateObject({
        model: googleClient(SUMMARIZE_MODEL),
        schema: summarizeNoteSchema,
        system:
          'You write tight, specific titles and 1-2 sentence descriptions for personal study notes. Stay grounded in the note content; do not invent facts. Title is concise (no trailing punctuation). Description is plain prose.',
        prompt: `Summarize the following study note. Return a title and a 1-2 sentence description.\n\n---\n${content}\n---`,
      });
      // Best-effort token-usage log so the admin dashboard can attribute
      // summarize-note spend per user. Awaited so the row hits Postgres
      // before we return, but `recordAiUsage` already swallows failures.
      await recordAiUsage({
        userId: ctx.userId,
        kind: 'NOTE_SUMMARY',
        model: SUMMARIZE_MODEL,
        result,
        resourceId: input.id,
      });
      const parsed = summarizeNoteSchema.parse(result.object);
      return parsed;
    }),

  // ---------------------------------------------------------------------
  // Annotations (highlight + commentary on a lesson passage)
  // ---------------------------------------------------------------------
  listAnnotations: protectedcProcedure
    .input(z.object({ lessonId: z.string() }))
    .query(async ({ ctx, input }) => {
      const owns = await prisma.lesson.findFirst({
        where: { id: input.lessonId, module: { curriculum: { userId: ctx.userId } } },
        select: { id: true },
      });
      if (!owns) return [];
      const rows = await prisma.annotation.findMany({
        where: { userId: ctx.userId, lessonId: input.lessonId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          quote: true,
          annotation: true,
          noteId: true,
          createdAt: true,
        },
      });
      return rows;
    }),
  createAnnotation: activeUserProcedure
    .input(
      z.object({
        lessonId: z.string(),
        quote: z.string().min(1).max(ANNOTATION_QUOTE_MAX_LENGTH),
        annotation: z.string().min(1).max(ANNOTATION_TEXT_MAX_LENGTH),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const lesson = await prisma.lesson.findFirst({
        where: { id: input.lessonId, module: { curriculum: { userId: ctx.userId } } },
        select: {
          id: true,
          title: true,
          module: { select: { curriculumId: true } },
        },
      });
      if (!lesson) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Lesson not found' });
      }

      // Find or create the user's auto-managed annotation note for this
      // lesson. Re-using one row keeps the user's notes page tidy and lets
      // hover-card lookups join annotations → note in a single query.
      const existing = await prisma.note.findFirst({
        where: {
          userId: ctx.userId,
          lessonId: lesson.id,
          isAnnotation: true,
        },
        select: { id: true },
      });
      let noteId = existing?.id;
      if (!noteId) {
        const created = await prisma.note.create({
          data: {
            id: crypto.randomUUID(),
            userId: ctx.userId,
            lessonId: lesson.id,
            curriculumId: lesson.module.curriculumId,
            isAnnotation: true,
            title: `Annotations · ${lesson.title}`,
            description: `Highlights and commentary you saved while working through "${lesson.title}".`,
            content: '',
          },
          select: { id: true },
        });
        noteId = created.id;
      }

      const annotation = await prisma.annotation.create({
        data: {
          id: crypto.randomUUID(),
          userId: ctx.userId,
          lessonId: lesson.id,
          noteId,
          quote: input.quote,
          annotation: input.annotation,
        },
      });

      await rebuildAnnotationNoteContent(noteId);
      return { annotationId: annotation.id, noteId };
    }),
  updateAnnotation: activeUserProcedure
    .input(
      z.object({
        id: z.string(),
        annotation: z.string().min(1).max(ANNOTATION_TEXT_MAX_LENGTH),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await prisma.annotation.findFirst({
        where: { id: input.id, userId: ctx.userId },
        select: { id: true, noteId: true },
      });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Annotation not found' });
      }
      await prisma.annotation.update({
        where: { id: existing.id },
        data: { annotation: input.annotation },
      });
      await rebuildAnnotationNoteContent(existing.noteId);
      return { ok: true };
    }),
  deleteAnnotation: protectedcProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await prisma.annotation.findFirst({
        where: { id: input.id, userId: ctx.userId },
        select: { id: true, noteId: true },
      });
      if (!existing) return { ok: true };
      await prisma.annotation.delete({ where: { id: existing.id } });
      const remaining = await prisma.annotation.count({
        where: { noteId: existing.noteId },
      });
      if (remaining === 0) {
        // No annotations left → drop the auto-note so the user's notes list
        // stays clean.
        await prisma.note.deleteMany({
          where: { id: existing.noteId, isAnnotation: true },
        });
      } else {
        await rebuildAnnotationNoteContent(existing.noteId);
      }
      return { ok: true };
    }),
  deleteNote: protectedcProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await prisma.note.deleteMany({
        where: { id: input.id, userId: ctx.userId },
      });
      return { deleted: result.count };
    }),
  listNotes: protectedcProcedure
    .input(
      z
        .object({
          curriculumId: z.string().optional(),
          lessonId: z.string().optional(),
          scope: z.enum(['all', 'user', 'curriculum', 'lesson']).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      type NoteWhere = NonNullable<
        NonNullable<Parameters<typeof prisma.note.findMany>[0]>['where']
      >;
      const where: NoteWhere = { userId: ctx.userId };
      if (input?.lessonId) {
        where.lessonId = input.lessonId;
      } else if (input?.curriculumId) {
        where.OR = [
          { curriculumId: input.curriculumId },
          { lesson: { module: { curriculumId: input.curriculumId } } },
        ];
      } else if (input?.scope === 'user') {
        where.lessonId = null;
        where.curriculumId = null;
      }

      const rows = await prisma.note.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        include: {
          lesson: {
            select: {
              id: true,
              title: true,
              moduleId: true,
              module: { select: { curriculumId: true } },
            },
          },
          curriculum: { select: { id: true, title: true } },
        },
      });
      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        content: row.content,
        isAnnotation: row.isAnnotation,
        lessonId: row.lessonId,
        curriculumId: row.curriculumId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        lesson: row.lesson
          ? {
              id: row.lesson.id,
              title: row.lesson.title,
              curriculumId: row.lesson.module.curriculumId,
            }
          : null,
        curriculum: row.curriculum
          ? { id: row.curriculum.id, title: row.curriculum.title }
          : null,
      }));
    }),

  // ---------------------------------------------------------------------
  // Study schedule
  // ---------------------------------------------------------------------
  previewSchedule: protectedcProcedure
    .input(scheduleInputSchema)
    .mutation(async ({ ctx, input }) => {
      // `mutation` (not query) so the caller can re-trigger it freely from a
      // preview button without TanStack Query refetch shenanigans.
      const result = await buildPreview(ctx.userId, input);
      return result;
    }),
  upsertSchedule: protectedcProcedure
    .input(
      scheduleInputSchema.extend({
        acceptWarnings: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const preview = await buildPreview(ctx.userId, input);
      // If the generator surfaced any warning, the client must explicitly
      // opt in to proceed. This is the "your end date is too soon" gate.
      if (preview.diagnostics.warnings.length > 0 && !input.acceptWarnings) {
        return {
          ok: false as const,
          requiresConfirmation: true as const,
          diagnostics: preview.diagnostics,
          summary: preview.summary,
        };
      }

      // Replace the existing schedule for this curriculum atomically: delete
      // any existing sessions + schedule, then write the new one. We rebuild
      // the slot conflict map AFTER the delete so we don't conflict with
      // ourselves on a regenerate.
      await prisma.$transaction(async (tx) => {
        await tx.studySchedule.deleteMany({
          where: { curriculumId: input.curriculumId, userId: ctx.userId },
        });

        const scheduleId = crypto.randomUUID();
        const startDate = startOfLocalDay(new Date());
        const targetDate = startOfLocalDay(new Date(input.targetCompletionDate));

        await tx.studySchedule.create({
          data: {
            id: scheduleId,
            userId: ctx.userId,
            curriculumId: input.curriculumId,
            daysOfWeek: input.daysOfWeek,
            minutesPerDay: input.minutesPerDay,
            preferredTimeSlots: input.preferredTimeSlots as PrismaStudyTimeSlot[],
            startDate,
            targetCompletionDate: targetDate,
            warningsAccepted: input.acceptWarnings,
          },
        });

        if (preview.sessions.length > 0) {
          await tx.studySession.createMany({
            data: preview.sessions.map((s) => ({
              id: crypto.randomUUID(),
              scheduleId,
              userId: ctx.userId,
              date: s.date,
              timeSlot: s.timeSlot as PrismaStudyTimeSlot,
              durationMin: s.durationMin,
              lessonIds: s.lessons.map((l) => l.id),
              lessonTitles: s.lessons.map((l) => l.title),
            })),
          });
        }
      });

      return {
        ok: true as const,
        requiresConfirmation: false as const,
        diagnostics: preview.diagnostics,
        summary: preview.summary,
      };
    }),
  deleteSchedule: protectedcProcedure
    .input(z.object({ curriculumId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await prisma.studySchedule.deleteMany({
        where: { curriculumId: input.curriculumId, userId: ctx.userId },
      });
      return { deleted: result.count };
    }),
  listSchedules: protectedcProcedure.query(async ({ ctx }) => {
    const rows = await prisma.studySchedule.findMany({
      where: { userId: ctx.userId },
      include: {
        curriculum: { select: { id: true, title: true } },
        _count: { select: { sessions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((s) => ({
      id: s.id,
      curriculumId: s.curriculumId,
      curriculumTitle: s.curriculum.title,
      daysOfWeek: s.daysOfWeek,
      minutesPerDay: s.minutesPerDay,
      preferredTimeSlots: s.preferredTimeSlots,
      // startDate / targetCompletionDate are TIMESTAMP columns and round
      // trip exactly; no normalisation needed.
      startDate: s.startDate,
      targetCompletionDate: s.targetCompletionDate,
      warningsAccepted: s.warningsAccepted,
      sessionCount: s._count.sessions,
    }));
  }),
  sessionsInRange: protectedcProcedure
    .input(
      z.object({
        from: z.iso.datetime(),
        to: z.iso.datetime(),
        curriculumId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rows = await prisma.studySession.findMany({
        where: {
          userId: ctx.userId,
          date: {
            gte: new Date(input.from),
            lt: new Date(input.to),
          },
          ...(input.curriculumId
            ? { schedule: { curriculumId: input.curriculumId } }
            : {}),
        },
        orderBy: [{ date: 'asc' }, { timeSlot: 'asc' }],
        include: {
          schedule: {
            select: {
              curriculumId: true,
              curriculum: { select: { title: true } },
            },
          },
        },
      });
      return rows.map((r) => ({
        id: r.id,
        scheduleId: r.scheduleId,
        date: normalizeDateFromDb(r.date),
        timeSlot: r.timeSlot,
        durationMin: r.durationMin,
        lessonIds: Array.isArray(r.lessonIds) ? (r.lessonIds as string[]) : [],
        lessonTitles: Array.isArray(r.lessonTitles)
          ? (r.lessonTitles as string[])
          : [],
        isCompleted: r.isCompleted,
        curriculum: {
          id: r.schedule.curriculumId,
          title: r.schedule.curriculum.title,
        },
      }));
    }),
  checkIn: protectedcProcedure.mutation(async ({ ctx }) => {
    const today = startOfLocalDay(new Date());

    // Idempotent: upsert keyed on the user+date unique constraint so a
    // double-click doesn't error out.
    await prisma.checkIn.upsert({
      where: { userId_date: { userId: ctx.userId, date: today } },
      create: {
        id: crypto.randomUUID(),
        userId: ctx.userId,
        date: today,
      },
      update: {},
    });

    // Mark every session scheduled for today as completed too — the user is
    // checking in for the day, after all.
    await prisma.studySession.updateMany({
      where: { userId: ctx.userId, date: today },
      data: { isCompleted: true },
    });

    return { ok: true };
  }),
  getStreak: protectedcProcedure.query(async ({ ctx }) => {
    const checkIns = await prisma.checkIn.findMany({
      where: { userId: ctx.userId },
      orderBy: { date: 'desc' },
      take: 365,
      select: { date: true },
    });
    // Anchor each row to noon UTC so the streak compares against today
    // (also noon UTC) on the user's local calendar day.
    const summary = computeStreak(
      checkIns.map((c) => normalizeDateFromDb(c.date)),
    );
    return {
      streak: summary.streak,
      checkedInToday: summary.checkedInToday,
      lastCheckIn: summary.lastCheckIn,
    };
  }),

  // ---------------------------------------------------------------------
  // Settings / account management
  // ---------------------------------------------------------------------
  getProfile: protectedcProcedure.query(async ({ ctx }) => {
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        isAlpha: true,
        isDisabled: true,
      },
    });
    if (!user) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
    }
    return user;
  }),
  getAlphaUsage: protectedcProcedure.query(async ({ ctx }) => {
    const [user, curricula, lessons, discussions] = await Promise.all([
      prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { isAlpha: true },
      }),
      countCurriculaForUser(ctx.userId),
      countLessonGenerationsThisMonth(ctx.userId),
      countDiscussionGenerationsThisMonth(ctx.userId),
    ]);

    const snapshot: AlphaUsageSnapshot = {
      isAlpha: user?.isAlpha ?? false,
      curricula: {
        used: curricula,
        limit: ALPHA_LIMITS.curricula,
        remaining: Math.max(0, ALPHA_LIMITS.curricula - curricula),
      },
      lessonsThisMonth: {
        used: lessons,
        limit: ALPHA_LIMITS.lessonsPerMonth,
        remaining: Math.max(0, ALPHA_LIMITS.lessonsPerMonth - lessons),
      },
      discussionsThisMonth: {
        used: discussions,
        limit: ALPHA_LIMITS.discussionsPerMonth,
        remaining: Math.max(0, ALPHA_LIMITS.discussionsPerMonth - discussions),
      },
    };
    return snapshot;
  }),
  updateProfile: activeUserProcedure
    .input(
      z.object({
        name: z
          .string()
          .min(1, 'Name is required')
          .max(120, 'Name must be 120 characters or fewer'),
        // We accept either an http(s) URL or an empty string to clear the
        // avatar. Validating as URL keeps the <AvatarImage> safe to render.
        image: z
          .string()
          .max(2048, 'URL is too long')
          .refine((v) => v === '' || z.url().safeParse(v).success, {
            message: 'Avatar must be a valid URL',
          }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updated = await prisma.user.update({
        where: { id: ctx.userId },
        data: {
          name: input.name.trim(),
          image: input.image.trim() === '' ? null : input.image.trim(),
        },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      });
      return updated;
    }),
  disableAccount: activeUserProcedure
    .input(
      z.object({
        reason: z
          .string()
          .min(1, 'Please tell us why')
          .max(2000, 'Reason is too long'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Two writes in a transaction so we never lose the survey row even if a
      // later step fails — qualitative signal is the whole point of the modal.
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: ctx.userId },
          select: { email: true },
        });
        if (!user) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
        }
        await tx.accountFeedback.create({
          data: {
            id: crypto.randomUUID(),
            userId: ctx.userId,
            email: user.email,
            action: 'DISABLE',
            reason: input.reason.trim(),
          },
        });
        await tx.user.update({
          where: { id: ctx.userId },
          data: { isDisabled: true, disabledAt: new Date() },
        });
        // Wipe sessions so all open tabs land on /account-disabled on next
        // request — the user must explicitly re-enable to come back in.
        await tx.session.deleteMany({ where: { userId: ctx.userId } });
      });
      return { ok: true };
    }),
  // Mark the user onboarded. Called by the final step of /onboarding for
  // both submit-survey and skip-survey paths. The optional `referralSource`
  // is the answer to "how did you hear about Quazom?"; we only persist it
  // when present so a skip leaves the field NULL.
  completeOnboarding: activeUserProcedure
    .input(
      z.object({
        referralSource: z
          .string()
          .trim()
          .min(1)
          .max(120)
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await prisma.user.update({
        where: { id: ctx.userId },
        data: {
          isOnboarded: true,
          ...(input.referralSource ? { referralSource: input.referralSource } : {}),
        },
      });
      return { ok: true };
    }),
  enableAccount: protectedcProcedure.mutation(async ({ ctx }) => {
    await prisma.user.update({
      where: { id: ctx.userId },
      data: { isDisabled: false, disabledAt: null },
    });
    return { ok: true };
  }),
  deleteAccount: protectedcProcedure
    .input(
      z.object({
        reason: z
          .string()
          .min(1, 'Please tell us why')
          .max(2000, 'Reason is too long'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // AccountFeedback is intentionally NOT a relation to User — the row
      // survives the cascade so we can review it after the account is gone.
      const user = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { email: true },
      });
      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }
      await prisma.accountFeedback.create({
        data: {
          id: crypto.randomUUID(),
          userId: ctx.userId,
          email: user.email,
          action: 'DELETE',
          reason: input.reason.trim(),
        },
      });
      // Cascading FKs on Session/Account/Curriculum/etc. clean up downstream.
      await prisma.user.delete({ where: { id: ctx.userId } });
      return { ok: true };
    }),

  realtimeToken: protectedcProcedure
    .output(
      z.object({
        key: z.string(),
        apiBaseUrl: z.string().optional(),
      }),
    )
    .query(async ({ ctx }) => {
      const token = await getSubscriptionToken(inngest, {
        channel: userChannel(ctx.userId),
        topics: [...userChannelTopics],
      });
      if (!token.key) {
        throw new Error('Failed to mint Inngest realtime subscription');
      }
      return {
        key: token.key,
        ...(typeof token.apiBaseUrl === 'string' ? { apiBaseUrl: token.apiBaseUrl } : {}),
      };
    }),
});

export type AppRouter = typeof appRouter;

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function scoreQuestions(
  questions: QuizQuestion[],
  answers: number[],
  passScore: number,
): { score: number; maxScore: number; isPassed: boolean } {
  if (questions.length === 0) return { score: 0, maxScore: 100, isPassed: false };
  const correct = questions.reduce((acc, q, idx) => {
    const a = answers[idx];
    return acc + (typeof a === 'number' && a === q.correctAnswerIndex ? 1 : 0);
  }, 0);
  const score = Math.round((correct / questions.length) * 100);
  return { score, maxScore: 100, isPassed: score >= passScore };
}

async function buildPreview(userId: string, input: ScheduleInput) {
  // Verify ownership of curriculum and load its lesson list in canonical
  // order. We schedule every non-READY lesson too — the user can do them in
  // any order; the schedule just paces the work.
  const curriculum = await prisma.curriculum.findFirst({
    where: { id: input.curriculumId, userId },
    select: {
      id: true,
      title: true,
      curriculumModules: {
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          order: true,
          lessons: {
            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
            select: { id: true, title: true, duration: true, order: true },
          },
        },
      },
    },
  });

  if (!curriculum) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Curriculum not found' });
  }

  const flatLessons: LessonForScheduling[] = curriculum.curriculumModules.flatMap(
    (m) =>
      m.lessons.map((l, i) => ({
        id: l.id,
        title: l.title,
        durationStr: l.duration,
        // Compose a stable ordering key: module order × 1000 + lesson index.
        globalOrder: m.order * 1000 + (l.order || i + 1),
      })),
  );

  // Conflict map: any (date, slot) booked by *other* schedules of the same
  // user inside the candidate range.
  const startDate = startOfLocalDay(new Date());
  const targetDate = startOfLocalDay(new Date(input.targetCompletionDate));

  const conflictRows = await prisma.studySession.findMany({
    where: {
      userId,
      date: { gte: startDate, lte: targetDate },
      schedule: { curriculumId: { not: input.curriculumId } },
    },
    select: {
      date: true,
      timeSlot: true,
      schedule: { select: { curriculum: { select: { title: true } } } },
    },
  });

  const takenSlots = new Set(
    conflictRows.map(
      (r) =>
        `${dateToDayKey(normalizeDateFromDb(r.date))}:${r.timeSlot}` as const,
    ),
  );

  const blockingCurricula = Array.from(
    new Set(conflictRows.map((r) => r.schedule.curriculum.title)),
  );

  const result = generateSchedule({
    lessons: flatLessons,
    daysOfWeek: input.daysOfWeek.filter(isDayOfWeek),
    minutesPerDay: input.minutesPerDay,
    preferredTimeSlots: input.preferredTimeSlots as StudyTimeSlotConst[],
    startDate,
    targetCompletionDate: targetDate,
    takenSlots: takenSlots as Set<`${string}:${StudyTimeSlotConst}`>,
  });

  return {
    sessions: result.sessions,
    diagnostics: result.diagnostics,
    summary: {
      curriculumTitle: curriculum.title,
      lessonCount: flatLessons.length,
      sessionCount: result.sessions.length,
      blockingCurricula,
    },
  };
}

// Rebuilds the markdown body of an annotation note from its annotations,
// in chronological order. Each annotation renders as `> quote\n\n— commentary`
// separated by `---` so the note reads like a clean reading log.
async function rebuildAnnotationNoteContent(noteId: string): Promise<void> {
  const annotations = await prisma.annotation.findMany({
    where: { noteId },
    orderBy: { createdAt: 'asc' },
    select: { quote: true, annotation: true },
  });
  const blocks = annotations.map((a) => {
    const quoted = a.quote
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n');
    return `${quoted}\n\n${a.annotation}`;
  });
  const content = blocks.join('\n\n---\n\n');
  await prisma.note.update({
    where: { id: noteId },
    data: { content: content.length > 0 ? content : '_No annotations yet._' },
  });
}

function dateToDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
