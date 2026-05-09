import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@quazom-ai/db";

/**
 * Standard auth guard for app routes. Returns the active session, redirecting
 * to:
 *   - /login if there is no session
 *   - /account-disabled if the user has soft-disabled their account
 *   - /onboarding if the user hasn't finished first-run onboarding yet
 *
 * Use this for everything except the disabled / onboarding pages themselves
 * (which use {@link requireSession} and {@link requireOnboardingSession}).
 */
export const requireAuth = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    redirect("/login");
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isDisabled: true, isOnboarded: true },
  });
  // Disabled users keep a valid session so they can re-enable.
  if (user?.isDisabled) {
    redirect("/account-disabled");
  }
  // First-run flow lives at /onboarding. We resolve disabled first so a
  // disabled, never-onboarded user still lands on /account-disabled.
  if (user && !user.isOnboarded) {
    redirect("/onboarding");
  }
  return session;
};

/**
 * Like {@link requireAuth} but does NOT redirect disabled users — used by the
 * /account-disabled page so the user can sign back in or re-enable.
 */
export const requireSession = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    redirect("/login");
  }
  return session;
};

/**
 * Auth guard for the /onboarding page itself. Allows non-onboarded users
 * through (they're the audience), but still bounces unauthenticated and
 * disabled users to the right place. If the user is already onboarded we
 * send them home — there's nothing to see here.
 */
export const requireOnboardingSession = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    redirect("/login");
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isDisabled: true, isOnboarded: true },
  });
  if (user?.isDisabled) {
    redirect("/account-disabled");
  }
  if (user?.isOnboarded) {
    redirect("/");
  }
  return session;
};

export const requireGuest = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (session) {
    redirect("/");
  }
  return session;
};