import "server-only";

import prisma from "@quazom-ai/db";
import type { WaitlistFilter } from "@/lib/waitlist-filter";

// Re-export so existing callers (the page) can keep a single import path.
export {
  parseWaitlistFilter,
  waitlistFilterLabel,
  WAITLIST_FILTER_OPTIONS,
} from "@/lib/waitlist-filter";
export type { WaitlistFilter } from "@/lib/waitlist-filter";

// --------------------------------------------------------------------------
// Waitlist / alpha-invite analytics queries.
//
// All reads are aggregated server-side so the admin client only ever sees
// pre-computed numbers + a flat list — no nested invite arrays, no raw user
// content. Mirrors the rest of `lib/queries/*` in shape.
// --------------------------------------------------------------------------

export type WaitlistStatus =
  | "joined"
  | "invited"
  | "redeemed"
  | "expired";

export type WaitlistRow = {
  id: string;
  firstName: string;
  email: string;
  source: string | null;
  joinedAt: Date;
  welcomeEmailSentAt: Date | null;
  /** Last time the cron OR an admin clicked "Send invite" for this entry. */
  lastInvitedAt: Date | null;
  /** All-time count of AlphaInvite rows minted for this email. */
  invitesSent: number;
  /** The most recent invite row (if any) — drives the action button. */
  latestInvite: {
    id: string;
    sentAt: Date | null;
    expiresAt: Date;
    redeemedAt: Date | null;
    /** Convenience flag computed at query time so the render path stays pure. */
    expired: boolean;
  } | null;
  /** True iff a User row exists with the same email. */
  hasAccount: boolean;
  status: WaitlistStatus;
};

export type WaitlistOverview = {
  totalSignups: number;
  awaitingInvite: number;
  invitesSent: number;
  invitesRedeemed: number;
  invitesExpired: number;
  invitesAwaitingRedemption: number;
};

/**
 * Aggregate counters for the page header. Single round-trip via parallel
 * `Promise.all` because every count is a tiny COUNT(*) and the values are
 * independent.
 */
export async function getWaitlistOverview(): Promise<WaitlistOverview> {
  const now = new Date();

  const [
    totalSignups,
    awaitingInvite,
    invitesSent,
    invitesRedeemed,
    invitesExpired,
    invitesAwaitingRedemption,
  ] = await Promise.all([
    prisma.waitlistEntry.count(),
    prisma.waitlistEntry.count({ where: { invitedAt: null } }),
    prisma.alphaInvite.count({ where: { sentAt: { not: null } } }),
    prisma.alphaInvite.count({ where: { redeemedAt: { not: null } } }),
    prisma.alphaInvite.count({
      where: { redeemedAt: null, expiresAt: { lt: now } },
    }),
    prisma.alphaInvite.count({
      where: {
        sentAt: { not: null },
        redeemedAt: null,
        expiresAt: { gte: now },
      },
    }),
  ]);

  return {
    totalSignups,
    awaitingInvite,
    invitesSent,
    invitesRedeemed,
    invitesExpired,
    invitesAwaitingRedemption,
  };
}

export async function getWaitlistRows(
  filter: WaitlistFilter = "all",
): Promise<WaitlistRow[]> {
  const now = new Date();

  // Single pass to fetch everyone. The waitlist is small (alpha-period
  // scale, low hundreds at most) so we don't paginate yet — easy to add
  // later via `skip/take` when the list grows.
  const entries = await prisma.waitlistEntry.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      firstName: true,
      email: true,
      source: true,
      welcomeEmailSentAt: true,
      invitedAt: true,
      createdAt: true,
      invites: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          sentAt: true,
          expiresAt: true,
          redeemedAt: true,
        },
      },
    },
  });

  if (entries.length === 0) return [];

  // Resolve account-existence in a single query by checking which waitlist
  // emails have a matching User row. Emails are stored lower-cased on both
  // sides so a direct `IN (...)` lookup works without `ILIKE`.
  const emails = entries.map((e) => e.email);
  const usersWithEmail = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { email: true },
  });
  const accountEmails = new Set(usersWithEmail.map((u) => u.email));

  const rows: WaitlistRow[] = entries.map((entry) => {
    const invitesSent = entry.invites.filter((i) => i.sentAt).length;
    const rawLatest = entry.invites[0] ?? null;
    const latestInvite = rawLatest
      ? {
          ...rawLatest,
          expired: rawLatest.expiresAt.getTime() < now.getTime(),
        }
      : null;
    const hasAccount = accountEmails.has(entry.email);

    const status: WaitlistStatus = hasAccount
      ? "redeemed"
      : latestInvite?.redeemedAt
        ? "redeemed"
        : latestInvite?.expired
          ? "expired"
          : latestInvite?.sentAt
            ? "invited"
            : "joined";

    return {
      id: entry.id,
      firstName: entry.firstName,
      email: entry.email,
      source: entry.source,
      joinedAt: entry.createdAt,
      welcomeEmailSentAt: entry.welcomeEmailSentAt,
      lastInvitedAt: entry.invitedAt,
      invitesSent,
      latestInvite,
      hasAccount,
      status,
    };
  });

  return rows.filter((row) => {
    switch (filter) {
      case "uninvited":
        // "Hasn't received any invite yet" — surfaces the next people the
        // cron will pick up. Doesn't matter whether they have an account
        // (some Quazom team members exist as users without ever being on
        // the waitlist; if they happen to be on it, we still want to see
        // them here so the admin knows the row exists).
        return row.invitesSent === 0;
      case "pending":
        // Invite is out there, key is still live, user hasn't redeemed it.
        // Most useful filter for chasing follow-ups.
        return (
          !row.hasAccount &&
          row.latestInvite !== null &&
          row.latestInvite.redeemedAt === null &&
          row.latestInvite.expiresAt.getTime() >= now.getTime() &&
          row.latestInvite.sentAt !== null
        );
      case "redeemed":
        return row.hasAccount || row.status === "redeemed";
      case "all":
      default:
        return true;
    }
  });
}

