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
  NOTE_MAX_TAGS,
  NOTE_TAG_MAX_LENGTH,
  RESOURCE_DESCRIPTION_MAX_LENGTH,
  RESOURCE_FILE_MAX_BYTES,
  RESOURCE_TITLE_MAX_LENGTH,
  RESOURCE_URL_MAX_LENGTH,
  annotationColors,
  curriculumLevels,
  lessonActivityTypes,
  nextCurriculumLevel,
  resourceFileTypes,
  resourceMimeTypes,
  activityTypeToDb,
  type CurriculumLevel,
  type LessonActivityType,
  type QuizQuestion,
} from '@/inngest/schemas';
import {
  deleteObject as r2DeleteObject,
  getObjectBytes,
  getObjectText,
  getSignedDownloadUrl,
  getSignedUploadUrl,
  headObject,
  r2IsConfigured,
} from '@/lib/r2';
import { extractPdfText } from '@/lib/pdf';
import { extractArticle, safeHostname } from '@/lib/readability';
import {
  assertAllowedSourceUrl,
  extractSourceContent,
} from '@/lib/link-guardrails';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { recordAiUsage } from '@/inngest/ai-usage';
import {
  countContinuityCurriculaForUser,
  countContinuityCurriculaThisMonth,
  countCurriculaForUser,
  countCurriculaThisMonth,
  countDiscussionGenerationsThisMonth,
  countLessonGenerationsThisMonth,
  getPlanUsage,
  isOverLimit,
  LIMITS_BY_PLAN,
  resolveEffectivePlan,
  type EffectivePlan,
} from '@/lib/subscription/plan-limits';
import {
  BILLING_INTERVALS,
  PLAN_KEYS,
  PLANS,
} from '@/lib/subscription/plans';
import {
  TITLE_SLUGS,
  TITLES,
  isTitleGrantable,
  isTitleSlug,
  titleLabel,
} from '@/lib/subscription/titles';
import {
  generateSchedule,
  normalizeDateFromDb,
  startOfDayInTimezone,
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
  tags: z
    .array(z.string().min(1).max(NOTE_TAG_MAX_LENGTH))
    .max(NOTE_MAX_TAGS)
    .optional(),
});

// Normalises a tag array to lower-cased, trimmed, deduplicated values so the
// DB never accumulates "AI", "ai", "Ai" as three different rows. Returning
// `null` when there are no usable tags lets the caller skip writing to the
// column (and keep its default of `[]`).
function normalizeTags(input: string[] | undefined | null): string[] | null {
  if (!input || input.length === 0) return null;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    const tag = raw.trim().toLowerCase();
    if (!tag) continue;
    if (tag.length > NOTE_TAG_MAX_LENGTH) continue;
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= NOTE_MAX_TAGS) break;
  }
  return out.length > 0 ? out : null;
}

// Shared zod refinement for an HTTP(S) URL the user pastes into "Add link".
// We don't try to detect dead links here — that would block submit on slow
// sites. Instead we just check the protocol and host parsing so obvious
// nonsense (javascript: URLs, blank strings, "foo.bar" without a scheme)
// can't make it into the DB.
const urlInputSchema = z
  .string()
  .min(1, 'URL is required')
  .max(RESOURCE_URL_MAX_LENGTH, 'URL is too long')
  .refine(
    (value) => {
      try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'Enter a valid http(s) URL' },
  );

// Reused by every resource procedure that accepts optional scope hints. A
// single resource can be linked to a curriculum and a lesson at the same
// time; linking to a lesson auto-pins to the lesson's curriculum as well.
const resourceScopeSchema = z
  .object({
    curriculumId: z.string().optional(),
    lessonId: z.string().optional(),
  })
  .optional();

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

// Shared zod input for the lesson-type filter the user picks in the new
// curriculum modal. Lower-case AI-facing names; we map to the Prisma enum at
// the persistence boundary via `activityTypeToDb`. Empty array means "no
// preference" — downstream code defaults that back to the full set.
const includedActivityTypesSchema = z
  .array(z.enum(lessonActivityTypes))
  .max(lessonActivityTypes.length);

// Cap on extra free-text "topic" chips a user can attach to a curriculum.
// Combined with `MAX_RESOURCE_SOURCES_PER_CURRICULUM` to bound prompt size.
const MAX_TOPICS_PER_CURRICULUM = 6;
// Max owned-resource ids the modal can attach as sources. The continuity
// prompt builder also caps content by character count, so this is mostly
// belt-and-suspenders against hostile clients.
const MAX_RESOURCE_SOURCES_PER_CURRICULUM = 10;
// Max continuity notes the thesis generator will look at in one call.
const MAX_CONTINUITY_NOTES_PER_THESIS = 8;
// Maximum length of a user-written thesis. The AI-generated one is short by
// construction (1-3 sentences) so this is mostly to bound textarea input.
const THESIS_MAX_LENGTH = 2000;

type DbLessonActivityType =
  | "VIDEO"
  | "QUIZ"
  | "EXERCISE"
  | "PROJECT"
  | "DISCUSSION"
  | "READING"
  | "OTHER";

// Default lesson-type set written to the curriculum row when the user
// doesn't supply an explicit filter. VIDEO was retired in May 2026 — see
// `VISIBLE_LESSON_TYPES` in `curriculum-lesson-types.tsx` for the rationale.
// Existing curricula keep whatever `includedActivityTypes` they were
// created with (we don't migrate old rows), so videos in legacy courses
// still generate.
const DEFAULT_DB_ACTIVITY_TYPES: DbLessonActivityType[] = [
  "QUIZ",
  "EXERCISE",
  "PROJECT",
  "DISCUSSION",
  "READING",
  "OTHER",
];

