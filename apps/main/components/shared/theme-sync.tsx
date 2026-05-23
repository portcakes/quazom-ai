"use client";

import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { useTRPC } from "@/trpc/client";

/**
 * Pulls the authenticated user's persisted `themeMode` from `getProfile`
 * and pushes it into next-themes exactly once per app boot, so a user
 * who flipped to DARK on machine A picks up DARK when they sign into
 * machine B.
 *
 * Runs as a side-effect-only client component (returns null). Mounted
 * inside `<NavWrapper>` so it only fires for authenticated routes.
 *
 * We deliberately don't auto-sync in the reverse direction: the
 * <ThemePicker> writes both to next-themes and to the server in the same
 * onChange handler, so we never need to detect "next-themes changed,
 * upload to server" here.
 */
export function ThemeSync() {
  const trpc = useTRPC();
  const { setTheme } = useTheme();
  const profileQuery = useQuery(trpc.getProfile.queryOptions());
  // `useRef` guard so a re-render that re-runs this body during the
  // *same* boot doesn't keep forcing the theme — once we've pushed the
  // server value into next-themes, the picker is in charge.
  const appliedRef = useRef(false);

  if (!appliedRef.current && profileQuery.data?.themeMode) {
    appliedRef.current = true;
    // DB enum is upper-case (DARK/LIGHT/SYSTEM); next-themes wants the
    // lower-case form.
    setTheme(profileQuery.data.themeMode.toLowerCase());
  }

  return null;
}
