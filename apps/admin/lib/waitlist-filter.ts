// Pure constants + helpers for the waitlist filter UI. Lives outside
// `lib/queries/waitlist.ts` so the client-side `WaitlistFilterSelector`
// can import it without dragging in `server-only`-marked Prisma code.

export type WaitlistFilter = "all" | "uninvited" | "pending" | "redeemed";

const WAITLIST_FILTERS: WaitlistFilter[] = [
  "all",
  "uninvited",
  "pending",
  "redeemed",
];

export const WAITLIST_FILTER_OPTIONS = WAITLIST_FILTERS;

export function parseWaitlistFilter(value: unknown): WaitlistFilter {
  if (
    typeof value === "string" &&
    (WAITLIST_FILTERS as string[]).includes(value)
  ) {
    return value as WaitlistFilter;
  }
  return "all";
}

export function waitlistFilterLabel(filter: WaitlistFilter): string {
  switch (filter) {
    case "uninvited":
      return "Awaiting invite";
    case "pending":
      return "Invite pending";
    case "redeemed":
      return "Account created";
    case "all":
    default:
      return "All members";
  }
}
