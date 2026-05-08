import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";

/**
 * Standard auth guard for app routes. Returns the active session, redirecting
 * to /login if there is none and to /account-disabled if the user has soft-
 * disabled their account. Use this for everything except the disabled page
 * itself (which uses {@link requireSession}).
 */
export const requireAuth = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    redirect("/login");
  }
  // Disabled users keep a valid session so they can re-enable, but every
  // other in-app route bounces them to the disabled landing page.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isDisabled: true },
  });
  if (user?.isDisabled) {
    redirect("/account-disabled");
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

export const requireGuest = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (session) {
    redirect("/");
  }
  return session;
};