// Convert AI-facing activity-type slugs into the Prisma enum values used by
// the curriculum row. Empty / undefined input collapses to the default set
// so a downstream generator can't accidentally be told "emit zero lesson
// types". Also strips VIDEO unconditionally — the lesson-type filter UI
// hides the option, but stripping at the persistence boundary stops a
// hand-crafted client from opting back in.
function normaliseIncludedActivityTypes(
  types: readonly LessonActivityType[] | undefined,
): DbLessonActivityType[] {
  if (!types || types.length === 0) return [...DEFAULT_DB_ACTIVITY_TYPES];
  const set = new Set<DbLessonActivityType>(
    types.map((t) => activityTypeToDb(t)).filter((t) => t !== "VIDEO"),
  );
  // Defensive fallback: a client that sent only VIDEO would otherwise end
  // up with zero types, which downstream code treats as "no preference"
  // and would re-expand to the full set (including VIDEO via Prisma's
  // column default). Force them onto the default instead.
  if (set.size === 0) return [...DEFAULT_DB_ACTIVITY_TYPES];
  return Array.from(set);
}

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
        // Subject becomes optional when the user attached one source — the
        // source itself can anchor the topic. We still require at least one
        // of {subject, source} so we never run the generator on nothing.
        subject: z.string().max(100).optional().default(''),
        level: z.enum(curriculumLevels),
        goal: z.string().max(2000).optional().default(''),
        // 0 or 1 owned Resource id (validated for ownership below). Two or
        // more sources counts as a Continuity Curriculum and must use the
        // `createContinuityCurriculum` mutation instead.
        resourceIds: z.array(z.string().uuid()).max(1).optional().default([]),
        // 0 or 1 extra free-text topic chip.
        extraTopics: z.array(z.string().min(1).max(200)).max(1).optional().default([]),
        // Lesson-type filter (checkbox list in the modal).
        includedActivityTypes: includedActivityTypesSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // ---- Source-count sanity -----------------------------------------
      const sourceCount = input.resourceIds.length + input.extraTopics.length;
      if (sourceCount > 1) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'createCurriculum accepts at most one extra source. Use createContinuityCurriculum for multi-source generation.',
        });
      }
      // Require either a subject or some other source so we never generate
      // a curriculum out of literally nothing.
      const hasSubject = input.subject.trim().length > 0;
      if (sourceCount === 0 && !hasSubject) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Add a subject or at least one source to create a curriculum.',
        });
      }

      // ---- Plan-tier cost guard ---------------------------------------
      // SCHOLAR is unlimited for single-source curricula so the helper
      // short-circuits with `null`; ALPHA / FREE keep the lifetime cap;
      // EXPLORER gets the monthly cap. Counting only runs when we actually
      // have a cap to enforce.
      const user = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { isAlpha: true, subscriptionPlan: true },
      });
      const plan = resolveEffectivePlan({
        subscriptionPlan: user?.subscriptionPlan ?? null,
        isAlpha: user?.isAlpha ?? false,
      });
      const cap = LIMITS_BY_PLAN[plan].curricula;
      if (cap.limit !== null) {
        const used =
          cap.period === 'lifetime'
            ? await countCurriculaForUser(ctx.userId)
            : await countCurriculaThisMonth(ctx.userId);
        if (isOverLimit({ plan, feature: 'curricula', used })) {
          const periodLabel = cap.period === 'lifetime' ? 'total' : 'per month';
          const reset =
            cap.period === 'month'
              ? ' Resets on the 1st.'
              : ' Delete one to free up a slot.';
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: `Your plan is limited to ${cap.limit} single-source curricula ${periodLabel}.${reset}`,
          });
        }
      }

      // ---- Resource ownership check -----------------------------------
      // If the user attached a resource, confirm they own it and it's READY
      // *before* we burn AI tokens. A resource still extracting (or one
      // that failed extraction) can't be used as a source.
      if (input.resourceIds.length > 0) {
        const ids = input.resourceIds;
        const owned = await prisma.resource.findMany({
          where: { id: { in: ids }, userId: ctx.userId },
          select: { id: true, status: true, content: true },
        });
        const missing = ids.filter((id) => !owned.some((r) => r.id === id));
        if (missing.length > 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'One of the attached resources is missing or not yours.',
          });
        }
        const notReady = owned.filter((r) => r.status !== 'READY');
        if (notReady.length > 0) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message:
              "One of your attached resources isn't ready yet. Wait for the upload + extraction to finish, then try again.",
          });
        }
      }

      const includedActivityTypes = normaliseIncludedActivityTypes(
        input.includedActivityTypes,
      );

      // ---- Pre-create the Curriculum row + its sources ---------------
      // The row goes in as PENDING so the detail page can render the
      // pending shell immediately; the Inngest function flips it to READY
      // (or FAILED) once generation finishes.
      await prisma.$transaction(async (tx) => {
        await tx.curriculum.create({
          data: {
            id: input.id,
            userId: ctx.userId,
            title: input.subject || 'Generating curriculum…',
            subject: input.subject,
            level: input.level,
            goal: input.goal,
            overview: '',
            estimatedDuration: '',
            objectives: [],
            modules: [],
            recommendedResources: [],
            raw_ai_response: '',
            structured_data_json: {},
            kind: 'SINGLE',
            status: 'PENDING',
            includedActivityTypes,
          },
        });
        // Attach the optional resource source.
        for (const [idx, resourceId] of input.resourceIds.entries()) {
          await tx.curriculumSource.create({
            data: {
              id: crypto.randomUUID(),
              curriculumId: input.id,
              kind: 'LINK_RESOURCE',
              // The CurriculumSourceKind enum splits LINK vs FILE for
              // analytics, but the Inngest function dispatches off
              // `resource.kind` so we need the right one here too.
              order: idx,
              resourceId,
            },
          });
          // Pin the resource to the curriculum so the Resources tab shows
          // it alongside the user's other attached resources.
          await tx.resourceCurriculum
            .upsert({
              where: {
                resourceId_curriculumId: {
                  resourceId,
                  curriculumId: input.id,
                },
              },
              create: {
                id: crypto.randomUUID(),
                resourceId,
                curriculumId: input.id,
              },
              update: {},
            })
            .catch(() => {});
        }
        for (const [idx, topic] of input.extraTopics.entries()) {
          await tx.curriculumSource.create({
            data: {
              id: crypto.randomUUID(),
              curriculumId: input.id,
              kind: 'TOPIC',
              order: input.resourceIds.length + idx,
              topicText: topic.trim(),
            },
          });
        }
      });

      // Now that the row exists with its sources, patch the LINK vs FILE
      // kind on each CurriculumSource row to match the actual resource kind
      // (the upsert above had to use a single enum value).
      if (input.resourceIds.length > 0) {
        const resources = await prisma.resource.findMany({
          where: { id: { in: input.resourceIds } },
          select: { id: true, kind: true },
        });
        for (const r of resources) {
          await prisma.curriculumSource.updateMany({
            where: { curriculumId: input.id, resourceId: r.id },
            data: { kind: r.kind === 'FILE' ? 'FILE_RESOURCE' : 'LINK_RESOURCE' },
          });
        }
      }

      // ---- Fire the Inngest event ------------------------------------
      await inngest.send({
        name: 'app/curriculum.created',
        data: { id: input.id, userId: ctx.userId },
      });
      return { id: input.id };
    }),
  // -------------------------------------------------------------------
  // createContinuityCurriculum
  //
  // Multi-source curriculum. Requires 2+ sources total (extra topics +
  // resource ids), counts against the separate `continuityCurricula` quota
  // bucket, and accepts an optional thesis statement that anchors the
  // generated curriculum.
  // -------------------------------------------------------------------
  createContinuityCurriculum: activeUserProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        subject: z.string().max(100).optional().default(''),
        level: z.enum(curriculumLevels),
        goal: z.string().max(2000).optional().default(''),
        thesis: z.string().max(THESIS_MAX_LENGTH).optional().default(''),
        resourceIds: z
          .array(z.string().uuid())
          .max(MAX_RESOURCE_SOURCES_PER_CURRICULUM)
          .optional()
          .default([]),
        extraTopics: z
          .array(z.string().min(1).max(200))
          .max(MAX_TOPICS_PER_CURRICULUM)
          .optional()
          .default([]),
        // Continuity notes referenced (typically because the thesis was
        // generated from them). Stored as provenance only — not re-read at
        // generation time.
        continuityNoteIds: z
          .array(z.string().uuid())
          .max(MAX_CONTINUITY_NOTES_PER_THESIS)
          .optional()
          .default([]),
        includedActivityTypes: includedActivityTypesSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // ---- Source-count sanity ---------------------------------------
      const sourceCount = input.resourceIds.length + input.extraTopics.length;
      if (sourceCount < 2) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'A Continuity Curriculum needs at least 2 sources (topics + resources combined).',
        });
      }

      // ---- Plan-tier cost guard --------------------------------------
      const user = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { isAlpha: true, subscriptionPlan: true },
      });
      const plan = resolveEffectivePlan({
        subscriptionPlan: user?.subscriptionPlan ?? null,
        isAlpha: user?.isAlpha ?? false,
      });
      const cap = LIMITS_BY_PLAN[plan].continuityCurricula;
      const continuityUsed =
        cap.period === 'lifetime'
          ? await countContinuityCurriculaForUser(ctx.userId)
          : await countContinuityCurriculaThisMonth(ctx.userId);
      if (isOverLimit({ plan, feature: 'continuityCurricula', used: continuityUsed })) {
        const periodLabel = cap.period === 'lifetime' ? 'total' : 'per month';
        const reset =
          cap.period === 'month'
            ? ' Resets on the 1st.'
            : ' Upgrade your plan or delete one to free up a slot.';
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `Your plan is limited to ${cap.limit} Continuity Curricula ${periodLabel}.${reset}`,
        });
      }

      // ---- Resource ownership + readiness ----------------------------
      let resources: Array<{
        id: string;
        kind: 'LINK' | 'FILE';
        status: string;
        content: string | null;
      }> = [];
      if (input.resourceIds.length > 0) {
        const ids = input.resourceIds;
        const rows = await prisma.resource.findMany({
          where: { id: { in: ids }, userId: ctx.userId },
          select: { id: true, kind: true, status: true, content: true },
        });
        const missing = ids.filter((id) => !rows.some((r) => r.id === id));
        if (missing.length > 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'One of the attached resources is missing or not yours.',
          });
        }
        const notReady = rows.filter((r) => r.status !== 'READY');
        if (notReady.length > 0) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message:
              "One of your attached resources isn't ready yet. Wait for the upload + extraction to finish, then try again.",
          });
        }
        // Hard-reject: every source must have extracted content before we
        // spend AI tokens on the prompt. The modal's "Add a link" flow
        // uses requireExtraction=true; this is a belt-and-suspenders check
        // for resources attached from the user's existing library.
        const empty = rows.filter((r) => !r.content || r.content.trim().length === 0);
        if (empty.length > 0) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message:
              "One of your attached resources doesn't have any readable text yet. Re-extract it from the resource viewer and try again.",
          });
        }
        resources = rows;
      }

      // ---- Continuity-note ownership (provenance only) ---------------
      if (input.continuityNoteIds.length > 0) {
        const owned = await prisma.continuityNote.count({
          where: { id: { in: input.continuityNoteIds }, userId: ctx.userId },
        });
        if (owned !== input.continuityNoteIds.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'One of the referenced continuity notes is missing or not yours.',
          });
        }
      }

      const includedActivityTypes = normaliseIncludedActivityTypes(
        input.includedActivityTypes,
      );
      const thesis = input.thesis.trim() || null;

      // ---- Pre-create the Curriculum row + its sources ---------------
      await prisma.$transaction(async (tx) => {
        await tx.curriculum.create({
          data: {
            id: input.id,
            userId: ctx.userId,
            title: input.subject || 'Generating Continuity Curriculum…',
            subject: input.subject,
            level: input.level,
            goal: input.goal,
            overview: '',
            estimatedDuration: '',
            objectives: [],
            modules: [],
            recommendedResources: [],
            raw_ai_response: '',
            structured_data_json: {},
            kind: 'CONTINUITY',
            status: 'PENDING',
            thesis,
            includedActivityTypes,
          },
        });
        let order = 0;
        for (const resource of resources) {
          await tx.curriculumSource.create({
            data: {
              id: crypto.randomUUID(),
              curriculumId: input.id,
              kind: resource.kind === 'FILE' ? 'FILE_RESOURCE' : 'LINK_RESOURCE',
              order: order++,
              resourceId: resource.id,
            },
          });
          await tx.resourceCurriculum
            .upsert({
              where: {
                resourceId_curriculumId: {
                  resourceId: resource.id,
                  curriculumId: input.id,
                },
              },
              create: {
                id: crypto.randomUUID(),
                resourceId: resource.id,
                curriculumId: input.id,
              },
              update: {},
            })
            .catch(() => {});
        }
        for (const topic of input.extraTopics) {
          await tx.curriculumSource.create({
            data: {
              id: crypto.randomUUID(),
              curriculumId: input.id,
              kind: 'TOPIC',
              order: order++,
              topicText: topic.trim(),
            },
          });
        }
        for (const noteId of input.continuityNoteIds) {
          await tx.curriculumSource.create({
            data: {
              id: crypto.randomUUID(),
              curriculumId: input.id,
              kind: 'CONTINUITY_NOTE',
              order: order++,
              continuityNoteId: noteId,
            },
          });
        }
      });

      await inngest.send({
        name: 'app/curriculum.continuity_created',
        data: { id: input.id, userId: ctx.userId },
      });
      return { id: input.id };
    }),
  // -------------------------------------------------------------------
  // generateThesisFromNotes
  //
  // Fires the thesis-generation Inngest function. Caller passes a
  // `requestId` (uuid) it'll listen for on the `thesisReady` realtime
  // topic so concurrent generations don't collide.
  // -------------------------------------------------------------------
  generateThesisFromNotes: activeUserProcedure
    .input(
      z.object({
        requestId: z.string().uuid(),
        continuityNoteIds: z
          .array(z.string().uuid())
          .min(1, 'Select at least one continuity note')
          .max(MAX_CONTINUITY_NOTES_PER_THESIS),
        subject: z.string().max(100).optional(),
        goal: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const owned = await prisma.continuityNote.count({
        where: { id: { in: input.continuityNoteIds }, userId: ctx.userId },
      });
      if (owned !== input.continuityNoteIds.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'One of the selected notes is missing or not yours.',
        });
      }
      await inngest.send({
        name: 'app/thesis.generate',
        data: {
          requestId: input.requestId,
          userId: ctx.userId,
          noteIds: input.continuityNoteIds,
          subject: input.subject ?? null,
          goal: input.goal ?? null,
        },
      });
      return { requestId: input.requestId };
    }),
  getCurriculum: protectedcProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      // Surface the new lifecycle + kind columns so the detail page can
      // decide between rendering the pending shell, the failure state, or
      // the full hero+tabs view without an extra round trip.
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
          kind: true,
          status: true,
          statusMessage: true,
          thesis: true,
        },
      });
    }),
  // Reset a FAILED curriculum back to PENDING and re-fire its generation
  // event. Used by the failure-state retry button on the detail page.
  retryCurriculum: activeUserProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const curriculum = await prisma.curriculum.findFirst({
        where: { id: input.id, userId: ctx.userId },
        select: { id: true, kind: true, status: true },
      });
      if (!curriculum) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Curriculum not found' });
      }
      if (curriculum.status !== 'FAILED') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only failed curricula can be retried.',
        });
      }
      await prisma.curriculum.update({
        where: { id: curriculum.id },
        data: { status: 'PENDING', statusMessage: null },
      });
      await inngest.send({
        name:
          curriculum.kind === 'CONTINUITY'
            ? 'app/curriculum.continuity_created'
            : 'app/curriculum.created',
        data: { id: curriculum.id, userId: ctx.userId },
      });
      return { ok: true };
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

      // Plan-tier monthly caps. We only count towards the cap when this is
      // a *fresh* generation — a STUB lesson going to GENERATING. Retries
      // on a FAILED lesson would have already counted the first time
      // around, so they don't count again here.
      const user = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { isAlpha: true, subscriptionPlan: true },
      });
      const plan = resolveEffectivePlan({
        subscriptionPlan: user?.subscriptionPlan ?? null,
        isAlpha: user?.isAlpha ?? false,
      });
      const lessonCap = LIMITS_BY_PLAN[plan].lessonsPerMonth;
      const discussionCap = LIMITS_BY_PLAN[plan].discussionsPerMonth;
      const checkLessonCap = lesson.status === 'STUB' && lessonCap.limit !== null;
      const checkDiscussionCap =
        lesson.status === 'STUB' &&
        lesson.activityType === 'DISCUSSION' &&
        discussionCap.limit !== null;
      if (checkLessonCap || checkDiscussionCap) {
        const [lessonsUsed, discussionsUsed] = await Promise.all([
          checkLessonCap
            ? countLessonGenerationsThisMonth(ctx.userId)
            : Promise.resolve(0),
          checkDiscussionCap
            ? countDiscussionGenerationsThisMonth(ctx.userId)
            : Promise.resolve(0),
        ]);
        if (
          checkLessonCap &&
          isOverLimit({ plan, feature: 'lessonsThisMonth', used: lessonsUsed })
        ) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: `Your plan is limited to ${lessonCap.limit} lesson generations per month. The cap resets on the 1st.`,
          });
        }
        if (
          checkDiscussionCap &&
          isOverLimit({
            plan,
            feature: 'discussionsThisMonth',
            used: discussionsUsed,
          })
        ) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: `Your plan is limited to ${discussionCap.limit} discussion lessons per month. The cap resets on the 1st.`,
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
  // Light-weight polling endpoint used by the QuizView as a fallback when the
  // realtime `assessmentReady` event doesn't reach the browser (mobile sleep,
  // tab backgrounded, flaky Wi-Fi). Returns just the boolean so the client can
  // decide when to refetch the heavier lesson detail.
  getAssessmentStatus: protectedcProcedure
    .input(
      z.object({
        kind: z.enum(['quiz', 'exercise']),
        id: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (input.kind === 'quiz') {
        const quiz = await prisma.quiz.findUnique({
          where: { id: input.id },
          select: {
            id: true,
            questionsGenerated: true,
            lesson: {
              select: {
                module: { select: { curriculum: { select: { userId: true } } } },
              },
            },
          },
        });
        if (!quiz || quiz.lesson.module.curriculum.userId !== ctx.userId) {
          return null;
        }
        return { id: quiz.id, questionsGenerated: quiz.questionsGenerated };
      }
      const exercise = await prisma.exercise.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          questionsGenerated: true,
          lesson: {
            select: {
              module: { select: { curriculum: { select: { userId: true } } } },
            },
          },
        },
      });
      if (!exercise || exercise.lesson.module.curriculum.userId !== ctx.userId) {
        return null;
      }
      return {
        id: exercise.id,
        questionsGenerated: exercise.questionsGenerated,
      };
    }),
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

  // Skip a discussion — marks it complete + flags `wasSkipped` so the UI
  // can render a distinct banner. Skipped discussions still count toward
  // curriculum progression and the level-unlock gate; the only difference
  // is that the learner didn't engage with the prompt. Idempotent: if the
  // discussion is already complete (organic or skipped) we no-op so a
  // double-click can't error.
  skipDiscussion: activeUserProcedure
    .input(z.object({ discussionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const discussion = await prisma.discussion.findUnique({
        where: { id: input.discussionId },
        select: {
          id: true,
          isCompleted: true,
          lesson: {
            select: {
              module: { select: { curriculum: { select: { userId: true } } } },
            },
          },
        },
      });
      if (!discussion || discussion.lesson.module.curriculum.userId !== ctx.userId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Discussion not found' });
      }
      if (discussion.isCompleted) {
        // Already complete — nothing to do, but don't error so the UI can
        // safely retry on a flaky network.
        return { ok: true, alreadyComplete: true };
      }
      await prisma.discussion.update({
        where: { id: discussion.id },
        data: { isCompleted: true, wasSkipped: true },
      });
      return { ok: true, alreadyComplete: false };
    }),

  // ---------------------------------------------------------------------
  // Notes
  // ---------------------------------------------------------------------
  createNote: protectedcProcedure
    .input(
      noteInputBase.extend({
        lessonId: z.string().optional(),
        curriculumId: z.string().optional(),
        resourceId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // If pinning to a lesson/curriculum/resource, verify ownership first.
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
      if (input.resourceId) {
        const owns = await prisma.resource.findFirst({
          where: { id: input.resourceId, userId: ctx.userId },
          select: { id: true },
        });
        if (!owns) throw new TRPCError({ code: 'NOT_FOUND', message: 'Resource not found' });
      }

      const tags = normalizeTags(input.tags);
      const note = await prisma.note.create({
        data: {
          id: crypto.randomUUID(),
          userId: ctx.userId,
          title: input.title?.trim() || null,
          description: input.description?.trim() || null,
          content: input.content,
          tags: tags ?? [],
          lessonId: input.lessonId ?? null,
          curriculumId: input.curriculumId ?? null,
          resourceId: input.resourceId ?? null,
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
        tags: z
          .array(z.string().min(1).max(NOTE_TAG_MAX_LENGTH))
          .max(NOTE_MAX_TAGS)
          .nullable()
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tags =
        input.tags === undefined
          ? undefined
          : (normalizeTags(input.tags) ?? []);
      const result = await prisma.note.updateMany({
        where: { id: input.id, userId: ctx.userId },
        data: {
          ...(input.title !== undefined ? { title: input.title?.trim() || null } : {}),
          ...(input.description !== undefined
            ? { description: input.description?.trim() || null }
            : {}),
          ...(input.content !== undefined ? { content: input.content } : {}),
          ...(tags !== undefined ? { tags } : {}),
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
          resource: { select: { id: true, title: true, kind: true } },
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
        tags: note.tags,
        isAnnotation: note.isAnnotation,
        lessonId: note.lessonId,
        curriculumId: note.curriculumId,
        resourceId: note.resourceId,
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
        resource: note.resource
          ? {
              id: note.resource.id,
              title: note.resource.title,
              kind: note.resource.kind,
            }
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
  // Continuity Notes (long-form, source-spanning learner notebook)
  // ---------------------------------------------------------------------
  //
  // A ContinuityNote is NOT pinned to a single lesson/curriculum/resource.
  // It's a rich-text notebook the user grows over time, with embedded links
  // back to the lessons/courses/resources they're referencing. Links live
  // inside the HTML body itself rather than in a separate join table so
  // copy-pasting between notes preserves them automatically.
  listContinuityNotes: protectedcProcedure.query(async ({ ctx }) => {
    const rows = await prisma.continuityNote.findMany({
      where: { userId: ctx.userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        tags: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return rows;
  }),
  getContinuityNote: protectedcProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const note = await prisma.continuityNote.findFirst({
        where: { id: input.id, userId: ctx.userId },
        select: {
          id: true,
          title: true,
          content: true,
          tags: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      if (!note) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Note not found' });
      }
      return note;
    }),
  createContinuityNote: activeUserProcedure
    .input(
      z
        .object({
          // Optional starting payload — the sidebar creates a blank note and
          // the editor immediately opens it, so most calls won't pass these.
          title: z.string().max(200).optional(),
          content: z.string().max(NOTE_MAX_LENGTH * 4).optional(),
          tags: z
            .array(z.string().min(1).max(NOTE_TAG_MAX_LENGTH))
            .max(NOTE_MAX_TAGS)
            .optional(),
        })
        .optional(),
    )
    .mutation(async ({ ctx, input }) => {
      const tags = normalizeTags(input?.tags);
      const note = await prisma.continuityNote.create({
        data: {
          id: crypto.randomUUID(),
          userId: ctx.userId,
          title: input?.title?.trim() || null,
          content: input?.content ?? '',
          ...(tags ? { tags } : {}),
        },
        select: {
          id: true,
          title: true,
          tags: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return note;
    }),
  updateContinuityNote: protectedcProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().max(200).nullable().optional(),
        // Allow a generously larger body than `Note.content` — continuity
        // notes are designed to grow over months as the user chains ideas
        // together. The cap is still bounded to keep one runaway client
        // from filling the table.
        content: z.string().max(NOTE_MAX_LENGTH * 4).optional(),
        tags: z
          .array(z.string().min(1).max(NOTE_TAG_MAX_LENGTH))
          .max(NOTE_MAX_TAGS)
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (
        input.title === undefined &&
        input.content === undefined &&
        input.tags === undefined
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Nothing to update',
        });
      }
      // Treat an explicit empty `tags: []` as "clear all tags" while
      // `tags: undefined` means "don't touch". `normalizeTags` returns
      // `null` for an empty/blank array, so we branch on the raw input
      // here to keep the explicit-clear behaviour available.
      const tagsUpdate =
        input.tags === undefined
          ? undefined
          : (normalizeTags(input.tags) ?? []);
      const result = await prisma.continuityNote.updateMany({
        where: { id: input.id, userId: ctx.userId },
        data: {
          ...(input.title !== undefined
            ? { title: input.title?.trim() || null }
            : {}),
          ...(input.content !== undefined ? { content: input.content } : {}),
          ...(tagsUpdate !== undefined ? { tags: tagsUpdate } : {}),
        },
      });
      if (result.count === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Note not found' });
      }
      return { ok: true };
    }),
  deleteContinuityNote: protectedcProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await prisma.continuityNote.deleteMany({
        where: { id: input.id, userId: ctx.userId },
      });
      return { deleted: result.count };
    }),
  // Powers the rich-text editor's "Insert link" picker. Returns every
  // curriculum / lesson / resource the current user owns in a single round
  // trip so the picker can filter client-side as the user types.
  listContinuityLinkSources: protectedcProcedure.query(async ({ ctx }) => {
    const [curricula, lessons, resources] = await Promise.all([
      prisma.curriculum.findMany({
        where: { userId: ctx.userId },
        select: { id: true, title: true },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.lesson.findMany({
        where: { module: { curriculum: { userId: ctx.userId } } },
        select: {
          id: true,
          title: true,
          module: {
            select: {
              curriculumId: true,
              curriculum: { select: { title: true } },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.resource.findMany({
        where: { userId: ctx.userId },
        select: { id: true, title: true },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);
    return {
      curricula,
      lessons: lessons.map((l) => ({
        id: l.id,
        title: l.title,
        curriculumId: l.module.curriculumId,
        curriculumTitle: l.module.curriculum.title,
      })),
      resources,
    };
  }),

  // ---------------------------------------------------------------------
  // Annotations (highlight + commentary on a lesson passage)
  // ---------------------------------------------------------------------
  listAnnotations: protectedcProcedure
    .input(
      z.object({
        lessonId: z.string().optional(),
        resourceId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!input.lessonId && !input.resourceId) return [];
      // Verify the user owns the target. We bail with an empty list rather
      // than throwing so cross-user requests don't leak existence.
      if (input.lessonId) {
        const owns = await prisma.lesson.findFirst({
          where: {
            id: input.lessonId,
            module: { curriculum: { userId: ctx.userId } },
          },
          select: { id: true },
        });
        if (!owns) return [];
      } else if (input.resourceId) {
        const owns = await prisma.resource.findFirst({
          where: { id: input.resourceId, userId: ctx.userId },
          select: { id: true },
        });
        if (!owns) return [];
      }
      const rows = await prisma.annotation.findMany({
        where: {
          userId: ctx.userId,
          ...(input.lessonId ? { lessonId: input.lessonId } : {}),
          ...(input.resourceId ? { resourceId: input.resourceId } : {}),
        },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          quote: true,
          annotation: true,
          color: true,
          noteId: true,
          createdAt: true,
        },
      });
      return rows;
    }),
  createAnnotation: activeUserProcedure
    .input(
      z.object({
        // Exactly one of these must be set — the client picks based on
        // whether the user is annotating a lesson or a resource.
        lessonId: z.string().optional(),
        resourceId: z.string().optional(),
        quote: z.string().min(1).max(ANNOTATION_QUOTE_MAX_LENGTH),
        // Annotation text is now optional. Empty / null means a colour-only
        // highlight (no popover surfaces over the passage).
        annotation: z
          .string()
          .max(ANNOTATION_TEXT_MAX_LENGTH)
          .nullable()
          .optional(),
        color: z.enum(annotationColors).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const hasLesson = !!input.lessonId;
      const hasResource = !!input.resourceId;
      if (hasLesson === hasResource) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Provide exactly one of lessonId or resourceId',
        });
      }

      let lessonId: string | null = null;
      let resourceId: string | null = null;
      let curriculumId: string | null = null;
      let surfaceTitle: string;
      let surfaceKindLabel: string;

      if (hasLesson) {
        const lesson = await prisma.lesson.findFirst({
          where: {
            id: input.lessonId!,
            module: { curriculum: { userId: ctx.userId } },
          },
          select: {
            id: true,
            title: true,
            module: { select: { curriculumId: true } },
          },
        });
        if (!lesson) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Lesson not found' });
        }
        lessonId = lesson.id;
        curriculumId = lesson.module.curriculumId;
        surfaceTitle = lesson.title;
        surfaceKindLabel = 'lesson';
      } else {
        const resource = await prisma.resource.findFirst({
          where: { id: input.resourceId!, userId: ctx.userId },
          select: { id: true, title: true },
        });
        if (!resource) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Resource not found' });
        }
        resourceId = resource.id;
        surfaceTitle = resource.title;
        surfaceKindLabel = 'resource';
      }

      // Find or create the user's auto-managed annotation note for this
      // surface (one per (user, lesson) or (user, resource)). Re-using one
      // row keeps the user's notes page tidy and lets hover-card lookups
      // join annotations → note in a single query.
      const existing = await prisma.note.findFirst({
        where: {
          userId: ctx.userId,
          isAnnotation: true,
          ...(lessonId ? { lessonId } : { lessonId: null }),
          ...(resourceId ? { resourceId } : { resourceId: null }),
        },
        select: { id: true },
      });
      let noteId = existing?.id;
      if (!noteId) {
        const created = await prisma.note.create({
          data: {
            id: crypto.randomUUID(),
            userId: ctx.userId,
            lessonId,
            curriculumId,
            resourceId,
            isAnnotation: true,
            title: `Annotations · ${surfaceTitle}`,
            description: `Highlights and commentary you saved while working through this ${surfaceKindLabel}.`,
            content: '',
          },
          select: { id: true },
        });
        noteId = created.id;
      }

      const trimmedAnnotation = input.annotation?.trim() ?? '';
      const annotation = await prisma.annotation.create({
        data: {
          id: crypto.randomUUID(),
          userId: ctx.userId,
          lessonId,
          resourceId,
          noteId,
          quote: input.quote,
          annotation: trimmedAnnotation.length > 0 ? trimmedAnnotation : null,
          color: input.color ?? 'YELLOW',
        },
      });

      await rebuildAnnotationNoteContent(noteId);
      return { annotationId: annotation.id, noteId };
    }),
  updateAnnotation: activeUserProcedure
    .input(
      z.object({
        id: z.string(),
        // Optional updates — at least one must be provided. Pass `null` for
        // annotation to clear it (turns a popover annotation back into a
        // colour-only highlight).
        annotation: z
          .string()
          .max(ANNOTATION_TEXT_MAX_LENGTH)
          .nullable()
          .optional(),
        color: z.enum(annotationColors).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.annotation === undefined && input.color === undefined) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Nothing to update',
        });
      }
      const existing = await prisma.annotation.findFirst({
        where: { id: input.id, userId: ctx.userId },
        select: { id: true, noteId: true },
      });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Annotation not found' });
      }
      const trimmed = input.annotation?.trim();
      await prisma.annotation.update({
        where: { id: existing.id },
        data: {
          ...(input.annotation !== undefined
            ? { annotation: trimmed && trimmed.length > 0 ? trimmed : null }
            : {}),
          ...(input.color !== undefined ? { color: input.color } : {}),
        },
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
          resourceId: z.string().optional(),
          scope: z
            .enum(['all', 'user', 'curriculum', 'lesson', 'resource'])
            .optional(),
          tag: z.string().max(NOTE_TAG_MAX_LENGTH).optional(),
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
      } else if (input?.resourceId) {
        where.resourceId = input.resourceId;
      } else if (input?.curriculumId) {
        where.OR = [
          { curriculumId: input.curriculumId },
          { lesson: { module: { curriculumId: input.curriculumId } } },
        ];
      } else if (input?.scope === 'user') {
        where.lessonId = null;
        where.curriculumId = null;
        where.resourceId = null;
      } else if (input?.scope === 'resource') {
        where.resourceId = { not: null };
      }
      if (input?.tag) {
        // Postgres array contains operator. We normalise the tag the same
        // way write paths do so a query for "AI" matches "ai".
        where.tags = { has: input.tag.trim().toLowerCase() };
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
          resource: { select: { id: true, title: true, kind: true } },
        },
      });
      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        content: row.content,
        tags: row.tags,
        isAnnotation: row.isAnnotation,
        lessonId: row.lessonId,
        curriculumId: row.curriculumId,
        resourceId: row.resourceId,
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
        resource: row.resource
          ? {
              id: row.resource.id,
              title: row.resource.title,
              kind: row.resource.kind,
            }
          : null,
      }));
    }),

  // ---------------------------------------------------------------------
  // Resources (learner-uploaded files + saved links)
  // ---------------------------------------------------------------------
  //
  // The Resource model is user-owned but can be attached to many curricula
  // and many lessons via explicit join tables. Linking a resource to a
  // lesson auto-links it to the lesson's curriculum as well so the
  // curriculum's Resources tab shows everything attached at either layer.

  listResources: protectedcProcedure
    .input(
      z
        .object({
          curriculumId: z.string().optional(),
          lessonId: z.string().optional(),
          // "filter" combines kind (LINK vs FILE) with file-type granularity.
          // The /resources page surfaces these as the visual filter chips.
          filter: z.enum(['LINK', 'PDF', 'TXT', 'MD']).optional(),
          search: z.string().max(120).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      type Where = NonNullable<
        NonNullable<Parameters<typeof prisma.resource.findMany>[0]>['where']
      >;
      const where: Where = { userId: ctx.userId };
      if (input?.filter === 'LINK') where.kind = 'LINK';
      else if (input?.filter === 'PDF') where.fileType = 'PDF';
      else if (input?.filter === 'TXT') where.fileType = 'TXT';
      else if (input?.filter === 'MD') where.fileType = 'MD';
      if (input?.curriculumId) {
        where.curriculumLinks = { some: { curriculumId: input.curriculumId } };
      } else if (input?.lessonId) {
        where.lessonLinks = { some: { lessonId: input.lessonId } };
      }
      if (input?.search?.trim()) {
        const q = input.search.trim();
        where.OR = [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { domain: { contains: q, mode: 'insensitive' } },
        ];
      }
      const rows = await prisma.resource.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          kind: true,
          title: true,
          description: true,
          url: true,
          domain: true,
          fileKey: true,
          fileType: true,
          fileSize: true,
          fileMimeType: true,
          fileName: true,
          status: true,
          statusMessage: true,
          extractedAt: true,
          createdAt: true,
          updatedAt: true,
          curriculumLinks: { select: { curriculumId: true } },
          lessonLinks: { select: { lessonId: true } },
        },
      });
      return rows.map((row) => ({
        ...row,
        curriculumIds: row.curriculumLinks.map((l) => l.curriculumId),
        lessonIds: row.lessonLinks.map((l) => l.lessonId),
      }));
    }),

  getResource: protectedcProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const row = await prisma.resource.findFirst({
        where: { id: input.id, userId: ctx.userId },
        include: {
          curriculumLinks: {
            include: { curriculum: { select: { id: true, title: true } } },
            orderBy: { createdAt: 'asc' },
          },
          lessonLinks: {
            include: {
              lesson: {
                select: {
                  id: true,
                  title: true,
                  module: { select: { curriculumId: true } },
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Resource not found' });
      }
      // Mint a short-lived signed GET URL for FILE resources so the viewer
      // can render the iframe / `<embed>` without exposing the bucket key.
      let signedFileUrl: string | null = null;
      if (row.kind === 'FILE' && row.fileKey && r2IsConfigured()) {
        try {
          signedFileUrl = await getSignedDownloadUrl({
            key: row.fileKey,
            filename: row.fileName ?? `${row.title}`,
            expiresInSeconds: 600,
          });
        } catch (err) {
          console.warn('Failed to mint R2 signed URL', { id: row.id, err });
        }
      }
      return {
        id: row.id,
        kind: row.kind,
        title: row.title,
        description: row.description,
        url: row.url,
        domain: row.domain,
        fileKey: row.fileKey,
        fileType: row.fileType,
        fileSize: row.fileSize,
        fileMimeType: row.fileMimeType,
        fileName: row.fileName,
        status: row.status,
        statusMessage: row.statusMessage,
        content: row.content,
        extractedAt: row.extractedAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        signedFileUrl,
        curricula: row.curriculumLinks.map((l) => ({
          id: l.curriculum.id,
          title: l.curriculum.title,
        })),
        lessons: row.lessonLinks.map((l) => ({
          id: l.lesson.id,
          title: l.lesson.title,
          curriculumId: l.lesson.module.curriculumId,
        })),
      };
    }),

  // Lightweight polling endpoint used by the resources list to refresh the
  // status of an in-flight upload / extraction without re-pulling the full
  // resource detail.
  getResourceStatus: protectedcProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const row = await prisma.resource.findFirst({
        where: { id: input.id, userId: ctx.userId },
        select: {
          id: true,
          status: true,
          statusMessage: true,
          extractedAt: true,
          updatedAt: true,
        },
      });
      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Resource not found' });
      }
      return row;
    }),

  createResourceLink: activeUserProcedure
    .input(
      z.object({
        url: urlInputSchema,
        title: z
          .string()
          .max(RESOURCE_TITLE_MAX_LENGTH)
          .optional(),
        description: z
          .string()
          .max(RESOURCE_DESCRIPTION_MAX_LENGTH)
          .optional(),
        scope: resourceScopeSchema,
        // When true, fetch + reader-mode extract the URL synchronously
        // before the row is committed; on any failure (blocked domain,
        // unreachable host, paywall, JS-only page, empty body) the
        // mutation throws and no Resource row is created. Used by the
        // curriculum-create flow so we never spend AI tokens on links we
        // couldn't actually read.
        requireExtraction: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Block social-media domains for every link, regardless of whether
      // extraction is required — even links the user is just saving to
      // their library shouldn't include sources we know we won't ingest.
      assertAllowedSourceUrl(input.url);
      const scope = await resolveResourceScope(ctx.userId, input.scope);
      const domain = safeHostname(input.url);
      const fallbackTitle = input.title?.trim() || domain || input.url;
      const id = crypto.randomUUID();
      // requireExtraction=true: run extraction first so we can short-circuit
      // before writing to Postgres. We only create the row if extraction
      // succeeds, so the user never ends up with an orphan "FAILED" resource
      // when their link is unreachable.
      let extractedTitle: string | null = null;
      let extractedContent: string | null = null;
      let extractedAt: Date | null = null;
      if (input.requireExtraction) {
        const extracted = await extractSourceContent(input.url);
        extractedContent = extracted.markdown.slice(0, 200_000);
        extractedAt = new Date();
        if (!input.title?.trim()) extractedTitle = extracted.title;
      }
      const finalTitle = (extractedTitle ?? fallbackTitle).slice(
        0,
        RESOURCE_TITLE_MAX_LENGTH,
      );
      const resource = await prisma.resource.create({
        data: {
          id,
          userId: ctx.userId,
          kind: 'LINK',
          title: finalTitle,
          description: input.description?.trim() || null,
          url: input.url,
          domain,
          content: extractedContent,
          extractedAt,
          // Links are immediately READY: either because we just extracted
          // them above (requireExtraction=true), or because the viewer
          // triggers extraction lazily on first open (legacy path).
          status: 'READY',
        },
      });
      await applyResourceScope(resource.id, scope);
      return { id: resource.id };
    }),

  createResourceFile: activeUserProcedure
    .input(
      z.object({
        title: z.string().max(RESOURCE_TITLE_MAX_LENGTH).optional(),
        description: z
          .string()
          .max(RESOURCE_DESCRIPTION_MAX_LENGTH)
          .optional(),
        fileName: z.string().min(1).max(200),
        fileType: z.enum(resourceFileTypes),
        fileSize: z
          .number()
          .int()
          .positive()
          .max(RESOURCE_FILE_MAX_BYTES, 'File is too large'),
        fileMimeType: z.string().min(1).max(120),
        scope: resourceScopeSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!r2IsConfigured()) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message:
            'R2 storage is not configured on the server. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET to enable uploads.',
        });
      }
      const acceptedMime = resourceMimeTypes[input.fileType];
      if (!acceptedMime.includes(input.fileMimeType)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `MIME type "${input.fileMimeType}" is not accepted for ${input.fileType} uploads.`,
        });
      }
      const scope = await resolveResourceScope(ctx.userId, input.scope);
      const id = crypto.randomUUID();
      const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const extByType: Record<typeof input.fileType, string> = {
        TXT: 'txt',
        PDF: 'pdf',
        MD: 'md',
      };
      const ext = extByType[input.fileType];
      const fileKey = `users/${ctx.userId}/resources/${id}.${ext}`;

      const resource = await prisma.resource.create({
        data: {
          id,
          userId: ctx.userId,
          kind: 'FILE',
          title:
            input.title?.trim() ||
            input.fileName
              .replace(/\.[^.]+$/, '')
              .slice(0, RESOURCE_TITLE_MAX_LENGTH),
          description: input.description?.trim() || null,
          fileKey,
          fileType: input.fileType,
          fileSize: input.fileSize,
          fileMimeType: input.fileMimeType,
          fileName: safeName.slice(0, 200),
          status: 'PENDING',
        },
      });
      await applyResourceScope(resource.id, scope);

      const uploadUrl = await getSignedUploadUrl({
        key: fileKey,
        contentType: input.fileMimeType,
        contentLength: input.fileSize,
        expiresInSeconds: 300,
      });
      // R2 signs Content-Type into the canonical request, so the browser
      // MUST PUT with exactly the same value or the signature won't match
      // and R2 returns 403. We pass it back so the client can't drift.
      return {
        id: resource.id,
        uploadUrl,
        uploadHeaders: {
          'Content-Type': input.fileMimeType,
        } as Record<string, string>,
      };
    }),

  confirmResourceUpload: activeUserProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const resource = await prisma.resource.findFirst({
        where: { id: input.id, userId: ctx.userId, kind: 'FILE' },
        select: { id: true, fileKey: true, fileType: true, fileSize: true },
      });
      if (!resource || !resource.fileKey) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Resource not found' });
      }
      const head = await headObject(resource.fileKey);
      if (!head.exists) {
        await prisma.resource.update({
          where: { id: resource.id },
          data: {
            status: 'FAILED',
            statusMessage: 'Upload did not arrive at R2 before confirmation.',
          },
        });
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Upload did not arrive at R2 — please try again.',
        });
      }
      // Eagerly produce the reader-mode body so the viewer can render +
      // annotate without a per-view R2 round trip:
      //   - TXT / MD: read the raw bytes as UTF-8 (effectively free).
      //   - PDF: read the bytes and run pdf.js text extraction, which
      //     synthesises a "## Page N" markdown skeleton. This typically
      //     adds a few hundred ms for a small doc, more for big ones —
      //     well inside the time the user is already waiting on the
      //     confirm round trip.
      // Failures here are non-fatal: the row still flips to READY and the
      // viewer's `extractResourceFile` mutation can be retried later.
      let content: string | null = null;
      let statusMessage: string | null = null;
      if (resource.fileType === 'TXT' || resource.fileType === 'MD') {
        try {
          const body = await getObjectText(resource.fileKey);
          content = body.slice(0, 200_000);
        } catch (err) {
          console.warn('Failed to read uploaded text body from R2', err);
          statusMessage = 'We saved the file but couldn’t cache its text body — try Re-extract from the viewer.';
        }
      } else if (resource.fileType === 'PDF') {
        try {
          const bytes = await getObjectBytes(resource.fileKey);
          if (bytes) {
            const parsed = await extractPdfText(bytes);
            content = parsed.markdown || null;
            if (parsed.isImageOnly) {
              statusMessage =
                'This PDF appears to be image-only (no embedded text). Reader mode will be empty until OCR support lands.';
            }
          }
        } catch (err) {
          console.warn('Failed to extract PDF text from R2', err);
          statusMessage =
            'We saved the PDF but couldn’t extract its text — Reader mode will be empty until you Re-extract.';
        }
      }
      await prisma.resource.update({
        where: { id: resource.id },
        data: {
          status: 'READY',
          statusMessage,
          content,
          extractedAt: content ? new Date() : null,
        },
      });
      return { ok: true };
    }),

  // Re-run reader-mode extraction for an already-uploaded FILE resource.
  // Used by the viewer's "Re-extract" button and by the auto-extract effect
  // when a PDF/TXT/MD lacks cached content (most commonly: a PDF that was
  // uploaded before this extractor existed, or one where the extraction
  // step transiently failed during confirmResourceUpload).
  extractResourceFile: activeUserProcedure
    .input(z.object({ id: z.string(), force: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const resource = await prisma.resource.findFirst({
        where: { id: input.id, userId: ctx.userId, kind: 'FILE' },
        select: {
          id: true,
          fileKey: true,
          fileType: true,
          content: true,
          extractedAt: true,
        },
      });
      if (!resource || !resource.fileKey || !resource.fileType) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Resource not found' });
      }
      if (
        !input.force &&
        resource.content &&
        resource.content.trim().length > 0 &&
        resource.extractedAt
      ) {
        return {
          ok: true as const,
          cached: true as const,
          extractedAt: resource.extractedAt,
        };
      }
      if (!r2IsConfigured()) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'R2 storage is not configured on the server.',
        });
      }

      try {
        let content: string | null = null;
        let isImageOnly = false;
        if (resource.fileType === 'TXT' || resource.fileType === 'MD') {
          const body = await getObjectText(resource.fileKey);
          content = body.slice(0, 200_000) || null;
        } else if (resource.fileType === 'PDF') {
          const bytes = await getObjectBytes(resource.fileKey);
          if (!bytes) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'The PDF is missing from storage.',
            });
          }
          const parsed = await extractPdfText(bytes);
          content = parsed.markdown || null;
          isImageOnly = parsed.isImageOnly;
        } else {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Reader-mode extraction isn’t supported for ${resource.fileType} files.`,
          });
        }

        await prisma.resource.update({
          where: { id: resource.id },
          data: {
            content,
            extractedAt: content ? new Date() : null,
            statusMessage: isImageOnly
              ? 'This PDF appears to be image-only (no embedded text).'
              : null,
          },
        });

        if (!content) {
          throw new TRPCError({
            code: 'UNPROCESSABLE_CONTENT',
            message: isImageOnly
              ? 'This PDF has no embedded text — only scanned images. OCR isn’t supported yet.'
              : 'No readable text could be extracted from this file.',
          });
        }

        return {
          ok: true as const,
          cached: false as const,
          extractedAt: new Date(),
          isImageOnly,
        };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        const message =
          err instanceof Error ? err.message : 'Extraction failed';
        await prisma.resource.update({
          where: { id: resource.id },
          data: { statusMessage: message.slice(0, 500) },
        });
        throw new TRPCError({ code: 'BAD_GATEWAY', message });
      }
    }),

  // Reader-mode extraction for LINK resources. Caches the result so
  // subsequent loads skip the (potentially slow) fetch+parse round trip.
  // Mutation rather than query so the client can call it imperatively from
  // a "Re-extract" button.
  extractResourceLink: activeUserProcedure
    .input(z.object({ id: z.string(), force: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const resource = await prisma.resource.findFirst({
        where: { id: input.id, userId: ctx.userId, kind: 'LINK' },
        select: { id: true, url: true, content: true, extractedAt: true },
      });
      if (!resource || !resource.url) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Resource not found' });
      }
      if (!input.force && resource.content && resource.extractedAt) {
        return {
          ok: true as const,
          cached: true as const,
          extractedAt: resource.extractedAt,
        };
      }
      try {
        const article = await extractArticle(resource.url);
        await prisma.resource.update({
          where: { id: resource.id },
          data: {
            // Use the extracted title only when the user didn't pick a
            // custom one (otherwise we'd silently overwrite their label).
            content: article.markdown.slice(0, 200_000),
            extractedAt: new Date(),
            // Surface byline/excerpt back into the description for cards
            // when the user didn't write their own.
            description: undefined,
            status: 'READY',
            statusMessage: null,
          },
        });
        return {
          ok: true as const,
          cached: false as const,
          extractedAt: new Date(),
          title: article.title,
          siteName: article.siteName,
          wordCount: article.wordCount,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Extraction failed';
        await prisma.resource.update({
          where: { id: resource.id },
          data: {
            statusMessage: message.slice(0, 500),
          },
        });
        throw new TRPCError({ code: 'BAD_GATEWAY', message });
      }
    }),

  updateResource: protectedcProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).max(RESOURCE_TITLE_MAX_LENGTH).optional(),
        description: z
          .string()
          .max(RESOURCE_DESCRIPTION_MAX_LENGTH)
          .nullable()
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await prisma.resource.updateMany({
        where: { id: input.id, userId: ctx.userId },
        data: {
          ...(input.title !== undefined ? { title: input.title.trim() } : {}),
          ...(input.description !== undefined
            ? { description: input.description?.trim() || null }
            : {}),
        },
      });
      if (result.count === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Resource not found' });
      }
      return { ok: true };
    }),

  linkResource: activeUserProcedure
    .input(
      z.object({
        id: z.string(),
        curriculumId: z.string().optional(),
        lessonId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const resource = await prisma.resource.findFirst({
        where: { id: input.id, userId: ctx.userId },
        select: { id: true },
      });
      if (!resource) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Resource not found' });
      }
      const scope = await resolveResourceScope(ctx.userId, {
        curriculumId: input.curriculumId,
        lessonId: input.lessonId,
      });
      await applyResourceScope(resource.id, scope);
      return { ok: true };
    }),

  unlinkResource: activeUserProcedure
    .input(
      z.object({
        id: z.string(),
        curriculumId: z.string().optional(),
        lessonId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const resource = await prisma.resource.findFirst({
        where: { id: input.id, userId: ctx.userId },
        select: { id: true },
      });
      if (!resource) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Resource not found' });
      }
      if (input.curriculumId) {
        await prisma.resourceCurriculum.deleteMany({
          where: { resourceId: resource.id, curriculumId: input.curriculumId },
        });
      }
      if (input.lessonId) {
        await prisma.resourceLesson.deleteMany({
          where: { resourceId: resource.id, lessonId: input.lessonId },
        });
      }
      return { ok: true };
    }),

  deleteResource: activeUserProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const resource = await prisma.resource.findFirst({
        where: { id: input.id, userId: ctx.userId },
        select: { id: true, kind: true, fileKey: true },
      });
      if (!resource) return { deleted: 0 };
      // Best-effort R2 cleanup; ignore failures so a broken R2 doesn't
      // leave the DB row stranded.
      if (resource.kind === 'FILE' && resource.fileKey && r2IsConfigured()) {
        try {
          await r2DeleteObject(resource.fileKey);
        } catch (err) {
          console.warn('Failed to delete R2 object on resource delete', err);
        }
      }
      const result = await prisma.resource.deleteMany({
        where: { id: resource.id, userId: ctx.userId },
      });
      return { deleted: result.count };
    }),

  // ---------------------------------------------------------------------
  // Generated audio library + playback queue
  // ---------------------------------------------------------------------
  //
  // The audio bar reads from these procedures to populate its library
  // dropdown and the user's playback queue. Generation itself doesn't go
  // through tRPC — the `/api/tts` route handler returns the audio
  // metadata directly so the player can start playback before the next
  // queryClient.invalidateQueries() round-trip completes.
  listGeneratedAudios: protectedcProcedure.query(async ({ ctx }) => {
    return prisma.generatedAudio.findMany({
      where: { userId: ctx.userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        section: true,
        sourceKind: true,
        lessonId: true,
        curriculumId: true,
        resourceId: true,
        audioBytes: true,
        durationSeconds: true,
        characterCount: true,
        truncated: true,
        voice: true,
        createdAt: true,
      },
    });
  }),

  deleteGeneratedAudio: activeUserProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const audio = await prisma.generatedAudio.findFirst({
        where: { id: input.id, userId: ctx.userId },
        select: { id: true, audioKey: true },
      });
      if (!audio) return { deleted: 0 };
      // Best-effort R2 cleanup; never block the DB delete on a 404 in
      // storage (the row is still authoritative for the UI).
      if (audio.audioKey && r2IsConfigured()) {
        try {
          await r2DeleteObject(audio.audioKey);
        } catch (err) {
          console.warn('Failed to delete R2 audio object', err);
        }
      }
      const result = await prisma.generatedAudio.deleteMany({
        where: { id: audio.id, userId: ctx.userId },
      });
      return { deleted: result.count };
    }),

  // Single user-scoped queue. We return the joined audio rows in
  // playback order so the bar's "Up next" view doesn't need a second
  // round-trip per item.
  getAudioPlaylist: protectedcProcedure.query(async ({ ctx }) => {
    const items = await prisma.audioPlaylistItem.findMany({
      where: { userId: ctx.userId },
      orderBy: { position: 'asc' },
      include: {
        audio: {
          select: {
            id: true,
            title: true,
            section: true,
            sourceKind: true,
            lessonId: true,
            curriculumId: true,
            resourceId: true,
            audioBytes: true,
            durationSeconds: true,
            characterCount: true,
            truncated: true,
            voice: true,
            createdAt: true,
          },
        },
      },
    });
    return items.map((item) => ({
      id: item.id,
      position: item.position,
      audio: item.audio,
    }));
  }),

  addToAudioPlaylist: activeUserProcedure
    .input(z.object({ audioId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Defensive ownership check before we touch the queue.
      const audio = await prisma.generatedAudio.findFirst({
        where: { id: input.audioId, userId: ctx.userId },
        select: { id: true },
      });
      if (!audio) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Audio not found',
        });
      }
      // Idempotent: re-adding an audio just no-ops because of the unique
      // index on (userId, audioId). We compute the next position
      // outside of an INSERT-ON-CONFLICT because Prisma's `upsert` can't
      // skip a partial update cleanly.
      const existing = await prisma.audioPlaylistItem.findUnique({
        where: {
          userId_audioId: { userId: ctx.userId, audioId: audio.id },
        },
        select: { id: true, position: true },
      });
      if (existing) {
        return { id: existing.id, position: existing.position };
      }
      const last = await prisma.audioPlaylistItem.findFirst({
        where: { userId: ctx.userId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      const nextPos = (last?.position ?? -1) + 1;
      const created = await prisma.audioPlaylistItem.create({
        data: {
          id: crypto.randomUUID(),
          userId: ctx.userId,
          audioId: audio.id,
          position: nextPos,
        },
        select: { id: true, position: true },
      });
      return created;
    }),

  removeFromAudioPlaylist: activeUserProcedure
    .input(z.object({ audioId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Use a transaction so the "delete + re-pack positions" step is
      // atomic — otherwise an interleaved add/remove can create gaps
      // that we'd then read past in the player.
      await prisma.$transaction(async (tx) => {
        await tx.audioPlaylistItem.deleteMany({
          where: { userId: ctx.userId, audioId: input.audioId },
        });
        const remaining = await tx.audioPlaylistItem.findMany({
          where: { userId: ctx.userId },
          orderBy: { position: 'asc' },
          select: { id: true, position: true },
        });
        await Promise.all(
          remaining.map((row, index) =>
            row.position === index
              ? Promise.resolve()
              : tx.audioPlaylistItem.update({
                  where: { id: row.id },
                  data: { position: index },
                }),
          ),
        );
      });
      return { ok: true };
    }),

  reorderAudioPlaylist: activeUserProcedure
    .input(
      z.object({
        // Full ordered list of audio ids the client wants the queue to
        // be in. We accept the whole list (rather than a from/to index
        // pair) so the server stays the source of truth and the bar's
        // optimistic reorder ends up converging.
        audioIds: z.array(z.string()).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await prisma.$transaction(async (tx) => {
        const owned = await tx.audioPlaylistItem.findMany({
          where: { userId: ctx.userId },
          select: { audioId: true },
        });
        const ownedSet = new Set(owned.map((row) => row.audioId));
        // Drop ids the client shouldn't have known about — never trust
        // the order list beyond the user's actual queue contents.
        const dedup = new Set<string>();
        const next: string[] = [];
        for (const id of input.audioIds) {
          if (!ownedSet.has(id)) continue;
          if (dedup.has(id)) continue;
          dedup.add(id);
          next.push(id);
        }
        // Anything in the queue but missing from the new list keeps its
        // relative order at the tail. Belt-and-braces against the
        // client sending a stale list during an in-flight add.
        for (const id of ownedSet) {
          if (!dedup.has(id)) next.push(id);
        }
        await Promise.all(
          next.map((audioId, index) =>
            tx.audioPlaylistItem.update({
              where: {
                userId_audioId: { userId: ctx.userId, audioId },
              },
              data: { position: index },
            }),
          ),
        );
      });
      return { ok: true };
    }),

  clearAudioPlaylist: activeUserProcedure.mutation(async ({ ctx }) => {
    await prisma.audioPlaylistItem.deleteMany({
      where: { userId: ctx.userId },
    });
    return { ok: true };
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
    // Anchor "today" to the learner's timezone so a user in Tokyo can check
    // in starting at local midnight, not whenever UTC midnight happens to be.
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { timezone: true },
    });
    const today = startOfDayInTimezone(new Date(), user?.timezone ?? 'UTC');

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
    const [user, checkIns] = await Promise.all([
      prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { timezone: true },
      }),
      prisma.checkIn.findMany({
        where: { userId: ctx.userId },
        orderBy: { date: 'desc' },
        take: 365,
        select: { date: true },
      }),
    ]);
    // Anchor each row to noon UTC of the user's local calendar day so "today"
    // / "yesterday" comparisons line up with the timezone the user lives in.
    const tz = user?.timezone ?? 'UTC';
    const summary = computeStreak(
      checkIns.map((c) => normalizeDateFromDb(c.date)),
      startOfDayInTimezone(new Date(), tz),
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
        timezone: true,
        themeMode: true,
        subscriptionPlan: true,
        subscriptionInterval: true,
        earnedTitles: true,
        selectedTitle: true,
      },
    });
    if (!user) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
    }
    return user;
  }),
  getAlphaUsage: protectedcProcedure.query(async ({ ctx }) => {
    return await getPlanUsage(ctx.userId);
  }),

  // ---------------------------------------------------------------------
  // Subscription + scholarly titles
  // ---------------------------------------------------------------------
  // Surface the user's effective plan + the catalogue of plans the
  // settings page renders into upgrade cards. The catalogue is static
  // (sourced from `lib/subscription/plans.ts`) but lives in the procedure
  // so the client doesn't have to import server-only code to render it.
  getSubscription: protectedcProcedure.query(async ({ ctx }) => {
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: {
        isAlpha: true,
        subscriptionPlan: true,
        subscriptionInterval: true,
        polarCustomerId: true,
      },
    });
    const plan: EffectivePlan = resolveEffectivePlan({
      subscriptionPlan: user?.subscriptionPlan ?? null,
      isAlpha: user?.isAlpha ?? false,
    });
    return {
      plan,
      paidPlan:
        user?.subscriptionPlan === 'EXPLORER' ||
        user?.subscriptionPlan === 'SCHOLAR'
          ? user.subscriptionPlan
          : null,
      interval:
        user?.subscriptionInterval === 'MONTH' ||
        user?.subscriptionInterval === 'YEAR'
          ? user.subscriptionInterval
          : null,
      isAlpha: user?.isAlpha ?? false,
      polarCustomerId: user?.polarCustomerId ?? null,
      catalogue: PLAN_KEYS.map((key) => {
        const def = PLANS[key];
        return {
          key: def.key,
          label: def.label,
          tagline: def.tagline,
          features: def.features,
          bestFor: def.bestFor,
          foundingTitleSlug: def.foundingTitleSlug,
          pricing: BILLING_INTERVALS.reduce(
            (acc, interval) => {
              const product = def.pricing[interval];
              acc[interval] = {
                slug: product.slug,
                priceUsd: product.priceUsd,
              };
              return acc;
            },
            {} as Record<
              (typeof BILLING_INTERVALS)[number],
              { slug: string; priceUsd: number }
            >,
          ),
        };
      }),
    };
  }),
  // Catalogue of every title (earned or not). The client uses this to
  // render the title-picker dropdown with availability hints. Locked rows
  // tell the user *how* to earn the title so the gamification stays
  // discoverable without a separate "rewards" page.
  listTitles: protectedcProcedure.query(async ({ ctx }) => {
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { earnedTitles: true, selectedTitle: true },
    });
    const earned = new Set<string>(user?.earnedTitles ?? []);
    const now = new Date();
    return {
      selected: user?.selectedTitle ?? null,
      titles: TITLE_SLUGS.map((slug) => {
        const def = TITLES[slug];
        const isEarned = earned.has(slug);
        return {
          slug: def.slug,
          label: def.label,
          description: def.description,
          requiresPlan: def.requiresPlan,
          availableUntil: def.availableUntil,
          isEarned,
          // `isGrantable` answers "can this still be obtained today?". An
          // already-earned title is always grantable from the user's
          // perspective; a future-only title is grantable until the cutoff.
          isGrantable: isEarned || isTitleGrantable(slug, now),
        };
      }),
    };
  }),
  setSelectedTitle: activeUserProcedure
    .input(
      z.object({
        // `null` clears the displayed title (back to plain first-name).
        slug: z.string().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.slug !== null) {
        if (!isTitleSlug(input.slug)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Unknown title.',
          });
        }
        const user = await prisma.user.findUnique({
          where: { id: ctx.userId },
          select: { earnedTitles: true },
        });
        if (!user?.earnedTitles?.includes(input.slug)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You have not earned that title yet.',
          });
        }
      }
      await prisma.user.update({
        where: { id: ctx.userId },
        data: { selectedTitle: input.slug },
      });
      return {
        ok: true,
        selectedTitle: input.slug,
        selectedLabel: input.slug ? titleLabel(input.slug) : null,
      };
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
  // Dedicated mutation so the timezone picker in Settings can save without
  // dragging the profile form's validation along. Validated against the
  // runtime's IANA list to keep junk values out of the column.
  updateTimezone: activeUserProcedure
    .input(
      z.object({
        timezone: z
          .string()
          .min(1, 'Timezone is required')
          .max(64, 'Timezone is too long')
          .refine(
            (v) => {
              try {
                // Throws on invalid IANA names; cheap on valid ones.
                new Intl.DateTimeFormat('en-US', { timeZone: v });
                return true;
              } catch {
                return false;
              }
            },
            { message: 'Pick a valid timezone' },
          ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updated = await prisma.user.update({
        where: { id: ctx.userId },
        data: { timezone: input.timezone },
        select: { id: true, timezone: true },
      });
      return updated;
    }),
  // Cross-device appearance preference. The next-themes client wrapper
  // still owns the live `.dark` class on <html> for instant feedback;
  // this mutation persists the choice so a second browser/device boots
  // into the same theme on next login.
  updateThemeMode: activeUserProcedure
    .input(
      z.object({
        themeMode: z.enum(['LIGHT', 'DARK', 'SYSTEM']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updated = await prisma.user.update({
        where: { id: ctx.userId },
        data: { themeMode: input.themeMode },
        select: { id: true, themeMode: true },
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
// in chronological order. Each annotation renders as `> quote` followed by
// the user's commentary (when present). Colour-only highlights — annotations
// with no commentary — still appear in the auto-note as a quote-only block
// so the user has a reading log of every passage they marked up.
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
    const commentary = a.annotation?.trim();
    return commentary ? `${quoted}\n\n${commentary}` : quoted;
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

// Resolve a resource scope hint (curriculumId / lessonId) to a verified pair
// that the caller actually owns. Linking via a lesson auto-pins the lesson's
// curriculum too so the curriculum-level Resources tab picks the resource
// up without the user having to attach it twice.
async function resolveResourceScope(
  userId: string,
  scope: { curriculumId?: string; lessonId?: string } | undefined,
): Promise<{ curriculumIds: string[]; lessonIds: string[] }> {
  if (!scope) return { curriculumIds: [], lessonIds: [] };
  const curriculumIds = new Set<string>();
  const lessonIds = new Set<string>();
  if (scope.lessonId) {
    const lesson = await prisma.lesson.findFirst({
      where: {
        id: scope.lessonId,
        module: { curriculum: { userId } },
      },
      select: { id: true, module: { select: { curriculumId: true } } },
    });
    if (!lesson) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Lesson not found' });
    }
    lessonIds.add(lesson.id);
    curriculumIds.add(lesson.module.curriculumId);
  }
  if (scope.curriculumId) {
    const curriculum = await prisma.curriculum.findFirst({
      where: { id: scope.curriculumId, userId },
      select: { id: true },
    });
    if (!curriculum) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Curriculum not found' });
    }
    curriculumIds.add(curriculum.id);
  }
  return {
    curriculumIds: Array.from(curriculumIds),
    lessonIds: Array.from(lessonIds),
  };
}

// Idempotent insert into the resource ↔ curriculum / ↔ lesson join tables.
// We use createMany with skipDuplicates so re-pinning a resource from the
// same surface (e.g. "Add resource" on a lesson the user already has it on)
// is a no-op rather than an error.
async function applyResourceScope(
  resourceId: string,
  scope: { curriculumIds: string[]; lessonIds: string[] },
): Promise<void> {
  if (scope.curriculumIds.length > 0) {
    await prisma.resourceCurriculum.createMany({
      data: scope.curriculumIds.map((curriculumId) => ({
        id: crypto.randomUUID(),
        resourceId,
        curriculumId,
      })),
      skipDuplicates: true,
    });
  }
  if (scope.lessonIds.length > 0) {
    await prisma.resourceLesson.createMany({
      data: scope.lessonIds.map((lessonId) => ({
        id: crypto.randomUUID(),
        resourceId,
        lessonId,
      })),
      skipDuplicates: true,
    });
  }
}
