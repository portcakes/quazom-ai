import { z } from 'zod';
import { baseProcedure, createTRPCRouter, protectedcProcedure } from '../init';
import { inngest } from '@/inngest/client';
import prisma from '@/lib/db';
import { createCurriculum } from '@/inngest/functions';
 
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
      .input(z.object({
        subject: z.string(),
        level: z.string(),
        goal: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await inngest.send({
          name: "app/curriculum.created",
          data: {
            userId: ctx.userId,
            subject: input.subject,
            level: input.level,
            goal: input.goal,
          },
        });
      }),
});
 
// export type definition of API
export type AppRouter = typeof appRouter;