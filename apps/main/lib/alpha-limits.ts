import "server-only";

/**
 * Compat shim for the original alpha-only limits module. The current source
 * of truth lives in `lib/subscription/plan-limits.ts`; this file re-exports
 * the legacy surface (`ALPHA_LIMITS`, `AlphaUsageSnapshot`,
 * `getAlphaUsage`, the per-feature counters) so existing callsites compile
 * unchanged while we incrementally move the codebase onto the plan-aware
 * helpers.
 */

import {
  LIMITS_BY_PLAN,
  countCurriculaForUser,
  countDiscussionGenerationsThisMonth,
  countLessonGenerationsThisMonth,
  startOfThisMonthUTC,
  type PlanUsageSnapshot,
} from "./subscription/plan-limits";

export {
  countCurriculaForUser,
  countDiscussionGenerationsThisMonth,
  countLessonGenerationsThisMonth,
  startOfThisMonthUTC,
};

// The old, alpha-only cap shape some legacy consumers still import.
export const ALPHA_LIMITS = {
  curricula: LIMITS_BY_PLAN.ALPHA.curricula.limit ?? 0,
  lessonsPerMonth: LIMITS_BY_PLAN.ALPHA.lessonsPerMonth.limit ?? 0,
  discussionsPerMonth: LIMITS_BY_PLAN.ALPHA.discussionsPerMonth.limit ?? 0,
} as const;

export type AlphaUsageSnapshot = PlanUsageSnapshot;
export { getPlanUsage as getAlphaUsage } from "./subscription/plan-limits";
