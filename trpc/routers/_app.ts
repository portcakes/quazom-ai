import { z } from 'zod';
import { baseProcedure, createTRPCRouter, protectedcProcedure } from '../init';
import { inngest } from '@/inngest/client';
import { userChannel } from '@/inngest/channels';
import { getSubscriptionToken } from 'inngest/realtime';

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
        subject: z.string(),
        level: z.string(),
        goal: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return await inngest.send({
        name: 'app/curriculum.created',
        data: {
          userId: ctx.userId,
          subject: input.subject,
          level: input.level,
          goal: input.goal,
        },
      });
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
