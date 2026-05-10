import Link from "next/link";
import {
  BookOpenTextIcon,
  CalendarDaysIcon,
  CoinsIcon,
  FileTextIcon,
  HighlighterIcon,
  KeyRoundIcon,
  LogInIcon,
  SparklesIcon,
  StickyNoteIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { StatCard } from "@/components/stat-card";
import { RangeSelector } from "@/components/range-selector";
import { parseRangeId, rangeLabel } from "@/lib/range";
import {
  getDashboardOverview,
  getRecentSignups,
  getReferralSources,
} from "@/lib/queries/analytics";

type PageProps = {
  searchParams: Promise<{ range?: string | string[] }>;
};

export default async function AdminOverviewPage({ searchParams }: PageProps) {
  const { range: rawRange } = await searchParams;
  const rangeId = parseRangeId(rawRange);

  const [overview, referrals, recentSignups] = await Promise.all([
    getDashboardOverview(rangeId),
    getReferralSources(rangeId),
    getRecentSignups(8),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
          Overview
        </span>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="font-heading text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
              How Quazom is doing,
              <span className="italic text-primary"> in numbers.</span>
            </h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Aggregate platform health and user behaviour. Showing{" "}
              <span className="font-medium text-foreground">
                {rangeLabel(rangeId).toLowerCase()}
              </span>
              .
            </p>
          </div>
          <RangeSelector active={rangeId} />
        </div>
      </header>

      <section
        aria-label="Headline KPIs"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard
          label="Total users"
          value={overview.totalUsers}
          hint={`${overview.totalAdmins} ${
            overview.totalAdmins === 1 ? "admin" : "admins"
          } · ${overview.signupsAllTime.toLocaleString()} signups all-time`}
          icon={UsersIcon}
        />
        <StatCard
          label="New signups"
          value={overview.newSignups}
          hint={
            rangeId === "all"
              ? "since the beginning of time"
              : `during ${rangeLabel(rangeId).toLowerCase()}`
          }
          icon={UserPlusIcon}
        />
        <StatCard
          label="Sign-ins"
          value={overview.signIns}
          hint={`${overview.activeUsers.toLocaleString()} distinct user${
            overview.activeUsers === 1 ? "" : "s"
          } signed in`}
          icon={LogInIcon}
        />
        <StatCard
          label="AI tokens used"
          value={overview.tokens.total}
          hint={`${overview.tokens.input.toLocaleString()} in · ${overview.tokens.output.toLocaleString()} out`}
          icon={CoinsIcon}
        />
      </section>

      <section
        aria-label="Generation activity"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <StatCard
          label="Curricula generated"
          value={overview.curriculaGenerated}
          icon={SparklesIcon}
        />
        <StatCard
          label="Lessons generated"
          value={overview.lessonsGenerated}
          icon={BookOpenTextIcon}
        />
        <StatCard
          label="Schedules created"
          value={overview.schedulesCreated}
          icon={CalendarDaysIcon}
        />
        <StatCard
          label="Notes created"
          value={overview.notesCreated}
          hint="excludes auto-annotation notes"
          icon={StickyNoteIcon}
        />
        <StatCard
          label="Annotations"
          value={overview.annotationsCreated}
          icon={HighlighterIcon}
        />
        <StatCard
          label="Note summarizations"
          value={overview.noteSummarizations}
          hint="AI summarize-note calls"
          icon={FileTextIcon}
        />
      </section>

      <section
        aria-label="Referrals and recent signups"
        className="grid grid-cols-1 gap-6 lg:grid-cols-2"
      >
        <ReferralSourcesCard rows={referrals} />
        <RecentSignupsCard rows={recentSignups} />
      </section>
    </div>
  );
}

function ReferralSourcesCard({
  rows,
}: {
  rows: Awaited<ReturnType<typeof getReferralSources>>;
}) {
  const total = rows.reduce((sum, r) => sum + r.signups, 0);
  return (
    <article className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card p-5 shadow-xs">
      <header className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Referral sources
        </h2>
        <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
          <KeyRoundIcon className="size-4" />
        </span>
      </header>
      <p className="text-xs text-muted-foreground">
        How new accounts found Quazom, from the onboarding survey. Null = the
        user skipped or signed up pre-survey.
      </p>
      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border/70 bg-background p-4 text-sm text-muted-foreground">
          No signups in this range.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border/60">
          {rows.map((row) => {
            const pct = total === 0 ? 0 : Math.round((row.signups / total) * 100);
            return (
              <li
                key={row.source ?? "__null"}
                className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium text-foreground">
                    {row.source ? row.source : <em className="text-muted-foreground">(not specified)</em>}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {row.signups.toLocaleString()} · {pct}%
                  </span>
                </div>
                <div
                  aria-hidden
                  className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}

function RecentSignupsCard({
  rows,
}: {
  rows: Awaited<ReturnType<typeof getRecentSignups>>;
}) {
  return (
    <article className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card p-5 shadow-xs">
      <header className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Latest signups
        </h2>
        <Link
          href="/users"
          className="text-xs font-medium text-primary underline-offset-4 hover:underline"
        >
          View all users
        </Link>
      </header>
      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border/70 bg-background p-4 text-sm text-muted-foreground">
          No users yet.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border/60">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
            >
              <div className="flex flex-col gap-0.5 min-w-0">
                <Link
                  href={`/users/${row.id}`}
                  className="truncate text-sm font-medium text-foreground hover:text-primary"
                >
                  {row.name || row.email}
                  {row.isAdmin ? (
                    <span className="ml-2 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                      admin
                    </span>
                  ) : null}
                </Link>
                <span className="truncate text-xs text-muted-foreground">
                  {row.email}
                  {row.referralSource ? ` · via ${row.referralSource}` : ""}
                </span>
              </div>
              <span
                className="text-xs text-muted-foreground"
                title={row.createdAt.toISOString()}
              >
                {formatDistanceToNow(row.createdAt, { addSuffix: true })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
