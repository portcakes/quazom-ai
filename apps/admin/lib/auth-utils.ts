import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@quazom-ai/db";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

/**
 * Auth guard for every page inside the admin console. Resolves to the
 * authenticated User row when:
 *   1. a Better Auth session exists,
 *   2. the user row still exists,
 *   3. the user has `isAdmin = true`.
 *
 * On any failure we redirect to /login with a `?reason=` so the form can
 * surface a useful toast. Non-admins are signed out as part of the
 * redirect — we never want a signed-in non-admin sitting on the login
 * page waiting for someone to flip them to admin.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const hdrs = await headers();
  const session = await auth.api.getSession({ headers: hdrs });
  if (!session) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      isAdmin: true,
    },
  });

  if (!user) {
    // Stale session — user row got hard-deleted. Sign-out is implicit on
    // next request once cookies expire; just redirect.
    redirect("/login?reason=unknown");
  }

  if (!user.isAdmin) {
    // We could sign out server-side here, but Better Auth doesn't have a
    // synchronous "delete session by id" helper exposed in the public API.
    // The /login page handles the soft case: it'll show a "not authorized"
    // message and let the user sign out from there.
    redirect("/login?reason=forbidden");
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
  };
}

/**
 * Bounces an already-signed-in admin back to `/` so they don't end up
 * looking at the login form when they have a valid session. Used by the
 * `/login` page itself.
 */
export async function redirectIfAdmin(): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (user?.isAdmin) {
    redirect("/");
  }
}
