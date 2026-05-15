/**
 * Single source of truth for the paid plans surfaced in the Settings →
 * Subscription card and the polar webhook handler. Anything that needs to
 * map between a Polar productId, a UI plan key, and the per-plan generation
 * caps reads from this file so the wiring stays consistent end-to-end.
 *
 * Product ids are intentionally inlined (not env-driven) because they're
 * stable per environment and we want a typo at deploy time to fail at
 * import — not silently mis-route checkouts.
 */

export type PlanKey = "EXPLORER" | "SCHOLAR";
export type BillingInterval = "MONTH" | "YEAR";

export type PlanProduct = {
  /** Polar product id — passed through `authClient.checkout({ slug })`. */
  productId: string;
  /** Slug declared in `apps/main/lib/auth.ts` `polar({ checkout: { products } })`. */
  slug: string;
  /** Decimal price for the plan, in USD. Display only. */
  priceUsd: number;
};

export type Plan = {
  key: PlanKey;
  /** Display label, e.g. "Explorer". */
  label: string;
  /** Marketing tagline shown under the title in the upgrade card. */
  tagline: string;
  /** Bulleted feature list displayed inside the card. */
  features: ReadonlyArray<string>;
  /** Short copy clarifying who the tier is intended for. */
  bestFor: ReadonlyArray<string>;
  /** Pricing copy keyed by billing interval. */
  pricing: Record<BillingInterval, PlanProduct>;
  /**
   * Founding-tier title slug awarded when the user first subscribes during
   * the founding window — see `lib/subscription/titles.ts`.
   */
  foundingTitleSlug: string;
};

export const PLANS: Record<PlanKey, Plan> = {
  EXPLORER: {
    key: "EXPLORER",
    label: "Explorer",
    tagline:
      "For curious learners exploring new subjects and building study habits.",
    features: [
      "10 curriculum generations per month",
      "100 lesson generations per month",
      "Study scheduling",
      "Markdown note-taking",
      "Annotations",
      "Progression tracking",
      "Module graduation system",
      "Resource uploads",
      "Continuity Notes",
      "Note importing/exporting",
    ],
    bestFor: [
      "Casual learners",
      "Hobbyists",
      "Students supplementing coursework",
      "Lifelong learners exploring multiple interests",
    ],
    pricing: {
      MONTH: {
        productId: "332c0302-29e6-45b4-af10-0470011a109e",
        slug: "Explorer-Monthly",
        priceUsd: 5,
      },
      YEAR: {
        productId: "9603094c-c838-407e-ab90-6d1c231af4e0",
        slug: "Explorer-Yearly",
        priceUsd: 100,
      },
    },
    foundingTitleSlug: "founding_explorer",
  },
  SCHOLAR: {
    key: "SCHOLAR",
    label: "Scholar",
    tagline:
      "For deep learners, researchers, polymaths, and users building long-term educational systems inside Quazom.",
    features: [
      "Everything in Explorer",
      "Unlimited curriculum generation",
      "Unlimited lesson generation",
      "Priority access to new features",
      "Advanced Continuity Curricula",
      "Expanded interdisciplinary generation",
      "Future research-focused tools and workflows",
    ],
    bestFor: [
      "Independent researchers",
      "Writers and creators",
      "Graduate students",
      "Intellectually curious professionals",
      "Interdisciplinary learners",
      "Heavy Quazom users",
    ],
    pricing: {
      MONTH: {
        productId: "e5e04d23-2c06-4bd0-b2f4-305c61881e9d",
        slug: "Scholar-Monthly",
        priceUsd: 15,
      },
      YEAR: {
        productId: "b6afa45d-323e-4c29-8fe2-bb10388290c3",
        slug: "Scholar-Yearly",
        priceUsd: 150,
      },
    },
    foundingTitleSlug: "founding_scholar",
  },
};

export const PLAN_KEYS: ReadonlyArray<PlanKey> = ["EXPLORER", "SCHOLAR"];
export const BILLING_INTERVALS: ReadonlyArray<BillingInterval> = [
  "MONTH",
  "YEAR",
];

/** Look up a plan + interval by Polar product id. Used by the webhook. */
export function findPlanByProductId(
  productId: string,
): { plan: Plan; interval: BillingInterval } | null {
  for (const plan of Object.values(PLANS)) {
    for (const interval of BILLING_INTERVALS) {
      if (plan.pricing[interval].productId === productId) {
        return { plan, interval };
      }
    }
  }
  return null;
}
