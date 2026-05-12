"use client";

import { useEffect } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Wraps `next-themes` so the rest of the app can opt in with one import.
 *
 * Why a thin wrapper:
 *   - We need `attribute="class"` so Tailwind's `dark:` variants (gated on
 *     `.dark *` per packages/ui/src/styles/globals.css) react to the theme
 *     change.
 *   - `enableSystem` exposes a third "system" option (the radio in Settings /
 *     onboarding maps to it).
 *   - The CSS transition that fades colours is keyed off a `theme-loaded`
 *     class so the *first* paint after page load doesn't animate from
 *     light → user-preference (would look like a flash). We add the class
 *     one tick after mount, after `next-themes` has applied the right
 *     class so the user only sees the animation when they actually flip
 *     the switch.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // requestAnimationFrame so the browser has committed the resolved theme
    // class before transitions start participating.
    const handle = requestAnimationFrame(() => {
      document.documentElement.classList.add("theme-loaded");
    });
    return () => cancelAnimationFrame(handle);
  }, []);

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange={false}
    >
      {children}
    </NextThemesProvider>
  );
}
