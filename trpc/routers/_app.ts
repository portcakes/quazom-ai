import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { baseProcedure, createTRPCRouter, protectedcProcedure } from '../init';
import { inngest } from '@/inngest/client';
import { userChannel, userChannelTopics } from '@/inngest/channels';
import { getSubscriptionToken } from 'inngest/realtime';
import prisma from '@/lib/db';
import { NOTE_MAX_LENGTH, type QuizQuestion } from '@/inngest/schemas';
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
import type { StudyTimeSlot as PrismaStudyTimeSlot } from '@/lib/generated/prisma/enums';

// Shared note input — title is optional, content is required, both length-capped
// so a runaway client can't blow up the table.
const noteInputBase = z.object({
  title: z.string().max(120).optional(),
  content: z.string().min(1, 'Content is required').max(NOTE_MAX_LENGTH),
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
  createCurriculum: protectedcProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        subject: z.string(),
        level: z.string(),
        goal: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
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
  generateLesson: protectedcProcedure
    .input(z.object({ lessonId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Auth check: the lesson must belong to a curriculum the user owns.
      const lesson = await prisma.lesson.findUnique({
        where: { id: input.lessonId },
        select: {
          id: true,
          status: true,
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
  sendDiscussionMessage: protectedcProcedure
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

      const history = Array.isArray(discussion.chatHistory)
        ? (discussion.chatHistory as Array<{ role: string; content: string; createdAt: string }>)
        : [];
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
        content: z.string().min(1).max(NOTE_MAX_LENGTH).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await prisma.note.updateMany({
        where: { id: input.id, userId: ctx.userId },
        data: {
          ...(input.title !== undefined ? { title: input.title?.trim() || null } : {}),
          ...(input.content !== undefined ? { content: input.content } : {}),
        },
      });
      if (result.count === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Note not found' });
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
        content: row.content,
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

function dateToDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
