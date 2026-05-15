import type { PlanKey } from "./plans";

/**
 * Registry of every "scholarly title" the user can earn and pin alongside
 * their name in the sidebar. Titles are slug-keyed so they round-trip
 * through Postgres (`User.earnedTitles TEXT[]` + `User.selectedTitle TEXT`)
 * and survive plan changes — once earned, always available.
 *
 * `availableUntil` gates when a title can FIRST be granted (the founding
 * window). Titles already earned before the cutoff stay forever; titles
 * granted on a later upgrade after the cutoff are simply skipped by the
 * webhook handler.
 *
 * `requiresPlan` declares the plan the user must be on at the moment of
 * the upgrade for the title to be granted. The user can still earn both
 * titles by upgrading + downgrading + upgrading again during the window.
 */
export type TitleSlug = "founding_explorer" | "founding_scholar";

export type TitleDef = {
  slug: TitleSlug;
  label: string;
  description: string;
  /** Plan the user must be on (when the webhook fires) to receive this title. */
  requiresPlan: PlanKey | null;
  /**
   * ISO-8601 cutoff. After this instant the title is no longer GRANTABLE on
   * new upgrades. `null` means evergreen.
   */
  availableUntil: string | null;
};

// Founding-tier cutoff: midnight at the END of July 7, 2026 in
// America/New_York. New York observes EDT (UTC−4) in early July, so the
// cutoff lands at July 8 00:00 ET = July 8 04:00 UTC. We hand-write the UTC
// instant rather than computing it at runtime so the cutoff is greppable in
// the codebase and testing its boundaries doesn't depend on the host
// machine's TZ data.
export const FOUNDING_CUTOFF_ISO = "2026-07-08T04:00:00.000Z";

export const TITLES: Record<TitleSlug, TitleDef> = {
  founding_explorer: {
    slug: "founding_explorer",
    label: "Founding Explorer",
    description:
      "Awarded to early Explorers who supported Quazom during its first season.",
    requiresPlan: "EXPLORER",
    availableUntil: FOUNDING_CUTOFF_ISO,
  },
  founding_scholar: {
    slug: "founding_scholar",
    label: "Founding Scholar",
    description:
      "Awarded to early Scholars who supported Quazom during its first season.",
    requiresPlan: "SCHOLAR",
    availableUntil: FOUNDING_CUTOFF_ISO,
  },
};

export const TITLE_SLUGS = Object.keys(TITLES) as TitleSlug[];

export function isTitleSlug(value: string): value is TitleSlug {
  return TITLE_SLUGS.includes(value as TitleSlug);
}

/**
 * True when a title can still be granted at `now`. Titles already in a
 * user's `earnedTitles` array are unaffected by this check.
 */
export function isTitleGrantable(
  slug: TitleSlug,
  now: Date = new Date(),
): boolean {
  const title = TITLES[slug];
  if (!title) return false;
  if (!title.availableUntil) return true;
  return now.getTime() < new Date(title.availableUntil).getTime();
}

/**
 * Title to grant (if any) when `userId` upgrades to `plan`. Returns `null`
 * when the active plan has no founding title or the cutoff has elapsed.
 */
export function titleForPlanUpgrade(
  plan: PlanKey,
  now: Date = new Date(),
): TitleSlug | null {
  for (const title of Object.values(TITLES)) {
    if (title.requiresPlan === plan && isTitleGrantable(title.slug, now)) {
      return title.slug;
    }
  }
  return null;
}

/** Display label, including a fallback if the slug is unknown to the registry. */
export function titleLabel(slug: string | null | undefined): string | null {
  if (!slug) return null;
  if (isTitleSlug(slug)) return TITLES[slug].label;
  return null;
}
