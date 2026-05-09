import { requireSession } from '@/lib/auth-utils';
import prisma from '@quazom-ai/db';
import { initTRPC, TRPCError } from '@trpc/server';
import { cache } from 'react';
 
export const createTRPCContext = cache(async () => {
  /**
   * @see: https://trpc.io/docs/server/context
   */
  return { userId: 'user_123' };
});
 
// Avoid exporting the entire t-object
// since it's not very descriptive.
// For instance, the use of a t variable
// is common in i18n libraries.
const t = initTRPC.create({
  /**
   * @see https://trpc.io/docs/server/data-transformers
   */
  // transformer: superjson,
});
 
// Base router and procedure helpers
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure;
// Authenticated procedure. Lets disabled users through so they can call the
// `enableAccount` mutation from the /account-disabled page; mutations that
// need an active account should layer the {@link activeUserProcedure} guard
// on top.
export const protectedcProcedure = t.procedure.use(async ({ ctx, next }) => {
  const session = await requireSession();
  return next({ ctx: { ...ctx, userId: session.user.id } });
});

// Same as `protectedcProcedure` but rejects disabled users with FORBIDDEN.
// Use for any mutation that touches user data outside of the
// re-enable / sign-out flow.
export const activeUserProcedure = protectedcProcedure.use(async ({ ctx, next }) => {
  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { isDisabled: true },
  });
  if (user?.isDisabled) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Account is disabled. Re-enable it from /account-disabled to continue.',
    });
  }
  return next({ ctx });
});