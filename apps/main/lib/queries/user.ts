import "server-only";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";

export type CurrentUser = {
  id: string;
  firstName: string;
  fullName: string;
  avatarUrl: string | null;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, image: true },
  });
  if (!user) return null;

  const fullName = user.name ?? "No name";
  const firstName = fullName.split(" ")[0] ?? "No name";
  return {
    id: user.id,
    firstName,
    fullName,
    avatarUrl: user.image,
  };
}