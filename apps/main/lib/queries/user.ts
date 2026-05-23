import "server-only";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@quazom-ai/db";
import type { ThemeMode } from "@quazom-ai/db/enums";
import { titleLabel } from "@/lib/subscription/titles";

export type CurrentUser = {
  id: string;
  firstName: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  isAlpha: boolean;
  isDisabled: boolean;
  timezone: string;
  /**
   * Cross-device appearance preference. The next-themes client wrapper
   * owns the live `.dark` class; this value is the DB-backed source of
   * truth pushed into next-themes on app boot.
   */
  themeMode: ThemeMode;
  /**
   * The user's currently displayed scholarly title (e.g. "Founding Scholar"),
   * or `null` when nothing is selected. Surfaced beside the first name in
   * the sidebar.
   */
  selectedTitleLabel: string | null;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      isAlpha: true,
      isDisabled: true,
      timezone: true,
      themeMode: true,
      selectedTitle: true,
    },
  });
  if (!user) return null;

  const fullName = user.name ?? "No name";
  const firstName = fullName.split(" ")[0] ?? "No name";
  return {
    id: user.id,
    firstName,
    fullName,
    email: user.email,
    avatarUrl: user.image,
    isAlpha: user.isAlpha,
    isDisabled: user.isDisabled,
    timezone: user.timezone,
    themeMode: user.themeMode,
    selectedTitleLabel: titleLabel(user.selectedTitle),
  };
}