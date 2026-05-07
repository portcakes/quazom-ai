import { z } from 'zod';
import { baseProcedure, createTRPCRouter, protectedcProcedure } from '../init';
import { inngest } from '@/inngest/client';
import { userChannel } from '@/inngest/channels';
import { getSubscriptionToken } from 'inngest/realtime';
import prisma from '@/lib/db';

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
      // updateMany with the userId guard — a row not owned by this user
      // becomes a 0-row noop instead of throwing, so we don't leak existence.
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
  realtimeToken: protectedcProcedure.query(async ({ ctx }) => {
    // Strip the channel/topics back out before serializing across the wire:
    // they contain Zod schema instances that don't survive JSON. The client
    // already knows the channel/topics from its own import of `userChannel`.
    const token = await getSubscriptionToken(inngest, {
      channel: userChannel(ctx.userId),
      topics: ['curriculumReady'],
    });
    return { key: token.key, apiBaseUrl: token.apiBaseUrl };
  }),
});

export type AppRouter = typeof appRouter;
